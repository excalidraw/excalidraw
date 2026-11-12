// @vitest-environment-options {"url": "http://localhost/"}

import { RoughCanvas } from "roughjs/bin/canvas";

import { mutateElement, newElement } from "@excalidraw/element";

import { vi } from "vitest";

import { THEME } from "@excalidraw/common";

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
  StaticSceneRenderConfig,
} from "../scene/types";

/** already decoded, so a link icon bakes in the first render with no tick */
const makeDecodedImage = () => {
  const image = document.createElement("img");
  Object.defineProperty(image, "complete", { value: true });
  Object.defineProperty(image, "naturalWidth", { value: 16 });
  return image;
};

const makeEnv = () => {
  const canvases: HTMLCanvasElement[] = [];
  const env: RenderEnvironment = {
    createCanvas: () => {
      const canvas = document.createElement("canvas");
      canvases.push(canvas);
      return canvas;
    },
    createImage: makeDecodedImage,
  };
  return { env, canvases };
};

const getDrawImageSources = (canvas: HTMLCanvasElement) =>
  (
    canvas.getContext("2d") as unknown as {
      drawImage: { mock: { calls: unknown[][] } };
    }
  ).drawImage.mock.calls.map((args) => args[0]);

const appState = {
  ...getDefaultAppState(),
  width: 1000,
  height: 1000,
  offsetLeft: 0,
  offsetTop: 0,
} as StaticCanvasAppState;

const makeScene = () =>
  Object.assign(document.createElement("canvas"), {
    width: 1000,
    height: 1000,
  });

const makeConfig = (
  elements: NonDeletedExcalidrawElement[],
  {
    scale,
    renderEnvironment,
    canvas = makeScene(),
    theme = appState.theme,
  }: {
    scale: number;
    renderEnvironment: RenderEnvironment;
    canvas?: HTMLCanvasElement;
    theme?: StaticCanvasAppState["theme"];
  },
): StaticSceneRenderConfig => {
  const elementsMap = new Map(
    elements.map((element) => [element.id, element]),
  ) as unknown as ElementsMap;

  return {
    canvas,
    rc: new RoughCanvas(canvas),
    elementsMap: elementsMap as unknown as RenderableElementsMap,
    allElementsMap: elementsMap as unknown as NonDeletedSceneElementsMap,
    visibleElements: elements,
    scale,
    appState: { ...appState, theme },
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
      theme,
      renderEnvironment,
    },
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * The element bitmap is rasterized at the backing-store scale
 * (renderConfig.scale, i.e. the owner window's devicePixelRatio in the editor)
 * in a specific realm's canvas. Reusing it across either would blit the wrong
 * scene size, or a canvas belonging to another document.
 */
describe("element canvas cache", () => {
  const rect = () =>
    newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    }) as NonDeletedExcalidrawElement;

  it("regenerates when the backing-store scale changes", () => {
    const { env, canvases } = makeEnv();
    const elements = [rect()];

    // bitmap width is elementWidth * deviceScale + padding * 2
    renderStaticScene(
      makeConfig(elements, { scale: 1, renderEnvironment: env }),
    );
    expect(canvases).toHaveLength(1);
    expect(canvases[0].width).toBe(100 * 1 + 40);

    // same element identity, backing-store scale changes (e.g. the window
    // moved to a higher-DPI monitor): the stale bitmap must not be reused
    renderStaticScene(
      makeConfig(elements, { scale: 2, renderEnvironment: env }),
    );
    expect(canvases).toHaveLength(2);
    expect(canvases[1].width).toBe(100 * 2 + 40);
  });

  it("regenerates when the environment changes, and reuses within one", () => {
    const a = makeEnv();
    const b = makeEnv();
    const elements = [rect()];

    renderStaticScene(
      makeConfig(elements, { scale: 1, renderEnvironment: a.env }),
    );
    expect(a.canvases).toHaveLength(1);

    // a second instance (e.g. a popout) renders the very same element object
    // in its own environment: it must mint its own canvas rather than blit a
    // bitmap belonging to env A's realm
    renderStaticScene(
      makeConfig(elements, { scale: 1, renderEnvironment: b.env }),
    );
    expect(b.canvases).toHaveLength(1);
    expect(a.canvases).toHaveLength(1);

    // re-rendering under the same environment reuses the cached canvas
    renderStaticScene(
      makeConfig(elements, { scale: 1, renderEnvironment: b.env }),
    );
    expect(b.canvases).toHaveLength(1);

    // NOTE going back to env A regenerates rather than restoring env A's
    // earlier bitmap: the cache holds one entry per element, not one per
    // element per environment. An element object alternating between two
    // editors frame after frame does not happen in practice, so the extra
    // per-element map is not worth its allocation and lookup.
    renderStaticScene(
      makeConfig(elements, { scale: 1, renderEnvironment: a.env }),
    );
    expect(a.canvases).toHaveLength(2);
    expect(b.canvases).toHaveLength(1);
  });

  it("reuses the previous theme's bitmap when switching back", () => {
    const { env, canvases } = makeEnv();
    const elements = [rect()];

    renderStaticScene(
      makeConfig(elements, {
        scale: 1,
        renderEnvironment: env,
        theme: THEME.LIGHT,
      }),
    );
    expect(canvases).toHaveLength(1);

    // switching to dark theme generates the other theme's bitmap
    renderStaticScene(
      makeConfig(elements, {
        scale: 1,
        renderEnvironment: env,
        theme: THEME.DARK,
      }),
    );
    expect(canvases).toHaveLength(2);

    // switching back to light reuses the previous light bitmap
    renderStaticScene(
      makeConfig(elements, {
        scale: 1,
        renderEnvironment: env,
        theme: THEME.LIGHT,
      }),
    );
    expect(canvases).toHaveLength(2);

    // switching back to dark reuses the previous dark bitmap
    renderStaticScene(
      makeConfig(elements, {
        scale: 1,
        renderEnvironment: env,
        theme: THEME.DARK,
      }),
    );
    expect(canvases).toHaveLength(2);
  });

  it("invalidates both themes on resize", () => {
    const { env, canvases } = makeEnv();
    const element = rect();
    const elements = [element];

    renderStaticScene(
      makeConfig(elements, {
        scale: 1,
        renderEnvironment: env,
        theme: THEME.LIGHT,
      }),
    );
    renderStaticScene(
      makeConfig(elements, {
        scale: 1,
        renderEnvironment: env,
        theme: THEME.DARK,
      }),
    );
    expect(canvases).toHaveLength(2);

    mutateElement(element, new Map(), { width: 200 });

    // dark theme was invalidated by resize -> regenerates with new size
    renderStaticScene(
      makeConfig(elements, {
        scale: 1,
        renderEnvironment: env,
        theme: THEME.DARK,
      }),
    );
    expect(canvases).toHaveLength(3);
    expect(canvases[2].width).toBe(200 * 1 + 40);

    // light theme was also invalidated by resize -> regenerates with new size
    renderStaticScene(
      makeConfig(elements, {
        scale: 1,
        renderEnvironment: env,
        theme: THEME.LIGHT,
      }),
    );
    expect(canvases).toHaveLength(4);
    expect(canvases[3].width).toBe(200 * 1 + 40);
  });

  it("draws a recolored element (new element object) afresh in both themes", () => {
    const { env, canvases } = makeEnv();
    const element = rect();

    renderStaticScene(
      makeConfig([element], {
        scale: 1,
        renderEnvironment: env,
        theme: THEME.LIGHT,
      }),
    );
    renderStaticScene(
      makeConfig([element], {
        scale: 1,
        renderEnvironment: env,
        theme: THEME.DARK,
      }),
    );
    expect(canvases).toHaveLength(2);

    const recolored = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      strokeColor: "#ff0000",
    }) as NonDeletedExcalidrawElement;

    // a new element object must not reuse either cached bitmap
    renderStaticScene(
      makeConfig([recolored], {
        scale: 1,
        renderEnvironment: env,
        theme: THEME.DARK,
      }),
    );
    expect(canvases).toHaveLength(3);

    renderStaticScene(
      makeConfig([recolored], {
        scale: 1,
        renderEnvironment: env,
        theme: THEME.LIGHT,
      }),
    );
    expect(canvases).toHaveLength(4);
  });
});

