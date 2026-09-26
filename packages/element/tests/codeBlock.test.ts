import {
  normalizeCodeLanguage,
  parseMarkdownCodeFenceLines,
  tokenizeCode,
} from "../src/codeBlock";

describe("normalizeCodeLanguage", () => {
  it("maps aliases to bundled Prism language ids", () => {
    expect(normalizeCodeLanguage("js")).toBe("javascript");
    expect(normalizeCodeLanguage("TS")).toBe("typescript");
    expect(normalizeCodeLanguage("py")).toBe("python");
    expect(normalizeCodeLanguage("c++")).toBe("cpp");
    expect(normalizeCodeLanguage("xml")).toBe("html");
  });

  it("uses plaintext for an absent or unsupported language", () => {
    expect(normalizeCodeLanguage()).toBe("plaintext");
    expect(normalizeCodeLanguage("brainfuck")).toBe("plaintext");
  });
});

describe("tokenizeCode", () => {
  it("preserves source text, line breaks, and indentation", () => {
    const code = "def f(x):\n    return x";
    const roundTrip = tokenizeCode(code, "python", "dark")
      .map((line) => line.map((run) => run.text).join(""))
      .join("\n");

    expect(roundTrip).toBe(code);
  });

  it("assigns distinct colors to syntax token types", () => {
    const runs = tokenizeCode("const x = 1;", "javascript", "dark")[0];
    const keywordRun = runs.find((run) => run.text === "const");
    const numberRun = runs.find((run) => run.text === "1");

    expect(keywordRun?.color).toBeDefined();
    expect(numberRun?.color).toBeDefined();
    expect(keywordRun?.color).not.toBe(numberRun?.color);
  });
});

describe("parseMarkdownCodeFenceLines", () => {
  it("detects fenced sections inside ordinary text", () => {
    const lines = parseMarkdownCodeFenceLines(
      [
        "Before",
        "```js",
        "const value = 1;",
        "```",
        "After",
        "~~~py",
        "return True",
        "~~~~",
      ].join("\n"),
      "light",
    );

    expect(lines?.map((line) => line.type)).toEqual([
      "text",
      "fence",
      "code",
      "fence",
      "text",
      "fence",
      "code",
      "fence",
    ]);
    expect(
      lines?.[2].type === "code"
        ? lines[2].runs.map((run) => run.text).join("")
        : null,
    ).toBe("const value = 1;");
  });

  it("highlights an unfinished fence while it is edited", () => {
    const lines = parseMarkdownCodeFenceLines(
      "```ts\nconst value: number = 1;",
      "dark",
    );

    expect(lines?.map((line) => line.type)).toEqual(["fence", "code"]);
  });

  it("keeps an empty block aligned with its two source lines", () => {
    const lines = parseMarkdownCodeFenceLines("```js\n```", "dark");

    expect(lines?.map((line) => line.type)).toEqual(["fence", "fence"]);
  });

  it("does no parsing work for regular text", () => {
    expect(parseMarkdownCodeFenceLines("const value = 1;", "dark")).toBeNull();
  });
});
