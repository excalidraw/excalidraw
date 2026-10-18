import { pointFrom, pointRotateRads, type Radians } from "@excalidraw/math";

import type { Scene } from "./Scene";
import type {
  CodeBlockLanguage,
  CodeBlockThemeName,
  ExcalidrawCodeBlockElement,
  NonDeleted,
} from "./types";

export const DEFAULT_CODE_BLOCK_LANGUAGE: CodeBlockLanguage = "javascript";
export const DEFAULT_CODE_BLOCK_THEME: CodeBlockThemeName = "catppuccin";
export const DEFAULT_CODE_BLOCK_FONT_SIZE = 14;
export const CODE_BLOCK_FONT_SIZES = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
} as const;
export const DEFAULT_CODE_BLOCK_WIDTH = 640;
export const MIN_CODE_BLOCK_WIDTH = 160;
export const CODE_BLOCK_PADDING = 14;

export const CODE_BLOCK_FONT_FAMILY =
  "Cascadia, 'Cascadia Code', 'Fira Code', Menlo, Consolas, monospace";
export const getCodeBlockFontString = (fontSize: number): string =>
  `${fontSize}px ${CODE_BLOCK_FONT_FAMILY}`;

export const getCodeBlockLineHeight = (fontSize: number): number => {
  return Math.round(fontSize * 1.5);
};

const getCodeBlockCharWidth = (fontSize: number): number => {
  return fontSize * 0.6;
};

export const DEFAULT_CODE_BLOCK_HEIGHT =
  getCodeBlockLineHeight(DEFAULT_CODE_BLOCK_FONT_SIZE) + CODE_BLOCK_PADDING * 2;
export const CODE_BLOCK_HEADER_LABEL = "Code block";
export const CODE_BLOCK_PLACEHOLDER = "Type something...";

export const getMaxUnwrappedLineWidth = (
  code: string,
  fontSize: number,
  showLineNumbers: boolean,
): number => {
  const lines = (code ?? "").split(/\r?\n/);
  const charWidth = getCodeBlockCharWidth(fontSize);
  const scale = fontSize / DEFAULT_CODE_BLOCK_FONT_SIZE;
  const padding = CODE_BLOCK_PADDING * scale;
  let maxLen = 0;
  for (const line of lines) {
    if (line.length > maxLen) {
      maxLen = line.length;
    }
  }
  let gutterWidth = 0;
  if (showLineNumbers) {
    const maxDigits = Math.max(2, String(Math.max(1, lines.length)).length);
    gutterWidth = Math.round(
      (maxDigits * 0.6 * DEFAULT_CODE_BLOCK_FONT_SIZE + 24) * scale,
    );
  }
  return Math.ceil(gutterWidth + padding * 2 + maxLen * charWidth + 20 * scale);
};

export const CODE_BLOCK_LANGUAGES: readonly CodeBlockLanguage[] = [
  "javascript",
  "typescript",
  "python",
  "cpp",
  "java",
  "go",
  "rust",
  "plaintext",
  "swift",
  "ruby",
  "sql",
  "html",
  "css",
  "json",
  "graphql",
  "kotlin",
  "mermaid",
  "yaml",
] as const;

export const CODE_BLOCK_LANGUAGE_LABELS: Record<CodeBlockLanguage, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  cpp: "C++",
  java: "Java",
  go: "Go",
  rust: "Rust",
  plaintext: "PlainText",
  swift: "Swift",
  ruby: "Ruby",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  json: "JSON",
  graphql: "GraphQL",
  kotlin: "Kotlin",
  mermaid: "Mermaid",
  yaml: "YAML",
};

export type TokenType =
  | "keyword"
  | "function"
  | "type"
  | "string"
  | "number"
  | "literal"
  | "comment"
  | "instance"
  | "operator"
  | "punctuation"
  | "property"
  | "tag"
  | "plain";

export type CodeBlockTheme = {
  background: string;
  gutterBackground: string;
  border: string;
  activeLine: string;
  activeLineFallback: string;
  gutterText: string;
  gutterBorder: string;
  placeholder: string;
  tokenColors: Record<TokenType, string>;
};

