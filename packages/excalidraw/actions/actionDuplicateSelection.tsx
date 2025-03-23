import { ToolButton } from "../components/ToolButton";
import { DuplicateIcon } from "../components/icons";
import { DEFAULT_GRID_SIZE } from "../constants";
import { getNonDeletedElements } from "../element";
import { isBoundToContainer, isLinearElement } from "../element/typeChecks";
import { LinearElementEditor } from "../element/linearElementEditor";
import { selectGroupsForSelectedElements } from "../groups";
import { t } from "../i18n";
import { KEYS } from "../keys";
import { isSomeElementSelected } from "../scene";
import {
  excludeElementsInFramesFromSelection,
  getSelectedElements,
} from "../scene/selection";
import { CaptureUpdateAction } from "../store";
import { arrayToMap, getShortcutKey } from "../utils";

import { syncMovedIndices } from "../fractionalIndex";

import { duplicateElements } from "../element/duplicate";

import { register } from "./register";

import type { ExcalidrawElement } from "../element/types";

export const actionDuplicateSelection = register({
  name: "duplicateSelection",
  label: "labels.duplicateSelection",
  icon: DuplicateIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState, formData, app) => {
    if (appState.selectedElementsAreBeingDragged) {
      return false;
    }

    // duplicate selected point(s) if editing a line
    if (appState.editingLinearElement) {
      // TODO: Invariants should be checked here instead of duplicateSelectedPoints()
      try {
        const newAppState = LinearElementEditor.duplicateSelectedPoints(
          appState,
          app.scene.getNonDeletedElementsMap(),
        );

        return {
          elements,
          appState: newAppState,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        };
      } catch {
        return false;
      }
    }

    let { newElements: duplicatedElements, elementsWithClones: nextElements } =
      duplicateElements({
        type: "in-place",
        elements,
        idsOfElementsToDuplicate: arrayToMap(
          getSelectedElements(elements, appState, {
            includeBoundTextElement: true,
            includeElementsInFrames: true,
          }),
        ),
        appState,
        randomizeSeed: true,
        overrides: (element) => ({
          x: element.x + DEFAULT_GRID_SIZE / 2,
          y: element.y + DEFAULT_GRID_SIZE / 2,
        }),
        reverseOrder: false,
      });

    if (app.props.onDuplicate && nextElements) {
      const mappedElements = app.props.onDuplicate(nextElements, elements);
      if (mappedElements) {
        nextElements = mappedElements;
      }
    }

    return {
      elements: syncMovedIndices(nextElements, arrayToMap(duplicatedElements)),
      appState: {
        ...appState,
        ...updateLinearElementEditors(duplicatedElements),
        ...selectGroupsForSelectedElements(
          {
            editingGroupId: appState.editingGroupId,
            selectedElementIds: excludeElementsInFramesFromSelection(
              duplicatedElements,
            ).reduce((acc: Record<ExcalidrawElement["id"], true>, element) => {
              if (!isBoundToContainer(element)) {
                acc[element.id] = true;
              }
              return acc;
            }, {}),
          },
          getNonDeletedElements(nextElements),
          appState,
          null,
        ),
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.D,
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      type="button"
      icon={DuplicateIcon}
      title={`${t("labels.duplicateSelection")} — ${getShortcutKey(
        "CtrlOrCmd+D",
      )}`}
      aria-label={t("labels.duplicateSelection")}
      onClick={() => updateData(null)}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});

const updateLinearElementEditors = (clonedElements: ExcalidrawElement[]) => {
  const linears = clonedElements.filter(isLinearElement);
  if (linears.length === 1) {
    const linear = linears[0];
    const boundElements = linear.boundElements?.map((def) => def.id) ?? [];
    const onlySingleLinearSelected = clonedElements.every(
      (el) => el.id === linear.id || boundElements.includes(el.id),
    );

    if (onlySingleLinearSelected) {
      return {
        selectedLinearElement: new LinearElementEditor(linear),
      };
    }
  }

  return {
    selectedLinearElement: null,
  };
};
