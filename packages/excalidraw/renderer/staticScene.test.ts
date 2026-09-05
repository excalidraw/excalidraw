import { applyDarkModeFilter, THEME } from "@excalidraw/common";

import { getLinkIconBackgroundColor } from "./staticScene";

describe("getLinkIconBackgroundColor", () => {
  it("returns the background color unchanged in light theme", () => {
    expect(getLinkIconBackgroundColor("#ffffff", THEME.LIGHT)).toBe("#ffffff");
  });

  it("applies the dark mode filter in dark theme", () => {
    const result = getLinkIconBackgroundColor("#ffffff", THEME.DARK);
    expect(result).toBe(applyDarkModeFilter("#ffffff"));
    expect(result).not.toBe("#ffffff");
  });

  it("returns null for a transparent background", () => {
    expect(getLinkIconBackgroundColor("transparent", THEME.LIGHT)).toBeNull();
    expect(getLinkIconBackgroundColor("transparent", THEME.DARK)).toBeNull();
  });

  it("returns null when no background color is set", () => {
    expect(getLinkIconBackgroundColor(null, THEME.LIGHT)).toBeNull();
    expect(getLinkIconBackgroundColor(null, THEME.DARK)).toBeNull();
  });
});
