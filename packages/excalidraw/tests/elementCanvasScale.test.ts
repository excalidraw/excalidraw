// @vitest-environment-options {"url": "http://localhost/"}

import { RoughCanvas } from "roughjs/bin/canvas";

import {
  newElement,
  resetRenderEnvironment,
  setRenderEnvironment,
} from "@excalidraw/element";

import { vi } from "vitest";

import type {
  ElementsMap,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";
import { renderStaticScene } from "../renderer/staticScene";

import type { StaticCanvasAppState } from "../types";
import type {
  RenderableElementsMap,
  StaticCanvasRenderConfig,
  StaticSceneRenderConfig,
} from "../scene/types";

/**
 * The element canvas bitmap is rasterized at the backing-store scale
 * (renderConfig.scale, i.e. the owner window's devicePixelRatio in the
 * editor). If that scale changes between renders (monitor drag, browser
 * zoom) without the cache regenerating, the blit draws the stale bitmap at
 * the wrong scene size (elementWidth * cachedScale / currentScale).
 */
describe("elementWithCanvasCache deviceScale", () => {
  let createdCanvases: HTMLCanvasElement[];

  const makeRenderConfig = (
    appState: StaticCanvasAppState,
    scale: number,
  ): StaticCanvasRenderConfig => ({
    canvasBackgroundColor: "",
    scale,
    imageCache: new Map(),
    renderGrid: false,
    renderLinks: true,
    isExporting: false,
    embedsValidationStatus: new Map(),
    elementsPendingErasure: new Set(),
    pendingFlowchartNodes: null,
    theme: appState.theme,
  });

  beforeEach(() => {
    createdCanvases = [];
    setRenderEnvironment({
      createCanvas: () => {
        const canvas = document.createElement("canvas");
        createdCanvases.push(canvas);
        return canvas;
      },
    });
  });

  afterEach(() => {
    resetRenderEnvironment();
    vi.restoreAllMocks();
  });

  it("regenerates cached element canvases when renderConfig.scale changes", () => {
    const rect = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    }) as NonDeletedExcalidrawElement;
    const elements = [rect];
    const elementsMap = new Map(
      elements.map((element) => [element.id, element]),
    ) as unknown as ElementsMap;

    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 1000;

    const appState = {
      ...getDefaultAppState(),
      width: 1000,
      height: 1000,
      offsetLeft: 0,
      offsetTop: 0,
    } as StaticCanvasAppState;

    const makeConfig = (
      renderConfig: StaticCanvasRenderConfig,
    ): StaticSceneRenderConfig => ({
      canvas,
      rc: new RoughCanvas(canvas),
      elementsMap: elementsMap as unknown as RenderableElementsMap,
      allElementsMap: elementsMap as unknown as NonDeletedSceneElementsMap,
      visibleElements: elements,
      scale: renderConfig.scale,
      appState,
      renderConfig,
    });

    // bitmap width is elementWidth * deviceScale + padding * 2
    renderStaticScene(makeConfig(makeRenderConfig(appState, 1)));
    expect(createdCanvases).toHaveLength(1);
    expect(createdCanvases[0].width).toBe(100 * 1 + 40);

    // same element identity, backing-store scale changes (e.g. window moved
    // to a higher-DPI monitor)
    renderStaticScene(makeConfig(makeRenderConfig(appState, 2)));
    // the stale scale-1 canvas must be regenerated, not reused
    expect(createdCanvases).toHaveLength(2);
    expect(createdCanvases[1].width).toBe(100 * 2 + 40);
  });
});
