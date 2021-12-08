import { measureText, getFontString, arrayToMap } from "../utils";
import {
  ExcalidrawBindableTextELement,
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "./types";
import { mutateElement } from "./mutateElement";
import { isExcalidrawBindableTextELement } from "./typeChecks";

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

export const bindTextToShapeAfterDuplication = (
  sceneElements: ExcalidrawElement[],
  oldElements: ExcalidrawElement[],
  oldIdToDuplicatedId: Map<ExcalidrawElement["id"], ExcalidrawElement["id"]>,
): void => {
  const sceneElementMap = arrayToMap(sceneElements) as Map<
    ExcalidrawElement["id"],
    ExcalidrawElement
  >;
  oldElements.forEach((element) => {
    if (
      isExcalidrawBindableTextELement(element) &&
      element.boundTextElementId
    ) {
      const newElementId = oldIdToDuplicatedId.get(element.id) as string;
      const newTextElementId = oldIdToDuplicatedId.get(
        element.boundTextElementId,
      ) as string;
      mutateElement(
        sceneElementMap.get(newElementId) as ExcalidrawBindableTextELement,
        {
          boundTextElementId: newTextElementId,
        },
      );
      mutateElement(
        sceneElementMap.get(newTextElementId) as ExcalidrawTextElement,
        {
          textContainerId: newElementId,
        },
      );
    }
  });
};
