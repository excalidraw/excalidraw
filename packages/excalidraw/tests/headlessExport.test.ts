import { MIME_TYPES } from "@excalidraw/common";
import {
  newElement,
  newFreeDrawElement,
  newImageElement,
  newTextElement,
  getRenderEnvironment,
  resetRenderEnvironment,
  setRenderEnvironment,
} from "@excalidraw/element";
import { vi } from "vitest";

import type {
  ExcalidrawFreeDrawElement,
  FileId,
} from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";
import { exportToCanvas } from "../scene/export";

import type { AppState, BinaryFiles, DataURL } from "../types";

/**
 * A 1x1 transparent PNG, so the image element takes the real (non-placeholder)
 * rendering path.
 */
const PNG_DATA_URL =
  `data:${MIME_TYPES.png};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==` as DataURL;

describe("headless export environment", () => {
  afterEach(() => {
    resetRenderEnvironment();
    vi.restoreAllMocks();
  });

  it("routes every canvas and image through the injected environment", async () => {
    const createElementSpy = vi.spyOn(document, "createElement");

    const createdCanvases: HTMLCanvasElement[] = [];
    const createdImages: HTMLImageElement[] = [];

    // built up front so the factories below never call the spied-on
    // document.createElement themselves
    const canvasPool = Array.from({ length: 32 }, () =>
      document.createElement("canvas"),
    );
    // jsdom never actually loads images, so resolve them the way
    // `mockHTMLImageElement` does
    const imagePool = Array.from({ length: 32 }, () => {
      const image = document.createElement("img");
      Object.defineProperty(image, "naturalWidth", { value: 10 });
      Object.defineProperty(image, "naturalHeight", { value: 10 });
      let src = "";
      Object.defineProperty(image, "src", {
        get: () => src,
        set: (value: string) => {
          src = value;
          queueMicrotask(() => image.onload?.({} as Event));
        },
      });
      return image;
    });

    setRenderEnvironment({
      createCanvas: () => {
        const canvas = canvasPool[createdCanvases.length];
        createdCanvases.push(canvas);
        return canvas;
      },
      createImage: () => {
        const image = imagePool[createdImages.length];
        createdImages.push(image);
        return image;
      },
    });

    const fileId = "headless-image" as FileId;
    const elements = [
      newTextElement({ x: 0, y: 0, text: "headless", fontSize: 20 }),
      newImageElement({
        type: "image",
        x: 0,
        y: 40,
        width: 10,
        height: 10,
        fileId,
        status: "saved",
        scale: [1, 1],
      }),
    ];
    const files: BinaryFiles = {
      [fileId]: {
        id: fileId,
        dataURL: PNG_DATA_URL,
        mimeType: MIME_TYPES.png,
        created: 0,
        lastRetrieved: 0,
      },
    };

    createElementSpy.mockClear();

    const canvas = await exportToCanvas(
      elements,
      { ...getDefaultAppState(), width: 100, height: 100 } as AppState,
      files,
      {
        exportBackground: true,
        viewBackgroundColor: "#ffffff",
      },
      (width, height) => {
        const target = canvasPool[canvasPool.length - 1];
        target.width = width;
        target.height = height;
        return { canvas: target, scale: 1 };
      },
      async () => {},
    );

    expect(canvas).toBe(canvasPool[canvasPool.length - 1]);
    // text measurement and the image cache both went through the environment
    expect(createdCanvases.length).toBeGreaterThan(0);
    expect(createdImages.length).toBeGreaterThan(0);

    // nothing in the export path reached for the host document directly
    const hostTags = createElementSpy.mock.calls.map(([tag]) =>
      String(tag).toLowerCase(),
    );
    expect(hostTags).not.toContain("canvas");
    expect(hostTags).not.toContain("img");
  });

  it("invalidates lazily-cached host objects when the environment changes", async () => {
    const { getTextWidth } = await import("@excalidraw/element");
    const fontString = "20px Excalifont" as Parameters<typeof getTextWidth>[1];

    const firstEnvCanvases: HTMLCanvasElement[] = [];
    setRenderEnvironment({
      createCanvas: () => {
        const canvas = document.createElement("canvas");
        firstEnvCanvases.push(canvas);
        return canvas;
      },
    });
    // builds + caches the default text metrics provider's canvas
    getTextWidth("measure me", fontString);
    expect(firstEnvCanvases).toHaveLength(1);

    const secondEnvCanvases: HTMLCanvasElement[] = [];
    setRenderEnvironment({
      createCanvas: () => {
        const canvas = document.createElement("canvas");
        secondEnvCanvases.push(canvas);
        return canvas;
      },
    });

    getTextWidth("measure me again", fontString);

    // the provider was rebuilt from the new environment rather than reusing
    // the canvas from the first one
    expect(secondEnvCanvases).toHaveLength(1);
    expect(firstEnvCanvases).toHaveLength(1);
  });

  it("skips font loading when there is no document (i.e. node)", async () => {
    // built before `document` goes away
    const target = document.createElement("canvas");
    const image = document.createElement("img");
    const rectangle = newElement({ type: "rectangle", x: 0, y: 0 });

    vi.stubGlobal("document", undefined);

    try {
      const canvas = await exportToCanvas(
        [rectangle],
        { ...getDefaultAppState(), width: 100, height: 100 } as AppState,
        {},
        {
          exportBackground: true,
          viewBackgroundColor: "#ffffff",
          renderEnvironment: {
            createCanvas: () => target,
            createImage: () => image,
          },
        },
        (width, height) => {
          target.width = width;
          target.height = height;
          return { canvas: target, scale: 1 };
        },
      );

      expect(canvas).toBe(target);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("renders text on canvases without DOM methods (i.e. OffscreenCanvas)", async () => {
    const strip = (canvas: HTMLCanvasElement) => {
      // node-canvas / OffscreenCanvas have no DOM element methods
      Object.defineProperty(canvas, "setAttribute", { value: undefined });
      Object.defineProperty(canvas, "isConnected", { value: undefined });
      return canvas;
    };

    const context = document.createElement("canvas").getContext("2d")!;
    const fillTextSpy = vi.spyOn(
      Object.getPrototypeOf(context) as CanvasRenderingContext2D,
      "fillText",
    );

    const target = strip(document.createElement("canvas"));
    setRenderEnvironment({
      createCanvas: () => strip(document.createElement("canvas")),
    });

    const text = newTextElement({ x: 0, y: 0, text: "headless", fontSize: 20 });

    await exportToCanvas(
      [text],
      { ...getDefaultAppState(), width: 100, height: 100 } as AppState,
      {},
      {
        exportBackground: true,
        viewBackgroundColor: "#ffffff",
      },
      (width, height) => {
        target.width = width;
        target.height = height;
        return { canvas: target, scale: 1 };
      },
      async () => {},
    );

    // the text was actually painted, not swallowed by the renderer's
    // per-element try/catch
    expect(fillTextSpy).toHaveBeenCalledWith("headless", 0, expect.any(Number));
  });

  it("fills freedraw strokes through the environment's `createPath`", async () => {
    // node has no global `Path2D`, so the environment has to be able to
    // supply one -- stubbed away to prove nothing reaches for the global
    const Path2DCtor = globalThis.Path2D;
    vi.stubGlobal("Path2D", undefined);

    const paths: string[] = [];
    const createPath = vi.fn((svgPath: string) => {
      paths.push(svgPath);
      return new Path2DCtor(svgPath);
    });

    const target = document.createElement("canvas");
    const createdCanvases: HTMLCanvasElement[] = [];
    // the stroke may land on the export canvas or on the element's own cached
    // canvas, depending on the caching path -- look at both
    const fillCalls = () =>
      [target, ...createdCanvases].flatMap(
        (canvas) =>
          (
            canvas.getContext("2d") as unknown as {
              fill: { mock: { calls: unknown[][] } };
            }
          ).fill.mock.calls,
      );

    const freedraw = newFreeDrawElement({
      type: "freedraw",
      x: 0,
      y: 0,
      simulatePressure: true,
      points: [
        [0, 0],
        [10, 10],
        [20, 5],
      ] as ExcalidrawFreeDrawElement["points"],
    });

    try {
      await exportToCanvas(
        [freedraw],
        { ...getDefaultAppState(), width: 100, height: 100 } as AppState,
        {},
        {
          exportBackground: true,
          viewBackgroundColor: "#ffffff",
          renderEnvironment: {
            createCanvas: () => {
              const canvas = document.createElement("canvas");
              createdCanvases.push(canvas);
              return canvas;
            },
            createImage: () => document.createElement("img"),
            createPath,
          },
        },
        (width, height) => {
          target.width = width;
          target.height = height;
          return { canvas: target, scale: 1 };
        },
        async () => {},
      );
    } finally {
      vi.unstubAllGlobals();
    }

    expect(createPath).toHaveBeenCalledTimes(1);
    expect(paths[0]).toMatch(/^M/);
    // and the path it built is what got filled
    expect(fillCalls().map(([path]) => path)).toContain(
      createPath.mock.results[0].value,
    );
  });

  it("fails the export when an element cannot be rendered", async () => {
    // the node case: no global `Path2D` and no `createPath` to stand in
    vi.stubGlobal("Path2D", undefined);

    const target = document.createElement("canvas");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const freedraw = newFreeDrawElement({
      type: "freedraw",
      x: 0,
      y: 0,
      simulatePressure: true,
      points: [
        [0, 0],
        [10, 10],
        [20, 5],
      ] as ExcalidrawFreeDrawElement["points"],
    });

    try {
      // must reject rather than resolve with a blank/partial canvas
      await expect(
        exportToCanvas(
          [freedraw],
          { ...getDefaultAppState(), width: 100, height: 100 } as AppState,
          {},
          {
            exportBackground: true,
            viewBackgroundColor: "#ffffff",
          },
          (width, height) => {
            target.width = width;
            target.height = height;
            return { canvas: target, scale: 1 };
          },
          async () => {},
        ),
      ).rejects.toThrow(/Path2D/);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("falls back to browser defaults for keys that are not overridden", () => {
    const createImage = vi.fn(() => document.createElement("img"));
    setRenderEnvironment({ createImage });

    const env = getRenderEnvironment();
    expect(env.createImage()).toBeInstanceOf(HTMLImageElement);
    expect(createImage).toHaveBeenCalledTimes(1);
    // not overridden -> still the browser default
    expect(env.createCanvas()).toBeInstanceOf(HTMLCanvasElement);

    resetRenderEnvironment();
    expect(getRenderEnvironment().createImage()).toBeInstanceOf(
      HTMLImageElement,
    );
    expect(createImage).toHaveBeenCalledTimes(1);
  });
});
