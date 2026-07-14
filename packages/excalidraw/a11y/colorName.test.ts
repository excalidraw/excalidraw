import { COLOR_PALETTE } from "@excalidraw/common";

import { getColorName, getConceptualColor } from "./colorName";

describe("a11y conceptual color names", () => {
  it("maps every palette shade to its color family", () => {
    expect(getConceptualColor(COLOR_PALETTE.red[4])?.family).toBe("red");
    expect(getConceptualColor(COLOR_PALETTE.red[0])?.family).toBe("red");
    expect(getConceptualColor(COLOR_PALETTE.blue[2])?.family).toBe("blue");
    expect(getConceptualColor(COLOR_PALETTE.black)?.family).toBe("black");
    expect(getConceptualColor(COLOR_PALETTE.white)?.family).toBe("white");
  });

  it("uses conceptual names for designer palette names", () => {
    expect(getConceptualColor(COLOR_PALETTE.grape[3])?.family).toBe("purple");
    expect(getConceptualColor(COLOR_PALETTE.bronze[3])?.family).toBe("brown");
  });

  it("marks pale palette shades as light", () => {
    expect(getColorName(COLOR_PALETTE.red[1])).toBe("light red");
    expect(getColorName(COLOR_PALETTE.red[4])).toBe("red");
  });

  it("is case-insensitive for palette matches", () => {
    expect(getConceptualColor("#E03131")?.family).toBe("red");
  });

  it("buckets arbitrary custom colors by hue", () => {
    expect(getConceptualColor("#ff0000")?.family).toBe("red");
    expect(getConceptualColor("#00ff00")?.family).toBe("green");
    expect(getConceptualColor("#0044ff")?.family).toBe("blue");
    expect(getConceptualColor("#ff9900")?.family).toBe("orange");
    expect(getConceptualColor("#8b4513")?.family).toBe("brown");
    expect(getConceptualColor("#777777")?.family).toBe("gray");
    expect(getConceptualColor("#0b0b0b")?.family).toBe("black");
    expect(getConceptualColor("#fdfdfd")?.family).toBe("white");
  });

  it("marks very light and very dark custom colors", () => {
    expect(getColorName("#ffd6d6")).toBe("light red");
    expect(getColorName("#5c0000")).toBe("dark red");
  });

  it("returns null for transparent and invalid colors", () => {
    expect(getColorName("transparent")).toBeNull();
    expect(getColorName("#ff000000")).toBeNull();
    expect(getColorName("not-a-color")).toBeNull();
    expect(getColorName("")).toBeNull();
  });
});
