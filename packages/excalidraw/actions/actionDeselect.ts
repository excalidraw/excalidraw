import {
  getElementsInGroup,
  isSomeElementSelected,
  makeNextSelectedElementIds,
  newElementWith,
  selectGroupsForSelectedElements,
} from "@excalidraw/element";
import { CaptureUpdateAction } from "@excalidraw/element";
import { KEYS, isWritableElement, updateActiveTool } from "@excalidraw/common";

import type { GroupId } from "@excalidraw/element/types";

import { TOGGLE_TOOLS } from "../components/Tools";

import { register } from "./register";

import type { AppClassProperties, AppState } from "../types";

const getNextActiveTool = (
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  if (TOGGLE_TOOLS.includes(appState.activeTool.type)) {
    return updateActiveTool(appState, {
      ...(appState.activeTool.lastActiveTool || {
        type: app.state.preferredSelectionTool.type,
      }),
      lastActiveTool: null,
    });
  }

  return updateActiveTool(appState, {
    type: app.state.preferredSelectionTool.type,
  });
};

const getParentEditingGroupId = (
  appState: Readonly<AppState>,
  app: AppClassProperties,
  selectedElementIds: AppState["selectedElementIds"],
): GroupId | null => {
  if (!appState.editingGroupId) {
    return null;
  }

  const nonDeletedElements = app.scene.getNonDeletedElements();
  const selectedElements = app.scene.getSelectedElements({
    selectedElementIds,
    elements: nonDeletedElements,
  });
  const candidateElements = selectedElements.length
    ? selectedElements
    : getElementsInGroup(nonDeletedElements, appState.editingGroupId);

  for (const element of candidateElements) {
    const editingGroupIndex = element.groupIds.indexOf(appState.editingGroupId);
    if (editingGroupIndex !== -1 && element.groupIds[editingGroupIndex + 1]) {
      return element.groupIds[editingGroupIndex + 1] as GroupId;
    }
  }

  return null;
};

export const actionDeselect = register({
  name: "deselect",
  label: "",
  trackEvent: false,
  perform: (elements, appState, _, app) => {
    const activeTool = getNextActiveTool(appState, app);
    app.cursor.applyForTool(activeTool);

    if (appState.multiElement) {
      return {
        elements: elements.map((element) =>
          element.id === appState.multiElement?.id
            ? newElementWith(element, { isDeleted: true })
            : element,
        ),
        appState: {
          ...appState,
          activeEmbeddable: null,
          activeTool,
          editingGroupId: null,
          newElement: null,
          multiElement: null,
          selectedElementIds: makeNextSelectedElementIds({}, appState),
          selectedGroupIds: {},
          selectedLinearElement: null,
          selectionElement: null,
          showHyperlinkPopup: false,
          suggestedBinding: null,
          hoveredArrowTextAnchor: null,
          frameToHighlight: null,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    }

    if (appState.editingGroupId) {
      const nonDeletedElements = app.scene.getNonDeletedElements();
      const selectedElementIds =
        Object.keys(appState.selectedElementIds).length > 0
          ? appState.selectedElementIds
          : getElementsInGroup(
              nonDeletedElements,
              appState.editingGroupId,
            ).reduce((acc, element) => {
              acc[element.id] = true;
              return acc;
            }, {} as Record<string, true>);

      return {
        appState: {
          ...appState,
          ...selectGroupsForSelectedElements(
            {
              editingGroupId: getParentEditingGroupId(
                appState,
                app,
                selectedElementIds,
              ),
              selectedElementIds,
            },
            nonDeletedElements,
            appState,
            app,
          ),
          activeEmbeddable: null,
          activeTool,
          selectedLinearElement: null,
          selectionElement: null,
          showHyperlinkPopup: false,
          suggestedBinding: null,
          frameToHighlight: null,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    }

    return {
      appState: {
        ...appState,
        activeEmbeddable: null,
        activeTool,
        editingGroupId: null,
        selectedElementIds: makeNextSelectedElementIds({}, appState),
        selectedGroupIds: {},
        selectedLinearElement: null,
        selectionElement: null,
        showHyperlinkPopup: false,
        suggestedBinding: null,
        frameToHighlight: null,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event, appState, _, app) => {
    if (event.key !== KEYS.ESCAPE) {
      return false;
    }

    if (isWritableElement(event.target)) {
      return false;
    }

    const isCancelingMultiElement = appState.multiElement !== null;

    return (
      (isCancelingMultiElement || !appState.newElement) &&
      (isCancelingMultiElement || !appState.selectedLinearElement?.isEditing) &&
      (isCancelingMultiElement ||
        appState.activeEmbeddable !== null ||
        appState.activeTool.type !== app.state.preferredSelectionTool.type ||
        !!appState.editingGroupId ||
        !!appState.selectedLinearElement ||
        isSomeElementSelected(app.scene.getNonDeletedElements(), appState))
    );
  },
});
