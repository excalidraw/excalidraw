import { isMaybeMermaidDefinition } from "./mermaid";

describe("isMaybeMermaidDefinition", () => {
  it("should return true for a valid mermaid definition", () => {
    expect(isMaybeMermaidDefinition("flowchart")).toBe(true);
    expect(isMaybeMermaidDefinition("flowchart LR")).toBe(true);
    expect(isMaybeMermaidDefinition("flowchart LR\nola")).toBe(true);
    expect(isMaybeMermaidDefinition("%%{}%%flowchart")).toBe(true);
    expect(isMaybeMermaidDefinition("%%{}%% flowchart")).toBe(true);
    expect(
      isMaybeMermaidDefinition("swimlane-beta LR\n  subgraph Customer"),
    ).toBe(true);
  });

  it("should skip comments, directives and front matter before the diagram type", () => {
    expect(
      isMaybeMermaidDefinition(
        "%% model: x\n%% prompt: 54. A hackathon\ngantt\n  title A",
      ),
    ).toBe(true);
    expect(
      isMaybeMermaidDefinition(
        "\n%%{init: {\n  'theme': 'dark'\n}}%%\n%% a\n\nsequenceDiagram",
      ),
    ).toBe(true);
    expect(
      isMaybeMermaidDefinition(
        "---\ntitle: A\nconfig:\n  theme: dark\n---\nflowchart TD\n  A --> B",
      ),
    ).toBe(true);
    expect(isMaybeMermaidDefinition("---\r\ntitle: A\r\n---\r\npie")).toBe(
      true,
    );

    expect(isMaybeMermaidDefinition("%% flowchart")).toBe(false);
    expect(isMaybeMermaidDefinition("%% a\nnot a diagram")).toBe(false);
    expect(isMaybeMermaidDefinition("---\nflowchart")).toBe(false);
  });

  it("should check text with many unclosed directives in linear time", () => {
    // took seconds (quadratic) when each directive was searched for its end
    // to the end of the text
    const text = `${"%%{".padEnd(50, "x")}\n`.repeat(20000);
    const start = performance.now();
    expect(isMaybeMermaidDefinition(text)).toBe(false);
    expect(performance.now() - start).toBeLessThan(500);
  });

  it("should return false for text that isn't a mermaid definition", () => {
    expect(isMaybeMermaidDefinition("graphs")).toBe(false);
    expect(isMaybeMermaidDefinition("this flowchart")).toBe(false);
    expect(isMaybeMermaidDefinition("this\nflowchart")).toBe(false);
  });
});
