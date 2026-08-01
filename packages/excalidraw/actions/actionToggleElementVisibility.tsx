import { arrayToMap } from "@excalidraw/common";
import {
  newElementWith,
  CaptureUpdateAction,
} from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import { register } from "./register";
import { getSelectedElements } from "../scene";

export const EyeIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    role="img"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="excalidraw-icon"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeClosedIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    role="img"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="excalidraw-icon"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const shouldHideElements = (elements: readonly ExcalidrawElement[]) =>
  elements.some((el) => el.isVisible !== false);

export const actionToggleElementVisibility = register({
  name: "toggleElementVisibility",
  label: (elements, appState, app) => {
    const selected = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: false,
    });

    return shouldHideElements(selected)
      ? "labels.elementVisibility.hide"
      : "labels.elementVisibility.show";
  },
  icon: (appState, elements) => {
    const selectedElements = getSelectedElements(elements, appState);
    return shouldHideElements(selectedElements) ? EyeClosedIcon : EyeIcon;
  },
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    return selectedElements.length > 0;
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: true,
      includeElementsInFrames: true,
    });

    if (!selectedElements.length) {
      return false;
    }

    const hide = shouldHideElements(selectedElements);
    const selectedElementsMap = arrayToMap(selectedElements);

    const nextElements = elements.map((element) => {
      if (!selectedElementsMap.has(element.id)) {
        return element;
      }

      return newElementWith(element, {
        isVisible: !hide,
      });
    });

    return {
      elements: nextElements,
      appState: {
        ...appState,
        selectedElementIds: hide ? {} : appState.selectedElementIds,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    (event.metaKey || event.ctrlKey) && event.shiftKey && event.code === "KeyH",
});
