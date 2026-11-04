/**
 * Measuring and wrapping text elements whose portions are styled (spans with
 * other fonts, bold, italic). Plain texts go through the regular, cached
 * `measureText()` / `wrapText()` untouched.
 */
import {
  getFontString,
  getVerticalOffset,
} from "@excalidraw/common";

import {
  getLineHeightInPx,
  getLineWidth,
  measureText,
} from "./textMeasurements";
import { wrapText } from "./textWrapping";
import {
  getTextSegmentFontString,
  getTextSegments,
  getWrappedLineOffsets,
} from "./textSpans";

import type { RenderEnvironment } from "./renderEnvironment";
import type { TextLineMeasurer } from "./textWrapping";
import type { ExcalidrawTextElement, TextSpanStyle } from "./types";

export type TextLayoutElement = Pick<
  ExcalidrawTextElement,
  "fontSize" | "fontFamily" | "lineHeight"
> &
  Partial<Pick<ExcalidrawTextElement, "spans">>;

/**
 * Measures text starting at an `originalText` offset, font by font. `null`
 * for a text without spans (measure with its font string instead).
 */
export const getTextSpanMeasurer = (
  element: TextLayoutElement,
  env?: RenderEnvironment,
): TextLineMeasurer | undefined => {
  const { spans } = element;
  if (!spans?.length) {
    return undefined;
  }
  return (text, start) => {
    let width = 0;
    for (const segment of getTextSegments(spans, start, start + text.length)) {
      width += getLineWidth(
        text.slice(segment.start - start, segment.end - start),
        getTextSegmentFontString(element, segment.style),
        env,
      );
    }
    return width;
  };
};

/** wraps `originalText` of a text element, measuring its spans' fonts */
export const wrapTextElementText = (
  element: TextLayoutElement,
  originalText: string,
  maxWidth: number,
  env?: RenderEnvironment,
) =>
  wrapText(
    originalText,
    getFontString(element),
    maxWidth,
    env,
    getTextSpanMeasurer(element, env),
  );

export type TextLineSegment = { text: string; style: TextSpanStyle };

export type TextElementLine = {
  segments: TextLineSegment[];
  /** the largest font size on the line, which sets its height */
  fontSize: number;
  /** px from the text's top */
  top: number;
  height: number;
  /** px from the text's top */
  baseline: number;
};

const getLineFontSize = (
  baseFontSize: number,
  segments: readonly TextLineSegment[],
) =>
  segments.reduce(
    (max, segment) => Math.max(max, segment.style.fontSize ?? 0),
    baseFontSize,
  );

/**
 * The (wrapped) lines of a text element with spans: each split into pieces
 * of one style, and stacked by the largest font size on it (as the editor's
 * line boxes are). `null` for a text without spans.
 */
export const getTextElementLines = (
  element: TextLayoutElement &
    Pick<ExcalidrawTextElement, "text" | "originalText">,
): TextElementLine[] | null => {
  const { spans } = element;
  if (!spans?.length) {
    return null;
  }
  let top = 0;
  return getWrappedLineOffsets(
    element.text.replace(/\r\n?/g, "\n"),
    element.originalText,
  ).map((line) => {
    const segments: TextLineSegment[] =
      line.end - line.start === line.text.length
        ? getTextSegments(spans, line.start, line.end).map((segment) => ({
            text: element.originalText.slice(segment.start, segment.end),
            style: segment.style,
          }))
        : [{ text: line.text, style: {} }];
    const fontSize = getLineFontSize(element.fontSize, segments);
    const height = getLineHeightInPx(fontSize, element.lineHeight);
    const result: TextElementLine = {
      segments,
      fontSize,
      top,
      height,
      baseline:
        top + getVerticalOffset(element.fontFamily, fontSize, height),
    };
    top += height;
    return result;
  });
};

/**
 * Measures the (wrapped) `text` of a text element, measuring its spans'
 * fonts and sizes — `originalText` maps the wrapped lines back to the spans.
 */
export const measureTextElementText = (
  element: TextLayoutElement,
  text: string,
  originalText: string,
  env?: RenderEnvironment,
) => {
  const font = getFontString(element);
  const metrics = measureText(text, font, element.lineHeight, env);
  const lines = getTextElementLines({ ...element, text, originalText });
  if (!lines) {
    return metrics;
  }
  let width = 0;
  for (const line of lines) {
    let lineWidth = 0;
    for (const segment of line.segments) {
      lineWidth += getLineWidth(
        segment.text,
        getTextSegmentFontString(element, segment.style),
        env,
      );
    }
    width = Math.max(width, lineWidth);
  }
  const last = lines[lines.length - 1];
  return { width, height: last ? last.top + last.height : metrics.height };
};

/** where to draw underline / strikethrough, relative to the baseline */
export const getTextDecorationMetrics = (fontSize: number) => ({
  thickness: Math.max(1, fontSize / 18),
  underlineOffset: fontSize * 0.12,
  strikethroughOffset: -fontSize * 0.28,
});
