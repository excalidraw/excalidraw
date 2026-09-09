import type { ExcalidrawElement } from "@excalidraw/element/types";

export type StrokeWidthKey = "thin" | "medium" | "bold";

export const STROKE_WIDTH_KEYS: readonly StrokeWidthKey[] = [
  "thin",
  "medium",
  "bold",
];

export const STROKE_WIDTH: Readonly<
  Record<StrokeWidthKey | "extraBold", ExcalidrawElement["strokeWidth"]>
> = {
  thin: 1,
  medium: 2,
  bold: 4,
  extraBold: 8, // unused (may be introduced in the future)
};

// freedraw schema 2.0 uses thinner stroke, but to maintain backwards and
// forwards compatibility, instead of changing the shape renderer, we scale
// the stroke width by 1/2 (previous, thin was 1, medium 2 etc.)
//
// note that in the UI, STROKE_WIDTH.thin == FREEDRAW_STROKE_WIDTH.thin still
export const FREEDRAW_STROKE_WIDTH: Readonly<
  Record<StrokeWidthKey | "extraBold", ExcalidrawElement["strokeWidth"]>
> = {
  thin: 0.5,
  medium: 1,
  bold: 2,
  extraBold: 4, // legacy (may be used again in the future)
};

const STROKE_WIDTH_TO_KEY = {
  generic: Object.fromEntries(
    Object.entries(STROKE_WIDTH).map(([key, value]) => [value, key]),
  ) as Record<ExcalidrawElement["strokeWidth"], StrokeWidthKey | undefined>,
  freedraw: Object.fromEntries(
    Object.entries(FREEDRAW_STROKE_WIDTH).map(([key, value]) => [value, key]),
  ) as Record<ExcalidrawElement["strokeWidth"], StrokeWidthKey | undefined>,
};

export const getStrokeWidthKeyForElement = (
  element: Pick<ExcalidrawElement, "type" | "strokeWidth">,
): StrokeWidthKey | null => {
  const strokeWidthToKey =
    element.type === "freedraw"
      ? STROKE_WIDTH_TO_KEY.freedraw
      : STROKE_WIDTH_TO_KEY.generic;

  return strokeWidthToKey[element.strokeWidth] ?? null;
};

export const getStrokeWidthByKey = (
  elementType: ExcalidrawElement["type"],
  strokeWidthKey: StrokeWidthKey,
): ExcalidrawElement["strokeWidth"] => {
  return elementType === "freedraw"
    ? FREEDRAW_STROKE_WIDTH[strokeWidthKey]
    : STROKE_WIDTH[strokeWidthKey];
};

export const DEFAULT_ELEMENT_STROKE_WIDTH_KEY: StrokeWidthKey = "medium";
