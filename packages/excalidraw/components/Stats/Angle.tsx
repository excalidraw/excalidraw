import { mutateElement } from "../../element/mutateElement";
import { getBoundTextElement } from "../../element/textElement";
import { isArrowElement } from "../../element/typeChecks";
import type { ElementsMap, ExcalidrawElement } from "../../element/types";
import { degreeToRadian, radianToDegree } from "../../math";
import { angleIcon } from "../icons";
import DragInput from "./DragInput";
import type { DragInputCallbackType } from "./DragInput";
import { getStepSizedValue, isPropertyEditable } from "./utils";

interface AngleProps {
  element: ExcalidrawElement;
  elementsMap: ElementsMap;
}

const STEP_SIZE = 15;

const Angle = ({ element, elementsMap }: AngleProps) => {
  const handleDegreeChange: DragInputCallbackType = ({
    accumulatedChange,
    originalElements,
    shouldChangeByStepSize,
    nextValue,
  }) => {
    const origElement = originalElements[0];
    if (origElement) {
      if (nextValue !== undefined) {
        const nextAngle = degreeToRadian(nextValue);
        mutateElement(element, {
          angle: nextAngle,
        });

        const boundTextElement = getBoundTextElement(element, elementsMap);
        if (boundTextElement && !isArrowElement(element)) {
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

      mutateElement(element, {
        angle: nextAngle,
      });

      const boundTextElement = getBoundTextElement(element, elementsMap);
      if (boundTextElement && !isArrowElement(element)) {
        mutateElement(boundTextElement, { angle: nextAngle });
      }
    }
  };

  return (
    <DragInput
      label="A"
      icon={angleIcon}
      value={Math.round((radianToDegree(element.angle) % 360) * 100) / 100}
      elements={[element]}
      dragInputCallback={handleDegreeChange}
      editable={isPropertyEditable(element, "angle")}
    />
  );
};

export default Angle;
