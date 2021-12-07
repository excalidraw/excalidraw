import { measureText, getFontString } from "../utils";
import { ExcalidrawTextElement } from "./types";
import { mutateElement } from "./mutateElement";

export const redrawTextBoundingBox = (element: ExcalidrawTextElement) => {
  let maxWidth;
  if (element.textContainerId) {
    maxWidth = element.width;
  }
  const metrics = measureText(element.text, getFontString(element), maxWidth);

  mutateElement(element, {
    width: metrics.width,
    height: metrics.height,
    baseline: metrics.baseline,
  });
};
