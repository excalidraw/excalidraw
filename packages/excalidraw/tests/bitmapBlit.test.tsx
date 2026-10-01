import rough from "roughjs/bin/rough";

import { Scene } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";
import { renderStaticScene } from "../renderer/staticScene";
import { Renderer } from "../scene/Renderer";
import { getNormalizedZoom } from "../scene";

import { API } from "./helpers/api";

import type { AppState } from "../types";

const VIEWPORT = 500;

afterEach(() => {
  vi.restoreAllMocks();
});

const blit = (
  element: NonDeletedExcalidrawElement,
  state: Partial<AppState>,
) => {
  const scene = new Scene([element], { skipValidation: true });
  const appState: AppState = {
    ...getDefaultAppState(),
    width: VIEWPORT,
    height: VIEWPORT,
    offsetLeft: 0,
    offsetTop: 0,
    shouldCacheIgnoreZoom: true,
    ...state,
  };
  const { elementsMap, visibleElements } = new Renderer(
    scene,
  ).getRenderableElements({ ...appState, selectedElements: [] });
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = VIEWPORT;
  const context = canvas.getContext("2d")!;
  const drawImage = vi.spyOn(context, "drawImage");
  const transforms: DOMMatrix[] = [];
  drawImage.mockImplementation(() => {
    transforms.push(context.getTransform());
  });
  renderStaticScene({
    canvas,
    rc: rough.canvas(canvas),
    scale: 1,
    elementsMap,
    allElementsMap: scene.getNonDeletedElementsMap(),
    visibleElements,
    appState,
    renderConfig: {
      imageCache: new Map(),
      renderGrid: false,
      isExporting: false,
      canvasBackgroundColor: "#fff",
      embedsValidationStatus: new Map(),
      elementsPendingErasure: new Set(),
      pendingFlowchartNodes: null,
      theme: "light",
    },
  });
  const [source, ...rest] = drawImage.mock.calls[0] as [
    HTMLCanvasElement,
    ...number[],
  ];
  const [sx, sy, sw, sh, dx, dy, dw, dh] =
    rest.length === 4 ? [0, 0, source.width, source.height, ...rest] : rest;
  const { a, d, e, f } = transforms[0];
  return {
    source,
    sx,
    sy,
    sw,
    sh,
    screenLeft: a * dx + e,
    screenTop: d * dy + f,
    screenRight: a * (dx + dw) + e,
    screenBottom: d * (dy + dh) + f,
  };
};

const rectangle = () =>
  API.createElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 340,
    height: 330,
  });

const centeredOn = (x: number, y: number, zoom: number) => ({
  zoom: { value: getNormalizedZoom(zoom) },
  scrollX: VIEWPORT / 2 / zoom - x,
  scrollY: VIEWPORT / 2 / zoom - y,
});

describe("blitting an element's cached bitmap", () => {
  describe("when a pinch shows a slice of a bitmap drawn further out", () => {
    let drawn: ReturnType<typeof blit>;

    beforeEach(() => {
      const element = API.createElement({
        type: "rectangle",
        x: 0,
        y: 0,
        width: 1000,
        height: 10,
      });
      blit(element, {
        ...centeredOn(500, 5, 1),
        shouldCacheIgnoreZoom: false,
      });
      drawn = blit(element, centeredOn(500, 5, 1.9));
    });

    it("reads at most the on-screen part of the bitmap", () => {
      expect(drawn.sw).toBeLessThan(drawn.source.width / 3);
    });

    it("starts it at or before the screen's left edge", () => {
      expect(drawn.screenLeft).toBeLessThanOrEqual(0);
    });

    it("ends it at or past the screen's right edge", () => {
      expect(drawn.screenRight).toBeGreaterThanOrEqual(VIEWPORT);
    });
  });

  describe("when the whole element is on screen", () => {
    let drawn: ReturnType<typeof blit>;

    beforeEach(() => {
      drawn = blit(rectangle(), centeredOn(170, 165, 1));
    });

    it("reads the whole bitmap", () => {
      expect([drawn.sx, drawn.sy, drawn.sw, drawn.sh]).toEqual([
        0,
        0,
        drawn.source.width,
        drawn.source.height,
      ]);
    });
  });
});

describe("pinching out from a zoom an element's bitmap was drawn at", () => {
  let drawn: ReturnType<typeof blit>;

  beforeEach(() => {
    const element = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    blit(element, { ...centeredOn(50, 50, 3), shouldCacheIgnoreZoom: false });
    drawn = blit(element, centeredOn(50, 50, 1));
  });

  it("reads a bitmap at most twice as wide as it is shown", () => {
    expect(drawn.sw).toBeLessThanOrEqual(
      2 * (drawn.screenRight - drawn.screenLeft),
    );
  });
});
