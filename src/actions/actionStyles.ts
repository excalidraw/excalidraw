import {
  isTextElement,
  isExcalidrawElement,
  redrawTextBoundingBox,
} from "../element";
import { CODES, KEYS } from "../keys";
import { t } from "../i18n";
import { register } from "./register";
import { mutateElement, newElementWith } from "../element/mutateElement";
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_TEXT_ALIGN,
} from "../constants";
import { getContainerElement } from "../element/textElement";

// `copiedStyles` is exported only for tests.
export let copiedStyles: string = "{}";

export const actionCopyStyles = register({
  name: "copyStyles",
  perform: (elements, appState) => {
    const element = elements.find((el) => appState.selectedElementIds[el.id]);
    if (element) {
      copiedStyles = JSON.stringify(element);
    }
    return {
      appState: {
        ...appState,
        toastMessage: t("toast.copyStyles"),
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
  perform: (elements, appState) => {
    const pastedElement = JSON.parse(copiedStyles);
    if (!isExcalidrawElement(pastedElement)) {
      return { elements, commitToHistory: false };
    }
    return {
      elements: elements.map((element) => {
        if (appState.selectedElementIds[element.id]) {
          const newElement = newElementWith(element, {
            backgroundColor: pastedElement?.backgroundColor,
            strokeWidth: pastedElement?.strokeWidth,
            strokeColor: pastedElement?.strokeColor,
            strokeStyle: pastedElement?.strokeStyle,
            fillStyle: pastedElement?.fillStyle,
            opacity: pastedElement?.opacity,
            roughness: pastedElement?.roughness,
          });
          if (isTextElement(newElement) && isTextElement(element)) {
            mutateElement(newElement, {
              fontSize: pastedElement?.fontSize || DEFAULT_FONT_SIZE,
              fontFamily: pastedElement?.fontFamily || DEFAULT_FONT_FAMILY,
              textAlign: pastedElement?.textAlign || DEFAULT_TEXT_ALIGN,
            });

            redrawTextBoundingBox(newElement, getContainerElement(newElement));
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
