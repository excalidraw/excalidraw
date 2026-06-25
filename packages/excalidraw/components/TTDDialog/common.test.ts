import { describe, expect, it, vi } from "vitest";

import { convertMermaidToExcalidraw, sanitizeMermaidElementText } from "./common";

type ConvertMermaidArgs = Parameters<typeof convertMermaidToExcalidraw>[0];
type ParseMermaidToExcalidraw = Awaited<
  ConvertMermaidArgs["mermaidToExcalidrawLib"]["api"]
>["parseMermaidToExcalidraw"];

const createConvertArgs = (
  mermaidDefinition: string,
  parseMermaidToExcalidraw: ParseMermaidToExcalidraw,
): ConvertMermaidArgs => {
  const parent = document.createElement("div");
  const canvas = document.createElement("div");
  parent.appendChild(canvas);

  return {
    canvasRef: { current: canvas },
    mermaidToExcalidrawLib: {
      loaded: true,
      api: Promise.resolve({ parseMermaidToExcalidraw }),
    },
    mermaidDefinition,
    setError: vi.fn(),
    data: {
      current: {
        elements: [],
        files: null,
      },
    },
    theme: "light",
  };
};

describe("convertMermaidToExcalidraw", () => {
  it("returns the original parse error when quote-normalized fallback also fails", async () => {
    const originalError = new Error("Parse error on line 9: ...");
    const fallbackError = new Error("Parse error on line 6: ...");

    const parseMermaidToExcalidraw = vi
      .fn<ParseMermaidToExcalidraw>()
      .mockRejectedValueOnce(originalError)
      .mockRejectedValueOnce(fallbackError);

    const mermaidDefinition =
      'graph TD\nA["One"]\nB["Two"]x\nC["Three"]\nD["Four"]';

    const result = await convertMermaidToExcalidraw(
      createConvertArgs(mermaidDefinition, parseMermaidToExcalidraw),
    );

    expect(parseMermaidToExcalidraw).toHaveBeenCalledTimes(2);
    expect(parseMermaidToExcalidraw).toHaveBeenNthCalledWith(
      1,
      mermaidDefinition,
    );
    expect(parseMermaidToExcalidraw).toHaveBeenNthCalledWith(
      2,
      mermaidDefinition.replace(/"/g, "'"),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(originalError);
    }
  });

  it("does not retry quote normalization when the input has no double quotes", async () => {
    const originalError = new Error("Parse error on line 9: ...");
    const parseMermaidToExcalidraw = vi
      .fn<ParseMermaidToExcalidraw>()
      .mockRejectedValueOnce(originalError);

    const mermaidDefinition = "graph TD\nA[One]\nB[Two]x";

    const result = await convertMermaidToExcalidraw(
      createConvertArgs(mermaidDefinition, parseMermaidToExcalidraw),
    );

    expect(parseMermaidToExcalidraw).toHaveBeenCalledTimes(1);
    expect(parseMermaidToExcalidraw).toHaveBeenCalledWith(mermaidDefinition);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(originalError);
    }
  });
});

describe("sanitizeMermaidElementText", () => {
  it("converts <br> tags to newlines and strips other HTML", () => {
    const elements = [
      {
        type: "rectangle",
        id: "1",
        label: { text: "Hello<br/>World" },
      },
      {
        type: "text",
        id: "2",
        text: "Line 1<br>Line 2",
      },
      {
        type: "arrow",
        id: "3",
        start: { type: "text", text: "Start<br>Point" },
        end: { type: "text", text: "End<br>Point" },
        label: { text: "<b>Bold</b> Label" },
      },
    ] as any;

    const sanitized = sanitizeMermaidElementText(elements) as any[];

    expect(sanitized[0].label.text).toBe("Hello\nWorld");
    expect(sanitized[1].text).toBe("Line 1\nLine 2");
    expect(sanitized[2].label.text).toBe("Bold Label");
  });

  it("converts literal \\n to actual newlines", () => {
    const elements = [
      {
        type: "text",
        id: "1",
        text: "Line 1\\nLine 2",
      },
      {
        type: "rectangle",
        id: "2",
        label: { text: "Label\\nNewline" },
      },
    ] as any;

    const sanitized = sanitizeMermaidElementText(elements) as any[];

    expect(sanitized[0].text).toBe("Line 1\nLine 2");
    expect(sanitized[1].label.text).toBe("Label\nNewline");
  });

  it("decodes HTML entities and strips resulting tags", () => {
    const elements = [
      {
        type: "text",
        id: "1",
        text: "&lt;b&gt;Bold&lt;/b&gt; &amp; &quot;Quotes&quot;",
      },
      {
        type: "rectangle",
        id: "2",
        label: { text: "A &gt; B" },
      },
    ] as any;

    const sanitized = sanitizeMermaidElementText(elements) as any[];

    expect(sanitized[0].text).toBe("Bold & \"Quotes\"");
    expect(sanitized[1].label.text).toBe("A > B");
  });

  it("handles missing text fields gracefully", () => {
    const elements = [
      {
        type: "rectangle",
        id: "1",
      },
      {
        type: "arrow",
        id: "2",
        label: {},
      },
    ] as any;

    const sanitized = sanitizeMermaidElementText(elements) as any[];
    expect(sanitized[0].id).toBe("1");
    expect(sanitized[1].id).toBe("2");
  });
});
