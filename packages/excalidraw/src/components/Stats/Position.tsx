import { clamp, pointFrom, pointRotateRads, round } from "@excalidraw/math";

import {
  getFlipAdjustedCropPosition,
  getUncroppedWidthAndHeight,
} from "@excalidraw/element/cropElement";
import { mutateElement } from "@excalidraw/element/mutateElement";
import { isImageElement } from "@excalidraw/element/typeChecks";

import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";

import StatsDragInput from "./DragInput";
import { getStepSizedValue, moveElement } from "./utils";

import type { DragInputCallbackType } from "./DragInput";
import type Scene from "../../scene/Scene";
import type { AppState } from "../../types";

interface PositionProps {
  property: "x" | "y";
  element: ExcalidrawElement;
  elementsMap: ElementsMap;
  scene: Scene;
  appState: AppState;
}

const STEP_SIZE = 10;

const handlePositionChange: DragInputCallbackType<"x" | "y"> = ({
  accumulatedChange,
  instantChange,
  originalElements,
  originalElementsMap,
  shouldChangeByStepSize,
  nextValue,
  property,
  scene,
  originalAppState,
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const elements = scene.getNonDeletedElements();
  const origElement = originalElements[0];
  const [cx, cy] = [
    origElement.x + origElement.width / 2,
    origElement.y + origElement.height / 2,
  ];
  const [topLeftX, topLeftY] = pointRotateRads(
    pointFrom(origElement.x, origElement.y),
    pointFrom(cx, cy),
    origElement.angle,
  );

  if (originalAppState.croppingElementId === origElement.id) {
    const element = elementsMap.get(origElement.id);

    if (!element || !isImageElement(element) || !element.crop) {
      return;
    }

    const crop = element.crop;
    let nextCrop = crop;
    const isFlippedByX = element.scale[0] === -1;
    const isFlippedByY = element.scale[1] === -1;
    const { width: uncroppedWidth, height: uncroppedHeight } =
      getUncroppedWidthAndHeight(element);

    if (nextValue !== undefined) {
      if (property === "x") {
        const nextValueInNatural =
          nextValue * (crop.naturalWidth / uncroppedWidth);

        if (isFlippedByX) {
          nextCrop = {
            ...crop,
            x: clamp(
              crop.naturalWidth - nextValueInNatural - crop.width,
              0,
              crop.naturalWidth - crop.width,
            ),
          };
        } else {
          nextCrop = {
            ...crop,
            x: clamp(
              nextValue * (crop.naturalWidth / uncroppedWidth),
              0,
              crop.naturalWidth - crop.width,
            ),
          };
        }
      }

      if (property === "y") {
        nextCrop = {
          ...crop,
          y: clamp(
            nextValue * (crop.naturalHeight / uncroppedHeight),
            0,
            crop.naturalHeight - crop.height,
          ),
        };
      }

      mutateElement(element, {
        crop: nextCrop,
      });

      return;
    }

    const changeInX =
      (property === "x" ? instantChange : 0) * (isFlippedByX ? -1 : 1);
    const changeInY =
      (property === "y" ? instantChange : 0) * (isFlippedByY ? -1 : 1);

    nextCrop = {
      ...crop,
      x: clamp(crop.x + changeInX, 0, crop.naturalWidth - crop.width),
      y: clamp(crop.y + changeInY, 0, crop.naturalHeight - crop.height),
    };

    mutateElement(element, {
      crop: nextCrop,
    });

    return;
  }

  if (nextValue !== undefined) {
    const newTopLeftX = property === "x" ? nextValue : topLeftX;
    const newTopLeftY = property === "y" ? nextValue : topLeftY;
    moveElement(
      newTopLeftX,
      newTopLeftY,
      origElement,
      elementsMap,
      elements,
      scene,
      originalElementsMap,
    );
    return;
  }

  const changeInTopX = property === "x" ? accumulatedChange : 0;
  const changeInTopY = property === "y" ? accumulatedChange : 0;

  const newTopLeftX =
    property === "x"
      ? Math.round(
          shouldChangeByStepSize
            ? getStepSizedValue(origElement.x + changeInTopX, STEP_SIZE)
            : topLeftX + changeInTopX,
        )
      : topLeftX;

  const newTopLeftY =
    property === "y"
      ? Math.round(
          shouldChangeByStepSize
            ? getStepSizedValue(origElement.y + changeInTopY, STEP_SIZE)
            : topLeftY + changeInTopY,
        )
      : topLeftY;

  moveElement(
    newTopLeftX,
    newTopLeftY,
    origElement,
    elementsMap,
    elements,
    scene,
    originalElementsMap,
  );
};

const Position = ({
  property,
  element,
  elementsMap,
  scene,
  appState,
}: PositionProps) => {
  const [topLeftX, topLeftY] = pointRotateRads(
    pointFrom(element.x, element.y),
    pointFrom(element.x + element.width / 2, element.y + element.height / 2),
    element.angle,
  );
  let value = round(property === "x" ? topLeftX : topLeftY, 2);

  if (
    appState.croppingElementId === element.id &&
    isImageElement(element) &&
    element.crop
  ) {
    const flipAdjustedPosition = getFlipAdjustedCropPosition(element);

    if (flipAdjustedPosition) {
      value = round(
        property === "x" ? flipAdjustedPosition.x : flipAdjustedPosition.y,
        2,
      );
    }
  }

  return (
    <StatsDragInput
      label={property === "x" ? "X" : "Y"}
      elements={[element]}
      dragInputCallback={handlePositionChange}
      scene={scene}
      value={value}
      property={property}
      appState={appState}
    />
  );
};

export default Position;
