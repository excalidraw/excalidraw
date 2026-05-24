import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnimationController } from "../renderer/animation";

const FIRST_KEY = "animation-test-first";
const SECOND_KEY = "animation-test-second";

describe("AnimationController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.EXCALIDRAW_THROTTLE_RENDER = false;
  });

  afterEach(() => {
    AnimationController.cancel(FIRST_KEY);
    AnimationController.cancel(SECOND_KEY);
    window.EXCALIDRAW_THROTTLE_RENDER = undefined;
    vi.useRealTimers();
  });

  it("starts a new animation after the previous last animation was cancelled", async () => {
    let firstFrames = 0;
    AnimationController.start(FIRST_KEY, () => {
      firstFrames++;
      return { keep: true };
    });

    expect(firstFrames).toBe(1);

    AnimationController.cancel(FIRST_KEY);
    await vi.runOnlyPendingTimersAsync();

    let secondFrames = 0;
    AnimationController.start(SECOND_KEY, () => {
      secondFrames++;
      return secondFrames === 1 ? { keep: true } : null;
    });

    expect(secondFrames).toBe(1);

    await vi.runOnlyPendingTimersAsync();

    expect(secondFrames).toBe(2);
    expect(AnimationController.running(SECOND_KEY)).toBe(false);
  });
});
