import React from "react";

import { MAX_ZOOM } from "@excalidraw/common";
import { getCommonBounds } from "@excalidraw/element";

import { actionZoomToFitSelection } from "../actions/actionCanvas";
import { getDefaultAppState } from "../appState";
import { Excalidraw } from "../index";
import { getNormalizedZoom } from "../scene";
import { zoomToFitBounds } from "../viewport";

import { API } from "./helpers/api";
import { render } from "./test-utils";

import type { AppState, NormalizedZoomValue } from "../types";

const { h } = window;

const createAppState = (overrides: Partial<AppState> = {}): AppState => ({
  ...getDefaultAppState(),
  width: 800,
  height: 600,
  offsetLeft: 0,
  offsetTop: 0,
  ...overrides,
});

describe("zoomToFitBounds", () => {
  it("does not change zoom or scroll for empty common bounds with contain fit", () => {
    const appState = createAppState({
      zoom: { value: 1 as NormalizedZoomValue },
      scrollX: 40,
      scrollY: 20,
    });

    // empty scene: actionZoomToFitSelection falls back to getCommonBounds([])
    const bounds = getCommonBounds([]);
    expect(bounds).toEqual([0, 0, 0, 0]);

    const result = zoomToFitBounds({
      bounds,
      appState,
      fit: "contain",
    });

    expect(result.appState.zoom.value).toBe(appState.zoom.value);
    expect(result.appState.zoom.value).not.toBe(MAX_ZOOM);
    expect(result.appState.scrollX).toBe(appState.scrollX);
    expect(result.appState.scrollY).toBe(appState.scrollY);
  });
});

describe("actionZoomToFitSelection", () => {
  it("is a no-op on an empty scene", async () => {
    await render(<Excalidraw />);

    h.state.width = 800;
    h.state.height = 600;

    API.setAppState({
      zoom: { value: getNormalizedZoom(0.5) },
      scrollX: 120,
      scrollY: 80,
    });

    expect(h.elements).toHaveLength(0);
    expect(API.getSelectedElements()).toHaveLength(0);

    const { zoom, scrollX, scrollY } = h.state;

    API.executeAction(actionZoomToFitSelection);

    expect(h.state.zoom.value).toBe(zoom.value);
    expect(h.state.zoom.value).not.toBe(MAX_ZOOM);
    expect(h.state.scrollX).toBe(scrollX);
    expect(h.state.scrollY).toBe(scrollY);
  });

  it("empty scene scrolled away from origin keeps zoom and scroll", async () => {
    await render(<Excalidraw />);

    h.state.width = 800;
    h.state.height = 600;

    API.setAppState({
      zoom: { value: getNormalizedZoom(1) },
      scrollX: -400,
      scrollY: -250,
    });

    expect(h.elements).toHaveLength(0);
    expect(API.getSelectedElements()).toHaveLength(0);
    expect(h.state.zoom.value).toBe(1);
    expect(h.state.scrollX).toBe(-400);
    expect(h.state.scrollY).toBe(-250);

    API.executeAction(actionZoomToFitSelection);

    expect(h.state.zoom.value).toBe(1);
    expect(h.state.zoom.value).not.toBe(MAX_ZOOM);
    expect(h.state.scrollX).toBe(-400);
    expect(h.state.scrollY).toBe(-250);
  });

  it("still fits a real selection", async () => {
    await render(<Excalidraw />);

    h.state.width = 100;
    h.state.height = 100;

    const rectElement = API.createElement({
      width: 500,
      height: 500,
      x: 0,
      y: 0,
    });
    API.setElements([rectElement]);
    API.setSelectedElements([rectElement]);

    API.executeAction(actionZoomToFitSelection);

    // 500px of content into a 100px viewport — zoomed out, not slammed to max
    expect(h.state.zoom.value).toBeLessThan(1);
    expect(h.state.zoom.value).toBeGreaterThan(0);
    expect(h.state.zoom.value).not.toBe(MAX_ZOOM);
  });
});
