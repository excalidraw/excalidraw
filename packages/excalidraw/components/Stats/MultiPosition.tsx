import { pointFrom, pointRotateRads } from "@excalidraw/math";
import { useMemo } from "react";

import { dragSelectedElements } from "@excalidraw/element";

import { getCommonBounds } from "@excalidraw/element";

import type {
  ElementsMap,
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { RenderEnvironment, Scene } from "@excalidraw/element";

import StatsDragInput from "./DragInput";
import {
  getAtomicUnits,
  getStepSizedValue,
  isPropertyEditable,
  STEP_SIZE,
} from "./utils";
import { getElementsInAtomicUnit, moveElement } from "./utils";

import type { DragInputCallbackType } from "./DragInput";
import type { AtomicUnit } from "./utils";
import type { AppState } from "../../types";

interface MultiPositionProps {
  property: "x" | "y";
  elements: readonly NonDeletedExcalidrawElement[];
  elementsMap: ElementsMap;
  atomicUnits: AtomicUnit[];
  scene: Scene;
  appState: AppState;
}

const moveElements = (
  offsetX: number,
  offsetY: number,
  originalElements: readonly NonDeletedExcalidrawElement[],
  originalElementsMap: ElementsMap,
  scene: Scene,
  renderEnvironment: RenderEnvironment,
) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const latestElements = originalElements
    .map((element) => elementsMap.get(element.id))
    .filter((element) => element !== undefined);

  dragSelectedElements(
    { originalElements: originalElementsMap },
    latestElements,
    { x: offsetX, y: offsetY },
    scene,
    { x: 0, y: 0 },
    null,
    renderEnvironment,
  );
};

const moveGroupTo = (
  nextX: number,
  nextY: number,
  originalElements: readonly NonDeletedExcalidrawElement[],
  originalElementsMap: ElementsMap,
  scene: Scene,
  renderEnvironment: RenderEnvironment,
) => {
  const [x1, y1] = getCommonBounds(originalElements);
  moveElements(
    nextX - x1,
    nextY - y1,
    originalElements,
    originalElementsMap,
    scene,
    renderEnvironment,
  );
};

const handlePositionChange: DragInputCallbackType<
  MultiPositionProps["property"]
> = ({
  accumulatedChange,
  originalElements,
  originalElementsMap,
  shouldChangeByStepSize,
  nextValue,
  property,
  scene,
  originalAppState,
  app,
}) => {
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

        moveGroupTo(
          newTopLeftX,
          newTopLeftY,
          elementsInUnit.map((el) => el.original),
          originalElementsMap,
          scene,
          app.renderEnvironment,
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
            app.state,
            originalElementsMap,
            false,
            app.renderEnvironment,
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
    changeInTopX,
    changeInTopY,
    originalElements,
    originalElementsMap,
    scene,
    app.renderEnvironment,
  );

  scene.triggerUpdate();
};

const MultiPosition = ({
  property,
  elements,
  elementsMap,
  atomicUnits,
  scene,
  appState,
}: MultiPositionProps) => {
  const positions = useMemo(
    () =>
      atomicUnits.map((atomicUnit) => {
        const elementsInUnit = Object.keys(atomicUnit)
          .map((id) => elementsMap.get(id))
          .filter((el) => el !== undefined) as ExcalidrawElement[];

        // we're dealing with a group
        if (elementsInUnit.length > 1) {
          const [x1, y1] = getCommonBounds(elementsInUnit);
          return Math.round((property === "x" ? x1 : y1) * 100) / 100;
        }

        const [el] = elementsInUnit;
        const [cx, cy] = [el.x + el.width / 2, el.y + el.height / 2];

        const [topLeftX, topLeftY] = pointRotateRads(
          pointFrom(el.x, el.y),
          pointFrom(cx, cy),
          el.angle,
        );

        return Math.round((property === "x" ? topLeftX : topLeftY) * 100) / 100;
      }),
    [atomicUnits, elementsMap, property],
  );

  const value = new Set(positions).size === 1 ? positions[0] : "Mixed";

  return (
    <StatsDragInput
      label={property === "x" ? "X" : "Y"}
      elements={elements}
      dragInputCallback={handlePositionChange}
      value={value}
      property={property}
      scene={scene}
      appState={appState}
    />
  );
};

export default MultiPosition;
