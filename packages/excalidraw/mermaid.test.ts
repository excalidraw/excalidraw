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
    expect(
      isMaybeMermaidDefinition(
        "---\ntitle: Example\n---\nflowchart TD\n  A --> B",
      ),
    ).toBe(true);
    expect(
      isMaybeMermaidDefinition("%% a comment\nflowchart TD\n  A --> B"),
    ).toBe(true);
    expect(
      isMaybeMermaidDefinition(
        '%%{init: {\n  "theme": "dark"\n}}%%\nflowchart TD\n  A --> B',
      ),
    ).toBe(true);
    expect(isMaybeMermaidDefinition("%%{init: {}}%%flowchart TD")).toBe(true);

    expect(isMaybeMermaidDefinition("graphs")).toBe(false);
    expect(isMaybeMermaidDefinition("this flowchart")).toBe(false);
    expect(isMaybeMermaidDefinition("this\nflowchart")).toBe(false);
    expect(
      isMaybeMermaidDefinition("---\ntitle: Example\n---\nnot a diagram"),
    ).toBe(false);
  });
});
