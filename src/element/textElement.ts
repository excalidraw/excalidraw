import { measureText } from "../utils";
import { ExcalidrawTextElement } from "./types";
import { mutateTextElement } from "./mutateElement";

export const redrawTextBoundingBox = (element: ExcalidrawTextElement) => {
  const metrics = measureText(element.text, element.font);
  mutateTextElement(element, {
    width: metrics.width,
    height: metrics.height,
    baseline: metrics.baseline,
  });
};
