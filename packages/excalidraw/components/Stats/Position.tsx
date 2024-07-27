import type { ElementsMap, ExcalidrawElement } from "../../element/types";
import { rotate } from "../../math";
import StatsDragInput from "./DragInput";
import type { DragInputCallbackType } from "./DragInput";
import { getStepSizedValue, moveElement } from "./utils";
import type Scene from "../../scene/Scene";
import type { AppState } from "../../types";

interface PositionProps {
  property: "x" | "y";
  element: ExcalidrawElement;
  elementsMap: ElementsMap;
  scene: Scene;
  appState: AppState;
}

const STEP_SIZE = 10;

const handlePositionChange: DragInputCallbackType<"x" | "y"> = ({
  accumulatedChange,
  originalElements,
  originalElementsMap,
  shouldChangeByStepSize,
  nextValue,
  property,
  scene,
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const origElement = originalElements[0];
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

  if (nextValue !== undefined) {
    const newTopLeftX = property === "x" ? nextValue : topLeftX;
    const newTopLeftY = property === "y" ? nextValue : topLeftY;
    moveElement(
      newTopLeftX,
      newTopLeftY,
      origElement,
      elementsMap,
      originalElementsMap,
    );
    return;
  }

  const changeInTopX = property === "x" ? accumulatedChange : 0;
  const changeInTopY = property === "y" ? accumulatedChange : 0;

  const newTopLeftX =
    property === "x"
      ? Math.round(
          shouldChangeByStepSize
            ? getStepSizedValue(origElement.x + changeInTopX, STEP_SIZE)
            : topLeftX + changeInTopX,
        )
      : topLeftX;

  const newTopLeftY =
    property === "y"
      ? Math.round(
          shouldChangeByStepSize
            ? getStepSizedValue(origElement.y + changeInTopY, STEP_SIZE)
            : topLeftY + changeInTopY,
        )
      : topLeftY;

  moveElement(
    newTopLeftX,
    newTopLeftY,
    origElement,
    elementsMap,
    originalElementsMap,
  );
};

const Position = ({
  property,
  element,
  elementsMap,
  scene,
  appState,
}: PositionProps) => {
  const [topLeftX, topLeftY] = rotate(
    element.x,
    element.y,
    element.x + element.width / 2,
    element.y + element.height / 2,
    element.angle,
  );
  const value =
    Math.round((property === "x" ? topLeftX : topLeftY) * 100) / 100;

  return (
    <StatsDragInput
      label={property === "x" ? "X" : "Y"}
      elements={[element]}
      dragInputCallback={handlePositionChange}
      value={value}
      property={property}
      scene={scene}
      appState={appState}
    />
  );
};

export default Position;
