import { pointFrom, type GlobalPoint } from "@excalidraw/math";
import { useMemo } from "react";

import { MIN_WIDTH_OR_HEIGHT } from "@excalidraw/common";
import { updateBoundElements } from "@excalidraw/element/binding";
import { mutateElement } from "@excalidraw/element/mutateElement";
import {
  rescalePointsInElement,
  resizeSingleElement,
} from "@excalidraw/element/resizeElements";
import {
  getBoundTextElement,
  handleBindTextResize,
} from "@excalidraw/element/textElement";

import { isTextElement } from "@excalidraw/element/typeChecks";

import { getCommonBounds } from "@excalidraw/utils";

import type {
  ElementsMap,
  ExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import DragInput from "./DragInput";
import { getAtomicUnits, getStepSizedValue, isPropertyEditable } from "./utils";
import { getElementsInAtomicUnit } from "./utils";

import type { DragInputCallbackType } from "./DragInput";
import type { AtomicUnit } from "./utils";
import type Scene from "../../scene/Scene";
import type { AppState } from "../../types";

interface MultiDimensionProps {
  property: "width" | "height";
  elements: readonly ExcalidrawElement[];
  elementsMap: NonDeletedSceneElementsMap;
  atomicUnits: AtomicUnit[];
  scene: Scene;
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
  elementsMap: NonDeletedSceneElementsMap,
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
  anchor: GlobalPoint,
  property: MultiDimensionProps["property"],
  latestElements: ExcalidrawElement[],
  originalElements: ExcalidrawElement[],
  elementsMap: NonDeletedSceneElementsMap,
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

const handleDimensionChange: DragInputCallbackType<
  MultiDimensionProps["property"]
> = ({
  accumulatedChange,
  originalElements,
  originalElementsMap,
  originalAppState,
  shouldChangeByStepSize,
  nextValue,
  scene,
  property,
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const atomicUnits = getAtomicUnits(originalElements, originalAppState);
  if (nextValue !== undefined) {
    for (const atomicUnit of atomicUnits) {
      const elementsInUnit = getElementsInAtomicUnit(
        atomicUnit,
        elementsMap,
        originalElementsMap,
      );

      if (elementsInUnit.length > 1) {
        const latestElements = elementsInUnit.map((el) => el.latest!);
        const originalElements = elementsInUnit.map((el) => el.original!);
        const [x1, y1, x2, y2] = getCommonBounds(originalElements);
        const initialWidth = x2 - x1;
        const initialHeight = y2 - y1;
        const aspectRatio = initialWidth / initialHeight;
        const nextWidth = Math.max(
          MIN_WIDTH_OR_HEIGHT,
          property === "width" ? Math.max(0, nextValue) : initialWidth,
        );
        const nextHeight = Math.max(
          MIN_WIDTH_OR_HEIGHT,
          property === "height" ? Math.max(0, nextValue) : initialHeight,
        );

        resizeGroup(
          nextWidth,
          nextHeight,
          initialHeight,
          aspectRatio,
          pointFrom(x1, y1),
          property,
          latestElements,
          originalElements,
          elementsMap,
          originalElementsMap,
        );
      } else {
        const [el] = elementsInUnit;
        const latestElement = el?.latest;
        const origElement = el?.original;

        if (
          latestElement &&
          origElement &&
          isPropertyEditable(latestElement, property)
        ) {
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
            property === "height"
              ? Math.max(0, nextValue)
              : latestElement.height;
          if (property === "height") {
            if (shouldChangeByStepSize) {
              nextHeight = getStepSizedValue(nextHeight, STEP_SIZE);
            } else {
              nextHeight = Math.round(nextHeight);
            }
          }

          nextWidth = Math.max(MIN_WIDTH_OR_HEIGHT, nextWidth);
          nextHeight = Math.max(MIN_WIDTH_OR_HEIGHT, nextHeight);

          resizeSingleElement(
            nextWidth,
            nextHeight,
            latestElement,
            origElement,
            elementsMap,
            originalElementsMap,
            property === "width" ? "e" : "s",
            {
              shouldInformMutation: false,
            },
          );
        }
      }
    }

    scene.triggerUpdate();

    return;
  }

  const changeInWidth = property === "width" ? accumulatedChange : 0;
  const changeInHeight = property === "height" ? accumulatedChange : 0;

  for (const atomicUnit of atomicUnits) {
    const elementsInUnit = getElementsInAtomicUnit(
      atomicUnit,
      elementsMap,
      originalElementsMap,
    );

    if (elementsInUnit.length > 1) {
      const latestElements = elementsInUnit.map((el) => el.latest!);
      const originalElements = elementsInUnit.map((el) => el.original!);

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

      nextWidth = Math.max(MIN_WIDTH_OR_HEIGHT, nextWidth);
      nextHeight = Math.max(MIN_WIDTH_OR_HEIGHT, nextHeight);

      resizeGroup(
        nextWidth,
        nextHeight,
        initialHeight,
        aspectRatio,
        pointFrom(x1, y1),
        property,
        latestElements,
        originalElements,
        elementsMap,
        originalElementsMap,
      );
    } else {
      const [el] = elementsInUnit;
      const latestElement = el?.latest;
      const origElement = el?.original;

      if (
        latestElement &&
        origElement &&
        isPropertyEditable(latestElement, property)
      ) {
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

        nextWidth = Math.max(MIN_WIDTH_OR_HEIGHT, nextWidth);
        nextHeight = Math.max(MIN_WIDTH_OR_HEIGHT, nextHeight);

        resizeSingleElement(
          nextWidth,
          nextHeight,
          latestElement,
          origElement,
          elementsMap,
          originalElementsMap,
          property === "width" ? "e" : "s",
          {
            shouldInformMutation: false,
          },
        );
      }
    }
  }

  scene.triggerUpdate();
};

const MultiDimension = ({
  property,
  elements,
  elementsMap,
  atomicUnits,
  scene,
  appState,
}: MultiDimensionProps) => {
  const sizes = useMemo(
    () =>
      atomicUnits.map((atomicUnit) => {
        const elementsInUnit = getElementsInAtomicUnit(atomicUnit, elementsMap);

        if (elementsInUnit.length > 1) {
          const [x1, y1, x2, y2] = getCommonBounds(
            elementsInUnit.map((el) => el.latest),
          );
          return (
            Math.round((property === "width" ? x2 - x1 : y2 - y1) * 100) / 100
          );
        }
        const [el] = elementsInUnit;

        return (
          Math.round(
            (property === "width" ? el.latest.width : el.latest.height) * 100,
          ) / 100
        );
      }),
    [elementsMap, atomicUnits, property],
  );

  const value =
    new Set(sizes).size === 1 ? Math.round(sizes[0] * 100) / 100 : "Mixed";

  const editable = sizes.length > 0;

  return (
    <DragInput
      label={property === "width" ? "W" : "H"}
      elements={elements}
      dragInputCallback={handleDimensionChange}
      value={value}
      editable={editable}
      appState={appState}
      property={property}
      scene={scene}
    />
  );
};

export default MultiDimension;
