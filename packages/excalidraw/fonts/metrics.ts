import { FONT_FAMILY } from "../constants";

/** For head & hhea metrics read the woff2 with https://fontdrop.info/  */
export interface FontMetrics {
  /** head.unitsPerEm */
  unitsPerEm: 1000 | 1024 | 2048;
  /** hhea.ascender */
  ascender: number;
  /** hhea.descender */
  descender: number;
  /** harcoded unitless line-height, https://github.com/excalidraw/excalidraw/pull/6360#issuecomment-1477635971 */
  lineHeight: number;
  /** flag to display a new badge */
  badge?: "new";
  /** flag to hide a font from the picker */
  hidden?: boolean;
}

export const DEFAULT_FONT_METRICS: Record<number, FontMetrics> = {
  [FONT_FAMILY.Virgil]: {
    unitsPerEm: 1000,
    ascender: 886,
    descender: -374,
    lineHeight: 1.25,
    hidden: true,
  },
  [FONT_FAMILY.Excalifont]: {
    unitsPerEm: 1000,
    ascender: 886,
    descender: -374,
    lineHeight: 1.25,
    badge: "new",
  },
  [FONT_FAMILY.Helvetica]: {
    unitsPerEm: 2048,
    ascender: 1577,
    descender: -471,
    lineHeight: 1.15,
    hidden: true,
  },
  [FONT_FAMILY.Cascadia]: {
    unitsPerEm: 2048,
    ascender: 1900,
    descender: -480,
    lineHeight: 1.2,
  },
  [FONT_FAMILY.Assistant]: {
    unitsPerEm: 1000,
    ascender: 1021,
    descender: -287,
    lineHeight: 1.25,
    badge: "new",
  },
  [FONT_FAMILY.Nunito]: {
    unitsPerEm: 1000,
    ascender: 1011,
    descender: -353,
    lineHeight: 1.25,
    badge: "new",
  },
  [FONT_FAMILY.Bangers]: {
    unitsPerEm: 1000,
    ascender: 883,
    descender: -181,
    lineHeight: 1.25,
    badge: "new",
  },
  [FONT_FAMILY.Pacifico]: {
    unitsPerEm: 1000,
    ascender: 1303,
    descender: -453,
    lineHeight: 1.75,
    badge: "new",
  },
  [FONT_FAMILY["Comic Shanns"]]: {
    unitsPerEm: 1000,
    ascender: 750,
    descender: -250,
    lineHeight: 1.2,
    badge: "new",
  },
  [FONT_FAMILY["Permanent Marker"]]: {
    unitsPerEm: 1024,
    ascender: 1136,
    descender: -325,
    lineHeight: 1.25,
    badge: "new",
  },
  [FONT_FAMILY["Liberation Sans"]]: {
    unitsPerEm: 2048,
    ascender: 1854,
    descender: -434,
    lineHeight: 1.15,
    badge: "new",
  },
};

/** Unicode ranges */
export const RANGES = {
  LATIN:
    "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  LATIN_EXT:
    "U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
  CYRILIC_EXT:
    "U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F",
  CYRILIC: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116",
  VIETNAMESE:
    "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB",
};
