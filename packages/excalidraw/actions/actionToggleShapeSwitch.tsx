import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  getSwitchCategoryFromElements,
  shapeSwitchAtom,
} from "../components/ShapeSwitch";
import { editorJotaiStore } from "../editor-jotai";
import { CaptureUpdateAction } from "../store";

import { register } from "./register";

export const actionToggleShapeSwitch = register({
  name: "toggleShapeSwitch",
  label: "labels.shapeSwitch",
  icon: () => null,
  viewMode: true,
  trackEvent: {
    category: "shape_switch",
    action: "toggle",
  },
  keywords: ["change", "switch", "swap"],
  perform(elements, appState, _, app) {
    editorJotaiStore.set(shapeSwitchAtom, {
      type: "panel",
    });

    return {
      appState,
      commitToHistory: false,
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  checked: (appState) => appState.gridModeEnabled,
  predicate: (elements, appState, props) =>
    getSwitchCategoryFromElements(elements as ExcalidrawElement[]) !== null,
});
