import { degreesToRadians, radiansToDegrees } from "@excalidraw/math";

import { mutateElement } from "@excalidraw/element/mutateElement";

import { getBoundTextElement } from "@excalidraw/element/textElement";
import {
  isArrowElement,
  isBindableElement,
  isElbowArrow,
} from "@excalidraw/element/typeChecks";

import {
  getSuggestedBindingsForArrows,
  updateBoundElements,
} from "@excalidraw/element/binding";

import type { AppState } from "@excalidraw/excalidraw/types";

import type { Degrees, Radians } from "@excalidraw/math";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { angleIcon } from "../icons";

import DragInput from "./DragInput";
import { getStepSizedValue, isPropertyEditable, updateBindings } from "./utils";

import type {
  DragFinishedCallbackType,
  DragInputCallbackType,
} from "./DragInput";
import type Scene from "../../scene/Scene";

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
  setAppState,
  originalAppState,
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
      mutateElement(latestElement, {
        angle: nextAngle,
      });

      if (isBindableElement(latestElement)) {
        updateBoundElements(latestElement, elementsMap);
      }

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

    if (isBindableElement(latestElement)) {
      updateBoundElements(latestElement, elementsMap);
    }

    const boundTextElement = getBoundTextElement(latestElement, elementsMap);
    if (boundTextElement && !isArrowElement(latestElement)) {
      mutateElement(boundTextElement, { angle: nextAngle });
    }

    setAppState({
      suggestedBindings: getSuggestedBindingsForArrows(
        [latestElement],
        elementsMap,
        originalAppState.zoom,
      ),
    });
  }
};

const handleFinished: DragFinishedCallbackType<AngleProps["property"]> = ({
  originalElements,
  originalAppState,
  scene,
  accumulatedChange,
  setAppState,
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const origElement = originalElements[0];

  if (origElement) {
    const latestElement = elementsMap.get(origElement.id);

    if (latestElement) {
      updateBindings(latestElement, elementsMap, originalAppState.zoom, () => {
        const change = degreesToRadians(accumulatedChange as Degrees);

        mutateElement(latestElement, {
          angle: (latestElement.angle - change) as Radians,
        });
      });

      setAppState({
        suggestedBindings: [],
      });
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
      dragFinishedCallback={handleFinished}
      editable={isPropertyEditable(element, "angle")}
      scene={scene}
      appState={appState}
      property={property}
    />
  );
};

export default Angle;
