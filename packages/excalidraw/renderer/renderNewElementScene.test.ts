import { vi } from "vitest";

import { getDefaultAppState } from "../appState";

import {
  cancelNewElementSceneThrottle,
  renderNewElementSceneThrottled,
} from "./renderNewElementScene";

import type { NewElementSceneRenderConfig } from "../scene/types";
import type { AppState } from "../types";

// the test setup replaces throttleRAF with a pass-through; we need the real one
vi.mock("@excalidraw/common", async (importActual) => ({
  ...(await importActual<typeof import("@excalidraw/common")>()),
}));

const createOwnerWindow = () => {
  const frames: FrameRequestCallback[] = [];
  const ownerWindow = {
    requestAnimationFrame: vi.fn((cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    }),
    cancelAnimationFrame: vi.fn(),
  };
  const flush = () => frames.splice(0).forEach((cb) => cb(0));
  return { ownerWindow, flush };
};

const createCanvas = (ownerWindow: object) => {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "ownerDocument", {
    value: { defaultView: ownerWindow },
  });
  const getContext = vi.spyOn(canvas, "getContext");
  return { canvas, getContext };
};

const createConfig = (canvas: HTMLCanvasElement): NewElementSceneRenderConfig =>
  ({
    canvas,
    rc: {},
    newElement: null,
    elementsMap: new Map(),
    allElementsMap: new Map(),
    scale: 1,
    appState: {
      ...getDefaultAppState(),
      width: 100,
      height: 100,
    } as AppState,
    renderConfig: {},
  } as unknown as NewElementSceneRenderConfig);

describe("renderNewElementSceneThrottled", () => {
  it("schedules each canvas on its own owner window", () => {
    const main = createOwnerWindow();
    const popout = createOwnerWindow();
    const a = createCanvas(main.ownerWindow);
    const b = createCanvas(popout.ownerWindow);

    renderNewElementSceneThrottled(createConfig(a.canvas));
    renderNewElementSceneThrottled(createConfig(b.canvas));

    expect(main.ownerWindow.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(popout.ownerWindow.requestAnimationFrame).toHaveBeenCalledTimes(1);

    main.flush();
    expect(a.getContext).toHaveBeenCalled();
    expect(b.getContext).not.toHaveBeenCalled();

    popout.flush();
    expect(b.getContext).toHaveBeenCalled();
  });

  it("doesn't drop another canvas' pending frame", () => {
    const { ownerWindow, flush } = createOwnerWindow();
    const a = createCanvas(ownerWindow);
    const b = createCanvas(ownerWindow);

    renderNewElementSceneThrottled(createConfig(a.canvas));
    renderNewElementSceneThrottled(createConfig(b.canvas));
    flush();

    expect(a.getContext).toHaveBeenCalled();
    expect(b.getContext).toHaveBeenCalled();
  });

  it("cancels a canvas' pending frame", () => {
    const { ownerWindow, flush } = createOwnerWindow();
    const a = createCanvas(ownerWindow);

    renderNewElementSceneThrottled(createConfig(a.canvas));
    cancelNewElementSceneThrottle(a.canvas);
    flush();

    expect(a.getContext).not.toHaveBeenCalled();
  });
});
