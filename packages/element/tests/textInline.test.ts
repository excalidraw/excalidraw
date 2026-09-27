import { setTextInlineHooks } from "../src/textInline";
import {
  getWrappedTextLines,
  parseTokens,
  wrapText,
} from "../src/textWrapping";

import type { FontString } from "../src/types";

// sdamex (#5072): inline atoms (board formulas) in text wrapping.
// `measureText` is mocked: every character is 10px wide in tests.
const font = "10px Cascadia, Segoe UI Emoji" as FontString;
const OPEN = "\uFDD0";
const CLOSE = "\uFDD1";
const atom = (latex: string) => `${OPEN}${latex}${CLOSE}`;

// host-like tokenizer: atoms whole, the rest split into words and spaces
const tokenize = (line: string) => {
  if (!line.includes(OPEN)) {
    return null;
  }
  return Array.from(
    line.matchAll(/\uFDD0[^\uFDD1]*\uFDD1|\s|[^\s\uFDD0]+/g),
    (match) => match[0],
  );
};
const isAtom = (token: string) =>
  token.startsWith(OPEN) && token.endsWith(CLOSE);

describe("sdamex: inline atoms in text wrapping", () => {
  afterEach(() => {
    setTextInlineHooks(null);
  });

  it("without hooks splits an atom at its spaces, as upstream", () => {
    const text = `ab ${atom("x + 1")} cd`;
    const upstream = wrapText(text, font, 50);

    setTextInlineHooks({});
    expect(wrapText(text, font, 50)).toBe(upstream);

    expect(
      upstream
        .split("\n")
        .some((line) => line.includes(OPEN) && !line.includes(CLOSE)),
    ).toBe(true);
  });

  it("keeps an atom with spaces whole and moves it to the next line", () => {
    setTextInlineHooks({ tokenize, isAtom });
    // "aaaa " is 50px, the atom is 50px: together 100px > 80px
    expect(wrapText(`aaaa ${atom("b c")}`, font, 80)).toBe(
      `aaaa\n${atom("b c")}`,
    );
  });

  it("never splits an atom wider than the line", () => {
    setTextInlineHooks({ tokenize, isAtom });
    const wide = atom("xxxxxxxxxx");
    expect(wrapText(`ab ${wide} cd`, font, 50)).toBe(`ab\n${wide}\ncd`);
  });

  it("maps every wrapped line back to its source range", () => {
    setTextInlineHooks({ tokenize, isAtom });
    const text = `solve ${atom("x^2 - 5x + 6 = 0")} now\nnext ${atom("y")}`;
    const lines = getWrappedTextLines(text, font, 90);
    for (const line of lines) {
      expect(text.slice(line.start, line.end)).toBe(line.text);
    }
    expect(lines.some((line) => line.text === atom("x^2 - 5x + 6 = 0"))).toBe(
      true,
    );
  });

  it("falls back to the default tokens when the host returns null", () => {
    const upstream = parseTokens("hello world, 99,100.99");
    setTextInlineHooks({ tokenize, isAtom });
    expect(parseTokens("hello world, 99,100.99")).toEqual(upstream);
  });
});
