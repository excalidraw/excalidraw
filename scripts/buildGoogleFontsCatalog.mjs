/**
 * Generates the Google Fonts catalog shipped with the package
 * (`packages/excalidraw/fonts/google/catalog.json`), which the Google font
 * resolver reads its family names and metrics from.
 *
 *   yarn gen:google-fonts             # add new families, report drift
 *   yarn gen:google-fonts --new-only  # the same, without checking existing ones
 *   yarn gen:google-fonts --refresh   # also take over drifted metrics
 *   yarn gen:google-fonts --allow "A Family" --allow "Another"
 *                                     # add families which were held back
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
 * - No families whose text would jump when the text editor opens, because
 *   browsers don't agree on their vertical metrics - see
 *   `OFF_BASELINE_FAMILIES`. A family new to Google's list is held back
 *   when its font file says the same - see `getOffBaselineReason`.
 * - No families whose lines the canvas and the text editor lay out at
 *   different widths - see `UNEVEN_WIDTH_FAMILIES`. A font file doesn't
 *   tell, so a family new to Google's list isn't held back for it: that
 *   takes measuring in a browser.
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
  // seen 2026-11-19 in Chromium and Firefox, 2026-11-24 in Safari: at 20 px a
  // line starting with "rs" is about 900 px wide, where a sentence is 317
  ["Vibur", 'a line starting with "rs" is drawn three times too wide'],
  // seen 2026-11-19 in Chromium: not a font to write with
  ["Libertinus Keyboard", "draws key caps for sequences of letters"],
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

/**
 * Families whose text jumps up or down when the text editor opens and
 * closes. The canvas places a line's baseline from the catalog's metrics
 * (the file's `hhea` table). The editor is a textarea, which the browser
 * lays out with the metrics it reads itself - and a font file has three
 * sets of those:
 *
 * - `hhea`: what browsers read on macOS
 * - OS/2 `usWinAscent` / `usWinDescent`: what Chrome and Firefox read on
 *   Windows
 * - OS/2 `sTypoAscender` / `sTypoDescender`: what they read there when the
 *   font sets `USE_TYPO_METRICS`
 *
 * Google's rules ask for the three to agree. Where they don't, no catalog
 * value is right on every platform, and a catalog entry never changes once
 * shipped - so these are out.
 *
 * Measured 2026-11-16 for every family of the catalog, as the distance
 * between the browser's baseline and the canvas' for a line at 40 px: in
 * Chrome, Firefox and Safari on macOS and in Chrome and Firefox on Windows.
 * Out are the ones over 3.2 px, which is what system Helvetica has always
 * had. The rest of the catalog is within 2.9 px, and nine in ten families
 * within pixel snapping (about 1 px). Linux and Android weren't measured.
 */
const OFF_BASELINE_FAMILIES = new Map([
  ["Katibeh", "16.4 px at 40 px on Windows"],
  ["Mirza", "14.1 px at 40 px on Windows"],
  // their `hhea` descender is positive, which browsers read as a descent
  ["Coiny", "10 px at 40 px on every platform"],
  ["Revalia", "7.9 px at 40 px on every platform"],
  ["Tajawal", "7.3 px at 40 px on Windows"],
  ["Luckiest Guy", "5.9 px at 40 px on Windows"],
  ["Noto Traditional Nushu", "5.2 px at 40 px on every platform"],
  ["Maiden Orange", "4.9 px at 40 px on Windows"],
  ["Jomolhari", "3.8 px at 40 px on Windows"],
  ["Farsan", "3.6 px at 40 px on Windows"],
  ["Meera Inimai", "3.4 px at 40 px on Windows, and in Firefox on macOS"],
]);

/**
 * Families whose metrics give a line height lines of text don't fit in.
 * A text's line height is the one its font asks for, and it's saved with
 * the text.
 */
