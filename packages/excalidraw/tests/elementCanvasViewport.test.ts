import rough from "roughjs/bin/rough";

import { Scene, getElementAbsoluteCoords } from "@excalidraw/element";
import {
  elementWithCanvasCache,
  renderElement,
} from "@excalidraw/element/renderElement";
import { pointFrom, type LocalPoint, type Radians } from "@excalidraw/math";

import { getDefaultAppState } from "../appState";
import { getNormalizedZoom } from "../scene";
import { Renderer } from "../scene/Renderer";

import { API } from "./helpers/api";

import type { StaticCanvasRenderConfig } from "../scene/types";

const setup = (length = 100_000, angle = 0, diagonal = false) => {
  const arrow = API.createElement({
    type: "arrow",
    endArrowhead: "arrow",
    x: 0,
    y: 0,
    width: length,
    height: diagonal ? length : 0,
    angle: angle as Radians,
    points: [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(length, diagonal ? length : 0),
    ],
  });
  const scene = new Scene([arrow], { skipValidation: true });
  const elementsMap = scene.getNonDeletedElementsMap();
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;
  const context = canvas.getContext("2d")!;
  const appState = {
    ...getDefaultAppState(),
    width: 800,
    height: 600,
    offsetLeft: 0,
    offsetTop: 0,
    zoom: { value: getNormalizedZoom(30) },
    scrollX: -length / 2,
    scrollY: diagonal ? -length / 2 : 0,
  };
  const renderableElements = new Renderer(scene).getRenderableElements({
    ...appState,
    selectedElements: [],
  }).elementsMap;
  const renderConfig: StaticCanvasRenderConfig = {
    scale: 1,
    imageCache: new Map(),
    renderGrid: false,
    isExporting: false,
    canvasBackgroundColor: "#fff",
    embedsValidationStatus: new Map(),
    elementsPendingErasure: new Set(),
    pendingFlowchartNodes: null,
    theme: "light",
  };
  const draw = (offset = { x: 0, y: 0 }) => {
    const scale = appState.zoom.value * renderConfig.scale;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    renderElement(
      arrow,
      renderableElements,
      elementsMap,
      rough.canvas(canvas),
      context,
      renderConfig,
      appState,
      { opacity: 0.5, offset },
    );
    return elementWithCanvasCache.get(arrow)!;
  };
  return { arrow, canvas, context, appState, draw, renderConfig, elementsMap };
};

