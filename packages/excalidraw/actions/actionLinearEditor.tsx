import { LinearElementEditor } from "@excalidraw/element/linearElementEditor";
import {
  isElbowArrow,
  isLinearElement,
  isLineElement,
} from "@excalidraw/element/typeChecks";
import { arrayToMap } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element/store";

import type {
  ExcalidrawLinearElement,
  ExcalidrawLineElement,
} from "@excalidraw/element/types";

import { DEFAULT_CATEGORIES } from "../components/CommandPalette/CommandPalette";
import { ToolButton } from "../components/ToolButton";
import { lineEditorIcon, polygonIcon } from "../components/icons";
import { t } from "../i18n";

import { ButtonIcon } from "../components/ButtonIcon";

import { newElementWith } from "../../element/src/mutateElement";

import { toggleLinePolygonState } from "../../element/src/shapes";

import { register } from "./register";

export const actionToggleLinearEditor = register({
  name: "toggleLinearEditor",
  category: DEFAULT_CATEGORIES.elements,
  label: (elements, appState, app) => {
    const selectedElement = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
    })[0] as ExcalidrawLinearElement | undefined;

    return selectedElement?.type === "arrow"
      ? "labels.lineEditor.editArrow"
      : "labels.lineEditor.edit";
  },
  keywords: ["line"],
  trackEvent: {
    category: "element",
  },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    if (
      !appState.editingLinearElement &&
      selectedElements.length === 1 &&
      isLinearElement(selectedElements[0]) &&
      !isElbowArrow(selectedElements[0])
    ) {
      return true;
    }
    return false;
  },
  perform(elements, appState, _, app) {
    const selectedElement = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: true,
    })[0] as ExcalidrawLinearElement;

    const editingLinearElement =
      appState.editingLinearElement?.elementId === selectedElement.id
        ? null
        : new LinearElementEditor(selectedElement, arrayToMap(elements));
    return {
      appState: {
        ...appState,
        editingLinearElement,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ appState, updateData, app }) => {
    const selectedElement = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
    })[0] as ExcalidrawLinearElement;

    const label = t(
      selectedElement.type === "arrow"
        ? "labels.lineEditor.editArrow"
        : "labels.lineEditor.edit",
    );
    return (
      <ToolButton
        type="button"
        icon={lineEditorIcon}
        title={label}
        aria-label={label}
        onClick={() => updateData(null)}
      />
    );
  },
});

export const actionToggleLoopLock = register({
  name: "toggleLoopLock",
  category: DEFAULT_CATEGORIES.elements,
  label: (elements, appState, app) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
    });

    // Check if all selected elements are locked
    const allLocked =
      selectedElements.length > 0 &&
      selectedElements.every(
        (element) => isLineElement(element) && element.loopLock,
      );

    return allLocked ? "labels.loopLock.unlock" : "labels.loopLock.lock";
  },
  trackEvent: {
    category: "element",
  },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
    });

    return (
      selectedElements.length > 0 &&
      selectedElements.every(
        (element) => isLineElement(element) && element.points.length >= 4,
      )
    );
  },
  perform(elements, appState, _, app) {
    const selectedElements = app.scene.getSelectedElements(appState);

    if (selectedElements.some((element) => !isLineElement(element))) {
      return false;
    }

    const targetElements = selectedElements as ExcalidrawLineElement[];

    // Check if we should lock or unlock based on current state
    // If all elements are locked, unlock all. Otherwise, lock all.
    const allLocked = targetElements.every((element) => element.loopLock);
    const newLoopLockState = !allLocked;

    const targetElementsMap = arrayToMap(targetElements);

    return {
      elements: elements.map((element) => {
        if (!targetElementsMap.has(element.id) || !isLineElement(element)) {
          return element;
        }

        return newElementWith(element, {
          backgroundColor: newLoopLockState
            ? element.backgroundColor
            : "transparent",
          ...toggleLinePolygonState(element, newLoopLockState),
        });
      }),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ appState, updateData, app }) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
    });

    if (
      selectedElements.length === 0 ||
      selectedElements.some(
        (element) =>
          !isLineElement(element) ||
          // only show polygon button if every selected element is already
          // a polygon, effectively showing this button only to allow for
          // disabling the polygon state
          !element.loopLock ||
          element.points.length < 3,
      )
    ) {
      return null;
    }

    // If all are locked, show locked icon. Otherwise show unlocked
    const allLocked = selectedElements.every(
      (element) => isLineElement(element) && element.loopLock,
    );

    const label = t(
      allLocked ? "labels.loopLock.unlock" : "labels.loopLock.lock",
    );

    return (
      <ButtonIcon
        icon={polygonIcon}
        title={label}
        aria-label={label}
        active={allLocked}
        onClick={() => updateData(null)}
        style={{ marginLeft: "auto" }}
      />
    );
  },
});
