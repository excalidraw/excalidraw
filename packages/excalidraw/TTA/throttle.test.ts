import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { throttle } from "./throttle";

describe("throttle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("invokes immediately on the leading edge", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 300);

    throttled("a");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("a");
  });

  it("parks calls inside the window and invokes the latest on the trailing edge", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 300);

    throttled("a");
    throttled("b");
    throttled("c");
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(299);
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("c");

    // no extra trailing invocation afterwards
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("flush invokes a parked call immediately", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 300);

    throttled("a");
    throttled("b");
    throttled.flush();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("b");

    // flush with nothing parked is a no-op
    throttled.flush();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("cancel drops the parked call and resets the window", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 300);

    throttled("a");
    throttled("b");
    throttled.cancel();

    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);

    // window was reset — the next call is a leading-edge immediate invoke
    throttled("c");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("c");
  });
});
