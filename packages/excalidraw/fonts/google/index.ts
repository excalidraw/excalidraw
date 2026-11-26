/**
 * Google Fonts for the editor: the catalog of families, and a resolver
 * turning a family name into the font faces and metrics the editor loads.
 *
 * ```tsx
 * import {
 *   GOOGLE_FONT_PROVIDER_KEY,
 *   createGoogleFontResolver,
 * } from "@excalidraw/excalidraw/fonts/google";
 *
 * // renders Google fonts found in documents, offers none in the font picker
 * <Excalidraw
 *   fontProviders={{
 *     [GOOGLE_FONT_PROVIDER_KEY]: {
 *       icon,
 *       availableFonts: [],
 *       resolve: createGoogleFontResolver(),
 *     },
 *   }}
 * />
 * ```
 *
 * Opt-in, as resolving a family requests it from Google's servers. Sharing
 * one catalog is what makes text carry over between hosts: each uses the same
 * family names as ids, and lays text out with the same metrics.
 *
 * WARN: nothing here may import editor code at runtime (types are fine) - it
 * has to load in a worker and on a server, and stay out of the main bundle.
 */
import type { FontDefinition, FontResolver } from "../Fonts";

import type { FontSearchResult } from "../../types";

/** the provider key of every Google font id, i.e. "google:Open Sans" */
export { GOOGLE_FONT_PROVIDER_KEY } from "../providerKey";

/**
 * Also exported by the main entry. Here, so that a host can register its
 * resolvers at startup without loading the editor.
 */
export { registerFontResolvers } from "../resolvers";

export type GoogleFont = {
  /**
   * The family name, exactly as Google publishes it - the family part of the
   * font id, i.e. "Roboto" in "google:Roboto".
   */
  name: string;
  /** read from the font files when the catalog is generated */
  metrics: FontDefinition["metadata"]["metrics"];
  /**
   * Text previewing the family where "Aa" would misrepresent it: CJK
   * families, and families with no Latin glyphs.
   */
  previewText?: string;
};

export type GoogleFontCatalog = {
  /** every family, most popular first */
  fonts: readonly GoogleFont[];
  /** by exact name */
  get(name: string): GoogleFont | undefined;
};

/**
 * [name, unitsPerEm, ascender, descender, lineGap, script?] - see
 * `scripts/buildGoogleFontsCatalog.mjs`
 */
type CatalogEntry = [string, number, number, number, number, string?];

const PREVIEW_TEXT_BY_SCRIPT: Record<string, string> = {
  Jpan: "あ",
  Hira: "あ",
  Kore: "한",
  Hans: "汉",
  Hant: "漢",
  Khmr: "ក",
  Taml: "அ",
  Laoo: "ກ",
};

let catalogPromise: Promise<GoogleFontCatalog> | null = null;

/**
 * The catalog: the Google font families the editor offers. A small,
 * hand-picked set - each one looked at on the canvas and in the text editor,
 * in Chrome, Firefox and Safari - and not Google's whole list. A chunk of
 * its own, loaded on first use and kept for the session.
 *
 * Append-only across releases, as font ids are saved into documents. A family
 * added in a later version of the package isn't in it.
 */
export const loadGoogleFontCatalog = (): Promise<GoogleFontCatalog> => {
  if (!catalogPromise) {
    catalogPromise = import("./catalog.json").then((module) => {
      const fonts = (module.default as CatalogEntry[]).map(
        ([name, unitsPerEm, ascender, descender, lineGap, script]) => {
          const font: GoogleFont = {
            name,
            metrics: {
              unitsPerEm,
              ascender,
              descender,
              // the font's own default line spacing, over the em
              lineHeight: (ascender - descender + lineGap) / unitsPerEm,
            },
          };
          const previewText = script && PREVIEW_TEXT_BY_SCRIPT[script];
          if (previewText) {
            font.previewText = previewText;
          }
          return font;
        },
      );
      const byName = new Map(fonts.map((font) => [font.name, font]));

      return { fonts, get: (name: string) => byName.get(name) };
    });
    // i.e. the chunk failed to load - let the next call try again
    catalogPromise.catch(() => {
      catalogPromise = null;
    });
  }

  return catalogPromise;
};

/**
 * Why a family couldn't be resolved. The two aren't interchangeable for a
 * caller deciding whether to try again:
 *
 * - `unknown-family` - not in the catalog. Trying again won't help.
 * - `unavailable` - its files couldn't be listed (network, or the source is
 *   down), after the resolver's own retries.
 */
export class GoogleFontError extends Error {
  constructor(
    public readonly reason: "unknown-family" | "unavailable",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "GoogleFontError";
  }
}

type FontFaces = FontDefinition["fontFaces"];

