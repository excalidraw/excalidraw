import type { FontFamilyValues } from "@excalidraw/element/types";

/**
 * Unicode ranges covered by the Excalifont woff2 splits.
 * Keep in sync with `packages/excalidraw/fonts/Excalifont/index.ts`.
 *
 * Characters outside these ranges are not in the font files. Canvas/HTML may
 * still show them via `sans-serif` fallback, but SVG/PNG font subsetting will
 * omit them — and hand-drawn look is lost. Prefer NFD when components are covered.
 */
export const EXCALIFONT_UNICODE_RANGES = [
  "U+20-7e,U+a0-a3,U+a5-a6,U+a8-ab,U+ad-b1,U+b4,U+b6-b8,U+ba-ff,U+131,U+152-153,U+2bc,U+2c6,U+2da,U+2dc,U+304,U+308,U+2013-2014,U+2018-201a,U+201c-201e,U+2020,U+2022,U+2024-2026,U+2030,U+2039-203a,U+20ac,U+2122,U+2212",
  "U+100-130,U+132-137,U+139-149,U+14c-151,U+154-17e,U+192,U+1fc-1ff,U+218-21b,U+237,U+1e80-1e85,U+1ef2-1ef3,U+2113",
  "U+400-45f,U+490-491,U+2116",
  "U+37e,U+384-38a,U+38c,U+38e-393,U+395-3a1,U+3a3-3a8,U+3aa-3cf,U+3d7",
  "U+2c7,U+2d8-2d9,U+2db,U+2dd,U+302,U+306-307,U+30a-30c,U+326-328,U+212e,U+2211,U+fb01-fb02",
  "U+462-463,U+472-475,U+4d8-4d9,U+4e2-4e3,U+4e6-4e9,U+4ee-4ef",
  "U+300-301,U+303",
] as const;

/**
 * `FONT_FAMILY.Excalifont` — inlined to avoid a circular import through
 * `constants` → `colors` → `@excalidraw/math` → `@excalidraw/common`.
 */
const EXCALIFONT_FAMILY_ID = 5;

/** Build a regex matching any codepoint listed in CSS unicode-range descriptors. */
export const unicodeRangesToRegex = (ranges: readonly string[]): RegExp => {
  const unicodeRangeRegex = ranges
    .flatMap((rangeList) => rangeList.split(/,\s*/))
    .map((range) => {
      const [start, end] = range.replace(/U\+/gi, "").split("-");
      if (end) {
        return `\\u{${start}}-\\u{${end}}`;
      }
      return `\\u{${start}}`;
    })
    .join("");

  return new RegExp(`[${unicodeRangeRegex}]`, "u");
};

const EXCALIFONT_COVERAGE = unicodeRangesToRegex(EXCALIFONT_UNICODE_RANGES);

/**
 * Rewrite precomposed characters that Excalifont lacks into NFD forms whose
 * components are present in the font (e.g. Ȳ → Y + combining macron).
 *
 * Leaves characters unchanged when either the precomposed form is already
 * covered, or NFD components are not all covered (system fallback still applies).
 */
export const rewriteTextForExcalifont = (text: string): string => {
  // Fast path: pure ASCII is always covered by Excalifont's basic Latin range
  if (!/[^\u0000-\u007F]/u.test(text)) {
    return text;
  }

  let changed = false;
  const out: string[] = [];

  for (const char of text) {
    if (EXCALIFONT_COVERAGE.test(char)) {
      out.push(char);
      continue;
    }

    const nfd = char.normalize("NFD");
    if (
      nfd !== char &&
      Array.from(nfd).every((component) => EXCALIFONT_COVERAGE.test(component))
    ) {
      out.push(nfd);
      changed = true;
      continue;
    }

    out.push(char);
  }

  return changed ? out.join("") : text;
};

/**
 * Adjust text for canvas/SVG rendering & measurement so glyphs missing from
 * the selected family still draw with that family's available components.
 */
export const rewriteTextForFontFamily = (
  text: string,
  fontFamily: FontFamilyValues,
): string => {
  if (fontFamily === EXCALIFONT_FAMILY_ID) {
    return rewriteTextForExcalifont(text);
  }
  return text;
};
