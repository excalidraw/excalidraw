import {
  COLOR_PALETTE,
  DEFAULT_FONT_FAMILY,
  FONT_FAMILY,
  getFontString,
  getLineHeight,
} from "@excalidraw/common";

import {
  getLineHeightInPx,
  measureText,
  normalizeText,
  newElement,
  newLinearElement,
  newTextElement,
} from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawTextElement,
  FontString,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

/**
 * Minimal, dependency-free Markdown renderer for pasted text.
 *
 * Excalidraw pastes text as plain strings, so copying a Markdown document
 * shows the raw syntax (##, *, |, fences ...). This module detects Markdown
 * structure and turns it into a flowed column of styled text elements, all
 * using the handwritten font by default so pasted notes keep the sketchy look.
 *
 * It intentionally does NOT try to be a full Markdown implementation: every
 * block becomes at least one text element, each element carries a single
 * style, so mixed inline styles (bold + italic in one line) are rendered as
 * their bare text with the surrounding block style. Structure (headings,
 * lists, code, quotes) is preserved and the markers are stripped.
 */

const LIMIT = {
  // longest content-width we'll still render, mirrors addTextFromPaste
  maxWidth: 800,
} as const;

const FONT_SIZE = {
  h1: 32,
  h2: 28,
  h3: 24,
  body: 20,
  code: 16,
} as const;

const LINE_GAP = 10;
const CODE_PADDING = 12;

const STYLE = {
  body: {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: FONT_SIZE.body,
    strokeColor: COLOR_PALETTE.black,
  },
  h1: {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: FONT_SIZE.h1,
    strokeColor: COLOR_PALETTE.black,
  },
  h2: {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: FONT_SIZE.h2,
    strokeColor: COLOR_PALETTE.black,
  },
  h3: {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: FONT_SIZE.h3,
    strokeColor: COLOR_PALETTE.black,
  },
  quote: {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: FONT_SIZE.body,
    strokeColor: COLOR_PALETTE.gray[3],
  },
  code: {
    fontFamily: FONT_FAMILY.Cascadia,
    fontSize: FONT_SIZE.code,
    strokeColor: COLOR_PALETTE.black,
  },
} as const;

type Block =
  | { type: "blank" }
  | { type: "h1" | "h2" | "h3"; content: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; content: string }
  | { type: "code"; content: string }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "hr" }
  | { type: "text"; content: string };