/**
 * Where a family's font files are: given a catalog family, the faces to
 * load. The default asks Google ({@link googleFontsCss2Source}); a host
 * mirroring the files can list its own urls instead, for the same families.
 */
export type GoogleFontSource = (
  font: GoogleFont,
  options: { fetch: typeof fetch },
) => Promise<FontFaces>;

const CSS2_URL = "https://fonts.googleapis.com/css2";
const ATTEMPTS = 3;
const RETRY_DELAY = 300;
const REQUEST_TIMEOUT = 10_000;
/** distinct families resolved against the source at once */
const CONCURRENCY = 4;

/** `url(…)` paired with its `format(…)`; either may be quoted */
const SRC_ENTRY_REGEX =
  /url\(\s*(['"]?)(.+?)\1\s*\)\s*format\(\s*(['"]?)([^'")]+)\3\s*\)/g;

const getDeclaration = (block: string, property: string) =>
  new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i")
    .exec(block)?.[1]
    .trim();

/** the woff2 faces of a `css2` stylesheet, one per `unicode-range` subset */
const parseFontFaces = (css: string) => {
  const fontFaces: FontFaces[number][] = [];
  let blocks = 0;

  for (const [, block] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    blocks++;
    const uri = Array.from(
      (getDeclaration(block, "src") ?? "").matchAll(SRC_ENTRY_REGEX),
    ).find(([, , , , format]) => format.toLowerCase() === "woff2")?.[2];

    if (!uri) {
      continue;
    }

    const unicodeRange = getDeclaration(block, "unicode-range");
    // the catalog holds the regular face only, so weight & style are the
    // defaults - the range is all that tells a family's faces apart
    fontFaces.push(
      unicodeRange ? { uri, descriptors: { unicodeRange } } : { uri },
    );
  }

  return { fontFaces, blocks };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Asks Google's `css2` API for the family's regular face. Its answer is a
 * stylesheet listing one woff2 file per `unicode-range` subset, on
 * `fonts.gstatic.com`.
 *
 * WARN: `css2` answers by User-Agent, and only a browser's gets woff2. On a
 * server, pass a `fetch` which sends one (a browser must not: it can't set
 * that header, and trying turns the request into a preflighted one).
 */
export const googleFontsCss2Source: GoogleFontSource = async (
  font,
  { fetch },
) => {
  const url = `${CSS2_URL}?${new URLSearchParams({
    family: font.name,
    display: "swap",
  })}`;

  let failure: unknown;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt) {
      await sleep(RETRY_DELAY * 3 ** (attempt - 1));
    }

    try {
      const response = await fetch(url, {
        signal:
          typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
            ? AbortSignal.timeout(REQUEST_TIMEOUT)
            : undefined,
      });

      if (response.ok) {
        const { fontFaces, blocks } = parseFontFaces(await response.text());
        const [first, ...rest] = fontFaces;
        if (!first) {
          throw new GoogleFontError(
            "unavailable",
            blocks
              ? `Google Fonts listed no woff2 files for "${font.name}" - on a server, pass a \`fetch\` which sends a browser User-Agent`
              : `Google Fonts listed no font files for "${font.name}"`,
          );
        }
        return [first, ...rest];
      }

      failure = new Error(`${response.status} ${response.statusText}`);
      // anything but "try later" is an answer - asking again won't change it
      if (response.status < 500 && response.status !== 429) {
        break;
      }
    } catch (error) {
      if (error instanceof GoogleFontError) {
        throw error;
      }
      failure = error;
    }
  }

  throw new GoogleFontError(
    "unavailable",
    `Couldn't load the font files of "${font.name}" from Google Fonts`,
    { cause: failure },
  );
};

/**
 * A resolver for Google fonts, to pass as a font provider's `resolve` or
 * among an export's `fontResolvers` under {@link GOOGLE_FONT_PROVIDER_KEY}.
 *
 * - Resolves catalog families only, by exact name. Anything else rejects, so
 *   that text keeps its font id and renders in a fallback font.
 * - Metrics come from the catalog, never from the files, so every host and
 *   every renderer lays out the same text the same way.
 * - Transient failures are retried here - the editor doesn't retry a family
 *   which failed to resolve until the user asks it to.
 * - Concurrent calls for a family share one request. Results aren't kept:
 *   the editor caches definitions itself, and a long-lived server process
 *   would otherwise hold on to file urls Google has since replaced.
 */
