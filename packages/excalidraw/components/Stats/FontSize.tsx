import type { ExcalidrawTextElement } from "../../element/types";
import { refreshTextDimensions } from "../../element/newElement";
import StatsDragInput from "./DragInput";
import type { DragInputCallbackType } from "./DragInput";
import { mutateElement } from "../../element/mutateElement";
import { getStepSizedValue } from "./utils";
import { fontSizeIcon } from "../icons";
import type Scene from "../../scene/Scene";
import type { AppState } from "../../types";
import { isTextElement } from "../../element";

interface FontSizeProps {
  element: ExcalidrawTextElement;
  scene: Scene;
  appState: AppState;
  property: "fontSize";
}

const MIN_FONT_SIZE = 4;
const STEP_SIZE = 4;

const handleFontSizeChange: DragInputCallbackType<
  FontSizeProps["property"]
> = ({
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
    if (!latestElement || !isTextElement(latestElement)) {
      return;
    }
    if (nextValue !== undefined) {
      const nextFontSize = Math.max(Math.round(nextValue), MIN_FONT_SIZE);

      const newElement = {
        ...latestElement,
        fontSize: nextFontSize,
      };
      const updates = refreshTextDimensions(newElement, null, elementsMap);
      mutateElement(latestElement, {
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
        ...latestElement,
        fontSize: nextFontSize,
      };
      const updates = refreshTextDimensions(newElement, null, elementsMap);
      mutateElement(latestElement, {
        ...updates,
        fontSize: nextFontSize,
      });
    }
  }
};

const FontSize = ({ element, scene, appState, property }: FontSizeProps) => {
  return (
    <StatsDragInput
      label="F"
      value={Math.round(element.fontSize * 10) / 10}
      elements={[element]}
      dragInputCallback={handleFontSizeChange}
      icon={fontSizeIcon}
      appState={appState}
      scene={scene}
      property={property}
    />
  );
};

export default FontSize;
