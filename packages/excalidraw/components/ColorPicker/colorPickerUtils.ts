import type { ExcalidrawElement } from "../../element/types";
import { atom } from "jotai";
import type { ColorPickerColor, ColorPaletteCustom } from "../../colors";
import { MAX_CUSTOM_COLORS_USED_IN_CANVAS } from "../../colors";

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

  // TODO: ? is this wanted?
  if (bgHex === "transparent") {
    return "black";
  }

  const r = parseInt(bgHex.substring(1, 3), 16);
  const g = parseInt(bgHex.substring(3, 5), 16);
  const b = parseInt(bgHex.substring(5, 7), 16);

  return calculateContrast(r, g, b);
};

export type ColorPickerType =
  | "canvasBackground"
  | "elementBackground"
  | "elementStroke";