const HEADING_RE = /^(#{1,4})\s+(.*)$/;

const isHeading = (line: string) => HEADING_RE.test(line);

const isCodeFence = (line: string) => /^```/.test(line) || /^~~~/.test(line);

const isHr = (line: string) => /^([-*_])\s*(\1\s*){2,}$/.test(line.trim());

const isListItem = (line: string) =>
  /^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line);

const isBlockquote = (line: string) => /^\s*>\s?/.test(line);

const stripHeading = (line: string): { level: 1 | 2 | 3; text: string } => {
  const m = HEADING_RE.exec(line)!;
  return { level: Math.min(m[1].length, 3) as 1 | 2 | 3, text: m[2] };
};

const stripListMarker = (line: string): string =>
  line.replace(/^\s*[-*+]\s+/, "").replace(/^\s*\d+[.)]\s+/, "");

const stripQuote = (line: string): string =>
  line.replace(/^\s*>\s?/, "").replace(/^>\s?/, "");

/**
 * Inline Markdown is reduced to plain text (markers stripped, no element
 * splitting). Keeping this one expression in one place makes it easy to see
 * what a pasted block will actually render as.
 */
const stripInline = (text: string): string =>
  text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1");

const stripInlineAll = (text: string): string =>
  text
    .split("\n")
    .map(stripInline)
    .join("\n");

/**
 * Heuristic guard so plain paragraphs are NOT treated as Markdown. A pasted
 * blob is considered Markdown only when it visibly uses structural syntax:
 * a heading, a list marker, a blockquote, a code fence, a table or an
 * horizontal rule on its own line. This keeps normal text paste behavior
 * identical to stock Excalidraw.
 */
export const isMaybeMarkdown = (text: string): boolean => {
  const lines = normalizeText(text).split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (isHeading(trimmed)) {
      return true;
    }
    if (isCodeFence(trimmed)) {
      return true;
    }
    if (isHr(trimmed)) {
      return true;
    }
    if (isListItem(trimmed)) {
      return true;
    }
    if (isBlockquote(trimmed)) {
      return true;
    }
    if (/^\|?[\s:|-]+\|?$/.test(trimmed) && trimmed.includes("-")) {
      return true;
    }
  }
  return false;
};

const parseBlocks = (text: string): Block[] => {
  const lines = normalizeText(text).split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      blocks.push({ type: "blank" });
      i++;
      continue;
    }

    if (isHeading(trimmed)) {
      const { level, text } = stripHeading(trimmed);
      blocks.push({ type: `h${level}` as "h1" | "h2" | "h3", content: stripInline(text) });
      i++;
      continue;
    }

    if (isCodeFence(trimmed)) {
      const fence = trimmed.startsWith("```") ? "```" : "~~~";
      i++;
      const code: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith(fence)) {
        code.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        i++;
      }
      blocks.push({ type: "code", content: code.join("\n") });
      continue;
    }

    if (isBlockquote(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length && isBlockquote(lines[i])) {
        quoteLines.push(stripQuote(lines[i]));
        i++;
      }
      blocks.push({ type: "quote", content: stripInlineAll(quoteLines.join("\n")) });
      continue;
    }

    if (isHr(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (isListItem(trimmed)) {
      const items: string[] = [];
      const ordered = /^\s*\d+[.)]\s+/.test(trimmed);
      while (i < lines.length && isListItem(lines[i])) {
        items.push(stripInline(stripListMarker(lines[i])));
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // table: a heading row followed by a separator row
    const isTableSeparatorAfter = (idx: number) => {
      const next = (lines[idx + 1] || "").trim();
      return /^\|?[\s:|-]+\|?$/.test(next) && next.includes("-");
    };
    if (/^\|.*\|$/.test(trimmed) && isTableSeparatorAfter(i)) {
      const header = parseTableRow(trimmed);
      const colCount = header.length;
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = parseTableRow(lines[i]);
        const padded = Array.from({ length: colCount }, (_, c) => cells[c] ?? "");
        rows.push(padded);
        i++;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    // paragraph: consume consecutive non-empty, non-structural lines
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isHeading(lines[i].trim()) &&
      !isCodeFence(lines[i].trim()) &&
      !isBlockquote(lines[i].trim()) &&
      !isHr(lines[i].trim()) &&
      !isListItem(lines[i].trim()) &&
      !/^\|.*\|$/.test(lines[i].trim())
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ type: "text", content: stripInlineAll(para.join("\n").trim()) });
  }

  return blocks;
};

const parseTableRow = (line: string): string[] => {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|").map((cell) => stripInline(cell.trim()));
};

const getBlockStyle = (block: Block): (typeof STYLE)[keyof typeof STYLE] => {
  switch (block.type) {
    case "h1":
    case "h2":
    case "h3":
      return STYLE[block.type];
    case "quote":
      return STYLE.quote;
    case "code":
      return STYLE.code;
    default:
      return STYLE.body;
  }
};

const wrapIfNeeded = (
  text: string,
  fontString: FontString,
  lineHeight: ExcalidrawTextElement["lineHeight"],
  maxWidth: number,
): { content: string; wrapped: boolean } => {
  if (measureText(text, fontString, lineHeight).width <= maxWidth) {
    return { content: text, wrapped: false };
  }
  const words = text.split(" ");
  if (words.length <= 1) {
    return { content: text, wrapped: false };
  }
  let current = "";
  let result = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureText(candidate, fontString, lineHeight).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        result += `${current}\n`;
      }
      current = word;
    }
  }
  if (current) {
    result += current;
  }
  return { content: result, wrapped: true };
};

// number of rendered lines for a (possibly multi-line) string
const codeLinesCount = (text: string): number =>
  text.split("\n").length;

const pushTextElement = (
  acc: NonDeletedExcalidrawElement[],
  opts: {
    text: string;
    x: number;
    y: number;
    style: (typeof STYLE)[keyof typeof STYLE];
    maxWidth: number;
  },
): number => {
  const { text, x, y, style, maxWidth } = opts;
  if (!text.trim()) {
    return y;
  }
  const fontString = getFontString({
    fontSize: style.fontSize,
    fontFamily: style.fontFamily,
  });
  const lineHeight = getLineHeight(style.fontFamily);
  let metrics = measureText(text, fontString, lineHeight);
  const { content, wrapped } = wrapIfNeeded(text, fontString, lineHeight, maxWidth);
  metrics = wrapped ? measureText(content, fontString, lineHeight) : metrics;

  const element = newTextElement({
    x,
    y,
    text: content,
    originalText: normalizeText(text),
    fontSize: style.fontSize,
    fontFamily: style.fontFamily,
    textAlign: "left",
    verticalAlign: "top",
    strokeColor: style.strokeColor,
    lineHeight,
    autoResize: !wrapped,
  });

  acc.push(element);
  return y + element.height + LINE_GAP;
};

/**
 * Convert a Markdown string into an array of elements laid out in a vertical
 * flow, starting at (x, y) as the top-left anchor. The caller decides what to
 * do with them (paste, drop, ...).
 */
export const convertMarkdownToElements = (
  text: string,
  x: number,
  y: number,
): NonDeletedExcalidrawElement[] => {
  const blocks = parseBlocks(text);
  const elements: NonDeletedExcalidrawElement[] = [];
  let cursorY = y;
  let cursorX = x;

  const pushCodeBlock = (code: string) => {
    const style = STYLE.code;
    const fontString = getFontString({
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
    });
    const lineHeight = getLineHeight(style.fontFamily);
    const lineHeightPx = getLineHeightInPx(style.fontSize, lineHeight);

    // wrap every line to the max width before measuring the box
    const wrappedLines = code.split("\n").map((line) => {
      const { content } = wrapIfNeeded(
        line,
        fontString,
        lineHeight,
        LIMIT.maxWidth,
      );
      return content;
    });

    let boxWidth = CODE_PADDING * 2;
    let boxHeight = CODE_PADDING * 2;
    for (const wrappedLine of wrappedLines) {
      const metrics = measureText(wrappedLine, fontString, lineHeight);
      boxWidth = Math.max(boxWidth, metrics.width + CODE_PADDING * 2);
      boxHeight = Math.max(
        boxHeight,
        codeLinesCount(wrappedLine) * lineHeightPx + CODE_PADDING * 2,
      );
    }

    const box = newElement({
      type: "rectangle",
      x: cursorX - CODE_PADDING,
      y: cursorY - CODE_PADDING,
      width: boxWidth,
      height: boxHeight,
      strokeColor: COLOR_PALETTE.gray[2],
      backgroundColor: COLOR_PALETTE.gray[0],
      fillStyle: "solid",
      roughness: 1,
    });
    elements.push(box);

    let innerY = cursorY;
    for (const wrappedLine of wrappedLines) {
      const element = newTextElement({
        x: cursorX,
        y: innerY,
        text: wrappedLine,
        originalText: normalizeText(wrappedLine),
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
        textAlign: "left",
        verticalAlign: "top",
        strokeColor: style.strokeColor,
        lineHeight,
        autoResize: false,
      });
      elements.push(element);
      innerY += element.height + 4;
    }

    cursorY = cursorY + boxHeight + LINE_GAP;
  };

  const pushTableElement = (
    table: { header: string[]; rows: string[][] },
    tableX: number,
    tableY: number,
  ): number => {
    const cellStyle = STYLE.body;
    const fontString = getFontString({
      fontSize: cellStyle.fontSize,
      fontFamily: cellStyle.fontFamily,
    });
    const lineHeight = getLineHeight(cellStyle.fontFamily);
    const fontSizePx = getLineHeightInPx(cellStyle.fontSize, lineHeight);

    const PAD_X = 12;
    const PAD_Y = 8;

    // column widths: measure every cell, take the max, cap total at maxWidth
    const colCount = table.header.length;
    const colWidths = Array.from({ length: colCount }, (_, c) => {
      const cells = [table.header[c], ...table.rows.map((r) => r[c])];
      const widest = cells.reduce((max, cell) => {
        const measured = measureText(normalizeText(cell), fontString, lineHeight).width;
        return Math.max(max, measured);
      }, 0);
      return Math.min(widest + PAD_X * 2, LIMIT.maxWidth);
    });
    const totalWidth = Math.min(
      colWidths.reduce((acc, w) => acc + w, 0),
      LIMIT.maxWidth,
    );

    // row heights: header + each data row
    const rowHeights = [table.header, ...table.rows].map((row) => {
      let textHeight = 0;
      for (const cell of row) {
        const measured = measureText(normalizeText(cell), fontString, lineHeight).height;
        textHeight = Math.max(textHeight, measured);
      }
      return Math.max(textHeight + PAD_Y * 2, fontSizePx + PAD_Y * 2);
    });
    const totalHeight = rowHeights.reduce((acc, h) => acc + h, 0);

    const tableRect = newElement({
      type: "rectangle",
      x: tableX,
      y: tableY,
      width: totalWidth,
      height: totalHeight,
      strokeColor: COLOR_PALETTE.black,
      backgroundColor: "transparent",
      fillStyle: "solid",
      roughness: 1,
    });
    elements.push(tableRect);

    // draw vertical column separators
    let runningColX = tableX;
    for (let c = 0; c < colCount - 1; c++) {
      runningColX += colWidths[c];
      if (runningColX > tableX + totalWidth) {
        break;
      }
      const line = newLinearElement({
        type: "line",
        x: runningColX,
        y: tableY,
        points: [pointFrom(0, 0), pointFrom(0, totalHeight)],
        strokeColor: COLOR_PALETTE.gray[2],
        strokeWidth: 1,
        fillStyle: "solid",
        roughness: 1,
      });
      elements.push(line);
    }

    // place cell text and draw horizontal row separators
    let runningRowY = tableY;
    for (let r = 0; r < rowHeights.length; r++) {
      const cells =
        r === 0 ? table.header : table.rows[r - 1];
      const rowH = rowHeights[r];
      const isHeader = r === 0;

      // header fill
      if (isHeader) {
        const headerFill = newElement({
          type: "rectangle",
          x: tableX,
          y: runningRowY,
          width: totalWidth,
          height: rowH,
          strokeColor: "transparent",
          backgroundColor: COLOR_PALETTE.gray[0],
          fillStyle: "solid",
          roughness: 1,
        });
        elements.push(headerFill);
      }

      // cell text
      let cellX = tableX;
      for (let c = 0; c < colCount; c++) {
        const cellText = normalizeText(cells[c]);
        const cellW = colWidths[c];
        const cellElement = newTextElement({
          x: cellX + PAD_X,
          y: runningRowY + PAD_Y,
          text: cellText,
          originalText: cellText,
          fontSize: cellStyle.fontSize,
          fontFamily: cellStyle.fontFamily,
          textAlign: "left",
          verticalAlign: "top",
          strokeColor: isHeader ? COLOR_PALETTE.black : COLOR_PALETTE.black,
          fillStyle: "solid",
          lineHeight,
          autoResize: false,
        });
        elements.push(cellElement);
        cellX += cellW;
      }

      // horizontal separator below every row
      if (r < rowHeights.length - 1) {
        const bottomY = runningRowY + rowH;
        const hLine = newLinearElement({
          type: "line",
          x: tableX,
          y: bottomY,
          points: [pointFrom(0, 0), pointFrom(totalWidth, 0)],
          strokeColor: COLOR_PALETTE.gray[2],
          strokeWidth: 1,
          fillStyle: "solid",
          roughness: 1,
        });
        elements.push(hLine);
      }

      runningRowY += rowH;
    }

    return tableY + totalHeight + LINE_GAP;
  };

  for (const block of blocks) {
    if (block.type === "blank") {
      cursorY += 20;
      continue;
    }
    if (block.type === "hr") {
      cursorY += 16;
      continue;
    }
    if (block.type === "code") {
      pushCodeBlock(block.content);
      continue;
    }
    if (block.type === "table") {
      cursorY = pushTableElement(block, cursorX, cursorY);
      continue;
    }
    if (block.type === "list") {
      if (block.ordered) {
        block.items.forEach((item, idx) => {
          cursorY = pushTextElement(elements, {
            text: `${idx + 1}. ${item}`,
            x: cursorX,
            y: cursorY,
            style: STYLE.body,
            maxWidth: LIMIT.maxWidth,
          });
        });
      } else {
        for (const item of block.items) {
          cursorY = pushTextElement(elements, {
            text: `• ${item}`,
            x: cursorX,
            y: cursorY,
            style: STYLE.body,
            maxWidth: LIMIT.maxWidth,
          });
        }
      }
      cursorY += LINE_GAP;
      continue;
    }

    const style = getBlockStyle(block);
    cursorY = pushTextElement(elements, {
      text: block.content,
      x: cursorX,
      y: cursorY,
      style,
      maxWidth: LIMIT.maxWidth,
    });
    cursorY += LINE_GAP;
  }

  return elements;
};
