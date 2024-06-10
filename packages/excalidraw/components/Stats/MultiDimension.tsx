import { getCommonBounds, isTextElement } from "../../element";
import { updateBoundElements } from "../../element/binding";
import { mutateElement } from "../../element/mutateElement";
import { rescalePointsInElement } from "../../element/resizeElements";
import {
  getBoundTextElement,
  handleBindTextResize,
} from "../../element/textElement";
import type { ElementsMap, ExcalidrawElement } from "../../element/types";
import {
  getElementsInGroup,
  getSelectedGroupIds,
  isInGroup,
} from "../../groups";
import Scene from "../../scene/Scene";
import type { AppState, Point } from "../../types";
import { resizeElement } from "./Dimension";
import DragInput from "./DragInput";
import type { DragInputCallbackType } from "./DragInput";
import { getStepSizedValue, isPropertyEditable } from "./utils";

interface MultiDimensionProps {
  property: "width" | "height";
  elements: readonly ExcalidrawElement[];
  elementsMap: ElementsMap;
  appState: AppState;
}

const STEP_SIZE = 10;

const getResizedUpdates = (
  anchorX: number,
  anchorY: number,
  scale: number,
  origElement: ExcalidrawElement,
) => {
  const offsetX = origElement.x - anchorX;
  const offsetY = origElement.y - anchorY;
  const nextWidth = origElement.width * scale;
  const nextHeight = origElement.height * scale;
  const x = anchorX + offsetX * scale;
  const y = anchorY + offsetY * scale;

  return {
    width: nextWidth,
    height: nextHeight,
    x,
    y,
    ...rescalePointsInElement(origElement, nextWidth, nextHeight, false),
    ...(isTextElement(origElement)
      ? { fontSize: origElement.fontSize * scale }
      : {}),
  };
};

