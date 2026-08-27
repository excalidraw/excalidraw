import { describe, expect, it } from "vitest";

import {
  rewriteTextForExcalifont,
  rewriteTextForFontFamily,
  unicodeRangesToRegex,
  EXCALIFONT_UNICODE_RANGES,
} from "../src/font-glyphs";

const EXCALIFONT = 5;
const NUNITO = 6;
const HELVETICA = 2;

describe("font-glyphs", () => {
  describe("unicodeRangesToRegex()", () => {
    it("matches codepoints inside declared ranges", () => {
      const re = unicodeRangesToRegex(["U+41-5A", "U+304"]);
      expect(re.test("A")).toBe(true);
      expect(re.test("Z")).toBe(true);
      expect(re.test("\u0304")).toBe(true);
      expect(re.test("a")).toBe(false);
      expect(re.test("Ȳ")).toBe(false);
    });
  });

  describe("rewriteTextForExcalifont()", () => {
    it("decomposes Ȳ/ȳ into Y/y + combining macron (fixes #9509)", () => {
      expect(rewriteTextForExcalifont("Ȳ")).toBe("Y\u0304");
      expect(rewriteTextForExcalifont("ȳ")).toBe("y\u0304");
      expect(rewriteTextForExcalifont("Ȳ ȳ")).toBe("Y\u0304 y\u0304");
    });

    it("leaves ASCII and covered precomposed glyphs unchanged", () => {
      expect(rewriteTextForExcalifont("Hello")).toBe("Hello");
      // ā (U+0101) is in Excalifont's Latin Extended-A range
      expect(rewriteTextForExcalifont("ā")).toBe("ā");
    });

    it("decomposes other missing precomposed Latin letters when marks exist", () => {
      // Ǎ (U+01CD) is outside Excalifont ranges; NFD is A + caron (U+030C)
      expect(rewriteTextForExcalifont("Ǎ")).toBe("A\u030C");
    });

    it("does not rewrite when NFD components are also uncovered", () => {
      // emoji has no useful NFD form for Excalifont
      expect(rewriteTextForExcalifont("😀")).toBe("😀");
    });
  });

  describe("rewriteTextForFontFamily()", () => {
    it("only rewrites for Excalifont", () => {
      expect(rewriteTextForFontFamily("Ȳ", EXCALIFONT)).toBe("Y\u0304");
      expect(rewriteTextForFontFamily("Ȳ", NUNITO)).toBe("Ȳ");
      expect(rewriteTextForFontFamily("Ȳ", HELVETICA)).toBe("Ȳ");
    });
  });

  describe("EXCALIFONT_UNICODE_RANGES", () => {
    it("covers combining macron and basic Y used by the Ȳ fallback", () => {
      const re = unicodeRangesToRegex(EXCALIFONT_UNICODE_RANGES);
      expect(re.test("Y")).toBe(true);
      expect(re.test("y")).toBe(true);
      expect(re.test("\u0304")).toBe(true);
      expect(re.test("Ȳ")).toBe(false);
      expect(re.test("ȳ")).toBe(false);
    });
  });
});
