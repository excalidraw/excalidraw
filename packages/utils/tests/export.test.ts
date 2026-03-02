import { MIME_TYPES } from "@excalidraw/common";
import * as mockedSceneExportUtils from "@excalidraw/excalidraw/scene/export";
import { diagramFactory } from "@excalidraw/excalidraw/tests/fixtures/diagramFixture";
import { vi } from "vitest";

import * as utils from "../src";

const exportToSvgSpy = vi.spyOn(mockedSceneExportUtils, "exportToSvg");

describe("exportToCanvas", async () => {
  const EXPORT_PADDING = 10;

  it("with default arguments", async () => {
    const canvas = await utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
    });

    expect(canvas.width).toBe(100 + 2 * EXPORT_PADDING);
    expect(canvas.height).toBe(100 + 2 * EXPORT_PADDING);
  });

  it("when custom width and height", async () => {
    const canvas = await utils.exportToCanvas({
      ...diagramFactory({ elementOverrides: { width: 100, height: 100 } }),
      getDimensions: () => ({ width: 200, height: 200, scale: 1 }),
    });

    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(200);
  });
});

describe("exportToBlob", async () => {
  describe("mime type", () => {
    it("should change image/jpg to image/jpeg", async () => {
      const blob = await utils.exportToBlob({
        ...diagramFactory(),
        getDimensions: (width, height) => ({ width, height, scale: 1 }),
        // testing typo in MIME type (jpg → jpeg)
        mimeType: "image/jpg",
        appState: {
          exportBackground: true,
        },
      });
      expect(blob?.type).toBe(MIME_TYPES.jpg);
    });
    it("should default to image/png", async () => {
      const blob = await utils.exportToBlob({
        ...diagramFactory(),
      });
      expect(blob?.type).toBe(MIME_TYPES.png);
    });

    it("should warn when using quality with image/png", async () => {
      const consoleSpy = vi
        .spyOn(console, "warn")
        .mockImplementationOnce(() => void 0);
      await utils.exportToBlob({
        ...diagramFactory(),
        mimeType: MIME_TYPES.png,
        quality: 1,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        `"quality" will be ignored for "${MIME_TYPES.png}" mimeType`,
      );
    });
  });
});

describe("exportToSvg", () => {
  const passedElements = () => exportToSvgSpy.mock.calls[0][0];
  const passedOptions = () => exportToSvgSpy.mock.calls[0][1];

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("with default arguments", async () => {
    await utils.exportToSvg({
      ...diagramFactory({
        overrides: { appState: void 0 },
      }),
    });

    const passedOptionsWhenDefault = {
      ...passedOptions(),
      // To avoid varying snapshots
      name: "name",
    };
    expect(passedElements().length).toBe(3);
    expect(passedOptionsWhenDefault).toMatchSnapshot();
  });

  // FIXME the utils.exportToSvg no longer filters out deleted elements.
  // It's already supposed to be passed non-deleted elements by we're not
  // type-checking for it correctly.
  it.skip("with deleted elements", async () => {
    await utils.exportToSvg({
      ...diagramFactory({
        overrides: { appState: void 0 },
        elementOverrides: { isDeleted: true },
      }),
    });

    expect(passedElements().length).toBe(0);
  });

  it("with exportPadding", async () => {
    await utils.exportToSvg({
      ...diagramFactory({ overrides: { appState: { name: "diagram name" } } }),
      exportPadding: 0,
    });

    expect(passedElements().length).toBe(3);
    expect(passedOptions()).toEqual(
      expect.objectContaining({ exportPadding: 0 }),
    );
  });

  it("with exportEmbedScene", async () => {
    await utils.exportToSvg({
      ...diagramFactory({
        overrides: {
          appState: { name: "diagram name", exportEmbedScene: true },
        },
      }),
    });

    expect(passedElements().length).toBe(3);
    expect(passedOptions().exportEmbedScene).toBe(true);
  });
});
