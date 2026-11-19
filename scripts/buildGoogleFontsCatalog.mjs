/**
 * Generates the Google Fonts catalog shipped with the package
 * (`packages/excalidraw/fonts/google/catalog.json`), which the Google font
 * resolver reads its family names and metrics from.
 *
 *   yarn gen:google-fonts             # add new families, report drift
 *   yarn gen:google-fonts --new-only  # the same, without checking existing ones
 *   yarn gen:google-fonts --refresh   # also take over drifted metrics
 *   yarn gen:google-fonts --allow "A Family" --allow "Another"
 *                                     # add families held back as heavy
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
 * - Text fonts only. Google's list has no icon fonts (Material Icons and
 *   Symbols aren't in it), but it has families whose letters aren't letters:
 *   barcodes, pictograms, emoji, knitting charts, redacted text. Left out
 *   are the families Google classifies as "Symbols", and those matching
 *   `NON_TEXT_FAMILIES` which it doesn't. The math families (STIX Two
 *   Math, Noto Sans Math) are in: their letters are letters, and they hold
 *   the math symbols their text companions lack.
 * - No families known to draw wrong - see `BROKEN_FAMILIES`.
 * - No families which are slow to draw - see `SLOW_FAMILIES`. A family new
 *   to Google's list whose font file looks like one of those is held back
 *   until someone has measured it - see `getHeavyOutlinesReason`.
 *   A family already in the catalog stays, whatever it's classified as
 *   later - see the first rule.
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

/** not text fonts, and not classified as "Symbols" by Google - see the rules */
const NON_TEXT_FAMILIES = / Emoji$| Charted$| SignWriting$/;

/**
 * Families which draw wrong in plain text, each with what's wrong. Checked
 * in a browser's own text rendering, so it's the font as Google serves it.
 */
const BROKEN_FAMILIES = new Map([
  // seen 2026-11-14 in Chromium: "⊂" draws as a mark on top of the letter
  // before it ("ℕ ⊂ ℤ"), and "𝑓(" overlaps
  ["Libertinus Math", "relation signs draw over the preceding letter"],
]);

/**
 * Families whose glyphs take long to draw: over 10 ms for one line of text
 * on a canvas, where the median family takes 1.5 ms. Their outlines are huge
 * (Rubik Pixels: up to 20,084 points in a glyph, Roboto: 105), or they are
 * layered colour fonts. An editor draws every visible text anew at each zoom
 * level, so one such text stalls it for everyone looking at the scene.
 *
 * Measured 2026-11-14 in Chromium, for every family of the catalog: the ms
 * it took to draw "The quick brown fox jumps over the lazy dog" at a size
 * not drawn before. Families added since aren't measured - do that for the
 * ones a run adds whose design is of this kind.
 */
const SLOW_FAMILIES = new Map([
  ["Rubik Pixels", 4756],
  ["Rubik 80s Fade", 1162],
  ["Rubik Maps", 359],
  ["Rubik Glitch Pop", 187],
  ["Geist Pixel", 158],
  ["Rubik Doodle Triangles", 144],
  ["Rubik Microbe", 101],
  ["Rubik Dirt", 74],
  ["Bitcount Ink", 62],
  ["Rubik Lines", 59],
  ["Bitcount Prop Double Ink", 54],
  ["Bitcount Grid Double Ink", 53],
  ["Fredericka the Great", 50],
  ["Rubik Storm", 44],
  ["Bitcount Single Ink", 39],
  ["Bitcount Grid Single Ink", 38],
  ["Bitcount Prop Single Ink", 37],
  ["Rubik Distressed", 28],
  ["Splash", 28],
  ["Rubik Broken Fax", 27],
  ["Handjet", 24],
  ["Protest Revolution", 17.8],
  ["Rubik Doodle Shadow", 14.4],
  ["Rubik Spray Paint", 13.3],
  ["Rubik Maze", 12],
  ["Raleway Dots", 11.8],
  ["Love Ya Like A Sister", 10.7],
  ["Edu AU VIC WA NT Dots", 10.1],
]);

/**
 * Why a font file looks slow to draw, if it does: huge glyph outlines, or
 * colour layers. Of the 21 families measured over 20 ms this tells 20, along
 * with 20 of the roughly 1,900 measured under - so it holds a new family
 * back rather than leaving it out for good.
 *
 * Measure a family held back in a browser's console, with the latin `woff2`
 * of its `css2` stylesheet:
 *
 *   document.fonts.add(await new FontFace("probe", "url(<woff2>)").load());
 *   const canvas = document.createElement("canvas");
 *   const context = canvas.getContext("2d");
 *   context.scale(0.7, 0.7); // a size nothing was drawn at yet
 *   context.font = '20px "probe"';
 *   const start = performance.now();
 *   context.fillText("The quick brown fox jumps over the lazy dog", 4, 24);
 *   document.createElement("canvas").getContext("2d").drawImage(canvas, 0, 0);
 *   performance.now() - start;
 *
 * Over 10 ms: add it to `SLOW_FAMILIES`. Otherwise run with `--allow`.
 */
