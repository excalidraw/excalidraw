import { RoughCanvas } from "roughjs/bin/canvas";
import { newElement, newFreeDrawElement } from "@excalidraw/element";
import { describe, expect, it, vi } from "vitest";

import type {
  ElementsMap,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";

import {
  cancelStaticSceneThrottle,
  renderStaticScene,
  renderStaticSceneThrottled,
} from "./staticScene";

import type { StaticCanvasAppState } from "../types";
import type {
  RenderableElementsMap,
  StaticCanvasRenderConfig,
  StaticSceneRenderConfig,
} from "../scene/types";

// setupTests replaces throttleRAF with a synchronous passthrough that ignores
// the owner window; these tests are about the scheduling window, so use the
// real implementation
vi.mock("@excalidraw/common", async (importOriginal) => {
  return await importOriginal<typeof import("@excalidraw/common")>();
});

const makeWindow = () => ({
  requestAnimationFrame: vi.fn(() => 1),
  cancelAnimationFrame: vi.fn(),
});

/** canvas stub whose owning document can be swapped, as node adoption would */
const makeCanvas = (ownerWindow: ReturnType<typeof makeWindow>) => {
  const canvas = {
    ownerDocument: { defaultView: ownerWindow },
  };
  return canvas as unknown as HTMLCanvasElement;
};

const render = (canvas: HTMLCanvasElement) =>
  renderStaticSceneThrottled({ canvas } as unknown as StaticSceneRenderConfig);

describe("static scene throttle", () => {
  it("schedules on the canvas' owner window", () => {
    const ownerWindow = makeWindow();
    const canvas = makeCanvas(ownerWindow);

    render(canvas);
    expect(ownerWindow.requestAnimationFrame).toHaveBeenCalledTimes(1);

    // throttled: a second call in the same frame doesn't schedule again
    render(canvas);
    expect(ownerWindow.requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it("reschedules on the new window when the canvas is adopted", () => {
    const oldWindow = makeWindow();
    const newWindow = makeWindow();
    const canvas = makeCanvas(oldWindow);

    render(canvas);
    expect(oldWindow.requestAnimationFrame).toHaveBeenCalledTimes(1);

    (canvas as any).ownerDocument.defaultView = newWindow;
    render(canvas);

    // the old window's pending frame is dropped, and the render is scheduled
    // on the window the canvas now lives in
    expect(oldWindow.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(oldWindow.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(newWindow.requestAnimationFrame).toHaveBeenCalledTimes(1);

    // the rebuilt throttle is the one that gets cancelled
    cancelStaticSceneThrottle(canvas);
    expect(newWindow.cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });
});

describe("static scene element render errors", () => {
  const renderScene = (isExporting: boolean) => {
    // `createPath` is the only member of the render environment the renderer
    // reaches for lazily, so an unrenderable freedraw is the cheapest way to
    // make exactly one element throw
    const broken = newFreeDrawElement({
      type: "freedraw",
      x: 0,
      y: 0,
      simulatePressure: true,
      points: [
        [0, 0],
        [10, 10],
      ],
    } as Parameters<typeof newFreeDrawElement>[0]);
    const survivor = newElement({
      type: "rectangle",
      x: 20,
      y: 0,
      width: 10,
      height: 10,
    }) as NonDeletedExcalidrawElement;
    const elements = [broken, survivor];
    const elementsMap = new Map(
      elements.map((element) => [element.id, element]),
    ) as unknown as ElementsMap;

    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;

    const appState = {
      ...getDefaultAppState(),
      width: 100,
      height: 100,
      offsetLeft: 0,
      offsetTop: 0,
    } as StaticCanvasAppState;

    const renderConfig: StaticCanvasRenderConfig = {
      canvasBackgroundColor: "#ffffff",
      scale: 1,
      imageCache: new Map(),
      renderGrid: false,
      renderLinks: false,
      isExporting,
      embedsValidationStatus: new Map(),
      elementsPendingErasure: new Set(),
      pendingFlowchartNodes: null,
      theme: appState.theme,
      renderEnvironment: {
        createCanvas: () => document.createElement("canvas"),
        createImage: () => document.createElement("img"),
        createPath: () => {
          throw new Error("no Path2D here");
        },
      },
    };

    return () =>
      renderStaticScene({
        canvas,
        rc: new RoughCanvas(canvas),
        elementsMap: elementsMap as unknown as RenderableElementsMap,
        allElementsMap: elementsMap as unknown as NonDeletedSceneElementsMap,
        visibleElements: elements,
        scale: 1,
        appState,
        renderConfig,
      } as StaticSceneRenderConfig);
  };

  it("keeps painting the rest of the editor canvas", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(renderScene(false)).not.toThrow();
    // one broken element is logged, the others still render
    expect(consoleError).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });

  it("fails the render when exporting, rather than shipping a partial image", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(renderScene(true)).toThrow("no Path2D here");
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
