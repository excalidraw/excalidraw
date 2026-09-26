import Prism from "prismjs";

// Order matters: extended grammars load after their dependencies.
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

import type { ExcalidrawElement } from "./types";

export const hasTextBackground = (element: ExcalidrawElement): boolean =>
  element.type === "text" && element.customData?.textBackground === true;

export type CodeBlockTheme = "light" | "dark";

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  py: "python",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  html: "html",
  xml: "html",
  svg: "html",
  c: "c",
  "c++": "cpp",
  cpp: "cpp",
  text: "plaintext",
  txt: "plaintext",
};

const SUPPORTED_LANGUAGES: Record<string, true> = {
  plaintext: true,
  javascript: true,
  typescript: true,
  jsx: true,
  tsx: true,
  python: true,
  java: true,
  c: true,
  cpp: true,
  css: true,
  html: true,
  json: true,
  bash: true,
};

/** Normalizes a Markdown fence info string to a bundled Prism grammar. */
export const normalizeCodeLanguage = (language?: string | null): string => {
  const lang = (language ?? "").trim().toLowerCase();
  if (!lang) {
    return "plaintext";
  }
  const normalized = LANGUAGE_ALIASES[lang] ?? lang;
  return SUPPORTED_LANGUAGES[normalized] ? normalized : "plaintext";
};

const getPrismGrammar = (language: string): Prism.Grammar | null => {
  const key = language === "html" ? "markup" : language;
  return (
    (Prism.languages as Record<string, Prism.Grammar | undefined>)[key] ?? null
  );
};

type TokenTheme = {
  foreground: string;
  colors: Record<string, string>;
};

const CODE_BLOCK_THEMES: Record<CodeBlockTheme, TokenTheme> = {
  dark: {
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

export type CodeRun = { text: string; color: string };
export type CodeLine = CodeRun[];

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

    const color = theme.colors[token.type] ?? inheritedColor;
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

/** Tokenizes source while preserving every source line and its whitespace. */
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
    } catch (error) {
      console.error("Failed to highlight fenced code", { language, error });
      runs.push({ text: code, color: theme.foreground });
    }
  } else {
    runs.push({ text: code, color: theme.foreground });
  }

  const lines: CodeLine[] = [[]];
  for (const run of runs) {
    const parts = run.text.split("\n");
    for (let index = 0; index < parts.length; index++) {
      if (index > 0) {
        lines.push([]);
      }
      if (parts[index]) {
        lines[lines.length - 1].push({ text: parts[index], color: run.color });
      }
    }
  }
  return lines;
};

export type MarkdownLine =
  | { type: "text"; text: string }
  | { type: "fence" }
  | { type: "code"; runs: CodeLine };

type OpenFence = {
  marker: "`" | "~";
  length: number;
  language: string;
};

const parseOpeningFence = (line: string): OpenFence | null => {
  let offset = 0;
  while (offset < 3 && line[offset] === " ") {
    offset++;
  }
  const marker = line[offset];
  if (marker !== "`" && marker !== "~") {
    return null;
  }

  let end = offset;
  while (line[end] === marker) {
    end++;
  }
  const length = end - offset;
  if (length < 3) {
    return null;
  }

  const info = line.slice(end).trim();
  if (marker === "`" && info.includes("`")) {
    return null;
  }
  return {
    marker,
    length,
    language: normalizeCodeLanguage(info.split(/\s/, 1)[0]),
  };
};

const isClosingFence = (line: string, fence: OpenFence): boolean => {
  let offset = 0;
  while (offset < 3 && line[offset] === " ") {
    offset++;
  }
  let end = offset;
  while (line[end] === fence.marker) {
    end++;
  }
  return end - offset >= fence.length && line.slice(end).trim() === "";
};

/**
 * Parses fenced sections in a text element. Delimiter lines stay in the layout
 * as blank lines, keeping the in-canvas editor and rendered text geometrically
 * aligned. Returns null when no opening fence exists, avoiding Prism work for
 * ordinary text elements.
 */
export const parseMarkdownCodeFenceLines = (
  text: string,
  theme: CodeBlockTheme,
): MarkdownLine[] | null => {
  if (!text.includes("```") && !text.includes("~~~")) {
    return null;
  }

  const sourceLines = text.replace(/\r\n?/g, "\n").split("\n");
  const result: MarkdownLine[] = [];
  let fence: OpenFence | null = null;
  let codeStart = 0;

  const appendCode = (end: number) => {
    if (end === codeStart) {
      return;
    }
    const codeLines = tokenizeCode(
      sourceLines.slice(codeStart, end).join("\n"),
      fence!.language,
      theme,
    );
    for (const runs of codeLines) {
      result.push({ type: "code", runs });
    }
  };

  for (let index = 0; index < sourceLines.length; index++) {
    const line = sourceLines[index];
    if (!fence) {
      const opening = parseOpeningFence(line);
      if (opening) {
        fence = opening;
        codeStart = index + 1;
        result.push({ type: "fence" });
      } else {
        result.push({ type: "text", text: line });
      }
      continue;
    }

    if (isClosingFence(line, fence)) {
      appendCode(index);
      result.push({ type: "fence" });
      fence = null;
    }
  }

  if (fence) {
    appendCode(sourceLines.length);
  }

  return result;
};
