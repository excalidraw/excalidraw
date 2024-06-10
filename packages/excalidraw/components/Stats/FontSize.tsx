import type { ElementsMap, ExcalidrawTextElement } from "../../element/types";
import { refreshTextDimensions } from "../../element/newElement";
import StatsDragInput from "./DragInput";
import type { DragInputCallbackType } from "./DragInput";
import { mutateElement } from "../../element/mutateElement";
import { getStepSizedValue } from "./utils";
import { fontSizeIcon } from "../icons";

interface FontSizeProps {
  element: ExcalidrawTextElement;
  elementsMap: ElementsMap;
}

const MIN_FONT_SIZE = 4;
const STEP_SIZE = 4;

const FontSize = ({ element, elementsMap }: FontSizeProps) => {
  const handleFontSizeChange: DragInputCallbackType = ({
    accumulatedChange,
    originalElements,
    shouldChangeByStepSize,
    nextValue,
  }) => {
    const origElement = originalElements[0];
    if (origElement) {
      if (nextValue !== undefined) {
        const nextFontSize = Math.max(Math.round(nextValue), MIN_FONT_SIZE);

        const newElement = {
          ...element,
          fontSize: nextFontSize,
        };
        const updates = refreshTextDimensions(newElement, null, elementsMap);
        mutateElement(element, {
          ...updates,
          fontSize: nextFontSize,
        });
        return;
      }

      if (origElement.type === "text") {
        const originalFontSize = Math.round(origElement.fontSize);
        const changeInFontSize = Math.round(accumulatedChange);
        let nextFontSize = Math.max(
          originalFontSize + changeInFontSize,
          MIN_FONT_SIZE,
        );
        if (shouldChangeByStepSize) {
          nextFontSize = getStepSizedValue(nextFontSize, STEP_SIZE);
        }
        const newElement = {
          ...element,
          fontSize: nextFontSize,
        };
        const updates = refreshTextDimensions(newElement, null, elementsMap);
        mutateElement(element, {
          ...updates,
          fontSize: nextFontSize,
        });
      }
    }
  };

  return (
    <StatsDragInput
      label="F"
      value={Math.round(element.fontSize * 10) / 10}
      elements={[element]}
      dragInputCallback={handleFontSizeChange}
      icon={fontSizeIcon}
    />
  );
};

export default FontSize;
