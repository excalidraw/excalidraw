/**
 * Markdown-style lists in text elements.
 *
 * The element's `originalText` / `text` keep exactly what the user typed
 * (`- item`, `1. item`, indented with spaces or tabs). Only the layout and
 * the rendering treat such lines as list items:
 *
 * - the `-` marker is drawn as a bullet (`•`, `◦`, `▪` by nesting level),
 *   ordered markers (`4.`) are drawn as typed,
 * - nested items are shifted right by their level,
 * - lines an item wraps into hang aligned with the item's text, not with its
 *   marker.
 *
 * The wrapped `text` keeps each item's raw prefix (indentation, marker and
 * the whitespace after it) on the item's first line, so that it still maps
 * back to `originalText` (see `getWrappedLineOffsets`).
 */
import { isRTL } from "@excalidraw/common";

import { getWrappedLineOffsets } from "./textSpans";

/**
 * `- item` or `4. item`: optional indentation, the marker, then at least one
 * space or tab (`-item` or `4.5` aren't list items). The item's content may
 * be empty (`- `), which is what the editor exits a list on.
 */
export const MARKDOWN_LIST_ITEM_REGEX = /^([ \t]*)(?:(-)|(\d{1,9})\.)([ \t]+)/;

/** columns a tab counts for, when comparing indentations */
export const LIST_TAB_SIZE = 4;

/** how far right each nesting level shifts an item, in em */
export const LIST_LEVEL_INDENT_EM = 1.25;

/** the space between a marker and the item's text, in em */
export const LIST_MARKER_GAP_EM = 0.35;

/** the narrowest a marker's box is (so that bullets line up nicely), in em */
export const LIST_MARKER_MIN_WIDTH_EM = 0.65;

/** the `-` marker's bullet, by nesting level (cycling) */
export const LIST_BULLETS = ["•", "◦", "▪"] as const;

export type MarkdownListItemKind = "unordered" | "ordered";

/** a list item a single line starts with (no nesting context) */
export type MarkdownListMarker = {
  kind: MarkdownListItemKind;
  /** the leading whitespace, as typed */
  indent: string;
  /** the indentation in columns (tabs count `LIST_TAB_SIZE`) */
  indentColumns: number;
  /** the marker as typed: `-` or e.g. `4.` */
  marker: string;
  /** the typed number of an ordered item (with zero padding, e.g. `01`) */
  number: string | null;
  /** where the item's content (after the marker and whitespace) starts */
  contentStart: number;
};

/** a list item in the context of the lines before it */
export type MarkdownListItem = MarkdownListMarker & {
  /** 0 for a top-level item */
  level: number;
  /** what's drawn in place of the marker: a bullet, or the typed number */
  displayMarker: string;
};

const getIndentColumns = (indent: string) => {
  let columns = 0;
  for (const char of indent) {
    columns =
      char === "\t"
        ? // a tab advances to the next tab stop
          (Math.floor(columns / LIST_TAB_SIZE) + 1) * LIST_TAB_SIZE
        : columns + 1;
  }
  return columns;
};

/** @returns the list item marker a (hard) line starts with, if any */
export const parseMarkdownListMarker = (
  line: string,
): MarkdownListMarker | null => {
  const match = line.match(MARKDOWN_LIST_ITEM_REGEX);
  if (!match) {
    return null;
  }
  const [whole, indent, dash, number] = match;
  return {
    kind: dash ? "unordered" : "ordered",
    indent,
    indentColumns: getIndentColumns(indent),
    marker: dash ?? `${number}.`,
    number: number ?? null,
    contentStart: whole.length,
  };
};

export const getListDisplayMarker = (
  marker: Pick<MarkdownListMarker, "kind" | "marker">,
  level: number,
) =>
  marker.kind === "unordered"
    ? LIST_BULLETS[level % LIST_BULLETS.length]
    : marker.marker;

