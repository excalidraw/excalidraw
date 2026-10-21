import { MIME_TYPES } from "@excalidraw/common";
import * as clipboardModule from "@excalidraw/excalidraw/clipboard";
import * as imageModule from "@excalidraw/excalidraw/data/image";
import * as jsonModule from "@excalidraw/excalidraw/data/json";
import * as staticSceneModule from "@excalidraw/excalidraw/renderer/staticScene";
import * as staticSvgSceneModule from "@excalidraw/excalidraw/renderer/staticSvgScene";
import { diagramFactory } from "@excalidraw/excalidraw/tests/fixtures/diagramFixture";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { pointFrom } from "@excalidraw/math";
import { vi } from "vitest";

import * as utils from "../src";

import type { ExportSceneConfig } from "../src";

describe("exportScene: canvas", async () => {
  const EXPORT_PADDING = 10;

  it("with default arguments (padding 10)", async () => {
    const canvas = await utils.exportScene({
      type: "canvas",
      data: diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
    });

    expect(canvas.width).toBe(100 + 2 * EXPORT_PADDING);
    expect(canvas.height).toBe(100 + 2 * EXPORT_PADDING);
  });

  it("with padding", async () => {
    const canvas = await utils.exportScene({
      type: "canvas",
      data: diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      config: {
        padding: EXPORT_PADDING,
      },
    });

    expect(canvas.width).toBe(100 + 2 * EXPORT_PADDING);
    expect(canvas.height).toBe(100 + 2 * EXPORT_PADDING);
  });

  it("when custom width and height", async () => {
    const canvas = await utils.exportScene({
      type: "canvas",
      data: diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      config: { width: 200, height: 200 },
    });

    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(200);
  });

  it("derives a missing width/height from the aspect ratio", async () => {
    const elements = [
      API.createElement({ type: "rectangle", width: 200, height: 100 }),
    ];

    const fromHeight = await utils.exportScene({
      type: "canvas",
      data: { elements, files: null },
      config: { padding: EXPORT_PADDING, height: 50 },
    });
    // 30px of content height → 60px of content width, plus padding
    expect([fromHeight.width, fromHeight.height]).toEqual([80, 50]);

    const fromWidth = await utils.exportScene({
      type: "canvas",
      data: { elements, files: null },
      config: { padding: EXPORT_PADDING, width: 100 },
    });
    expect([fromWidth.width, fromWidth.height]).toEqual([100, 60]);
  });

  it("crops (doesn't scale) an x/y region by default", async () => {
    const canvas = await utils.exportScene({
      type: "canvas",
      data: {
        elements: [
          API.createElement({ type: "rectangle", width: 200, height: 100 }),
        ],
        files: null,
      },
      config: { padding: EXPORT_PADDING, x: 50, y: 0, width: 100, height: 100 },
    });

    // `fit: "none"` adds the padding around the region
    expect([canvas.width, canvas.height]).toEqual([120, 120]);
  });

  it("pads an x/y region on all sides", async () => {
    const renderSpy = vi.spyOn(staticSceneModule, "renderStaticScene");
    const canvas = await utils.exportScene({
      type: "canvas",
      data: {
        elements: [
          API.createElement({ type: "rectangle", width: 200, height: 100 }),
        ],
        files: null,
      },
      config: { padding: EXPORT_PADDING, x: 0, y: 0, width: 100, height: 100 },
    });

    // the canvas covers the scene from -10 to 110 on both axes
    expect([canvas.width, canvas.height]).toEqual([120, 120]);
    const { scrollX, scrollY } = renderSpy.mock.calls[0][0].appState;
    expect([scrollX, scrollY]).toEqual([EXPORT_PADDING, EXPORT_PADDING]);
    renderSpy.mockRestore();
  });

  it("ignores x/y when the content is scaled to fit", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderSpy = vi.spyOn(staticSceneModule, "renderStaticScene");
    const exportWith = (config: ExportSceneConfig) =>
      utils.exportScene({
        type: "canvas",
        data: {
          elements: [
            API.createElement({ type: "rectangle", width: 200, height: 100 }),
          ],
          files: null,
        },
        config: { padding: EXPORT_PADDING, ...config },
      });
    const renderedScroll = (call: number) => {
      const { scrollX, scrollY } = renderSpy.mock.calls[call][0].appState;
      return [scrollX, scrollY];
    };

    await exportWith({ width: 100, height: 100, fit: "contain" });
    await exportWith({ width: 100, height: 100, fit: "contain", x: 30, y: 20 });
    await exportWith({ maxWidthOrHeight: 100 });
    // the types forbid x/y with maxWidthOrHeight, JS callers still can
    // @ts-expect-error
    await exportWith({ maxWidthOrHeight: 100, x: 30, y: 20 });

    expect(renderedScroll(1)).toEqual(renderedScroll(0));
    expect(renderedScroll(3)).toEqual(renderedScroll(2));
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
    renderSpy.mockRestore();
  });

  it("keeps the padding of flat content", async () => {
    const line = API.createElement({
      type: "line",
      width: 200,
      height: 0,
      points: [pointFrom(0, 0), pointFrom(200, 0)],
    });
    const exportLine = (config: ExportSceneConfig) =>
      utils.exportScene({ type: "canvas", data: { elements: [line] }, config });

    // the padding used to be clamped against the content's (zero) height
    const fitted = await exportLine({ padding: 10, maxWidthOrHeight: 400 });
    expect([fitted.width, fitted.height]).toEqual([220, 20]);

    // never a zero-sized canvas, which can't be encoded
    const unpadded = await exportLine({ padding: 0 });
    expect([unpadded.width, unpadded.height]).toEqual([200, 1]);
  });

  it("derives a missing width/height after clamping the padding", async () => {
    const canvas = await utils.exportScene({
      type: "canvas",
      data: {
        elements: [
          API.createElement({ type: "rectangle", width: 200, height: 100 }),
        ],
      },
      // a 10px height leaves no room for the padding, so it's dropped
      config: { height: 10, padding: 10 },
    });

    expect([canvas.width, canvas.height]).toEqual([20, 10]);
  });

  it("with a scale function", async () => {
    const scale = vi.fn((width: number, height: number) => 60 / width);
    const canvas = await utils.exportScene({
      type: "canvas",
      data: diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      config: { padding: EXPORT_PADDING, scale },
    });

    // receives the export dimensions at scale 1, padding included
    expect(scale).toHaveBeenCalledWith(120, 120);
    expect(canvas.width).toBe(60);
    expect(canvas.height).toBe(60);
  });

  it("rounds the canvas dimensions", async () => {
    const size = 29 / 1.1;
    const canvas = await utils.exportScene({
      type: "canvas",
      data: {
        elements: [
          API.createElement({ type: "rectangle", width: size, height: size }),
        ],
        files: null,
      },
      // size * 1.1 === 28.999999999999996
      config: { scale: 1.1, padding: 0 },
    });

    expect(canvas.width).toBe(29);
    expect(canvas.height).toBe(29);
  });
});

