import oc from "open-color";
import { ExcalidrawElement } from "../../element/types";
import { atom } from "jotai";
import { ColorPickerProps } from "./ColorPicker";

export type PaletteKey = keyof oc | string;
export type ColorTuple = [string, string, string, string, string];
export type PaletteValue = string | ColorTuple;
export type Palette = Record<PaletteKey, PaletteValue>;

export const getColorNameAndShadeFromHex = ({
  palette,
  hex,
}: {
  palette: Palette;
  hex: string;
}) => {
  for (const [colorName, colorVal] of Object.entries(palette)) {
    if (Array.isArray(colorVal)) {
      const shade = colorVal.indexOf(hex);
      if (shade > -1) {
        return { colorName, shade };
      }
    } else if (colorVal === hex) {
      return { colorName, shade: -1 };
    }
  }
  return null;
};

export const colorPickerHotkeyBindings = [
  ["q", "w", "e", "r", "t"],
  ["a", "s", "d", "f", "g"],
  ["z", "x", "c", "v", "b"],
].flat();

export const ocPalette: Palette = {};
for (const [key, value] of Object.entries({
  transparent: "transparent",
  ...oc,
})) {
  if (key === "grape") {
    continue;
  }
  if (Array.isArray(value)) {
    // @ts-ignore
    ocPalette[key] = value.filter((_, i) => i % 2 === 0);
  } else {
    ocPalette[key] = value;
  }
}

export const DEFAULT_SHADE_INDEXES: Record<ColorPickerProps["type"], number> = {
  elementStroke: 3,
  elementBackground: 1,
  canvasBackground: 1,
};

export const strokeTopPicks = [
  ocPalette.black as string,
  ocPalette.red[DEFAULT_SHADE_INDEXES.elementStroke],
  ocPalette.green[DEFAULT_SHADE_INDEXES.elementStroke],
  ocPalette.blue[DEFAULT_SHADE_INDEXES.elementStroke],
  ocPalette.orange[DEFAULT_SHADE_INDEXES.elementStroke],
] as ColorTuple;
export const bgTopPicks = [
  "transparent",
  ocPalette.red[DEFAULT_SHADE_INDEXES.elementBackground],
  ocPalette.green[DEFAULT_SHADE_INDEXES.elementBackground],
  ocPalette.blue[DEFAULT_SHADE_INDEXES.elementBackground],
  ocPalette.orange[DEFAULT_SHADE_INDEXES.elementBackground],
] as ColorTuple;
export const canvasTopPicks = [
  "white",
  ocPalette.gray[0],
  "gray",
  ocPalette.blue[0],
  ocPalette.yellow[0],
];

export const MAX_CUSTOM_COLORS = 5;
export const COLOR_PER_ROW = 5;

export const isCustomColor = ({
  color,
  palette,
}: {
  color: string | null;
  palette: Palette;
}) => {
  if (!color) {
    return false;
  }
  const paletteValues = Object.values(palette).flat();
  return !paletteValues.includes(color);
};

export const getMostUsedCustomColors = (
  elements: readonly ExcalidrawElement[],
  type: "elementBackground" | "elementStroke",
  palette: Palette,
) => {
  const elementColorTypeMap = {
    elementBackground: "backgroundColor",
    elementStroke: "strokeColor",
  };

  const colors = elements.filter((element) => {
    if (element.isDeleted) {
      return false;
    }

    const color =
      element[elementColorTypeMap[type] as "backgroundColor" | "strokeColor"];

    return isCustomColor({ color, palette });
  });

  const colorCountMap = new Map<string, number>();
  colors.forEach((element) => {
    const color =
      element[elementColorTypeMap[type] as "backgroundColor" | "strokeColor"];
    if (colorCountMap.has(color)) {
      colorCountMap.set(color, colorCountMap.get(color)! + 1);
    } else {
      colorCountMap.set(color, 1);
    }
  });

  return [...colorCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map((c) => c[0])
    .slice(0, MAX_CUSTOM_COLORS);
};

export type ActiveColorPickerSectionAtomType =
  | "custom"
  | "baseColors"
  | "shades"
  | "hex"
  | null;
export const activeColorPickerSectionAtom =
  atom<ActiveColorPickerSectionAtomType>(null);

const calculateContrast = (r: number, g: number, b: number) => {
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? "black" : "white";
};

// inspiration from https://stackoverflow.com/a/11868398
export const getContrastYIQ = (bgHex: string, isCustomColor: boolean) => {
  if (isCustomColor) {
    const style = new Option().style;
    style.color = bgHex;

    if (style.color) {
      const rgb = style.color
        .replace(/^(rgb|rgba)\(/, "")
        .replace(/\)$/, "")
        .replace(/\s/g, "")
        .split(",");
      const r = parseInt(rgb[0]);
      const g = parseInt(rgb[1]);
      const b = parseInt(rgb[2]);

      return calculateContrast(r, g, b);
    }
  }

  if (bgHex === "transparent") {
    return "black";
  }

  const r = parseInt(bgHex.substring(1, 3), 16);
  const g = parseInt(bgHex.substring(3, 5), 16);
  const b = parseInt(bgHex.substring(5, 7), 16);

  return calculateContrast(r, g, b);
};
