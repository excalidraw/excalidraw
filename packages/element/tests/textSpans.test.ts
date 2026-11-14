import { FONT_FAMILY } from "@excalidraw/common";

import {
  adjustTextSpansForEdit,
  adjustTextSpansForTextChange,
  applyTextSpanStyle,
  getCommonTextSpanStyleValue,
  getTextSegments,
  getWrappedLineOffsets,
  normalizeTextSpans,
  stripTextSpanStyle,
} from "../src/textSpans";
import { getTextElementLines } from "../src/richTextLayout";

import type { ExcalidrawTextElement } from "../src/types";

describe("text spans", () => {
  it("normalizes: clamps, drops empty and invalid, merges equal neighbours", () => {
    expect(
      normalizeTextSpans(
        [
          { start: 0, end: 3, bold: true },
          { start: 3, end: 5, bold: true },
          { start: 6, end: 6, italic: true },
          { start: 7, end: 99, strokeColor: "#f00" },
          { start: 1, end: 2, nonsense: true },
          { start: 2, end: 4, fontFamily: 12345 },
        ],
        10,
      ),
    ).toEqual([
      { start: 0, end: 5, bold: true },
      { start: 7, end: 10, strokeColor: "#f00" },
    ]);
    expect(normalizeTextSpans([], 10)).toBe(null);
    expect(normalizeTextSpans([{ start: 0, end: 3, bold: true }], 0)).toBe(
      null,
    );
  });

  it("styles a portion, merging with and splitting existing spans", () => {
    let spans = applyTextSpanStyle(null, 11, 6, 11, { strokeColor: "#f00" });
    expect(spans).toEqual([{ start: 6, end: 11, strokeColor: "#f00" }]);

    spans = applyTextSpanStyle(spans, 11, 4, 8, { bold: true });
    expect(spans).toEqual([
      { start: 4, end: 6, bold: true },
      { start: 6, end: 8, strokeColor: "#f00", bold: true },
      { start: 8, end: 11, strokeColor: "#f00" },
    ]);

    // removing a style
    spans = applyTextSpanStyle(spans, 11, 0, 11, { bold: null });
    expect(spans).toEqual([{ start: 6, end: 11, strokeColor: "#f00" }]);
  });

  it("drops overrides equal to the element's own style", () => {
    const base = { strokeColor: "#000", fontFamily: FONT_FAMILY.Excalifont };
    const spans = applyTextSpanStyle(
      [{ start: 0, end: 5, strokeColor: "#f00" }],
      5,
      0,
      5,
      { strokeColor: "#000", fontFamily: FONT_FAMILY.Excalifont },
      base,
    );
    expect(spans).toBe(null);
  });

  it("shifts spans for edits, typed text taking the style before it", () => {
    const spans = [{ start: 6, end: 11, bold: true }];
    // typing at the end of the bold word extends it
    expect(adjustTextSpansForEdit(spans, 11, 11, 0, 1)).toEqual([
      { start: 6, end: 12, bold: true },
    ]);
    // typing before it shifts it
    expect(adjustTextSpansForEdit(spans, 11, 0, 0, 2)).toEqual([
      { start: 8, end: 13, bold: true },
    ]);
    // deleting into it shrinks it
    expect(adjustTextSpansForEdit(spans, 11, 4, 4, 0)).toEqual([
      { start: 4, end: 7, bold: true },
    ]);
    expect(
      adjustTextSpansForTextChange(spans, "Hello world", "Hello big world"),
    ).toEqual([{ start: 10, end: 15, bold: true }]);
  });

  it("splits text into segments covering gaps", () => {
    expect(getTextSegments([{ start: 2, end: 4, italic: true }], 0, 6)).toEqual(
      [
        { start: 0, end: 2, style: {} },
        { start: 2, end: 4, style: { italic: true } },
        { start: 4, end: 6, style: {} },
      ],
    );
  });

  it("reads the style common to a range", () => {
    const spans = [{ start: 0, end: 4, bold: true }];
    expect(getCommonTextSpanStyleValue(spans, 0, 4, "bold")).toBe(true);
    expect(getCommonTextSpanStyleValue(spans, 0, 6, "bold")).toBe(null);
    expect(getCommonTextSpanStyleValue(spans, 4, 6, "bold")).toBe(undefined);
  });

  it("strips a property from all spans", () => {
    expect(
      stripTextSpanStyle(
        [
          { start: 0, end: 2, strokeColor: "#f00" },
          { start: 2, end: 4, strokeColor: "#0f0", bold: true },
        ],
        ["strokeColor"],
      ),
    ).toEqual([{ start: 2, end: 4, bold: true }]);
  });

  it("maps wrapped lines back to the original text", () => {
    expect(
      getWrappedLineOffsets("Hello\nbig\nworld", "Hello big world"),
    ).toEqual([
      { text: "Hello", start: 0, end: 5 },
      { text: "big", start: 6, end: 9 },
      { text: "world", start: 10, end: 15 },
    ]);
    expect(getWrappedLineOffsets("a\n\nb", "a\n\nb")).toEqual([
      { text: "a", start: 0, end: 1 },
      { text: "", start: 2, end: 2 },
      { text: "b", start: 3, end: 4 },
    ]);
  });

  it("splits wrapped lines into styled pieces for drawing", () => {
    const lines = getTextElementLines({
      text: "Hello\nworld",
      originalText: "Hello world",
      fontSize: 20,
      fontFamily: FONT_FAMILY.Excalifont,
      lineHeight: 1.25 as ExcalidrawTextElement["lineHeight"],
      spans: [{ start: 3, end: 8, strokeColor: "#f00" }],
    });
    expect(lines?.map((line) => line.segments)).toEqual([
      [
        { text: "Hel", style: {} },
        { text: "lo", style: { strokeColor: "#f00" } },
      ],
      [
        { text: "wo", style: { strokeColor: "#f00" } },
        { text: "rld", style: {} },
      ],
    ]);
    // same size throughout: equal lines, as a plain text's
    expect(lines?.map(({ top, height }) => [top, height])).toEqual([
      [0, 25],
      [25, 25],
    ]);
  });

  it("sizes each line by the largest font size on it", () => {
    const lines = getTextElementLines({
      text: "Big\nsmall",
      originalText: "Big\nsmall",
      fontSize: 20,
      fontFamily: FONT_FAMILY.Excalifont,
      lineHeight: 1.25 as ExcalidrawTextElement["lineHeight"],
      spans: [
        { start: 0, end: 3, fontSize: 40 },
        { start: 4, end: 9, fontSize: 10 },
      ],
    });
    // a smaller portion never makes its line shorter than the text's own
    expect(
      lines?.map(({ top, height, fontSize }) => [top, height, fontSize]),
    ).toEqual([
      [0, 50, 40],
      [50, 25, 20],
    ]);
    expect(lines![0].baseline).toBeGreaterThan(lines![1].top - 50);
  });

  it("keeps font size overrides and highlights in normal form", () => {
    expect(
      normalizeTextSpans(
        [
          { start: 0, end: 2, fontSize: 36, highlightColor: "#ffec99" },
          { start: 2, end: 4, fontSize: -3, highlightColor: "transparent" },
        ],
        4,
      ),
    ).toEqual([{ start: 0, end: 2, fontSize: 36, highlightColor: "#ffec99" }]);
    // a size equal to the element's own is no override
    expect(
      applyTextSpanStyle(
        null,
        4,
        0,
        4,
        { fontSize: 20 },
        {
          strokeColor: "#000",
          fontFamily: FONT_FAMILY.Excalifont,
          fontSize: 20,
        },
      ),
    ).toBe(null);
  });
});