export const CODE_BLOCK_THEMES: Record<CodeBlockThemeName, CodeBlockTheme> = {
  catppuccin: {
    background: "#1e1e2e",
    gutterBackground: "#181825",
    border: "#45475a",
    activeLine: "rgba(205, 214, 244, 0.08)",
    activeLineFallback: "#313244",
    gutterText: "#7f849c",
    gutterBorder: "#313244",
    placeholder: "rgba(205, 214, 244, 0.4)",
    tokenColors: {
      keyword: "#cba6f7",
      function: "#89b4fa",
      type: "#89dceb",
      string: "#a6e3a1",
      number: "#fab387",
      literal: "#fab387",
      comment: "#9399b2",
      instance: "#f5c2e7",
      operator: "#f38ba8",
      punctuation: "#cdd6f4",
      property: "#cdd6f4",
      tag: "#f38ba8",
      plain: "#cdd6f4",
    },
  },
  githubDark: {
    background: "#0d1117",
    gutterBackground: "#010409",
    border: "#30363d",
    activeLine: "rgba(110, 118, 129, 0.12)",
    activeLineFallback: "#161b22",
    gutterText: "#6e7681",
    gutterBorder: "#21262d",
    placeholder: "rgba(140, 149, 159, 0.4)",
    tokenColors: {
      keyword: "#ff7b72",
      function: "#d2a8ff",
      type: "#ffa657",
      string: "#a5d6ff",
      number: "#79c0ff",
      literal: "#79c0ff",
      comment: "#8b949e",
      instance: "#ff7b72",
      operator: "#ff7b72",
      punctuation: "#c9d1d9",
      property: "#79c0ff",
      tag: "#7ee787",
      plain: "#c9d1d9",
    },
  },
  githubLight: {
    background: "#ffffff",
    gutterBackground: "#f6f8fa",
    border: "#d0d7de",
    activeLine: "rgba(0, 0, 0, 0.04)",
    activeLineFallback: "#eaeef2",
    gutterText: "#8c959f",
    gutterBorder: "#d8dee4",
    placeholder: "rgba(87, 96, 106, 0.4)",
    tokenColors: {
      keyword: "#cf222e",
      function: "#8250df",
      type: "#953800",
      string: "#0a3069",
      number: "#0550ae",
      literal: "#0550ae",
      comment: "#6e7781",
      instance: "#953800",
      operator: "#cf222e",
      punctuation: "#24292f",
      property: "#0550ae",
      tag: "#116329",
      plain: "#24292f",
    },
  },
  dracula: {
    background: "#282a36",
    gutterBackground: "#21222c",
    border: "#44475a",
    activeLine: "rgba(255, 255, 255, 0.06)",
    activeLineFallback: "#343746",
    gutterText: "#6272a4",
    gutterBorder: "#44475a",
    placeholder: "rgba(248, 248, 242, 0.4)",
    tokenColors: {
      keyword: "#ff79c6",
      function: "#50fa7b",
      type: "#8be9fd",
      string: "#f1fa8c",
      number: "#bd93f9",
      literal: "#bd93f9",
      comment: "#6272a4",
      instance: "#ffb86c",
      operator: "#ff79c6",
      punctuation: "#f8f8f2",
      property: "#50fa7b",
      tag: "#ff79c6",
      plain: "#f8f8f2",
    },
  },
  nord: {
    background: "#2e3440",
    gutterBackground: "#242933",
    border: "#3b4252",
    activeLine: "rgba(255, 255, 255, 0.05)",
    activeLineFallback: "#3b4252",
    gutterText: "#4c566a",
    gutterBorder: "#3b4252",
    placeholder: "rgba(216, 222, 233, 0.4)",
    tokenColors: {
      keyword: "#81a1c1",
      function: "#88c0d0",
      type: "#8fbcbb",
      string: "#a3be8c",
      number: "#b48ead",
      literal: "#b48ead",
      comment: "#616e88",
      instance: "#d8dee9",
      operator: "#81a1c1",
      punctuation: "#eceff4",
      property: "#d8dee9",
      tag: "#bf616a",
      plain: "#d8dee9",
    },
  },
  solarizedLight: {
    background: "#fdf6e3",
    gutterBackground: "#eee8d5",
    border: "#d33682",
    activeLine: "rgba(0, 0, 0, 0.04)",
    activeLineFallback: "#e4decb",
    gutterText: "#93a1a1",
    gutterBorder: "#d5cebe",
    placeholder: "rgba(101, 123, 131, 0.4)",
    tokenColors: {
      keyword: "#859900",
      function: "#268bd2",
      type: "#b58900",
      string: "#2aa198",
      number: "#d33682",
      literal: "#d33682",
      comment: "#93a1a1",
      instance: "#cb4b16",
      operator: "#859900",
      punctuation: "#657b83",
      property: "#268bd2",
      tag: "#b58900",
      plain: "#586e75",
    },
  },
  monokai: {
    background: "#272822",
    gutterBackground: "#1e1f1c",
    border: "#3e3d32",
    activeLine: "rgba(255, 255, 255, 0.06)",
    activeLineFallback: "#3e3d32",
    gutterText: "#75715e",
    gutterBorder: "#3e3d32",
    placeholder: "rgba(248, 248, 242, 0.4)",
    tokenColors: {
      keyword: "#f92672",
      function: "#a6e22e",
      type: "#66d9ef",
      string: "#e6db74",
      number: "#ae81ff",
      literal: "#ae81ff",
      comment: "#75715e",
      instance: "#fd971f",
      operator: "#f92672",
      punctuation: "#f8f8f2",
      property: "#a6e22e",
      tag: "#f92672",
      plain: "#f8f8f2",
    },
  },
};

export const CODE_BLOCK_THEME = CODE_BLOCK_THEMES.catppuccin;

