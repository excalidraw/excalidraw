import tinycolor from "tinycolor2";

import { COLOR_PALETTE } from "@excalidraw/common";
import {
  hasBackground,
  hasStrokeColor,
  isFrameLikeElement,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../i18n";

import type { TranslationKeys } from "../i18n";

/**
 * Conceptual color naming for screen readers.
 *
 * The goal is NOT to expose exact color codes but the *concept* of a color,
 * so that non-visual users can tell that elements sharing a color belong
 * together ("red", "light blue", …). Palette colors map exactly to their
 * family; arbitrary custom colors fall back to an HSL hue-bucket heuristic.
 */

export type ColorFamily =
  | "transparent"
  | "black"
  | "white"
  | "gray"
  | "red"
  | "pink"
  | "purple"
  | "violet"
  | "blue"
  | "cyan"
  | "teal"
  | "green"
  | "yellow"
  | "orange"
  | "brown";

export type ConceptualColor = {
  family: ColorFamily;
  /** pale shades (palette indexes 0–1, or very high lightness) */
  light?: boolean;
  /** very low lightness custom colors */
  dark?: boolean;
};

// palette key -> conceptual family ("grape" and "bronze" are designer names
// a screen reader user shouldn't need to know)
const PALETTE_FAMILY: Record<string, ColorFamily> = {
  transparent: "transparent",
  black: "black",
  white: "white",
  gray: "gray",
  red: "red",
  pink: "pink",
  grape: "purple",
  violet: "violet",
  blue: "blue",
  cyan: "cyan",
  teal: "teal",
  green: "green",
  yellow: "yellow",
  orange: "orange",
  bronze: "brown",
};

// exact hex -> conceptual color, built once from COLOR_PALETTE
const EXACT_COLOR_MAP = new Map<string, ConceptualColor>();
for (const [key, value] of Object.entries(COLOR_PALETTE)) {
  const family = PALETTE_FAMILY[key];
  if (!family) {
    continue;
  }
  if (typeof value === "string") {
    EXACT_COLOR_MAP.set(value.toLowerCase(), { family });
  } else {
    value.forEach((shade, index) => {
      // indexes 0–1 are the pale (50/200-weight) shades
      EXACT_COLOR_MAP.set(shade.toLowerCase(), {
        family,
        light: index <= 1 || undefined,
      });
    });
  }
}

const hueToFamily = (hue: number): ColorFamily => {
  if (hue < 15 || hue >= 345) {
    return "red";
  }
  if (hue < 45) {
    return "orange";
  }
  if (hue < 70) {
    return "yellow";
  }
  if (hue < 150) {
    return "green";
  }
  if (hue < 172) {
    return "teal";
  }
  if (hue < 200) {
    return "cyan";
  }
  if (hue < 248) {
    return "blue";
  }
  if (hue < 275) {
    return "violet";
  }
  if (hue < 310) {
    return "purple";
  }
  return "pink";
};

/**
 * Maps any CSS color to a conceptual color. Returns null for invalid colors.
 */
export const getConceptualColor = (color: string): ConceptualColor | null => {
  if (!color) {
    return null;
  }
  const exact = EXACT_COLOR_MAP.get(color.toLowerCase());
  if (exact) {
    return exact;
  }

  const tc = tinycolor(color);
  if (!tc.isValid()) {
    return null;
  }
  if (tc.getAlpha() === 0) {
    return { family: "transparent" };
  }

  const { h, s, l } = tc.toHsl();
  if (l <= 0.08) {
    return { family: "black" };
  }
  if (l >= 0.97) {
    return { family: "white" };
  }
  if (s <= 0.12) {
    if (l >= 0.92) {
      return { family: "white" };
    }
    if (l <= 0.15) {
      return { family: "black" };
    }
    return { family: "gray" };
  }
  // desaturated / darkened oranges read as brown
  if (h >= 15 && h < 50 && (s <= 0.5 || l <= 0.35) && l <= 0.55) {
    return { family: "brown" };
  }

  const family = hueToFamily(h);
  return {
    family,
    light: l >= 0.78 || undefined,
    dark: l <= 0.25 || undefined,
  };
};

/**
 * Localized conceptual color name ("red", "light blue"). Null when the color
 * is invalid or transparent (transparent is a non-color for descriptions —
 * callers announce it by omission).
 */
export const getColorName = (color: string): string | null => {
  const conceptual = getConceptualColor(color);
  if (!conceptual || conceptual.family === "transparent") {
    return null;
  }
  const name = t(`a11y.colorName.${conceptual.family}` as TranslationKeys);
  if (conceptual.light) {
    return t("a11y.colorLight", { color: name });
  }
  if (conceptual.dark) {
    return t("a11y.colorDark", { color: name });
  }
  return name;
};

/**
 * Color clause for an element description: "red", "red, light blue fill",
 * or "light blue fill" (transparent stroke). Null when color doesn't apply
 * (images, frames) or nothing is visible.
 */
export const getElementColorDescription = (
  element: ExcalidrawElement,
): string | null => {
  if (isFrameLikeElement(element) || element.type === "image") {
    return null;
  }

  const strokeName = hasStrokeColor(element.type)
    ? getColorName(element.strokeColor)
    : null;
  const fillName =
    hasBackground(element.type) && element.type !== "freedraw"
      ? getColorName(element.backgroundColor)
      : null;

  if (strokeName && fillName) {
    return strokeName === fillName
      ? strokeName
      : t("a11y.colorStrokeAndFill", { stroke: strokeName, fill: fillName });
  }
  if (strokeName) {
    return strokeName;
  }
  if (fillName) {
    return t("a11y.colorFill", { color: fillName });
  }
  return null;
};
