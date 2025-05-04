import { LinearElementEditor } from "@excalidraw/element/linearElementEditor";
import {
  isElbowArrow,
  isLinearElement,
  isLineElement,
} from "@excalidraw/element/typeChecks";
import { arrayToMap } from "@excalidraw/common";
import { MIN_LOOP_LOCK_DISTANCE } from "@excalidraw/common";

import { pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawLinearElement,
  ExcalidrawLineElement,
} from "@excalidraw/element/types";

import { DEFAULT_CATEGORIES } from "../components/CommandPalette/CommandPalette";
import { ToolButton } from "../components/ToolButton";
import {
  lineEditorIcon,
  LoopUnlockedIcon,
  LoopLockedIcon,
} from "../components/icons";
import { t } from "../i18n";
import { CaptureUpdateAction } from "../store";

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

const updateLoopLock = (
  element: ExcalidrawLineElement,
  newLoopLockState: boolean,
  app: any,
) => {
  const updatedPoints = [...element.points];

  if (newLoopLockState) {
    const firstPoint = updatedPoints[0];
    const lastPoint = updatedPoints[updatedPoints.length - 1];

    const distance = Math.hypot(
      firstPoint[0] - lastPoint[0],
      firstPoint[1] - lastPoint[1],
    );

    if (distance > MIN_LOOP_LOCK_DISTANCE) {
      updatedPoints.push(pointFrom(firstPoint[0], firstPoint[1]));
    } else {
      updatedPoints[updatedPoints.length - 1] = pointFrom(
        firstPoint[0],
        firstPoint[1],
      );
    }
  }

  app.scene.mutateElement(element, {
    loopLock: newLoopLockState,
    points: updatedPoints,
  });
};

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
    const selectedElements = app.scene
      .getSelectedElements({
        selectedElementIds: appState.selectedElementIds,
      })
      .filter((element) => isLineElement(element)) as ExcalidrawLineElement[];

    if (!selectedElements.length) {
      return false;
    }

    // Check if we should lock or unlock based on current state
    // If all elements are locked, unlock all. Otherwise, lock all.
    const allLocked = selectedElements.every((element) => element.loopLock);
    const newLoopLockState = !allLocked;

    selectedElements.forEach((element) => {
      updateLoopLock(element, newLoopLockState, app);
    });

    return {
      appState,
      elements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ appState, updateData, app }) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
    });

    if (
      selectedElements.length === 0 ||
      !selectedElements.every(
        (element) => isLineElement(element) && element.points.length >= 4,
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
      <ToolButton
        type="button"
        icon={allLocked ? LoopLockedIcon : LoopUnlockedIcon}
        title={label}
        aria-label={label}
        onClick={() => updateData(null)}
      />
    );
  },
});