export const CODE_BLOCK_THEME_LABELS: Record<CodeBlockThemeName, string> = {
  catppuccin: "Catppuccin",
  githubDark: "GitHub Dark",
  githubLight: "GitHub Light",
  dracula: "Dracula",
  nord: "Nord",
  solarizedLight: "Solarized Light",
  monokai: "Monokai",
};

export const CODE_BLOCK_THEME_NAMES = Object.keys(
  CODE_BLOCK_THEMES,
) as CodeBlockThemeName[];

export const getCodeBlockTheme = (
  themeName?: CodeBlockThemeName | null,
): CodeBlockTheme => {
  if (themeName && CODE_BLOCK_THEMES[themeName]) {
    return CODE_BLOCK_THEMES[themeName];
  }
  return CODE_BLOCK_THEMES.catppuccin;
};

export type CodeToken = {
  type: TokenType;
  text: string;
};

const INSTANCE_WORDS = new Set(["this", "self", "super", "Self"]);

const COMMON_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "any",
  "void",
  "never",
  "unknown",
  "object",
  "symbol",
  "bigint",
  "undefined",
  "null",
  "String",
  "Number",
  "Boolean",
  "Array",
  "Object",
  "Function",
  "Promise",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Date",
  "RegExp",
  "Error",
  "int",
  "float",
  "double",
  "char",
  "byte",
  "short",
  "long",
  "bool",
  "int8",
  "int16",
  "int32",
  "int64",
  "uint",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "u8",
  "u16",
  "u32",
  "u64",
  "usize",
  "i8",
  "i16",
  "i32",
  "i64",
  "isize",
  "f32",
  "f64",
  "str",
  "Vec",
  "Option",
  "Result",
  "Box",
  "Rc",
  "Arc",
  "List",
  "Dict",
  "Tuple",
  "Integer",
  "Float",
  "Double",
  "Character",
]);

const JS_TS_KEYWORDS = new Set([
  "class",
  "function",
  "return",
  "new",
  "if",
  "else",
  "while",
  "for",
  "const",
  "let",
  "var",
  "import",
  "export",
  "from",
  "default",
  "async",
  "await",
  "typeof",
  "interface",
  "type",
  "enum",
  "extends",
  "implements",
  "public",
  "private",
  "protected",
  "static",
  "readonly",
  "switch",
  "case",
  "break",
  "continue",
  "try",
  "catch",
  "finally",
  "throw",
  "yield",
  "in",
  "of",
  "instanceof",
  "get",
  "set",
]);

const PYTHON_KEYWORDS = new Set([
  "def",
  "class",
  "return",
  "if",
  "elif",
  "else",
  "while",
  "for",
  "in",
  "is",
  "not",
  "and",
  "or",
  "import",
  "from",
  "as",
  "try",
  "except",
  "finally",
  "raise",
  "with",
  "pass",
  "lambda",
  "yield",
  "global",
  "nonlocal",
  "async",
  "await",
  "assert",
  "del",
  "break",
  "continue",
]);

const CPP_JAVA_KOTLIN_KEYWORDS = new Set([
  "class",
  "public",
  "private",
  "protected",
  "static",
  "final",
  "void",
  "int",
  "boolean",
  "double",
  "float",
  "char",
  "return",
  "new",
  "if",
  "else",
  "while",
  "for",
  "switch",
  "case",
  "break",
  "continue",
  "try",
  "catch",
  "finally",
  "throw",
  "throws",
  "import",
  "package",
  "struct",
  "template",
  "typename",
  "namespace",
  "using",
  "const",
  "auto",
  "fun",
  "val",
  "var",
  "override",
  "is",
  "as",
]);

const GO_KEYWORDS = new Set([
  "func",
  "package",
  "import",
  "type",
  "struct",
  "interface",
  "return",
  "if",
  "else",
  "for",
  "range",
  "switch",
  "case",
  "break",
  "continue",
  "go",
  "chan",
  "select",
  "defer",
  "var",
  "const",
  "make",
  "new",
]);

const RUST_KEYWORDS = new Set([
  "fn",
  "let",
  "mut",
  "pub",
  "struct",
  "enum",
  "impl",
  "trait",
  "return",
  "if",
  "else",
  "match",
  "while",
  "for",
  "in",
  "loop",
  "break",
  "continue",
  "use",
  "mod",
  "as",
  "type",
  "where",
  "async",
  "await",
]);

const SWIFT_KEYWORDS = new Set([
  "func",
  "let",
  "var",
  "class",
  "struct",
  "enum",
  "protocol",
  "extension",
  "return",
  "if",
  "else",
  "guard",
  "switch",
  "case",
  "break",
  "continue",
  "import",
  "public",
  "private",
  "internal",
  "fileprivate",
  "open",
  "override",
  "mutating",
]);

const RUBY_KEYWORDS = new Set([
  "def",
  "class",
  "module",
  "end",
  "return",
  "if",
  "elsif",
  "else",
  "unless",
  "while",
  "until",
  "for",
  "in",
  "do",
  "yield",
  "require",
  "include",
]);

