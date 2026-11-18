import { isRTL } from "../src/utils";

describe("isRTL", () => {
  it("detects text starting with an RTL letter", () => {
    expect(isRTL("שלום")).toBe(true);
    expect(isRTL("مرحبا")).toBe(true);
    expect(isRTL("ܐܒ")).toBe(true);
  });

  it("detects LTR text", () => {
    expect(isRTL("hello")).toBe(false);
    expect(isRTL("Ünïcode")).toBe(false);
    expect(isRTL("日本語")).toBe(false);
    expect(isRTL("")).toBe(false);
  });

  it("skips leading characters that carry no direction", () => {
    expect(isRTL("123 שלום")).toBe(true);
    expect(isRTL("(שלום)")).toBe(true);
    expect(isRTL("★ שלום")).toBe(true);
    expect(isRTL("123 hello")).toBe(false);
  });

  it("treats a leading emoji as directionless", () => {
    // emoji are astral, and their high surrogate used to land inside the
    // LTR letter ranges, forcing the whole string to LTR
    expect(isRTL("😀 שלום")).toBe(true);
    expect(isRTL("🎉مرحبا")).toBe(true);
    expect(isRTL("😀 hello")).toBe(false);
    expect(isRTL("😀")).toBe(false);
  });

  it("still respects an astral letter that is left-to-right", () => {
    // U+1D400 MATHEMATICAL BOLD CAPITAL A is a letter, not a symbol
    expect(isRTL("\u{1D400} שלום")).toBe(false);
  });

  it("uses the first letter, not a later one", () => {
    expect(isRTL("中 שלום")).toBe(false);
    expect(isRTL("hello שלום")).toBe(false);
  });
});
