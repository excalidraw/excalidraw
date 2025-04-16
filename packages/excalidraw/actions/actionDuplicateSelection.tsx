import {
  DEFAULT_GRID_SIZE,
  KEYS,
  arrayToMap,
  getShortcutKey,
} from "@excalidraw/common";

import { getNonDeletedElements } from "@excalidraw/element";

import {
  isBoundToContainer,
  isLinearElement,
} from "@excalidraw/element/typeChecks";

import { LinearElementEditor } from "@excalidraw/element/linearElementEditor";

import { selectGroupsForSelectedElements } from "@excalidraw/element/groups";

import {
  excludeElementsInFramesFromSelection,
  getSelectedElements,
} from "@excalidraw/element/selection";

import { syncMovedIndices } from "@excalidraw/element/fractionalIndex";

import { duplicateElements } from "@excalidraw/element/duplicate";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { ToolButton } from "../components/ToolButton";
import { DuplicateIcon } from "../components/icons";

import { t } from "../i18n";
import { isSomeElementSelected } from "../scene";
import { CaptureUpdateAction } from "../store";

import { register } from "./register";

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

    let { duplicatedElements, elementsWithDuplicates } = duplicateElements({
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
      overrides: ({ origElement, origIdToDuplicateId }) => {
        const duplicateFrameId =
          origElement.frameId && origIdToDuplicateId.get(origElement.frameId);
        return {
          x: origElement.x + DEFAULT_GRID_SIZE / 2,
          y: origElement.y + DEFAULT_GRID_SIZE / 2,
          frameId: duplicateFrameId ?? origElement.frameId,
        };
      },
    });

    if (app.props.onDuplicate && elementsWithDuplicates) {
      const mappedElements = app.props.onDuplicate(
        elementsWithDuplicates,
        elements,
      );
      if (mappedElements) {
        elementsWithDuplicates = mappedElements;
      }
    }

    return {
      elements: syncMovedIndices(
        elementsWithDuplicates,
        arrayToMap(duplicatedElements),
      ),
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
          getNonDeletedElements(elementsWithDuplicates),
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
