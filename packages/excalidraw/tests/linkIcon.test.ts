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

const makeAsyncImage = () => {
  const image = document.createElement("img");
  let src = "";
  Object.defineProperty(image, "src", {
    get: () => src,
    set: (value: string) => {
      src = value;
      // jsdom never decodes images, so settle asynchronously like a browser
      queueMicrotask(() => image.onload?.({} as Event));
    },
  });
  return image;
};

const getDrawImageSources = (canvas: HTMLCanvasElement) =>
  (
    canvas.getContext("2d") as unknown as {
      drawImage: { mock: { calls: unknown[][] } };
    }
  ).drawImage.mock.calls.map((args) => args[0]);

describe("static scene link icons", () => {
  let createdCanvases: HTMLCanvasElement[];
  let createdImages: HTMLImageElement[];

  beforeEach(() => {
    createdCanvases = [];
    createdImages = [];
  });

  afterEach(() => {
    resetRenderEnvironment();
    vi.restoreAllMocks();
  });

  it("bakes link icons into the cache only after the images decode", async () => {
    const externalRect = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      link: "https://excalidraw.com",
    }) as NonDeletedExcalidrawElement;
    const elementLinkRect = newElement({
      type: "rectangle",
      x: 200,
      y: 0,
      width: 100,
      height: 50,
      link: `http://localhost/?element=${externalRect.id}`,
    }) as NonDeletedExcalidrawElement;
    const elements = [externalRect, elementLinkRect];
    const elementsMap = new Map(
      elements.map((element) => [element.id, element]),
    ) as unknown as ElementsMap;

    setRenderEnvironment({
      createCanvas: () => {
        const canvas = document.createElement("canvas");
        createdCanvases.push(canvas);
        return canvas;
      },
      createImage: () => {
        const image = makeAsyncImage();
        createdImages.push(image);
        return image;
      },
    });

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
    const renderConfig: StaticCanvasRenderConfig = {
      canvasBackgroundColor: "",
      scale: 1,
      imageCache: new Map(),
      renderGrid: false,
      renderLinks: true,
      isExporting: false,
      embedsValidationStatus: new Map(),
      elementsPendingErasure: new Set(),
      pendingFlowchartNodes: null,
      theme: appState.theme,
    };
    const config: StaticSceneRenderConfig = {
      canvas,
      rc: new RoughCanvas(canvas),
      elementsMap: elementsMap as unknown as RenderableElementsMap,
      allElementsMap: elementsMap as unknown as NonDeletedSceneElementsMap,
      visibleElements: elements,
      scale: 1,
      appState,
      renderConfig,
    };

    const imageDraws = () =>
      [canvas, ...createdCanvases]
        .flatMap(getDrawImageSources)
        .filter((source) => createdImages.includes(source as HTMLImageElement));

    renderStaticScene(config);

    // the first bake runs in the same task that starts decoding, where a
    // browser's drawImage would silently skip the undecoded image
    expect(imageDraws()).toHaveLength(0);
    expect(createdImages).toHaveLength(2);

    await new Promise((resolve) => setTimeout(resolve, 0));

    // settling invalidates the icon caches and re-renders, so the decoded
    // images end up baked in
    const externalImg = createdImages.find((img) =>
      img.src.includes("external-link"),
    );
    const elementLinkImg = createdImages.find((img) =>
      img.src.includes("arrow-big-right"),
    );
    expect(externalImg).toBeDefined();
    expect(elementLinkImg).toBeDefined();
    expect(
      imageDraws().filter((source) => source === externalImg).length,
    ).toBeGreaterThan(0);
    expect(
      imageDraws().filter((source) => source === elementLinkImg).length,
    ).toBeGreaterThan(0);
  });
});
