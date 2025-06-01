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

export class ImageMock {
  onload: (() => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  complete: boolean = false;
  private _src: string = "";

  get src(): string {
    return this._src;
  }

  set src(value: string) {
    this._src = value;

    if (value) {
      // simulate image loading
      setTimeout(() => {
        this.complete = true;
        if (this.onload) {
          this.onload();
        }
      }, 0);
    }
  }
}
