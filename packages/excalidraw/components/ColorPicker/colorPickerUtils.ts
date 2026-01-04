import {
  isTransparent,
  MAX_CUSTOM_COLORS_USED_IN_CANVAS,
  tinycolor,
} from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { ColorPickerColor, ColorPaletteCustom } from "@excalidraw/common";

import { atom } from "../../editor-jotai";

export const getColorNameAndShadeFromColor = ({
  palette,
  color,
}: {
  palette: ColorPaletteCustom;
  color: string | null;
}): {
  colorName: ColorPickerColor;
  shade: number | null;
} | null => {
  if (!color) {
    return null;
  }
  for (const [colorName, colorVal] of Object.entries(palette)) {
    if (Array.isArray(colorVal)) {
      const shade = colorVal.indexOf(color);
      if (shade > -1) {
        return { colorName: colorName as ColorPickerColor, shade };
      }
    } else if (colorVal === color) {
      return { colorName: colorName as ColorPickerColor, shade: null };
    }
  }
  return null;
};

export const colorPickerHotkeyBindings = [
  ["q", "w", "e", "r", "t"],
  ["a", "s", "d", "f", "g"],
  ["z", "x", "c", "v", "b"],
].flat();

export const isCustomColor = ({
  color,
  palette,
}: {
  color: string;
  palette: ColorPaletteCustom;
}) => {
  const paletteValues = Object.values(palette).flat();
  return !paletteValues.includes(color);
};

export const getMostUsedCustomColors = (
  elements: readonly ExcalidrawElement[],
  type: "elementBackground" | "elementStroke",
  palette: ColorPaletteCustom,
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
    .slice(0, MAX_CUSTOM_COLORS_USED_IN_CANVAS);
};

export type ActiveColorPickerSectionAtomType =
  | "custom"
  | "baseColors"
  | "shades"
  | "hex"
  | null;
export const activeColorPickerSectionAtom =
  atom<ActiveColorPickerSectionAtomType>(null);

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

  const tc = tinycolor(color);
  if (!tc.isValid()) {
    // invalid color -> assume it defaults to black
    return true;
  }

  const { r, g, b } = tc.toRgb();
  return calculateContrast(r, g, b) < threshold;
};

export type ColorPickerType =
  | "canvasBackground"
  | "elementBackground"
  | "elementStroke";
