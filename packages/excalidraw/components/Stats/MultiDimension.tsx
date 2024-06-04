import { getCommonBounds } from "../../element";
import { mutateElement } from "../../element/mutateElement";
import type { ExcalidrawElement } from "../../element/types";
import DragInput from "./DragInput";
import type { DragInputCallbackType } from "./DragInput";
import { getStepSizedValue } from "./utils";

interface MultiDimensionProps {
  property: "width" | "height";
  elements: ExcalidrawElement[];
}

const STEP_SIZE = 10;

const MultiDimension = ({ property, elements }: MultiDimensionProps) => {
  const handleDimensionChange: DragInputCallbackType = (
    accumulatedChange,
    instantChange,
    stateAtStart,
    shouldKeepAspectRatio,
    shouldChangeByStepSize,
    nextValue,
  ) => {
    const [x1, y1, x2, y2] = getCommonBounds(stateAtStart);
    const initialWidth = x2 - x1;
    const initialHeight = y2 - y1;
    const keepAspectRatio = true;
    const aspectRatio = initialWidth / initialHeight;

    if (nextValue !== undefined) {
      const nextHeight =
        property === "height" ? nextValue : nextValue / aspectRatio;

      const scale = nextHeight / initialHeight;
      const anchorX = property === "width" ? x1 : x1 + width / 2;
      const anchorY = property === "height" ? y1 : y1 + height / 2;

      let i = 0;
      while (i < stateAtStart.length) {
        const element = elements[i];
        const origElement = stateAtStart[i];

        // it should never happen that element and origElement are different
        // but check just in case
        if (element.id === origElement.id) {
          const offsetX = origElement.x - anchorX;
          const offsetY = origElement.y - anchorY;
          const nextWidth = origElement.width * scale;
          const nextHeight = origElement.height * scale;
          const x = anchorX + offsetX * scale;
          const y = anchorY + offsetY * scale;

          mutateElement(
            element,
            {
              width: nextWidth,
              height: nextHeight,
              x,
              y,
            },
            i === stateAtStart.length - 1,
          );
        }
        i++;
      }

      return;
    }

    const changeInWidth = property === "width" ? accumulatedChange : 0;
    const changeInHeight = property === "height" ? accumulatedChange : 0;

    let nextWidth = Math.max(0, initialWidth + changeInWidth);
    if (property === "width") {
      if (shouldChangeByStepSize) {
        nextWidth = getStepSizedValue(nextWidth, STEP_SIZE);
      } else {
        nextWidth = Math.round(nextWidth);
      }
    }

    let nextHeight = Math.max(0, initialHeight + changeInHeight);
    if (property === "height") {
      if (shouldChangeByStepSize) {
        nextHeight = getStepSizedValue(nextHeight, STEP_SIZE);
      } else {
        nextHeight = Math.round(nextHeight);
      }
    }

    if (keepAspectRatio) {
      if (property === "width") {
        nextHeight = Math.round((nextWidth / aspectRatio) * 100) / 100;
      } else {
        nextWidth = Math.round(nextHeight * aspectRatio * 100) / 100;
      }
    }

    const scale = nextHeight / initialHeight;
    const anchorX = property === "width" ? x1 : x1 + width / 2;
    const anchorY = property === "height" ? y1 : y1 + height / 2;

    let i = 0;
    while (i < stateAtStart.length) {
      const element = elements[i];
      const origElement = stateAtStart[i];

      const offsetX = origElement.x - anchorX;
      const offsetY = origElement.y - anchorY;
      const nextWidth = origElement.width * scale;
      const nextHeight = origElement.height * scale;
      const x = anchorX + offsetX * scale;
      const y = anchorY + offsetY * scale;

      mutateElement(
        element,
        {
          width: nextWidth,
          height: nextHeight,
          x,
          y,
        },
        i === stateAtStart.length - 1,
      );
      i++;
    }
  };

  const [x1, y1, x2, y2] = getCommonBounds(elements);
  const width = x2 - x1;
  const height = y2 - y1;

  return (
    <DragInput
      label={property === "width" ? "W" : "H"}
      elements={elements}
      dragInputCallback={handleDimensionChange}
      value={Math.round((property === "width" ? width : height) * 100) / 100}
    />
  );
};

export default MultiDimension;
