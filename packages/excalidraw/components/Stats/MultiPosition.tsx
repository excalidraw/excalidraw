import type {
  ElementsMap,
  ExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "../../element/types";
import { rotate } from "../../math";
import type Scene from "../../scene/Scene";
import StatsDragInput from "./DragInput";
import type { DragInputCallbackType } from "./DragInput";
import { getAtomicUnits, getStepSizedValue, isPropertyEditable } from "./utils";
import { getCommonBounds, isTextElement } from "../../element";
import { useMemo } from "react";
import { getElementsInAtomicUnit, moveElement } from "./utils";
import type { AtomicUnit } from "./utils";
import type { AppState } from "../../types";

interface MultiPositionProps {
  property: "x" | "y";
  elements: readonly ExcalidrawElement[];
  elementsMap: ElementsMap;
  atomicUnits: AtomicUnit[];
  scene: Scene;
  appState: AppState;
}

const STEP_SIZE = 10;

const moveElements = (
  property: MultiPositionProps["property"],
  changeInTopX: number,
  changeInTopY: number,
  elements: readonly ExcalidrawElement[],
  originalElements: readonly ExcalidrawElement[],
  elementsMap: NonDeletedSceneElementsMap,
  originalElementsMap: ElementsMap,
) => {
  for (let i = 0; i < elements.length; i++) {
    const origElement = originalElements[i];

    const [cx, cy] = [
      origElement.x + origElement.width / 2,
      origElement.y + origElement.height / 2,
    ];
    const [topLeftX, topLeftY] = rotate(
      origElement.x,
      origElement.y,
      cx,
      cy,
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
      elementsMap,
      originalElementsMap,
      false,
    );
  }
};

const moveGroupTo = (
  nextX: number,
  nextY: number,
  originalElements: ExcalidrawElement[],
  elementsMap: NonDeletedSceneElementsMap,
  originalElementsMap: ElementsMap,
  scene: Scene,
) => {
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

      const [topLeftX, topLeftY] = rotate(
        latestElement.x,
        latestElement.y,
        cx,
        cy,
        latestElement.angle,
      );

      moveElement(
        topLeftX + offsetX,
        topLeftY + offsetY,
        origElement,
        elementsMap,
        originalElementsMap,
        false,
      );
    }
  }
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
          elementsMap,
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
          const [topLeftX, topLeftY] = rotate(
            origElement.x,
            origElement.y,
            cx,
            cy,
            origElement.angle,
          );

          const newTopLeftX = property === "x" ? nextValue : topLeftX;
          const newTopLeftY = property === "y" ? nextValue : topLeftY;
          moveElement(
            newTopLeftX,
            newTopLeftY,
            origElement,
            elementsMap,
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
    originalElements,
    elementsMap,
    originalElementsMap,
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

        const [topLeftX, topLeftY] = rotate(el.x, el.y, cx, cy, el.angle);

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
