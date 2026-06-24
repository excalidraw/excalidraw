/**
 * Code block support: a code block is modelled as a regular rectangle container
 * with a bound monospace text element. Both carry `customData.codeBlock` so the
 * renderer can syntax-highlight the text on canvas (and in SVG export).
 *
 * Highlighting is done by tokenizing the source with Prism and drawing each
 * token run in its theme color. We intentionally only bundle a curated set of
 * languages to keep the bundle small.
 */
import {
  FONT_FAMILY,
  FONT_SIZES,
  getFontString,
  getLineHeight,
} from "@excalidraw/common";

import Prism from "prismjs";

// NOTE: order matters — a language component must be imported after the
// languages it extends (clike/javascript/markup are bundled with prism core).
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-python";
import "prismjs/components/prism-java";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";

import {
  getLineHeightInPx,
  getLineWidth,
  measureText,
} from "./textMeasurements";

import type { ExcalidrawElement, ExcalidrawTextElement } from "./types";

export type CodeBlockTheme = "light" | "dark";

export type CodeBlockMeta = {
  language: string;
  /**
   * @deprecated colors now follow the live app theme at render time; retained
   * for backwards compatibility with previously-created blocks.
   */
  theme?: CodeBlockTheme;
  showLineNumbers?: boolean;
  /** wrap long lines to fit the block's width instead of overflowing it */
  wrap?: boolean;
};

export const DEFAULT_CODE_BLOCK_LANGUAGE = "javascript";
export const DEFAULT_CODE_BLOCK_THEME: CodeBlockTheme = "dark";

/** font size (px) used for the bound code text element */
export const CODE_BLOCK_FONT_SIZE = 16;
/** inner padding (px) between the container edge and the code text */
export const CODE_BLOCK_PADDING = 12;
/** tabs are expanded to this many spaces so monospace columns line up */
export const CODE_BLOCK_TAB_SIZE = 2;

/** Languages offered in the UI (value is the canonical Prism-compatible id). */
export const CODE_BLOCK_LANGUAGES: { value: string; label: string }[] = [
  { value: "plaintext", label: "Plain Text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "jsx", label: "JSX" },
  { value: "tsx", label: "TSX" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "css", label: "CSS" },
  { value: "html", label: "HTML" },
  { value: "json", label: "JSON" },
  { value: "bash", label: "Bash" },
];

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  node: "javascript",
  ts: "typescript",
  py: "python",
  py3: "python",
  python3: "python",
  "c++": "cpp",
  cc: "cpp",
  h: "c",
  hpp: "cpp",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  markup: "html",
  xml: "html",
  htm: "html",
  text: "plaintext",
  txt: "plaintext",
  plain: "plaintext",
};

/** Normalize a loose language id (e.g. from a paste) to a canonical id. */
export const normalizeCodeLanguage = (language?: string | null): string => {
  const lang = (language || "").trim().toLowerCase();
  if (!lang) {
    return DEFAULT_CODE_BLOCK_LANGUAGE;
  }
  const normalized = LANGUAGE_ALIASES[lang] ?? lang;
  return CODE_BLOCK_LANGUAGES.some((l) => l.value === normalized)
    ? normalized
    : "plaintext";
};

/** Maps a canonical language id to the Prism grammar key. */
const getPrismGrammar = (language: string): Prism.Grammar | null => {
  const key = language === "html" ? "markup" : language;
  return (
    (Prism.languages as Record<string, Prism.Grammar | undefined>)[key] ?? null
  );
};

// --- token color themes (approx. VS Code Dark+ / Light+) ---------------------

type TokenTheme = {
  background: string;
  foreground: string;
  colors: Record<string, string>;
};

