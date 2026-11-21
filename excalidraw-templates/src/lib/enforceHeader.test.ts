import { describe, expect, it } from "vitest";
import { enforceHeader, wasHeaderCorrected } from "./enforceHeader";

describe("enforceHeader", () => {
  it("leaves correctly-headered mermaid untouched", () => {
    const input = "flowchart TD\n    A[Start] --> B[End]";
    expect(enforceHeader(input, "flowchart TD")).toBe(input);
  });

  it("strips a ```mermaid fenced block", () => {
    const input = "```mermaid\nflowchart TD\n    A --> B\n```";
    expect(enforceHeader(input, "flowchart TD")).toBe(
      "flowchart TD\n    A --> B",
    );
  });

  it("strips a bare ``` fenced block", () => {
    const input = "```\nflowchart TD\n    A --> B\n```";
    expect(enforceHeader(input, "flowchart TD")).toBe(
      "flowchart TD\n    A --> B",
    );
  });

  it("trims surrounding whitespace", () => {
    const input = "\n\n  flowchart TD\n    A --> B\n\n  ";
    expect(enforceHeader(input, "flowchart TD")).toBe(
      "flowchart TD\n    A --> B",
    );
  });

  it("replaces a wrong-but-recognized diagram-type header", () => {
    const input = "classDiagram\n    Animal <|-- Dog";
    expect(enforceHeader(input, "flowchart TD")).toBe(
      "flowchart TD\n    Animal <|-- Dog",
    );
  });

  it("replaces a wrong header even when the body's own directive-looking lines get stripped as a side effect", () => {
    // "class Animal" is legitimate classDiagram body syntax, but once the
    // header is forced to flowchart TD it's indistinguishable from a
    // flowchart `class nodeId className` directive line and is dropped —
    // documenting that tradeoff, not asserting it's semantically ideal.
    const input = "classDiagram\n    class Animal";
    expect(enforceHeader(input, "flowchart TD")).toBe("flowchart TD");
  });

  it("replaces a mindmap header with the expected header", () => {
    const input = "mindmap\n  root((Idea))";
    expect(enforceHeader(input, "flowchart TD")).toBe(
      "flowchart TD\n  root((Idea))",
    );
  });

  it("replaces a graph header (mermaid alias for flowchart)", () => {
    const input = "graph LR\n    A --> B";
    expect(enforceHeader(input, "flowchart TD")).toBe(
      "flowchart TD\n    A --> B",
    );
  });

  it("prepends the header when the first line isn't a diagram keyword", () => {
    const input = "A[Start] --> B[End]";
    expect(enforceHeader(input, "flowchart TD")).toBe(
      "flowchart TD\nA[Start] --> B[End]",
    );
  });

  it("prepends the header but preserves interior indentation on later lines", () => {
    const input = "A[Start] --> B[End]\n    B --> C[End2]";
    expect(enforceHeader(input, "flowchart TD")).toBe(
      "flowchart TD\nA[Start] --> B[End]\n    B --> C[End2]",
    );
  });

  it("prepends the header for plain prose with no diagram syntax", () => {
    const input = "Sure, here's a diagram of the process:";
    expect(enforceHeader(input, "flowchart TD")).toBe(
      "flowchart TD\nSure, here's a diagram of the process:",
    );
  });

  it("returns the bare header for empty input", () => {
    expect(enforceHeader("", "flowchart TD")).toBe("flowchart TD");
  });

  it("returns the bare header for whitespace-only input", () => {
    expect(enforceHeader("   \n\n  ", "flowchart TD")).toBe("flowchart TD");
  });

  it("removes style directive lines", () => {
    const input = "flowchart TD\n    A --> B\n    style A fill:#f00";
    expect(enforceHeader(input, "flowchart TD")).toBe(
      "flowchart TD\n    A --> B",
    );
  });

  it("removes classDef directive lines", () => {
    const input =
      "flowchart TD\n    A --> B\n    classDef important fill:#f00";
    expect(enforceHeader(input, "flowchart TD")).toBe(
      "flowchart TD\n    A --> B",
    );
  });

  it("removes class directive lines without touching classDiagram header replacement", () => {
    const input = "flowchart TD\n    A --> B\n    class A important";
    expect(enforceHeader(input, "flowchart TD")).toBe(
      "flowchart TD\n    A --> B",
    );
  });

  it("removes click directive lines", () => {
    const input =
      'flowchart TD\n    A --> B\n    click A "https://example.com"';
    expect(enforceHeader(input, "flowchart TD")).toBe(
      "flowchart TD\n    A --> B",
    );
  });

  it("removes init directive lines", () => {
    const input = "flowchart TD\n    A --> B\n    init something";
    expect(enforceHeader(input, "flowchart TD")).toBe(
      "flowchart TD\n    A --> B",
    );
  });

  it("removes multiple directive lines at once", () => {
    const input = [
      "flowchart TD",
      "    A --> B",
      "    style A fill:#f00",
      "    classDef x fill:#000",
      "    class A x",
      '    click A "https://example.com"',
      "    B --> C",
    ].join("\n");
    expect(enforceHeader(input, "flowchart TD")).toBe(
      "flowchart TD\n    A --> B\n    B --> C",
    );
  });

  it("does not strip a node/class label merely containing a directive keyword mid-line", () => {
    const input = "flowchart TD\n    A[classified data] --> B";
    expect(enforceHeader(input, "flowchart TD")).toBe(input);
  });

  it("handles the adversarial 'ignore the template' style completion", () => {
    const input =
      "Sure! Here's a sequence diagram instead:\nsequenceDiagram\n    Alice->>Bob: Hi";
    expect(enforceHeader(input, "flowchart TD")).toBe(
      "flowchart TD\nSure! Here's a sequence diagram instead:\nsequenceDiagram\n    Alice->>Bob: Hi",
    );
  });
});

describe("wasHeaderCorrected", () => {
  it("is false when the header already matches", () => {
    const input = "flowchart TD\n    A --> B";
    expect(wasHeaderCorrected(input, "flowchart TD")).toBe(false);
  });

  it("is false when the header matches inside a fenced block", () => {
    const input = "```mermaid\nflowchart TD\n    A --> B\n```";
    expect(wasHeaderCorrected(input, "flowchart TD")).toBe(false);
  });

  it("is true when the model returned the wrong recognized diagram type", () => {
    const input = "classDiagram\n    Animal <|-- Dog";
    expect(wasHeaderCorrected(input, "flowchart TD")).toBe(true);
  });

  it("is true when the model returned no header at all", () => {
    const input = "A[Start] --> B[End]";
    expect(wasHeaderCorrected(input, "flowchart TD")).toBe(true);
  });

  it("is true for empty input", () => {
    expect(wasHeaderCorrected("", "flowchart TD")).toBe(true);
  });
});
