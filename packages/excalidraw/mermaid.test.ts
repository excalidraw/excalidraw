import {
  isMaybeMermaidDefinition,
  sanitizeMermaidElementText,
} from "./mermaid";

describe("isMaybeMermaidDefinition", () => {
  it("should return true for a valid mermaid definition", () => {
    expect(isMaybeMermaidDefinition("flowchart")).toBe(true);
    expect(isMaybeMermaidDefinition("flowchart LR")).toBe(true);
    expect(isMaybeMermaidDefinition("flowchart LR\nola")).toBe(true);
    expect(isMaybeMermaidDefinition("%%{}%%flowchart")).toBe(true);
    expect(isMaybeMermaidDefinition("%%{}%% flowchart")).toBe(true);

    expect(isMaybeMermaidDefinition("graphs")).toBe(false);
    expect(isMaybeMermaidDefinition("this flowchart")).toBe(false);
    expect(isMaybeMermaidDefinition("this\nflowchart")).toBe(false);
  });
});

describe("sanitizeMermaidElementText", () => {
  it("should replace <br> in element text with newline", () => {
    const elements = [{ text: "User Registration<br>Process" }];
    const result = sanitizeMermaidElementText(elements);
    expect(result[0].text).toBe("User Registration\nProcess");
  });

  it("should replace <br/> and <br /> variants", () => {
    const elements = [
      { text: "Line1<br/>Line2" },
      { text: "Line1<br />Line2" },
    ];
    const result = sanitizeMermaidElementText(elements);
    expect(result[0].text).toBe("Line1\nLine2");
    expect(result[1].text).toBe("Line1\nLine2");
  });

  it("should replace <br> in label.text", () => {
    const elements = [
      {
        label: { text: "Validate Input<br>Data", fontSize: 20 },
      },
    ];
    const result = sanitizeMermaidElementText(elements);
    expect(result[0].label!.text).toBe("Validate Input\nData");
    // Preserve other label properties
    expect((result[0].label as any).fontSize).toBe(20);
  });

  it("should handle case-insensitive tags", () => {
    const elements = [{ text: "Hello<BR>World<Br/>End" }];
    const result = sanitizeMermaidElementText(elements);
    expect(result[0].text).toBe("Hello\nWorld\nEnd");
  });

  it("should not modify elements without <br> tags", () => {
    const elements = [{ text: "No breaks here" }];
    const result = sanitizeMermaidElementText(elements);
    expect(result[0]).toBe(elements[0]); // same reference, not cloned
  });

  it("should handle multiple <br> tags in a single string", () => {
    const elements = [{ text: "A<br>B<br>C<br>D" }];
    const result = sanitizeMermaidElementText(elements);
    expect(result[0].text).toBe("A\nB\nC\nD");
  });

  it("should handle elements with both text and label", () => {
    const elements = [
      { text: "Main<br>Text", label: { text: "Label<br>Text" } },
    ];
    const result = sanitizeMermaidElementText(elements);
    expect(result[0].text).toBe("Main\nText");
    expect(result[0].label!.text).toBe("Label\nText");
  });
});
