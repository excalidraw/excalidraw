import { applyDarkModeFilter, THEME } from "@excalidraw/common";

import { getLinkIconFillColor } from "../renderer/staticScene";

describe("getLinkIconFillColor (link icon dark mode background)", () => {
  it("keeps a white canvas background as white in light theme", () => {
    const color = getLinkIconFillColor({
      theme: THEME.LIGHT,
      viewBackgroundColor: "#ffffff",
    });
    expect(color.toLowerCase()).toBe("#ffffff");
  });

  it("does not paint a plain white chip when the scene background is white in dark theme", () => {
    const color = getLinkIconFillColor({
      theme: THEME.DARK,
      viewBackgroundColor: "#ffffff",
    });
    // This is exactly the "white chip in dark theme" bug: a light canvas
    // background must not still resolve to plain white once dark theme is
    // applied, the same way it would look wrong for the scene background.
    expect(color.toLowerCase()).not.toBe("#ffffff");
  });

  it("matches applyDarkModeFilter's own output for the same inputs", () => {
    // Cross-check against the same helper bootstrapCanvas uses for the
    // scene background (renderer/helpers.ts), since the two are meant to
    // land on the same color for a given theme + background.
    const bg = "#ffffff";
    expect(
      getLinkIconFillColor({ theme: THEME.DARK, viewBackgroundColor: bg }),
    ).toBe(applyDarkModeFilter(bg, true));
    expect(
      getLinkIconFillColor({ theme: THEME.LIGHT, viewBackgroundColor: bg }),
    ).toBe(applyDarkModeFilter(bg, false));
  });

  it("falls back to white when viewBackgroundColor is empty/transparent-less", () => {
    const color = getLinkIconFillColor({
      theme: THEME.LIGHT,
      viewBackgroundColor: "",
    });
    expect(color.toLowerCase()).toBe("#ffffff");
  });
});
