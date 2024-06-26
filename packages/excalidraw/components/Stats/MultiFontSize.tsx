import { isTextElement, refreshTextDimensions } from "../../element";
import { mutateElement } from "../../element/mutateElement";
import { isBoundToContainer } from "../../element/typeChecks";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "../../element/types";
import { isInGroup } from "../../groups";
import type Scene from "../../scene/Scene";
import { fontSizeIcon } from "../icons";
import StatsDragInput from "./DragInput";
import type { DragInputCallbackType } from "./DragInput";
import { getStepSizedValue } from "./utils";
import type { AppState } from "../../types";

interface MultiFontSizeProps {
  elements: readonly ExcalidrawElement[];
  scene: Scene;
  appState: AppState;
  property: "fontSize";
}

const MIN_FONT_SIZE = 4;
const STEP_SIZE = 4;

const getApplicableTextElements = (
  elements: readonly (ExcalidrawElement | undefined)[],
) =>
  elements.filter(
    (el) =>
      el && !isInGroup(el) && isTextElement(el) && !isBoundToContainer(el),
  ) as ExcalidrawTextElement[];

const handleFontSizeChange: DragInputCallbackType<
  MultiFontSizeProps["property"]
> = ({
  accumulatedChange,
  originalElements,
  shouldChangeByStepSize,
  nextValue,
  scene,
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const latestTextElements = getApplicableTextElements(
    originalElements.map((el) => elementsMap.get(el.id)),
  );

  if (nextValue) {
    const nextFontSize = Math.max(Math.round(nextValue), MIN_FONT_SIZE);

    for (const textElement of latestTextElements.map((el) =>
      elementsMap.get(el.id),
    )) {
      if (!textElement || !isTextElement(textElement)) {
        continue;
      }
      const newElement = {
        ...textElement,
        fontSize: nextFontSize,
      };
      const updates = refreshTextDimensions(newElement, null, elementsMap);
      mutateElement(
        textElement,
        {
          ...updates,
          fontSize: nextFontSize,
        },
        false,
      );
    }

    scene.triggerUpdate();
    return;
  }

  const originalTextElements = originalElements.filter(
    (el) => !isInGroup(el) && isTextElement(el) && !isBoundToContainer(el),
  ) as ExcalidrawTextElement[];

  for (let i = 0; i < latestTextElements.length; i++) {
    const latestElement = latestTextElements[i];
    const originalElement = originalTextElements[i];

    const originalFontSize = Math.round(originalElement.fontSize);
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
    mutateElement(
      latestElement,
      {
        ...updates,
        fontSize: nextFontSize,
      },
      false,
    );
  }

  scene.triggerUpdate();
};

const MultiFontSize = ({
  elements,
  scene,
  appState,
  property,
}: MultiFontSizeProps) => {
  const latestTextElements = getApplicableTextElements(elements);
  const fontSizes = latestTextElements.map(
    (textEl) => Math.round(textEl.fontSize * 10) / 10,
  );
  const value = new Set(fontSizes).size === 1 ? fontSizes[0] : "Mixed";
  const editable = fontSizes.length > 0;

  return (
    <StatsDragInput
      label="F"
      icon={fontSizeIcon}
      elements={elements}
      dragInputCallback={handleFontSizeChange}
      value={value}
      editable={editable}
      scene={scene}
      property={property}
      appState={appState}
    />
  );
};

export default MultiFontSize;
