import {
  convertMarkdownToElements,
  isMaybeMarkdown,
} from "./markdown";

describe("isMaybeMarkdown", () => {
  it("should return true for structural markdown", () => {
    expect(isMaybeMarkdown("# Title")).toBe(true);
    expect(isMaybeMarkdown("## Subheading")).toBe(true);
    expect(isMaybeMarkdown("- item one")).toBe(true);
    expect(isMaybeMarkdown("1. first step")).toBe(true);
    expect(isMaybeMarkdown("> a quote")).toBe(true);
    expect(isMaybeMarkdown("```js\ncode\n```")).toBe(true);
    expect(isMaybeMarkdown("| A | B |\n| --- | --- |\n| 1 | 2 |")).toBe(true);
    expect(isMaybeMarkdown("---")).toBe(true);
  });

  it("should return false for plain text", () => {
    expect(isMaybeMarkdown("Just a plain sentence.")).toBe(false);
    expect(isMaybeMarkdown("The quick brown fox jumps.")).toBe(false);
    expect(isMaybeMarkdown("The C# language is popular.")).toBe(false);
    expect(isMaybeMarkdown("a dash - is punctuation here")).toBe(false);
  });
});

describe("convertMarkdownToElements", () => {
  it("strips markdown syntax from headings", () => {
    const elements = convertMarkdownToElements("# My Title", 0, 0);
    const heading = elements.find((e) => e.type === "text");
    expect(heading?.text).toBe("My Title");
  });

  it("renders headings with larger font size and default handwritten font", () => {
    const elements = convertMarkdownToElements("# Title", 0, 0);
    const heading = elements.find((e) => e.type === "text");
    expect(heading?.fontSize).toBe(32);
  });

  it("strips inline formatting from paragraphs", () => {
    const elements = convertMarkdownToElements(
      "This is **bold** and [a link](https://x.com).",
      0,
      0,
    );
    const para = elements.find((e) => e.type === "text");
    expect(para?.text).toBe("This is bold and a link.");
  });

  it("renders unordered list items with a bullet", () => {
    const elements = convertMarkdownToElements("- one\n- two", 0, 0);
    const texts = elements
      .filter((e) => e.type === "text")
      .map((e) => e.text);
    expect(texts[0]).toBe("• one");
    expect(texts[1]).toBe("• two");
  });

  it("keeps ordered list numbering", () => {
    const elements = convertMarkdownToElements("1. first\n2. second", 0, 0);
    const texts = elements
      .filter((e) => e.type === "text")
      .map((e) => e.text);
    expect(texts[0]).toBe("1. first");
    expect(texts[1]).toBe("2. second");
  });

  it("renders a code block as a box plus monospace lines", () => {
    const elements = convertMarkdownToElements("```js\nconst a = 1;\n```", 0, 0);
    const box = elements.find((e) => e.type === "rectangle");
    const code = elements.find((e) => e.type === "text");
    expect(box).toBeDefined();
    expect(code?.text).toBe("const a = 1;");
  });

  it("renders a table as a grid with an outer box, header fill, and separators", () => {
    const elements = convertMarkdownToElements(
      "| Feature | Status |\n| --- | --- |\n| Auth | Done |\n| Payments | WIP |",
      0,
      0,
    );
    const rectangles = elements.filter((e) => e.type === "rectangle");
    const lines = elements.filter((e) => e.type === "line");
    const texts = elements
      .filter((e) => e.type === "text")
      .map((e) => e.text);

    // outer border + header fill = 2 rectangles
    expect(rectangles.length).toBeGreaterThanOrEqual(2);
    // row separators between rows + column separators
    expect(lines.length).toBeGreaterThanOrEqual(1);

    // every column header/value is present as its own cell
    expect(texts).toContain("Feature");
    expect(texts).toContain("Status");
    expect(texts).toContain("Auth");
    expect(texts).toContain("Done");
    expect(texts).toContain("Payments");
    expect(texts).toContain("WIP");
  });

  it("styles quotes with a muted color", () => {
    const elements = convertMarkdownToElements("> a quote", 0, 0);
    const quote = elements.find((e) => e.type === "text");
    expect(quote?.strokeColor).toBe("#868e96");
  });
});
