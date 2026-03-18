import { THEME } from "@excalidraw/common";
import rough from "roughjs/bin/rough";
import { vi } from "vitest";

import type {
  RenderableElementsMap,
  StaticCanvasRenderConfig,
} from "@excalidraw/excalidraw/scene/types";
import type { StaticCanvasAppState } from "@excalidraw/excalidraw/types";

import { newImageElement } from "../newElement";
import { renderElement } from "../renderElement";

import type { NonDeletedSceneElementsMap } from "../types";

describe("renderElement (image viewport culling)", () => {
  it("draws cached image canvas via 9-arg drawImage when image exceeds viewport", () => {
    const originalDevicePixelRatio = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", {
      value: 2,
      configurable: true,
    });

    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const context = canvas.getContext("2d")!;
    const rc = rough.canvas(canvas);

    const drawImageSpy = vi.spyOn(context, "drawImage");

    const fileId = "file1" as any;
    const img = document.createElement("img");
    Object.defineProperty(img, "naturalWidth", { value: 1000 });
    Object.defineProperty(img, "naturalHeight", { value: 1000 });

    const element = newImageElement({
      type: "image",
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
      fileId,
    });

    const elementsMap = new Map([
      [element.id, element],
    ]) as unknown as RenderableElementsMap;
    const allElementsMap = new Map([
      [element.id, element],
    ]) as unknown as NonDeletedSceneElementsMap;

    const appState = {
      zoom: { value: 1 },
      scrollX: 0,
      scrollY: 0,
      width: 100,
      height: 100,
      viewModeEnabled: false,
      openDialog: null,
      hoveredElementIds: {},
      offsetLeft: 0,
      offsetTop: 0,
      theme: THEME.LIGHT,
      shouldCacheIgnoreZoom: false,
      viewBackgroundColor: "#ffffff",
      exportScale: 1,
      selectedElementsAreBeingDragged: false,
      gridSize: null,
      gridStep: 1,
      frameRendering: { enabled: false, outline: false, clip: false },
      selectedElementIds: {},
      frameToHighlight: null,
      editingGroupId: null,
      currentHoveredFontFamily: null,
      croppingElementId: null,
      suggestedBinding: null,
    } as unknown as StaticCanvasAppState;

    const renderConfig = {
      canvasBackgroundColor: "#ffffff",
      imageCache: new Map([
        [
          fileId,
          {
            image: img,
            mimeType: "image/png",
          },
        ],
      ]),
      renderGrid: false,
      isExporting: false,
      embedsValidationStatus: new Map(),
      elementsPendingErasure: new Set(),
      pendingFlowchartNodes: null,
      theme: THEME.LIGHT,
    } as unknown as StaticCanvasRenderConfig;

    context.save();
    context.scale(appState.zoom.value, appState.zoom.value);

    renderElement(
      element,
      elementsMap,
      allElementsMap,
      rc,
      context,
      renderConfig,
      appState,
    );

    context.restore();

    const cachedCanvasCalls = drawImageSpy.mock.calls.filter(
      (call) => call[0] instanceof HTMLCanvasElement,
    );
    expect(cachedCanvasCalls.length).toBeGreaterThan(0);
    expect(cachedCanvasCalls.some((call) => call.length === 9)).toBe(true);

    Object.defineProperty(window, "devicePixelRatio", {
      value: originalDevicePixelRatio,
      configurable: true,
    });
  });
});