const SQL_KEYWORDS = new Set([
  "select",
  "from",
  "where",
  "insert",
  "into",
  "values",
  "update",
  "set",
  "delete",
  "join",
  "left",
  "right",
  "inner",
  "outer",
  "cross",
  "group",
  "by",
  "order",
  "having",
  "limit",
  "create",
  "table",
  "drop",
  "alter",
  "and",
  "or",
  "not",
  "in",
  "as",
  "on",
  "distinct",
  "union",
  "primary",
  "key",
]);

const GRAPHQL_KEYWORDS = new Set([
  "query",
  "mutation",
  "subscription",
  "fragment",
  "type",
  "interface",
  "union",
  "schema",
  "enum",
  "input",
  "directive",
  "on",
  "extend",
]);

const MERMAID_KEYWORDS = new Set([
  "graph",
  "flowchart",
  "sequencediagram",
  "classdiagram",
  "statediagram",
  "erdiagram",
  "subgraph",
  "end",
  "participant",
  "actor",
  "note",
  "loop",
]);

const LITERALS = new Set([
  "true",
  "false",
  "null",
  "undefined",
  "nil",
  "none",
  "nan",
  "True",
  "False",
  "None",
  "NaN",
  "Infinity",
]);

const CSS_KEYWORDS = new Set([
  "color",
  "background",
  "background-color",
  "background-image",
  "border",
  "border-radius",
  "margin",
  "padding",
  "display",
  "flex",
  "grid",
  "gap",
  "width",
  "height",
  "min-width",
  "max-width",
  "font-size",
  "font-family",
  "font-weight",
  "line-height",
  "text-align",
  "position",
  "top",
  "left",
  "right",
  "bottom",
  "z-index",
  "overflow",
  "cursor",
  "opacity",
  "transform",
  "transition",
  "animation",
  "box-shadow",
  "box-sizing",
  "none",
  "block",
  "inline",
  "relative",
  "absolute",
  "fixed",
  "sticky",
  "auto",
  "inherit",
  "initial",
]);

const getKeywordsForLanguage = (language: CodeBlockLanguage): Set<string> => {
  switch (language) {
    case "python":
      return PYTHON_KEYWORDS;
    case "cpp":
    case "java":
    case "kotlin":
      return CPP_JAVA_KOTLIN_KEYWORDS;
    case "go":
      return GO_KEYWORDS;
    case "rust":
      return RUST_KEYWORDS;
    case "swift":
      return SWIFT_KEYWORDS;
    case "ruby":
      return RUBY_KEYWORDS;
    case "sql":
      return SQL_KEYWORDS;
    case "graphql":
      return GRAPHQL_KEYWORDS;
    case "mermaid":
      return MERMAID_KEYWORDS;
    case "css":
      return CSS_KEYWORDS;
    case "json":
    case "yaml":
    case "plaintext":
      return new Set();
    case "javascript":
    case "typescript":
    default:
      return JS_TS_KEYWORDS;
  }
};

