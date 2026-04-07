import { degreesToRadians, radiansToDegrees } from "@excalidraw/math";

import { getBoundTextElement } from "@excalidraw/element";
import { isArrowElement } from "@excalidraw/element";

import { isInGroup } from "@excalidraw/element";

import type { Degrees } from "@excalidraw/math";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { Scene } from "@excalidraw/element";

import { angleIcon } from "../icons";

import DragInput from "./DragInput";
import { getStepSizedValue, isPropertyEditable } from "./utils";

import type { DragInputCallbackType } from "./DragInput";
import type { AppState } from "../../types";

interface MultiAngleProps {
  elements: readonly ExcalidrawElement[];
  scene: Scene;
  appState: AppState;
  property: "angle";
}

const STEP_SIZE = 15;

const handleDegreeChange: DragInputCallbackType<
  MultiAngleProps["property"]
> = ({
  accumulatedChange,
  originalElements,
  shouldChangeByStepSize,
  nextValue,
  property,
  scene,
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const editableLatestIndividualElements = originalElements
    .map((el) => elementsMap.get(el.id))
    .filter((el) => el && !isInGroup(el) && isPropertyEditable(el, property));
  const editableOriginalIndividualElements = originalElements.filter(
    (el) => !isInGroup(el) && isPropertyEditable(el, property),
  );

  if (nextValue !== undefined) {
    const nextAngle = degreesToRadians(nextValue as Degrees);

    for (const element of editableLatestIndividualElements) {
      if (!element) {
        continue;
      }
      scene.mutateElement(element, {
        angle: nextAngle,
      });

      const boundTextElement = getBoundTextElement(element, elementsMap);
      if (boundTextElement && !isArrowElement(element)) {
        scene.mutateElement(boundTextElement, { angle: nextAngle });
      }
    }

    scene.triggerUpdate();

    return;
  }

  for (let i = 0; i < editableLatestIndividualElements.length; i++) {
    const latestElement = editableLatestIndividualElements[i];
    if (!latestElement) {
      continue;
    }
    const originalElement = editableOriginalIndividualElements[i];
    const originalAngleInDegrees =
      Math.round(radiansToDegrees(originalElement.angle) * 100) / 100;
    const changeInDegrees = Math.round(accumulatedChange);
    let nextAngleInDegrees = (originalAngleInDegrees + changeInDegrees) % 360;
    if (shouldChangeByStepSize) {
      nextAngleInDegrees = getStepSizedValue(nextAngleInDegrees, STEP_SIZE);
    }

    nextAngleInDegrees =
      nextAngleInDegrees < 0 ? nextAngleInDegrees + 360 : nextAngleInDegrees;

    const nextAngle = degreesToRadians(nextAngleInDegrees as Degrees);

    scene.mutateElement(latestElement, {
      angle: nextAngle,
    });

    const boundTextElement = getBoundTextElement(latestElement, elementsMap);
    if (boundTextElement && !isArrowElement(latestElement)) {
      scene.mutateElement(boundTextElement, { angle: nextAngle });
    }
  }
  scene.triggerUpdate();
};

const MultiAngle = ({
  elements,
  scene,
  appState,
  property,
}: MultiAngleProps) => {
  const editableLatestIndividualElements = elements.filter(
    (el) => !isInGroup(el) && isPropertyEditable(el, "angle"),
  );
  const angles = editableLatestIndividualElements.map(
    (el) => Math.round((radiansToDegrees(el.angle) % 360) * 100) / 100,
  );
  const value = new Set(angles).size === 1 ? angles[0] : "Mixed";

  const editable = editableLatestIndividualElements.some((el) =>
    isPropertyEditable(el, "angle"),
  );

  return (
    <DragInput
      label="A"
      icon={angleIcon}
      value={value}
      elements={elements}
      dragInputCallback={handleDegreeChange}
      editable={editable}
      appState={appState}
      scene={scene}
      property={property}
    />
  );
};

export default MultiAngle;
