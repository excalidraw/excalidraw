import {
  getStrokeWidthByKey,
  invariant,
  SAVED_PENS_MAX,
  STROKE_WIDTH_KEYS,
} from "@excalidraw/common";

import {
  CaptureUpdateAction,
  isFreeDrawElement,
  newElementWith,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { isSamePen, SavedPens } from "../components/SavedPens/SavedPens";
import { getSelectedElements } from "../scene";

import { changeProperty } from "./actionProperties";
import { register } from "./register";

import type { AppState, SavedPen } from "../types";

type SavedPensUpdate =
  | { type: "save" }
  | { type: "apply"; pen: SavedPen }
  | { type: "remove"; index: number };

/**
 * The style a new pen would be saved with: the first selected freedraw
 * element's (what the styles panel shows), else the current item style.
 */
const getCurrentPen = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): SavedPen => {
  const freedraw = getSelectedElements(elements, appState).find(
    isFreeDrawElement,
  );
  if (!freedraw) {
    return {
      strokeColor: appState.currentItemStrokeColor,
      strokeWidthKey: appState.currentItemStrokeWidthKey,
      opacity: appState.currentItemOpacity,
      strokeVariability: appState.currentItemStrokeVariability,
    };
  }
  return {
    strokeColor: freedraw.strokeColor,
    strokeWidthKey:
      STROKE_WIDTH_KEYS.find(
        (key) => getStrokeWidthByKey("freedraw", key) === freedraw.strokeWidth,
      ) ?? appState.currentItemStrokeWidthKey,
    opacity: freedraw.opacity,
    strokeVariability:
      freedraw.strokeOptions?.variability ??
      appState.currentItemStrokeVariability,
  };
};

export const actionSavedPens = register<SavedPensUpdate>({
  name: "savedPens",
  label: "labels.savedPens",
  trackEvent: false,
  perform: (elements, appState, value) => {
    invariant(value, "actionSavedPens: value must be defined");

    if (value.type === "remove") {
      const removedIndex = value.index;
      return {
        appState: {
          ...appState,
          savedPens: appState.savedPens.filter(
            (_, index) => index !== removedIndex,
          ),
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    if (value.type === "save") {
      const pen = getCurrentPen(elements, appState);
      const canSave =
        appState.savedPens.length < SAVED_PENS_MAX &&
        !appState.savedPens.some((savedPen) => isSamePen(savedPen, pen));
      return {
        appState: canSave
          ? { ...appState, savedPens: [...appState.savedPens, pen] }
          : appState,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const { pen } = value;
    return {
      elements: changeProperty(elements, appState, (el) =>
        isFreeDrawElement(el)
          ? newElementWith(el, {
              strokeColor: pen.strokeColor,
              strokeWidth: getStrokeWidthByKey(el.type, pen.strokeWidthKey),
              opacity: pen.opacity,
              strokeOptions: {
                ...el.strokeOptions,
                variability: pen.strokeVariability,
              },
            })
          : el,
      ),
      appState: {
        ...appState,
        currentItemStrokeColor: pen.strokeColor,
        currentItemStrokeWidthKey: pen.strokeWidthKey,
        currentItemOpacity: pen.opacity,
        currentItemStrokeVariability: pen.strokeVariability,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <SavedPens
      pens={appState.savedPens}
      currentPen={getCurrentPen(elements, app.state)}
      theme={appState.theme}
      onSave={() => updateData({ type: "save" })}
      onApply={(pen) => updateData({ type: "apply", pen })}
      onRemove={(index) => updateData({ type: "remove", index })}
    />
  ),
});
