import { colord, extend } from "colord";
import namesPlugin from "colord/plugins/names";

import { clamp } from "@excalidraw/math";
import { degreesToRadians } from "@excalidraw/math";

import type { Degrees } from "@excalidraw/math";

extend([namesPlugin]);

// ---------------------------------------------------------------------------
// Dark mode color transformation
// ---------------------------------------------------------------------------

// Browser-only cache to avoid memory leaks on server
const DARK_MODE_COLORS_CACHE: Map<string, string> | null =
  typeof window !== "undefined" ? new Map() : null;

const DARK_MODE_FILTER_INVERT_PERCENT = 93;
const DARK_MODE_FILTER_HUE_ROTATE_DEGREES = 180 as Degrees;

function cssHueRotate(
  red: number,
  green: number,
  blue: number,
  degrees: Degrees,
): { r: number; g: number; b: number } {
  // normalize
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;

  // Convert degrees to radians
  const a = degreesToRadians(degrees);

  const c = Math.cos(a);
  const s = Math.sin(a);

  // rotation matrix
  const matrix = [
    0.213 + c * 0.787 - s * 0.213,
    0.715 - c * 0.715 - s * 0.715,
    0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143,
    0.715 + c * 0.285 + s * 0.14,
    0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787,
    0.715 - c * 0.715 + s * 0.715,
    0.072 + c * 0.928 + s * 0.072,
  ];

  // transform
  const newR = r * matrix[0] + g * matrix[1] + b * matrix[2];
  const newG = r * matrix[3] + g * matrix[4] + b * matrix[5];
  const newB = r * matrix[6] + g * matrix[7] + b * matrix[8];

  // clamp the values to [0, 1] range and convert back to [0, 255]
  return {
    r: Math.round(Math.max(0, Math.min(1, newR)) * 255),
    g: Math.round(Math.max(0, Math.min(1, newG)) * 255),
    b: Math.round(Math.max(0, Math.min(1, newB)) * 255),
  };
}

const cssInvert = (
  r: number,
  g: number,
  b: number,
  percent: number,
): { r: number; g: number; b: number } => {
  const p = clamp(percent, 0, 100) / 100;

  // Function to invert a single color component
  const invertComponent = (color: number): number => {
    // Apply the invert formula
    const inverted = color * (1 - p) + (255 - color) * p;
    // Round to the nearest integer and clamp to [0, 255]
    return Math.round(clamp(inverted, 0, 255));
  };

  // Calculate the inverted RGB components
  const invertedR = invertComponent(r);
  const invertedG = invertComponent(g);
  const invertedB = invertComponent(b);

  return { r: invertedR, g: invertedG, b: invertedB };
};

export const applyDarkModeFilter = (color: string, enable = true): string => {
  if (!enable) {
    return color;
  }

  const cached = DARK_MODE_COLORS_CACHE?.get(color);
  if (cached) {
    return cached;
  }

  const rgb = colord(color).toRgb();

  // order of operations matters
  // (corresponds to "filter: invert(invertPercent) hue-rotate(hueDegrees)" in css)
  const inverted = cssInvert(
    rgb.r,
    rgb.g,
    rgb.b,
    DARK_MODE_FILTER_INVERT_PERCENT,
  );
  const rotated = cssHueRotate(
    inverted.r,
    inverted.g,
    inverted.b,
    DARK_MODE_FILTER_HUE_ROTATE_DEGREES,
  );

  const result = colord({ ...rotated, a: rgb.a }).toHex();

  if (DARK_MODE_COLORS_CACHE) {
    DARK_MODE_COLORS_CACHE.set(color, result);
  }

  return result;
};

const _reverseDarkModeInvert = (
  r: number,
  g: number,
  b: number,
): { r: number; g: number; b: number } => {
  const p = DARK_MODE_FILTER_INVERT_PERCENT / 100;
  const denominator = 1 - 2 * p;
  const restore = (color: number) =>
    Math.round(clamp((color - 255 * p) / denominator, 0, 255));

  return {
    r: restore(r),
    g: restore(g),
    b: restore(b),
  };
};

export const removeDarkModeFilter = (color: string): string => {
  const rgb = colord(color).toRgb();

  // 180deg hue rotation is its own inverse, so undo it before the inversion.
  const rotatedBack = cssHueRotate(
    rgb.r,
    rgb.g,
    rgb.b,
    DARK_MODE_FILTER_HUE_ROTATE_DEGREES,
  );
  const restored = _reverseDarkModeInvert(
    rotatedBack.r,
    rotatedBack.g,
    rotatedBack.b,
  );

  return colord({ ...restored, a: rgb.a }).toHex();
};

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

// FIXME can't put to utils.ts rn because of circular dependency
const pick = <R extends Record<string, any>, K extends readonly (keyof R)[]>(
  source: R,
  keys: K,
) => {
  return keys.reduce((acc, key: K[number]) => {
    if (key in source) {
      acc[key] = source[key];
    }
    return acc;
  }, {} as Pick<R, K[number]>) as Pick<R, K[number]>;
};

