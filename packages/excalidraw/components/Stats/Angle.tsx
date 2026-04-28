import { degreesToRadians, radiansToDegrees } from "@excalidraw/math";

import { getBoundTextElement } from "@excalidraw/element";
import { isArrowElement, isElbowArrow } from "@excalidraw/element";

import { updateBindings } from "@excalidraw/element";

import type { Degrees } from "@excalidraw/math";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { Scene } from "@excalidraw/element";

import { angleIcon } from "../icons";

import DragInput from "./DragInput";
import { getStepSizedValue, isPropertyEditable } from "./utils";

import type { DragInputCallbackType } from "./DragInput";
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
  app,
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const origElement = originalElements[0];
  if (origElement && !isElbowArrow(origElement)) {
    const latestElement = elementsMap.get(origElement.id);
    if (!latestElement) {
      return;
    }

    if (nextValue !== undefined) {
      const nextAngle = degreesToRadians(nextValue as Degrees);
      scene.mutateElement(latestElement, {
        angle: nextAngle,
      });
      updateBindings(latestElement, scene, app.state);

      const boundTextElement = getBoundTextElement(latestElement, elementsMap);
      if (boundTextElement && !isArrowElement(latestElement)) {
        scene.mutateElement(boundTextElement, { angle: nextAngle });
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

    scene.mutateElement(latestElement, {
      angle: nextAngle,
    });
    updateBindings(latestElement, scene, app.state);

    const boundTextElement = getBoundTextElement(latestElement, elementsMap);
    if (boundTextElement && !isArrowElement(latestElement)) {
      scene.mutateElement(boundTextElement, { angle: nextAngle });
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
