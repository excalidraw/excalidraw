import React from "react";
import {
  act,
  fireEvent,
  render as renderReact,
  waitFor,
} from "@testing-library/react";
import { vi } from "vitest";

import { MIME_TYPES } from "@excalidraw/common";
import {
  newElement,
  newFreeDrawElement,
  newImageElement,
  newTextElement,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";
import type { RenderEnvironment } from "@excalidraw/element";
import type { FileId } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { getDefaultAppState } from "../appState";
import { AnimationController } from "../renderer/animation";
import { exportToCanvas, exportToSvg } from "../scene/export";
import { TOOLTIP_CLASS, TOOLTIP_VISIBLE_CLASS } from "../components/Tooltip";

import type { AppState, BinaryFiles, DataURL } from "../types";
import type App from "../components/App";

/** a 1x1 transparent PNG, so image elements take the real rendering path */
const PNG_DATA_URL =
  `data:${MIME_TYPES.png};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==` as DataURL;

const makeScene = () => {
  const fileId = "host-abstraction-image" as FileId;
  const elements = [
    newTextElement({ x: 0, y: 0, text: "hello", fontSize: 20 }),
    newElement({
      type: "rectangle",
      x: 0,
      y: 40,
      width: 100,
      height: 50,
      link: "https://excalidraw.com",
    }),
    newImageElement({
      type: "image",
      x: 120,
      y: 40,
      width: 10,
      height: 10,
      fileId,
      status: "saved",
      scale: [1, 1],
    }),
    newFreeDrawElement({
      type: "freedraw",
      x: 0,
      y: 120,
      simulatePressure: true,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(10, 10),
        pointFrom<LocalPoint>(20, 5),
      ],
    }),
  ];
  const files: BinaryFiles = {
    [fileId]: {
      id: fileId,
      dataURL: PNG_DATA_URL,
      mimeType: MIME_TYPES.png,
      created: 0,
      lastRetrieved: 0,
    },
  };
  return { elements, files };
};

/**
 * The editor must be able to run in a document that isn't the module's own --
 * a popout window, an iframe, a multi-tenant embed -- with every host object
 * it mints (canvases, images, portals, tooltips) and every frame it schedules
 * belonging to *that* realm. Two editors alive at once is what turns any
 * process-global into a bug, so this exercises a pair of them.
 */