export type ColorTuple = readonly [string, string, string, string, string];

// used general type instead of specific type (ColorPalette) to support custom colors
export type ColorPaletteCustom = { [key: string]: ColorTuple | string };
export type ColorShadesIndexes = [number, number, number, number, number];

export const MAX_CUSTOM_COLORS_USED_IN_CANVAS = 5;
export const COLORS_PER_ROW = 5;

export const DEFAULT_CHART_COLOR_INDEX = 4;

export const DEFAULT_ELEMENT_STROKE_COLOR_INDEX = 4;
export const DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX = 1;

export const COLOR_PALETTE = {
  transparent: "transparent",
  black: "#1e1e1e",
  white: "#ffffff",
  // open-color from https://github.com/yeun/open-color/blob/master/open-color.js
  // corresponds to indexes [0,2,4,6,8] (weights: 50, 200, 400, 600, 800)
  gray: ["#f8f9fa", "#e9ecef", "#ced4da", "#868e96", "#343a40"],
  red: ["#fff5f5", "#ffc9c9", "#ff8787", "#fa5252", "#e03131"],
  pink: ["#fff0f6", "#fcc2d7", "#f783ac", "#e64980", "#c2255c"],
  grape: ["#f8f0fc", "#eebefa", "#da77f2", "#be4bdb", "#9c36b5"],
  violet: ["#f3f0ff", "#d0bfff", "#9775fa", "#7950f2", "#6741d9"],
  blue: ["#e7f5ff", "#a5d8ff", "#4dabf7", "#228be6", "#1971c2"],
  cyan: ["#e3fafc", "#99e9f2", "#3bc9db", "#15aabf", "#0c8599"],
  teal: ["#e6fcf5", "#96f2d7", "#38d9a9", "#12b886", "#099268"],
  green: ["#ebfbee", "#b2f2bb", "#69db7c", "#40c057", "#2f9e44"],
  yellow: ["#fff9db", "#ffec99", "#ffd43b", "#fab005", "#f08c00"],
  orange: ["#fff4e6", "#ffd8a8", "#ffa94d", "#fd7e14", "#e8590c"],
  // radix bronze shades [3,5,7,9,11]
  bronze: ["#f8f1ee", "#eaddd7", "#d2bab0", "#a18072", "#846358"],
} as const;

export type ColorPalette = typeof COLOR_PALETTE;
export type ColorPickerColor = keyof typeof COLOR_PALETTE;

const COMMON_ELEMENT_SHADES = pick(COLOR_PALETTE, [
  "cyan",
  "blue",
  "violet",
  "grape",
  "pink",
  "green",
  "teal",
  "yellow",
  "orange",
  "red",
]);

// quick picks defaults
// -----------------------------------------------------------------------------

/** number of slots in the color-picker top-picks strip — the strip layout is
 * sized for exactly this many swatches, and pick customization (replace /
 * reorder) preserves it */
export const COLOR_TOP_PICKS_SLOTS = 5;