describe("oversized linear element canvas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it.each([false, true])(
    "renders the visible section at full resolution (diagonal: %s)",
    (diagonal) => {
      const { draw, canvas } = setup(100_000, 0, diagonal);
      const cached = draw();
      expect(cached.scale).toBe(30);
      expect(cached.viewport).toBeDefined();
      // One pixel of bleed plus outward pixel-grid rounding on each side.
      expect(cached.canvas.width).toBeLessThanOrEqual(canvas.width + 4);
      expect(cached.canvas.height).toBeLessThanOrEqual(canvas.height + 4);
      expect(cached.canvas.width).toBeGreaterThanOrEqual(canvas.width);
    },
  );

  it("reuses the bitmap until the viewport changes", () => {
    const { draw, appState, canvas } = setup();
    const first = draw();
    expect(draw()).toBe(first);
    appState.scrollX -= 100;
    const panned = draw();
    expect(panned).not.toBe(first);
    expect(panned.viewport!.x - first.viewport!.x).toBeCloseTo(100);
    expect(draw()).toBe(panned);
    canvas.width += 200;
    const resized = draw();
    expect(resized).not.toBe(panned);
    expect(resized.canvas.width - panned.canvas.width).toBeCloseTo(200, 0);
    appState.shouldCacheIgnoreZoom = true;
    appState.zoom = { value: getNormalizedZoom(20) };
    const zoomed = draw();
    expect(zoomed).not.toBe(resized);
    expect(zoomed.scale).toBe(20);
    appState.shouldCacheIgnoreZoom = false;
    appState.zoom = { value: getNormalizedZoom(0.1) };
    const uncropped = draw();
    expect(uncropped.viewport).toBeUndefined();
    expect(uncropped.scale).toBe(0.1);
  });

  it("accounts for rotation and visual offsets", () => {
    const { draw } = setup(100_000, Math.PI / 2);
    const first = draw();
    expect(first.scale).toBe(30);
    expect(first.canvas.width).toBeLessThanOrEqual(604);
    const shifted = draw({ x: 0, y: 10 });
    expect(shifted.viewport!.x - first.viewport!.x).toBeCloseTo(-10);
    expect(shifted.scale).toBe(30);
  });

  it("keeps ordinary arrows independent of scroll", () => {
    const { draw, appState } = setup(100);
    const first = draw();
    expect(first.viewport).toBeUndefined();
    appState.scrollX -= 10;
    expect(draw()).toBe(first);
  });

  it("uses the render scale and invalidates the cache when it changes", () => {
    const { draw, canvas, renderConfig } = setup();
    const first = draw();
    renderConfig.scale = 2;
    const retina = draw();
    expect(retina).not.toBe(first);
    expect(retina.scale).toBe(30);
    expect(retina.deviceScale).toBe(2);
    expect(retina.canvas.width).toBeLessThanOrEqual(canvas.width + 4);
    expect(retina.viewport!.width).toBeCloseTo(first.viewport!.width / 2, 1);
  });

  it.each([0, Math.PI / 2, Math.PI / 4])(
    "preserves the painted position and composite opacity at angle %s",
    (angle) => {
      const { draw, context, arrow, elementsMap, appState } = setup(
        100_000,
        angle,
      );
      let blitTransform: DOMMatrix;
      let alpha = 0;
      vi.spyOn(context, "drawImage").mockImplementation(() => {
        blitTransform = context.getTransform();
        alpha = context.globalAlpha;
      });
      const cached = draw();
      const [x1, y1, x2, y2] = getElementAbsoluteCoords(arrow, elementsMap);
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;
      const [, x, y, width, height] = vi.mocked(context.drawImage).mock
        .lastCall!;
      // Locate the arrow's center in the cropped bitmap, then map it through
      // the actual blit. Cropping must not change its screen position.
      const pixelX =
        cached.canvasOffsetX +
        40 * cached.scale +
        (centerX - arrow.x - cached.viewport!.x) *
          cached.deviceScale *
          cached.scale;
      const pixelY =
        cached.canvasOffsetY +
        40 * cached.scale +
        (centerY - arrow.y - cached.viewport!.y) *
          cached.deviceScale *
          cached.scale;
      const localX = Number(x) + (pixelX * Number(width)) / cached.canvas.width;
      const localY =
        Number(y) + (pixelY * Number(height)) / cached.canvas.height;
      const { a, b, c, d, e, f } = blitTransform!;
      expect(
        Math.abs(
          a * localX + c * localY + e - (centerX + appState.scrollX) * 30,
        ),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(
          b * localX + d * localY + f - (centerY + appState.scrollY) * 30,
        ),
      ).toBeLessThanOrEqual(1);
      expect(alpha).toBe(0.5);
      expect(context.globalAlpha).toBe(1);
    },
  );

  it("still caps exceptionally large viewports", () => {
    const { draw, canvas } = setup(100_000, 0, true);
    canvas.width = 40_000;
    canvas.height = 40_000;
    const cached = draw();
    expect(cached.canvas.width * cached.canvas.height).toBeLessThanOrEqual(
      16777216,
    );
    expect(cached.canvas.width).toBeLessThanOrEqual(32767);
    expect(cached.canvas.height).toBeLessThanOrEqual(32767);
  });

  it("does not create a bitmap for export", () => {
    const { draw, arrow, renderConfig } = setup();
    renderConfig.isExporting = true;
    draw();
    expect(elementWithCanvasCache.has(arrow)).toBe(false);
  });
});