/**
 * Parses each hard line (split on `\n`) of a text into its list item, if
 * it's one, with its nesting level.
 *
 * The level is relative, as in Markdown: an item indented more than the item
 * before it nests under it, so both 2 and 4 space (or tab) indentation work.
 * An item indented less goes back to the level of the closest item before it
 * that isn't indented more. A line that's not a list item (other than an
 * empty one) ends the list.
 *
 * Right-to-left texts don't get list layout (as with rich text, the browser's
 * bidi layout of the whole line is needed to draw them).
 *
 * @returns `null` when no line is a list item
 */
export const parseMarkdownListLines = (
  text: string,
): (MarkdownListItem | null)[] | null => {
  // fast path: nothing that looks like a marker at a line start
  if (!/(?:^|\n)[ \t]*(?:-|\d{1,9}\.)[ \t]/.test(text) || isRTL(text)) {
    return null;
  }

  /** the indentation columns of the open (ancestor) items, innermost last */
  const stack: number[] = [];
  let hasItems = false;

  const items = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line): MarkdownListItem | null => {
      const marker = parseMarkdownListMarker(line);
      if (!marker) {
        if (line.trim()) {
          stack.length = 0;
        }
        return null;
      }
      hasItems = true;
      while (stack.length && stack[stack.length - 1] >= marker.indentColumns) {
        stack.pop();
      }
      // (an item indented as much as an ancestor's sibling is that sibling)
      const level = stack.length;
      stack.push(marker.indentColumns);
      return {
        ...marker,
        level,
        displayMarker: getListDisplayMarker(marker, level),
      };
    });

  return hasItems ? items : null;
};

/** where a list item's marker and text go, in px from the line's start */
export type ListItemMetrics = {
  markerX: number;
  contentX: number;
};

/**
 * @param measure the width of the marker in the text's font
 */
export const getListItemMetrics = (
  item: Pick<MarkdownListItem, "level" | "displayMarker">,
  fontSize: number,
  measure: (text: string) => number,
): ListItemMetrics => {
  const markerX = item.level * LIST_LEVEL_INDENT_EM * fontSize;
  const markerWidth = Math.max(
    measure(item.displayMarker),
    LIST_MARKER_MIN_WIDTH_EM * fontSize,
  );
  return {
    markerX,
    contentX: markerX + markerWidth + LIST_MARKER_GAP_EM * fontSize,
  };
};

/** how a (wrapped) line of a text is laid out as part of a list item */
export type ListLineLayout = ListItemMetrics & {
  /** the item, if this line is the item's first (the one with its marker) */
  item: MarkdownListItem | null;
  /**
   * where the drawn text starts in the line: after the raw marker prefix on
   * an item's first line, 0 on the lines the item wrapped into
   */
  textStart: number;
};

/**
 * Lays out the (wrapped) lines of a text element: for each line of `text`,
 * how it's laid out as part of a list item, or `null` for a regular line.
 *
 * @param text the wrapped text (`element.text`)
 * @param originalText the text as typed (`element.originalText`)
 * @param measure the width of a marker in the text's font
 * @returns `null` when the text has no list items
 */
export const getListLineLayouts = (
  text: string,
  originalText: string,
  fontSize: number,
  measure: (text: string) => number,
): (ListLineLayout | null)[] | null => {
  const normalizedOriginal = originalText.replace(/\r\n?/g, "\n");
  const items = parseMarkdownListLines(normalizedOriginal);
  if (!items) {
    return null;
  }

  const lines = getWrappedLineOffsets(
    text.replace(/\r\n?/g, "\n"),
    normalizedOriginal,
  );

  let hardLineIndex = -1;
  let current: ListItemMetrics | null = null;

  return lines.map((line, index) => {
    const startsHardLine =
      index === 0 ||
      line.start === 0 ||
      normalizedOriginal[line.start - 1] === "\n";
    if (startsHardLine) {
      hardLineIndex++;
      const item = items[hardLineIndex] ?? null;
      // the item's raw prefix must be on this line as is (it would not be
      // with a text wrapped by other means)
      if (
        !item ||
        line.end - line.start < item.contentStart ||
        !line.text.startsWith(
          normalizedOriginal.slice(line.start, line.start + item.contentStart),
        )
      ) {
        current = null;
        return null;
      }
      current = getListItemMetrics(item, fontSize, measure);
      return { ...current, item, textStart: item.contentStart };
    }
    return current ? { ...current, item: null, textStart: 0 } : null;
  });
};

