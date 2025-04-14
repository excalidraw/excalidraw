import { MAX_CUSTOM_COLORS_USED_IN_CANVAS } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { ColorPickerColor, ColorPaletteCustom } from "@excalidraw/common";

import { atom } from "../../editor-jotai";

export const getColorNameAndShadeFromColor = ({
  palette,
  color,
}: {
  palette: ColorPaletteCustom;
  color: string;
}): {
  colorName: ColorPickerColor;
  shade: number | null;
} | null => {
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

  if (color === "transparent") {
    return false;
  }

  // a string color (white etc) or any other format -> convert to rgb by way
  // of creating a DOM node and retrieving the computeStyle
  if (!color.startsWith("#")) {
    const node = document.createElement("div");
    node.style.color = color;

    if (node.style.color) {
      // making invisible so document doesn't reflow (hopefully).
      // display=none works too, but supposedly not in all browsers
      node.style.position = "absolute";
      node.style.visibility = "hidden";
      node.style.width = "0";
      node.style.height = "0";

      // needs to be in DOM else browser won't compute the style
      document.body.appendChild(node);
      const computedColor = getComputedStyle(node).color;
      document.body.removeChild(node);
      // computed style is in rgb() format
      const rgb = computedColor
        .replace(/^(rgb|rgba)\(/, "")
        .replace(/\)$/, "")
        .replace(/\s/g, "")
        .split(",");
      const r = parseInt(rgb[0]);
      const g = parseInt(rgb[1]);
      const b = parseInt(rgb[2]);

      return calculateContrast(r, g, b) < threshold;
    }
    // invalid color -> assume it default to black
    return true;
  }

  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  return calculateContrast(r, g, b) < threshold;
};

export type ColorPickerType =
  | "canvasBackground"
  | "elementBackground"
  | "elementStroke";
