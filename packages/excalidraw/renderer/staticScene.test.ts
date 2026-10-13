import { applyDarkModeFilter, COLOR_WHITE, THEME } from "@excalidraw/common";

import { getLinkIconBackgroundColor } from "./staticScene";

describe("getLinkIconBackgroundColor", () => {
  it("uses the canvas background color in light theme", () => {
    expect(
      getLinkIconBackgroundColor({
        viewBackgroundColor: "#ffffff",
        theme: THEME.LIGHT,
      }),
    ).toBe("#ffffff");
  });

  it("applies the dark mode filter in dark theme", () => {
    const color = getLinkIconBackgroundColor({
      viewBackgroundColor: "#ffffff",
      theme: THEME.DARK,
    });
    expect(color).toBe(applyDarkModeFilter("#ffffff"));
    // must not stay white, otherwise the chip shows as a white box (#11844)
    expect(color.toLowerCase()).not.toBe("#ffffff");
  });

  it("matches a custom canvas background in dark theme", () => {
    expect(
      getLinkIconBackgroundColor({
        viewBackgroundColor: "#fff9db",
        theme: THEME.DARK,
      }),
    ).toBe(applyDarkModeFilter("#fff9db"));
  });

  it("falls back to white when there is no background color", () => {
    expect(
      getLinkIconBackgroundColor({
        viewBackgroundColor: null,
        theme: THEME.LIGHT,
      }),
    ).toBe(COLOR_WHITE);
  });
});
