// @vitest-environment-options {"url": "http://localhost/"}

import { RoughCanvas } from "roughjs/bin/canvas";
import {
  newElement,
  resetRenderEnvironment,
  setRenderEnvironment,
} from "@excalidraw/element";

import { vi } from "vitest";

import type { RenderEnvironment } from "@excalidraw/element/renderEnvironment";

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

/** already decoded, so the icon bakes in the first render with no tick */
const makeDecodedImage = () => {
  const image = document.createElement("img");
  Object.defineProperty(image, "complete", { value: true });
  Object.defineProperty(image, "naturalWidth", { value: 16 });
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

    // the first render runs in the same task that starts decoding, so the
    // icons are skipped rather than baked blank
    expect(imageDraws()).toHaveLength(0);
    expect(createdImages).toHaveLength(2);

    await new Promise((resolve) => setTimeout(resolve, 0));

    // once decoded, the next render bakes the images in -- nothing was
    // memoized while they were undecoded, so there is no stale blank icon
    renderStaticScene(config);

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

  it("bakes a separate icon canvas per backing-store scale", () => {
    const rect = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      link: "https://excalidraw.com",
    }) as NonDeletedExcalidrawElement;
    const elementsMap = new Map([[rect.id, rect]]) as unknown as ElementsMap;

    setRenderEnvironment({
      createCanvas: () => {
        const canvas = document.createElement("canvas");
        createdCanvases.push(canvas);
        return canvas;
      },
      // the backing-store scale behaviour under test is independent of
      // decode timing, and an undecoded icon bakes nothing at all
      createImage: makeDecodedImage,
    });

    const appState = {
      ...getDefaultAppState(),
      width: 1000,
      height: 1000,
      offsetLeft: 0,
      offsetTop: 0,
    } as StaticCanvasAppState;

    const makeConfig = (scale: number): StaticSceneRenderConfig => {
      const scene = Object.assign(document.createElement("canvas"), {
        width: 1000,
        height: 1000,
      });
      return {
        canvas: scene,
        rc: new RoughCanvas(scene),
        elementsMap: elementsMap as unknown as RenderableElementsMap,
        allElementsMap: elementsMap as unknown as NonDeletedSceneElementsMap,
        visibleElements: [rect],
        scale,
        appState,
        renderConfig: {
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
        },
      };
    };

    // the link icon is blitted after the element's own canvas, so it is
    // the last cached-canvas source
    const blitSource = (scene: HTMLCanvasElement) =>
      getDrawImageSources(scene)
        .filter((source) =>
          createdCanvases.includes(source as HTMLCanvasElement),
        )
        .pop() as HTMLCanvasElement | undefined;

    const config1 = makeConfig(1);
    renderStaticScene(config1);
    const firstBake = blitSource(config1.canvas);
    expect(firstBake).toBeDefined();

    // a second instance (e.g. another window) with the same zoom but a
    // different backing-store scale must not reuse the first bake
    const config2 = makeConfig(2);
    renderStaticScene(config2);
    const secondBake = blitSource(config2.canvas);
    expect(secondBake).toBeDefined();
    expect(secondBake).not.toBe(firstBake);
    expect(secondBake!.width).toBe(firstBake!.width * 2);
    expect(secondBake!.height).toBe(firstBake!.height * 2);
  });

  it("bakes an icon only for the environment whose image decoded", () => {
    const makeEnv = () => {
      const canvases: HTMLCanvasElement[] = [];
      const images: HTMLImageElement[] = [];
      const env: RenderEnvironment = {
        createCanvas: () => {
          const canvas = document.createElement("canvas");
          canvases.push(canvas);
          return canvas;
        },
        createImage: () => {
          const image = document.createElement("img");
          let src = "";
          Object.defineProperty(image, "src", {
            get: () => src,
            set: (value: string) => {
              src = value;
            },
          });
          images.push(image);
          return image;
        },
      };
      return { env, canvases, images };
    };

    const rect = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      link: "https://excalidraw.com",
    }) as NonDeletedExcalidrawElement;
    const elementsMap = new Map([[rect.id, rect]]) as unknown as ElementsMap;
    const appState = {
      ...getDefaultAppState(),
      width: 1000,
      height: 1000,
      offsetLeft: 0,
      offsetTop: 0,
    } as StaticCanvasAppState;

    const makeConfig = (
      env: RenderEnvironment,
      scene: HTMLCanvasElement,
    ): StaticSceneRenderConfig => ({
      canvas: scene,
      rc: new RoughCanvas(scene),
      elementsMap: elementsMap as unknown as RenderableElementsMap,
      allElementsMap: elementsMap as unknown as NonDeletedSceneElementsMap,
      visibleElements: [rect],
      scale: 1,
      appState,
      renderConfig: {
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
        renderEnvironment: env,
      },
    });

    const sceneA = Object.assign(document.createElement("canvas"), {
      width: 1000,
      height: 1000,
    });
    const sceneB = Object.assign(document.createElement("canvas"), {
      width: 1000,
      height: 1000,
    });
    const envA = makeEnv();
    const envB = makeEnv();
    const configA = makeConfig(envA.env, sceneA);
    const configB = makeConfig(envB.env, sceneB);

    // icon canvases created by each environment, blitted onto its scene
    // the icon canvas bakes at the fixed link icon size while the element
    // bitmap is element-width + padding, so filter on width to isolate the
    // icon blits
    const iconBlits = (
      scene: HTMLCanvasElement,
      { canvases }: { canvases: HTMLCanvasElement[] },
    ) =>
      getDrawImageSources(scene).filter(
        (source): source is HTMLCanvasElement =>
          canvases.includes(source as HTMLCanvasElement) &&
          (source as HTMLCanvasElement).width < 64,
      );

    renderStaticScene(configA);
    renderStaticScene(configB);
    expect(envA.images).toHaveLength(1);
    expect(envB.images).toHaveLength(1);
    // nothing is baked while the image is undecoded -- the bake is memoized
    // under a key with no notion of load state, so a blank one would stick
    expect(iconBlits(sceneA, envA)).toHaveLength(0);
    expect(iconBlits(sceneB, envB)).toHaveLength(0);

    // environment A's image decodes; environment B's does not
    envA.images[0].onload?.({} as Event);

    // A's next render bakes an icon containing its decoded image
    renderStaticScene(configA);
    const aBlits = iconBlits(sceneA, envA);
    expect(aBlits).toHaveLength(1);
    expect(getDrawImageSources(aBlits[0])).toContain(envA.images[0]);

    // decode state is per environment: B still bakes nothing because its own
    // image is still undecoded
    renderStaticScene(configB);
    expect(iconBlits(sceneB, envB)).toHaveLength(0);
  });
});
