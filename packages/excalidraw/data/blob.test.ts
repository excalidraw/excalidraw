import { MIME_TYPES } from "@excalidraw/common";

import { normalizeFile } from "./blob";

// PNG magic bytes: 137 80 78 71 13 10 26 10
const PNG_MAGIC = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

describe("normalizeFile", () => {
  it("should detect SVG content in .excalidraw file", async () => {
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"></svg>`;
    const file = new File([svgContent], "drawing.excalidraw", {
      type: "",
    });
    const result = await normalizeFile(file);
    expect(result.type).toBe(MIME_TYPES.svg);
  });

  it("should detect SVG content starting with <svg in .excalidraw file", async () => {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>`;
    const file = new File([svgContent], "drawing.excalidraw", {
      type: "",
    });
    const result = await normalizeFile(file);
    expect(result.type).toBe(MIME_TYPES.svg);
  });

  it("should detect SVG content with leading whitespace in .excalidraw file", async () => {
    const svgContent = `  \n  <?xml version="1.0"?><svg></svg>`;
    const file = new File([svgContent], "drawing.excalidraw", {
      type: "",
    });
    const result = await normalizeFile(file);
    expect(result.type).toBe(MIME_TYPES.svg);
  });

  it("should detect PNG content in .excalidraw file", async () => {
    const file = new File([PNG_MAGIC], "drawing.excalidraw", {
      type: "",
    });
    const result = await normalizeFile(file);
    expect(result.type).toBe(MIME_TYPES.png);
  });

  it("should keep excalidraw MIME for valid JSON content in .excalidraw file", async () => {
    const jsonContent = JSON.stringify({
      type: "excalidraw",
      version: 2,
      elements: [],
    });
    const file = new File([jsonContent], "drawing.excalidraw", {
      type: "",
    });
    const result = await normalizeFile(file);
    expect(result.type).toBe(MIME_TYPES.excalidraw);
  });

  it("should not sniff content for .excalidrawlib files", async () => {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg"></svg>`;
    const file = new File([svgContent], "lib.excalidrawlib", {
      type: "",
    });
    const result = await normalizeFile(file);
    expect(result.type).toBe(MIME_TYPES.excalidrawlib);
  });
});