const UNUSABLE_LINE_HEIGHT_FAMILIES = new Map([
  // a descender of zero: its baseline is right, but lines overlap
  ["Allkin", 0.6],
]);

/**
 * Families whose lines come out at different widths on the canvas and in
 * the text editor, in a browser where no setting brings the two together.
 * A line which fits on the canvas then wraps in the editor or the other way
 * round, and letters shift as the editor opens and closes.
 *
 * Measured 2026-11-19 to 2026-11-24 for every family of the catalog, in px
 * at 20 px, on 21 lines of Latin text and a line in each of the family's own
 * scripts: in Chromium 145 and Firefox 146 on Linux, in Chrome 150, Firefox
 * 157 and Safari 15.5 on macOS, and the families over the limit in Safari
 * 27.2. Chrome was measured with its canvas set to kern and shape text the
 * way its editor does (`fontKerning`, `textRendering`); without that it
 * disagrees for hundreds more.
 *
 * Out are the ones off by over 5 px on a line, off at every punctuation mark
 * or off after nearly every edit. Smaller gaps stay: Caveat is 2.2 px off on
 * a line in Safari.
 *
 * A font file doesn't tell which family is of this kind, so nothing holds a
 * new one back, and families added since aren't measured.
 */
const UNEVEN_WIDTH_FAMILIES = new Map([
  // Chrome's canvas and editor disagree, whatever the canvas is set to
  ["Arvo", "2.3 px for every comma followed by a space, in Chrome"],
  ["Ruslan Display", "2.2 px on a line with punctuation, in Chrome"],
  ["Orelega One", "up to 2.3 px on a line, in Chrome"],
  // the same on Japanese text, and the other way round in Safari
  ["Cherry Bomb One", "5.2 px on a Japanese sentence, in Chrome and Safari"],
  // Safari's canvas draws their Latin letters unlike its editor, and unlike
  // every other browser
  ["Qahiri", "58.7 px on a sentence, in Safari"],
  ["Aref Ruqaa", "41.2 px on a sentence, in Safari"],
  ["Aref Ruqaa Ink", "41.2 px on a sentence, in Safari"],
  ["Gulzar", "13.2 px on a sentence, in Safari"],
  ["Tiro Bangla", "8.8 px on a sentence, in Safari"],
  ["Tiro Devanagari Hindi", "8.8 px on a sentence, in Safari"],
  ["Tiro Devanagari Marathi", "8.8 px on a sentence, in Safari"],
  ["Tiro Devanagari Sanskrit", "8.8 px on a sentence, in Safari"],
  ["Tiro Gurmukhi", "8.8 px on a sentence, in Safari"],
  ["Tiro Kannada", "8.8 px on a sentence, in Safari"],
  ["Tiro Tamil", "8.8 px on a sentence, in Safari"],
  ["Tiro Telugu", "8.8 px on a sentence, in Safari"],
  ["Playpen Sans", "7.1 px on a sentence, in Safari"],
  ["Playpen Sans Arabic", "7.1 px on a sentence, in Safari"],
  ["Playpen Sans Deva", "7.1 px on a sentence, in Safari"],
  ["Playpen Sans Hebrew", "7.1 px on a sentence, in Safari"],
  ["Playpen Sans Thai", "7.1 px on a sentence, in Safari"],
  // Safari's editor lays their Latin letters out unlike its canvas
  ["Barrio", "13.1 px on a sentence, in Safari"],
  ["Mansalva", "5.9 px on a sentence, in Safari"],
  ["Mynerve", "5.9 px on a sentence, in Safari"],
  // Safari keeps two letters unkerned once a line break was removed between
  // them. Any kerned font has that; in these nearly every pair is kerned
  ["Betania Patmos", "2.2 to 2.7 px wider per edit, in Safari"],
  ["Betania Patmos GDL", "2.2 to 2.7 px wider per edit, in Safari"],
  ["Betania Patmos In", "2.2 to 2.7 px wider per edit, in Safari"],
  ["Betania Patmos In GDL", "2.2 to 2.7 px wider per edit, in Safari"],
  ["Momo Signature", "1.7 px wider per edit, in Safari"],
]);

