import { measureMath, getFontString } from "../mathmode";
import { ExcalidrawTextElement } from "./types";
import { mutateElement } from "./mutateElement";

export const redrawTextBoundingBox = (element: ExcalidrawTextElement) => {
  const metrics = measureMath(element.text, getFontString(element));
  mutateElement(element, {
    width: metrics.width,
    height: metrics.height,
    baseline: metrics.baseline,
  });
};
