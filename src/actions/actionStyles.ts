import {
  isTextElement,
  isExcalidrawElement,
  redrawTextBoundingBox,
} from "../element";
import { KEYS } from "../keys";
import { DEFAULT_FONT } from "../appState";
import { register } from "./register";

let copiedStyles: string = "{}";

export const actionCopyStyles = register({
  name: "copyStyles",
  perform: elements => {
    const element = elements.find(el => el.isSelected);
    if (element) {
      copiedStyles = JSON.stringify(element);
    }
    return {};
  },
  contextItemLabel: "labels.copyStyles",
  keyTest: event => event[KEYS.META] && event.shiftKey && event.key === "C",
  contextMenuOrder: 0,
});

export const actionPasteStyles = register({
  name: "pasteStyles",
  perform: elements => {
    const pastedElement = JSON.parse(copiedStyles);
    if (!isExcalidrawElement(pastedElement)) {
      return { elements };
    }
    return {
      elements: elements.map(element => {
        if (element.isSelected) {
          const newElement = {
            ...element,
            shape: null,
            backgroundColor: pastedElement?.backgroundColor,
            strokeWidth: pastedElement?.strokeWidth,
            strokeColor: pastedElement?.strokeColor,
            fillStyle: pastedElement?.fillStyle,
            opacity: pastedElement?.opacity,
            roughness: pastedElement?.roughness,
          };
          if (isTextElement(newElement)) {
            newElement.font = pastedElement?.font || DEFAULT_FONT;
            redrawTextBoundingBox(newElement);
          }
          return newElement;
        }
        return element;
      }),
    };
  },
  commitToHistory: () => true,
  contextItemLabel: "labels.pasteStyles",
  keyTest: event => event[KEYS.META] && event.shiftKey && event.key === "V",
  contextMenuOrder: 1,
});