// ORDER matters for positioning in quick picker
export const DEFAULT_ELEMENT_STROKE_PICKS = [
  COLOR_PALETTE.black,
  COLOR_PALETTE.red[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
  COLOR_PALETTE.green[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
  COLOR_PALETTE.blue[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
  COLOR_PALETTE.yellow[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
] as ColorTuple;

// ORDER matters for positioning in quick picker
export const DEFAULT_ELEMENT_BACKGROUND_PICKS = [
  COLOR_PALETTE.transparent,
  COLOR_PALETTE.red[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
  COLOR_PALETTE.green[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
  COLOR_PALETTE.blue[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
  COLOR_PALETTE.yellow[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
] as ColorTuple;

// ORDER matters for positioning in quick picker.
// Same as element background picks, with `transparent` (a no-op fill for the
// bucket tool) swapped for white.
export const BUCKET_FILL_BACKGROUND_PICKS = [
  COLOR_PALETTE.white,
  COLOR_PALETTE.red[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
  COLOR_PALETTE.green[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
  COLOR_PALETTE.blue[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
  COLOR_PALETTE.yellow[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
] as ColorTuple;

// sticky notes are their own color domain (own defaults, own picks)
export const DEFAULT_STICKY_NOTE_BG = "#ffdf6b";

export const STICKY_NOTE_STROKE_PICKS: ColorTuple =
  DEFAULT_ELEMENT_STROKE_PICKS;

// ORDER matters for positioning in quick picker. Classic note colors; the
// first one is `DEFAULT_STICKY_NOTE_BG`. Never transparent.
export const STICKY_NOTE_BACKGROUND_PICKS = [
  DEFAULT_STICKY_NOTE_BG,
  COLOR_PALETTE.pink[1],
  COLOR_PALETTE.green[1],
  COLOR_PALETTE.blue[1],
  COLOR_PALETTE.orange[1],
] as ColorTuple;

// ORDER matters for positioning in quick picker
export const DEFAULT_CANVAS_BACKGROUND_PICKS = [
  COLOR_PALETTE.white,
  // radix slate2
  "#f8f9fa",
  // radix blue2
  "#f5faff",
  // radix yellow2
  "#fffce8",
  // radix bronze2
  "#fdf8f6",
] as ColorTuple;

// palette defaults
// -----------------------------------------------------------------------------

export const DEFAULT_ELEMENT_STROKE_COLOR_PALETTE = {
  // 1st row
  transparent: COLOR_PALETTE.transparent,
  white: COLOR_PALETTE.white,
  gray: COLOR_PALETTE.gray,
  black: COLOR_PALETTE.black,
  bronze: COLOR_PALETTE.bronze,
  // rest
  ...COMMON_ELEMENT_SHADES,
} as const;

// ORDER matters for positioning in pallete (5x3 grid)s
export const DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE = {
  transparent: COLOR_PALETTE.transparent,
  white: COLOR_PALETTE.white,
  gray: COLOR_PALETTE.gray,
  black: COLOR_PALETTE.black,
  bronze: COLOR_PALETTE.bronze,

  ...COMMON_ELEMENT_SHADES,
} as const;

// color palette helpers
// -----------------------------------------------------------------------------

// !!!MUST BE WITHOUT GRAY, TRANSPARENT AND BLACK!!!
export const getAllColorsSpecificShade = (index: 0 | 1 | 2 | 3 | 4) => [
  // 2nd row
  COLOR_PALETTE.cyan[index],
  COLOR_PALETTE.blue[index],
  COLOR_PALETTE.violet[index],
  COLOR_PALETTE.grape[index],
  COLOR_PALETTE.pink[index],

  // 3rd row
  COLOR_PALETTE.green[index],
  COLOR_PALETTE.teal[index],
  COLOR_PALETTE.yellow[index],
  COLOR_PALETTE.orange[index],
  COLOR_PALETTE.red[index],
];

// -----------------------------------------------------------------------------
// other helpers
// -----------------------------------------------------------------------------

/** @returns #RRGGBB, or #RRGGBBAA if `a` is below 1 */
export const rgbToHex = (r: number, g: number, b: number, a?: number) =>
  colord({ r, g, b, a }).toHex();

/**
 * @returns the color with its alpha replaced by `alpha` (as #RRGGBBAA), or the
 *  input unchanged if it's not a valid color
 */
export const setColorAlpha = (color: string, alpha: number): string => {
  const parsed = colord(color);
  return parsed.isValid() ? parsed.alpha(alpha).toHex() : color;
};

/**
 * @returns #RRGGBB or #RRGGBBAA based on color containing non-opaque alpha,
 *  null if not valid color
 */
export const colorToHex = (color: string): string | null => {
  const parsed = colord(color);
  return parsed.isValid() ? parsed.toHex() : null;
};

export const isTransparent = (color: string) => {
  return colord(color).alpha() === 0;
};

/**
 * Whether the color is fully opaque (alpha exactly 1).
 *
 * NOT the negation of `isTransparent`, which is true only at alpha 0 — a
 * partial-alpha color (`#RRGGBBAA`, `rgba(…, 0.5)`) is neither transparent
 * (it renders) nor opaque (what's beneath shows through it).
 */
export const isOpaqueColor = (color: string) => {
  return colord(color).alpha() === 1;
};

// -----------------------------------------------------------------------------
// color contract helpers
// -----------------------------------------------------------------------------

export const COLOR_OUTLINE_CONTRAST_THRESHOLD = 240;

const calculateContrast = (r: number, g: number, b: number): number => {
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq;
};

// YIQ algo, inspiration from https://stackoverflow.com/a/11868398
export const isColorDark = (color: string, threshold = 160): boolean => {
  // no color ("") -> assume it default to black
  if (!color) {
    return true;
  }

  if (isTransparent(color)) {
    return false;
  }

  const parsed = colord(color);
  if (!parsed.isValid()) {
    // invalid color -> assume it defaults to black
    return true;
  }

  const { r, g, b } = parsed.toRgb();
  return calculateContrast(r, g, b) < threshold;
};

// -----------------------------------------------------------------------------
// normalization
// -----------------------------------------------------------------------------

/**
 * tries to keep the input color as-is if it's valid, making minimal adjustments
 * (trimming whitespace or adding `#` to hex colors)
 */
export const normalizeInputColor = (color: string): string | null => {
  color = color.trim();
  if (colord(color).isValid()) {
    return color;
  }

  // a hex code typed without the leading `#`: CSS requires it, so the canvas
  // wouldn't render the color as typed
  const hex = `#${color}`;
  return colord(hex).isValid() ? hex : null;
};
