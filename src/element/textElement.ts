import { measureText } from "../utils";
import { ExcalidrawTextElement } from "./types";
import { mutateElement } from "./mutateElement";

export const redrawTextBoundingBox = (element: ExcalidrawTextElement) => {
  const metrics = measureText(element.text, element.font);
  mutateElement(element, {
    width: metrics.width,
    height: metrics.height,
    baseline: metrics.baseline,
  });
};

export const parseTextFont = (element: ExcalidrawTextElement) => {
  const fontSplit = element.font.split(" ").filter((d) => !!d.trim());
  let fontFamily = fontSplit[0];
  let fontSize = "20px";
  if (fontSplit.length > 1) {
    fontFamily = fontSplit[1];
    fontSize = fontSplit[0];
  }
  return { fontSize, fontFamily };
};