export const CODE_BLOCK_THEMES: Record<CodeBlockTheme, TokenTheme> = {
  dark: {
    background: "#1e1e1e",
    foreground: "#d4d4d4",
    colors: {
      comment: "#6a9955",
      prolog: "#6a9955",
      doctype: "#6a9955",
      cdata: "#6a9955",
      keyword: "#569cd6",
      "control-flow": "#c586c0",
      boolean: "#569cd6",
      constant: "#569cd6",
      number: "#b5cea8",
      string: "#ce9178",
      char: "#ce9178",
      "template-string": "#ce9178",
      "attr-value": "#ce9178",
      function: "#dcdcaa",
      "class-name": "#4ec9b0",
      builtin: "#4ec9b0",
      property: "#9cdcfe",
      "attr-name": "#9cdcfe",
      variable: "#9cdcfe",
      parameter: "#9cdcfe",
      tag: "#569cd6",
      selector: "#d7ba7d",
      regex: "#d16969",
      operator: "#d4d4d4",
      punctuation: "#d4d4d4",
    },
  },
  light: {
    background: "#f6f8fa",
    foreground: "#1f2328",
    colors: {
      comment: "#008000",
      prolog: "#008000",
      doctype: "#008000",
      cdata: "#008000",
      keyword: "#0000ff",
      "control-flow": "#af00db",
      boolean: "#0000ff",
      constant: "#0000ff",
      number: "#098658",
      string: "#a31515",
      char: "#a31515",
      "template-string": "#a31515",
      "attr-value": "#0000ff",
      function: "#795e26",
      "class-name": "#267f99",
      builtin: "#267f99",
      property: "#001080",
      "attr-name": "#e50000",
      variable: "#001080",
      parameter: "#001080",
      tag: "#800000",
      selector: "#800000",
      regex: "#811f3f",
      operator: "#1f2328",
      punctuation: "#1f2328",
    },
  },
};

/** border color for the container rectangle, per theme */
export const getCodeBlockBorderColor = (theme: CodeBlockTheme): string =>
  theme === "dark" ? "#3c3c3c" : "#d0d7de";

/** font string for the bound code text element */
export const getCodeBlockFontString = (
  fontSize: number = CODE_BLOCK_FONT_SIZE,
) =>
  getFontString({
    fontFamily: FONT_FAMILY.Cascadia,
    fontSize,
  });

/** Hard-wraps a single plain-text line into chunks of at most `maxChars` columns. */
const wrapPlainLine = (line: string, maxChars: number): string[] => {
  if (line.length <= maxChars) {
    return [line];
  }
  const chunks: string[] = [];
  for (let i = 0; i < line.length; i += maxChars) {
    chunks.push(line.slice(i, i + maxChars));
  }
  return chunks;
};

/** Number of visual lines `text` would occupy once wrapped at `maxChars` columns. */
export const countWrappedLines = (text: string, maxChars: number): number => {
  if (maxChars <= 0) {
    return text.split("\n").length;
  }
  return text
    .split("\n")
    .reduce((count, line) => count + wrapPlainLine(line, maxChars).length, 0);
};

/**
 * measured width/height of normalized code at the given font size.
 * When `wrap` + `maxWidth` are provided, height accounts for lines wrapping
 * to fit `maxWidth` instead of overflowing it.
 */
export const measureCodeBlockText = (
  code: string,
  opts?: { fontSize?: number; wrap?: boolean; maxWidth?: number },
): { width: number; height: number } => {
  const fontSize = opts?.fontSize ?? CODE_BLOCK_FONT_SIZE;
  const font = getCodeBlockFontString(fontSize);
  const normalized = normalizeCodeText(code) || " ";
  const lineHeight = getLineHeight(FONT_FAMILY.Cascadia);

  if (opts?.wrap && opts.maxWidth) {
    const charWidth = getLineWidth("M", font) || fontSize * 0.6;
    const maxChars = Math.max(1, Math.floor(opts.maxWidth / charWidth));
    const lineCount = countWrappedLines(normalized, maxChars);
    return {
      width: opts.maxWidth,
      height: lineCount * getLineHeightInPx(fontSize, lineHeight),
    };
  }

  return measureText(normalized, font, lineHeight);
};

/** discrete font sizes a wrapped code block snaps to on vertical/diagonal resize */
export const CODE_BLOCK_FONT_SIZE_STEPS = [
  FONT_SIZES.sm,
  FONT_SIZES.md,
  FONT_SIZES.lg,
  FONT_SIZES.xl,
];

/**
 * Picks the largest discrete font size (from ascending `steps`) whose
 * wrapped content still fits within `availableHeight` at `availableWidth`.
 * Falls back to the smallest step if even that overflows, so callers can
 * clamp the block to that minimum instead of clipping the code.
 */
export const fitCodeBlockFontSize = (
  code: string,
  availableWidth: number,
  availableHeight: number,
  steps: readonly number[] = CODE_BLOCK_FONT_SIZE_STEPS,
): { fontSize: number; width: number; height: number } => {
  const firstStep = steps[0] ?? CODE_BLOCK_FONT_SIZE;
  let fontSize = firstStep;
  let metrics = measureCodeBlockText(code, {
    fontSize,
    wrap: true,
    maxWidth: availableWidth,
  });

  for (let i = 1; i < steps.length; i++) {
    const candidate = steps[i];
    const candidateMetrics = measureCodeBlockText(code, {
      fontSize: candidate,
      wrap: true,
      maxWidth: availableWidth,
    });
    if (candidateMetrics.height > availableHeight) {
      break;
    }
    fontSize = candidate;
    metrics = candidateMetrics;
  }

  return { fontSize, width: metrics.width, height: metrics.height };
};

