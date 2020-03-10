import { measureText } from "../utils";
import { MutableExcalidrawTextElement } from "./types";

export const redrawTextBoundingBox = (
  element: MutableExcalidrawTextElement,
) => {
  const metrics = measureText(element.text, element.font);
  element.width = metrics.width;
  element.height = metrics.height;
  element.baseline = metrics.baseline;
};
