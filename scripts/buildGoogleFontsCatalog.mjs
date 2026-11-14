/**
 * Generates the Google Fonts catalog shipped with the package
 * (`packages/excalidraw/fonts/google/catalog.json`), which the Google font
 * resolver reads its family names and metrics from.
 *
 *   yarn gen:google-fonts             # add new families, report drift
 *   yarn gen:google-fonts --new-only  # the same, without checking existing ones
 *   yarn gen:google-fonts --refresh   # also take over drifted metrics
 *
 * Per family it asks Google's `css2` API for the regular (400) face, downloads
 * the first subset file and reads the vertical metrics out of its `head` and
 * `hhea` tables - every subset of a family shares those.
 *
 * Rules:
 *
 * - The catalog is append-only. A font id (i.e. "google:Roboto") is saved
 *   into documents, so an entry never goes away and never changes:
 *   - A family which leaves Google's list keeps its entry. The run fails if
 *     the output would lose a name.
 *   - A family keeps the metrics it was added with, even when Google has
 *     since changed the font. Every version of the package, and every host
 *     and renderer using one, then lays the same text out the same way. The
 *     drift is reported, and taking it over is a deliberate `--refresh`.
 * - Only families with a regular 400 face. Without one `css2` needs an
 *   explicit weight, and which weight such a family should default to is
 *   left open until weights are supported.
 * - No icon fonts: they aren't in Google's font list to begin with.
 *
 * Entry: [name, unitsPerEm, ascender, descender, lineGap, script?], most
 * popular family first. `script` is set where "Aa" makes a poor preview: CJK
 * families, and families with no Latin subset.
 */
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const wawoff2 = require("wawoff2");

const CATALOG_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../packages/excalidraw/fonts/google/catalog.json",
);

const METADATA_URL = "https://fonts.google.com/metadata/fonts";
const CSS_URL = "https://fonts.googleapis.com/css2";

/**
 * `css2` answers by User-Agent: a browser gets woff2 split into
 * `unicode-range` subsets - what the editor loads - anything else gets a
 * single unsubsetted TrueType file.
 */
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const CONCURRENCY = 8;
const ATTEMPTS = 4;

/** scripts whose families get a native preview even with Latin glyphs */
const CJK_SCRIPTS = new Set(["Jpan", "Hira", "Kore", "Hans", "Hant"]);

const newOnly = process.argv.includes("--new-only");
const refresh = process.argv.includes("--refresh");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (url, init) => {
  let lastError;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) {
        return response;
      }
      lastError = new Error(`${response.status} for ${url}`);
      // a 4xx other than "slow down" is an answer, not a blip
      if (response.status < 500 && response.status !== 429) {
        break;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(500 * 2 ** attempt);
  }
  throw lastError;
};

/** the tables' byte ranges out of an sfnt (TrueType / OpenType) file */
const readSfntTables = (sfnt) => {
  const view = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength);
  const tables = new Map();
  const count = view.getUint16(4);
  for (let i = 0; i < count; i++) {
    const record = 12 + i * 16;
    const tag = String.fromCharCode(
      view.getUint8(record),
      view.getUint8(record + 1),
      view.getUint8(record + 2),
      view.getUint8(record + 3),
    );
    tables.set(tag, view.getUint32(record + 8));
  }
  return { view, tables };
};

const readMetrics = (sfnt) => {
  const { view, tables } = readSfntTables(sfnt);
  const head = tables.get("head");
  const hhea = tables.get("hhea");
  if (head === undefined || hhea === undefined) {
    throw new Error("no head / hhea table");
  }

  const unitsPerEm = view.getUint16(head + 18);
  const ascender = view.getInt16(hhea + 4);
  const descender = view.getInt16(hhea + 6);
  const lineGap = view.getInt16(hhea + 8);

  if (!unitsPerEm || ascender - descender + lineGap <= 0) {
    throw new Error(
      `unusable metrics (${unitsPerEm}, ${ascender}, ${descender}, ${lineGap})`,
    );
  }

  return [unitsPerEm, ascender, descender, lineGap];
};