export const tokenizeCodeBlock = (
  rawLines: string[],
  language: CodeBlockLanguage,
): CodeToken[][] => {
  if (language === "plaintext") {
    return rawLines.map((line) => [{ type: "plain", text: line }]);
  }

  const keywords = getKeywordsForLanguage(language);
  let inBlockComment = false;
  let inPythonDocstring: '"""' | "'''" | null = null;

  const supportsDoubleSlash =
    language === "javascript" ||
    language === "typescript" ||
    language === "cpp" ||
    language === "java" ||
    language === "kotlin" ||
    language === "go" ||
    language === "rust" ||
    language === "swift" ||
    language === "json";

  const supportsHashComment =
    language === "python" ||
    language === "ruby" ||
    language === "yaml" ||
    language === "graphql";

  const supportsSqlComment = language === "sql";
  const supportsMermaidComment = language === "mermaid";
  const supportsHtmlComment = language === "html";
  const supportsSlashStar =
    supportsDoubleSlash || language === "css" || language === "sql";

  const allLinesTokens: CodeToken[][] = [];

  for (const line of rawLines) {
    if (!line) {
      allLinesTokens.push([]);
      continue;
    }

    const tokens: CodeToken[] = [];
    const len = line.length;
    let i = 0;
    let prevMeaningfulWord = "";

    if (inPythonDocstring) {
      const endIdx = line.indexOf(inPythonDocstring);
      if (endIdx !== -1) {
        tokens.push({ type: "string", text: line.slice(0, endIdx + 3) });
        i = endIdx + 3;
        inPythonDocstring = null;
      } else {
        tokens.push({ type: "string", text: line });
        allLinesTokens.push(tokens);
        continue;
      }
    }

    if (inBlockComment) {
      if (supportsHtmlComment) {
        const endIdx = line.indexOf("-->");
        if (endIdx !== -1) {
          tokens.push({ type: "comment", text: line.slice(0, endIdx + 3) });
          i = endIdx + 3;
          inBlockComment = false;
        } else {
          tokens.push({ type: "comment", text: line });
          allLinesTokens.push(tokens);
          continue;
        }
      } else {
        const endIdx = line.indexOf("*/");
        if (endIdx !== -1) {
          tokens.push({ type: "comment", text: line.slice(0, endIdx + 2) });
          i = endIdx + 2;
          inBlockComment = false;
        } else {
          tokens.push({ type: "comment", text: line });
          allLinesTokens.push(tokens);
          continue;
        }
      }
    }

    while (i < len) {
      const char = line[i];

      if (
        (supportsDoubleSlash && char === "/" && line[i + 1] === "/") ||
        (supportsHashComment && char === "#") ||
        (supportsSqlComment && char === "-" && line[i + 1] === "-") ||
        (supportsMermaidComment && char === "%" && line[i + 1] === "%")
      ) {
        tokens.push({ type: "comment", text: line.slice(i) });
        break;
      }

      if (supportsSlashStar && char === "/" && line[i + 1] === "*") {
        const endIdx = line.indexOf("*/", i + 2);
        if (endIdx !== -1) {
          tokens.push({ type: "comment", text: line.slice(i, endIdx + 2) });
          i = endIdx + 2;
          continue;
        }
        tokens.push({ type: "comment", text: line.slice(i) });
        inBlockComment = true;
        break;
      }

      if (supportsHtmlComment && line.startsWith("<!--", i)) {
        const endIdx = line.indexOf("-->", i + 4);
        if (endIdx !== -1) {
          tokens.push({ type: "comment", text: line.slice(i, endIdx + 3) });
          i = endIdx + 3;
          continue;
        }
        tokens.push({ type: "comment", text: line.slice(i) });
        inBlockComment = true;
        break;
      }

      if (
        language === "python" &&
        (line.startsWith('"""', i) || line.startsWith("'''", i))
      ) {
        const quote = line.startsWith('"""', i) ? '"""' : "'''";
        const endIdx = line.indexOf(quote, i + 3);
        if (endIdx !== -1) {
          tokens.push({ type: "string", text: line.slice(i, endIdx + 3) });
          i = endIdx + 3;
          continue;
        }
        tokens.push({ type: "string", text: line.slice(i) });
        inPythonDocstring = quote;
        break;
      }

      if (char === '"' || char === "'" || char === "`") {
        const quote = char;
        let j = i + 1;
        let escaped = false;
        while (j < len) {
          if (!escaped && line[j] === quote) {
            j++;
            break;
          }
          escaped = !escaped && line[j] === "\\";
          j++;
        }
        tokens.push({ type: "string", text: line.slice(i, j) });
        i = j;
        continue;
      }

      if (language === "html" && char === "<") {
        if (line[i + 1] === "/") {
          let j = i + 2;
          while (j < len && /[a-zA-Z0-9_-]/.test(line[j])) {
            j++;
          }
          tokens.push({ type: "punctuation", text: "</" });
          if (j > i + 2) {
            tokens.push({ type: "tag", text: line.slice(i + 2, j) });
          }
          i = j;
          continue;
        } else if (/[a-zA-Z]/.test(line[i + 1] || "")) {
          let j = i + 1;
          while (j < len && /[a-zA-Z0-9_-]/.test(line[j])) {
            j++;
          }
          tokens.push({ type: "punctuation", text: "<" });
          tokens.push({ type: "tag", text: line.slice(i + 1, j) });
          i = j;
          continue;
        }
      }

      if (
        (/\d/.test(char) || (char === "." && /\d/.test(line[i + 1] || ""))) &&
        (i === 0 || /[\s+\-*/=(),;:[\]{}]/.test(line[i - 1]))
      ) {
        let j = i;
        while (j < len && /[\d.xXa-fA-F_]/.test(line[j])) {
          j++;
        }
        tokens.push({ type: "number", text: line.slice(i, j) });
        i = j;
        continue;
      }

      if (/[a-zA-Z_$]/.test(char)) {
        let j = i;
        while (j < len && /[a-zA-Z0-9_$]/.test(line[j])) {
          j++;
        }
        const word = line.slice(i, j);
        const lower = word.toLowerCase();

        let nextCharIndex = j;
        while (nextCharIndex < len && /\s/.test(line[nextCharIndex])) {
          nextCharIndex++;
        }
        const nextChar = nextCharIndex < len ? line[nextCharIndex] : "";

        let prevCharIndex = i - 1;
        while (prevCharIndex >= 0 && /\s/.test(line[prevCharIndex])) {
          prevCharIndex--;
        }
        const prevChar = prevCharIndex >= 0 ? line[prevCharIndex] : "";
        const isPropertyAccess = prevChar === ".";

        if (INSTANCE_WORDS.has(word)) {
          tokens.push({ type: "instance", text: word });
          prevMeaningfulWord = word;
        } else if (LITERALS.has(word) || LITERALS.has(lower)) {
          tokens.push({ type: "literal", text: word });
          prevMeaningfulWord = word;
        } else if (
          !isPropertyAccess &&
          keywords.has(language === "sql" ? lower : word)
        ) {
          tokens.push({ type: "keyword", text: word });
          prevMeaningfulWord = word;
        } else if (
          !isPropertyAccess &&
          (prevMeaningfulWord === "class" ||
            prevMeaningfulWord === "interface" ||
            prevMeaningfulWord === "type" ||
            prevMeaningfulWord === "enum" ||
            prevMeaningfulWord === "struct" ||
            prevMeaningfulWord === "extends" ||
            prevMeaningfulWord === "implements" ||
            prevMeaningfulWord === "new" ||
            COMMON_TYPES.has(word))
        ) {
          tokens.push({ type: "type", text: word });
          prevMeaningfulWord = word;
        } else if (
          nextChar === "(" ||
          (!isPropertyAccess &&
            (prevMeaningfulWord === "function" ||
              prevMeaningfulWord === "def" ||
              prevMeaningfulWord === "fn" ||
              prevMeaningfulWord === "func"))
        ) {
          tokens.push({ type: "function", text: word });
          prevMeaningfulWord = word;
        } else if (
          !isPropertyAccess &&
          /^[A-Z][a-zA-Z0-9]*$/.test(word) &&
          !/^[A-Z0-9_]+$/.test(word) &&
          prevMeaningfulWord !== "const" &&
          prevMeaningfulWord !== "let" &&
          prevMeaningfulWord !== "var"
        ) {
          tokens.push({ type: "type", text: word });
          prevMeaningfulWord = word;
        } else if (isPropertyAccess) {
          tokens.push({ type: "property", text: word });
          prevMeaningfulWord = word;
        } else if (language === "html" && nextChar === "=") {
          tokens.push({ type: "tag", text: word });
          prevMeaningfulWord = word;
        } else {
          tokens.push({ type: "plain", text: word });
          prevMeaningfulWord = word;
        }
        i = j;
        continue;
      }

      if (/[()[\]{};,.]/.test(char)) {
        if ((char === "=" || char === "-") && line[i + 1] === ">") {
          // Handled in operators below (=> or ->)
        } else {
          tokens.push({ type: "punctuation", text: char });
          i++;
          continue;
        }
      }

      if (/[+\-*/%=<>!&|^~?:]/.test(char)) {
        let j = i;
        while (j < len && /[+\-*/%=<>!&|^~?:]/.test(line[j])) {
          j++;
        }
        tokens.push({ type: "operator", text: line.slice(i, j) });
        i = j;
        continue;
      }

      let j = i;
      while (j < len && /^\s$/.test(line[j])) {
        j++;
      }
      if (j > i) {
        tokens.push({ type: "plain", text: line.slice(i, j) });
        i = j;
      } else {
        tokens.push({ type: "plain", text: char });
        i++;
      }
    }

    allLinesTokens.push(tokens);
  }

  return allLinesTokens;
};

