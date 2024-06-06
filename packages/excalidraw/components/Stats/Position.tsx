import { mutateElement } from "../../element/mutateElement";
import { getBoundTextElement } from "../../element/textElement";
import type { ElementsMap, ExcalidrawElement } from "../../element/types";
import { rotate } from "../../math";
import StatsDragInput from "./DragInput";
import type { DragInputCallbackType } from "./DragInput";
import { getStepSizedValue } from "./utils";

interface PositionProps {
  property: "x" | "y";
  element: ExcalidrawElement;
  elementsMap: ElementsMap;
}

const STEP_SIZE = 10;

export const moveElement = (
  newTopLeftX: number,
  newTopLeftY: number,
  latestElement: ExcalidrawElement,
  originalElement: ExcalidrawElement,
  elementsMap: ElementsMap,
  originalElementsMap: ElementsMap,
  shouldInformMutation = true,
) => {
  const [cx, cy] = [
    originalElement.x + originalElement.width / 2,
    originalElement.y + originalElement.height / 2,
  ];
  const [topLeftX, topLeftY] = rotate(
    originalElement.x,
    originalElement.y,
    cx,
    cy,
    originalElement.angle,
  );

  const changeInX = newTopLeftX - topLeftX;
  const changeInY = newTopLeftY - topLeftY;

  const [x, y] = rotate(
    newTopLeftX,
    newTopLeftY,
    cx + changeInX,
    cy + changeInY,
    -originalElement.angle,
  );

  mutateElement(
    latestElement,
    {
      x,
      y,
    },
    shouldInformMutation,
  );

  const boundTextElement = getBoundTextElement(
    originalElement,
    originalElementsMap,
  );
  if (boundTextElement) {
    const latestBoundTextElement = elementsMap.get(boundTextElement.id);
    latestBoundTextElement &&
      mutateElement(
        latestBoundTextElement,
        {
          x: boundTextElement.x + changeInX,
          y: boundTextElement.y + changeInY,
        },
        shouldInformMutation,
      );
  }
};

const Position = ({ property, element, elementsMap }: PositionProps) => {
  const [topLeftX, topLeftY] = rotate(
    element.x,
    element.y,
    element.x + element.width / 2,
    element.y + element.height / 2,
    element.angle,
  );
  const value =
    Math.round((property === "x" ? topLeftX : topLeftY) * 100) / 100;

  const handlePositionChange: DragInputCallbackType = ({
    accumulatedChange,
    stateAtStart,
    originalElementsMap,
    shouldChangeByStepSize,
    nextValue,
  }) => {
    const origElement = stateAtStart[0];
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

    if (nextValue) {
      const newTopLeftX = property === "x" ? nextValue : topLeftX;
      const newTopLeftY = property === "y" ? nextValue : topLeftY;
      moveElement(
        newTopLeftX,
        newTopLeftY,
        element,
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
      element,
      origElement,
      elementsMap,
      originalElementsMap,
    );
  };

  return (
    <StatsDragInput
      label={property === "x" ? "X" : "Y"}
      elements={[element]}
      dragInputCallback={handlePositionChange}
      value={value}
    />
  );
};

export default Position;