export const createGoogleFontResolver = ({
  fetch: fetchOption,
  source = googleFontsCss2Source,
}: {
  /** defaults to the global `fetch` - see {@link googleFontsCss2Source} */
  fetch?: typeof fetch;
  /** where the font files are - defaults to Google */
  source?: GoogleFontSource;
} = {}): FontResolver => {
  const inFlight = new Map<string, Promise<FontDefinition>>();
  let active = 0;
  const waiting: (() => void)[] = [];

  const withSlot = async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= CONCURRENCY) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    active++;
    try {
      return await task();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };

  return (familyName) => {
    let resolving = inFlight.get(familyName);

    if (!resolving) {
      resolving = (async () => {
        const font = (await loadGoogleFontCatalog()).get(familyName);
        if (!font) {
          throw new GoogleFontError(
            "unknown-family",
            `"${familyName}" isn't a Google font this version knows`,
          );
        }

        const fontFaces = await withSlot(() =>
          source(font, {
            // looked up late, so that a `fetch` patched after creating the
            // resolver (i.e. by a test, or instrumentation) is honored
            fetch: fetchOption ?? ((...args) => globalThis.fetch(...args)),
          }),
        );

        return { fontFaces, metadata: { metrics: font.metrics } };
      })();

      inFlight.set(familyName, resolving);
      const forget = () => inFlight.delete(familyName);
      resolving.then(forget, forget);
    }

    return resolving;
  };
};

const SUGGESTIONS_LIMIT = 24;

const getEditDistance = (a: string, b: string) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[b.length];
};

/**
 * A font provider's `search`, over the catalog: the families whose name
 * contains the query, in the catalog's order. Only when none does, the
 * families a typo away ("literrata").
 */
export const searchGoogleFonts = async (
  query: string,
  options?: { signal?: AbortSignal },
): Promise<FontSearchResult> => {
  const { fonts } = await loadGoogleFontCatalog();
  options?.signal?.throwIfAborted();

  const needle = query.trim().toLowerCase();
  if (!needle) {
    return { kind: "match", fonts: [] };
  }

  const matches = fonts
    .filter((font) => font.name.toLowerCase().includes(needle))
    .map((font) => font.name);
  if (matches.length) {
    return { kind: "match", fonts: matches };
  }

  // against the name's start too, as a typo usually comes with a query
  // which is only the beginning of the name
  const maxDistance = Math.max(1, Math.floor(needle.length / 4));
  const suggestions: { name: string; distance: number }[] = [];
  for (const { name } of fonts) {
    const lowerCased = name.toLowerCase();
    const distance = Math.min(
      getEditDistance(needle, lowerCased.slice(0, needle.length)),
      getEditDistance(needle, lowerCased),
    );
    if (distance <= maxDistance) {
      suggestions.push({ name, distance });
    }
  }

  return {
    kind: "suggestion",
    // stable, so equally close families stay in the catalog's order
    fonts: suggestions
      .sort((a, b) => a.distance - b.distance)
      .slice(0, SUGGESTIONS_LIMIT)
      .map((suggestion) => suggestion.name),
  };
};

/**
 * How many of the catalog's families `loadMoreGoogleFonts` pages through at
 * most: its first ones. The rest is found by `searchGoogleFonts`, which
 * covers the whole catalog. (The catalog is smaller than this today.)
 *
 * A font picker draws each family's name in its own font, so browsing costs
 * a download per family (about 20 KB) and the memory of a loaded font, which
 * the page keeps until it's reloaded.
 */
export const GOOGLE_FONT_BROWSE_LIMIT = 100;

/**
 * A font provider's `loadMore`, over the catalog: its families (the first
 * `GOOGLE_FONT_BROWSE_LIMIT` of them) a page at a time, in its order.
 */
export const loadMoreGoogleFonts = async ({
  offset,
  limit,
  signal,
}: {
  offset: number;
  limit: number;
  signal?: AbortSignal;
}): Promise<string[]> => {
  const { fonts } = await loadGoogleFontCatalog();
  signal?.throwIfAborted();

  return fonts
    .slice(offset, Math.min(offset + limit, GOOGLE_FONT_BROWSE_LIMIT))
    .map((font) => font.name);
};

/**
 * A font provider's `getPreviewText`: a sample in the family's own script
 * where it has one, "" otherwise (which the editor previews as "Aa").
 */
export const getGoogleFontPreviewText = async (
  familyName: string,
): Promise<string> =>
  (await loadGoogleFontCatalog()).get(familyName)?.previewText ?? "";

/**
 * The catalog's families by name and in its order, for a font picker's
 * `availableFonts`: a few of each kind. Here as well, so that a host can list
 * them without loading the catalog.
 */
export const GOOGLE_FONT_DEFAULT_PICKS: readonly string[] = [
  // handwriting
  "Kalam",
  "Patrick Hand",
  "Pacifico",
  // sans
  "Open Sans",
  // serif
  "Literata",
  // monospace
  "Fira Mono",
  // display
  "Bevan",
  // Japanese
  "Zen Maru Gothic",
  // Korean
  "Gowun Dodum",
];
