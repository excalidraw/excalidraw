import React from "react";
import { act, render } from "@testing-library/react";
import { vi } from "vitest";

import { Excalidraw } from "../index";
import { render as renderApp } from "../tests/test-utils";

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

  it("should give a toast shown again its full duration", async () => {
    await renderApp(<Excalidraw />);
    vi.useFakeTimers();
    const showToast = () =>
      act(() => {
        window.h.app.setToast({ message: "hello", duration: 1000 });
      });
    const advanceTimersByTime = (ms: number) =>
      act(() => {
        vi.advanceTimersByTime(ms);
      });

    showToast();
    advanceTimersByTime(900);
    // the same message, but another toast
    showToast();
    advanceTimersByTime(900);
    expect(window.h.state.toast).not.toBe(null);
    advanceTimersByTime(100);
    expect(window.h.state.toast).toBe(null);
  });
});
