import {
  CODE_BLOCK_PADDING,
  isCodeBlockTextElement,
  normalizeCodeLanguage,
  tokenizeCode,
} from "../src/codeBlock";
import { newCodeBlockElements } from "../src/newElement";

describe("normalizeCodeLanguage", () => {
  it("maps aliases to canonical language ids", () => {
    expect(normalizeCodeLanguage("js")).toBe("javascript");
    expect(normalizeCodeLanguage("TS")).toBe("typescript");
    expect(normalizeCodeLanguage("py")).toBe("python");
    expect(normalizeCodeLanguage("c++")).toBe("cpp");
    expect(normalizeCodeLanguage("xml")).toBe("html");
  });

  it("falls back to plaintext for unknown languages", () => {
    expect(normalizeCodeLanguage("brainfuck")).toBe("plaintext");
  });

  it("defaults to javascript when empty", () => {
    expect(normalizeCodeLanguage("")).toBe("javascript");
    expect(normalizeCodeLanguage(null)).toBe("javascript");
  });
});

describe("tokenizeCode", () => {
  it("splits source into one entry per line, preserving indentation", () => {
    const code = "def f(x):\n    return x";
    const lines = tokenizeCode(code, "python", "dark");
    expect(lines).toHaveLength(2);
    // the second line keeps its leading whitespace
    const secondLineText = lines[1].map((run) => run.text).join("");
    expect(secondLineText.startsWith("    ")).toBe(true);
  });

  it("assigns distinct colors to keywords vs identifiers", () => {
    const lines = tokenizeCode("const x = 1;", "javascript", "dark");
    const runs = lines[0];
    const keywordRun = runs.find((run) => run.text === "const");
    const numberRun = runs.find((run) => run.text === "1");
    expect(keywordRun).toBeDefined();
    expect(numberRun).toBeDefined();
    expect(keywordRun!.color).not.toBe(numberRun!.color);
  });

  it("round-trips the source text across runs", () => {
    const code = "function add(a, b) {\n  return a + b;\n}";
    const roundTrip = tokenizeCode(code, "javascript", "light")
      .map((line) => line.map((run) => run.text).join(""))
      .join("\n");
    expect(roundTrip).toBe(code);
  });
});

describe("newCodeBlockElements", () => {
  it("creates a grouped rectangle container + code text element", () => {
    const { container, text } = newCodeBlockElements({
      code: "print('hi')",
      language: "python",
      theme: "dark",
      x: 100,
      y: 200,
    });

    expect(container.type).toBe("rectangle");
    expect(text.type).toBe("text");
    expect(isCodeBlockTextElement(text)).toBe(true);
    expect((container.customData?.codeBlock as any).language).toBe("python");

    // shared group so they move/select together
    expect(container.groupIds).toEqual(text.groupIds);
    expect(container.groupIds.length).toBe(1);

    // container wraps the text with padding on both axes
    expect(text.x).toBe(container.x + CODE_BLOCK_PADDING);
    expect(text.y).toBe(container.y + CODE_BLOCK_PADDING);
    expect(container.width).toBeGreaterThan(text.width);
    expect(container.height).toBeGreaterThan(text.height);
  });

  it("expands tabs so indentation renders with the monospace grid", () => {
    const { text } = newCodeBlockElements({
      code: "if x:\n\treturn",
      language: "python",
      x: 0,
      y: 0,
    });
    expect(text.text).not.toContain("\t");
  });
});
