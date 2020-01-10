import { measureText } from "../utils";
import { ExcalidrawTextElement } from "./types";

export const redrawTextBoundingBox = (element: ExcalidrawTextElement) => {
  const metrics = measureText(element.text, element.font);
  element.width = metrics.width;
  element.height = metrics.height;
  element.baseline = metrics.baseline;
};
