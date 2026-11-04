import {
  adjustTextStyleRangesForEdit,
  getTextStyleAtOffset,
  getTextStyleRunsForLine,
  updateTextStyleRanges,
} from "../src/textFormatting";

describe("text formatting ranges", () => {
  it("updates one style without changing other styles", () => {
    const bold = updateTextStyleRanges([], 1, 5, "bold", true);
    const styled = updateTextStyleRanges(bold, 3, 7, "underline", true);

    expect(styled).toEqual([
      { start: 1, end: 3, bold: true },
      { start: 3, end: 5, bold: true, underline: true },
      { start: 5, end: 7, underline: true },
    ]);
    expect(getTextStyleAtOffset(styled, 4)).toEqual({
      bold: true,
      underline: true,
    });
  });

  it("removes a style from only the selected range", () => {
    const bold = updateTextStyleRanges([], 0, 8, "bold", true);

    expect(updateTextStyleRanges(bold, 2, 6, "bold", false)).toEqual([
      { start: 0, end: 2, bold: true },
      { start: 6, end: 8, bold: true },
    ]);
  });

  it("maps source formatting to visual line runs", () => {
    expect(
      getTextStyleRunsForLine("world", 6, [
        { start: 7, end: 10, underline: true },
      ]),
    ).toEqual([
      { text: "w", bold: false, underline: false },
      { text: "orl", bold: false, underline: true },
      { text: "d", bold: false, underline: false },
    ]);
  });

  it("shifts ranges after edits and includes inserted text inside a styled run", () => {
    const ranges = adjustTextStyleRangesForEdit(
      [{ start: 1, end: 4, bold: true }],
      "abcde",
      "abXYcde",
    );

    expect(ranges).toEqual([{ start: 1, end: 6, bold: true }]);
  });
});