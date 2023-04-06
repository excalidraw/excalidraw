import oc from "open-color";
import { Merge } from "./utility-types";

export type Color = keyof oc | "transparent";
export type ColorTuple = [string, string, string, string, string];
export type ColorPalette = Merge<
  Record<Color | "slate", ColorTuple>,
  { black: string; white: string; transparent: string }
>;
// used general type instead of specific type (ColorPalette) to support custom colors
export type ColorPaletteCustom = { [key: string]: ColorTuple | string };
export type ColorShadesIndexes = [number, number, number, number, number];

export const MAX_CUSTOM_COLORS_USED_IN_CANVAS = 5;
export const COLORS_PER_ROW = 5;

export const DEFAULT_CHART_COLOR_INDEX = 4;

export const DEFAULT_ELEMENT_STROKE_COLOR_INDEX = 4;
export const DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX = 2;
export const DEFAULT_CANVAS_BACKGROUND_INDEX = 0;
export const DEFAULT_PALETTE_SHADE_INDEXES = [1, 3, 5, 7, 8] as [
  number,
  number,
  number,
  number,
  number,
];

export const getSpecificColorShades = (
  color: Exclude<Color, "transparent" | "white" | "black">,
  indexArr: ColorShadesIndexes,
) => {
  return indexArr.map((index) => oc[color][index]) as ColorTuple;
};

// ORDER matters for positioning in palette (5x3 grid)
// ready for custom pallets from hosts apps
// just expose the scheme and let them fill it with colors
// we calculate the shades for them
// display the colors in the order they are in the scheme etc.
export const COLOR_PALETTE = {
  transparent: "transparent",
  black: oc.black,
  white: oc.white,
  // avail colors scheme (open colors)
  red: getSpecificColorShades("red", DEFAULT_PALETTE_SHADE_INDEXES),
  pink: getSpecificColorShades("pink", DEFAULT_PALETTE_SHADE_INDEXES),
  grape: getSpecificColorShades("grape", DEFAULT_PALETTE_SHADE_INDEXES),
  violet: getSpecificColorShades("violet", DEFAULT_PALETTE_SHADE_INDEXES),
  indigo: getSpecificColorShades("indigo", DEFAULT_PALETTE_SHADE_INDEXES),
  gray: getSpecificColorShades("gray", DEFAULT_PALETTE_SHADE_INDEXES),
  blue: getSpecificColorShades("blue", DEFAULT_PALETTE_SHADE_INDEXES),
  cyan: getSpecificColorShades("cyan", DEFAULT_PALETTE_SHADE_INDEXES),
  teal: getSpecificColorShades("teal", DEFAULT_PALETTE_SHADE_INDEXES),
  green: getSpecificColorShades("green", DEFAULT_PALETTE_SHADE_INDEXES),
  lime: getSpecificColorShades("lime", DEFAULT_PALETTE_SHADE_INDEXES),
  yellow: getSpecificColorShades("yellow", DEFAULT_PALETTE_SHADE_INDEXES),
  orange: getSpecificColorShades("orange", DEFAULT_PALETTE_SHADE_INDEXES),

  // radix colors 3,5,7,9,11
  slate: ["#f1f3f5", "#e6e8eb", "#d7dbdf", "#889096", "#687076"],
} as ColorPalette;

const getCommonColorsForPalette = () => ({
  // 2nd row
  cyan: COLOR_PALETTE.cyan,
  blue: COLOR_PALETTE.blue,
  violet: COLOR_PALETTE.violet,
  grape: COLOR_PALETTE.grape,
  pink: COLOR_PALETTE.pink,

  // 3rd row
  green: COLOR_PALETTE.green,
  teal: COLOR_PALETTE.teal,
  yellow: COLOR_PALETTE.yellow,
  orange: COLOR_PALETTE.orange,
  red: COLOR_PALETTE.red,
});

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

// ORDER matters for positioning in quick picker
export const DEFAULT_CANVAS_BACKGROUND_PICKS = [
  COLOR_PALETTE.white,
  COLOR_PALETTE.gray[DEFAULT_CANVAS_BACKGROUND_INDEX],
  COLOR_PALETTE.gray[1],
  COLOR_PALETTE.blue[DEFAULT_CANVAS_BACKGROUND_INDEX],
  COLOR_PALETTE.yellow[DEFAULT_CANVAS_BACKGROUND_INDEX],
] as ColorTuple;

export const DEFAULT_ELEMENT_STROKE_COLOR_PALETTE = {
  // 1st row
  transparent: COLOR_PALETTE.transparent,
  white: COLOR_PALETTE.white,
  slate: COLOR_PALETTE.slate,
  gray: COLOR_PALETTE.gray,
  black: COLOR_PALETTE.black,
  // rest
  ...getCommonColorsForPalette(),
};

// ORDER matters for positioning in pallete (5x3 grid)s
export const DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE = {
  transparent: COLOR_PALETTE.transparent,
  white: COLOR_PALETTE.white,
  slate: COLOR_PALETTE.slate,
  gray: COLOR_PALETTE.gray,
  black: COLOR_PALETTE.black,

  ...getCommonColorsForPalette(),
};

export const DEFAULT_CANVAS_BACKGROUND_COLOR_PALETTE = {
  // 1st row
  white: COLOR_PALETTE.white,
  gray0: COLOR_PALETTE.gray[DEFAULT_CANVAS_BACKGROUND_INDEX],
  gray1: COLOR_PALETTE.gray[1],
  gray2: COLOR_PALETTE.gray[2],
  gray3: COLOR_PALETTE.gray[3],
  // rest
  ...getCommonColorsForPalette(),
};
