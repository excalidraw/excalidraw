import { pointFrom, pointRotateRads } from "@excalidraw/math";

import {
  bindOrUnbindLinearElements,
  updateBoundElements,
} from "@excalidraw/element/binding";
import { getBoundTextElement } from "@excalidraw/element/textElement";
import { getCommonBounds } from "@excalidraw/element/bounds";
import {
  isFrameLikeElement,
  isLinearElement,
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

import type { AppState } from "../../types";

export type StatsInputProperty =
  | "x"
  | "y"
  | "width"
  | "height"
  | "angle"
  | "fontSize"
  | "gridStep";

export type DragInputCallbackType<
  P extends StatsInputProperty,
  E = ExcalidrawElement,
> = (props: {
  accumulatedChange: number;
  instantChange: number;
  originalElements: readonly E[];
  originalElementsMap: ElementsMap;
  shouldKeepAspectRatio: boolean;
  shouldChangeByStepSize: boolean;
  scene: Scene;
  nextValue?: number;
  property: P;
  originalAppState: AppState;
  setInputValue: (value: number) => void;
}) => void;

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
    getFrameChildren(originalElementsMap, originalElement.id).forEach(
      (child) => {
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
        updateBindings(latestChildElement, scene);

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
      },
    );
  }
};

export const moveElements = (
  property: "x" | "y",
  changeInTopX: number,
  changeInTopY: number,
  originalElements: readonly ExcalidrawElement[],
  originalElementsMap: ElementsMap,
  scene: Scene,
) => {
  for (let i = 0; i < originalElements.length; i++) {
    const origElement = originalElements[i];

    const [cx, cy] = [
      origElement.x + origElement.width / 2,
      origElement.y + origElement.height / 2,
    ];
    const [topLeftX, topLeftY] = pointRotateRads(
      pointFrom(origElement.x, origElement.y),
      pointFrom(cx, cy),
      origElement.angle,
    );

    const newTopLeftX =
      property === "x" ? Math.round(topLeftX + changeInTopX) : topLeftX;

    const newTopLeftY =
      property === "y" ? Math.round(topLeftY + changeInTopY) : topLeftY;

    moveElement(
      newTopLeftX,
      newTopLeftY,
      origElement,
      scene,
      originalElementsMap,
      false,
    );
  }
};

export const moveGroup = (
  nextX: number,
  nextY: number,
  originalElements: ExcalidrawElement[],
  originalElementsMap: ElementsMap,
  scene: Scene,
) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const [x1, y1, ,] = getCommonBounds(originalElements);
  const offsetX = nextX - x1;
  const offsetY = nextY - y1;

  for (let i = 0; i < originalElements.length; i++) {
    const origElement = originalElements[i];

    const latestElement = elementsMap.get(origElement.id);
    if (!latestElement) {
      continue;
    }

    // bound texts are moved with their containers
    if (!isTextElement(latestElement) || !latestElement.containerId) {
      const [cx, cy] = [
        latestElement.x + latestElement.width / 2,
        latestElement.y + latestElement.height / 2,
      ];

      const [topLeftX, topLeftY] = pointRotateRads(
        pointFrom(latestElement.x, latestElement.y),
        pointFrom(cx, cy),
        latestElement.angle,
      );

      moveElement(
        topLeftX + offsetX,
        topLeftY + offsetY,
        origElement,
        scene,
        originalElementsMap,
        false,
      );
    }
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
  scene: Scene,
  options?: {
    simultaneouslyUpdated?: readonly ExcalidrawElement[];
    newSize?: { width: number; height: number };
    zoom?: AppState["zoom"];
  },
) => {
  if (isLinearElement(latestElement)) {
    bindOrUnbindLinearElements([latestElement], true, [], scene, options?.zoom);
  } else {
    updateBoundElements(latestElement, scene, options);
  }
};

export const handlePositionChange: DragInputCallbackType<"x" | "y"> = ({
  accumulatedChange,
  originalElements,
  originalElementsMap,
  shouldChangeByStepSize,
  nextValue,
  property,
  scene,
  originalAppState,
}) => {
  const STEP_SIZE = 10;
  const elementsMap = scene.getNonDeletedElementsMap();

  if (nextValue !== undefined) {
    for (const atomicUnit of getAtomicUnits(
      originalElements,
      originalAppState,
    )) {
      const elementsInUnit = getElementsInAtomicUnit(
        atomicUnit,
        elementsMap,
        originalElementsMap,
      );

      if (elementsInUnit.length > 1) {
        const [x1, y1, ,] = getCommonBounds(
          elementsInUnit.map((el) => el.latest!),
        );
        const newTopLeftX = property === "x" ? nextValue : x1;
        const newTopLeftY = property === "y" ? nextValue : y1;

        moveGroup(
          newTopLeftX,
          newTopLeftY,
          elementsInUnit.map((el) => el.original),
          originalElementsMap,
          scene,
        );
      } else {
        const origElement = elementsInUnit[0]?.original;
        const latestElement = elementsInUnit[0]?.latest;
        if (
          origElement &&
          latestElement &&
          isPropertyEditable(latestElement, property)
        ) {
          const [cx, cy] = [
            origElement.x + origElement.width / 2,
            origElement.y + origElement.height / 2,
          ];
          const [topLeftX, topLeftY] = pointRotateRads(
            pointFrom(origElement.x, origElement.y),
            pointFrom(cx, cy),
            origElement.angle,
          );

          const newTopLeftX = property === "x" ? nextValue : topLeftX;
          const newTopLeftY = property === "y" ? nextValue : topLeftY;

          moveElement(
            newTopLeftX,
            newTopLeftY,
            origElement,
            scene,
            originalElementsMap,
            false,
          );
        }
      }
    }

    scene.triggerUpdate();
    return;
  }

  const change = shouldChangeByStepSize
    ? getStepSizedValue(accumulatedChange, STEP_SIZE)
    : accumulatedChange;

  const changeInTopX = property === "x" ? change : 0;
  const changeInTopY = property === "y" ? change : 0;

  moveElements(
    property,
    changeInTopX,
    changeInTopY,
    originalElements,
    originalElementsMap,
    scene,
  );

  scene.triggerUpdate();
};