/**
 * The text a wrapped line draws (without an item's raw marker prefix) and
 * where it starts, in px from the line's start.
 */
export const getListLineContent = (
  lineText: string,
  layout: ListLineLayout | null,
) =>
  layout
    ? { text: lineText.slice(layout.textStart), x: layout.contentX }
    : { text: lineText, x: 0 };

/** where a line of the given width starts, as per the text's alignment */
export const getAlignedLineX = (
  textAlign: string,
  width: number,
  lineWidth: number,
) =>
  textAlign === "center"
    ? (width - lineWidth) / 2
    : textAlign === "right"
    ? width - lineWidth
    : 0;

/**
 * Where each (wrapped) line of a text starts, as per the text's alignment.
 *
 * A run of list lines (items and the lines they wrap into) is aligned as one
 * block, as wide as its widest line, so that in a centered or right-aligned
 * text the markers still line up, nested items still shift right and wrapped
 * lines still hang with their item's text. Other lines align on their own.
 *
 * @param lines each line's width (including a list line's `contentX`), and
 *              whether it's part of a list
 */
export const getAlignedLineXs = (
  lines: readonly { width: number; isListLine: boolean }[],
  textAlign: string,
  width: number,
): number[] => {
  const xs: number[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].isListLine) {
      xs.push(getAlignedLineX(textAlign, width, lines[index].width));
      index++;
      continue;
    }
    let end = index;
    let blockWidth = 0;
    while (end < lines.length && lines[end].isListLine) {
      blockWidth = Math.max(blockWidth, lines[end].width);
      end++;
    }
    const x = getAlignedLineX(textAlign, width, blockWidth);
    for (; index < end; index++) {
      xs.push(x);
    }
  }
  return xs;
};

// -----------------------------------------------------------------------------
// editor: continuing lists on Enter
// -----------------------------------------------------------------------------

export type ListContinuation =
  /** replace `[start, end)` with `text`, putting the caret after it */
  { start: number; end: number; text: string };

/**
 * What pressing Enter at `caret` in a list item does:
 *
 * - in a non-empty item (at its end, or splitting it), a new item starts on
 *   the next line, at the same indentation: `- ` for an unordered list,
 *   `N+1. ` for an ordered one (keeping zero padding: `09.` → `10.`),
 * - in an empty item (just its marker), the marker is removed, ending the
 *   list.
 *
 * @returns `null` when Enter should just break the line (the caret isn't
 *          past a list item's marker)
 */
export const getListContinuation = (
  value: string,
  caret: number,
): ListContinuation | null => {
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  const nextBreak = value.indexOf("\n", caret);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const line = value.slice(lineStart, lineEnd);

  const marker = parseMarkdownListMarker(line);
  if (!marker || caret - lineStart < marker.contentStart) {
    return null;
  }

  // empty item: exit the list
  if (!line.slice(marker.contentStart).trim()) {
    return { start: lineStart, end: lineEnd, text: "" };
  }

  let nextMarker = "-";
  if (marker.kind === "ordered" && marker.number !== null) {
    const next = String(parseInt(marker.number, 10) + 1);
    nextMarker = `${next.padStart(marker.number.length, "0")}.`;
  }

  return {
    start: caret,
    end: caret,
    text: `\n${marker.indent}${nextMarker} `,
  };
};
