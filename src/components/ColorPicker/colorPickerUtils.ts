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
  ocPalette.gray[DEFAULT_SHADE_INDEXES.elementBackground],
  ocPalette.red[DEFAULT_SHADE_INDEXES.elementBackground],
  ocPalette.green[DEFAULT_SHADE_INDEXES.elementBackground],
  ocPalette.blue[DEFAULT_SHADE_INDEXES.elementBackground],
  ocPalette.orange[DEFAULT_SHADE_INDEXES.elementBackground],
] as ColorTuple;

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

export type activeColorPickerSectionAtomType =
  | "custom"
  | "default"
  | "shades"
  | "hex"
  | null;
export const activeColorPickerSectionAtom =
  atom<activeColorPickerSectionAtomType>(null);
