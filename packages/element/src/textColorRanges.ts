import type { TextColorRange } from "./types";

export type ColorSegment = {
  text: string;
  color: string;
};

export const resolveColorAtPosition = (
  ranges: readonly TextColorRange[] | null | undefined,
  pos: number,
  baseColor: string,
): string => {
  const touching = ranges?.find(
    (range) => range.start <= pos && pos <= range.end,
  );
  return touching?.color ?? baseColor;
};

export const mapWrappedLinesToOriginalOffsets = (
  wrappedText: string,
  originalText: string,
): { text: string; start: number; end: number }[] => {
  const lines = wrappedText.split("\n");
  const result: { text: string; start: number; end: number }[] = [];

  let searchFrom = 0;
  for (const line of lines) {
    const start = line.length
      ? originalText.indexOf(line, searchFrom)
      : searchFrom;
    const resolvedStart = start === -1 ? searchFrom : start;
    const end = resolvedStart + line.length;
    result.push({ text: line, start: resolvedStart, end });
    searchFrom = end;
  }

  return result;
};

export const splitLineIntoColorSegments = (
  lineText: string,
  lineStart: number,
  ranges: readonly TextColorRange[] | null | undefined,
  baseColor: string,
): ColorSegment[] => {
  if (!ranges?.length || !lineText) {
    return [{ text: lineText, color: baseColor }];
  }

  const lineEnd = lineStart + lineText.length;
  const breakpoints = new Set([0, lineText.length]);

  for (const range of ranges) {
    if (range.end <= lineStart || range.start >= lineEnd) {
      continue;
    }
    breakpoints.add(Math.max(0, range.start - lineStart));
    breakpoints.add(Math.min(lineText.length, range.end - lineStart));
  }

  const sorted = Array.from(breakpoints).sort((a, b) => a - b);
  const segments: ColorSegment[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    if (from === to) {
      continue;
    }
    const mid = lineStart + from;
    const covering = ranges.find(
      (range) => range.start <= mid && range.end > mid,
    );
    segments.push({
      text: lineText.slice(from, to),
      color: covering?.color ?? baseColor,
    });
  }

  return segments.length ? segments : [{ text: lineText, color: baseColor }];
};

export const applyColorRangeToSelection = (
  existingRanges: readonly TextColorRange[] | null | undefined,
  start: number,
  end: number,
  color: string,
  baseColor: string,
): TextColorRange[] | null => {
  if (start >= end) {
    return existingRanges?.length ? [...existingRanges] : null;
  }

  const survivors: TextColorRange[] = [];
  for (const range of existingRanges ?? []) {
    if (range.end <= start || range.start >= end) {
      survivors.push(range);
      continue;
    }
    if (range.start < start) {
      survivors.push({ start: range.start, end: start, color: range.color });
    }
    if (range.end > end) {
      survivors.push({ start: end, end: range.end, color: range.color });
    }
  }

  if (color !== baseColor) {
    survivors.push({ start, end, color });
  }

  survivors.sort((a, b) => a.start - b.start);

  const merged: TextColorRange[] = [];
  for (const range of survivors) {
    const last = merged[merged.length - 1];
    if (last && last.end === range.start && last.color === range.color) {
      merged[merged.length - 1] = { ...last, end: range.end };
    } else {
      merged.push(range);
    }
  }

  return merged.length ? merged : null;
};

const mapPosition = (
  x: number,
  isStart: boolean,
  p: number,
  oldEnd: number,
  newSpanLen: number,
  delta: number,
): number => {
  if (oldEnd === p) {
    if (x < p) {
      return x;
    }
    if (x > p) {
      return x + delta;
    }
    return isStart ? x : x + delta;
  }

  if (x <= p) {
    return x;
  }
  if (x >= oldEnd) {
    return x + delta;
  }
  return isStart ? p + newSpanLen : p;
};

export const rebaseColorRanges = (
  oldText: string,
  newText: string,
  ranges: readonly TextColorRange[] | null | undefined,
): TextColorRange[] | null => {
  if (!ranges?.length || oldText === newText) {
    return ranges?.length ? [...ranges] : null;
  }

  let prefix = 0;
  const maxPrefix = Math.min(oldText.length, newText.length);
  while (prefix < maxPrefix && oldText[prefix] === newText[prefix]) {
    prefix++;
  }

  let suffix = 0;
  const maxSuffix = maxPrefix - prefix;
  while (
    suffix < maxSuffix &&
    oldText[oldText.length - 1 - suffix] ===
      newText[newText.length - 1 - suffix]
  ) {
    suffix++;
  }

  const p = prefix;
  const oldEnd = oldText.length - suffix;
  const newSpanLen = newText.length - suffix - p;
  const delta = newText.length - oldText.length;

  const result: TextColorRange[] = [];
  for (const range of ranges) {
    const start = mapPosition(range.start, true, p, oldEnd, newSpanLen, delta);
    const end = mapPosition(range.end, false, p, oldEnd, newSpanLen, delta);
    if (start < end) {
      result.push({ start, end, color: range.color });
    }
  }

  return result.length ? result : null;
};
