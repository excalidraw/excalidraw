import { KEYS, updateActiveTool } from "@excalidraw/common";

import { getNonDeletedElements } from "@excalidraw/element";
import { fixBindingsAfterDeletion } from "@excalidraw/element";
import { LinearElementEditor } from "@excalidraw/element";
import { newElementWith } from "@excalidraw/element";
import { getContainerElement } from "@excalidraw/element";
import {
  isBoundToContainer,
  isElbowArrow,
  isFrameLikeElement,
} from "@excalidraw/element";
import { getFrameChildren } from "@excalidraw/element";

import {
  getElementsInGroup,
  selectGroupsForSelectedElements,
} from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../i18n";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { TrashIcon } from "../components/icons";
import { ToolButton } from "../components/ToolButton";

import { register } from "./register";

import type { AppClassProperties, AppState } from "../types";

const deleteSelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  app: AppClassProperties,
) => {
  const framesToBeDeleted = new Set(
    getSelectedElements(
      elements.filter((el) => isFrameLikeElement(el)),
      appState,
    ).map((el) => el.id),
  );

  const selectedElementIds: Record<ExcalidrawElement["id"], true> = {};

  const elementsMap = app.scene.getNonDeletedElementsMap();

  const processedElements = new Set<ExcalidrawElement["id"]>();

  for (const frameId of framesToBeDeleted) {
    const frameChildren = getFrameChildren(elements, frameId);
    for (const el of frameChildren) {
      if (processedElements.has(el.id)) {
        continue;
      }

      if (isBoundToContainer(el)) {
        const containerElement = getContainerElement(el, elementsMap);
        if (containerElement) {
          selectedElementIds[containerElement.id] = true;
        }
      } else {
        selectedElementIds[el.id] = true;
      }
      processedElements.add(el.id);
    }
  }

  let shouldSelectEditingGroup = true;

  const nextElements = elements.map((el) => {
    if (appState.selectedElementIds[el.id]) {
      const boundElement = isBoundToContainer(el)
        ? getContainerElement(el, elementsMap)
        : null;

      if (el.frameId && framesToBeDeleted.has(el.frameId)) {
        shouldSelectEditingGroup = false;
        selectedElementIds[el.id] = true;
        return el;
      }

      if (
        boundElement?.frameId &&
        framesToBeDeleted.has(boundElement?.frameId)
      ) {
        return el;
      }

      if (el.boundElements) {
        el.boundElements.forEach((candidate) => {
          const bound = app.scene.getNonDeletedElementsMap().get(candidate.id);
          if (bound && isElbowArrow(bound)) {
            app.scene.mutateElement(bound, {
              startBinding:
                el.id === bound.startBinding?.elementId
                  ? null
                  : bound.startBinding,
              endBinding:
                el.id === bound.endBinding?.elementId ? null : bound.endBinding,
            });
          }
        });
      }
      return newElementWith(el, { isDeleted: true });
    }

    // if deleting a frame, remove the children from it and select them
    if (el.frameId && framesToBeDeleted.has(el.frameId)) {
      shouldSelectEditingGroup = false;
      if (!isBoundToContainer(el)) {
        selectedElementIds[el.id] = true;
      }
      return newElementWith(el, { frameId: null });
    }

    if (isBoundToContainer(el) && appState.selectedElementIds[el.containerId]) {
      return newElementWith(el, { isDeleted: true });
    }
    return el;
  });

  let nextEditingGroupId = appState.editingGroupId;

  // select next eligible element in currently editing group or supergroup
  if (shouldSelectEditingGroup && appState.editingGroupId) {
    const elems = getElementsInGroup(
      nextElements,
      appState.editingGroupId,
    ).filter((el) => !el.isDeleted);
    if (elems.length > 1) {
      if (elems[0]) {
        selectedElementIds[elems[0].id] = true;
      }
    } else {
      nextEditingGroupId = null;
      if (elems[0]) {
        selectedElementIds[elems[0].id] = true;
      }

      const lastElementInGroup = elems[0];
      if (lastElementInGroup) {
        const editingGroupIdx = lastElementInGroup.groupIds.findIndex(
          (groupId) => {
            return groupId === appState.editingGroupId;
          },
        );
        const superGroupId = lastElementInGroup.groupIds[editingGroupIdx + 1];
        if (superGroupId) {
          const elems = getElementsInGroup(nextElements, superGroupId).filter(
            (el) => !el.isDeleted,
          );
          if (elems.length > 1) {
            nextEditingGroupId = superGroupId;

            elems.forEach((el) => {
              selectedElementIds[el.id] = true;
            });
          }
        }
      }
    }
  }

  return {
    elements: nextElements,
    appState: {
      ...appState,
      ...selectGroupsForSelectedElements(
        {
          selectedElementIds,
          editingGroupId: nextEditingGroupId,
        },
        nextElements,
        appState,
        null,
      ),
    },
  };
};

