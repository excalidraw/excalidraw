import { ColorPaletteCustom } from "../../colors";
import {
  getColorNameAndShadeFromColor,
  colorPickerHotkeyBindings,
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
