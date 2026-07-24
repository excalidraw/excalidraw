import type {
  ExcalidrawTextElement,
  FontFamilyValues,
} from "@excalidraw/element/types";

import { FONT_FAMILY, FONT_FAMILY_FALLBACKS } from "./constants";

/**
 * Encapsulates font metrics with additional font metadata.
 * */
export interface FontMetadata {
  /** for head & hhea metrics read the woff2 with https://fontdrop.info/ */
  metrics: {
    /** head.unitsPerEm metric */
    unitsPerEm: 1000 | 1024 | 2048;
    /** hhea.ascender metric */
    ascender: number;
    /** hhea.descender metric */
    descender: number;
    /** harcoded unitless line-height, https://github.com/excalidraw/excalidraw/pull/6360#issuecomment-1477635971 */
    lineHeight: number;
  };
  /** flag to indicate a deprecated font */
  deprecated?: true;
  /**
   * whether this is a font that users can use (= shown in font picker)
   */
  private?: true;
  /** flag to indiccate a local-only font */
  local?: true;
  /** flag to indicate a fallback font */
  fallback?: true;
  /** script category for grouping fonts in the picker */
  script?: "arabic";
}

export const FONT_METADATA: Record<number, FontMetadata> = {
  [FONT_FAMILY.Excalifont]: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 886,
      descender: -374,
      lineHeight: 1.25,
    },
  },
  [FONT_FAMILY.Nunito]: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 1011,
      descender: -353,
      lineHeight: 1.25,
    },
  },
  [FONT_FAMILY["Lilita One"]]: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 923,
      descender: -220,
      lineHeight: 1.15,
    },
  },
  [FONT_FAMILY["Comic Shanns"]]: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 750,
      descender: -250,
      lineHeight: 1.25,
    },
  },
  [FONT_FAMILY.Virgil]: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 886,
      descender: -374,
      lineHeight: 1.25,
    },
    deprecated: true,
  },
  [FONT_FAMILY.Helvetica]: {
    metrics: {
      unitsPerEm: 2048,
      ascender: 1577,
      descender: -471,
      lineHeight: 1.15,
    },
    deprecated: true,
    local: true,
  },
  [FONT_FAMILY.Cascadia]: {
    metrics: {
      unitsPerEm: 2048,
      ascender: 1900,
      descender: -480,
      lineHeight: 1.2,
    },
    deprecated: true,
  },
  [FONT_FAMILY["Liberation Sans"]]: {
    metrics: {
      unitsPerEm: 2048,
      ascender: 1854,
      descender: -434,
      lineHeight: 1.15,
    },
    private: true,
  },
  [FONT_FAMILY.Assistant]: {
    metrics: {
      unitsPerEm: 2048,
      ascender: 1021,
      descender: -287,
      lineHeight: 1.25,
    },
    private: true,
  },
  [FONT_FAMILY["Noto Naskh Arabic"]]: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 1068,
      descender: -492,
      lineHeight: 1.4,
    },
    script: "arabic",
  },
  [FONT_FAMILY.Lemonada]: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 1017,
      descender: -584,
      lineHeight: 1.4,
    },
    script: "arabic",
  },
  [FONT_FAMILY["Baloo Bhaijaan 2"]]: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 1020,
      descender: -500,
      lineHeight: 1.3,
    },
    script: "arabic",
  },
  [FONT_FAMILY["Cairo Play"]]: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 1056,
      descender: -520,
      lineHeight: 1.35,
    },
    script: "arabic",
  },
  [FONT_FAMILY.Changa]: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 932,
      descender: -450,
      lineHeight: 1.3,
    },
    script: "arabic",
  },
  [FONT_FAMILY_FALLBACKS.Xiaolai]: {
    metrics: {
      unitsPerEm: 1000,
      ascender: 880,
      descender: -144,
      lineHeight: 1.25,
    },
    fallback: true,
  },
  [FONT_FAMILY_FALLBACKS["Segoe UI Emoji"]]: {
    metrics: {
      // reusing Excalifont metrics
      unitsPerEm: 1000,
      ascender: 886,
      descender: -374,
      lineHeight: 1.25,
    },
    local: true,
    fallback: true,
  },
};

/** Unicode ranges defined by google fonts */
export const GOOGLE_FONTS_RANGES = {
  LATIN:
    "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  LATIN_EXT:
    "U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
  CYRILIC_EXT:
    "U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F",
  CYRILIC: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116",
  VIETNAMESE:
    "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB",
  ARABIC:
    "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB, U+10E60-10E7E, U+10EC2-10EC4, U+10EFC-10EFF, U+1EE00-1EE03, U+1EE05-1EE1F, U+1EE21-1EE22, U+1EE24, U+1EE27, U+1EE29-1EE32, U+1EE34-1EE37, U+1EE39, U+1EE3B, U+1EE42, U+1EE47, U+1EE49, U+1EE4B, U+1EE4D-1EE4F, U+1EE51-1EE52, U+1EE54, U+1EE57, U+1EE59, U+1EE5B, U+1EE5D, U+1EE5F, U+1EE61-1EE62, U+1EE64, U+1EE67-1EE6A, U+1EE6C-1EE72, U+1EE74-1EE77, U+1EE79-1EE7C, U+1EE7E, U+1EE80-1EE89, U+1EE8B-1EE9B, U+1EEA1-1EEA3, U+1EEA5-1EEA9, U+1EEAB-1EEBB, U+1EEF0-1EEF1",
};

/** local protocol to skip the local font from registering or inlining */
export const LOCAL_FONT_PROTOCOL = "local:";

/**
 * Calculates vertical offset for a text with alphabetic baseline.
 */
export const getVerticalOffset = (
  fontFamily: ExcalidrawTextElement["fontFamily"],
  fontSize: ExcalidrawTextElement["fontSize"],
  lineHeightPx: number,
) => {
  const { unitsPerEm, ascender, descender } =
    FONT_METADATA[fontFamily]?.metrics ||
    FONT_METADATA[FONT_FAMILY.Excalifont].metrics;

  const fontSizeEm = fontSize / unitsPerEm;
  const lineGap =
    (lineHeightPx - fontSizeEm * ascender + fontSizeEm * descender) / 2;

  const verticalOffset = fontSizeEm * ascender + lineGap;
  return verticalOffset;
};

/**
 * Gets line height for a selected family.
 */
export const getLineHeight = (fontFamily: FontFamilyValues) => {
  const { lineHeight } =
    FONT_METADATA[fontFamily]?.metrics ||
    FONT_METADATA[FONT_FAMILY.Excalifont].metrics;

  return lineHeight as ExcalidrawTextElement["lineHeight"];
};
