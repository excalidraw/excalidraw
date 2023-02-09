import oc from "open-color";

export type PaletteKey = keyof oc | string;
export type PaletteValue = string | [string, string, string, string, string];
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

export const strokeTopPicks = [
  ocPalette.black as string,
  ocPalette.red[3],
  ocPalette.green[3],
  ocPalette.blue[3],
  ocPalette.orange[3],
];
export const bgTopPicks = [
  ocPalette.gray[1],
  ocPalette.red[1],
  ocPalette.green[1],
  ocPalette.blue[1],
  ocPalette.orange[1],
];

export const MAX_CUSTOM_COLORS = 5;
export const COLOR_PER_ROW = 5;
export const DEFAULT_SHADE_INDEX = 3;
