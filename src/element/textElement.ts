import { measureMath } from "../mathmode";
import { ExcalidrawTextElement } from "./types";
import { mutateElement } from "./mutateElement";

export const redrawTextBoundingBox = (element: ExcalidrawTextElement) => {
  const metrics = measureMath(
    element.text,
    element.fontSize,
    element.fontFamily,
    element.useTex,
  );
  mutateElement(element, {
    width: metrics.width,
    height: metrics.height,
    baseline: metrics.baseline,
  });
};
