import { getAnimatedImageFrameIndex } from "../src/image";

import type { AnimatedImage } from "../src/types";

const createAnimation = (
  overrides?: Partial<AnimatedImage>,
): AnimatedImage => ({
  width: 1,
  height: 1,
  frameCount: 3,
  delays: [100, 50, 200],
  totalDuration: 350,
  loopCount: 0,
  image: null as unknown as ImageBitmap,
  renderedFrameIndex: 0,
  startTime: 1000,
  seek: () => {},
  ...overrides,
});

describe("getAnimatedImageFrameIndex", () => {
  const animation = createAnimation();

  it("selects the frame containing the playhead", () => {
    expect(getAnimatedImageFrameIndex(animation, 1000)).toBe(0);
    expect(getAnimatedImageFrameIndex(animation, 1099)).toBe(0);
    expect(getAnimatedImageFrameIndex(animation, 1100)).toBe(1);
    expect(getAnimatedImageFrameIndex(animation, 1149)).toBe(1);
    expect(getAnimatedImageFrameIndex(animation, 1150)).toBe(2);
    expect(getAnimatedImageFrameIndex(animation, 1349)).toBe(2);
  });

  it("loops back to the first frame", () => {
    expect(getAnimatedImageFrameIndex(animation, 1350)).toBe(0);
    expect(getAnimatedImageFrameIndex(animation, 1000 + 350 * 5 + 110)).toBe(1);
  });

  it("clamps time before startTime to the first frame", () => {
    expect(getAnimatedImageFrameIndex(animation, 0)).toBe(0);
  });

  it("freezes on the last frame once a finite loop finishes", () => {
    const looping = createAnimation({ loopCount: 2 });

    expect(getAnimatedImageFrameIndex(looping, 1000 + 699)).toBe(2);
    expect(getAnimatedImageFrameIndex(looping, 1000 + 700)).toBe(2);
    expect(getAnimatedImageFrameIndex(looping, 1000 + 70000)).toBe(2);
  });

  it("keeps looping when loopCount is 0", () => {
    expect(getAnimatedImageFrameIndex(animation, 1000 + 70200)).toBe(2);
  });
});