export const tokenizeCodeLine = (
  line: string,
  language: CodeBlockLanguage,
): CodeToken[] => {
  return tokenizeCodeBlock([line], language)[0] ?? [];
};

export type VisualCodeLine = {
  logicalLineNumber: number; // 1-indexed
  isFirstSubLine: boolean;
  tokens: CodeToken[];
  text: string;
  subLineStartInLogicalLine: number;
  indentLength: number;
};

export type CodeBlockLayout = {
  gutterWidth: number;
  visualLines: VisualCodeLine[];
  lineHeightPx: number;
  totalContentHeight: number;
  charWidth: number;
  padding: number;
};

const codeBlockLayoutCache = new WeakMap<
  ExcalidrawCodeBlockElement,
  { key: string; layout: CodeBlockLayout }
>();

export const getCodeBlockLayout = (
  element: ExcalidrawCodeBlockElement,
): CodeBlockLayout => {
  const code = element.code ?? "";
  const cacheKey = `${element.versionNonce}:${element.width}:${element.height}:${element.fontSize}:${element.showLineNumbers}:${element.language}:${code.length}:${code}`;
  const cached = codeBlockLayoutCache.get(element);
  if (cached && cached.key === cacheKey) {
    return cached.layout;
  }

  const rawLines = code.split(/\r?\n/);
  const numLogicalLines = Math.max(1, rawLines.length);

  const baseFontSize = DEFAULT_CODE_BLOCK_FONT_SIZE;
  const scale = Math.max(0.1, element.fontSize / baseFontSize);
  const padding = CODE_BLOCK_PADDING * scale;
  const charWidth = getCodeBlockCharWidth(element.fontSize);
  const lineHeightPx = getCodeBlockLineHeight(element.fontSize);

  let gutterWidth = 0;
  let baseGutterWidth = 0;
  if (element.showLineNumbers) {
    const maxDigits = Math.max(2, String(numLogicalLines).length);
    const baseCharWidth = getCodeBlockCharWidth(baseFontSize);
    baseGutterWidth = Math.round(maxDigits * baseCharWidth + 24);
    gutterWidth = Math.round(baseGutterWidth * scale);
  }

  // normalize logical width so wrapping stays invariant during uniform scaling
  const logicalWidth = element.width / scale;
  const baseCharWidth = getCodeBlockCharWidth(baseFontSize);
  const logicalAvailableWidth = Math.max(
    60,
    logicalWidth - baseGutterWidth - CODE_BLOCK_PADDING * 2,
  );
  const maxCharsPerLine = Math.max(
    10,
    Math.floor(logicalAvailableWidth / baseCharWidth),
  );

  const visualLines: VisualCodeLine[] = [];
  const tokenizedLines = tokenizeCodeBlock(rawLines, element.language);

  rawLines.forEach((logicalLine, index) => {
    const logicalLineNumber = index + 1;
    const tokens = tokenizedLines[index] ?? [
      { type: "plain", text: logicalLine },
    ];

    const indentMatch = logicalLine.match(/^(\s+)/);
    const leadingIndent = indentMatch ? indentMatch[1] : "";

    if (logicalLine.length <= maxCharsPerLine) {
      visualLines.push({
        logicalLineNumber,
        isFirstSubLine: true,
        tokens,
        text: logicalLine,
        subLineStartInLogicalLine: 0,
        indentLength: 0,
      });
    } else {
      const continuationIndent =
        leadingIndent.length > 0 && leadingIndent.length <= maxCharsPerLine - 4
          ? leadingIndent
          : "";

      let currentSubLineTokens: CodeToken[] = [];
      let currentSubLineLen = 0;
      let isFirst = true;
      let currentSubLineStart = 0;
      let charCounterInLogicalLine = 0;

      const flushSubLine = () => {
        visualLines.push({
          logicalLineNumber,
          isFirstSubLine: isFirst,
          tokens: currentSubLineTokens,
          text: currentSubLineTokens.map((t) => t.text).join(""),
          subLineStartInLogicalLine: currentSubLineStart,
          indentLength: isFirst ? 0 : continuationIndent.length,
        });

        isFirst = false;
        currentSubLineStart = charCounterInLogicalLine;
        if (continuationIndent.length > 0) {
          currentSubLineTokens = [{ type: "plain", text: continuationIndent }];
          currentSubLineLen = continuationIndent.length;
        } else {
          currentSubLineTokens = [];
          currentSubLineLen = 0;
        }
      };

      for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
        const token = tokens[tIdx];
        let tokenRemaining = token.text;

        while (tokenRemaining.length > 0) {
          const room = maxCharsPerLine - currentSubLineLen;

          if (tokenRemaining.length <= room) {
            currentSubLineTokens.push({
              type: token.type,
              text: tokenRemaining,
            });
            currentSubLineLen += tokenRemaining.length;
            charCounterInLogicalLine += tokenRemaining.length;
            tokenRemaining = "";
          } else {
            const hasContent = isFirst
              ? currentSubLineTokens.length > 0
              : currentSubLineTokens.length > (continuationIndent ? 1 : 0);

            if (hasContent) {
              const lastSpace = tokenRemaining.lastIndexOf(" ", room);
              if (lastSpace > 0) {
                const slice = tokenRemaining.slice(0, lastSpace);
                currentSubLineTokens.push({ type: token.type, text: slice });
                currentSubLineLen += slice.length;
                charCounterInLogicalLine += slice.length;

                const rest = tokenRemaining.slice(lastSpace);
                const spaceMatch = rest.match(/^ +/);
                const spaceLen = spaceMatch ? spaceMatch[0].length : 0;
                charCounterInLogicalLine += spaceLen;
                tokenRemaining = rest.slice(spaceLen);
                flushSubLine();
              } else {
                flushSubLine();
                const spaceMatch = tokenRemaining.match(/^ +/);
                if (spaceMatch) {
                  charCounterInLogicalLine += spaceMatch[0].length;
                  tokenRemaining = tokenRemaining.slice(spaceMatch[0].length);
                }
              }
            } else {
              const sliceLen = Math.max(1, room);
              const slice = tokenRemaining.slice(0, sliceLen);
              currentSubLineTokens.push({ type: token.type, text: slice });
              currentSubLineLen += slice.length;
              charCounterInLogicalLine += slice.length;
              tokenRemaining = tokenRemaining.slice(sliceLen);
              flushSubLine();
            }
          }
        }
      }

      const hasTrailingContent = isFirst
        ? currentSubLineTokens.length > 0
        : currentSubLineTokens.length > (continuationIndent ? 1 : 0);

      if (hasTrailingContent) {
        visualLines.push({
          logicalLineNumber,
          isFirstSubLine: isFirst,
          tokens: currentSubLineTokens,
          text: currentSubLineTokens.map((t) => t.text).join(""),
          subLineStartInLogicalLine: currentSubLineStart,
          indentLength: isFirst ? 0 : continuationIndent.length,
        });
      }
    }
  });

  const totalContentHeight = visualLines.length * lineHeightPx + padding * 2;

  const layout: CodeBlockLayout = {
    gutterWidth,
    visualLines,
    lineHeightPx,
    totalContentHeight,
    charWidth,
    padding,
  };

  codeBlockLayoutCache.set(element, { key: cacheKey, layout });
  return layout;
};

