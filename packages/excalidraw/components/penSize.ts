import { FREEDRAW_STROKE_WIDTH_RANGE } from "@excalidraw/common";
import { clamp } from "@excalidraw/math";

export const PEN_SIZE_SLIDER_MAX = 100;

const { min, max } = FREEDRAW_STROKE_WIDTH_RANGE;
const span = Math.log(max / min);

export const penSizeFromSlider = (position: number) =>
  min * Math.exp((span * position) / PEN_SIZE_SLIDER_MAX);

export const sliderFromPenSize = (width: number) =>
  clamp(
    (PEN_SIZE_SLIDER_MAX * Math.log(width / min)) / span,
    0,
    PEN_SIZE_SLIDER_MAX,
  );
