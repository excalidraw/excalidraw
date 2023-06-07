import { ColorPaletteCustom } from "../../colors";
import { ExcalidrawElement } from "../../element/types";
import {
  getColorNameAndShadeFromColor,
  colorPickerHotkeyBindings,
  isCustomColor,
  getMostUsedCustomColors,
} from "./colorPickerUtils";

describe("getColorNameAndShadeFromColor", () => {
  it("returns null when no matching color is found", () => {
    const palette: ColorPaletteCustom = {
      green: "#00FF00",
      orange: "#E07C24",
    };
    const color = "#FF6666";

    const result = getColorNameAndShadeFromColor({ palette, color });

    expect(result).toBeNull();
  });
});

describe("colorPickerHotkeyBindings", () => {
  it("should contain all the expected hotkey bindings", () => {
    const testBindingKeys = [
      ["q", "w", "e", "r", "t"],
      ["a", "s", "d", "f", "g"],
      ["z", "x", "c", "v", "b"],
    ].flat();

    expect(testBindingKeys).toEqual(colorPickerHotkeyBindings);
  });
});

describe("isCustomColor", () => {
  it("should return true for a custom color not present in the palette", () => {
    const palette = {
      green: "#00FF00",
      orange: "#E07C24",
    };
    const color = "#FF6666";

    const result = isCustomColor({ color, palette });

    expect(result).toBe(true);
  });

  it("should return false for a color present in the palette", () => {
    const palette = {
      green: "#00FF00",
      orange: "#E07C24",
    };
    const color = "#00FF00";

    const result = isCustomColor({ color, palette });

    expect(result).toBe(false);
  });

  it("should handle empty palette correctly", () => {
    const palette = {};
    const color = "#FF6666";

    const result = isCustomColor({ color, palette });

    expect(result).toBe(true);
  });
});

describe("getMostUsedCustomColors", () => {
  const elements = [
    {
      type: "rectangle",
      id: "1",
      isDeleted: false,
      backgroundColor: "#FF0000",
      strokeColor: "#00FF00",
    },
    {
      type: "ellipse",
      id: "2",
      isDeleted: false,
      backgroundColor: "#FF0000",
      strokeColor: "#0000FF",
    },
    {
      type: "rectangle",
      id: "3",
      isDeleted: false,
      backgroundColor: "#00FF00",
      strokeColor: "#00FF00",
    },
    {
      type: "rectangle",
      id: "4",
      isDeleted: true,
      backgroundColor: "#FFFF00",
      strokeColor: "#FF00FF",
    },
  ];

  const palette = {
    red: "#FF0000",
    green: "#00FF00",
    blue: "#0000FF",
  };

  it("should return the most used custom colors for element background", () => {
    const type = "elementBackground";

    // @ts-ignore
    const result = getMostUsedCustomColors(elements, type, palette);

    expect(result).toEqual(["#FF0000"]);
  });

  it("should return the most used custom colors for element stroke", () => {
    const type = "elementStroke";

    // @ts-ignore
    const result = getMostUsedCustomColors(elements, type, palette);

    expect(result).toEqual(["#00FF00"]);
  });

  it("should handle empty elements correctly", () => {
    const type = "elementBackground";
    const emptyElements: readonly ExcalidrawElement[] = [];

    const result = getMostUsedCustomColors(emptyElements, type, palette);

    expect(result).toEqual([]);
  });

  it("should handle empty palette correctly", () => {
    const type = "elementBackground";
    const emptyPalette = {};
    // @ts-ignore
    const result = getMostUsedCustomColors(elements, type, emptyPalette);

    expect(result).toEqual([]);
  });
});
