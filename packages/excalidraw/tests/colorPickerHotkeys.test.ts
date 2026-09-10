import { COLOR_PALETTE } from "@excalidraw/common";

import type { ColorPaletteCustom } from "@excalidraw/common";

import { colorPickerKeyNavHandler } from "../components/ColorPicker/keyboardNavHandlers";

const handlerArgs = (
  key: string,
  palette: ColorPaletteCustom,
  onChange: (color: string) => void,
  excludedColors?: readonly string[],
) => ({
  event: {
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as React.KeyboardEvent,
  activeColorPickerSection: null,
  palette,
  color: null,
  onChange,
  customColors: [],
  setActiveColorPickerSection: () => {},
  updateData: () => {},
  activeShade: 1,
  onEyeDropperToggle: () => {},
  onEscape: () => {},
  excludedColors,
});

describe("color picker hotkeys", () => {
  it("reports an excluded (hidden) entry's hotkey as handled without selecting it", () => {
    // regression: returning "unhandled" let the key escape the modal and hit
    // global shortcuts (`q` toggles the tool lock; see the integration
    // regression in bucketFill.test.tsx)
    const onChange = vi.fn();
    const palette = {
      transparent: COLOR_PALETTE.transparent,
      red: "#ff0000",
    } as ColorPaletteCustom;

    const handled = colorPickerKeyNavHandler(
      handlerArgs("q", palette, onChange, [COLOR_PALETTE.transparent]),
    );

    expect(handled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports a hotkey past the end of a short custom palette as handled", () => {
    // a host-provided palette with fewer entries than hotkey bindings must
    // not leak the unbound keys either
    const onChange = vi.fn();
    const palette = { red: "#ff0000" } as ColorPaletteCustom;

    // `b` is the 15th binding — far past the single palette entry
    const handled = colorPickerKeyNavHandler(
      handlerArgs("b", palette, onChange),
    );

    expect(handled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("still selects a present, non-excluded entry", () => {
    const onChange = vi.fn();
    const palette = {
      transparent: COLOR_PALETTE.transparent,
      red: "#ff0000",
    } as ColorPaletteCustom;

    const handled = colorPickerKeyNavHandler(
      handlerArgs("w", palette, onChange, [COLOR_PALETTE.transparent]),
    );

    expect(handled).toBe(true);
    expect(onChange).toHaveBeenCalledWith("#ff0000");
  });

  it("steps over an excluded entry when navigating vertically", () => {
    // three rows of five; `transparent` sits in column 0 of row 1 and is
    // excluded, so vertical moves through that cell must skip it in the
    // arrow's direction (wrapping) instead of landing on the hidden swatch
    const palette = {
      transparent: COLOR_PALETTE.transparent,
      white: "#w0",
      gray: "#g0",
      black: "#k0",
      bronze: "#b0",
      red: "#r1",
      green: "#g1",
      blue: "#b1",
      yellow: "#y1",
      orange: "#o1",
      pink: "#r2",
      grape: "#g2",
      violet: "#b2",
      cyan: "#y2",
      teal: "#o2",
    } as unknown as ColorPaletteCustom;
    const excluded = [COLOR_PALETTE.transparent];

    // up from row 2 / column 0 wraps past the excluded cell to row 3
    let onChange = vi.fn();
    expect(
      colorPickerKeyNavHandler({
        ...handlerArgs("ArrowUp", palette, onChange, excluded),
        activeColorPickerSection: "baseColors",
        color: "#r1",
      }),
    ).toBe(true);
    expect(onChange).toHaveBeenCalledWith("#r2");

    // down from row 3 / column 0 wraps past the excluded cell to row 2
    onChange = vi.fn();
    expect(
      colorPickerKeyNavHandler({
        ...handlerArgs("ArrowDown", palette, onChange, excluded),
        activeColorPickerSection: "baseColors",
        color: "#r2",
      }),
    ).toBe(true);
    expect(onChange).toHaveBeenCalledWith("#r1");
  });
});
