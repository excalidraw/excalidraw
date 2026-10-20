import { getFontString, FONT_FAMILY } from "@excalidraw/common";

import {
  charWidth,
  setCustomTextMetricsProvider,
} from "../src/textMeasurements";

import type { FontString } from "../src/types";

/**
 * A provider that gives every character its own width, so a wrong answer can
 * only come from the cache rather than from the font.
 */
const widthPerCodePoint = (text: string) => (text.codePointAt(0) ?? 0) % 1000;

describe("charWidth cache", () => {
  const font = getFontString({
    fontFamily: FONT_FAMILY.Excalifont,
    fontSize: 20,
  }) as FontString;

  beforeEach(() => {
    charWidth.clearCache(font);
    setCustomTextMetricsProvider({
      getLineWidth: (text: string) => widthPerCodePoint(text),
    });
  });

  it("measures characters outside the BMP independently", () => {
    // U+1F600 and U+1F601 are different characters with the same leading
    // UTF-16 code unit.
    expect(charWidth.calculate("😀", font)).toBe(widthPerCodePoint("😀"));
    expect(charWidth.calculate("😁", font)).toBe(widthPerCodePoint("😁"));
  });

  it("measures mathematical alphanumerics independently", () => {
    // Bold capital A and double-struck zero, both in U+1D400..U+1D7FF.
    expect(charWidth.calculate("𝐀", font)).toBe(widthPerCodePoint("𝐀"));
    expect(charWidth.calculate("𝟘", font)).toBe(widthPerCodePoint("𝟘"));
  });

  it("keeps the whole astral plane distinct", () => {
    const samples = ["😀", "😁", "🙏", "🚀", "👍", "🧠", "🦀", "𝐀", "𝟘"];
    const wrong = samples.filter(
      (char) => charWidth.calculate(char, font) !== widthPerCodePoint(char),
    );
    expect(wrong).toEqual([]);
  });

  it("still measures characters inside the BMP", () => {
    for (const char of ["a", "é", "中"]) {
      expect(charWidth.calculate(char, font)).toBe(widthPerCodePoint(char));
    }
  });
});
