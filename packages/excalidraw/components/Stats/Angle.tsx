import { mutateElement } from "../../element/mutateElement";
import type { ExcalidrawElement } from "../../element/types";
import { degreeToRadian, radianToDegree } from "../../math";
import DragInput from "./DragInput";
import type { DragInputCallbackType } from "./DragInput";
import { getStepSizedValue, isPropertyEditable } from "./utils";

interface AngleProps {
  element: ExcalidrawElement;
}

const STEP_SIZE = 15;

const Angle = ({ element }: AngleProps) => {
  const handleDegreeChange: DragInputCallbackType = (
    accumulatedChange,
    instantChange,
    stateAtStart,
    shouldKeepAspectRatio,
    shouldChangeByStepSize,
    nextValue,
  ) => {
    const _stateAtStart = stateAtStart[0];
    if (_stateAtStart) {
      if (nextValue !== undefined) {
        const nextAngle = degreeToRadian(nextValue);
        mutateElement(element, {
          angle: nextAngle,
        });
        return;
      }

      const originalAngleInDegrees =
        Math.round(radianToDegree(_stateAtStart.angle) * 100) / 100;
      const changeInDegrees = Math.round(accumulatedChange);
      let nextAngleInDegrees = (originalAngleInDegrees + changeInDegrees) % 360;
      if (shouldChangeByStepSize) {
        nextAngleInDegrees = getStepSizedValue(nextAngleInDegrees, STEP_SIZE);
      }

      mutateElement(element, {
        angle: degreeToRadian(
          nextAngleInDegrees < 0
            ? nextAngleInDegrees + 360
            : nextAngleInDegrees,
        ),
      });
    }
  };

  return (
    <DragInput
      label="A"
      value={Math.round(radianToDegree(element.angle) * 100) / 100}
      elements={[element]}
      dragInputCallback={handleDegreeChange}
      editable={isPropertyEditable(element, "angle")}
    />
  );
};

export default Angle;
