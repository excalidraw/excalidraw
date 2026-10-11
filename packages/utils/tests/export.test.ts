import { MIME_TYPES } from "@excalidraw/common";
import * as clipboardModule from "@excalidraw/excalidraw/clipboard";
import * as imageModule from "@excalidraw/excalidraw/data/image";
import * as jsonModule from "@excalidraw/excalidraw/data/json";
import * as staticSceneModule from "@excalidraw/excalidraw/renderer/staticScene";
import * as staticSvgSceneModule from "@excalidraw/excalidraw/renderer/staticSvgScene";
import * as mockedSceneExportUtils from "@excalidraw/excalidraw/scene/export";
import { diagramFactory } from "@excalidraw/excalidraw/tests/fixtures/diagramFixture";
import { vi } from "vitest";

import * as utils from "../src";

const exportToSvgSpy = vi.spyOn(mockedSceneExportUtils, "exportToSvg");

describe("exportToCanvas", async () => {
  const EXPORT_PADDING = 10;

  it("with default arguments (no padding)", async () => {
    const canvas = await utils.exportToCanvas({
      data: diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
    });

    // New API has no default padding - call sites must explicitly set it
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(100);
  });

  it("with padding", async () => {
    const canvas = await utils.exportToCanvas({
      data: diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      config: {
        padding: EXPORT_PADDING,
      },
    });

    expect(canvas.width).toBe(100 + 2 * EXPORT_PADDING);
    expect(canvas.height).toBe(100 + 2 * EXPORT_PADDING);
  });

  it("when custom width and height", async () => {
    const canvas = await utils.exportToCanvas({
      data: diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      config: {
        getDimensions: () => ({ width: 200, height: 200, scale: 1 }),
      },
    });

    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(200);
  });

  it("calls getDimensions once with fit: contain", async () => {
    const getDimensions = vi.fn((width: number, height: number) => ({
      width: width * 2,
      height: height * 2,
    }));
    const canvas = await utils.exportToCanvas({
      data: diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      config: { getDimensions, fit: "contain" },
    });

    expect(getDimensions).toHaveBeenCalledTimes(1);
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(200);
  });

  it("ignores getDimensions when widthOrHeight is set", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const getDimensions = vi.fn(() => ({ width: 500, height: 500 }));
    const canvas = await utils.exportToCanvas({
      data: diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      config: { getDimensions, widthOrHeight: 50 },
    });

    expect(getDimensions).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(Math.max(canvas.width, canvas.height)).toBe(50);
    warn.mockRestore();
  });
});

describe("exportToBlob", async () => {
  describe("mime type", () => {
    it("should change image/jpg to image/jpeg", async () => {
      const diagramData = diagramFactory();
      const blob = await utils.exportToBlob({
        data: {
          elements: diagramData.elements,
          appState: diagramData.appState,
          files: diagramData.files,
        },
        config: {
          getDimensions: (width, height) => ({ width, height, scale: 1 }),
          // testing typo in MIME type (jpg → jpeg)
          mimeType: "image/jpg",
        },
      });
      expect(blob?.type).toBe(MIME_TYPES.jpg);
    });
    it("should default to image/png", async () => {
      const blob = await utils.exportToBlob({
        data: diagramFactory(),
      });
      expect(blob?.type).toBe(MIME_TYPES.png);
    });

    it("should warn when using quality with image/png", async () => {
      const consoleSpy = vi
        .spyOn(console, "warn")
        .mockImplementationOnce(() => void 0);
      await utils.exportToBlob({
        data: diagramFactory(),
        config: {
          mimeType: MIME_TYPES.png,
          quality: 1,
        },
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        `"quality" will be ignored for "${MIME_TYPES.png}" mimeType`,
      );
    });
  });
});

describe("exportToSvg", () => {
  const getPassedArg = () => exportToSvgSpy.mock.calls[0][0];
  const passedData = () => getPassedArg().data;
  const passedConfig = () => getPassedArg().config;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("with default arguments", async () => {
    await utils.exportToSvg({
      data: diagramFactory({
        overrides: { appState: void 0 },
      }),
    });

    const data = passedData();
    expect(data.elements.length).toBe(3);
    expect(passedConfig()).toMatchSnapshot();
  });

  // Regression test (#11470): deleted elements must be filtered out at
  // runtime (inside `configExportDimension`), since the type contract alone
  // doesn't protect JS consumers passing raw scene data. We assert on the
  // rendered output — the spy can't observe the filtering as it happens
  // inside the spied function itself.
  it("with deleted elements", async () => {
    const svg = await utils.exportToSvg({
      data: diagramFactory({
        overrides: { appState: void 0 },
        elementOverrides: { isDeleted: true },
      }),
    });

    expect(svg.querySelectorAll("[data-id]")).toHaveLength(0);
  });

  it("with padding", async () => {
    await utils.exportToSvg({
      data: diagramFactory({
        overrides: { appState: { name: "diagram name" } },
      }),
      config: {
        padding: 0,
      },
    });

    expect(passedData().elements.length).toBe(3);
    expect(passedConfig()).toEqual(expect.objectContaining({ padding: 0 }));
  });

  it("with exportEmbedScene", async () => {
    await utils.exportToSvg({
      data: diagramFactory({
        overrides: {
          appState: { name: "diagram name", exportEmbedScene: true },
        },
      }),
    });

    expect(passedData().elements.length).toBe(3);
    expect(passedData().appState?.exportEmbedScene).toBe(true);
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

  it("exportToSvg and exportToCanvas render the restored elements", async () => {
    const renderSvgSpy = vi.spyOn(staticSvgSceneModule, "renderSceneToSvg");
    const diagram = legacyDiagram();

    await utils.exportToSvg({ data: diagram });

    expect(createdOf(renderSvgSpy.mock.calls[0][0])).toEqual([
      null,
      null,
      null,
    ]);
    expect(diagram.elements[0]).not.toHaveProperty("created");

    const renderCanvasSpy = vi.spyOn(staticSceneModule, "renderStaticScene");
    const canvas = await utils.exportToCanvas({ data: diagram });

    expect(createdOf(renderCanvasSpy.mock.calls[0][0].visibleElements)).toEqual(
      [null, null, null],
    );
    expect(canvas.width).toBeGreaterThan(0);
  });

  it("exportToSvg embeds the restored scene", async () => {
    const serializeSpy = vi.spyOn(jsonModule, "serializeAsJSON");

    await utils.exportToSvg({
      data: { ...legacyDiagram(), appState: { exportEmbedScene: true } },
    });

    expect(serializeSpy).toHaveBeenCalledTimes(1);
    expect(createdOf(serializeSpy.mock.calls[0][0])).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("exportToBlob embeds the restored scene into png metadata", async () => {
    const serializeSpy = vi.spyOn(jsonModule, "serializeAsJSON");
    vi.spyOn(imageModule, "encodePngMetadata").mockImplementation(
      async ({ blob }) => blob,
    );

    await utils.exportToBlob({
      data: { ...legacyDiagram(), appState: { exportEmbedScene: true } },
      config: { mimeType: MIME_TYPES.png },
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
