import { normalizeInputColor } from "@excalidraw/common";

describe("normalizeInputColor", () => {
  describe("hex colors", () => {
    it("returns hex color with hash as-is", () => {
      expect(normalizeInputColor("#ff0000")).toBe("#ff0000");
      expect(normalizeInputColor("#FF0000")).toBe("#FF0000");
      expect(normalizeInputColor("#abc")).toBe("#abc");
      expect(normalizeInputColor("#ABC")).toBe("#ABC");
    });

    it("adds hash to hex color without hash", () => {
      expect(normalizeInputColor("ff0000")).toBe("#ff0000");
      expect(normalizeInputColor("FF0000")).toBe("#FF0000");
      expect(normalizeInputColor("abc")).toBe("#abc");
      expect(normalizeInputColor("ABC")).toBe("#ABC");
    });

    it("handles 8-digit hex (hexa) with alpha", () => {
      expect(normalizeInputColor("#ff000080")).toBe("#ff000080");
      expect(normalizeInputColor("#ff0000ff")).toBe("#ff0000ff");
    });

    it("does NOT add hash to hexa without hash (tinycolor detects as hex8, not hex)", () => {
      // Note: tinycolor detects 8-digit hex as "hex8" format, not "hex",
      // so the hash prefix logic doesn't apply
      expect(normalizeInputColor("ff000080")).toBe("ff000080");
    });
  });

  describe("named colors", () => {
    it("returns named colors as-is", () => {
      expect(normalizeInputColor("red")).toBe("red");
      expect(normalizeInputColor("blue")).toBe("blue");
      expect(normalizeInputColor("green")).toBe("green");
      expect(normalizeInputColor("white")).toBe("white");
      expect(normalizeInputColor("black")).toBe("black");
      expect(normalizeInputColor("transparent")).toBe("transparent");
    });

    it("handles case variations of named colors", () => {
      expect(normalizeInputColor("RED")).toBe("RED");
      expect(normalizeInputColor("Red")).toBe("Red");
    });
  });

  describe("rgb/rgba colors", () => {
    it("returns rgb colors as-is", () => {
      expect(normalizeInputColor("rgb(255, 0, 0)")).toBe("rgb(255, 0, 0)");
      expect(normalizeInputColor("rgb(0,0,0)")).toBe("rgb(0,0,0)");
    });

    // NOTE: tinycolor clamps values, so rgb(256, 0, 0) is treated as valid
    it("tinycolor considers out-of-range rgb values as valid (clamped)", () => {
      expect(normalizeInputColor("rgb(256, 0, 0)")).toBe("rgb(256, 0, 0)");
    });

    it("returns rgba colors as-is", () => {
      expect(normalizeInputColor("rgba(255, 0, 0, 0.5)")).toBe(
        "rgba(255, 0, 0, 0.5)",
      );
      expect(normalizeInputColor("rgba(0,0,0,1)")).toBe("rgba(0,0,0,1)");
    });
  });

  describe("hsl/hsla colors", () => {
    it("returns hsl colors as-is", () => {
      expect(normalizeInputColor("hsl(0, 100%, 50%)")).toBe(
        "hsl(0, 100%, 50%)",
      );
    });

    it("returns hsla colors as-is", () => {
      expect(normalizeInputColor("hsla(0, 100%, 50%, 0.5)")).toBe(
        "hsla(0, 100%, 50%, 0.5)",
      );
    });
  });

  describe("whitespace handling", () => {
    it("trims leading whitespace", () => {
      expect(normalizeInputColor("  #ff0000")).toBe("#ff0000");
      expect(normalizeInputColor("  red")).toBe("red");
    });

    it("trims trailing whitespace", () => {
      expect(normalizeInputColor("#ff0000  ")).toBe("#ff0000");
      expect(normalizeInputColor("red  ")).toBe("red");
    });

    it("trims both leading and trailing whitespace", () => {
      expect(normalizeInputColor("  #ff0000  ")).toBe("#ff0000");
      expect(normalizeInputColor("  red  ")).toBe("red");
    });

    it("adds hash to trimmed hex without hash", () => {
      expect(normalizeInputColor("  ff0000  ")).toBe("#ff0000");
    });
  });

  describe("invalid colors", () => {
    it("returns null for invalid color strings", () => {
      expect(normalizeInputColor("notacolor")).toBe(null);
      expect(normalizeInputColor("gggggg")).toBe(null);
      expect(normalizeInputColor("#gggggg")).toBe(null);
      expect(normalizeInputColor("")).toBe(null);
      expect(normalizeInputColor("   ")).toBe(null);
    });

    it("returns null for partial/malformed colors", () => {
      expect(normalizeInputColor("#ff")).toBe(null);
      expect(normalizeInputColor("rgb(")).toBe(null);
    });
  });
});
