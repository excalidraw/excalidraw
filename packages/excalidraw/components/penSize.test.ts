import { FREEDRAW_STROKE_WIDTH_RANGE } from "@excalidraw/common";

import {
  PEN_SIZE_SLIDER_MAX,
  penSizeFromSlider,
  sliderFromPenSize,
} from "./penSize";

describe("penSize", () => {
  describe("when the slider sits at its left end", () => {
    let width: number;

    beforeEach(() => {
      width = penSizeFromSlider(0);
    });

    it("gives the thinnest pen", () => {
      expect(width).toBeCloseTo(FREEDRAW_STROKE_WIDTH_RANGE.min, 12);
    });
  });

  describe("when the slider sits at its right end", () => {
    let width: number;

    beforeEach(() => {
      width = penSizeFromSlider(PEN_SIZE_SLIDER_MAX);
    });

    it("gives the thickest pen", () => {
      expect(width).toBeCloseTo(FREEDRAW_STROKE_WIDTH_RANGE.max, 12);
    });
  });

  describe("when the slider sits halfway", () => {
    let width: number;

    beforeEach(() => {
      width = penSizeFromSlider(PEN_SIZE_SLIDER_MAX / 2);
    });

    it("gives the geometric mean of the range, not the arithmetic one", () => {
      expect(width).toBeCloseTo(
        Math.sqrt(
          FREEDRAW_STROKE_WIDTH_RANGE.min * FREEDRAW_STROKE_WIDTH_RANGE.max,
        ),
        12,
      );
    });
  });

  describe("when every slider position is mapped to a width and back", () => {
    let positions: number[];

    beforeEach(() => {
      positions = Array.from({ length: PEN_SIZE_SLIDER_MAX + 1 }, (_, i) =>
        sliderFromPenSize(penSizeFromSlider(i)),
      );
    });

    it("lands on the position it started from", () => {
      expect(positions.map((p) => Math.round(p * 1e9) / 1e9)).toEqual(
        Array.from({ length: PEN_SIZE_SLIDER_MAX + 1 }, (_, i) => i),
      );
    });
  });

  describe("when a width in range is mapped to the slider and back", () => {
    let width: number;

    beforeEach(() => {
      width = penSizeFromSlider(sliderFromPenSize(0.125));
    });

    it("comes back unchanged", () => {
      expect(width).toBeCloseTo(0.125, 12);
    });
  });

  describe("when a width below the range is mapped to the slider", () => {
    let position: number;

    beforeEach(() => {
      position = sliderFromPenSize(0.001);
    });

    it("pins the slider to its left end", () => {
      expect(position).toBe(0);
    });
  });

  describe("when a width above the range is mapped to the slider", () => {
    let position: number;

    beforeEach(() => {
      position = sliderFromPenSize(16);
    });

    it("pins the slider to its right end", () => {
      expect(position).toBe(PEN_SIZE_SLIDER_MAX);
    });
  });
});