const resizeElementInGroup = (
  anchorX: number,
  anchorY: number,
  property: MultiDimensionProps["property"],
  scale: number,
  latestElement: ExcalidrawElement,
  origElement: ExcalidrawElement,
  elementsMap: ElementsMap,
  originalElementsMap: ElementsMap,
) => {
  const updates = getResizedUpdates(anchorX, anchorY, scale, origElement);

  mutateElement(latestElement, updates, false);
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
        false,
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

const resizeGroup = (
  nextWidth: number,
  nextHeight: number,
  initialHeight: number,
  aspectRatio: number,
  anchor: Point,
  property: MultiDimensionProps["property"],
  latestElements: ExcalidrawElement[],
  originalElements: ExcalidrawElement[],
  elementsMap: ElementsMap,
  originalElementsMap: ElementsMap,
) => {
  // keep aspect ratio for groups
  if (property === "width") {
    nextHeight = Math.round((nextWidth / aspectRatio) * 100) / 100;
  } else {
    nextWidth = Math.round(nextHeight * aspectRatio * 100) / 100;
  }

  const scale = nextHeight / initialHeight;

  for (let i = 0; i < originalElements.length; i++) {
    const origElement = originalElements[i];
    const latestElement = latestElements[i];

    resizeElementInGroup(
      anchor[0],
      anchor[1],
      property,
      scale,
      latestElement,
      origElement,
      elementsMap,
      originalElementsMap,
    );
  }
};

const MultiDimension = ({
  property,
  elements,
  elementsMap,
  appState,
}: MultiDimensionProps) => {
  const selectedGroupIds = getSelectedGroupIds(appState);
  const groupSizes = selectedGroupIds.map((gid) => {
    const elementsInGroup = getElementsInGroup(elements, gid);
    const [x1, y1, x2, y2] = getCommonBounds(elementsInGroup);

    return Math.round((property === "width" ? x2 - x1 : y2 - y1) * 10) / 10;
  });

  const individualSizes = elements
    .filter((el) => !isInGroup(el) && isPropertyEditable(el, property))
    .map((el) => Math.round(el[property] * 10) / 10);

  const sizes = [...individualSizes, ...groupSizes];

  const value =
    new Set([...individualSizes, ...groupSizes]).size === 1
      ? Math.round(sizes[0] * 100) / 100
      : "Mixed";

  const editable = sizes.length > 0;

  const handleDimensionChange: DragInputCallbackType = ({
    accumulatedChange,
    originalElements,
    originalElementsMap,
    shouldChangeByStepSize,
    nextValue,
  }) => {
    const elementsInGroups = selectedGroupIds.map((gid) => ({
      groupId: gid,
      latestElements: getElementsInGroup(elements, gid),
      originalElements: getElementsInGroup(originalElements, gid),
    }));

    const editableLatestIndividualElements = elements.filter(
      (el) => isPropertyEditable(el, property) && !isInGroup(el),
    );

    const editableOriginalIndividualElements = originalElements.filter(
      (el) => isPropertyEditable(el, property) && !isInGroup(el),
    );

    if (nextValue !== undefined) {
      for (const elementsInGroup of elementsInGroups) {
        const { latestElements, originalElements } = elementsInGroup;
        const [x1, y1, x2, y2] = getCommonBounds(originalElements);
        const initialWidth = x2 - x1;
        const initialHeight = y2 - y1;
        const aspectRatio = initialWidth / initialHeight;
        const nextWidth =
          property === "width" ? Math.max(0, nextValue) : initialWidth;
        const nextHeight =
          property === "height" ? Math.max(0, nextValue) : initialHeight;

        resizeGroup(
          nextWidth,
          nextHeight,
          initialHeight,
          aspectRatio,
          [x1, y1],
          property,
          latestElements,
          originalElements,
          elementsMap,
          originalElementsMap,
        );
      }

      for (let i = 0; i < editableLatestIndividualElements.length; i++) {
        const latestElement = editableLatestIndividualElements[i];
        const origElement = editableOriginalIndividualElements[i];

        let nextWidth =
          property === "width" ? Math.max(0, nextValue) : latestElement.width;
        if (property === "width") {
          if (shouldChangeByStepSize) {
            nextWidth = getStepSizedValue(nextWidth, STEP_SIZE);
          } else {
            nextWidth = Math.round(nextWidth);
          }
        }

        let nextHeight =
          property === "height" ? Math.max(0, nextValue) : latestElement.height;
        if (property === "height") {
          if (shouldChangeByStepSize) {
            nextHeight = getStepSizedValue(nextHeight, STEP_SIZE);
          } else {
            nextHeight = Math.round(nextHeight);
          }
        }

        resizeElement(
          nextWidth,
          nextHeight,
          false,
          latestElement,
          origElement,
          elementsMap,
          originalElementsMap,
          false,
        );
      }

      Scene.getScene(elements[0])?.triggerUpdate();

      return;
    }

    const changeInWidth = property === "width" ? accumulatedChange : 0;
    const changeInHeight = property === "height" ? accumulatedChange : 0;

    for (const elementsInGroup of elementsInGroups) {
      const { latestElements, originalElements } = elementsInGroup;

      const [x1, y1, x2, y2] = getCommonBounds(originalElements);
      const initialWidth = x2 - x1;
      const initialHeight = y2 - y1;
      const aspectRatio = initialWidth / initialHeight;
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

      resizeGroup(
        nextWidth,
        nextHeight,
        initialHeight,
        aspectRatio,
        [x1, y1],
        property,
        latestElements,
        originalElements,
        elementsMap,
        originalElementsMap,
      );
    }

    for (let i = 0; i < editableLatestIndividualElements.length; i++) {
      const latestElement = editableLatestIndividualElements[i];
      const origElement = editableOriginalIndividualElements[i];

      let nextWidth = Math.max(0, origElement.width + changeInWidth);
      if (property === "width") {
        if (shouldChangeByStepSize) {
          nextWidth = getStepSizedValue(nextWidth, STEP_SIZE);
        } else {
          nextWidth = Math.round(nextWidth);
        }
      }

      let nextHeight = Math.max(0, origElement.height + changeInHeight);
      if (property === "height") {
        if (shouldChangeByStepSize) {
          nextHeight = getStepSizedValue(nextHeight, STEP_SIZE);
        } else {
          nextHeight = Math.round(nextHeight);
        }
      }

      resizeElement(
        nextWidth,
        nextHeight,
        false,
        latestElement,
        origElement,
        elementsMap,
        originalElementsMap,
      );
    }

    Scene.getScene(elements[0])?.triggerUpdate();
  };

  return (
    <DragInput
      label={property === "width" ? "W" : "H"}
      elements={elements}
      dragInputCallback={handleDimensionChange}
      value={value}
      editable={editable}
    />
  );
};

export default MultiDimension;
