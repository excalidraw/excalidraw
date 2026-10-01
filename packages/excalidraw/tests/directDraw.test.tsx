import rough from "roughjs/bin/rough";

import {
  elementWithCanvasCache,
  mutateElement,
  Scene,
} from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";
import { renderStaticScene } from "../renderer/staticScene";
import { Renderer } from "../scene/Renderer";
import { getNormalizedZoom } from "../scene";

import { API } from "./helpers/api";

import type { AppState } from "../types";

afterEach(() => {
  vi.restoreAllMocks();
});

const draw = (
  element: NonDeletedExcalidrawElement,
  zoom: number,
  state: Partial<AppState> = {},
) => {
  const scene = new Scene([element], { skipValidation: true });
  const renderer = new Renderer(scene);
  const appState: AppState = {
    ...getDefaultAppState(),
    width: 500,
    height: 500,
    offsetLeft: 0,
    offsetTop: 0,
    zoom: { value: getNormalizedZoom(zoom) },
    ...state,
  };
  const { elementsMap, visibleElements } = renderer.getRenderableElements({
    ...appState,
    selectedElements: [],
  });
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 500;
  const context = canvas.getContext("2d")!;
  const drawImage = vi.spyOn(context, "drawImage");
  const fill = vi.spyOn(context, "fill");
  const fillText = vi.spyOn(context, "fillText");
  const strokeSpy = vi.spyOn(context, "stroke");
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
  return { drawImage, fill, fillText, stroke: strokeSpy };
};

const stroke = () =>
  API.createElement({
    type: "freedraw",
    x: 10,
    y: 10,
    points: [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(20, 10),
      pointFrom<LocalPoint>(40, 0),
    ],
  });

describe("on-screen rendering draws some elements directly", () => {
  it.each([0.1, 1, 30])(
    "draws freedraw as a path on the canvas at %sx",
    (zoom) => {
      const { drawImage, fill } = draw(stroke(), zoom);
      expect(drawImage).not.toHaveBeenCalled();
      expect(fill).toHaveBeenCalledWith(expect.any(Path2D));
    },
  );

  it("draws text from its bitmap at 1x and directly when zoomed in", () => {
    const text = () =>
      API.createElement({ type: "text", text: "hello", x: 10, y: 10 });

    const atOne = draw(text(), 1);
    expect(atOne.drawImage).toHaveBeenCalledTimes(1);
    expect(atOne.fillText).not.toHaveBeenCalled();

    const zoomedIn = draw(text(), 1.5);
    expect(zoomedIn.drawImage).not.toHaveBeenCalled();
    expect(zoomedIn.fillText).toHaveBeenCalledWith(
      "hello",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("keeps drawing other shapes from their bitmaps", () => {
    const { drawImage } = draw(
      API.createElement({ type: "rectangle", x: 10, y: 10 }),
      4,
    );
    expect(drawImage).toHaveBeenCalledTimes(1);
  });
});

describe("a freedraw stroke's Path2D", () => {
  const filled = (element: NonDeletedExcalidrawElement) =>
    draw(element, 1).fill.mock.calls[0][0];

  it("is reused while the stroke is unchanged", () => {
    const element = stroke();
    const first = filled(element);
    expect(filled(element)).toBe(first);
  });

  it("is rebuilt once the stroke changes", () => {
    const element = stroke();
    const first = filled(element);
    mutateElement(element, new Map(), {
      points: [...element.points, pointFrom<LocalPoint>(60, 10)],
    });
    expect(filled(element)).not.toBe(first);
  });
});

describe("a shape's cached bitmap while the zoom animates", () => {
  const animating = { shouldCacheIgnoreZoom: true };
  const shape = () =>
    API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 40,
      height: 20,
    });
  const bitmapZoom = (element: NonDeletedExcalidrawElement) =>
    elementWithCanvasCache.get(element)?.zoomValue;

  it("is reused while it is shown smaller, or up to twice its size", () => {
    const element = shape();
    draw(element, 0.2);
    draw(element, 0.1, animating);
    draw(element, 0.4, animating);
    expect(bitmapZoom(element)).toBe(0.2);
  });

  it("is redrawn once it would be shown more than twice its size", () => {
    const element = shape();
    draw(element, 0.2);
    draw(element, 20, animating);
    expect(bitmapZoom(element)).toBe(20);
  });

  it("is redrawn a few per frame when many are blown up at once", () => {
    const [first, second] = [shape(), shape()];
    draw(first, 0.2);
    draw(second, 0.2);
    // each read of the clock is 5 ms after the last, past the frame budget
    let now = 1e12;
    vi.spyOn(performance, "now").mockImplementation(() => (now += 5));
    draw(first, 25, animating);
    draw(second, 25, animating);
    expect([bitmapZoom(first), bitmapZoom(second)]).toEqual([25, 0.2]);
    draw(second, 26, animating);
    expect(bitmapZoom(second)).toBe(26);
  });

  it("is redrawn at the new zoom once the zoom settles", () => {
    const element = shape();
    draw(element, 0.2);
    draw(element, 0.3);
    expect(bitmapZoom(element)).toBe(0.3);
  });
});

describe("freedraw once the zoom settles", () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 400));

  it("draws from a bitmap built at the settled zoom", async () => {
    const element = stroke();
    expect(draw(element, 2).drawImage).not.toHaveBeenCalled();
    await settle();
    const { drawImage, fill } = draw(element, 2);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(fill).not.toHaveBeenCalled();
  });

  it("keeps drawing directly while the zoom animates", async () => {
    const element = stroke();
    draw(element, 2, { shouldCacheIgnoreZoom: true });
    await settle();
    expect(
      draw(element, 2, { shouldCacheIgnoreZoom: true }).drawImage,
    ).not.toHaveBeenCalled();
  });

  it("draws directly at a zoom it has no bitmap for", async () => {
    const element = stroke();
    draw(element, 2);
    await settle();
    const { drawImage, fill } = draw(element, 3);
    expect(drawImage).not.toHaveBeenCalled();
    expect(fill).toHaveBeenCalledWith(expect.any(Path2D));
  });
});

describe("a shape too big for its bitmap at this zoom", () => {
  const deep = { scrollX: -10, scrollY: -10 };
  let element: NonDeletedExcalidrawElement;
  let drawn: ReturnType<typeof draw>;

  beforeEach(() => {
    element = API.createElement({
      type: "rectangle",
      x: 10,
      y: 10,
      width: 100,
      height: 100,
    });
  });

  describe("when the zoom has settled", () => {
    beforeEach(() => {
      drawn = draw(element, 750, deep);
    });

    it("is not drawn from its bitmap", () => {
      expect(drawn.drawImage).not.toHaveBeenCalled();
    });

    it("is drawn as paths on the canvas", () => {
      expect(drawn.stroke).toHaveBeenCalled();
    });
  });

  describe("while the zoom animates", () => {
    beforeEach(() => {
      drawn = draw(element, 750, { ...deep, shouldCacheIgnoreZoom: true });
    });

    it("is drawn from its bitmap", () => {
      expect(drawn.drawImage).toHaveBeenCalledTimes(1);
    });
  });
});
