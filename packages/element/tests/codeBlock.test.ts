import { ROUNDNESS } from "@excalidraw/common";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";

import {
  newCodeBlockElement,
  isCodeBlockElement,
  tokenizeCodeLine,
  tokenizeCodeBlock,
  getCodeBlockLayout,
  isHittingCodeBlockTitle,
  CODE_BLOCK_THEME,
  CODE_BLOCK_THEMES,
  getCodeBlockTheme,
  CODE_BLOCK_THEME_NAMES,
  DEFAULT_CODE_BLOCK_LANGUAGE,
  DEFAULT_CODE_BLOCK_FONT_SIZE,
  DEFAULT_CODE_BLOCK_WIDTH,
  DEFAULT_CODE_BLOCK_HEIGHT,
  MIN_CODE_BLOCK_WIDTH,
  CODE_BLOCK_PADDING,
  getCodeBlockLineHeight,
  resizeSingleCodeBlockElement,
  getCodeBlockCaretIndexAtCoords,
  getCornerRadius,
} from "../src";

describe("codeBlock element", () => {
  it("creates a codeblock element with default properties", () => {
    const codeBlock = newCodeBlockElement({
      x: 100,
      y: 150,
    });

    expect(codeBlock.type).toBe("codeblock");
    expect(codeBlock.x).toBe(100);
    expect(codeBlock.y).toBe(150);
    expect(codeBlock.width).toBe(DEFAULT_CODE_BLOCK_WIDTH);
    expect(codeBlock.height).toBe(DEFAULT_CODE_BLOCK_HEIGHT);
    expect(codeBlock.language).toBe(DEFAULT_CODE_BLOCK_LANGUAGE);
    expect(codeBlock.fontSize).toBe(DEFAULT_CODE_BLOCK_FONT_SIZE);
    expect(codeBlock.showLineNumbers).toBe(true);
    expect(codeBlock.code).toBe("");
    expect(isCodeBlockElement(codeBlock)).toBe(true);
  });

  it("enforces minimum width and height constraints", () => {
    const codeBlock = newCodeBlockElement({
      x: 0,
      y: 0,
      width: 50,
      height: 20,
    });

    expect(codeBlock.width).toBe(MIN_CODE_BLOCK_WIDTH);
    expect(codeBlock.height).toBe(DEFAULT_CODE_BLOCK_HEIGHT);
  });

  it("accepts custom language, fontSize, and code", () => {
    const codeBlock = newCodeBlockElement({
      x: 0,
      y: 0,
      language: "python",
      fontSize: 20,
      showLineNumbers: false,
      code: "def hello():\n    print('world')",
    });

    expect(codeBlock.language).toBe("python");
    expect(codeBlock.fontSize).toBe(20);
    expect(codeBlock.showLineNumbers).toBe(false);
    expect(codeBlock.code).toBe("def hello():\n    print('world')");
  });

  describe("tokenizeCodeLine", () => {
    it("tokenizes JavaScript keywords, strings, comments, and numbers", () => {
      const line = "const answer = 42; // the meaning";
      const tokens = tokenizeCodeLine(line, "javascript");

      const types = tokens.map((t) => t.type);
      expect(types).toContain("keyword");
      expect(types).toContain("number");
      expect(types).toContain("comment");
    });

    it("tokenizes Python comments and keywords", () => {
      const line = "for i in range(10): # iterate";
      const tokens = tokenizeCodeLine(line, "python");

      const keywordTokens = tokens.filter((t) => t.type === "keyword");
      expect(keywordTokens.map((t) => t.text)).toContain("for");
      expect(keywordTokens.map((t) => t.text)).toContain("in");

      const commentToken = tokens.find((t) => t.type === "comment");
      expect(commentToken?.text).toBe("# iterate");
    });

    it("treats // in Python as an operator, NOT as a comment", () => {
      const pythonTokens = tokenizeCodeLine("result = 10 // 2", "python");
      const commentInPython = pythonTokens.find((t) => t.type === "comment");
      expect(commentInPython).toBeUndefined();

      const operatorInPython = pythonTokens.find(
        (t) => t.type === "operator" && t.text === "//",
      );
      expect(operatorInPython).toBeDefined();

      const javaTokens = tokenizeCodeLine("result = 10 // comment", "java");
      const commentInJava = javaTokens.find((t) => t.type === "comment");
      expect(commentInJava?.text).toBe("// comment");
    });

    it("distinguishes comments across SQL, Mermaid, and HTML", () => {
      const sqlTokens = tokenizeCodeLine(
        "SELECT * FROM users; -- comment",
        "sql",
      );
      expect(sqlTokens.find((t) => t.type === "comment")?.text).toBe(
        "-- comment",
      );
      const sqlDoubleSlash = tokenizeCodeLine("// not a sql comment", "sql");
      expect(sqlDoubleSlash.find((t) => t.type === "comment")).toBeUndefined();

      const mermaidTokens = tokenizeCodeLine(
        "graph TD %% flowchart",
        "mermaid",
      );
      expect(mermaidTokens.find((t) => t.type === "comment")?.text).toBe(
        "%% flowchart",
      );

      const htmlTokens = tokenizeCodeLine("<!-- html comment -->", "html");
      expect(htmlTokens.find((t) => t.type === "comment")?.text).toBe(
        "<!-- html comment -->",
      );
    });

    it("tokenizes multi-line Python docstrings", () => {
      const lines = ['"""', "Multi-line docstring", '"""'];
      const tokenized = tokenizeCodeBlock(lines, "python");
      expect(tokenized[0][0].type).toBe("string");
      expect(tokenized[1][0].type).toBe("string");
      expect(tokenized[2][0].type).toBe("string");
    });
  });

  describe("getCodeBlockLayout", () => {
    it("computes layout and line numbers for code", () => {
      const codeBlock = newCodeBlockElement({
        x: 0,
        y: 0,
        width: 480,
        height: 200,
        code: "const a = 1;\nconst b = 2;\nconst c = 3;",
        showLineNumbers: true,
      });

      const layout = getCodeBlockLayout(codeBlock);
      expect(layout.visualLines.length).toBe(3);
      expect(layout.visualLines[0].logicalLineNumber).toBe(1);
      expect(layout.visualLines[1].logicalLineNumber).toBe(2);
      expect(layout.visualLines[2].logicalLineNumber).toBe(3);
      expect(layout.gutterWidth).toBeGreaterThan(0);
    });

    it("handles empty code gracefully with a single line", () => {
      const codeBlock = newCodeBlockElement({
        x: 0,
        y: 0,
        code: "",
      });

      const layout = getCodeBlockLayout(codeBlock);
      expect(layout.visualLines.length).toBe(1);
      expect(layout.visualLines[0].logicalLineNumber).toBe(1);
    });
  });

  describe("restoreElements", () => {
    it("restores codeblock elements safely", () => {
      const rawElement = {
        type: "codeblock",
        id: "code-1",
        x: 50,
        y: 60,
        width: 400,
        height: 250,
        code: "console.log('test')",
        language: "typescript",
        fontSize: 16,
        showLineNumbers: false,
      };

      const restored = restoreElements([rawElement as any], null);
      expect(restored.length).toBe(1);
      const element = restored[0];
      expect(isCodeBlockElement(element)).toBe(true);
      if (isCodeBlockElement(element)) {
        expect(element.code).toBe("console.log('test')");
        expect(element.language).toBe("typescript");
        expect(element.fontSize).toBe(16);
        expect(element.showLineNumbers).toBe(false);
      }
    });

    it("falls back to default language if raw language is invalid", () => {
      const rawElement = {
        type: "codeblock",
        id: "code-2",
        x: 50,
        y: 60,
        language: "nonexistent_lang",
      };

      const restored = restoreElements([rawElement as any], null);
      const element = restored[0];
      expect(isCodeBlockElement(element)).toBe(true);
      if (isCodeBlockElement(element)) {
        expect(element.language).toBe(DEFAULT_CODE_BLOCK_LANGUAGE);
      }
    });
  });

  describe("tokenizeCodeBlock multi-line comment tracking", () => {
    it("tracks block comment state across multiple lines", () => {
      const rawLines = [
        "/* start of comment",
        "   const inner = 123;",
        "   end of comment */ const actualCode = true;",
      ];

      const tokenized = tokenizeCodeBlock(rawLines, "javascript");
      expect(tokenized.length).toBe(3);

      expect(tokenized[0][0].type).toBe("comment");

      expect(tokenized[1][0].type).toBe("comment");
      expect(tokenized[1][0].text).toContain("const inner");

      expect(tokenized[2][0].type).toBe("comment");
      expect(tokenized[2][0].text).toContain("end of comment */");
      const keyword = tokenized[2].find((t) => t.type === "keyword");
      expect(keyword?.text).toBe("const");
    });

    it("correctly highlights the official Dracula Vampire test snippet", () => {
      const snippet = [
        "class Vampire {",
        "  constructor(props) {",
        "    this.location = props.location;",
        "  }",
        "  calcAge() {",
        "    return this.deathDate - this.birthDate;",
        "  }",
        "}",
        "const Dracula = new Vampire({",
        '  location: "Transylvania",',
        "  birthDate: 1428,",
        "  alive: false,",
        "});",
      ];

      const tokenized = tokenizeCodeBlock(snippet, "javascript");

      const line0Tokens = tokenized[0].filter((t) => t.text.trim());
      expect(line0Tokens[0]).toEqual({ type: "keyword", text: "class" });
      expect(line0Tokens[1]).toEqual({ type: "type", text: "Vampire" });

      const line1Tokens = tokenized[1].filter((t) => t.text.trim());
      expect(line1Tokens[0]).toEqual({ type: "function", text: "constructor" });

      const line2Tokens = tokenized[2].filter((t) => t.text.trim());
      expect(line2Tokens[0]).toEqual({ type: "instance", text: "this" });
      expect(line2Tokens[1]).toEqual({ type: "punctuation", text: "." });
      expect(line2Tokens[2]).toEqual({ type: "property", text: "location" });
      expect(line2Tokens[3]).toEqual({ type: "operator", text: "=" });

      const line4Tokens = tokenized[4].filter((t) => t.text.trim());
      expect(line4Tokens[0]).toEqual({ type: "function", text: "calcAge" });

      const line5Tokens = tokenized[5].filter((t) => t.text.trim());
      expect(line5Tokens[0]).toEqual({ type: "keyword", text: "return" });
      expect(line5Tokens[1]).toEqual({ type: "instance", text: "this" });
      const minusOp = line5Tokens.find((t) => t.text === "-");
      expect(minusOp?.type).toBe("operator");

      const line8Tokens = tokenized[8].filter((t) => t.text.trim());
      expect(line8Tokens[0]).toEqual({ type: "keyword", text: "const" });
      expect(line8Tokens[1]).toEqual({ type: "plain", text: "Dracula" });
      expect(line8Tokens[2]).toEqual({ type: "operator", text: "=" });
      expect(line8Tokens[3]).toEqual({ type: "keyword", text: "new" });
      expect(line8Tokens[4]).toEqual({ type: "type", text: "Vampire" });

      const line9Tokens = tokenized[9].filter((t) => t.text.trim());
      expect(line9Tokens.find((t) => t.type === "string")?.text).toBe(
        '"Transylvania"',
      );

      const line10Tokens = tokenized[10].filter((t) => t.text.trim());
      expect(line10Tokens.find((t) => t.type === "number")?.text).toBe("1428");

      const line11Tokens = tokenized[11].filter((t) => t.text.trim());
      expect(line11Tokens.find((t) => t.type === "literal")?.text).toBe(
        "false",
      );
    });
  });

  describe("isHittingCodeBlockTitle", () => {
    it("detects clicks on the code block title above the container", () => {
      const element = newCodeBlockElement({
        x: 100,
        y: 100,
        width: 480,
        height: 160,
        title: "My Component",
      });

      expect(isHittingCodeBlockTitle(element, 120, 90)).toBe(true);
      expect(isHittingCodeBlockTitle(element, 120, 110)).toBe(false);
      expect(isHittingCodeBlockTitle(element, 500, 90)).toBe(false);
    });

    it("respects element rotation", () => {
      const element = newCodeBlockElement({
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        angle: (Math.PI / 2) as any,
      });

      expect(isHittingCodeBlockTitle(element, 265, 100)).toBe(true);
    });
  });

  describe("theme fallbacks", () => {
    it("falls back to dark theme when transparent background/stroke is passed", () => {
      const element = newCodeBlockElement({
        x: 0,
        y: 0,
        backgroundColor: "transparent",
        strokeColor: "transparent",
      });

      expect(element.backgroundColor).toBe(CODE_BLOCK_THEME.background);
      expect(element.strokeColor).toBe(CODE_BLOCK_THEME.border);
    });

    it("creates codeblock with default catppuccin theme", () => {
      const element = newCodeBlockElement({ x: 0, y: 0 });
      expect(element.theme).toBe("catppuccin");
      expect(element.backgroundColor).toBe(
        CODE_BLOCK_THEMES.catppuccin.background,
      );
      expect(element.strokeColor).toBe(CODE_BLOCK_THEMES.catppuccin.border);
    });

    it("creates codeblock with a light theme (githubLight)", () => {
      const element = newCodeBlockElement({
        x: 0,
        y: 0,
        theme: "githubLight",
      });
      expect(element.theme).toBe("githubLight");
      expect(element.backgroundColor).toBe(
        CODE_BLOCK_THEMES.githubLight.background,
      );
      expect(element.strokeColor).toBe(CODE_BLOCK_THEMES.githubLight.border);
    });

    it("ensures theme background and border override stale baseElementAttributes", () => {
      const element = newCodeBlockElement({
        x: 0,
        y: 0,
        backgroundColor: CODE_BLOCK_THEMES.catppuccin.background,
        strokeColor: CODE_BLOCK_THEMES.catppuccin.border,
        theme: "githubLight",
      });
      expect(element.theme).toBe("githubLight");
      expect(element.backgroundColor).toBe(
        CODE_BLOCK_THEMES.githubLight.background,
      );
      expect(element.strokeColor).toBe(CODE_BLOCK_THEMES.githubLight.border);
    });

    it("supports all registered theme names", () => {
      for (const themeName of CODE_BLOCK_THEME_NAMES) {
        const theme = getCodeBlockTheme(themeName);
        expect(theme).toBeDefined();
        expect(theme.background).toBeTruthy();
        expect(theme.border).toBeTruthy();
        expect(theme.gutterBackground).toBeTruthy();
        expect(theme.tokenColors.keyword).toBeTruthy();

        const el = newCodeBlockElement({ x: 0, y: 0, theme: themeName });
        expect(el.theme).toBe(themeName);
        expect(el.backgroundColor).toBe(theme.background);
        expect(el.strokeColor).toBe(theme.border);
      }
    });

    it("falls back gracefully for unknown or undefined themes", () => {
      expect(getCodeBlockTheme(undefined)).toBe(CODE_BLOCK_THEMES.catppuccin);
      expect(getCodeBlockTheme(null)).toBe(CODE_BLOCK_THEMES.catppuccin);
      expect(getCodeBlockTheme("nonexistent" as any)).toBe(
        CODE_BLOCK_THEMES.catppuccin,
      );
    });
  });

  describe("Creation, auto-expansion, and resize physics", () => {
    it("initial click-creation produces a 1-line tall code block (height === lineHeight + padding * 2)", () => {
      const codeBlock = newCodeBlockElement({
        x: 100,
        y: 100,
      });
      const lineHeight = getCodeBlockLineHeight(codeBlock.fontSize);
      const expectedHeight = lineHeight + CODE_BLOCK_PADDING * 2;
      expect(codeBlock.height).toBe(expectedHeight);
      expect(codeBlock.width).toBe(DEFAULT_CODE_BLOCK_WIDTH);
    });

    it("typing multi-line code auto-expands height downward to layout.totalContentHeight", () => {
      const codeBlock = newCodeBlockElement({
        x: 100,
        y: 100,
        code: "const a = 1;",
      });
      const initialHeight = codeBlock.height;
      const multiLineCode =
        "const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst e = 5;";
      const layout = getCodeBlockLayout({
        ...codeBlock,
        code: multiLineCode,
      });
      const expandedHeight = Math.ceil(layout.totalContentHeight);
      expect(expandedHeight).toBeGreaterThan(initialHeight);
      expect(layout.visualLines.length).toBe(5);
    });

    it("resizing via 'se' or 's' maintains aspect ratio and scales fontSize", () => {
      const origElement = newCodeBlockElement({
        x: 100,
        y: 100,
        width: 480,
        fontSize: 14,
        code: "const x = 10;",
      });
      const element = { ...origElement };
      const scene = {
        mutateElement: (el: any, updates: any) => Object.assign(el, updates),
        getNonDeletedElementsMap: () => new Map([[element.id, element]]),
      } as any;

      resizeSingleCodeBlockElement(
        origElement,
        element,
        scene,
        "se",
        false,
        960,
        origElement.height * 2,
      );

      expect(element.fontSize).toBe(28);
      expect(element.width).toBe(960);
      const layout = getCodeBlockLayout(element);
      expect(element.height).toBe(Math.ceil(layout.totalContentHeight));

      const elementS = { ...origElement };
      resizeSingleCodeBlockElement(
        origElement,
        elementS,
        scene,
        "s",
        false,
        origElement.width,
        origElement.height * 1.5,
      );
      expect(elementS.fontSize).toBe(21);
      expect(elementS.width).toBe(Math.round(480 * 1.5));
      expect(elementS.height).toBe(
        Math.ceil(getCodeBlockLayout(elementS).totalContentHeight),
      );
    });

    it("resizing via 'e' or 'w' (making it slimmer) keeps fontSize constant and automatically increases height so all wrapped lines fit without clipping", () => {
      const longLine =
        "const result = calculateVeryLongVariableNameWithManyArguments(first, second, third, fourth);";
      const origElement = newCodeBlockElement({
        x: 100,
        y: 100,
        width: 480,
        fontSize: 14,
        code: longLine,
      });
      const element = { ...origElement };
      const scene = {
        mutateElement: (el: any, updates: any) => Object.assign(el, updates),
        getNonDeletedElementsMap: () => new Map([[element.id, element]]),
      } as any;

      const initialLayout = getCodeBlockLayout(origElement);
      const initialHeight = Math.ceil(initialLayout.totalContentHeight);

      resizeSingleCodeBlockElement(
        origElement,
        element,
        scene,
        "e",
        false,
        200,
        origElement.height,
      );

      expect(element.width).toBe(200);
      expect(element.fontSize).toBe(14);
      expect(element.widthOverridden).toBe(true);

      const slimLayout = getCodeBlockLayout(element);
      expect(slimLayout.visualLines.length).toBeGreaterThan(
        initialLayout.visualLines.length,
      );
      expect(element.height).toBe(Math.ceil(slimLayout.totalContentHeight));
      expect(element.height).toBeGreaterThan(initialHeight);
    });
  });

  describe("getCodeBlockCaretIndexAtCoords", () => {
    it("returns correct character index based on click coordinates", () => {
      const code = "class Main {\n  public static void main(String[] args)\n}";
      const codeBlock = newCodeBlockElement({
        x: 100,
        y: 100,
        width: 640,
        code,
        fontSize: 12,
        showLineNumbers: true,
      });

      const layout = getCodeBlockLayout(codeBlock);
      const lineHeight = layout.lineHeightPx;
      const charWidth = layout.charWidth;
      const contentX = 100 + CODE_BLOCK_PADDING + layout.gutterWidth;
      const contentY = 100 + CODE_BLOCK_PADDING;

      const indexLine1Start = getCodeBlockCaretIndexAtCoords(codeBlock, {
        x: contentX,
        y: contentY + 2,
      });
      expect(indexLine1Start).toBe(0);

      const indexLine1Mid = getCodeBlockCaretIndexAtCoords(codeBlock, {
        x: contentX + 6 * charWidth,
        y: contentY + 2,
      });
      expect(indexLine1Mid).toBe(6);

      const indexLine2Start = getCodeBlockCaretIndexAtCoords(codeBlock, {
        x: contentX + 2 * charWidth,
        y: contentY + lineHeight + 2,
      });
      expect(indexLine2Start).toBe(13 + 2);

      const indexLine3 = getCodeBlockCaretIndexAtCoords(codeBlock, {
        x: contentX,
        y: contentY + lineHeight * 2 + 2,
      });
      expect(indexLine3).toBe(54);

      const indexLine3PastEnd = getCodeBlockCaretIndexAtCoords(codeBlock, {
        x: contentX + 500,
        y: contentY + lineHeight * 2 + 2,
      });
      expect(indexLine3PastEnd).toBe(55);
    });

    it("returns 0 for empty code block", () => {
      const codeBlock = newCodeBlockElement({
        x: 100,
        y: 100,
        code: "",
      });
      expect(
        getCodeBlockCaretIndexAtCoords(codeBlock, { x: 120, y: 120 }),
      ).toBe(0);
    });
  });

  describe("Adaptive corner radius", () => {
    it("creates codeblock with adaptive radius capped at 8px", () => {
      const codeBlock = newCodeBlockElement({
        x: 100,
        y: 100,
        width: 300,
        height: 49,
      });

      expect(codeBlock.roundness?.type).toBe(ROUNDNESS.ADAPTIVE_RADIUS);
      expect(codeBlock.roundness?.value).toBe(8);

      const radius = getCornerRadius(
        Math.min(codeBlock.width, codeBlock.height),
        codeBlock,
      );
      expect(radius).toBeLessThanOrEqual(8);
      expect(radius).toBeGreaterThan(0);
    });

    it("does not degenerate into large 32px pill shape even for small heights", () => {
      const codeBlock = newCodeBlockElement({
        x: 100,
        y: 100,
        width: 480,
        height: 49,
      });

      const radius = getCornerRadius(49, codeBlock);
      expect(radius).toBe(8);
    });
  });

  describe("Uniform scaling reflow invariance", () => {
    it("preserves exact visual line count across proportional corner resizing", () => {
      const code =
        "function calculateMetrics() {\n  const longExpression = firstFactor * secondFactor + thirdFactor;\n  return longExpression;\n}";
      const origElement = newCodeBlockElement({
        x: 100,
        y: 100,
        width: 480,
        fontSize: 14,
        code,
      });

      const baselineLayout = getCodeBlockLayout(origElement);
      const baselineLineCount = baselineLayout.visualLines.length;

      const scene = {
        mutateElement: (el: any, updates: any) => Object.assign(el, updates),
        getNonDeletedElementsMap: () =>
          new Map([[origElement.id, origElement]]),
      } as any;

      const element2x = { ...origElement };
      resizeSingleCodeBlockElement(
        origElement,
        element2x,
        scene,
        "se",
        false,
        origElement.width * 2,
        origElement.height * 2,
      );
      const layout2x = getCodeBlockLayout(element2x);
      expect(layout2x.visualLines.length).toBe(baselineLineCount);

      const elementSmall = { ...origElement };
      resizeSingleCodeBlockElement(
        origElement,
        elementSmall,
        scene,
        "se",
        false,
        origElement.width * 0.75,
        origElement.height * 0.75,
      );
      const layoutSmall = getCodeBlockLayout(elementSmall);
      expect(layoutSmall.visualLines.length).toBe(baselineLineCount);
    });
  });

  describe("Hanging indents on wrapped continuation lines", () => {
    it("preserves leading whitespace on wrapped continuation sublines", () => {
      const code =
        "  const veryLongIdentifierThatWillWrapOntoMultipleLinesInANarrowCodeBlock = 42;";
      const codeBlock = newCodeBlockElement({
        x: 100,
        y: 100,
        width: 320,
        fontSize: 14,
        code,
      });

      const layout = getCodeBlockLayout(codeBlock);
      expect(layout.visualLines.length).toBeGreaterThan(1);

      expect(layout.visualLines[0].isFirstSubLine).toBe(true);
      expect(layout.visualLines[0].indentLength).toBe(0);

      for (let i = 1; i < layout.visualLines.length; i++) {
        const subLine = layout.visualLines[i];
        expect(subLine.isFirstSubLine).toBe(false);
        expect(subLine.indentLength).toBe(2);
        expect(subLine.text.startsWith("  ")).toBe(true);
      }
    });

    it("calculates caret index accurately with hanging indents", () => {
      const code =
        "    const longLine = someLongFunctionCall(firstArg, secondArg, thirdArg);";
      const codeBlock = newCodeBlockElement({
        x: 100,
        y: 100,
        width: 300,
        fontSize: 14,
        code,
      });

      const layout = getCodeBlockLayout(codeBlock);
      expect(layout.visualLines.length).toBeGreaterThan(1);
      const secondSubline = layout.visualLines[1];
      expect(secondSubline.indentLength).toBe(4);

      const contentX = 100 + layout.padding + layout.gutterWidth;
      const contentY = 100 + layout.padding + layout.lineHeightPx;

      const caretAtIndent = getCodeBlockCaretIndexAtCoords(codeBlock, {
        x: contentX + 2 * layout.charWidth,
        y: contentY + 2,
      });
      expect(caretAtIndent).toBe(secondSubline.subLineStartInLogicalLine);
    });
  });

  describe("Proportional padding and gutter scaling", () => {
    it("scales padding and gutter proportionally with fontSize", () => {
      const codeBlock14 = newCodeBlockElement({
        x: 0,
        y: 0,
        fontSize: 14,
      });
      const layout14 = getCodeBlockLayout(codeBlock14);
      expect(layout14.padding).toBe(CODE_BLOCK_PADDING);

      const codeBlock28 = newCodeBlockElement({
        x: 0,
        y: 0,
        fontSize: 28,
      });
      const layout28 = getCodeBlockLayout(codeBlock28);
      expect(layout28.padding).toBe(CODE_BLOCK_PADDING * 2);
      expect(layout28.gutterWidth).toBeGreaterThan(layout14.gutterWidth);
    });
  });
});
