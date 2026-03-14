import { THEME } from "@excalidraw/common";
import rough from "roughjs/bin/rough";
import { vi } from "vitest";

import type {
  RenderableElementsMap,
  StaticCanvasRenderConfig,
} from "@excalidraw/excalidraw/scene/types";
import type { StaticCanvasAppState } from "@excalidraw/excalidraw/types";

import { newTextElement } from "../newElement";
import { renderElement } from "../renderElement";

import type { NonDeletedSceneElementsMap } from "../types";

describe("renderElement", () => {
  it("renders capped-width auto-resize text directly to avoid blurring", () => {
    const originalDevicePixelRatio = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", {
      value: 2,
      configurable: true,
    });

    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 1000;
    const context = canvas.getContext("2d")!;
    const rc = rough.canvas(canvas);

    const drawImageSpy = vi.spyOn(context, "drawImage");
    const fillTextSpy = vi.spyOn(context, "fillText");

    const base = newTextElement({
      x: 0,
      y: 0,
      text: "A".repeat(32),
      fontSize: 20,
      autoResize: true,
    });

    const element = {
      ...base,
      width: 20000,
    };

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
      width: 1000,
      height: 1000,
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
      imageCache: new Map(),
      renderGrid: false,
      isExporting: false,
      embedsValidationStatus: new Map(),
      elementsPendingErasure: new Set(),
      pendingFlowchartNodes: null,
      theme: THEME.LIGHT,
    } as unknown as StaticCanvasRenderConfig;

    renderElement(
      element,
      elementsMap,
      allElementsMap,
      rc,
      context,
      renderConfig,
      appState,
    );

    expect(drawImageSpy).not.toHaveBeenCalled();
    expect(fillTextSpy).toHaveBeenCalled();

    Object.defineProperty(window, "devicePixelRatio", {
      value: originalDevicePixelRatio,
      configurable: true,
    });
  });
});