export const computeCodeBlockDimensions = (
  element: ExcalidrawCodeBlockElement,
  updates?: Partial<ExcalidrawCodeBlockElement>,
): { width: number; height: number; layout: CodeBlockLayout } => {
  const merged: ExcalidrawCodeBlockElement = {
    ...element,
    ...updates,
  };
  const code = merged.code ?? "";
  let nextWidth = merged.width;

  if (!merged.widthOverridden && merged.width < DEFAULT_CODE_BLOCK_WIDTH) {
    const maxUnwrapped = getMaxUnwrappedLineWidth(
      code,
      merged.fontSize,
      merged.showLineNumbers,
    );
    nextWidth = Math.min(
      DEFAULT_CODE_BLOCK_WIDTH,
      Math.max(merged.width, maxUnwrapped),
    );
  }

  const layout = getCodeBlockLayout({
    ...merged,
    width: nextWidth,
  });

  return {
    width: nextWidth,
    height: Math.ceil(layout.totalContentHeight),
    layout,
  };
};

export const updateCodeBlockElementLayout = (
  element: NonDeleted<ExcalidrawCodeBlockElement>,
  updates: Omit<Partial<ExcalidrawCodeBlockElement>, "isDeleted" | "id">,
  scene: Scene,
) => {
  const { width, height } = computeCodeBlockDimensions(element, updates);
  scene.mutateElement(element, {
    ...updates,
    width,
    height,
  });
};