const handleGroupEditingState = (
  appState: AppState,
  elements: readonly ExcalidrawElement[],
): AppState => {
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
};

export const actionDeleteSelected = register({
  name: "deleteSelectedElements",
  label: "labels.delete",
  icon: TrashIcon,
  trackEvent: { category: "element", action: "delete" },
  perform: (elements, appState, formData, app) => {
    if (appState.selectedLinearElement?.isEditing) {
      const {
        elementId,
        selectedPointsIndices,
        startBindingElement,
        endBindingElement,
      } = appState.selectedLinearElement;
      const elementsMap = app.scene.getNonDeletedElementsMap();
      const linearElement = LinearElementEditor.getElement(
        elementId,
        elementsMap,
      );
      if (!linearElement) {
        return false;
      }
      // case: no point selected → do nothing, as deleting the whole element
      // is most likely a mistake, where you wanted to delete a specific point
      // but failed to select it (or you thought it's selected, while it was
      // only in a hover state)
      if (selectedPointsIndices == null) {
        return false;
      }

      // case: deleting all points
      if (selectedPointsIndices.length >= linearElement.points.length) {
        const nextElements = elements.map((el) => {
          if (el.id === linearElement.id) {
            return newElementWith(el, { isDeleted: true });
          }
          return el;
        });
        const nextAppState = handleGroupEditingState(appState, nextElements);

        return {
          elements: nextElements,
          appState: {
            ...nextAppState,
            selectedLinearElement: null,
          },
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        };
      }

      // We cannot do this inside `movePoint` because it is also called
      // when deleting the uncommitted point (which hasn't caused any binding)
      const binding = {
        startBindingElement: selectedPointsIndices?.includes(0)
          ? null
          : startBindingElement,
        endBindingElement: selectedPointsIndices?.includes(
          linearElement.points.length - 1,
        )
          ? null
          : endBindingElement,
      };

      LinearElementEditor.deletePoints(
        linearElement,
        app,
        selectedPointsIndices,
      );

      return {
        elements,
        appState: {
          ...appState,
          selectedLinearElement: {
            ...appState.selectedLinearElement,
            ...binding,
            selectedPointsIndices:
              selectedPointsIndices?.[0] > 0
                ? [selectedPointsIndices[0] - 1]
                : [0],
          },
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    }

    let { elements: nextElements, appState: nextAppState } =
      deleteSelectedElements(elements, appState, app);

    fixBindingsAfterDeletion(
      nextElements,
      nextElements.filter((el) => el.isDeleted),
    );

    nextAppState = handleGroupEditingState(nextAppState, nextElements);

    return {
      elements: nextElements,
      appState: {
        ...nextAppState,
        activeTool: updateActiveTool(appState, {
          type: app.defaultSelectionTool,
        }),
        multiElement: null,
        activeEmbeddable: null,
        selectedLinearElement: null,
      },
      captureUpdate: isSomeElementSelected(
        getNonDeletedElements(elements),
        appState,
      )
        ? CaptureUpdateAction.IMMEDIATELY
        : CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event, appState, elements) =>
    (event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE) &&
    !event[KEYS.CTRL_OR_CMD],
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      type="button"
      icon={TrashIcon}
      title={t("labels.delete")}
      aria-label={t("labels.delete")}
      onClick={() => updateData(null)}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});
