import { normalizeText } from "@excalidraw/element";

describe("subscript/superscript normalization", () => {
  it("converts superscripts", () => expect(normalizeText("x^{2}")).toBe("x²"));
  it("converts subscripts", () => expect(normalizeText("H_{2}O")).toBe("H₂O"));
  it("handles both in one string", () =>
    expect(normalizeText("a^{n+1} b_{i}")).toBe("aⁿ⁺¹ bᵢ"));
  it("leaves unmappable bodies alone", () =>
    expect(normalizeText("x^{q}")).toBe("x^{q}"));
  it("leaves empty bodies alone", () =>
    expect(normalizeText("x^{}")).toBe("x^{}"));
  it("needs a base char", () => expect(normalizeText("^{2}")).toBe("^{2}"));
});

describe("EOL text normalization", () => {
  it("replaces tabs with 8 spaces", () =>
    expect(normalizeText("a\tb")).toBe("a        b"));
  it("normalizes CRLF", () =>
    expect(normalizeText("a\r\nb")).toBe("a\nb"));
});