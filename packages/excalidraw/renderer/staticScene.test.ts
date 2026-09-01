import { describe, expect, it, vi } from "vitest";

import {
  cancelStaticSceneThrottle,
  renderStaticSceneThrottled,
} from "./staticScene";

import type { StaticSceneRenderConfig } from "../scene/types";

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