const getHeavyOutlinesReason = (sfnt) => {
  const { view, tables } = readSfntTables(sfnt);
  const colorTable = ["COLR", "SVG ", "sbix", "CBDT"].find((tag) =>
    tables.has(tag),
  );
  if (colorTable) {
    return `a colour font (${colorTable.trim()})`;
  }

  const maxp = tables.get("maxp");
  const outlines = tables.get("glyf") ?? tables.get("CFF ");
  if (!maxp || !outlines) {
    return undefined;
  }
  const glyphCount = view.getUint16(maxp.offset + 4);
  const bytesPerGlyph = Math.round(outlines.length / glyphCount);
  // TrueType outlines only
  const maxContours =
    view.getUint32(maxp.offset) === 0x00010000
      ? view.getUint16(maxp.offset + 8)
      : 0;

  return bytesPerGlyph > 1000 || (bytesPerGlyph > 600 && maxContours > 150)
    ? `outlines of ${bytesPerGlyph} bytes a glyph, up to ${maxContours} contours`
    : undefined;
};

/** why a family is left out, if it is */
const getExclusionReason = (family) => {
  const name = family.family;
  if (
    family.classifications?.includes("Symbols") ||
    NON_TEXT_FAMILIES.test(name)
  ) {
    return "not a text font";
  }
  if (BROKEN_FAMILIES.has(name)) {
    return `draws wrong: ${BROKEN_FAMILIES.get(name)}`;
  }
  if (SLOW_FAMILIES.has(name)) {
    return `slow to draw: ${SLOW_FAMILIES.get(name)} ms a line`;
  }
  return undefined;
};

/** families held back as heavy, which got measured and may come in */
const allowed = new Set(
  process.argv.flatMap((arg, i) =>
    arg === "--allow" && process.argv[i + 1] ? [process.argv[i + 1]] : [],
  ),
);

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
    tables.set(tag, {
      offset: view.getUint32(record + 8),
      length: view.getUint32(record + 12),
    });
  }
  return { view, tables };
};

const readMetrics = (sfnt) => {
  const { view, tables } = readSfntTables(sfnt);
  const head = tables.get("head")?.offset;
  const hhea = tables.get("hhea")?.offset;
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

const fetchSfnt = async (url) =>
  wawoff2.decompress(
    new Uint8Array(await (await fetchWithRetry(url)).arrayBuffer()),
  );

/**
 * The family's metrics, and for a family new to the catalog (`checkOutlines`)
 * whether its font file looks slow to draw.
 */
const resolveFamily = async (family, checkOutlines) => {
  const css = await (
    await fetchWithRetry(
      `${CSS_URL}?${new URLSearchParams({ family, display: "swap" })}`,
      { headers: { "User-Agent": BROWSER_USER_AGENT } },
    )
  ).text();

  const urls = [...css.matchAll(/url\((https:[^)]+\.woff2)\)/g)].map(
    (match) => match[1],
  );
  if (!urls.length) {
    throw new Error("no woff2 face in the stylesheet");
  }

  const sfnt = await fetchSfnt(urls[0]);
  const metrics = readMetrics(sfnt);
  if (!checkOutlines) {
    return { metrics };
  }
  // the last subset is the family's main one (latin, where it has it) - a
  // CJK family's first ones hold its most intricate glyphs, which says
  // little about the design
  const mainSfnt = urls.length > 1 ? await fetchSfnt(urls.at(-1)) : sfnt;
  return { metrics, heavyReason: getHeavyOutlinesReason(mainSfnt) };
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
  const excluded = [];
  const heldBack = [];
  const failed = [];
  const changed = [];
  const drifted = [];
  const added = [];
  const entries = new Map();

  const queue = families.filter((family) => {
    // an entry is forever, also when its family got reclassified since
    const exclusionReason = getExclusionReason(family);
    if (exclusionReason && !previousByName.has(family.family)) {
      excluded.push(`${family.family} (${exclusionReason})`);
      return false;
    }
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
        const resolved = await resolveFamily(name, !before);
        if (resolved.heavyReason && !allowed.has(name)) {
          heldBack.push(`${name} (${resolved.heavyReason})`);
          return;
        }
        live = resolved.metrics;
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

  // one entry per line, so that a regenerated catalog diffs per family -
  // written the way prettier formats it, which CI checks
  await writeFile(
    CATALOG_PATH,
    `[\n${catalog
      .map(
        (entry) =>
          `  [${entry.map((item) => JSON.stringify(item)).join(", ")}]`,
      )
      .join(",\n")}\n]\n`,
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
  report("Left out", excluded);
  report(
    "Held back: looks slow to draw. Measure it (see getHeavyOutlinesReason), then add it to SLOW_FAMILIES or run with --allow",
    heldBack,
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
