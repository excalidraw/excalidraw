import {
  getFontFamilyString,
  getFontString,
} from "@excalidraw/common";

import { charWidth, getLineHeightInPx, measureText } from "./textMeasurements";

import type {
  ExcalidrawTextElement,
  FontString,
  FontFamilyValues,
  TextStyleAttributes,
  TextStyleRange,
} from "./types";

export type ResolvedTextStyle = {
  fontSize: number;
  fontFamily: FontFamilyValues;
  strokeColor: string;
  bold: boolean;
  italic: boolean;
};

export const getStyledFontString = (style: ResolvedTextStyle): FontString => {
  const fontStyle = style.italic ? "italic " : "";
  const fontWeight = style.bold ? "bold " : "";
  return `${fontStyle}${fontWeight}${style.fontSize}px ${getFontFamilyString({
    fontFamily: style.fontFamily,
  })}` as FontString;
};

export const getResolvedTextStyleAt = (
  element: ExcalidrawTextElement,
  index: number,
): ResolvedTextStyle => {
  const range = element.textStyles?.find(
    (textStyle) => index >= textStyle.start && index < textStyle.end,
  );

  return {
    fontSize: range?.fontSize ?? element.fontSize,
    fontFamily: range?.fontFamily ?? element.fontFamily,
    strokeColor: range?.strokeColor ?? element.strokeColor,
    bold: range?.bold ?? false,
    italic: range?.italic ?? false,
  };
};

const stylesEqual = (a: ResolvedTextStyle, b: ResolvedTextStyle) =>
  a.fontSize === b.fontSize &&
  a.fontFamily === b.fontFamily &&
  a.strokeColor === b.strokeColor &&
  a.bold === b.bold &&
  a.italic === b.italic;

const diffFromElementDefaults = (
  style: ResolvedTextStyle,
  element: ExcalidrawTextElement,
): TextStyleAttributes => {
  const diff: TextStyleAttributes = {};

  if (style.fontSize !== element.fontSize) {
    diff.fontSize = style.fontSize;
  }
  if (style.fontFamily !== element.fontFamily) {
    diff.fontFamily = style.fontFamily;
  }
  if (style.strokeColor !== element.strokeColor) {
    diff.strokeColor = style.strokeColor;
  }
  if (style.bold) {
    diff.bold = true;
  }
  if (style.italic) {
    diff.italic = true;
  }

  return diff;
};

const coalesceResolvedStylesToRanges = (
  resolvedStyles: ResolvedTextStyle[],
  element: ExcalidrawTextElement,
): readonly TextStyleRange[] | undefined => {
  const ranges: TextStyleRange[] = [];

  for (let index = 0; index < resolvedStyles.length; index++) {
    const style = resolvedStyles[index];
    const diff = diffFromElementDefaults(style, element);
    if (Object.keys(diff).length === 0) {
      continue;
    }

    const lastRange = ranges[ranges.length - 1];
    if (lastRange && lastRange.end === index) {
      const lastStyle: ResolvedTextStyle = {
        fontSize: lastRange.fontSize ?? element.fontSize,
        fontFamily: lastRange.fontFamily ?? element.fontFamily,
        strokeColor: lastRange.strokeColor ?? element.strokeColor,
        bold: lastRange.bold ?? false,
        italic: lastRange.italic ?? false,
      };
      if (stylesEqual(lastStyle, style)) {
        lastRange.end = index + 1;
        continue;
      }
    }

    ranges.push({
      start: index,
      end: index + 1,
      ...diff,
    });
  }

  return ranges.length ? ranges : undefined;
};

const getResolvedStylesForText = (
  element: ExcalidrawTextElement,
): ResolvedTextStyle[] =>
  Array.from({ length: element.originalText.length }, (_, index) =>
    getResolvedTextStyleAt(element, index),
  );

