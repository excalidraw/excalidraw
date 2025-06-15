import * as MermaidToExcalidraw from "@excalidraw/mermaid-to-excalidraw";
import React from "react";
import { vi } from "vitest";

import type { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";

export const mockMermaidToExcalidraw = (opts: {
  parseMermaidToExcalidraw: typeof parseMermaidToExcalidraw;
  mockRef?: boolean;
}) => {
  vi.mock("@excalidraw/mermaid-to-excalidraw", async (importActual) => {
    const module = (await importActual()) as any;

    return {
      __esModule: true,
      ...module,
    };
  });
  const parseMermaidToExcalidrawSpy = vi.spyOn(
    MermaidToExcalidraw,
    "parseMermaidToExcalidraw",
  );

  parseMermaidToExcalidrawSpy.mockImplementation(opts.parseMermaidToExcalidraw);

  if (opts.mockRef) {
    vi.spyOn(React, "useRef").mockReturnValue({
      current: {
        parseMermaidToExcalidraw: parseMermaidToExcalidrawSpy,
      },
    });
  }
};

// Mock for HTMLImageElement (use with `vi.unstubAllGlobals()`)
// as jsdom.resources: "usable" throws an error on image load
export const mockHTMLImageElement = (
  naturalWidth: number,
  naturalHeight: number,
) => {
  vi.stubGlobal(
    "Image",
    class extends Image {
      constructor() {
        super();

        Object.defineProperty(this, "naturalWidth", {
          value: naturalWidth,
        });
        Object.defineProperty(this, "naturalHeight", {
          value: naturalHeight,
        });

        queueMicrotask(() => {
          this.onload?.({} as Event);
        });
      }
    },
  );
};
