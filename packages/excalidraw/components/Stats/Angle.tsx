import { degreesToRadians, radiansToDegrees } from "@excalidraw/math";

import { mutateElement } from "@excalidraw/element/mutateElement";

import { getBoundTextElement } from "@excalidraw/element/textElement";
import { isArrowElement, isElbowArrow } from "@excalidraw/element/typeChecks";

import type { Degrees } from "@excalidraw/math";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { angleIcon } from "../icons";

import DragInput from "./DragInput";
import { getStepSizedValue, isPropertyEditable, updateBindings } from "./utils";

import type { DragInputCallbackType } from "./DragInput";
import type Scene from "../../src/scene/Scene";
import type { AppState } from "../../types";

interface AngleProps {
  element: ExcalidrawElement;
  scene: Scene;
  appState: AppState;
  property: "angle";
}

const STEP_SIZE = 15;

const handleDegreeChange: DragInputCallbackType<AngleProps["property"]> = ({
  accumulatedChange,
  originalElements,
  shouldChangeByStepSize,
  nextValue,
  scene,
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const elements = scene.getNonDeletedElements();
  const origElement = originalElements[0];
  if (origElement && !isElbowArrow(origElement)) {
    const latestElement = elementsMap.get(origElement.id);
    if (!latestElement) {
      return;
    }

    if (nextValue !== undefined) {
      const nextAngle = degreesToRadians(nextValue as Degrees);
      mutateElement(latestElement, {
        angle: nextAngle,
      });
      updateBindings(latestElement, elementsMap, elements, scene);

      const boundTextElement = getBoundTextElement(latestElement, elementsMap);
      if (boundTextElement && !isArrowElement(latestElement)) {
        mutateElement(boundTextElement, { angle: nextAngle });
      }

      return;
    }

    const originalAngleInDegrees =
      Math.round(radiansToDegrees(origElement.angle) * 100) / 100;
    const changeInDegrees = Math.round(accumulatedChange);
    let nextAngleInDegrees = (originalAngleInDegrees + changeInDegrees) % 360;
    if (shouldChangeByStepSize) {
      nextAngleInDegrees = getStepSizedValue(nextAngleInDegrees, STEP_SIZE);
    }

    nextAngleInDegrees =
      nextAngleInDegrees < 0 ? nextAngleInDegrees + 360 : nextAngleInDegrees;

    const nextAngle = degreesToRadians(nextAngleInDegrees as Degrees);

    mutateElement(latestElement, {
      angle: nextAngle,
    });
    updateBindings(latestElement, elementsMap, elements, scene);

    const boundTextElement = getBoundTextElement(latestElement, elementsMap);
    if (boundTextElement && !isArrowElement(latestElement)) {
      mutateElement(boundTextElement, { angle: nextAngle });
    }
  }
};

const Angle = ({ element, scene, appState, property }: AngleProps) => {
  return (
    <DragInput
      label="A"
      icon={angleIcon}
      value={Math.round((radiansToDegrees(element.angle) % 360) * 100) / 100}
      elements={[element]}
      dragInputCallback={handleDegreeChange}
      editable={isPropertyEditable(element, "angle")}
      scene={scene}
      appState={appState}
      property={property}
    />
  );
};

export default Angle;
