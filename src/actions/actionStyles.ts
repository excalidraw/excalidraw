import {
  isTextElement,
  isExcalidrawElement,
  redrawTextBoundingBox,
} from "../element";
import { CODES, KEYS } from "../keys";
import { t } from "../i18n";
import { register } from "./register";
import { newElementWith } from "../element/mutateElement";
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_TEXT_ALIGN,
} from "../constants";
import { getBoundTextElement } from "../element/textElement";
import { hasBoundTextElement } from "../element/typeChecks";
import { getSelectedElements } from "../scene";

// `copiedStyles` is exported only for tests.
export let copiedStyles: string = "{}";

export const actionCopyStyles = register({
  name: "copyStyles",
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    const elementsCopied = [];
    const element = elements.find((el) => appState.selectedElementIds[el.id]);
    elementsCopied.push(element);
    if (element && hasBoundTextElement(element)) {
      const boundTextElement = getBoundTextElement(element);
      elementsCopied.push(boundTextElement);
    }
    if (element) {
      copiedStyles = JSON.stringify(elementsCopied);
    }
    return {
      appState: {
        ...appState,
        toast: { message: t("toast.copyStyles") },
      },
      commitToHistory: false,
    };
  },
  contextItemLabel: "labels.copyStyles",
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.C,
});

export const actionPasteStyles = register({
  name: "pasteStyles",
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    const elementsCopied = JSON.parse(copiedStyles);
    const pastedElement = elementsCopied[0];
    const boundTextElement = elementsCopied[1];
    if (!isExcalidrawElement(pastedElement)) {
      return { elements, commitToHistory: false };
    }

    const selectedElements = getSelectedElements(elements, appState, true);
    const selectedElementIds = selectedElements.map((element) => element.id);
    return {
      elements: elements.map((element) => {
        if (selectedElementIds.includes(element.id)) {
          let elementStylesToCopyFrom = pastedElement;
          if (isTextElement(element) && element.containerId) {
            elementStylesToCopyFrom = boundTextElement;
          }
          if (!elementStylesToCopyFrom) {
            return element;
          }
          let newElement = newElementWith(element, {
            backgroundColor: elementStylesToCopyFrom?.backgroundColor,
            strokeWidth: elementStylesToCopyFrom?.strokeWidth,
            strokeColor: elementStylesToCopyFrom?.strokeColor,
            strokeStyle: elementStylesToCopyFrom?.strokeStyle,
            fillStyle: elementStylesToCopyFrom?.fillStyle,
            opacity: elementStylesToCopyFrom?.opacity,
            roughness: elementStylesToCopyFrom?.roughness,
          });

          if (isTextElement(newElement)) {
            newElement = newElementWith(newElement, {
              fontSize: elementStylesToCopyFrom?.fontSize || DEFAULT_FONT_SIZE,
              fontFamily:
                elementStylesToCopyFrom?.fontFamily || DEFAULT_FONT_FAMILY,
              textAlign:
                elementStylesToCopyFrom?.textAlign || DEFAULT_TEXT_ALIGN,
            });
            let container = null;
            if (newElement.containerId) {
              container =
                selectedElements.find(
                  (element) =>
                    isTextElement(newElement) &&
                    element.id === newElement.containerId,
                ) || null;
            }
            redrawTextBoundingBox(newElement, container);
          }

          if (newElement.type === "arrow") {
            newElement = newElementWith(newElement, {
              startArrowhead: elementStylesToCopyFrom.startArrowhead,
              endArrowhead: elementStylesToCopyFrom.endArrowhead,
            });
          }

          return newElement;
        }
        return element;
      }),
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.pasteStyles",
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.V,
});
