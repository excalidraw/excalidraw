import {
  isElbowArrow,
  isLinearElement,
  isLineElement,
} from "@excalidraw/element";
import { arrayToMap, invariant } from "@excalidraw/common";

import {
  toggleLinePolygonState,
  CaptureUpdateAction,
} from "@excalidraw/element";

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
      !appState.selectedLinearElement?.isEditing &&
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

    invariant(selectedElement, "No selected element found");
    invariant(
      appState.selectedLinearElement,
      "No selected linear element found",
    );
    invariant(
      selectedElement.id === appState.selectedLinearElement.elementId,
      "Selected element ID and linear editor elementId does not match",
    );

    const selectedLinearElement = {
      ...appState.selectedLinearElement,
      isEditing: !appState.selectedLinearElement.isEditing,
    };

    return {
      appState: {
        ...appState,
        selectedLinearElement,
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

export const actionTogglePolygon = register({
  name: "togglePolygon",
  category: DEFAULT_CATEGORIES.elements,
  icon: polygonIcon,
  keywords: ["loop"],
  label: (elements, appState, app) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
    });

    const allPolygons = !selectedElements.some(
      (element) => !isLineElement(element) || !element.polygon,
    );

    return allPolygons
      ? "labels.polygon.breakPolygon"
      : "labels.polygon.convertToPolygon";
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

    // if one element not a polygon, convert all to polygon
    const nextPolygonState = targetElements.some((element) => !element.polygon);

    const targetElementsMap = arrayToMap(targetElements);

    return {
      elements: elements.map((element) => {
        if (!targetElementsMap.has(element.id) || !isLineElement(element)) {
          return element;
        }

        return newElementWith(element, {
          backgroundColor: nextPolygonState
            ? element.backgroundColor
            : "transparent",
          ...toggleLinePolygonState(element, nextPolygonState),
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
          !element.polygon ||
          element.points.length < 3,
      )
    ) {
      return null;
    }

    const allPolygon = selectedElements.every(
      (element) => isLineElement(element) && element.polygon,
    );

    const label = t(
      allPolygon
        ? "labels.polygon.breakPolygon"
        : "labels.polygon.convertToPolygon",
    );

    return (
      <ButtonIcon
        icon={polygonIcon}
        title={label}
        aria-label={label}
        active={allPolygon}
        onClick={() => updateData(null)}
        style={{ marginLeft: "auto" }}
      />
    );
  },
});
