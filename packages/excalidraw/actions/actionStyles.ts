import {
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_TEXT_ALIGN,
  CODES,
  KEYS,
  getLineHeight,
  arrayToMap,
} from "@excalidraw/common";

import { newElementWith, syncStickyNoteInk } from "@excalidraw/element";

import {
  normalizeStickyNote,
  hasBoundTextElement,
  canApplyRoundnessTypeToElement,
  getDefaultRoundnessTypeForElement,
  isFrameLikeElement,
  isArrowElement,
  isExcalidrawElement,
  getColorUpdate,
  isNonDeletedElement,
  isStickyNoteBoundText,
  isStickyNoteElement,
  isTextElement,
  getBaseFontSize,
  getBaseFontSizeUpdate,
  relayoutStickyNotes,
  updateBoundElements,
} from "@excalidraw/element";

import {
  getBoundTextElement,
  redrawTextBoundingBox,
} from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { paintIcon } from "../components/icons";

import { t } from "../i18n";
import { getSelectedElements } from "../scene";

import { register } from "./register";

// `copiedStyles` is exported only for tests.
export let copiedStyles: string = "{}";

export const actionCopyStyles = register({
  name: "copyStyles",
  label: "labels.copyStyles",
  icon: paintIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState, formData, app) => {
    const elementsCopied = [];
    const element = elements.find((el) => appState.selectedElementIds[el.id]);
    elementsCopied.push(element);
    if (element && hasBoundTextElement(element)) {
      const boundTextElement = getBoundTextElement(
        element,
        app.scene.getNonDeletedElementsMap(),
      );
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
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.C,
});

export const actionPasteStyles = register({
  name: "pasteStyles",
  label: "labels.pasteStyles",
  icon: paintIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState, formData, app) => {
    const elementsCopied = JSON.parse(copiedStyles);
    const pastedElement = elementsCopied[0];
    const boundTextElement = elementsCopied[1];
    if (!isExcalidrawElement(pastedElement)) {
      return { elements, captureUpdate: CaptureUpdateAction.EVENTUALLY };
    }

    const selectedElements = getSelectedElements(elements, appState, {
      includeBoundTextElement: true,
    });
    const selectedElementIds = selectedElements.map((element) => element.id);
    const elementsMap = arrayToMap(elements);
    // whether the copied text was a sticky label is decided by the copied
    // snapshot — its container may be gone from the live scene by now
    const copiedElementsMap = arrayToMap(
      (elementsCopied as unknown[]).filter(isExcalidrawElement),
    );
    const nextElements = relayoutStickyNotes(
      // a restyled note and its label end up with one ink — the label's,
      // when the copied styles carry two colors
      syncStickyNoteInk(
        elements.map((element) => {
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
              roundness: elementStylesToCopyFrom.roundness
                ? canApplyRoundnessTypeToElement(
                    elementStylesToCopyFrom.roundness.type,
                    element,
                  )
                  ? elementStylesToCopyFrom.roundness
                  : getDefaultRoundnessTypeForElement(element)
                : null,
            });

            if (isTextElement(newElement)) {
              const sourceText =
                elementStylesToCopyFrom as ExcalidrawTextElement;
              const fontSize =
                (isTextElement(elementStylesToCopyFrom)
                  ? getBaseFontSize(elementStylesToCopyFrom, copiedElementsMap)
                  : sourceText.fontSize) || DEFAULT_FONT_SIZE;
              const fontFamily = sourceText.fontFamily || DEFAULT_FONT_FAMILY;
              let container = null;
              const containerId = newElement.containerId;
              if (containerId) {
                container =
                  selectedElements.find(
                    (element) => element.id === containerId,
                  ) || null;
              }
              const newTextElement = newElementWith(newElement, {
                ...getBaseFontSizeUpdate(newElement, fontSize, elementsMap),
                fontFamily,
                textAlign: sourceText.textAlign || DEFAULT_TEXT_ALIGN,
                lineHeight: sourceText.lineHeight || getLineHeight(fontFamily),
              });
              newElement = newTextElement;

              if (isStickyNoteBoundText(newTextElement, elementsMap)) {
                // the copied stroke may be transparent; a note's label never is
                newElement = newElementWith(
                  newTextElement,
                  getColorUpdate(
                    newTextElement,
                    "strokeColor",
                    newTextElement.strokeColor,
                    elementsMap,
                  ),
                );
              } else {
                // sticky labels are laid out together with their (possibly
                // also restyled) note in the post-pass below
                redrawTextBoundingBox(newTextElement, container, app.scene);
              }
            }

            if (
              newElement.type === "arrow" &&
              isArrowElement(elementStylesToCopyFrom)
            ) {
              newElement = newElementWith(newElement, {
                startArrowhead: elementStylesToCopyFrom.startArrowhead,
                endArrowhead: elementStylesToCopyFrom.endArrowhead,
              });
            }

            if (isFrameLikeElement(element)) {
              newElement = newElementWith(newElement, {
                roundness: null,
                backgroundColor: "transparent",
              });
            }

            if (isStickyNoteElement(newElement)) {
              newElement = normalizeStickyNote(newElement);
            }

            return newElement;
          }
          return element;
        }),
        elementsMap,
      ),
      new Set(selectedElementIds),
      { prevElementsMap: elementsMap },
    );

    // a restyled note may have grown or shrunk — arrows bound to it follow
    for (const element of nextElements) {
      const prev = elementsMap.get(element.id);
      if (
        isStickyNoteElement(element) &&
        isNonDeletedElement(element) &&
        prev &&
        (prev.height !== element.height ||
          prev.x !== element.x ||
          prev.y !== element.y)
      ) {
        updateBoundElements(element, app.scene);
      }
    }

    return {
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.V,
});
