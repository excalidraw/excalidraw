import {
  isTextElement,
  isExcalidrawElement,
  redrawTextBoundingBox,
} from "../element";
import { KEYS } from "../keys";
import { DEFAULT_FONT, DEFAULT_TEXT_ALIGN } from "../appState";
import { register } from "./register";
import { mutateElement, newElementWith } from "../element/mutateElement";

let copiedStyles: string = "{}";

export const actionCopyStyles = register({
  name: "copyStyles",
  perform: (elements, appState) => {
    const element = elements.find((el) => appState.selectedElementIds[el.id]);
    if (element) {
      copiedStyles = JSON.stringify(element);
    }
    return {
      commitToHistory: false,
    };
  },
  contextItemLabel: "labels.copyStyles",
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === "C",
  contextMenuOrder: 0,
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
            fillStyle: pastedElement?.fillStyle,
            opacity: pastedElement?.opacity,
            roughness: pastedElement?.roughness,
          });
          if (isTextElement(newElement)) {
            mutateElement(newElement, {
              font: pastedElement?.font || DEFAULT_FONT,
              textAlign: pastedElement?.textAlign || DEFAULT_TEXT_ALIGN,
            });
            redrawTextBoundingBox(newElement);
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
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === "V",
  contextMenuOrder: 1,
});
