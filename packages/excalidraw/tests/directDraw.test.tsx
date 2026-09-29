import rough from "roughjs/bin/rough";

import { Scene } from "@excalidraw/element";
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

const draw = (element: NonDeletedExcalidrawElement, zoom: number) => {
  const scene = new Scene([element], { skipValidation: true });
  const renderer = new Renderer(scene);
  const appState: AppState = {
    ...getDefaultAppState(),
    width: 500,
    height: 500,
    offsetLeft: 0,
    offsetTop: 0,
    zoom: { value: getNormalizedZoom(zoom) },
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
  return { drawImage, fill, fillText };
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
