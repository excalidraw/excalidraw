import { DEFAULT_TRANSFORM_HANDLE_SPACING } from "@excalidraw/common";
import {
  pointFrom,
  pointRotateRads,
  type GlobalPoint,
  type Radians,
} from "@excalidraw/math";

import type { EditorInterface } from "@excalidraw/common";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

const TEXT_AUTO_RESIZE_HANDLE_GAP = 12;
const TEXT_AUTO_RESIZE_HANDLE_LENGTH = 16;
const TEXT_AUTO_RESIZE_HANDLE_HITBOX_WIDTH = 10;
const TEXT_AUTO_RESIZE_HANDLE_HITBOX_HEIGHT =
  TEXT_AUTO_RESIZE_HANDLE_LENGTH + 2;
const MAX_HANDLE_HEIGHT_RATIO = 0.8;

export const getTextBoxPadding = (zoomValue: number) =>
  (DEFAULT_TRANSFORM_HANDLE_SPACING * 2) / zoomValue;

export const getTextAutoResizeHandle = (
  textElement: ExcalidrawTextElement,
  zoomValue: number,
  formFactor: EditorInterface["formFactor"],
) => {
  if (
    formFactor !== "desktop" ||
    TEXT_AUTO_RESIZE_HANDLE_LENGTH >
      textElement.height * zoomValue * MAX_HANDLE_HEIGHT_RATIO
  ) {
    return null;
  }

  const padding = getTextBoxPadding(zoomValue);
  const gap = TEXT_AUTO_RESIZE_HANDLE_GAP / zoomValue;
  const length = TEXT_AUTO_RESIZE_HANDLE_LENGTH / zoomValue;
  const center = pointFrom(
    textElement.x + textElement.width / 2,
    textElement.y + textElement.height / 2,
  );
  const handleCenter = pointRotateRads(
    pointFrom(center[0] + textElement.width / 2 + padding + gap, center[1]),
    center,
    textElement.angle,
  );

  return {
    center: handleCenter,
    start: pointRotateRads(
      pointFrom(handleCenter[0], handleCenter[1] - length / 2),
      handleCenter,
      textElement.angle,
    ) as GlobalPoint,
    end: pointRotateRads(
      pointFrom(handleCenter[0], handleCenter[1] + length / 2),
      handleCenter,
      textElement.angle,
    ) as GlobalPoint,
    hitboxWidth: TEXT_AUTO_RESIZE_HANDLE_HITBOX_WIDTH / zoomValue,
    hitboxHeight: TEXT_AUTO_RESIZE_HANDLE_HITBOX_HEIGHT / zoomValue,
  };
};

export const isPointHittingTextAutoResizeHandle = (
  point: Readonly<{ x: number; y: number }>,
  textElement: ExcalidrawTextElement,
  zoomValue: number,
  formFactor: EditorInterface["formFactor"],
) => {
  const handle = getTextAutoResizeHandle(textElement, zoomValue, formFactor);

  if (!handle) {
    return false;
  }

  const unrotatedPoint = pointRotateRads(
    pointFrom(point.x, point.y),
    handle.center,
    -textElement.angle as Radians,
  );

  return (
    Math.abs(unrotatedPoint[0] - handle.center[0]) <= handle.hitboxWidth / 2 &&
    Math.abs(unrotatedPoint[1] - handle.center[1]) <= handle.hitboxHeight / 2
  );
};
