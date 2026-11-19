import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { vi } from "vitest";

import { withBatchedUpdates, withBatchedUpdatesThrottled } from "./reactUtils";

import type { Root } from "react-dom/client";

// Use the real throttleRAF instead of the immediate mock from setupTests.ts.
vi.mock("@excalidraw/common", async (importOriginal) => importOriginal());

describe("withBatchedUpdatesThrottled()", () => {
  let frameCallbacks: FrameRequestCallback[];
  let container: HTMLDivElement;
  let root: Root;
  let setValue: (value: number) => void;
  let actEnvironment: unknown;

  const Value = () => {
    const [value, _setValue] = useState(0);
    setValue = _setValue;
    return <span>{value}</span>;
  };

  const runScheduledFrame = () => {
    const callbacks = frameCallbacks;
    frameCallbacks = [];
    callbacks.forEach((callback) => callback(16));
  };

  beforeEach(async () => {
    frameCallbacks = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
      frameCallbacks.push(callback),
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Value />));

    // Outside act(), so that React schedules the renders as in a browser.
    actEnvironment = (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
  });

  afterEach(async () => {
    // let the renders scheduled by the test run before unmounting
    await new Promise((resolve) => setTimeout(resolve, 20));
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = actEnvironment;
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders the update of the animation frame before the frame ends", () => {
    const throttled = withBatchedUpdatesThrottled((value: number) => {
      setValue(value);
    });

    throttled(1);
    throttled(2);
    expect(container.textContent).toBe("0");

    runScheduledFrame();
    expect(container.textContent).toBe("2");
  });

  it("leaves the updates of flush() to the surrounding handler", async () => {
    const throttled = withBatchedUpdatesThrottled((value: number) => {
      setValue(value);
    });

    withBatchedUpdates(() => {
      throttled(1);
      throttled.flush();
    })();
    expect(container.textContent).toBe("0");

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.textContent).toBe("1");
  });
});