/** the gap system Helvetica has between editor and canvas, in em */
const MAX_BASELINE_GAP = 0.08;
const MIN_LINE_HEIGHT = 0.75;

/**
 * Why a font file's vertical metrics would put its text off the baseline, or
 * give it an unusable line height, if they do - see `OFF_BASELINE_FAMILIES`.
 *
 * Read from the file alone: the baseline a browser on Windows gives a line,
 * against the one the catalog's `hhea` values give. Checked 2026-11-16
 * against the measurements: of the catalog's 1,895 families it tells
 * exactly the 11 measured over the limit.
 */
const getOffBaselineReason = (sfnt) => {
  const { view, tables } = readSfntTables(sfnt);
  const [unitsPerEm, ascender, descender, lineGap] = readMetrics(sfnt);

  const lineHeight = (ascender - descender + lineGap) / unitsPerEm;
  if (lineHeight < MIN_LINE_HEIGHT) {
    return `a line height of ${lineHeight.toFixed(2)}`;
  }

  const os2 = tables.get("OS/2")?.offset;
  if (os2 === undefined) {
    return undefined;
  }
  // fsSelection bit 7
  const useTypoMetrics = (view.getUint16(os2 + 62) & 0x80) !== 0;
  const [ascent, descent] = useTypoMetrics
    ? [view.getInt16(os2 + 68), -view.getInt16(os2 + 70)]
    : [view.getUint16(os2 + 74), view.getUint16(os2 + 76)];

  // a line's baseline sits at half the line height plus half of (ascent -
  // descent), so the two differ by half of what the metrics differ by
  const gap = (ascent - descent - (ascender + descender)) / (2 * unitsPerEm);

  return Math.abs(gap) > MAX_BASELINE_GAP
    ? `baseline off by ${Math.round(
        Math.abs(gap) * 100,
      )}% of the font size on Windows (hhea ${ascender} / ${descender}, ${
        useTypoMetrics ? "typo" : "win"
      } ${ascent} / ${useTypoMetrics ? -descent : descent})`
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
  if (OFF_BASELINE_FAMILIES.has(name)) {
    return `text jumps in the editor: ${OFF_BASELINE_FAMILIES.get(name)}`;
  }
  if (UNEVEN_WIDTH_FAMILIES.has(name)) {
    return `canvas and text editor disagree on its width: ${UNEVEN_WIDTH_FAMILIES.get(
      name,
    )}`;
  }
  if (UNUSABLE_LINE_HEIGHT_FAMILIES.has(name)) {
    return `a line height of ${UNUSABLE_LINE_HEIGHT_FAMILIES.get(name)}`;
  }
  return undefined;
};

/** families which were held back, got measured and may come in */
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

// copied: what `decompress` returns doesn't outlive the next call to it
const fetchSfnt = async (url) =>
  Uint8Array.from(
    await wawoff2.decompress(
      new Uint8Array(await (await fetchWithRetry(url)).arrayBuffer()),
    ),
  );

/**
 * The family's metrics, and for a family new to the catalog (`checkOutlines`)
 * why it's held back, if it is: its font file looks slow to draw, or its
 * vertical metrics would put its text off the baseline.
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
  return {
    metrics,
    heldBackReason:
      getOffBaselineReason(sfnt) ?? getHeavyOutlinesReason(mainSfnt),
  };
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
        if (resolved.heldBackReason && !allowed.has(name)) {
          heldBack.push(`${name} (${resolved.heldBackReason})`);
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
    "Held back: looks slow to draw, or off the baseline. Measure it (see getHeavyOutlinesReason, OFF_BASELINE_FAMILIES), then add it to the list it belongs to or run with --allow",
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
