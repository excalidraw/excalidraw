import type { TextStyleRange } from "./types";

export type TextStyle = Pick<TextStyleRange, "bold" | "underline">;
export type TextStyleProperty = keyof TextStyle;
export type TextStyleRun = TextStyle & { text: string };

const sameStyle = (left: TextStyleRange, right: TextStyleRange) =>
  left.bold === right.bold && left.underline === right.underline;

const appendRange = (ranges: TextStyleRange[], range: TextStyleRange) => {
  const previous = ranges[ranges.length - 1];
  if (previous && previous.end === range.start && sameStyle(previous, range)) {
    ranges[ranges.length - 1] = { ...previous, end: range.end };
  } else {
    ranges.push(range);
  }
};

export const getTextStyleAtOffset = (
  ranges: readonly TextStyleRange[] | undefined,
  offset: number,
): TextStyle => {
  const range = ranges?.find(({ start, end }) => start <= offset && offset < end);
  return range ? { bold: range.bold, underline: range.underline } : {};
};

export const getTextStyleRunsForLine = (
  text: string,
  start: number,
  ranges: readonly TextStyleRange[] | undefined,
): TextStyleRun[] => {
  const runs: TextStyleRun[] = [];
  let runStart = 0;
  let bold = false;
  let underline = false;

  for (let index = 0; index <= text.length; index++) {
    const style =
      index < text.length
        ? getTextStyleAtOffset(ranges, start + index)
        : { bold: false, underline: false };
    const nextBold = style.bold === true;
    const nextUnderline = style.underline === true;

    if (index > runStart && (nextBold !== bold || nextUnderline !== underline)) {
      runs.push({ text: text.slice(runStart, index), bold, underline });
      runStart = index;
    }
    bold = nextBold;
    underline = nextUnderline;
  }

  if (runStart < text.length) {
    runs.push({ text: text.slice(runStart), bold, underline });
  }

  return runs;
};

export const updateTextStyleRanges = (
  ranges: readonly TextStyleRange[] | undefined,
  start: number,
  end: number,
  property: TextStyleProperty,
  value: boolean,
): readonly TextStyleRange[] => {
  if (end <= start) {
    return ranges ?? [];
  }

  const boundaries = new Set([start, end]);
  for (const range of ranges ?? []) {
    boundaries.add(range.start);
    boundaries.add(range.end);
  }
  const sortedBoundaries = [...boundaries].sort((a, b) => a - b);
  const result: TextStyleRange[] = [];

  for (let index = 0; index < sortedBoundaries.length - 1; index++) {
    const segmentStart = sortedBoundaries[index];
    const segmentEnd = sortedBoundaries[index + 1];
    const existing = ranges?.find(
      (range) => range.start <= segmentStart && range.end >= segmentEnd,
    );
    const isSelected = segmentStart >= start && segmentEnd <= end;
    const bold =
      property === "bold" && isSelected ? value : existing?.bold;
    const underline =
      property === "underline" && isSelected ? value : existing?.underline;

    if (bold || underline) {
      appendRange(result, {
        start: segmentStart,
        end: segmentEnd,
        ...(bold ? { bold: true } : {}),
        ...(underline ? { underline: true } : {}),
      });
    }
  }

  return result;
};

export const adjustTextStyleRangesForEdit = (
  ranges: readonly TextStyleRange[] | undefined,
  previousText: string,
  nextText: string,
): readonly TextStyleRange[] => {
  if (!ranges?.length || previousText === nextText) {
    return ranges ?? [];
  }

  let prefix = 0;
  while (
    prefix < previousText.length &&
    prefix < nextText.length &&
    previousText[prefix] === nextText[prefix]
  ) {
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < previousText.length - prefix &&
    suffix < nextText.length - prefix &&
    previousText[previousText.length - suffix - 1] ===
      nextText[nextText.length - suffix - 1]
  ) {
    suffix++;
  }

  const previousEnd = previousText.length - suffix;
  const nextEnd = nextText.length - suffix;
  const delta = nextEnd - previousEnd;
  const result: TextStyleRange[] = [];

  for (const range of ranges) {
    if (range.start <= prefix && range.end >= previousEnd) {
      appendRange(result, { ...range, end: range.end + delta });
      continue;
    }

    if (range.start < prefix) {
      appendRange(result, { ...range, end: Math.min(range.end, prefix) });
    }
    if (range.end > previousEnd) {
      appendRange(result, {
        ...range,
        start: Math.max(range.start, previousEnd) + delta,
        end: range.end + delta,
      });
    }
  }

  return result;
};