describe("multi-window editors", () => {
  /**
   * An iframe standing in for a second browser window. jsdom gives each frame
   * a real document but a mostly inert window, so the bits the editor reaches
   * for are filled in here from the main realm.
   */
  const createRealm = () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);

    const ownerDocument = iframe.contentDocument!;
    const ownerWindow = iframe.contentWindow! as Window & typeof globalThis;
    const mountNode = ownerDocument.createElement("div");
    ownerDocument.body.append(mountNode);

    const images: HTMLImageElement[] = [];
    const RealmImage = function () {
      const image = ownerDocument.createElement("img");
      images.push(image);
      return image;
    } as unknown as typeof Image;

    const setTimeoutSpy = vi.fn((...args: Parameters<typeof setTimeout>) =>
      window.setTimeout(...args),
    );

    Object.defineProperties(ownerWindow, {
      addEventListener: { value: vi.fn() },
      removeEventListener: { value: vi.fn() },
      requestAnimationFrame: {
        value: window.requestAnimationFrame.bind(window),
      },
      cancelAnimationFrame: {
        value: window.cancelAnimationFrame.bind(window),
      },
      setTimeout: { value: setTimeoutSpy },
      clearTimeout: { value: window.clearTimeout.bind(window) },
      ResizeObserver: { value: window.ResizeObserver },
      Image: { value: RealmImage },
    });
    Object.defineProperty(ownerDocument, "defaultView", { value: ownerWindow });
    Object.defineProperty(ownerDocument, "fonts", {
      value: {
        load: vi.fn().mockResolvedValue([]),
        check: vi.fn().mockReturnValue(true),
        has: vi.fn().mockReturnValue(true),
        add: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    // the canvas mock only patches the main realm's prototype, and it
    // type-checks `drawImage` sources against the main realm's classes --
    // per spec a canvas accepts image sources from any realm, so make it
    // permissive enough for cross-document canvases to be drawn
    const mainGetContext = window.HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(
      ownerWindow.HTMLCanvasElement.prototype,
      "getContext",
      {
        value(this: HTMLCanvasElement, contextType: string) {
          const context = mainGetContext.call(this, contextType);
          if (context) {
            (context as CanvasRenderingContext2D).drawImage = () => undefined;
          }
          return context;
        },
      },
    );

    const createElement = vi.spyOn(ownerDocument, "createElement");

    return {
      iframe,
      ownerDocument,
      ownerWindow,
      mountNode,
      images,
      setTimeoutSpy,
      canvasCount: () =>
        createElement.mock.calls.filter(([tag]) => tag === "canvas").length,
    };
  };

  const mount = async (
    realm: ReturnType<typeof createRealm>,
    { elements, files }: ReturnType<typeof makeScene>,
  ) => {
    const renderResult = renderReact(
      <Excalidraw
        ownerDocument={realm.ownerDocument}
        initialData={{ elements, files }}
      />,
      { container: realm.mountNode, baseElement: realm.ownerDocument.body },
    );
    await waitFor(() =>
      expect(
        renderResult.container.querySelector("canvas.interactive"),
      ).not.toBeNull(),
    );
    return { renderResult, app: window.h.app as InstanceType<typeof App> };
  };

  it("scopes host objects, scheduling and tooltips to each editor's own realm", async () => {
    const realmA = createRealm();
    const realmB = createRealm();
    // built up front: measuring their text mints a canvas through the
    // process-wide default environment, which is not what is under test here
    const sceneA = makeScene();
    const sceneB = makeScene();
    const mainCreateElement = vi.spyOn(document, "createElement");

    const a = await mount(realmA, sceneA);
    const b = await mount(realmB, sceneB);
    expect(a.app).not.toBe(b.app);

    try {
      // --- host objects come from the realm the editor lives in -------------

      // per-element bitmaps and the link icon canvas are minted through each
      // editor's own render environment
      await waitFor(() => expect(realmA.canvasCount()).toBeGreaterThan(0));
      await waitFor(() => expect(realmB.canvasCount()).toBeGreaterThan(0));
      // the module's own document is not a fallback for either of them
      expect(
        mainCreateElement.mock.calls.filter(([tag]) => tag === "canvas"),
      ).toHaveLength(0);

      // the same goes for images: the scene image, the not-yet-decoded
      // placeholder and the link icon
      const srcsOf = (images: HTMLImageElement[]) => images.map((i) => i.src);
      for (const realm of [realmA, realmB]) {
        await waitFor(() =>
          expect(
            srcsOf(realm.images).some((src) => src.includes(";base64")),
          ).toBe(true),
        );
        await waitFor(() =>
          expect(
            srcsOf(realm.images).some((src) =>
              src.includes("feather-external-link"),
            ),
          ).toBe(true),
        );
        expect(
          realm.images.every(
            (image) => image.ownerDocument === realm.ownerDocument,
          ),
        ).toBe(true);
      }

      // --- frames are scheduled on the owning window ------------------------

      realmA.setTimeoutSpy.mockClear();
      realmB.setTimeoutSpy.mockClear();

      act(() => {
        a.app.viewport.setViewport({
          target: [0, 0, 1000, 1000],
          fit: "scale-down",
          animation: { duration: 1000 },
        });
        b.app.viewport.setViewport({
          target: [2000, 2000, 3000, 3000],
          fit: "scale-down",
          animation: { duration: 1000 },
        });
      });

      // with process-global animation keys the second start was a silent
      // no-op; each editor must own its animation slot
      expect(
        AnimationController.running(a.app.viewport.scrollToContentAnimationKey),
      ).toBe(true);
      expect(
        AnimationController.running(b.app.viewport.scrollToContentAnimationKey),
      ).toBe(true);
      // ...and drive its frames through its own window, not the module's
      expect(realmA.setTimeoutSpy).toHaveBeenCalled();
      expect(realmB.setTimeoutSpy).toHaveBeenCalled();

      // cancelling one editor's transition must not touch the other's
      act(() => {
        a.app.viewport.setViewport(null);
      });
      expect(
        AnimationController.running(a.app.viewport.scrollToContentAnimationKey),
      ).toBe(false);
      expect(
        AnimationController.running(b.app.viewport.scrollToContentAnimationKey),
      ).toBe(true);
      act(() => {
        b.app.viewport.setViewport(null);
      });

      // --- the shared tooltip lives in the document that triggered it -------

      const wrapperA = a.renderResult.container.querySelector(
        ".excalidraw-tooltip-wrapper",
      )!;
      expect(wrapperA).not.toBeNull();
      act(() => {
        fireEvent.pointerEnter(wrapperA);
      });
      expect(
        realmA.ownerDocument.querySelector(`.${TOOLTIP_CLASS}`),
      ).toHaveClass(TOOLTIP_VISIBLE_CLASS);
      expect(
        realmB.ownerDocument.querySelector(`.${TOOLTIP_CLASS}`),
      ).toBeNull();
      expect(document.querySelector(`.${TOOLTIP_CLASS}`)).toBeNull();

      // a hover in the other realm takes the tooltip over rather than
      // reusing the first realm's stale node
      const wrapperB = b.renderResult.container.querySelector(
        ".excalidraw-tooltip-wrapper",
      )!;
      act(() => {
        fireEvent.pointerLeave(wrapperA);
        fireEvent.pointerEnter(wrapperB);
      });
      expect(
        realmB.ownerDocument.querySelector(`.${TOOLTIP_CLASS}`),
      ).toHaveClass(TOOLTIP_VISIBLE_CLASS);
      expect(
        realmA.ownerDocument.querySelector(`.${TOOLTIP_CLASS}`),
      ).not.toHaveClass(TOOLTIP_VISIBLE_CLASS);
    } finally {
      a.renderResult.unmount();
      b.renderResult.unmount();
      realmA.iframe.remove();
      realmB.iframe.remove();
      mainCreateElement.mockRestore();
    }
  });
});

/**
 * The export pipeline must run where `document` / `window` / `Path2D` don't
 * exist at all -- server-side thumbnailing under Node. The host objects a Node
 * canvas library would supply (`node-canvas`, `@napi-rs/canvas`) are stubbed
 * here rather than installed, so the suite stays free of native dependencies.
 */
describe("headless (server-side) export", () => {
  it("renders a scene with no browser globals, through an injected environment", async () => {
    // every host object is built while the globals still exist, standing in
    // for what a Node canvas library would hand back
    const hostDocument = document;
    const Path2DCtor = globalThis.Path2D;

    const canvases: HTMLCanvasElement[] = [];
    const createCanvas = () => {
      const canvas = hostDocument.createElement("canvas");
      // node-canvas / OffscreenCanvas are not DOM elements
      Object.defineProperty(canvas, "setAttribute", { value: undefined });
      Object.defineProperty(canvas, "isConnected", { value: undefined });
      canvases.push(canvas);
      return canvas;
    };
    const createImage = () => {
      const image = hostDocument.createElement("img");
      Object.defineProperty(image, "naturalWidth", { value: 10 });
      Object.defineProperty(image, "naturalHeight", { value: 10 });
      let src = "";
      Object.defineProperty(image, "src", {
        get: () => src,
        set: (value: string) => {
          src = value;
          // nothing decodes on its own here, so settle like a browser would
          queueMicrotask(() => image.onload?.({} as Event));
        },
      });
      return image;
    };
    const createPath = vi.fn((svgPath: string) => new Path2DCtor(svgPath));

    const renderEnvironment: RenderEnvironment = {
      createCanvas,
      createImage,
      createPath,
    };

    const target = createCanvas();
    const appState = {
      ...getDefaultAppState(),
      width: 200,
      height: 200,
    } as AppState;
    const { elements, files } = makeScene();

    const fillText = vi.spyOn(
      Object.getPrototypeOf(
        hostDocument.createElement("canvas").getContext("2d")!,
      ) as CanvasRenderingContext2D,
      "fillText",
    );

    // no DOM, and no global `Path2D` for freedraw to fall back on
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("Path2D", undefined);

    try {
      const canvas = await exportToCanvas(
        elements,
        appState,
        files,
        {
          exportBackground: true,
          viewBackgroundColor: "#ffffff",
          renderEnvironment,
        },
        (width, height) => {
          target.width = width;
          target.height = height;
          return { canvas: target, scale: 1 };
        },
      );

      expect(canvas).toBe(target);
      // text was measured and painted rather than swallowed by the
      // renderer's per-element error handling
      expect(fillText).toHaveBeenCalledWith("hello", 0, expect.any(Number));
      // the freedraw stroke was filled through the injected path factory
      expect(createPath).toHaveBeenCalled();
      expect(createPath.mock.calls[0][0]).toMatch(/^M/);

      // `exportToSvg` builds real DOM nodes, so a server-side caller supplies
      // the document (a DOM shim) alongside the render environment
      const svg = await exportToSvg(
        elements,
        {
          exportBackground: true,
          viewBackgroundColor: "#ffffff",
        },
        files,
        { ownerDocument: hostDocument, renderEnvironment },
      );

      expect(svg.tagName.toLowerCase()).toBe("svg");
      expect(svg.ownerDocument).toBe(hostDocument);
      expect(svg.querySelector("text")?.textContent).toBe("hello");
    } finally {
      vi.unstubAllGlobals();
      fillText.mockRestore();
    }
  });

  it("fails the export rather than shipping a partial image", async () => {
    const hostDocument = document;
    const target = hostDocument.createElement("canvas");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { elements } = makeScene();
    const appState = {
      ...getDefaultAppState(),
      width: 200,
      height: 200,
    } as AppState;

    // a Node host that supplies no `createPath` and has no global `Path2D`:
    // every freedraw element is unrenderable
    vi.stubGlobal("Path2D", undefined);

    try {
      await expect(
        exportToCanvas(
          elements,
          appState,
          {},
          { exportBackground: true, viewBackgroundColor: "#ffffff" },
          (width, height) => {
            target.width = width;
            target.height = height;
            return { canvas: target, scale: 1 };
          },
          async () => {},
        ),
      ).rejects.toThrow(/Path2D/);
      // the editor logs and keeps painting; an export must not
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      consoleError.mockRestore();
    }
  });
});