const resolveMetrics = async (family) => {
  const css = await (
    await fetchWithRetry(
      `${CSS_URL}?${new URLSearchParams({ family, display: "swap" })}`,
      { headers: { "User-Agent": BROWSER_USER_AGENT } },
    )
  ).text();

  const url = css.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
  if (!url) {
    throw new Error("no woff2 face in the stylesheet");
  }

  const woff2 = new Uint8Array(await (await fetchWithRetry(url)).arrayBuffer());
  return readMetrics(await wawoff2.decompress(woff2));
};

const main = async () => {
  /** @type {Array<[string, number, number, number, number, string?]>} */
  const previous = JSON.parse(
    await readFile(CATALOG_PATH, "utf8").catch(() => "[]"),
  );
  const previousByName = new Map(previous.map((entry) => [entry[0], entry]));

  let metadataText = await (await fetchWithRetry(METADATA_URL)).text();
  // served with an anti-JSON-hijacking prefix
  if (metadataText.startsWith(")]}'")) {
    metadataText = metadataText.slice(metadataText.indexOf("\n") + 1);
  }
  const families = JSON.parse(metadataText).familyMetadataList.sort(
    (a, b) => a.popularity - b.popularity,
  );

  const skipped = [];
  const failed = [];
  const changed = [];
  const drifted = [];
  const added = [];
  const entries = new Map();

  const queue = families.filter((family) => {
    // a regular, upright 400 - see the rules above
    if (!family.fonts["400"]) {
      skipped.push(
        `${family.family} (${Object.keys(family.fonts).join(", ")})`,
      );
      return false;
    }
    return true;
  });

  let done = 0;
  const work = async (family) => {
    const name = family.family;
    const before = previousByName.get(name);
    const script =
      CJK_SCRIPTS.has(family.primaryScript) ||
      (family.primaryScript && !family.subsets.includes("latin"))
        ? family.primaryScript
        : undefined;

    const kept = before?.slice(1, 5);
    let live;
    if (!before || !newOnly) {
      try {
        live = await resolveMetrics(name);
      } catch (error) {
        failed.push(`${name}: ${error.message}`);
      }
    }

    // an existing entry keeps its metrics, unless told otherwise
    const metrics = kept && !(refresh && live) ? kept : live;

    if (metrics) {
      entries.set(
        name,
        script ? [name, ...metrics, script] : [name, ...metrics],
      );
      if (!before) {
        added.push(name);
      } else if (live && kept.join() !== live.join()) {
        (refresh ? changed : drifted).push(`${name}: ${kept} -> ${live}`);
      }
    }

    if (++done % 100 === 0) {
      console.info(`${done} / ${queue.length}`);
    }
  };

  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < queue.length) {
        await work(queue[next++]);
      }
    }),
  );

  // in Google's order, then whatever left Google's list (or failed to
  // resolve this time) with the entry it had
  const catalog = queue
    .map((family) => entries.get(family.family))
    .filter(Boolean);
  const retired = previous.filter((entry) => !entries.has(entry[0]));
  catalog.push(...retired);

  const names = new Set(catalog.map((entry) => entry[0]));
  const lost = previous.filter((entry) => !names.has(entry[0]));
  if (lost.length) {
    throw new Error(
      `The catalog is append-only, but would lose: ${lost
        .map((entry) => entry[0])
        .join(", ")}`,
    );
  }

  // one entry per line, so that a regenerated catalog diffs per family
  await writeFile(
    CATALOG_PATH,
    `[\n${catalog.map((entry) => JSON.stringify(entry)).join(",\n")}\n]\n`,
  );

  const report = (title, items) => {
    if (items.length) {
      console.info(`\n${title} (${items.length}):\n  ${items.join("\n  ")}`);
    }
  };
  console.info(`\n${catalog.length} families written to ${CATALOG_PATH}`);
  report("Added", added);
  report("Metrics changed (--refresh)", changed);
  report(
    "Metrics differ from Google's current files, kept (--refresh takes them over)",
    drifted,
  );
  report(
    "No longer in Google's list, kept",
    retired.map((entry) => entry[0]),
  );
  report("Left out, no regular 400 face", skipped);
  report("Failed to resolve", failed);

  if (failed.length) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
