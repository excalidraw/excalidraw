import { isEmbeddableElement } from "../element/typeChecks";
import {
  ExcalidrawEmbeddableElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import { ToolType } from "../types";

export const hasBackground = (type: ToolType | "custom") =>
  type === "rectangle" ||
  type === "embeddable" ||
  type === "ellipse" ||
  type === "diamond" ||
  type === "line" ||
  type === "freedraw";

export const hasStrokeColor = (type: ToolType | "custom") =>
  type !== "image" && type !== "frame" && type !== "magicframe";

export const hasStrokeWidth = (type: ToolType | "custom") =>
  type === "rectangle" ||
  type === "embeddable" ||
  type === "ellipse" ||
  type === "diamond" ||
  type === "freedraw" ||
  type === "arrow" ||
  type === "line";

export const hasStrokeStyle = (type: ToolType | "custom") =>
  type === "rectangle" ||
  type === "embeddable" ||
  type === "ellipse" ||
  type === "diamond" ||
  type === "arrow" ||
  type === "line";

export const canChangeRoundness = (type: ToolType | "custom") =>
  type === "rectangle" ||
  type === "embeddable" ||
  type === "arrow" ||
  type === "line" ||
  type === "diamond";

export const canHaveArrowheads = (type: ToolType | "custom") =>
  type === "arrow";

export const getElementAtPosition = (
  elements: readonly NonDeletedExcalidrawElement[],
  isAtPositionFn: (element: NonDeletedExcalidrawElement) => boolean,
) => {
  let hitElement = null;
  // We need to to hit testing from front (end of the array) to back (beginning of the array)
  // because array is ordered from lower z-index to highest and we want element z-index
  // with higher z-index
  for (let index = elements.length - 1; index >= 0; --index) {
    const element = elements[index];
    if (element.isDeleted) {
      continue;
    }
    if (isAtPositionFn(element)) {
      hitElement = element;
      break;
    }
  }

  return hitElement;
};

export const getElementsAtPosition = (
  elements: readonly NonDeletedExcalidrawElement[],
  isAtPositionFn: (element: NonDeletedExcalidrawElement) => boolean,
) => {
  const embeddables: ExcalidrawEmbeddableElement[] = [];
  // The parameter elements comes ordered from lower z-index to higher.
  // We want to preserve that order on the returned array.
  // Exception being embeddables which should be on top of everything else in
  // terms of hit testing.
  const elsAtPos = elements.filter((element) => {
    const hit = !element.isDeleted && isAtPositionFn(element);
    if (hit) {
      if (isEmbeddableElement(element)) {
        embeddables.push(element);
        return false;
      }
      return true;
    }
    return false;
  });
  return elsAtPos.concat(embeddables);
};
