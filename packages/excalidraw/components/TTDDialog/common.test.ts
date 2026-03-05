import { describe, expect, it, vi } from "vitest";

import { convertMermaidToExcalidraw } from "./common";

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