/** Expand tabs and strip trailing blank lines so the block sizes tightly. */
export const normalizeCodeText = (code: string): string =>
  code.replace(/\t/g, " ".repeat(CODE_BLOCK_TAB_SIZE)).replace(/\s+$/, "");

export type CodeRun = { text: string; color: string };
export type CodeLine = CodeRun[];

const colorForType = (
  type: string | undefined,
  theme: TokenTheme,
): string | undefined => (type ? theme.colors[type] : undefined);

const flattenTokens = (
  tokens: Array<string | Prism.Token>,
  theme: TokenTheme,
  inheritedColor: string,
  acc: CodeRun[],
): void => {
  for (const token of tokens) {
    if (typeof token === "string") {
      acc.push({ text: token, color: inheritedColor });
      continue;
    }
    const color = colorForType(token.type, theme) ?? inheritedColor;
    const { content } = token;
    if (typeof content === "string") {
      acc.push({ text: content, color });
    } else if (Array.isArray(content)) {
      flattenTokens(content as Array<string | Prism.Token>, theme, color, acc);
    } else {
      flattenTokens([content], theme, color, acc);
    }
  }
};

/**
 * Tokenize `code` and return, per source line, the colored runs that make it up.
 * Lines preserve all whitespace (indentation) since we never wrap.
 */
export const tokenizeCode = (
  code: string,
  language: string,
  themeName: CodeBlockTheme,
): CodeLine[] => {
  const theme = CODE_BLOCK_THEMES[themeName];
  const grammar = getPrismGrammar(normalizeCodeLanguage(language));

  const runs: CodeRun[] = [];
  if (grammar) {
    try {
      flattenTokens(
        Prism.tokenize(code, grammar) as Array<string | Prism.Token>,
        theme,
        theme.foreground,
        runs,
      );
    } catch {
      runs.length = 0;
      runs.push({ text: code, color: theme.foreground });
    }
  } else {
    runs.push({ text: code, color: theme.foreground });
  }

  // split runs into lines on newlines, preserving empty lines
  const lines: CodeLine[] = [[]];
  for (const run of runs) {
    const parts = run.text.split("\n");
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        lines.push([]);
      }
      if (parts[i] !== "") {
        lines[lines.length - 1].push({ text: parts[i], color: run.color });
      }
    }
  }
  return lines;
};

/**
 * Re-wraps already-tokenized lines so no visual line exceeds `maxChars`
 * columns, splitting runs across the boundary while preserving their color.
 */
export const wrapCodeLines = (
  lines: CodeLine[],
  maxChars: number,
): CodeLine[] => {
  if (maxChars <= 0) {
    return lines;
  }

  const wrapped: CodeLine[] = [];
  for (const line of lines) {
    if (line.length === 0) {
      wrapped.push([]);
      continue;
    }

    let current: CodeRun[] = [];
    let column = 0;
    for (const run of line) {
      let text = run.text;
      while (text.length > 0) {
        const remaining = maxChars - column;
        if (remaining <= 0) {
          wrapped.push(current);
          current = [];
          column = 0;
          continue;
        }
        const chunk = text.slice(0, remaining);
        current.push({ text: chunk, color: run.color });
        column += chunk.length;
        text = text.slice(chunk.length);
      }
    }
    wrapped.push(current);
  }
  return wrapped;
};

// --- element helpers ---------------------------------------------------------

export const getCodeBlockMeta = (
  element: ExcalidrawElement,
): CodeBlockMeta | undefined =>
  (element.customData?.codeBlock as CodeBlockMeta | undefined) ?? undefined;

export const isCodeBlockTextElement = (
  element: ExcalidrawElement,
): element is ExcalidrawTextElement & {
  customData: { codeBlock: CodeBlockMeta };
} => element.type === "text" && !!element.customData?.codeBlock;

export const isCodeBlockContainerElement = (
  element: ExcalidrawElement,
): boolean => element.type === "rectangle" && !!element.customData?.codeBlock;

/** Finds the rectangle container grouped with a code block's text element. */
export const findCodeBlockContainer = (
  elements: readonly ExcalidrawElement[],
  text: ExcalidrawElement,
): ExcalidrawElement | undefined => {
  const groupId = text.groupIds[0];
  if (!groupId) {
    return undefined;
  }
  return elements.find(
    (el) => isCodeBlockContainerElement(el) && el.groupIds.includes(groupId),
  );
};
