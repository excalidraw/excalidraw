import {
  CaptureUpdateAction,
  isLinearElement,
  newElementWith,
} from "@excalidraw/element";
import { restoreLinearElementAnimation } from "@excalidraw/element/linearElementAnimation";

import type { LinearElementAnimation } from "@excalidraw/element/types";

import { register } from "./register";

export const actionChangeLinearAnimation =
  register<LinearElementAnimation | null>({
    name: "changeLinearAnimation",
    label: "labels.animation.title",
    trackEvent: { category: "element" },
    perform: (elements, appState, value) => {
      if (appState.viewModeEnabled) {
        return false;
      }
      const animation = restoreLinearElementAnimation(value);
      return {
        elements: elements.map((element) =>
          appState.selectedElementIds[element.id] &&
          !element.isDeleted &&
          !element.locked &&
          isLinearElement(element)
            ? newElementWith(element, { animation })
            : element,
        ),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    },
  });
