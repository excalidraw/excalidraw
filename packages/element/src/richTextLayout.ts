/**
 * Measuring and wrapping text elements whose portions are styled (spans with
 * other fonts, bold, italic). Plain texts go through the regular, cached
 * `measureText()` / `wrapText()` untouched.
 */
import { getFontString, getVerticalOffset } from "@excalidraw/common";

import {
  getLineHeightInPx,
  getLineWidth,
  measureText,
} from "./textMeasurements";
import { wrapText } from "./textWrapping";
import {
  getListItemMetrics,
  getListLineLayouts,
  parseMarkdownListLines,
} from "./markdownList";
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

/**
 * Wraps `originalText` of a text element, measuring its spans' fonts.
 *
 * Markdown list items (`- item`, `1. item`) wrap with a hanging indent: their
 * content wraps within the width left after the (nested) marker, and the raw
 * marker prefix stays on the item's first line (see `markdownList.ts`).
 */
export const wrapTextElementText = (
  element: TextLayoutElement,
  originalText: string,
  maxWidth: number,
  env?: RenderEnvironment,
) => {
  const font = getFontString(element);
  const measure = getTextSpanMeasurer(element, env);
  const listItems = parseMarkdownListLines(originalText);

  if (!listItems) {
    return wrapText(originalText, font, maxWidth, env, measure);
  }

  const measureMarker = (text: string) => getLineWidth(text, font, env);
  // the measurer takes offsets into `originalText`: shift it to a line's
  const measureFrom = (base: number): TextLineMeasurer | undefined =>
    measure && ((text, start) => measure(text, start + base));

  const wrappedLines: string[] = [];
  let offset = 0;

  originalText.split("\n").forEach((line, index) => {
    const item = listItems[index];
    if (!item) {
      wrappedLines.push(
        wrapText(line, font, maxWidth, env, measureFrom(offset)),
      );
    } else {
      const { contentX } = getListItemMetrics(
        item,
        element.fontSize,
        measureMarker,
      );
      wrappedLines.push(
        line.slice(0, item.contentStart) +
          wrapText(
            line.slice(item.contentStart),
            font,
            // (finite widths only: an infinite one doesn't wrap at all)
            Number.isFinite(maxWidth)
              ? Math.max(0, maxWidth - contentX)
              : maxWidth,
            env,
            measureFrom(offset + item.contentStart),
          ),
      );
    }
    offset += line.length + 1;
  });

  return wrappedLines.join("\n");
};

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
  /**
   * px from the line's start where its text starts: past a list item's
   * (nested) marker, on the item's first line and the lines it wraps into
   */
  contentX: number;
  /** a list item's marker, drawn in the text's own font and color */
  listMarker: { text: string; x: number } | null;
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
  env?: RenderEnvironment,
): TextElementLine[] | null => {
  const { spans } = element;
  if (!spans?.length) {
    return null;
  }
  const text = element.text.replace(/\r\n?/g, "\n");
  const font = getFontString(element);
  const listLayouts = getListLineLayouts(
    text,
    element.originalText,
    element.fontSize,
    (marker) => getLineWidth(marker, font, env),
  );
  let top = 0;
  return getWrappedLineOffsets(text, element.originalText).map(
    (offsets, index) => {
      const listLayout = listLayouts?.[index] ?? null;
      // a list item's raw marker prefix isn't drawn (its marker is instead)
      const textStart = listLayout?.textStart ?? 0;
      const line = {
        text: offsets.text.slice(textStart),
        start: offsets.start + textStart,
        end: Math.max(offsets.end, offsets.start + textStart),
      };
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
        baseline: top + getVerticalOffset(element.fontFamily, fontSize, height),
        contentX: listLayout?.contentX ?? 0,
        listMarker: listLayout?.item
          ? { text: listLayout.item.displayMarker, x: listLayout.markerX }
          : null,
      };
      top += height;
      return result;
    },
  );
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
  const lines = getTextElementLines({ ...element, text, originalText }, env);
  if (!lines) {
    // plain text: only list items (hanging indents) change its width
    const listLayouts = getListLineLayouts(
      text,
      originalText,
      element.fontSize,
      (marker) => getLineWidth(marker, font, env),
    );
    if (!listLayouts) {
      return metrics;
    }
    let width = 0;
    text
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .forEach((line, index) => {
        const layout = listLayouts[index];
        width = Math.max(
          width,
          layout
            ? layout.contentX +
                getLineWidth(line.slice(layout.textStart), font, env)
            : getLineWidth(line, font, env),
        );
      });
    return { width, height: metrics.height };
  }
  let width = 0;
  for (const line of lines) {
    let lineWidth = line.contentX;
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

/** a line of a list item (its first, or one it wrapped into) */
export const isTextElementListLine = (line: TextElementLine) =>
  line.listMarker !== null || line.contentX > 0;

/** where to draw underline / strikethrough, relative to the baseline */
export const getTextDecorationMetrics = (fontSize: number) => ({
  thickness: Math.max(1, fontSize / 18),
  underlineOffset: fontSize * 0.12,
  strikethroughOffset: -fontSize * 0.28,
});
