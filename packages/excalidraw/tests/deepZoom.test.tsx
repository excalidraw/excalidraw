import React from "react";

import { actionZoomIn } from "../actions/actionCanvas";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

import type { NormalizedZoomValue } from "../types";

const { h } = window;

describe("deep zoom", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
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
