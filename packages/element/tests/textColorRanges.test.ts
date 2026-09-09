import {
  applyColorRangeToSelection,
  mapWrappedLinesToOriginalOffsets,
  rebaseColorRanges,
  resolveColorAtPosition,
  splitLineIntoColorSegments,
} from "../src/textColorRanges";

describe("mapWrappedLinesToOriginalOffsets", () => {
  it("maps unwrapped text 1:1", () => {
    const original = "Hello world";
    expect(mapWrappedLinesToOriginalOffsets(original, original)).toEqual([
      { text: "Hello world", start: 0, end: 11 },
    ]);
  });

  it("maps a wrapped line back to its source offset", () => {
    const original = "50 lakhs + 1.2 LPM Maintainence cost";
    const wrapped = "50 lakhs + 1.2 LPM\nMaintainence cost";
    expect(mapWrappedLinesToOriginalOffsets(wrapped, original)).toEqual([
      { text: "50 lakhs + 1.2 LPM", start: 0, end: 18 },
      { text: "Maintainence cost", start: 19, end: 36 },
    ]);
  });

  it("handles hard line breaks", () => {
    const original = "line one\n\nline three";
    expect(mapWrappedLinesToOriginalOffsets(original, original)).toEqual([
      { text: "line one", start: 0, end: 8 },
      { text: "", start: 8, end: 8 },
      { text: "line three", start: 10, end: 20 },
    ]);
  });
});

describe("splitLineIntoColorSegments", () => {
  const base = "#1e1e1e";

  it("returns a single segment when there are no ranges", () => {
    expect(
      splitLineIntoColorSegments("Maintainence cost", 19, null, base),
    ).toEqual([{ text: "Maintainence cost", color: base }]);
  });

  it("splits a line around a covering range", () => {
    const segments = splitLineIntoColorSegments(
      "Maintainence cost",
      19,
      [{ start: 19, end: 31, color: "blue" }],
      base,
    );
    expect(segments).toEqual([
      { text: "Maintainence", color: "blue" },
      { text: " cost", color: base },
    ]);
  });

  it("ignores ranges outside the line", () => {
    const segments = splitLineIntoColorSegments(
      "50 lakhs + 1.2 LPM",
      0,
      [{ start: 19, end: 32, color: "blue" }],
      base,
    );
    expect(segments).toEqual([{ text: "50 lakhs + 1.2 LPM", color: base }]);
  });
});

describe("applyColorRangeToSelection", () => {
  const base = "#1e1e1e";

  it("adds a new range", () => {
    expect(applyColorRangeToSelection(null, 19, 32, "blue", base)).toEqual([
      { start: 19, end: 32, color: "blue" },
    ]);
  });

  it("dropping a range that matches the base color", () => {
    expect(applyColorRangeToSelection(null, 19, 32, base, base)).toBeNull();
  });

  it("splits an existing range when re-coloring part of it", () => {
    const result = applyColorRangeToSelection(
      [{ start: 0, end: 20, color: "blue" }],
      5,
      10,
      "red",
      base,
    );
    expect(result).toEqual([
      { start: 0, end: 5, color: "blue" },
      { start: 5, end: 10, color: "red" },
      { start: 10, end: 20, color: "blue" },
    ]);
  });

  it("merges adjacent ranges of the same color", () => {
    const result = applyColorRangeToSelection(
      [{ start: 0, end: 5, color: "blue" }],
      5,
      10,
      "blue",
      base,
    );
    expect(result).toEqual([{ start: 0, end: 10, color: "blue" }]);
  });
});

describe("rebaseColorRanges", () => {
  it("shifts a range when inserting strictly before it, with a gap", () => {
    const result = rebaseColorRanges(
      "12345Maintainence",
      "12xx345Maintainence",
      [{ start: 5, end: 18, color: "blue" }],
    );
    expect(result).toEqual([{ start: 7, end: 20, color: "blue" }]);
  });

  it("extends a range backward when typing right at its start", () => {
    const result = rebaseColorRanges(
      "Maintainence cost",
      "extra Maintainence cost",
      [{ start: 0, end: 13, color: "blue" }],
    );
    expect(result).toEqual([{ start: 0, end: 19, color: "blue" }]);
  });

  it("extends a range forward when typing right at its end", () => {
    const result = rebaseColorRanges("Maintainence", "Maintainence cost", [
      { start: 0, end: 12, color: "blue" },
    ]);
    expect(result).toEqual([{ start: 0, end: 17, color: "blue" }]);
  });

  it("extends a range when typing inside it", () => {
    const result = rebaseColorRanges("Maintnence", "Maintainence", [
      { start: 0, end: 10, color: "blue" },
    ]);
    expect(result).toEqual([{ start: 0, end: 12, color: "blue" }]);
  });

  it("drops a range fully consumed by a deletion", () => {
    const result = rebaseColorRanges("Hello world", "Hello ", [
      { start: 6, end: 11, color: "blue" },
    ]);
    expect(result).toBeNull();
  });
});

describe("resolveColorAtPosition", () => {
  const base = "#1e1e1e";
  const ranges = [{ start: 6, end: 12, color: "blue" }];

  it("returns the base color outside any range", () => {
    expect(resolveColorAtPosition(ranges, 3, base)).toBe(base);
  });

  it("returns the range color at its start boundary", () => {
    expect(resolveColorAtPosition(ranges, 6, base)).toBe("blue");
  });

  it("returns the range color inside it", () => {
    expect(resolveColorAtPosition(ranges, 9, base)).toBe("blue");
  });

  it("returns the range color at its end boundary", () => {
    expect(resolveColorAtPosition(ranges, 12, base)).toBe("blue");
  });
});
