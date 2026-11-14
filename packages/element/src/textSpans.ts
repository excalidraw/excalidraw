/**
 * Rich text: styles applied to portions of a text element (`element.spans`).
 *
 * Spans index into `originalText` (end-exclusive code-unit offsets), are
 * sorted, non-overlapping, never empty and never carry an empty style.
 * Everything here is pure, and keeps spans in that normal form.
 */
import { FONT_FAMILY, getFontFamilyString } from "@excalidraw/common";

import type {
  ExcalidrawTextElement,
  FontFamilyValues,
  FontString,
  TextSpan,
  TextSpanStyle,
} from "./types";

export type TextSpanStyleKey = keyof TextSpanStyle;

export const TEXT_SPAN_STYLE_KEYS: readonly TextSpanStyleKey[] = [
  "strokeColor",
  "fontFamily",
  "fontSize",
  "highlightColor",
  "bold",
  "italic",
  "underline",
  "strikethrough",
];

/**
 * A patch to a style: a value sets the property, `null` removes it (falls
 * back to the element's own style).
 */
export type TextSpanStylePatch = {
  [K in TextSpanStyleKey]?: TextSpanStyle[K] | null;
};

/** the element's own style, which spans override */
export type TextSpanBaseStyle = {
  strokeColor: string;
  fontFamily: FontFamilyValues;
  fontSize?: number;
};

/** a piece of text with one style throughout (`style` may be empty) */
export type TextSegment = {
  start: number;
  end: number;
  style: TextSpanStyle;
};

const MAX_SPAN_FONT_SIZE = 1000;

const isValidFontFamily = (value: unknown): value is FontFamilyValues =>
  Object.values(FONT_FAMILY).includes(value as FontFamilyValues);

/** drops unknown / falsy / invalid properties */
export const sanitizeTextSpanStyle = (style: unknown): TextSpanStyle => {
  const next: TextSpanStyle = {};
  if (!style || typeof style !== "object") {
    return next;
  }
  const source = style as Record<string, unknown>;
  if (typeof source.strokeColor === "string" && source.strokeColor) {
    next.strokeColor = source.strokeColor;
  }
  if (isValidFontFamily(source.fontFamily)) {
    next.fontFamily = source.fontFamily;
  }
  if (
    typeof source.fontSize === "number" &&
    Number.isFinite(source.fontSize) &&
    source.fontSize > 0
  ) {
    next.fontSize = Math.min(source.fontSize, MAX_SPAN_FONT_SIZE);
  }
  if (
    typeof source.highlightColor === "string" &&
    source.highlightColor &&
    source.highlightColor !== "transparent"
  ) {
    next.highlightColor = source.highlightColor;
  }
  for (const key of ["bold", "italic", "underline", "strikethrough"] as const) {
    if (source[key] === true) {
      next[key] = true;
    }
  }
  return next;
};

export const getTextSpanStyle = (span: TextSpanStyle): TextSpanStyle =>
  sanitizeTextSpanStyle(span);

export const isEmptyTextSpanStyle = (style: TextSpanStyle) =>
  TEXT_SPAN_STYLE_KEYS.every((key) => style[key] === undefined);

export const textSpanStylesEqual = (a: TextSpanStyle, b: TextSpanStyle) =>
  TEXT_SPAN_STYLE_KEYS.every((key) => a[key] === b[key]);

/**
 * Brings spans into normal form for a text of `textLength`: clamped, sorted,
 * non-overlapping (later spans win), empty ones dropped, adjacent equal ones
 * merged. Returns `null` when no span is left.
 */
export const normalizeTextSpans = (
  spans: readonly unknown[] | null | undefined,
  textLength: number,
): TextSpan[] | null => {
  if (!Array.isArray(spans) || !spans.length || textLength <= 0) {
    return null;
  }
  // paint each span onto a per-offset style map, so overlaps resolve with
  // later spans winning, then read runs back off it
  const styles: (TextSpanStyle | null)[] = new Array(textLength).fill(null);
  for (const raw of spans) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const { start, end } = raw as { start: unknown; end: unknown };
    if (typeof start !== "number" || typeof end !== "number") {
      continue;
    }
    const from = Math.max(0, Math.min(textLength, Math.floor(start)));
    const to = Math.max(0, Math.min(textLength, Math.floor(end)));
    const style = sanitizeTextSpanStyle(raw);
    if (from >= to || isEmptyTextSpanStyle(style)) {
      continue;
    }
    for (let index = from; index < to; index++) {
      styles[index] = style;
    }
  }
  return stylesToSpans(styles);
};

