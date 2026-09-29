import React from "react";

import { actionZoomIn } from "../actions/actionCanvas";
import { Excalidraw } from "../index";
import { getNormalizedZoom } from "../scene";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

import type { NormalizedZoomValue } from "../types";

const { h } = window;

describe("deep zoom", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("normalizes zoom up to a millionfold", () => {
    expect(getNormalizedZoom(100_000)).toBe(100_000);
  });

  it("clamps normalized zoom at a millionfold", () => {
    expect(getNormalizedZoom(5_000_000)).toBe(1_000_000);
  });

  it("keeps zooming in from a deep zoom set through updateScene", () => {
    act(() => {
      h.app.updateScene({
        appState: { zoom: { value: 500_000 as NormalizedZoomValue } },
      });
    });
    expect(h.state.zoom.value).toBe(500_000);
    act(() => {
      h.app.actionManager.executeAction(actionZoomIn, "api");
    });
    expect(h.state.zoom.value).toBeGreaterThan(500_000);
  });

  it("zooms in past 30x", () => {
    API.setAppState({ zoom: { value: 30 as NormalizedZoomValue } });
    act(() => {
      h.app.actionManager.executeAction(actionZoomIn, "api");
    });
    expect(h.state.zoom.value).toBeGreaterThan(30);
  });

  it("stops at a millionfold", () => {
    API.setAppState({ zoom: { value: 999_999.95 as NormalizedZoomValue } });
    act(() => {
      h.app.actionManager.executeAction(actionZoomIn, "api");
    });
    expect(h.state.zoom.value).toBe(1_000_000);
    act(() => {
      h.app.actionManager.executeAction(actionZoomIn, "api");
    });
    expect(h.state.zoom.value).toBe(1_000_000);
  });
});
