import { pointFrom, pointRotateRads } from "@excalidraw/math";

import { mutateElement } from "@excalidraw/element/mutateElement";
import { getBoundTextElement } from "@excalidraw/element/textElement";
import {
  isBindableElement,
  isBindingElement,
  isFrameLikeElement,
  isTextElement,
} from "@excalidraw/element/typeChecks";

import {
  getSelectedGroupIds,
  getElementsInGroup,
  isInGroup,
} from "@excalidraw/element/groups";

import {
  bindOrUnbindLinearElement,
  updateBoundElements,
} from "@excalidraw/element/binding";

import type { Radians } from "@excalidraw/math";

import type {
  ElementsMap,
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import type Scene from "@excalidraw/excalidraw/scene/Scene";

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
  elementsMap: NonDeletedSceneElementsMap,
  originalElementsMap: ElementsMap,
  shouldInformMutation = true,
) => {
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

  mutateElement(
    latestElement,
    {
      x,
      y,
    },
    shouldInformMutation,
  );

  if (isBindableElement(latestElement)) {
    updateBoundElements(latestElement, elementsMap);
  }

  const boundTextElement = getBoundTextElement(
    originalElement,
    originalElementsMap,
  );
  if (boundTextElement) {
    const latestBoundTextElement = elementsMap.get(boundTextElement.id);
    latestBoundTextElement &&
      mutateElement(
        latestBoundTextElement,
        {
          x: boundTextElement.x + changeInX,
          y: boundTextElement.y + changeInY,
        },
        shouldInformMutation,
      );
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

export const updateBindings = (
  latestElement: ExcalidrawElement,
  elementsMap: NonDeletedSceneElementsMap,
  scene: Scene,
) => {
  if (isBindingElement(latestElement)) {
    if (latestElement.startBinding || latestElement.endBinding) {
      bindOrUnbindLinearElement(latestElement, null, null, elementsMap, scene);
    }
  } else if (isBindableElement(latestElement)) {
    updateBoundElements(latestElement, elementsMap);
  }
};

export const updateSelectionBindings = (
  elements: readonly ExcalidrawElement[],
  elementsMap: NonDeletedSceneElementsMap,
  scene: Scene,
) => {
  for (const element of elements) {
    // Only preserve bindings if the bound element is in the selection
    if (isBindingElement(element)) {
      if (elements.find((el) => el.id !== element.startBinding?.elementId)) {
        bindOrUnbindLinearElement(element, null, "keep", elementsMap, scene);
      }

      if (elements.find((el) => el.id !== element.endBinding?.elementId)) {
        bindOrUnbindLinearElement(element, "keep", null, elementsMap, scene);
      }
    } else if (isBindableElement(element)) {
      updateBoundElements(element, elementsMap);
    }
  }
};
