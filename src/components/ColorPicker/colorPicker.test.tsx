import { ColorPaletteCustom } from "../../colors";
import {
  getColorNameAndShadeFromColor,
  colorPickerHotkeyBindings,
} from "./colorPickerUtils";
import { render, screen } from "@testing-library/react";

test("getColorNameAndShadeFromColor returns null when no matching color is found", () => {
  const palette: ColorPaletteCustom = {
    green: "#00FF00",
    orange: "#E07C24",
  };
  const color = "#FF6666";

  const result = getColorNameAndShadeFromColor({ palette, color });

  expect(result).toBeNull();
});

describe('colorPickerHotkeyBindings', () => {
  test('renders all hotkey bindings', () => {
    render(
      <div>
        <h1>{colorPickerHotkeyBindings.join(',')}</h1>
      </div>
    );

    colorPickerHotkeyBindings.forEach((hotkey) => {
      const hotkeyElement = screen.getByText(hotkey);
      expect(hotkeyElement).toBeInTheDocument();
    });
  });
});

