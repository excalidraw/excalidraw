import React from "react";
import { vi } from "vitest";

import { resolvablePromise } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { act, render, waitFor } from "./test-utils";

import type { ExcalidrawImperativeAPI, ScrollConstraints } from "../types";

const FIRST_SCROLL_CONSTRAINTS: ScrollConstraints = {
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  lockZoom: true,
  overscrollAllowance: 0,
  viewportZoomFactor: 1,
  animateOnNextUpdate: false,
};

const SECOND_SCROLL_CONSTRAINTS: ScrollConstraints = {
  x: 100,
  y: 200,
  width: 500,
  height: 350,
  lockZoom: false,
  overscrollAllowance: 0.2,
  viewportZoomFactor: 0.8,
  animateOnNextUpdate: false,
};

describe("scrollConstraints", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("syncs prop updates after mount", async () => {
    const { rerender } = await render(<Excalidraw />);

    expect(window.h.state.scrollConstraints).toBe(null);

    rerender(<Excalidraw scrollConstraints={FIRST_SCROLL_CONSTRAINTS} />);

    await waitFor(() => {
      expect(window.h.state.scrollConstraints).toEqual(
        FIRST_SCROLL_CONSTRAINTS,
      );
    });

    rerender(<Excalidraw scrollConstraints={SECOND_SCROLL_CONSTRAINTS} />);

    await waitFor(() => {
      expect(window.h.state.scrollConstraints).toEqual(
        SECOND_SCROLL_CONSTRAINTS,
      );
    });

    rerender(<Excalidraw />);

    await waitFor(() => {
      expect(window.h.state.scrollConstraints).toBe(null);
    });
  });

  it("ignores setScrollConstraints() when the prop is controlled", async () => {
    const excalidrawAPIPromise = resolvablePromise<ExcalidrawImperativeAPI>();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await render(
      <Excalidraw
        scrollConstraints={FIRST_SCROLL_CONSTRAINTS}
        onExcalidrawAPI={(api) => {
          if (api) {
            excalidrawAPIPromise.resolve(api);
          }
        }}
      />,
    );

    const excalidrawAPI = await excalidrawAPIPromise;

    act(() => {
      excalidrawAPI.setScrollConstraints(SECOND_SCROLL_CONSTRAINTS);
    });

    expect(warn).toHaveBeenCalledWith(
      "Excalidraw: `setScrollConstraints()` is ignored when the `scrollConstraints` prop is controlled. Update the prop value instead.",
    );
    expect(window.h.state.scrollConstraints).toEqual(FIRST_SCROLL_CONSTRAINTS);
  });

  it("ignores scrollToContent() scrollLock when the prop is controlled", async () => {
    const excalidrawAPIPromise = resolvablePromise<ExcalidrawImperativeAPI>();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await render(
      <Excalidraw
        scrollConstraints={FIRST_SCROLL_CONSTRAINTS}
        onExcalidrawAPI={(api) => {
          if (api) {
            excalidrawAPIPromise.resolve(api);
          }
        }}
      />,
    );

    const excalidrawAPI = await excalidrawAPIPromise;
    const rectangle = API.createElement({
      x: 1000,
      y: 1000,
      width: 100,
      height: 100,
    });
    API.setElements([rectangle]);

    act(() => {
      excalidrawAPI.scrollToContent(rectangle, {
        animate: false,
        fitToViewport: true,
        scrollLock: {
          lockZoom: true,
          overscrollAllowance: 0,
        },
      });
    });

    expect(warn).toHaveBeenCalledWith(
      "Excalidraw: `scrollToContent()` with `scrollLock` is ignored when the `scrollConstraints` prop is controlled. Update the prop value instead.",
    );
    expect(window.h.state.scrollConstraints).toEqual(FIRST_SCROLL_CONSTRAINTS);
  });
});
