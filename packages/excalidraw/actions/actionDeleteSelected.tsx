import { getSelectedElements, isSomeElementSelected } from "../scene";
import { KEYS } from "../keys";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { register } from "./register";
import { getNonDeletedElements } from "../element";
import type { ExcalidrawElement } from "../element/types";
import type { AppState } from "../types";
import { newElementWith } from "../element/mutateElement";
import { getElementsInGroup } from "../groups";
import { LinearElementEditor } from "../element/linearElementEditor";
import { fixBindingsAfterDeletion } from "../element/binding";
import { isBoundToContainer, isFrameLikeElement } from "../element/typeChecks";
import { updateActiveTool } from "../utils";
import { TrashIcon } from "../components/icons";
import { StoreAction } from "../store";

const deleteSelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const framesToBeDeleted = new Set(
    getSelectedElements(
      elements.filter((el) => isFrameLikeElement(el)),
      appState,
    ).map((el) => el.id),
  );

  return {
    elements: elements.map((el) => {
      if (appState.selectedElementIds[el.id]) {
        return newElementWith(el, { isDeleted: true });
      }

      if (el.frameId && framesToBeDeleted.has(el.frameId)) {
        return newElementWith(el, { isDeleted: true });
      }

      if (
        isBoundToContainer(el) &&
        appState.selectedElementIds[el.containerId]
      ) {
        return newElementWith(el, { isDeleted: true });
      }
      return el;
    }),
    appState: {
      ...appState,
      selectedElementIds: {},
      selectedGroupIds: {},
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
      deleteSelectedElements(elements, appState);
    fixBindingsAfterDeletion(
      nextElements,
      elements.filter(({ id }) => appState.selectedElementIds[id]),
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
