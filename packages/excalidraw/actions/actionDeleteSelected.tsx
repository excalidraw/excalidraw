import { getSelectedElements, isSomeElementSelected } from "../scene";
import { KEYS } from "../keys";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { register } from "./register";
import { getNonDeletedElements } from "../element";
import type { ExcalidrawElement } from "../element/types";
import type { AppClassProperties, AppState } from "../types";
import { mutateElement, newElementWith } from "../element/mutateElement";
import { getElementsInGroup, selectGroupsForSelectedElements } from "../groups";
import { LinearElementEditor } from "../element/linearElementEditor";
import { fixBindingsAfterDeletion } from "../element/binding";
import {
  isBoundToContainer,
  isElbowArrow,
  isFrameLikeElement,
} from "../element/typeChecks";
import { updateActiveTool } from "../utils";
import { TrashIcon } from "../components/icons";
import { StoreAction } from "../store";
import { getContainerElement } from "../element/textElement";
import { getFrameChildren } from "../frame";

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
            mutateElement(bound, {
              startBinding:
                el.id === bound.startBinding?.elementId
                  ? null
                  : bound.startBinding,
              endBinding:
                el.id === bound.endBinding?.elementId ? null : bound.endBinding,
            });
            mutateElement(bound, { points: bound.points });
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
    if (appState.editingLinearElement) {
      const {
        elementId,
        selectedPointsIndices,
        startBindingElement,
        endBindingElement,
      } = appState.editingLinearElement;
      const elementsMap = app.scene.getNonDeletedElementsMap();
      const element = LinearElementEditor.getElement(elementId, elementsMap);
      if (!element) {
        return false;
      }
      // case: no point selected → do nothing, as deleting the whole element
      // is most likely a mistake, where you wanted to delete a specific point
      // but failed to select it (or you thought it's selected, while it was
      // only in a hover state)
      if (selectedPointsIndices == null) {
        return false;
      }

      // case: deleting last remaining point
      if (element.points.length < 2) {
        const nextElements = elements.map((el) => {
          if (el.id === element.id) {
            return newElementWith(el, { isDeleted: true });
          }
          return el;
        });
        const nextAppState = handleGroupEditingState(appState, nextElements);

        return {
          elements: nextElements,
          appState: {
            ...nextAppState,
            editingLinearElement: null,
          },
          storeAction: StoreAction.CAPTURE,
        };
      }

      // We cannot do this inside `movePoint` because it is also called
      // when deleting the uncommitted point (which hasn't caused any binding)
      const binding = {
        startBindingElement: selectedPointsIndices?.includes(0)
          ? null
          : startBindingElement,
        endBindingElement: selectedPointsIndices?.includes(
          element.points.length - 1,
        )
          ? null
          : endBindingElement,
      };

      LinearElementEditor.deletePoints(element, selectedPointsIndices);

      return {
        elements,
        appState: {
          ...appState,
          editingLinearElement: {
            ...appState.editingLinearElement,
            ...binding,
            selectedPointsIndices:
              selectedPointsIndices?.[0] > 0
                ? [selectedPointsIndices[0] - 1]
                : [0],
          },
        },
        storeAction: StoreAction.CAPTURE,
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
        activeTool: updateActiveTool(appState, { type: "selection" }),
        multiElement: null,
        activeEmbeddable: null,
      },
      storeAction: isSomeElementSelected(
        getNonDeletedElements(elements),
        appState,
      )
        ? StoreAction.CAPTURE
        : StoreAction.NONE,
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