const stylesToSpans = (
  styles: readonly (TextSpanStyle | null)[],
): TextSpan[] | null => {
  const result: TextSpan[] = [];
  let index = 0;
  while (index < styles.length) {
    const style = styles[index];
    let end = index + 1;
    while (
      end < styles.length &&
      (styles[end] === style ||
        (!!style &&
          !!styles[end] &&
          textSpanStylesEqual(style, styles[end] as TextSpanStyle)))
    ) {
      end++;
    }
    if (style && !isEmptyTextSpanStyle(style)) {
      result.push({ start: index, end, ...style });
    }
    index = end;
  }
  return result.length ? result : null;
};

const spansToStyles = (
  spans: readonly TextSpan[] | null | undefined,
  textLength: number,
): (TextSpanStyle | null)[] => {
  const styles: (TextSpanStyle | null)[] = new Array(textLength).fill(null);
  for (const span of spans ?? []) {
    const style = getTextSpanStyle(span);
    for (
      let index = Math.max(0, span.start);
      index < Math.min(textLength, span.end);
      index++
    ) {
      styles[index] = style;
    }
  }
  return styles;
};

const applyPatch = (
  style: TextSpanStyle | null,
  patch: TextSpanStylePatch,
): TextSpanStyle | null => {
  const next: Record<string, unknown> = { ...(style ?? {}) };
  for (const key of TEXT_SPAN_STYLE_KEYS) {
    if (!(key in patch)) {
      continue;
    }
    const value = patch[key];
    if (value === null || value === undefined || value === false) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  const sanitized = sanitizeTextSpanStyle(next);
  return isEmptyTextSpanStyle(sanitized) ? null : sanitized;
};

/**
 * Applies `patch` to `[start, end)` of a text of `textLength`.
 *
 * Pass `base` (the element's own style) so that a span set to the element's
 * own color/font doesn't keep a redundant override.
 */
export const applyTextSpanStyle = (
  spans: readonly TextSpan[] | null | undefined,
  textLength: number,
  start: number,
  end: number,
  patch: TextSpanStylePatch,
  base?: TextSpanBaseStyle,
): TextSpan[] | null => {
  const from = Math.max(0, Math.min(textLength, Math.min(start, end)));
  const to = Math.max(0, Math.min(textLength, Math.max(start, end)));
  const styles = spansToStyles(spans, textLength);
  for (let index = from; index < to; index++) {
    let style = applyPatch(styles[index], patch);
    if (style && base) {
      if (style.strokeColor === base.strokeColor) {
        style = applyPatch(style, { strokeColor: null });
      }
      if (style && style.fontFamily === base.fontFamily) {
        style = applyPatch(style, { fontFamily: null });
      }
      if (style && base.fontSize && style.fontSize === base.fontSize) {
        style = applyPatch(style, { fontSize: null });
      }
    }
    styles[index] = style;
  }
  return stylesToSpans(styles);
};

/** removes `keys` from every span, e.g. once the whole text got that style */
export const stripTextSpanStyle = (
  spans: readonly TextSpan[] | null | undefined,
  keys: readonly TextSpanStyleKey[],
): TextSpan[] | null => {
  if (!spans?.length) {
    return null;
  }
  const patch: TextSpanStylePatch = {};
  for (const key of keys) {
    patch[key] = null;
  }
  const result: TextSpan[] = [];
  for (const span of spans) {
    const style = applyPatch(getTextSpanStyle(span), patch);
    if (style) {
      result.push({ start: span.start, end: span.end, ...style });
    }
  }
  return normalizeTextSpans(
    result,
    result.length ? result[result.length - 1].end : 0,
  );
};

/**
 * Shifts spans for an edit replacing `removed` code units at `start` with
 * `inserted` ones. Inserted text takes the style of the character before it
 * (as typing does), or after it at the very start.
 */
export const adjustTextSpansForEdit = (
  spans: readonly TextSpan[] | null | undefined,
  textLength: number,
  start: number,
  removed: number,
  inserted: number,
): TextSpan[] | null => {
  if (!spans?.length) {
    return null;
  }
  const styles = spansToStyles(spans, textLength);
  const inheritFrom =
    start > 0 ? styles[start - 1] : styles[start + removed] ?? null;
  const next = [
    ...styles.slice(0, start),
    ...new Array(inserted).fill(inheritFrom),
    ...styles.slice(start + removed),
  ];
  return stylesToSpans(next);
};

/**
 * Derives the edit that turned `prevText` into `nextText` (one contiguous
 * replacement, from the common prefix and suffix) and shifts spans for it.
 */
export const adjustTextSpansForTextChange = (
  spans: readonly TextSpan[] | null | undefined,
  prevText: string,
  nextText: string,
): TextSpan[] | null => {
  if (!spans?.length || prevText === nextText) {
    return normalizeTextSpans(spans as TextSpan[] | null, nextText.length);
  }
  let prefix = 0;
  const maxPrefix = Math.min(prevText.length, nextText.length);
  while (prefix < maxPrefix && prevText[prefix] === nextText[prefix]) {
    prefix++;
  }
  let suffix = 0;
  const maxSuffix = Math.min(prevText.length, nextText.length) - prefix;
  while (
    suffix < maxSuffix &&
    prevText[prevText.length - 1 - suffix] ===
      nextText[nextText.length - 1 - suffix]
  ) {
    suffix++;
  }
  return adjustTextSpansForEdit(
    spans,
    prevText.length,
    prefix,
    prevText.length - prefix - suffix,
    nextText.length - prefix - suffix,
  );
};

/**
 * Splits `[start, end)` into segments of uniform style, covering gaps
 * between spans with an empty style.
 */
export const getTextSegments = (
  spans: readonly TextSpan[] | null | undefined,
  start: number,
  end: number,
): TextSegment[] => {
  const segments: TextSegment[] = [];
  let cursor = start;
  for (const span of spans ?? []) {
    if (span.end <= cursor) {
      continue;
    }
    if (span.start >= end) {
      break;
    }
    if (span.start > cursor) {
      segments.push({ start: cursor, end: span.start, style: {} });
      cursor = span.start;
    }
    const segmentEnd = Math.min(end, span.end);
    segments.push({
      start: cursor,
      end: segmentEnd,
      style: getTextSpanStyle(span),
    });
    cursor = segmentEnd;
  }
  if (cursor < end) {
    segments.push({ start: cursor, end, style: {} });
  }
  return segments;
};

/**
 * The value of `key` common to all of `[start, end)`, `undefined` where it's
 * the element's own, or `null` where it varies.
 */
export const getCommonTextSpanStyleValue = <K extends TextSpanStyleKey>(
  spans: readonly TextSpan[] | null | undefined,
  start: number,
  end: number,
  key: K,
): TextSpanStyle[K] | null => {
  const segments = getTextSegments(spans, start, end);
  if (!segments.length) {
    return undefined;
  }
  const first = segments[0].style[key];
  return segments.every((segment) => segment.style[key] === first)
    ? first
    : null;
};

export const hasTextSpans = (
  element: Pick<ExcalidrawTextElement, "spans">,
): element is Pick<ExcalidrawTextElement, "spans"> & {
  spans: readonly TextSpan[];
} => !!element.spans?.length;

/** the CSS/canvas font for a piece of text styled `style` */
export const getTextSegmentFontString = (
  base: { fontSize: number; fontFamily: FontFamilyValues },
  style: TextSpanStyle,
) => {
  return `${style.italic ? "italic " : ""}${style.bold ? "bold " : ""}${
    style.fontSize ?? base.fontSize
  }px ${getFontFamilyString({
    fontFamily: style.fontFamily ?? base.fontFamily,
  })}` as FontString;
};

export const textSpansEqual = (
  a: readonly TextSpan[] | null | undefined,
  b: readonly TextSpan[] | null | undefined,
) => {
  const left = a ?? [];
  const right = b ?? [];
  return (
    left.length === right.length &&
    left.every(
      (span, index) =>
        span.start === right[index].start &&
        span.end === right[index].end &&
        textSpanStylesEqual(span, right[index]),
    )
  );
};

/**
 * Maps each line of a wrapped `text` back to its offsets in `originalText`.
 *
 * Wrapping only inserts line breaks and drops whitespace at soft breaks, so
 * walking both strings in step recovers the mapping without re-measuring.
 */
export const getWrappedLineOffsets = (
  text: string,
  originalText: string,
): { text: string; start: number; end: number }[] => {
  const lines = text.split("\n");
  const result: { text: string; start: number; end: number }[] = [];
  let cursor = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    // skip whitespace / the line break the wrap consumed before this line
    if (index > 0) {
      if (originalText[cursor] === "\n") {
        cursor++;
      } else {
        while (
          cursor < originalText.length &&
          originalText[cursor] !== line[0] &&
          /\s/.test(originalText[cursor])
        ) {
          cursor++;
        }
      }
    }
    const start = cursor;
    let matched = 0;
    while (
      matched < line.length &&
      cursor < originalText.length &&
      originalText[cursor] === line[matched]
    ) {
      cursor++;
      matched++;
    }
    result.push({ text: line, start, end: start + matched });
    // the line didn't map cleanly (text out of sync with originalText):
    // stop mapping, the rest renders with the base style
    if (matched < line.length) {
      for (let rest = index + 1; rest < lines.length; rest++) {
        result.push({ text: lines[rest], start: cursor, end: cursor });
      }
      break;
    }
  }
  return result;
};
