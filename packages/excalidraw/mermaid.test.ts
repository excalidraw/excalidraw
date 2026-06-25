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
  it("should replace <br> tags with newlines in label.text", () => {
    const elements = [
      {
        type: "rectangle",
        x: 0,
        y: 0,
        label: { text: "User Registration<br>Process" },
      },
    ];
    const result = sanitizeMermaidElementText(elements);
    expect(result[0].label.text).toBe("User Registration\nProcess");
  });

  it("should replace <br/> and <br /> variants in label.text", () => {
    const elements = [
      {
        type: "rectangle",
        x: 0,
        y: 0,
        label: { text: "Line 1<br/>Line 2<br />Line 3" },
      },
    ];
    const result = sanitizeMermaidElementText(elements);
    expect(result[0].label.text).toBe("Line 1\nLine 2\nLine 3");
  });

  it("should replace <br> tags in direct text property", () => {
    const elements = [
      {
        type: "text",
        x: 0,
        y: 0,
        text: "Hello<br>World",
      },
    ];
    const result = sanitizeMermaidElementText(elements);
    expect(result[0].text).toBe("Hello\nWorld");
  });

  it("should handle case-insensitive <BR> tags", () => {
    const elements = [
      {
        type: "rectangle",
        x: 0,
        y: 0,
        label: { text: "Line 1<BR>Line 2<Br>Line 3" },
      },
    ];
    const result = sanitizeMermaidElementText(elements);
    expect(result[0].label.text).toBe("Line 1\nLine 2\nLine 3");
  });

  it("should not modify elements without text or label", () => {
    const elements = [
      {
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      },
    ];
    const result = sanitizeMermaidElementText(elements);
    expect(result[0]).toEqual(elements[0]);
  });

  it("should not modify text that contains no <br> tags", () => {
    const elements = [
      {
        type: "rectangle",
        x: 0,
        y: 0,
        label: { text: "No breaks here" },
      },
    ];
    const result = sanitizeMermaidElementText(elements);
    expect(result[0].label.text).toBe("No breaks here");
  });

  it("should not mutate the original elements array", () => {
    const elements = [
      {
        type: "rectangle",
        x: 0,
        y: 0,
        label: { text: "Hello<br>World" },
      },
    ];
    sanitizeMermaidElementText(elements);
    expect(elements[0].label.text).toBe("Hello<br>World");
  });
});
