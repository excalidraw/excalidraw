import { getDefaultAppState } from "../appState";
import * as sceneExport from "../scene/export";
import { API } from "../tests/helpers/api";

import * as blobUtils from "./blob";
import * as filesystem from "./filesystem";

import { exportCanvas, prepareElementsForExport } from ".";

import type { AppState } from "../types";

describe("exportCanvas formats", () => {
  const appState = {
    ...getDefaultAppState(),
    width: 0,
    height: 0,
    offsetTop: 0,
    offsetLeft: 0,
  } as AppState;
  const { exportedElements: elements } = prepareElementsForExport(
    [API.createElement({ type: "rectangle" })],
    appState,
    false,
  );
  const options = {
    exportBackground: false,
    viewBackgroundColor: "#ffffff",
    exportingFrame: null,
  };

  const fileSaveSpy = vi.spyOn(filesystem, "fileSave");
  const canvasToBlobSpy = vi.spyOn(blobUtils, "canvasToBlob");
  const exportToCanvasSpy = vi.spyOn(sceneExport, "exportToCanvas");

  beforeEach(() => {
    fileSaveSpy.mockReset().mockResolvedValue(null as any);
    canvasToBlobSpy.mockReset().mockResolvedValue(new Blob());
    exportToCanvasSpy
      .mockReset()
      .mockResolvedValue(document.createElement("canvas"));
  });

  it("saves .excalidraw as serialized scene JSON, without rendering", async () => {
    await exportCanvas("excalidraw", elements, appState, {}, options);

    expect(exportToCanvasSpy).not.toHaveBeenCalled();
    expect(fileSaveSpy.mock.calls[0][1].extension).toBe("excalidraw");

    const blob = (await fileSaveSpy.mock.calls[0][0]) as Blob;
    const json = JSON.parse(
      await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blob);
      }),
    );
    expect(json.type).toBe("excalidraw");
    expect(json.elements.length).toBe(1);
  });

  it("saves webp with its mime type and default quality", async () => {
    await exportCanvas("webp", elements, appState, {}, options);

    expect(canvasToBlobSpy.mock.calls[0][1]).toBe("image/webp");
    expect(canvasToBlobSpy.mock.calls[0][2]).toBe(0.8);
    expect(fileSaveSpy.mock.calls[0][1].extension).toBe("webp");
  });

  it("saves jpg with its mime type and always renders a background", async () => {
    await exportCanvas("jpg", elements, appState, {}, options);

    expect(canvasToBlobSpy.mock.calls[0][1]).toBe("image/jpeg");
    expect(canvasToBlobSpy.mock.calls[0][2]).toBe(0.92);
    expect(fileSaveSpy.mock.calls[0][1].extension).toBe("jpg");
    expect(exportToCanvasSpy.mock.calls[0][3].exportBackground).toBe(true);
  });

  it("passes the aspect ratio through to the canvas render", async () => {
    await exportCanvas(
      "png",
      elements,
      appState,
      {},
      {
        ...options,
        aspectRatio: 4 / 5,
      },
    );

    expect(exportToCanvasSpy.mock.calls[0][3].aspectRatio).toBe(4 / 5);
  });

  it("keeps the background transparent for webp when it's off", async () => {
    await exportCanvas("webp", elements, appState, {}, options);

    expect(exportToCanvasSpy.mock.calls[0][3].exportBackground).toBe(false);
  });
});