describe("exportScene: png & jpeg", () => {
  it("exports the requested image type", async () => {
    const png = await utils.exportScene({
      type: "png",
      data: diagramFactory(),
    });
    expect(png.type).toBe(MIME_TYPES.png);

    const jpeg = await utils.exportScene({
      type: "jpeg",
      data: diagramFactory(),
    });
    expect(jpeg.type).toBe(MIME_TYPES.jpg);
  });
});

describe("exportScene: svg", () => {
  it("with default arguments", async () => {
    const svg = await utils.exportScene({
      type: "svg",
      data: diagramFactory({ overrides: { appState: void 0 } }),
    });

    expect(svg.querySelectorAll("[data-id]")).toHaveLength(3);
  });

  // Regression test (#11470): deleted elements must be filtered out at
  // runtime (inside `configExportDimension`), since the type contract alone
  // doesn't protect JS consumers passing raw scene data.
  it("with deleted elements", async () => {
    const svg = await utils.exportScene({
      type: "svg",
      data: diagramFactory({
        overrides: { appState: void 0 },
        elementOverrides: { isDeleted: true },
      }),
    });

    expect(svg.querySelectorAll("[data-id]")).toHaveLength(0);
  });

  it("with embedScene", async () => {
    const svg = await utils.exportScene({
      type: "svg",
      data: diagramFactory({ overrides: { appState: void 0 } }),
      config: { embedScene: true },
    });

    expect(svg.querySelector("metadata")?.innerHTML).toContain("payload-start");
  });
});

// Elements persisted before `created` existed omit it (modeled with the cast
// below, as the declared input type is a complete element). Every public
// export entry point restores its input, so such elements must reach the
// lower-level code restored, with `created: null`.
describe("elements lacking creation metadata", () => {
  const legacyDiagram = () => {
    const { elements, ...rest } = diagramFactory({
      overrides: { appState: void 0 },
    });
    return {
      ...rest,
      elements: elements.map(
        ({ created, ...element }) => element,
      ) as unknown as typeof elements,
    };
  };
  const createdOf = (elements: readonly { created: number | null }[]) =>
    elements.map((element) => element.created);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("svg and canvas exports render the restored elements", async () => {
    const renderSvgSpy = vi.spyOn(staticSvgSceneModule, "renderSceneToSvg");
    const diagram = legacyDiagram();

    await utils.exportScene({ type: "svg", data: diagram });

    expect(createdOf(renderSvgSpy.mock.calls[0][0])).toEqual([
      null,
      null,
      null,
    ]);
    expect(diagram.elements[0]).not.toHaveProperty("created");

    const renderCanvasSpy = vi.spyOn(staticSceneModule, "renderStaticScene");
    const canvas = await utils.exportScene({ type: "canvas", data: diagram });

    expect(createdOf(renderCanvasSpy.mock.calls[0][0].visibleElements)).toEqual(
      [null, null, null],
    );
    expect(canvas.width).toBeGreaterThan(0);
  });

  it("svg export embeds the restored scene", async () => {
    const serializeSpy = vi.spyOn(jsonModule, "serializeAsJSON");

    await utils.exportScene({
      type: "svg",
      data: legacyDiagram(),
      config: { embedScene: true },
    });

    expect(serializeSpy).toHaveBeenCalledTimes(1);
    expect(createdOf(serializeSpy.mock.calls[0][0])).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("png export embeds the restored scene into its metadata", async () => {
    const serializeSpy = vi.spyOn(jsonModule, "serializeAsJSON");
    vi.spyOn(imageModule, "encodePngMetadata").mockImplementation(
      async ({ blob }) => blob,
    );

    await utils.exportScene({
      type: "png",
      data: legacyDiagram(),
      config: { embedScene: true },
    });

    expect(serializeSpy).toHaveBeenCalledTimes(1);
    expect(createdOf(serializeSpy.mock.calls[0][0])).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("exportToClipboard copies the restored elements as json", async () => {
    const copySpy = vi
      .spyOn(clipboardModule, "copyToClipboard")
      .mockResolvedValue(undefined);

    await utils.exportToClipboard({ type: "json", data: legacyDiagram() });

    expect(copySpy).toHaveBeenCalledTimes(1);
    expect(createdOf(copySpy.mock.calls[0][0])).toEqual([null, null, null]);
  });
});