describe("link icon cache", () => {
  const linkedRect = () =>
    newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      link: "https://excalidraw.com",
    }) as NonDeletedExcalidrawElement;

  // the icon canvas bakes at the fixed link icon size while the element
  // bitmap is element-width + padding, so filter on width to isolate the
  // icon blits
  const iconBlits = (scene: HTMLCanvasElement, canvases: HTMLCanvasElement[]) =>
    getDrawImageSources(scene).filter(
      (source): source is HTMLCanvasElement =>
        canvases.includes(source as HTMLCanvasElement) &&
        (source as HTMLCanvasElement).width < 64,
    );

  it("bakes a separate icon per backing-store scale", () => {
    const { env, canvases } = makeEnv();
    const elements = [linkedRect()];

    const config1 = makeConfig(elements, { scale: 1, renderEnvironment: env });
    renderStaticScene(config1);
    const [firstBake] = iconBlits(config1.canvas, canvases);
    expect(firstBake).toBeDefined();

    // another window at the same zoom but a different backing-store scale
    // must not reuse the first bake
    const config2 = makeConfig(elements, { scale: 2, renderEnvironment: env });
    renderStaticScene(config2);
    const [secondBake] = iconBlits(config2.canvas, canvases);
    expect(secondBake).toBeDefined();
    expect(secondBake).not.toBe(firstBake);
    expect(secondBake.width).toBe(firstBake.width * 2);
    expect(secondBake.height).toBe(firstBake.height * 2);
  });

  it("bakes an icon only for the environment whose image decoded", () => {
    const makeUndecodedEnv = () => {
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
            // jsdom never decodes, so the load is settled by hand below
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

    const a = makeUndecodedEnv();
    const b = makeUndecodedEnv();
    const elements = [linkedRect()];
    const sceneA = makeScene();
    const sceneB = makeScene();
    const configA = makeConfig(elements, {
      scale: 1,
      renderEnvironment: a.env,
      canvas: sceneA,
    });
    const configB = makeConfig(elements, {
      scale: 1,
      renderEnvironment: b.env,
      canvas: sceneB,
    });

    renderStaticScene(configA);
    renderStaticScene(configB);
    expect(a.images).toHaveLength(1);
    expect(b.images).toHaveLength(1);
    // nothing is baked while the image is undecoded -- the bake is memoized
    // under a key with no notion of load state, so a blank one would stick
    expect(iconBlits(sceneA, a.canvases)).toHaveLength(0);
    expect(iconBlits(sceneB, b.canvases)).toHaveLength(0);

    // environment A's image decodes; environment B's does not
    a.images[0].onload?.({} as Event);

    renderStaticScene(configA);
    const aBlits = iconBlits(sceneA, a.canvases);
    expect(aBlits).toHaveLength(1);
    expect(getDrawImageSources(aBlits[0])).toContain(a.images[0]);

    // decode state is per environment: B still bakes nothing
    renderStaticScene(configB);
    expect(iconBlits(sceneB, b.canvases)).toHaveLength(0);
  });
});
