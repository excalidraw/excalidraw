import { clamp, round } from "@excalidraw/math";

import { MIN_WIDTH_OR_HEIGHT } from "@excalidraw/common";
import {
  MINIMAL_CROP_SIZE,
  getUncroppedWidthAndHeight,
} from "@excalidraw/element";
import { resizeSingleElement } from "@excalidraw/element";
import { isImageElement } from "@excalidraw/element";
import { isFrameLikeElement } from "@excalidraw/element";
import { getElementsInResizingFrame } from "@excalidraw/element";
import { replaceAllElementsInFrame } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { Scene } from "@excalidraw/element";

import DragInput from "./DragInput";
import { getStepSizedValue, isPropertyEditable } from "./utils";

import type {
  DragFinishedCallbackType,
  DragInputCallbackType,
} from "./DragInput";
import type { AppState } from "../../types";

interface DimensionDragInputProps {
  property: "width" | "height";
  element: ExcalidrawElement;
  scene: Scene;
  appState: AppState;
}

const STEP_SIZE = 10;
const _shouldKeepAspectRatio = (element: ExcalidrawElement) => {
  return element.type === "image";
};

const handleDimensionChange: DragInputCallbackType<
  DimensionDragInputProps["property"]
> = ({
  accumulatedChange,
  originalElements,
  originalElementsMap,
  shouldKeepAspectRatio,
  shouldChangeByStepSize,
  nextValue,
  property,
  originalAppState,
  instantChange,
  scene,
  app,
  setAppState,
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const origElement = originalElements[0];
  const latestElement = elementsMap.get(origElement.id);
  if (origElement && latestElement) {
    const keepAspectRatio =
      shouldKeepAspectRatio || _shouldKeepAspectRatio(origElement);
    const aspectRatio = origElement.width / origElement.height;

    if (originalAppState.croppingElementId === origElement.id) {
      const element = elementsMap.get(origElement.id);

      if (!element || !isImageElement(element) || !element.crop) {
        return;
      }

      const crop = element.crop;
      let nextCrop = { ...crop };

      const isFlippedByX = element.scale[0] === -1;
      const isFlippedByY = element.scale[1] === -1;

      const { width: uncroppedWidth, height: uncroppedHeight } =
        getUncroppedWidthAndHeight(element);

      const naturalToUncroppedWidthRatio = crop.naturalWidth / uncroppedWidth;
      const naturalToUncroppedHeightRatio =
        crop.naturalHeight / uncroppedHeight;

      const MAX_POSSIBLE_WIDTH = isFlippedByX
        ? crop.width + crop.x
        : crop.naturalWidth - crop.x;

      const MAX_POSSIBLE_HEIGHT = isFlippedByY
        ? crop.height + crop.y
        : crop.naturalHeight - crop.y;

      const MIN_WIDTH = MINIMAL_CROP_SIZE * naturalToUncroppedWidthRatio;
      const MIN_HEIGHT = MINIMAL_CROP_SIZE * naturalToUncroppedHeightRatio;

      if (nextValue !== undefined) {
        if (property === "width") {
          const nextValueInNatural = nextValue * naturalToUncroppedWidthRatio;

          const nextCropWidth = clamp(
            nextValueInNatural,
            MIN_WIDTH,
            MAX_POSSIBLE_WIDTH,
          );

          nextCrop = {
            ...nextCrop,
            width: nextCropWidth,
            x: isFlippedByX ? crop.x + crop.width - nextCropWidth : crop.x,
          };
        } else if (property === "height") {
          const nextValueInNatural = nextValue * naturalToUncroppedHeightRatio;
          const nextCropHeight = clamp(
            nextValueInNatural,
            MIN_HEIGHT,
            MAX_POSSIBLE_HEIGHT,
          );

          nextCrop = {
            ...nextCrop,
            height: nextCropHeight,
            y: isFlippedByY ? crop.y + crop.height - nextCropHeight : crop.y,
          };
        }

        scene.mutateElement(element, {
          crop: nextCrop,
          width: nextCrop.width / (crop.naturalWidth / uncroppedWidth),
          height: nextCrop.height / (crop.naturalHeight / uncroppedHeight),
        });
        return;
      }

      const changeInWidth = property === "width" ? instantChange : 0;
      const changeInHeight = property === "height" ? instantChange : 0;

      const nextCropWidth = clamp(
        crop.width + changeInWidth,
        MIN_WIDTH,
        MAX_POSSIBLE_WIDTH,
      );

      const nextCropHeight = clamp(
        crop.height + changeInHeight,
        MIN_WIDTH,
        MAX_POSSIBLE_HEIGHT,
      );

      nextCrop = {
        ...crop,
        x: isFlippedByX ? crop.x + crop.width - nextCropWidth : crop.x,
        y: isFlippedByY ? crop.y + crop.height - nextCropHeight : crop.y,
        width: nextCropWidth,
        height: nextCropHeight,
      };

      scene.mutateElement(element, {
        crop: nextCrop,
        width: nextCrop.width / (crop.naturalWidth / uncroppedWidth),
        height: nextCrop.height / (crop.naturalHeight / uncroppedHeight),
      });

      return;
    }

    // User types in a value to stats then presses Enter
    if (nextValue !== undefined) {
      const nextWidth = Math.max(
        property === "width"
          ? nextValue
          : keepAspectRatio
          ? nextValue * aspectRatio
          : origElement.width,
        MIN_WIDTH_OR_HEIGHT,
      );
      const nextHeight = Math.max(
        property === "height"
          ? nextValue
          : keepAspectRatio
          ? nextValue / aspectRatio
          : origElement.height,
        MIN_WIDTH_OR_HEIGHT,
      );

      resizeSingleElement(
        nextWidth,
        nextHeight,
        latestElement,
        origElement,
        originalElementsMap,
        scene,
        property === "width" ? "e" : "s",
        {
          shouldMaintainAspectRatio: keepAspectRatio,
        },
      );

      // Handle frame membership update for resized frames
      if (isFrameLikeElement(latestElement)) {
        const nextElementsInFrame = getElementsInResizingFrame(
          scene.getElementsIncludingDeleted(),
          latestElement,
          originalAppState,
          scene.getNonDeletedElementsMap(),
        );

        const updatedElements = replaceAllElementsInFrame(
          scene.getElementsIncludingDeleted(),
          nextElementsInFrame,
          latestElement,
          app,
        );

        scene.replaceAllElements(updatedElements);
      }

      return;
    }

    // Stats slider is dragged
    {
      const changeInWidth = property === "width" ? accumulatedChange : 0;
      const changeInHeight = property === "height" ? accumulatedChange : 0;

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

      if (keepAspectRatio) {
        if (property === "width") {
          nextHeight = Math.round((nextWidth / aspectRatio) * 100) / 100;
        } else {
          nextWidth = Math.round(nextHeight * aspectRatio * 100) / 100;
        }
      }

      nextHeight = Math.max(MIN_WIDTH_OR_HEIGHT, nextHeight);
      nextWidth = Math.max(MIN_WIDTH_OR_HEIGHT, nextWidth);

      resizeSingleElement(
        nextWidth,
        nextHeight,
        latestElement,
        origElement,
        originalElementsMap,
        scene,
        property === "width" ? "e" : "s",
        {
          shouldMaintainAspectRatio: keepAspectRatio,
        },
      );

      // Handle highlighting frame element candidates
      if (isFrameLikeElement(latestElement)) {
        const nextElementsInFrame = getElementsInResizingFrame(
          scene.getElementsIncludingDeleted(),
          latestElement,
          originalAppState,
          scene.getNonDeletedElementsMap(),
        );

        setAppState({
          elementsToHighlight: nextElementsInFrame,
        });
      }
    }
  }
};

const handleDragFinished: DragFinishedCallbackType = ({
  setAppState,
  app,
  originalElements,
  originalAppState,
}) => {
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const origElement = originalElements?.[0];
  const latestElement = origElement && elementsMap.get(origElement.id);

  // Handle frame membership update for resized frames
  if (latestElement && isFrameLikeElement(latestElement)) {
    const nextElementsInFrame = getElementsInResizingFrame(
      app.scene.getElementsIncludingDeleted(),
      latestElement,
      originalAppState,
      app.scene.getNonDeletedElementsMap(),
    );

    const updatedElements = replaceAllElementsInFrame(
      app.scene.getElementsIncludingDeleted(),
      nextElementsInFrame,
      latestElement,
      app,
    );

    app.scene.replaceAllElements(updatedElements);

    setAppState({
      elementsToHighlight: null,
    });
  }
};

const DimensionDragInput = ({
  property,
  element,
  scene,
  appState,
}: DimensionDragInputProps) => {
  let value = round(property === "width" ? element.width : element.height, 2);

  if (
    appState.croppingElementId &&
    appState.croppingElementId === element.id &&
    isImageElement(element) &&
    element.crop
  ) {
    const { width: uncroppedWidth, height: uncroppedHeight } =
      getUncroppedWidthAndHeight(element);
    if (property === "width") {
      const ratio = uncroppedWidth / element.crop.naturalWidth;
      value = round(element.crop.width * ratio, 2);
    }
    if (property === "height") {
      const ratio = uncroppedHeight / element.crop.naturalHeight;
      value = round(element.crop.height * ratio, 2);
    }
  }

  return (
    <DragInput
      label={property === "width" ? "W" : "H"}
      elements={[element]}
      dragInputCallback={handleDimensionChange}
      value={value}
      editable={isPropertyEditable(element, property)}
      scene={scene}
      appState={appState}
      property={property}
      dragFinishedCallback={handleDragFinished}
    />
  );
};

export default DimensionDragInput;
