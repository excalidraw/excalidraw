import type { Radians } from "../../../math";
import { pointFrom, pointRotateRads } from "../../../math";
import {
  bindOrUnbindLinearElements,
  updateBoundElements,
} from "../../element/binding";
import { mutateElement } from "../../element/mutateElement";
import {
  measureFontSizeFromWidth,
  rescalePointsInElement,
} from "../../element/resizeElements";
import {
  getApproxMinLineHeight,
  getApproxMinLineWidth,
  getBoundTextElement,
  getBoundTextMaxWidth,
  handleBindTextResize,
} from "../../element/textElement";
import {
  isFrameLikeElement,
  isLinearElement,
  isTextElement,
} from "../../element/typeChecks";
import type {
  ElementsMap,
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "../../element/types";
import {
  getSelectedGroupIds,
  getElementsInGroup,
  isInGroup,
} from "../../groups";
import type Scene from "../../scene/Scene";
import type { AppState } from "../../types";
import { getFontString } from "../../utils";

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

export const resizeElement = (
  nextWidth: number,
  nextHeight: number,
  keepAspectRatio: boolean,
  origElement: ExcalidrawElement,
  elementsMap: NonDeletedSceneElementsMap,
  elements: readonly NonDeletedExcalidrawElement[],
  scene: Scene,
  shouldInformMutation = true,
) => {
  const latestElement = elementsMap.get(origElement.id);
  if (!latestElement) {
    return;
  }
  let boundTextFont: { fontSize?: number } = {};
  const boundTextElement = getBoundTextElement(latestElement, elementsMap);

  if (boundTextElement) {
    const minWidth = getApproxMinLineWidth(
      getFontString(boundTextElement),
      boundTextElement.lineHeight,
    );
    const minHeight = getApproxMinLineHeight(
      boundTextElement.fontSize,
      boundTextElement.lineHeight,
    );
    nextWidth = Math.max(nextWidth, minWidth);
    nextHeight = Math.max(nextHeight, minHeight);
  }

  const { width: oldWidth, height: oldHeight } = latestElement;

  mutateElement(
    latestElement,
    {
      ...newOrigin(
        latestElement.x,
        latestElement.y,
        latestElement.width,
        latestElement.height,
        nextWidth,
        nextHeight,
        latestElement.angle,
      ),
      width: nextWidth,
      height: nextHeight,
      ...rescalePointsInElement(origElement, nextWidth, nextHeight, true),
    },
    shouldInformMutation,
  );
  updateBindings(latestElement, elementsMap, elements, scene, {
    newSize: {
      width: nextWidth,
      height: nextHeight,
    },
  });

  if (boundTextElement) {
    boundTextFont = {
      fontSize: boundTextElement.fontSize,
    };
    if (keepAspectRatio) {
      const updatedElement = {
        ...latestElement,
        width: nextWidth,
        height: nextHeight,
      };

      const nextFont = measureFontSizeFromWidth(
        boundTextElement,
        elementsMap,
        getBoundTextMaxWidth(updatedElement, boundTextElement),
      );
      boundTextFont = {
        fontSize: nextFont?.size ?? boundTextElement.fontSize,
      };
    }
  }

  updateBoundElements(latestElement, elementsMap, {
    oldSize: { width: oldWidth, height: oldHeight },
  });

  if (boundTextElement && boundTextFont) {
    mutateElement(boundTextElement, {
      fontSize: boundTextFont.fontSize,
    });
  }
  handleBindTextResize(latestElement, elementsMap, "e", keepAspectRatio);
};

export const moveElement = (
  newTopLeftX: number,
  newTopLeftY: number,
  originalElement: ExcalidrawElement,
  elementsMap: NonDeletedSceneElementsMap,
  elements: readonly NonDeletedExcalidrawElement[],
  scene: Scene,
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
  updateBindings(latestElement, elementsMap, elements, scene);

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
  elements: readonly NonDeletedExcalidrawElement[],
  scene: Scene,
  options?: {
    simultaneouslyUpdated?: readonly ExcalidrawElement[];
    newSize?: { width: number; height: number };
  },
) => {
  if (isLinearElement(latestElement)) {
    bindOrUnbindLinearElements(
      [latestElement],
      elementsMap,
      elements,
      scene,
      true,
      [],
    );
  } else {
    updateBoundElements(latestElement, elementsMap, options);
  }
};
