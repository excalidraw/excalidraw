import { getCommonBounds, isTextElement } from "../../element";
import { updateBoundElements } from "../../element/binding";
import { mutateElement } from "../../element/mutateElement";
import { rescalePointsInElement } from "../../element/resizeElements";
import {
  getBoundTextElement,
  handleBindTextResize,
} from "../../element/textElement";
import type { ElementsMap, ExcalidrawElement } from "../../element/types";
import DragInput from "./DragInput";
import type { DragInputCallbackType } from "./DragInput";
import { getStepSizedValue } from "./utils";

interface MultiDimensionProps {
  property: "width" | "height";
  elements: ExcalidrawElement[];
  elementsMap: ElementsMap;
}

const STEP_SIZE = 10;

const getResizedUpdates = (
  anchorX: number,
  anchorY: number,
  scale: number,
  stateAtStart: ExcalidrawElement,
) => {
  const offsetX = stateAtStart.x - anchorX;
  const offsetY = stateAtStart.y - anchorY;
  const nextWidth = stateAtStart.width * scale;
  const nextHeight = stateAtStart.height * scale;
  const x = anchorX + offsetX * scale;
  const y = anchorY + offsetY * scale;

  return {
    width: nextWidth,
    height: nextHeight,
    x,
    y,
    ...rescalePointsInElement(stateAtStart, nextWidth, nextHeight, false),
    ...(isTextElement(stateAtStart)
      ? { fontSize: stateAtStart.fontSize * scale }
      : {}),
  };
};

const resizeElement = (
  anchorX: number,
  anchorY: number,
  property: MultiDimensionProps["property"],
  scale: number,
  latestElement: ExcalidrawElement,
  origElement: ExcalidrawElement,
  elementsMap: ElementsMap,
  originalElementsMap: ElementsMap,
  shouldInformMutation: boolean,
) => {
  const updates = getResizedUpdates(anchorX, anchorY, scale, origElement);

  mutateElement(latestElement, updates, shouldInformMutation);
  const boundTextElement = getBoundTextElement(
    origElement,
    originalElementsMap,
  );
  if (boundTextElement) {
    const newFontSize = boundTextElement.fontSize * scale;
    updateBoundElements(latestElement, elementsMap, {
      newSize: { width: updates.width, height: updates.height },
    });
    const latestBoundTextElement = elementsMap.get(boundTextElement.id);
    if (latestBoundTextElement && isTextElement(latestBoundTextElement)) {
      mutateElement(
        latestBoundTextElement,
        {
          fontSize: newFontSize,
        },
        shouldInformMutation,
      );
      handleBindTextResize(
        latestElement,
        elementsMap,
        property === "width" ? "e" : "s",
        true,
      );
    }
  }
};

const MultiDimension = ({
  property,
  elements,
  elementsMap,
}: MultiDimensionProps) => {
  const handleDimensionChange: DragInputCallbackType = ({
    accumulatedChange,
    stateAtStart,
    originalElementsMap,
    shouldChangeByStepSize,
    nextValue,
  }) => {
    const [x1, y1, x2, y2] = getCommonBounds(stateAtStart);
    const initialWidth = x2 - x1;
    const initialHeight = y2 - y1;
    const keepAspectRatio = true;
    const aspectRatio = initialWidth / initialHeight;

    if (nextValue !== undefined) {
      const nextHeight =
        property === "height" ? nextValue : nextValue / aspectRatio;

      const scale = nextHeight / initialHeight;
      const anchorX = property === "width" ? x1 : x1 + width / 2;
      const anchorY = property === "height" ? y1 : y1 + height / 2;

      let i = 0;
      while (i < stateAtStart.length) {
        const latestElement = elements[i];
        const origElement = stateAtStart[i];

        // it should never happen that element and origElement are different
        // but check just in case
        if (latestElement.id === origElement.id) {
          resizeElement(
            anchorX,
            anchorY,
            property,
            scale,
            latestElement,
            origElement,
            elementsMap,
            originalElementsMap,
            i === stateAtStart.length - 1,
          );
        }
        i++;
      }

      return;
    }

    const changeInWidth = property === "width" ? accumulatedChange : 0;
    const changeInHeight = property === "height" ? accumulatedChange : 0;

    let nextWidth = Math.max(0, initialWidth + changeInWidth);
    if (property === "width") {
      if (shouldChangeByStepSize) {
        nextWidth = getStepSizedValue(nextWidth, STEP_SIZE);
      } else {
        nextWidth = Math.round(nextWidth);
      }
    }

    let nextHeight = Math.max(0, initialHeight + changeInHeight);
    if (property === "height") {
      if (shouldChangeByStepSize) {
        nextHeight = getStepSizedValue(nextHeight, STEP_SIZE);
      } else {
        nextHeight = Math.round(nextHeight);
      }
    }

    if (keepAspectRatio) {
      if (property === "width") {
        nextHeight = Math.round((nextWidth / aspectRatio) * 100) / 100;
      } else {
        nextWidth = Math.round(nextHeight * aspectRatio * 100) / 100;
      }
    }

    const scale = nextHeight / initialHeight;
    const anchorX = property === "width" ? x1 : x1 + width / 2;
    const anchorY = property === "height" ? y1 : y1 + height / 2;

    let i = 0;
    while (i < stateAtStart.length) {
      const latestElement = elements[i];
      const origElement = stateAtStart[i];

      if (latestElement.id === origElement.id) {
        resizeElement(
          anchorX,
          anchorY,
          property,
          scale,
          latestElement,
          origElement,
          elementsMap,
          originalElementsMap,
          i === stateAtStart.length - 1,
        );
      }
      i++;
    }
  };

  const [x1, y1, x2, y2] = getCommonBounds(elements);
  const width = x2 - x1;
  const height = y2 - y1;

  return (
    <DragInput
      label={property === "width" ? "W" : "H"}
      elements={elements}
      dragInputCallback={handleDimensionChange}
      value={Math.round((property === "width" ? width : height) * 100) / 100}
    />
  );
};

export default MultiDimension;
