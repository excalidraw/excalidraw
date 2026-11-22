import React from "react";
import { act, render } from "@testing-library/react";
import { vi } from "vitest";

import { Toast } from "./Toast";

describe("Toast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should close after its duration, however often its host re-renders it", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    // a new onClose each render, as a host's inline one is
    const renderToast = () => (
      <Toast message="hello" duration={1000} onClose={() => onClose()} />
    );
    const { rerender } = render(renderToast());
    for (let elapsed = 0; elapsed < 1000; elapsed += 250) {
      expect(onClose).not.toHaveBeenCalled();
      rerender(renderToast());
      act(() => {
        vi.advanceTimersByTime(250);
      });
    }
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
