import { FONT_FAMILY } from "@excalidraw/common";

import {
  getListContinuation,
  getListLineLayouts,
  parseMarkdownListLines,
  parseMarkdownListMarker,
} from "../src/markdownList";
import {
  getTextElementLines,
  measureTextElementText,
  wrapTextElementText,
} from "../src/richTextLayout";

import type { ExcalidrawTextElement } from "../src/types";

// `measureText` is mocked by `jest-canvas-mock`: every character is 10px wide
// at a 10px font, so a marker's box is 10px, and the gap after it 3.5px
const element = {
  fontSize: 10,
  fontFamily: FONT_FAMILY.Excalifont,
  lineHeight: 1.25 as ExcalidrawTextElement["lineHeight"],
};
const measure = (text: string) => text.length * 10;

describe("markdown list parsing", () => {
  it("parses `- ` and `N. ` markers", () => {
    expect(parseMarkdownListMarker("- item")).toEqual({
      kind: "unordered",
      indent: "",
      indentColumns: 0,
      marker: "-",
      number: null,
      contentStart: 2,
    });
    expect(parseMarkdownListMarker("  4.  item")).toMatchObject({
      kind: "ordered",
      indent: "  ",
      indentColumns: 2,
      marker: "4.",
      number: "4",
      contentStart: 6,
    });
    expect(parseMarkdownListMarker("\t- item")?.indentColumns).toBe(4);
    // an empty item
    expect(parseMarkdownListMarker("- ")?.contentStart).toBe(2);
  });

  it("doesn't parse what isn't a list item", () => {
    expect(parseMarkdownListMarker("-item")).toBe(null);
    expect(parseMarkdownListMarker("-")).toBe(null);
    expect(parseMarkdownListMarker("4.5 apples")).toBe(null);
    expect(parseMarkdownListMarker("4)item")).toBe(null);
    expect(parseMarkdownListMarker("a - b")).toBe(null);
    expect(parseMarkdownListLines("no list\nhere - at all")).toBe(null);
  });

  it("nests by relative indentation (2 or 4 spaces, or tabs)", () => {
    const levels = (text: string) =>
      parseMarkdownListLines(text)!.map((item) => item?.level ?? null);

    expect(levels("- a\n  - b\n    - c\n  - d\n- e")).toEqual([0, 1, 2, 1, 0]);
    expect(levels("- a\n    - b\n\t\t- c")).toEqual([0, 1, 2]);
    // a paragraph ends the list, an empty line doesn't
    expect(levels("- a\n  - b\n\n  - c\ntext\n  - d")).toEqual([
      0,
      1,
      null,
      1,
      null,
      0,
    ]);
  });

  it("draws bullets by level, and numbers as typed", () => {
    const markers = parseMarkdownListLines(
      "- a\n  - b\n    - c\n      - d\n7. e",
    )!.map((item) => item!.displayMarker);
    expect(markers).toEqual(["•", "◦", "▪", "•", "7."]);
  });
});

describe("markdown list layout", () => {
  it("wraps items with a hanging indent, keeping the raw prefix", () => {
    const text = "- aaa bbb ccc";
    // the content (past 13.5px of marker) wraps within 66.5px
    expect(wrapTextElementText(element, text, 80)).toBe("- aaa\nbbb\nccc");
    // ...where the line as typed would wrap within the whole 80px
    expect(wrapTextElementText(element, "x aaa bbb ccc", 80)).toBe(
      "x aaa\nbbb ccc",
    );
  });

  it("shifts nested items right, and keeps regular lines as they are", () => {
    const originalText = "intro\n- aaa\n  - bbb ccc";
    const text = wrapTextElementText(element, originalText, 90);
    // the nested item's content starts at 12.5 + 10 + 3.5 = 26px, and wraps
    // within 64px
    expect(text).toBe("intro\n- aaa\n  - bbb\nccc");

    const layouts = getListLineLayouts(text, originalText, 10, measure)!;
    expect(layouts[0]).toBe(null);
    expect(layouts[1]).toMatchObject({ markerX: 0, contentX: 13.5 });
    expect(layouts[1]!.item!.displayMarker).toBe("•");
    expect(layouts[2]).toMatchObject({
      markerX: 12.5,
      contentX: 26,
      textStart: 4,
    });
    expect(layouts[2]!.item!.displayMarker).toBe("◦");
    // the line the item wrapped into hangs with the item's text
    expect(layouts[3]).toMatchObject({
      contentX: 26,
      textStart: 0,
      item: null,
    });

    // widest: the nested lines, 26px + 30px of text
    expect(measureTextElementText(element, text, originalText).width).toBe(56);
  });

  it("lays out the item lines of rich text", () => {
    const originalText = "1. bold item";
    const text = wrapTextElementText(element, originalText, 80);
    expect(text).toBe("1. bold\nitem");
    const lines = getTextElementLines({
      ...element,
      text,
      originalText,
      spans: [{ start: 3, end: 7, bold: true }],
    })!;
    // the raw marker isn't drawn as text, the typed number is
    expect(lines[0].segments.map((segment) => segment.text)).toEqual(["bold"]);
    expect(lines[0].listMarker).toEqual({ text: "1.", x: 0 });
    // `1.` is 20px wide, + 3.5px
    expect(lines[0].contentX).toBe(23.5);
    expect(lines[1].listMarker).toBe(null);
    expect(lines[1].contentX).toBe(23.5);
  });
});

describe("markdown list continuation", () => {
  const press = (value: string, caret = value.length) => {
    const continuation = getListContinuation(value, caret);
    return continuation
      ? value.slice(0, continuation.start) +
          continuation.text +
          value.slice(continuation.end)
      : null;
  };

  it("continues unordered items", () => {
    expect(press("- item")).toBe("- item\n- ");
    expect(press("intro\n  - nested")).toBe("intro\n  - nested\n  - ");
  });

  it("continues ordered items, counting up", () => {
    expect(press("4. item")).toBe("4. item\n5. ");
    expect(press("09. item")).toBe("09. item\n10. ");
    expect(press("1. a\n\t2. b", 4)).toBe("1. a\n2. \n\t2. b");
  });

  it("splits an item when Enter is pressed in the middle of it", () => {
    expect(press("- foo bar", 5)).toBe("- foo\n-  bar");
  });

  it("ends the list on an empty item", () => {
    expect(press("- a\n- ")).toBe("- a\n");
    expect(press("- a\n  3.  ")).toBe("- a\n");
  });

  it("leaves Enter alone outside of list items", () => {
    expect(press("text")).toBe(null);
    expect(press("- item", 1)).toBe(null);
  });
});
