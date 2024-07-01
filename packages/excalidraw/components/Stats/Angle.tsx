import { mutateElement } from "../../element/mutateElement";
import { getBoundTextElement } from "../../element/textElement";
import { isArrowElement } from "../../element/typeChecks";
import type { ExcalidrawElement } from "../../element/types";
import { degreeToRadian, radianToDegree } from "../../math";
import { angleIcon } from "../icons";
import DragInput from "./DragInput";
import type { DragInputCallbackType } from "./DragInput";
import { getStepSizedValue, isPropertyEditable, updateBindings } from "./utils";
import type Scene from "../../scene/Scene";
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
  const origElement = originalElements[0];
  if (origElement) {
    const latestElement = elementsMap.get(origElement.id);
    if (!latestElement) {
      return;
    }

    if (nextValue !== undefined) {
      const nextAngle = degreeToRadian(nextValue);
      mutateElement(latestElement, {
        angle: nextAngle,
      });
      updateBindings(latestElement, elementsMap);

      const boundTextElement = getBoundTextElement(latestElement, elementsMap);
      if (boundTextElement && !isArrowElement(latestElement)) {
        mutateElement(boundTextElement, { angle: nextAngle });
      }

      return;
    }

    const originalAngleInDegrees =
      Math.round(radianToDegree(origElement.angle) * 100) / 100;
    const changeInDegrees = Math.round(accumulatedChange);
    let nextAngleInDegrees = (originalAngleInDegrees + changeInDegrees) % 360;
    if (shouldChangeByStepSize) {
      nextAngleInDegrees = getStepSizedValue(nextAngleInDegrees, STEP_SIZE);
    }

    nextAngleInDegrees =
      nextAngleInDegrees < 0 ? nextAngleInDegrees + 360 : nextAngleInDegrees;

    const nextAngle = degreeToRadian(nextAngleInDegrees);

    mutateElement(latestElement, {
      angle: nextAngle,
    });
    updateBindings(latestElement, elementsMap);

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
      value={Math.round((radianToDegree(element.angle) % 360) * 100) / 100}
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
