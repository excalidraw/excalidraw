import { MIME_TYPES } from "@excalidraw/common";
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
});

describe("exportToBlob", async () => {
  describe("mime type", () => {
    it("should change image/jpg to image/jpeg", async () => {
      const diagramData = diagramFactory();
      const blob = await utils.exportToBlob({
        data: {
          elements: diagramData.elements,
          appState: {
            ...diagramData.appState,
            exportBackground: true,
          },
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

  // FIXME the utils.exportToSvg no longer filters out deleted elements.
  // It's already supposed to be passed non-deleted elements by we're not
  // type-checking for it correctly.
  it.skip("with deleted elements", async () => {
    await utils.exportToSvg({
      data: diagramFactory({
        overrides: { appState: void 0 },
        elementOverrides: { isDeleted: true },
      }),
    });

    expect(passedData().elements.length).toBe(0);
  });

  it("with padding", async () => {
    await utils.exportToSvg({
      data: diagramFactory({ overrides: { appState: { name: "diagram name" } } }),
      config: {
        padding: 0,
      },
    });

    expect(passedData().elements.length).toBe(3);
    expect(passedConfig()).toEqual(
      expect.objectContaining({ padding: 0 }),
    );
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