export const applyStyleToTextSelection = (
  element: ExcalidrawTextElement,
  selectionStart: number,
  selectionEnd: number,
  styleUpdate: TextStyleAttributes,
): Partial<ExcalidrawTextElement> => {
  const textLength = element.originalText.length;
  let start = Math.max(0, Math.min(selectionStart, selectionEnd));
  let end = Math.min(textLength, Math.max(selectionStart, selectionEnd));

  const isFullSelection = start === 0 && end === textLength;
  const isCollapsedSelection = start === end;

  if (isCollapsedSelection || isFullSelection) {
    return {
      ...styleUpdate,
      textStyles: undefined,
    };
  }

  const resolvedStyles = getResolvedStylesForText(element);

  for (let index = start; index < end; index++) {
    resolvedStyles[index] = {
      ...resolvedStyles[index],
      ...styleUpdate,
      bold: styleUpdate.bold ?? resolvedStyles[index].bold,
      italic: styleUpdate.italic ?? resolvedStyles[index].italic,
    };
  }

  return {
    textStyles: coalesceResolvedStylesToRanges(resolvedStyles, element),
  };
};

export type TextSegment = {
  text: string;
  style: ResolvedTextStyle;
};

export const getTextSegments = (
  text: string,
  element: ExcalidrawTextElement,
  offset = 0,
): TextSegment[] => {
  if (!text.length) {
    return [];
  }

  const segments: TextSegment[] = [];
  let currentSegmentStart = 0;
  let currentStyle = getResolvedTextStyleAt(element, offset);

  for (let index = 1; index < text.length; index++) {
    const nextStyle = getResolvedTextStyleAt(element, offset + index);
    if (!stylesEqual(currentStyle, nextStyle)) {
      segments.push({
        text: text.slice(currentSegmentStart, index),
        style: currentStyle,
      });
      currentSegmentStart = index;
      currentStyle = nextStyle;
    }
  }

  segments.push({
    text: text.slice(currentSegmentStart),
    style: currentStyle,
  });

  return segments;
};

export const measureSegmentWidth = (
  segment: TextSegment,
  lineHeight: ExcalidrawTextElement["lineHeight"],
) => measureText(segment.text, getStyledFontString(segment.style), lineHeight).width;

export const measureStyledLineWidth = (
  line: string,
  element: ExcalidrawTextElement,
  lineStartOffset: number,
) =>
  getTextSegments(line, element, lineStartOffset).reduce(
    (width, segment) =>
      width + measureSegmentWidth(segment, element.lineHeight),
    0,
  );

export const getMaxFontSizeInText = (element: ExcalidrawTextElement) => {
  let maxFontSize = element.fontSize;

  for (const range of element.textStyles ?? []) {
    if (range.fontSize) {
      maxFontSize = Math.max(maxFontSize, range.fontSize);
    }
  }

  return maxFontSize;
};

export const measureStyledText = (
  element: ExcalidrawTextElement,
  text = element.text,
  maxWidth?: number,
) => {
  if (!element.textStyles?.length) {
    return measureText(text, getFontString(element), element.lineHeight);
  }

  if (!element.autoResize) {
    return measureText(
      text,
      getFontString({
        ...element,
        fontSize: getMaxFontSizeInText(element),
      }),
      element.lineHeight,
    );
  }

  const hardLines = element.originalText.replace(/\r\n?/g, "\n").split("\n");
  let width = 0;
  let height = 0;
  let charOffset = 0;

  for (let lineIndex = 0; lineIndex < hardLines.length; lineIndex++) {
    const hardLine = hardLines[lineIndex];
    const lineWidth = measureStyledLineWidth(
      hardLine,
      element,
      charOffset,
    );
    width = Math.max(width, lineWidth);

    const maxLineFontSize = getTextSegments(hardLine, element, charOffset)
      .map((segment) => segment.style.fontSize)
      .reduce(
        (maxFontSize, fontSize) => Math.max(maxFontSize, fontSize),
        element.fontSize,
      );

    height += getLineHeightInPx(maxLineFontSize, element.lineHeight);
    charOffset += hardLine.length + 1;
  }

  return { width, height };
};

export const getSelectionStyleAttributes = (
  element: ExcalidrawTextElement,
  selectionStart: number,
  selectionEnd: number,
): TextStyleAttributes | null => {
  const textLength = element.originalText.length;
  const start = Math.max(0, Math.min(selectionStart, selectionEnd));
  const end = Math.min(textLength, Math.max(selectionStart, selectionEnd));

  if (start >= end) {
    return null;
  }

  const firstStyle = getResolvedTextStyleAt(element, start);
  for (let index = start + 1; index < end; index++) {
    if (!stylesEqual(firstStyle, getResolvedTextStyleAt(element, index))) {
      return null;
    }
  }

  return diffFromElementDefaults(firstStyle, element);
};
