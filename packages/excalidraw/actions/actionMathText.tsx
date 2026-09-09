import {
  CaptureUpdateAction,
  getBoundTextElement,
  getContainerElement,
  getMathTextSource,
  isMathText,
  isTextElement,
  newElementWith,
  redrawTextBoundingBox,
  refreshTextDimensions,
} from "@excalidraw/element";

import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { RadioSelection } from "../components/RadioSelection";
import { mathIcon } from "../components/icons";
import { t } from "../i18n";

import { changeProperty } from "./actionProperties";
import { register } from "./register";

/**
 * Wraps plain text into display math (`$$…$$`), or strips the delimiters
 * of math text. The delimiters are the single source of truth for "math
 * mode" — this is just a convenience over typing them.
 */
export const toggleMathTextDelimiters = (originalText: string) => {
  const math = getMathTextSource(originalText);
  if (math) {
    return math.source;
  }
  return originalText.trim() ? `$$${originalText}$$` : originalText;
};

/** the text elements a toggle acts on: selected texts + bound texts of selected containers */
const getTargetTextElements = (
  selectedElements: readonly ExcalidrawElement[],
  elementsMap: ElementsMap,
): ExcalidrawTextElement[] => {
  const targets: ExcalidrawTextElement[] = [];
  for (const element of selectedElements) {
    if (isTextElement(element)) {
      targets.push(element);
    } else {
      const boundText = getBoundTextElement(element, elementsMap);
      if (boundText) {
        targets.push(boundText);
      }
    }
  }
  return targets;
};

const areAllMath = (targets: readonly ExcalidrawTextElement[]) =>
  targets.length > 0 &&
  targets.every((element) => isMathText(element.originalText));

export const actionToggleMathText = register({
  name: "toggleMathText",
  label: "labels.mathText",
  keywords: ["latex", "tex", "math", "equation", "formula"],
  icon: mathIcon,
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    return (
      !appState.editingTextElement &&
      getTargetTextElements(
        app.scene.getSelectedElements(appState),
        app.scene.getNonDeletedElementsMap(),
      ).length > 0
    );
  },
  perform: (elements, appState, _, app) => {
    if (appState.editingTextElement) {
      return false;
    }
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const targets = getTargetTextElements(
      app.scene.getSelectedElements(appState),
      elementsMap,
    );
    if (!targets.length) {
      return false;
    }
    // all math → back to plain text; otherwise wrap the plain ones
    const unwrap = areAllMath(targets);

    return {
      elements: changeProperty(
        elements,
        appState,
        (oldElement) => {
          if (!isTextElement(oldElement)) {
            return oldElement;
          }
          const isMath = isMathText(oldElement.originalText);
          if (unwrap !== isMath) {
            return oldElement;
          }
          const nextOriginalText = toggleMathTextDelimiters(
            oldElement.originalText,
          );
          if (nextOriginalText === oldElement.originalText) {
            return oldElement;
          }
          const container = getContainerElement(oldElement, elementsMap);
          const newElement: ExcalidrawTextElement = newElementWith(oldElement, {
            originalText: nextOriginalText,
            ...refreshTextDimensions(
              oldElement,
              container,
              elementsMap,
              nextOriginalText,
            ),
          });
          if (container) {
            redrawTextBoundingBox(newElement, container, app.scene);
          }
          return newElement;
        },
        true,
      ),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ appState, updateData, app }) => {
    const targets = getTargetTextElements(
      app.scene.getSelectedElements(appState),
      app.scene.getNonDeletedElementsMap(),
    );
    const active = areAllMath(targets);
    const label = t(
      active ? "labels.mathTextDisable" : "labels.mathTextEnable",
    );

    return (
      <fieldset>
        <legend>{t("labels.mathText")}</legend>
        <div className="buttonList">
          <RadioSelection<"toggle">
            type="button"
            options={[
              {
                value: "toggle",
                text: label,
                icon: mathIcon,
                active,
                testId: "toggle-math-text",
              },
            ]}
            value={active ? "toggle" : null}
            onClick={() => updateData(null)}
          />
        </div>
      </fieldset>
    );
  },
});
