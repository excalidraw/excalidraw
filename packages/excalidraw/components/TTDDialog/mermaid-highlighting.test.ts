import {
  getMermaidHighlightToken,
  tokenizeMermaid,
} from "./mermaid-highlighting";

describe("mermaid highlighting", () => {
  it("tokenizes mermaid syntax with shared token types", () => {
    const tokens = tokenizeMermaid('flowchart LR\nA["Hello"] --> B');

    expect(tokens).toEqual([
      { type: "keyword", value: "flowchart" },
      { type: null, value: " " },
      { type: "keyword", value: "LR" },
      { type: null, value: "\n" },
      { type: "variableName", value: "A" },
      { type: "bracket", value: "[" },
      { type: "string", value: '"Hello"' },
      { type: "bracket", value: "]" },
      { type: null, value: " " },
      { type: "operator", value: "-->" },
      { type: null, value: " " },
      { type: "variableName", value: "B" },
    ]);
  });

  it("limits comment tokens to a single line", () => {
    const tokens = tokenizeMermaid("%% comment\nflowchart TD");

    expect(tokens[0]).toEqual({ type: "comment", value: "%% comment" });
    expect(tokens[1]).toEqual({ type: null, value: "\n" });
    expect(tokens[2]).toEqual({ type: "keyword", value: "flowchart" });
  });

  it("falls back to plain text for unsupported characters", () => {
    expect(getMermaidHighlightToken("@node")).toEqual({
      type: null,
      value: "@",
    });
  });
});
