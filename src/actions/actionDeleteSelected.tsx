import { isSomeElementSelected } from "../scene";
import { KEYS } from "../keys";
import { ToolButton } from "../components/ToolButton";
import React from "react";
import { trash } from "../components/icons";
import { t } from "../i18n";
import { register } from "./register";
import { getNonDeletedElements } from "../element";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { newElementWith } from "../element/mutateElement";
import { getElementsInGroup } from "../groups";
import { LinearElementEditor } from "../element/linearElementEditor";

const deleteSelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  return {
    elements: elements.map((el) => {
      if (appState.selectedElementIds[el.id]) {
        return newElementWith(el, { isDeleted: true });
      }
      return el;
    }),
    appState: {
      ...appState,
      selectedElementIds: {},
    },
  };
};

function handleGroupEditingState(
  appState: AppState,
  elements: readonly ExcalidrawElement[],
): AppState {
  if (appState.editingGroupId) {
    const siblingElements = getElementsInGroup(
      getNonDeletedElements(elements),
      appState.editingGroupId!,
    );
    if (siblingElements.length) {
      return {
        ...appState,
        selectedElementIds: { [siblingElements[0].id]: true },
      };
    }
  }
  return appState;
}

export const actionDeleteSelected = register({
  name: "deleteSelectedElements",
  perform: (elements, appState) => {
    if (
      appState.editingLinearElement?.activePointIndex != null &&
      appState.editingLinearElement?.activePointIndex > -1
    ) {
      const { elementId } = appState.editingLinearElement;
      const element = LinearElementEditor.getElement(elementId);
      if (element) {
        // case: deleting last point
        if (element.points.length < 2) {
          const nextElements = elements.filter((el) => el.id !== element.id);
          const nextAppState = handleGroupEditingState(appState, nextElements);

          return {
            elements: nextElements,
            appState: {
              ...nextAppState,
              editingLinearElement: null,
            },
            commitToHistory: false,
          };
        }

        LinearElementEditor.movePoint(
          element,
          appState.editingLinearElement.activePointIndex,
          "delete",
        );

        return {
          elements: elements,
          appState: {
            ...appState,
            editingLinearElement: {
              ...appState.editingLinearElement,
              activePointIndex:
                appState.editingLinearElement.activePointIndex > 0
                  ? appState.editingLinearElement.activePointIndex - 1
                  : 0,
            },
          },
          commitToHistory: true,
        };
      }
    }

    let {
      elements: nextElements,
      appState: nextAppState,
    } = deleteSelectedElements(elements, appState);

    nextAppState = handleGroupEditingState(nextAppState, nextElements);

    return {
      elements: nextElements,
      appState: {
        ...nextAppState,
        elementType: "selection",
        multiElement: null,
      },
      commitToHistory: isSomeElementSelected(
        getNonDeletedElements(elements),
        appState,
      ),
    };
  },
  contextItemLabel: "labels.delete",
  contextMenuOrder: 3,
  keyTest: (event) => event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE,
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      type="button"
      icon={trash}
      title={t("labels.delete")}
      aria-label={t("labels.delete")}
      onClick={() => updateData(null)}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});
