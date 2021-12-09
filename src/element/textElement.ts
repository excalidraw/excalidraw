import {
  measureText,
  getFontString,
  arrayToMap,
  getMinCharWidth,
  wrapText,
} from "../utils";
import {
  ExcalidrawBindableTextELement,
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "./types";
import { mutateElement } from "./mutateElement";
import {
  hasBoundTextElement,
  isExcalidrawBindableTextELement,
} from "./typeChecks";
import { PADDING } from "../constants";
import { MaybeTransformHandleType } from "./transformHandles";
import Scene from "../scene/Scene";

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

export const handleBindTextResize = (
  elements: readonly NonDeletedExcalidrawElement[],
  transformHandleType: MaybeTransformHandleType,
) => {
  elements.forEach((element) => {
    if (hasBoundTextElement(element)) {
      const textElement = Scene.getScene(element)!.getElement(
        element.boundTextElementId,
      ) as ExcalidrawTextElement;
      if (textElement && textElement.text) {
        const updatedElement = Scene.getScene(element)!.getElement(element.id);
        if (!updatedElement) {
          return;
        }
        let text = textElement.text;
        let nextWidth = textElement.width;
        let nextHeight = textElement.height;
        let containerHeight = updatedElement.height;
        let nextBaseLine = textElement.baseline;
        if (transformHandleType !== "n" && transformHandleType !== "s") {
          console.info("attempt to call wrap text");
          let minCharWidthTillNow = 0;
          if (text) {
            minCharWidthTillNow = getMinCharWidth(getFontString(textElement));
            const diff = Math.abs(
              updatedElement.width - textElement.width - PADDING * 2,
            );
            if (diff >= minCharWidthTillNow) {
              text = wrapText(
                textElement.originalText,
                getFontString(textElement),
                updatedElement,
              );
              console.info("called wrap text");
            }
          }

          const dimensions = measureText(text, getFontString(textElement));
          nextWidth = dimensions.width;
          nextHeight = dimensions.height;
          nextBaseLine = dimensions.baseline;
        }
        if (nextHeight > updatedElement.height - PADDING * 2) {
          containerHeight = nextHeight + PADDING * 2;
          mutateElement(updatedElement, { height: containerHeight });
        }

        const updatedY =
          updatedElement!.y + containerHeight / 2 - nextHeight / 2;

        const updatedX =
          updatedElement!.x + updatedElement!.width / 2 - nextWidth / 2;
        mutateElement(textElement, {
          text,
          width: nextWidth,
          height: nextHeight,
          y: updatedY,
          x: updatedX,
          baseline: nextBaseLine,
        });
      }
    }
  });
};
