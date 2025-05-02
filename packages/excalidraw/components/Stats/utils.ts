import { pointFrom, pointRotateRads } from "@excalidraw/math";

import { getBoundTextElement } from "@excalidraw/element/textElement";
import {
  isFrameLikeElement,
  isTextElement,
} from "@excalidraw/element/typeChecks";

import {
  getSelectedGroupIds,
  getElementsInGroup,
  isInGroup,
} from "@excalidraw/element/groups";

import { getFrameChildren } from "@excalidraw/element/frame";

import type { Radians } from "@excalidraw/math";

import type {
  ElementsMap,
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type Scene from "@excalidraw/element/Scene";

import { updateBindings } from "../../../element/src/binding";

import type { AppState } from "../../types";

export type StatsInputProperty =
  | "x"
  | "y"
  | "width"
  | "height"
  | "angle"
  | "fontSize"
  | "gridStep";

export const SMALLEST_DELTA = 0.01;
export const STEP_SIZE = 10;

export const isPropertyEditable = (
  element: ExcalidrawElement,
  property: keyof ExcalidrawElement,
) => {
  if (property === "height" && isTextElement(element)) {
    return false;
  }
  if (property === "width" && isTextElement(element)) {
    return false;
  }
  if (property === "angle" && isFrameLikeElement(element)) {
    return false;
  }
  return true;
};

export const getStepSizedValue = (value: number, stepSize: number) => {
  const v = value + stepSize / 2;
  return v - (v % stepSize);
};

export type AtomicUnit = Record<string, true>;
export const getElementsInAtomicUnit = (
  atomicUnit: AtomicUnit,
  elementsMap: ElementsMap,
  originalElementsMap?: ElementsMap,
) => {
  return Object.keys(atomicUnit)
    .map((id) => ({
      original: (originalElementsMap ?? elementsMap).get(id),
      latest: elementsMap.get(id),
    }))
    .filter((el) => el.original !== undefined && el.latest !== undefined) as {
    original: NonDeletedExcalidrawElement;
    latest: NonDeletedExcalidrawElement;
  }[];
};

export const newOrigin = (
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  w2: number,
  h2: number,
  angle: number,
) => {
  /**
   * The formula below is the result of solving
   *   rotate(x1, y1, cx1, cy1, angle) = rotate(x2, y2, cx2, cy2, angle)
   * where rotate is the function defined in math.ts
   *
   * This is so that the new origin (x2, y2),
   * when rotated against the new center (cx2, cy2),
   * coincides with (x1, y1) rotated against (cx1, cy1)
   *
   * The reason for doing this computation is so the element's top left corner
   * on the canvas remains fixed after any changes in its dimension.
   */

  return {
    x:
      x1 +
      (w1 - w2) / 2 +
      ((w2 - w1) / 2) * Math.cos(angle) +
      ((h1 - h2) / 2) * Math.sin(angle),
    y:
      y1 +
      (h1 - h2) / 2 +
      ((w2 - w1) / 2) * Math.sin(angle) +
      ((h2 - h1) / 2) * Math.cos(angle),
  };
};

export const moveElement = (
  newTopLeftX: number,
  newTopLeftY: number,
  originalElement: ExcalidrawElement,
  scene: Scene,
  originalElementsMap: ElementsMap,
  shouldInformMutation = true,
) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const latestElement = elementsMap.get(originalElement.id);
  if (!latestElement) {
    return;
  }
  const [cx, cy] = [
    originalElement.x + originalElement.width / 2,
    originalElement.y + originalElement.height / 2,
  ];
  const [topLeftX, topLeftY] = pointRotateRads(
    pointFrom(originalElement.x, originalElement.y),
    pointFrom(cx, cy),
    originalElement.angle,
  );

  const changeInX = newTopLeftX - topLeftX;
  const changeInY = newTopLeftY - topLeftY;

  const [x, y] = pointRotateRads(
    pointFrom(newTopLeftX, newTopLeftY),
    pointFrom(cx + changeInX, cy + changeInY),
    -originalElement.angle as Radians,
  );

  scene.mutateElement(
    latestElement,
    {
      x,
      y,
    },
    { informMutation: shouldInformMutation, isDragging: false },
  );
  updateBindings(latestElement, scene);

  const boundTextElement = getBoundTextElement(
    originalElement,
    originalElementsMap,
  );
  if (boundTextElement) {
    const latestBoundTextElement = elementsMap.get(boundTextElement.id);
    latestBoundTextElement &&
      scene.mutateElement(
        latestBoundTextElement,
        {
          x: boundTextElement.x + changeInX,
          y: boundTextElement.y + changeInY,
        },
        { informMutation: shouldInformMutation, isDragging: false },
      );
  }

  if (isFrameLikeElement(originalElement)) {
    const originalChildren = getFrameChildren(
      originalElementsMap,
      originalElement.id,
    );
    originalChildren.forEach((child) => {
      const latestChildElement = elementsMap.get(child.id);

      if (!latestChildElement) {
        return;
      }

      const [childCX, childCY] = [
        child.x + child.width / 2,
        child.y + child.height / 2,
      ];
      const [childTopLeftX, childTopLeftY] = pointRotateRads(
        pointFrom(child.x, child.y),
        pointFrom(childCX, childCY),
        child.angle,
      );

      const childNewTopLeftX = Math.round(childTopLeftX + changeInX);
      const childNewTopLeftY = Math.round(childTopLeftY + changeInY);

      const [childX, childY] = pointRotateRads(
        pointFrom(childNewTopLeftX, childNewTopLeftY),
        pointFrom(childCX + changeInX, childCY + changeInY),
        -child.angle as Radians,
      );

      scene.mutateElement(
        latestChildElement,
        {
          x: childX,
          y: childY,
        },
        { informMutation: shouldInformMutation, isDragging: false },
      );
      updateBindings(latestChildElement, scene, {
        simultaneouslyUpdated: originalChildren,
      });

      const boundTextElement = getBoundTextElement(
        latestChildElement,
        originalElementsMap,
      );
      if (boundTextElement) {
        const latestBoundTextElement = elementsMap.get(boundTextElement.id);
        latestBoundTextElement &&
          scene.mutateElement(
            latestBoundTextElement,
            {
              x: boundTextElement.x + changeInX,
              y: boundTextElement.y + changeInY,
            },
            { informMutation: shouldInformMutation, isDragging: false },
          );
      }
    });
  }
};

export const getAtomicUnits = (
  targetElements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const selectedGroupIds = getSelectedGroupIds(appState);
  const _atomicUnits = selectedGroupIds.map((gid) => {
    return getElementsInGroup(targetElements, gid).reduce((acc, el) => {
      acc[el.id] = true;
      return acc;
    }, {} as AtomicUnit);
  });
  targetElements
    .filter((el) => !isInGroup(el))
    .forEach((el) => {
      _atomicUnits.push({
        [el.id]: true,
      });
    });
  return _atomicUnits;
};
