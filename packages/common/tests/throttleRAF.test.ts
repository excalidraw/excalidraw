
/**
 * @jest-environment jsdom
 */

import { throttleRAF } from "../src/throttleRAF";

describe("throttleRAF", () => {
  let rafCallbacks: FrameRequestCallback[] = [];
  let rafId = 0;
  let mockTime = 1000;

  beforeEach(() => {
    jest.useFakeTimers();
    rafCallbacks = [];
    rafId = 0;
    mockTime = 1000;

    global.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return ++rafId;
    }) as any;

    global.cancelAnimationFrame = jest.fn((id: number) => {
      rafCallbacks.length = 0;
    }) as any;

    global.performance = { now: jest.fn(() => mockTime) } as any;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const executeAnimationFrame = () => {
    mockTime += 16;
    const callbacks = [...rafCallbacks];
    rafCallbacks.length = 0;
    callbacks.forEach((cb) => cb(mockTime));
  };

  it("throttles multiple calls to one execution per frame with latest args", () => {
    const mockFn = jest.fn();
    const throttled = throttleRAF(mockFn);

    throttled("a");
    throttled("b");
    throttled("c");

    expect(mockFn).not.toHaveBeenCalled();

    executeAnimationFrame();

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith("c");
  });

  it("flush executes immediately and cancels scheduled RAF", () => {
    const mockFn = jest.fn();
    const throttled = throttleRAF(mockFn);

    throttled("flush-test");
    expect(global.requestAnimationFrame).toHaveBeenCalledTimes(1);

    throttled.flush();

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith("flush-test");
    expect(rafCallbacks.length).toBe(0);
  });

  it("cancel prevents execution", () => {
    const mockFn = jest.fn();
    const throttled = throttleRAF(mockFn);

    throttled("cancel-test");
    throttled.cancel();

    executeAnimationFrame();

    expect(mockFn).not.toHaveBeenCalled();
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("does not schedule multiple RAFs for repeated calls in different frames", () => {
    const mockFn = jest.fn();
    const throttled = throttleRAF(mockFn);

    throttled("x");
    throttled("y");
    executeAnimationFrame();

    throttled("z");
    expect(global.requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it("handles flush and cancel safely when no arguments are scheduled", () => {
    const mockFn = jest.fn();
    const throttled = throttleRAF(mockFn);

    throttled.flush();
    throttled.cancel();

    expect(mockFn).not.toHaveBeenCalled();
    expect(global.cancelAnimationFrame).not.toHaveBeenCalled();
  });

  it("RAF wrapper exits safely if lastArgs is null", () => {
    const mockFn = jest.fn();
    const throttled = throttleRAF(mockFn);

    throttled("initial-call");
    throttled.cancel();

    const rafCallback = (global.requestAnimationFrame as jest.Mock).mock
      .calls[0][0];
    rafCallback(performance.now());

    expect(mockFn).not.toHaveBeenCalled();
  });
});
