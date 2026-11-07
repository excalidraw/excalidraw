import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import {
  DEFAULT_FONT_FAMILY,
  FONT_FAMILY,
  FONT_FAMILY_FALLBACKS,
  isCustomFontFamily,
} from "./constants";

import type { CustomFontFamily, FontFamily } from "./constants";

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
}

/**
 * Built-in font metadata, keyed by numeric family id. Frozen - runtime
 * metadata for custom families goes through {@link setCustomFontMetadata},
 * never into this record.
 */
export const FONT_METADATA: Readonly<Record<number, FontMetadata>> = {
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

Object.freeze(FONT_METADATA);

/**
 * Metrics for custom (provider-qualified) families, registered at runtime by
 * the editor's font registry - the single seam through which they reach the
 * metric helpers below, keeping {@link FONT_METADATA} frozen. Those helpers
 * must live in this package, as `@excalidraw/element` consumes them.
 *
 * Page-global, never per editor: a qualified family identifies exactly one
 * definition, so its metrics are a fact about the family.
 */
const customFontMetadata = new Map<CustomFontFamily, FontMetadata>();

export const setCustomFontMetadata = (
  family: CustomFontFamily,
  metadata: FontMetadata,
) => {
  customFontMetadata.set(family, metadata);
};

export const getFontMetadata = (fontFamily: FontFamily): FontMetadata =>
  (isCustomFontFamily(fontFamily)
    ? customFontMetadata.get(fontFamily)
    : FONT_METADATA[fontFamily]) ?? FONT_METADATA[DEFAULT_FONT_FAMILY];

/**
 * Whether real metrics exist for the family. Built-ins always count - even an
 * unknown numeric id falls back to Excalifont metrics (forward compat with
 * newer clients); a custom family has none until its provider resolves it.
 */
export const isFontMetadataAvailable = (fontFamily: FontFamily): boolean =>
  !isCustomFontFamily(fontFamily) || customFontMetadata.has(fontFamily);

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
    getFontMetadata(fontFamily).metrics;

  const fontSizeEm = fontSize / unitsPerEm;
  const lineGap =
    (lineHeightPx - fontSizeEm * ascender + fontSizeEm * descender) / 2;

  const verticalOffset = fontSizeEm * ascender + lineGap;
  return verticalOffset;
};

/**
 * Gets line height for a selected family.
 */
export const getLineHeight = (fontFamily: FontFamily) => {
  const { lineHeight } = getFontMetadata(fontFamily).metrics;

  return lineHeight as ExcalidrawTextElement["lineHeight"];
};

/**
 * The correct `lineHeight` for the element's family, or `null` to leave the
 * stored value alone.
 *
 * `lineHeight` is a snapshot of the family's metrics taken at write time, but
 * a custom family's metrics only arrive once its provider resolves them - an
 * element written before that carries the fallback's. This is the single place
 * encoding when the snapshot may be corrected: custom families only (a
 * built-in's value may be a legitimately divergent legacy `detectLineHeight`)
 * and only once their real metrics are in.
 *
 * Callers scope the correction to just-loaded families, so it fires at most
 * once per family. Two accepted consequences: a host-set value present while
 * the faces are still arriving is corrected along with the baked-in ones, and
 * a scene which never observes a load keeps its stored values.
 */
export const reconcileLineHeight = (
  element: Pick<ExcalidrawTextElement, "fontFamily" | "lineHeight">,
): ExcalidrawTextElement["lineHeight"] | null => {
  if (
    !isCustomFontFamily(element.fontFamily) ||
    !isFontMetadataAvailable(element.fontFamily)
  ) {
    return null;
  }

  const lineHeight = getLineHeight(element.fontFamily);
  return element.lineHeight === lineHeight ? null : lineHeight;
};
