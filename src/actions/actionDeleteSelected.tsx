import { isSomeElementSelected } from "../scene";
import { KEYS } from "../keys";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { register } from "./register";
import { getNonDeletedElements } from "../element";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { newElementWith } from "../element/mutateElement";
import { getElementsInGroup } from "../groups";
import { LinearElementEditor } from "../element/linearElementEditor";
import { fixBindingsAfterDeletion } from "../element/binding";
import { isBoundToContainer } from "../element/typeChecks";
import { updateActiveTool } from "../utils";

const deleteSelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  return {
    elements: elements.map((el) => {
      if (appState.selectedElementIds[el.id]) {
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
  trackEvent: { category: "element", action: "delete" },
  perform: (elements, appState) => {
    if (appState.editingLinearElement) {
      const {
        elementId,
        selectedPointsIndices,
        startBindingElement,
        endBindingElement,
      } = appState.editingLinearElement;
      const element = LinearElementEditor.getElement(elementId);
      if (!element) {
        return false;
      }
      if (
        // case: no point selected → delete whole element
        selectedPointsIndices == null ||
        // case: deleting last remaining point
        element.points.length < 2
      ) {
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
        commitToHistory: true,
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
      },
      commitToHistory: isSomeElementSelected(
        getNonDeletedElements(elements),
        appState,
      ),
    };
  },
  contextItemLabel: "labels.delete",
  keyTest: (event) => event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE,
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      type="button"
      icon={
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M2.667 4.667h10.666M6.667 7.333v4M9.333 7.333v4M3.333 4.667l.667 8A1.333 1.333 0 0 0 5.333 14h5.334A1.333 1.333 0 0 0 12 12.667l.667-8M6 4.667v-2A.667.667 0 0 1 6.667 2h2.666a.667.667 0 0 1 .667.667v2"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      }
      title={t("labels.delete")}
      aria-label={t("labels.delete")}
      onClick={() => updateData(null)}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});
