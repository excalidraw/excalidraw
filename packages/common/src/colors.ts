import oc from "open-color";
import type { Merge } from "./utility-types";

export const COLOR_OUTLINE_CONTRAST_THRESHOLD = 240;

// -----------------------------------------------------------------------------
// Utility
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type ColorPickerColor =
  | Exclude<keyof oc, "indigo" | "lime">
  | "transparent"
  | "bronze";

export type ColorTuple = readonly [string, string, string, string, string];

export type ColorPalette = Merge<
  Record<ColorPickerColor, ColorTuple>,
  { black: "#1e1e1e"; white: "#ffffff"; transparent: "transparent" }
>;

// used general type instead of specific type (ColorPalette) to support custom colors
export type ColorPaletteCustom = { [key: string]: ColorTuple | string };
export type ColorShadesIndexes = [number, number, number, number, number];

export const MAX_CUSTOM_COLORS_USED_IN_CANVAS = 5;
export const COLORS_PER_ROW = 5;
export const DEFAULT_CHART_COLOR_INDEX = 4;
export const DEFAULT_ELEMENT_STROKE_COLOR_INDEX = 4;
export const DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX = 1;
export const ELEMENTS_PALETTE_SHADE_INDEXES = [0, 2, 4, 6, 8] as const;
export const CANVAS_PALETTE_SHADE_INDEXES = [0, 1, 2, 3, 4] as const;

// -----------------------------------------------------------------------------
// Color Palette
// -----------------------------------------------------------------------------
export const getSpecificColorShades = (
  color: Exclude<ColorPickerColor, "transparent" | "white" | "black" | "bronze">,
  indexArr: Readonly<ColorShadesIndexes>,
) => indexArr.map((index) => oc[color][index]) as any as ColorTuple;

export const COLOR_PALETTE = {
  transparent: "transparent",
  black: "#1e1e1e",
  white: "#ffffff",
  gray: getSpecificColorShades("gray", ELEMENTS_PALETTE_SHADE_INDEXES),
  red: getSpecificColorShades("red", ELEMENTS_PALETTE_SHADE_INDEXES),
  pink: getSpecificColorShades("pink", ELEMENTS_PALETTE_SHADE_INDEXES),
  grape: getSpecificColorShades("grape", ELEMENTS_PALETTE_SHADE_INDEXES),
  violet: getSpecificColorShades("violet", ELEMENTS_PALETTE_SHADE_INDEXES),
  blue: getSpecificColorShades("blue", ELEMENTS_PALETTE_SHADE_INDEXES),
  cyan: getSpecificColorShades("cyan", ELEMENTS_PALETTE_SHADE_INDEXES),
  teal: getSpecificColorShades("teal", ELEMENTS_PALETTE_SHADE_INDEXES),
  green: getSpecificColorShades("green", ELEMENTS_PALETTE_SHADE_INDEXES),
  yellow: getSpecificColorShades("yellow", ELEMENTS_PALETTE_SHADE_INDEXES),
  orange: getSpecificColorShades("orange", ELEMENTS_PALETTE_SHADE_INDEXES),
  bronze: ["#f8f1ee", "#eaddd7", "#d2bab0", "#a18072", "#846358"],
} as ColorPalette;

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

// -----------------------------------------------------------------------------
// Quick Pick Defaults
// -----------------------------------------------------------------------------
export const DEFAULT_ELEMENT_STROKE_PICKS = [
  COLOR_PALETTE.black,
  COLOR_PALETTE.red[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
  COLOR_PALETTE.green[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
  COLOR_PALETTE.blue[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
  COLOR_PALETTE.yellow[DEFAULT_ELEMENT_STROKE_COLOR_INDEX],
] as ColorTuple;

export const DEFAULT_ELEMENT_BACKGROUND_PICKS = [
  COLOR_PALETTE.transparent,
  COLOR_PALETTE.red[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
  COLOR_PALETTE.green[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
  COLOR_PALETTE.blue[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
  COLOR_PALETTE.yellow[DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX],
] as ColorTuple;

export const DEFAULT_CANVAS_BACKGROUND_PICKS = [
  COLOR_PALETTE.white,
  "#f8f9fa",
  "#f5faff",
  "#fffce8",
  "#fdf8f6",
] as ColorTuple;

// -----------------------------------------------------------------------------
// Palettes
// -----------------------------------------------------------------------------
export const DEFAULT_ELEMENT_STROKE_COLOR_PALETTE = {
  transparent: COLOR_PALETTE.transparent,
  white: COLOR_PALETTE.white,
  gray: COLOR_PALETTE.gray,
  black: COLOR_PALETTE.black,
  bronze: COLOR_PALETTE.bronze,
  ...COMMON_ELEMENT_SHADES,
} as const;

export const DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE = {
  transparent: COLOR_PALETTE.transparent,
  white: COLOR_PALETTE.white,
  gray: COLOR_PALETTE.gray,
  black: COLOR_PALETTE.black,
  bronze: COLOR_PALETTE.bronze,
  ...COMMON_ELEMENT_SHADES,
} as const;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
export const getAllColorsSpecificShade = (index: 0 | 1 | 2 | 3 | 4) =>
  [
    COLOR_PALETTE.cyan[index],
    COLOR_PALETTE.blue[index],
    COLOR_PALETTE.violet[index],
    COLOR_PALETTE.grape[index],
    COLOR_PALETTE.pink[index],
    COLOR_PALETTE.green[index],
    COLOR_PALETTE.teal[index],
    COLOR_PALETTE.yellow[index],
    COLOR_PALETTE.orange[index],
    COLOR_PALETTE.red[index],
  ] as const;

export const rgbToHex = (r: number, g: number, b: number) =>
  `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;

/**
 * Inverts a hexadecimal color code (e.g., #333 becomes #ccc).
 * Used for showing inverted colors in dark mode color pickers.
 */
export function invertHexColor(hex: string): string {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  if (c.length !== 6) {
    console.error(`[invertHexColor] Invalid hex code: ${hex}`);
    return hex;
  }
  const r = (255 - parseInt(c.slice(0, 2), 16)).toString(16).padStart(2, "0");
  const g = (255 - parseInt(c.slice(2, 4), 16)).toString(16).padStart(2, "0");
  const b = (255 - parseInt(c.slice(4, 6), 16)).toString(16).padStart(2, "0");
  return "#" + r + g + b;
}
