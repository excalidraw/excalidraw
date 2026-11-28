import React from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import {
  act,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "../tests/test-utils";

import { actionZoomToFit } from "./actionCanvas";

const { h } = window;

describe("actionZoomToFit", () => {
  beforeEach(() => {
    mockBoundingClientRect({ width: 1000, height: 800 });
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  const frame = API.createElement({
    type: "frame",
    x: 0,
    y: 0,
    width: 400,
    height: 300,
  });
  // mostly outside the frame, so mostly clipped
  const frameChild = API.createElement({
    type: "rectangle",
    x: 100,
    y: 100,
    width: 3000,
    height: 2000,
    frameId: frame.id,
  });

  const zoomToFit = (elements: readonly ExcalidrawElement[]) => {
    act(() => {
      API.setElements(elements);
      h.app.actionManager.executeAction(actionZoomToFit);
    });
    return {
      zoom: h.state.zoom.value,
      scrollX: h.state.scrollX,
      scrollY: h.state.scrollY,
    };
  };

  it("should ignore the clipped parts of frame children", async () => {
    await render(<Excalidraw />);

    expect(zoomToFit([frame, frameChild])).toEqual(zoomToFit([frame]));
  });

  it("should include frame children when frames don't clip", async () => {
    await render(<Excalidraw />);
    act(() => {
      h.setState({
        frameRendering: { ...h.state.frameRendering, clip: false },
      });
    });

    expect(zoomToFit([frame, frameChild]).zoom).toBeLessThan(
      zoomToFit([frame]).zoom,
    );
  });
});
