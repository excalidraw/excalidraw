import React from "react";

import { Excalidraw } from "../index";
import { getNormalizedZoom } from "../scene";

import { Pointer } from "./helpers/ui";
import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

const { h } = window;

const pinch = (from: number, to: number) => {
  const finger1 = new Pointer("touch", 1);
  const finger2 = new Pointer("touch", 2);
  finger1.downAt(100 - from / 2, 100);
  finger2.downAt(100 + from / 2, 100);
  finger1.moveTo(100 - to / 2, 100);
  finger2.moveTo(100 + to / 2, 100);
  finger1.up();
  finger2.up();
};

const ratioOfPinchAt = (zoom: number, from: number, to: number) => {
  React.act(() => {
    h.setState({ zoom: { value: getNormalizedZoom(zoom) } });
  });
  pinch(from, to);
  return h.state.zoom.value / zoom;
};

describe("one pinch of the same finger travel", () => {
  beforeEach(async () => {
    mockBoundingClientRect();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    await waitFor(() => expect(h.state.width).toBe(200));
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  describe("when pinching out", () => {
    let ratios: number[];

    beforeEach(() => {
      ratios = [1, 25, 250].map((zoom) => ratioOfPinchAt(zoom, 150, 30));
    });

    it("zooms out by the same ratio at every depth", () => {
      expect(ratios.map((ratio) => ratio.toFixed(3))).toEqual([
        "0.200",
        "0.200",
        "0.200",
      ]);
    });
  });

  describe("when pinching in", () => {
    let ratios: number[];

    beforeEach(() => {
      ratios = [1, 25, 250].map((zoom) => ratioOfPinchAt(zoom, 30, 150));
    });

    it("zooms in by the same ratio at every depth", () => {
      expect(ratios.map((ratio) => ratio.toFixed(3))).toEqual([
        "5.000",
        "5.000",
        "5.000",
      ]);
    });
  });
});