export const isHittingCodeBlockTitle = (
  element: ExcalidrawCodeBlockElement,
  sceneX: number,
  sceneY: number,
): boolean => {
  const center = pointFrom(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );
  const [localSceneX, localSceneY] = pointRotateRads(
    pointFrom(sceneX, sceneY),
    center,
    -element.angle as Radians,
  );

  const titleText = element.title || CODE_BLOCK_HEADER_LABEL;
  const titleWidth = Math.max(100, titleText.length * 10 + 24);
  const titleMinX = element.x - 6;
  const titleMaxX = element.x + titleWidth;
  const titleMinY = element.y - 36;
  const titleMaxY = element.y - 4;

  return (
    localSceneX >= titleMinX &&
    localSceneX <= titleMaxX &&
    localSceneY >= titleMinY &&
    localSceneY <= titleMaxY
  );
};

export const getCodeBlockCaretIndexAtCoords = (
  element: ExcalidrawCodeBlockElement,
  coords: { x: number; y: number },
): number => {
  const code = element.code ?? "";
  if (!code) {
    return 0;
  }

  const center = pointFrom(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );
  const [unrotatedX, unrotatedY] = pointRotateRads(
    pointFrom(coords.x, coords.y),
    center,
    -element.angle as Radians,
  );

  const localX = unrotatedX - element.x;
  const localY = unrotatedY - element.y;

  const layout = getCodeBlockLayout(element);
  const { visualLines, lineHeightPx, gutterWidth, charWidth, padding } = layout;
  if (!visualLines.length) {
    return 0;
  }

  const contentX = padding + gutterWidth;
  const contentY = padding;

  const lineIdx = Math.max(
    0,
    Math.min(
      visualLines.length - 1,
      Math.floor((localY - contentY) / lineHeightPx),
    ),
  );

  const clickedVisualLine = visualLines[lineIdx];
  const relativeX = Math.max(0, localX - contentX);
  const charOffsetInLine = Math.max(
    0,
    Math.min(clickedVisualLine.text.length, Math.round(relativeX / charWidth)),
  );

  const rawLines = code.split(/\r?\n/);
  const logicalLineOffsets: number[] = [];
  let offset = 0;
  const newlineMatches = code.match(/\r?\n/g) || [];
  for (let i = 0; i < rawLines.length; i++) {
    logicalLineOffsets.push(offset);
    offset += rawLines[i].length + (newlineMatches[i]?.length ?? 1);
  }

  const logicalLineStart =
    logicalLineOffsets[clickedVisualLine.logicalLineNumber - 1] ?? 0;

  let offsetInLogicalLine = clickedVisualLine.subLineStartInLogicalLine;
  if (clickedVisualLine.indentLength > 0) {
    if (charOffsetInLine > clickedVisualLine.indentLength) {
      offsetInLogicalLine += charOffsetInLine - clickedVisualLine.indentLength;
    }
  } else {
    offsetInLogicalLine += charOffsetInLine;
  }

  const targetIndex = logicalLineStart + offsetInLogicalLine;
  return Math.max(0, Math.min(code.length, targetIndex));
};
