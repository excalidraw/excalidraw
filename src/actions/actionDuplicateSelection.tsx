import React from "react";
import { KEYS } from "../keys";
import { register } from "./register";
import { ExcalidrawElement } from "../element/types";
import { duplicateElement, getNonDeletedElements } from "../element";
import { isSomeElementSelected } from "../scene";
import { ToolButton } from "../components/ToolButton";
import { clone } from "../components/icons";
import { t } from "../i18n";
import { getShortcutKey } from "../utils";
import { LinearElementEditor } from "../element/linearElementEditor";
import { mutateElement } from "../element/mutateElement";
import {
  selectGroupsForSelectedElements,
  getSelectedGroupForElement,
  getElementsInGroup,
} from "../groups";
import { AppState } from "../types";
import { fixBindingsAfterDuplication } from "../element/binding";
import { ActionResult } from "./types";
import { GRID_SIZE } from "../constants";

export const actionDuplicateSelection = register({
  name: "duplicateSelection",
  perform: (elements, appState) => {
    // duplicate point if selected while editing multi-point element
    if (appState.editingLinearElement) {
      const { activePointIndex, elementId } = appState.editingLinearElement;
      const element = LinearElementEditor.getElement(elementId);
      if (!element || activePointIndex === null) {
        return false;
      }
      const { points } = element;
      const selectedPoint = points[activePointIndex];
      const nextPoint = points[activePointIndex + 1];
      mutateElement(element, {
        points: [
          ...points.slice(0, activePointIndex + 1),
          nextPoint
            ? [
                (selectedPoint[0] + nextPoint[0]) / 2,
                (selectedPoint[1] + nextPoint[1]) / 2,
              ]
            : [selectedPoint[0] + 30, selectedPoint[1] + 30],
          ...points.slice(activePointIndex + 1),
        ],
      });
      return {
        appState: {
          ...appState,
          editingLinearElement: {
            ...appState.editingLinearElement,
            activePointIndex: activePointIndex + 1,
          },
        },
        elements,
        commitToHistory: true,
      };
    }

    return {
      ...duplicateElements(elements, appState),
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.duplicateSelection",
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.D,
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      type="button"
      icon={clone}
      title={`${t("labels.duplicateSelection")} — ${getShortcutKey(
        "CtrlOrCmd+D",
      )}`}
      aria-label={t("labels.duplicateSelection")}
      onClick={() => updateData(null)}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});

const duplicateElements = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): Partial<ActionResult> => {
  const groupIdMap = new Map();
  const newElements: ExcalidrawElement[] = [];
  const oldElements: ExcalidrawElement[] = [];
  const oldIdToDuplicatedId = new Map();

  const duplicateAndOffsetElement = (element: ExcalidrawElement) => {
    const newElement = duplicateElement(
      appState.editingGroupId,
      groupIdMap,
      element,
      {
        x: element.x + GRID_SIZE / 2,
        y: element.y + GRID_SIZE / 2,
      },
    );
    oldIdToDuplicatedId.set(element.id, newElement.id);
    oldElements.push(element);
    newElements.push(newElement);
    return newElement;
  };

  const finalElements: ExcalidrawElement[] = [];

  let index = 0;
  while (index < elements.length) {
    const element = elements[index];
    if (appState.selectedElementIds[element.id]) {
      if (element.groupIds.length) {
        const groupId = getSelectedGroupForElement(appState, element);
        // if group selected, duplicate it atomically
        if (groupId) {
          const groupElements = getElementsInGroup(elements, groupId);
          finalElements.push(
            ...groupElements,
            ...groupElements.map((element) =>
              duplicateAndOffsetElement(element),
            ),
          );
          index = index + groupElements.length;
          continue;
        }
      }
      finalElements.push(element, duplicateAndOffsetElement(element));
    } else {
      finalElements.push(element);
    }
    index++;
  }

  fixBindingsAfterDuplication(finalElements, oldElements, oldIdToDuplicatedId);

  return {
    elements: finalElements,
    appState: selectGroupsForSelectedElements(
      {
        ...appState,
        selectedGroupIds: {},
        selectedElementIds: newElements.reduce((acc, element) => {
          acc[element.id] = true;
          return acc;
        }, {} as any),
      },
      getNonDeletedElements(finalElements),
    ),
  };
};
