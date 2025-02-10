import { KEYS } from "../keys";
import { register } from "./register";
import type { ExcalidrawElement } from "../element/types";
import { duplicateElement, getNonDeletedElements } from "../element";
import { isSomeElementSelected } from "../scene";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import {
  arrayToMap,
  castArray,
  findLastIndex,
  getShortcutKey,
  invariant,
} from "../utils";
import { LinearElementEditor } from "../element/linearElementEditor";
import {
  selectGroupsForSelectedElements,
  getSelectedGroupForElement,
  getElementsInGroup,
} from "../groups";
import type { AppState } from "../types";
import { fixBindingsAfterDuplication } from "../element/binding";
import type { ActionResult } from "./types";
import { DEFAULT_GRID_SIZE } from "../constants";
import {
  bindTextToShapeAfterDuplication,
  getBoundTextElement,
  getContainerElement,
} from "../element/textElement";
import {
  hasBoundTextElement,
  isBoundToContainer,
  isFrameLikeElement,
} from "../element/typeChecks";
import { normalizeElementOrder } from "../element/sortElements";
import { DuplicateIcon } from "../components/icons";
import {
  bindElementsToFramesAfterDuplication,
  getFrameChildren,
} from "../frame";
import {
  excludeElementsInFramesFromSelection,
  getSelectedElements,
} from "../scene/selection";
import { StoreAction } from "../store";

export const actionDuplicateSelection = register({
  name: "duplicateSelection",
  label: "labels.duplicateSelection",
  icon: DuplicateIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState, formData, app) => {
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
          storeAction: StoreAction.CAPTURE,
        };
      } catch {
        return false;
      }
    }

    const nextState = duplicateElements(elements, appState);

    if (app.props.onDuplicate && nextState.elements) {
      const mappedElements = app.props.onDuplicate(
        nextState.elements,
        elements,
      );
      if (mappedElements) {
        nextState.elements = mappedElements;
      }
    }

    return {
      ...nextState,
      storeAction: StoreAction.CAPTURE,
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

const duplicateElements = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): Partial<Exclude<ActionResult, false>> => {
  // ---------------------------------------------------------------------------

  const groupIdMap = new Map();
  const newElements: ExcalidrawElement[] = [];
  const oldElements: ExcalidrawElement[] = [];
  const oldIdToDuplicatedId = new Map();
  const duplicatedElementsMap = new Map<string, ExcalidrawElement>();

  const elementsMap = arrayToMap(elements);

  const duplicateAndOffsetElement = <
    T extends ExcalidrawElement | ExcalidrawElement[],
  >(
    element: T,
  ): T extends ExcalidrawElement[]
    ? ExcalidrawElement[]
    : ExcalidrawElement | null => {
    const elements = castArray(element);

    const _newElements = elements.reduce(
      (acc: ExcalidrawElement[], element) => {
        if (processedIds.has(element.id)) {
          return acc;
        }

        processedIds.set(element.id, true);

        const newElement = duplicateElement(
          appState.editingGroupId,
          groupIdMap,
          element,
          {
            x: element.x + DEFAULT_GRID_SIZE / 2,
            y: element.y + DEFAULT_GRID_SIZE / 2,
          },
        );

        processedIds.set(newElement.id, true);

        duplicatedElementsMap.set(newElement.id, newElement);
        oldIdToDuplicatedId.set(element.id, newElement.id);

        oldElements.push(element);
        newElements.push(newElement);

        acc.push(newElement);
        return acc;
      },
      [],
    );

    return (
      Array.isArray(element) ? _newElements : _newElements[0] || null
    ) as T extends ExcalidrawElement[]
      ? ExcalidrawElement[]
      : ExcalidrawElement | null;
  };

  elements = normalizeElementOrder(elements);

  const idsOfElementsToDuplicate = arrayToMap(
    getSelectedElements(elements, appState, {
      includeBoundTextElement: true,
      includeElementsInFrames: true,
    }),
  );

  // Ids of elements that have already been processed so we don't push them
  // into the array twice if we end up backtracking when retrieving
  // discontiguous group of elements (can happen due to a bug, or in edge
  // cases such as a group containing deleted elements which were not selected).
  //
  // This is not enough to prevent duplicates, so we do a second loop afterwards
  // to remove them.
  //
  // For convenience we mark even the newly created ones even though we don't
  // loop over them.
  const processedIds = new Map<ExcalidrawElement["id"], true>();

  const elementsWithClones: ExcalidrawElement[] = elements.slice();

  const insertAfterIndex = (
    index: number,
    elements: ExcalidrawElement | null | ExcalidrawElement[],
  ) => {
    invariant(index !== -1, "targetIndex === -1 ");

    if (!Array.isArray(elements) && !elements) {
      return;
    }

    elementsWithClones.splice(index + 1, 0, ...castArray(elements));
  };

  const frameIdsToDuplicate = new Set(
    elements
      .filter(
        (el) => idsOfElementsToDuplicate.has(el.id) && isFrameLikeElement(el),
      )
      .map((el) => el.id),
  );

  for (const element of elements) {
    if (processedIds.has(element.id)) {
      continue;
    }

    if (!idsOfElementsToDuplicate.has(element.id)) {
      continue;
    }

    // groups
    // -------------------------------------------------------------------------

    const groupId = getSelectedGroupForElement(appState, element);
    if (groupId) {
      const groupElements = getElementsInGroup(elements, groupId).flatMap(
        (element) =>
          isFrameLikeElement(element)
            ? [...getFrameChildren(elements, element.id), element]
            : [element],
      );

      const targetIndex = findLastIndex(elementsWithClones, (el) => {
        return el.groupIds?.includes(groupId);
      });

      insertAfterIndex(targetIndex, duplicateAndOffsetElement(groupElements));
      continue;
    }

    // frame duplication
    // -------------------------------------------------------------------------

    if (element.frameId && frameIdsToDuplicate.has(element.frameId)) {
      continue;
    }

    if (isFrameLikeElement(element)) {
      const frameId = element.id;

      const frameChildren = getFrameChildren(elements, frameId);

      const targetIndex = findLastIndex(elementsWithClones, (el) => {
        return el.frameId === frameId || el.id === frameId;
      });

      insertAfterIndex(
        targetIndex,
        duplicateAndOffsetElement([...frameChildren, element]),
      );
      continue;
    }

    // text container
    // -------------------------------------------------------------------------

    if (hasBoundTextElement(element)) {
      const boundTextElement = getBoundTextElement(element, elementsMap);

      const targetIndex = findLastIndex(elementsWithClones, (el) => {
        return (
          el.id === element.id ||
          ("containerId" in el && el.containerId === element.id)
        );
      });

      if (boundTextElement) {
        insertAfterIndex(
          targetIndex,
          duplicateAndOffsetElement([element, boundTextElement]),
        );
      } else {
        insertAfterIndex(targetIndex, duplicateAndOffsetElement(element));
      }

      continue;
    }

    if (isBoundToContainer(element)) {
      const container = getContainerElement(element, elementsMap);

      const targetIndex = findLastIndex(elementsWithClones, (el) => {
        return el.id === element.id || el.id === container?.id;
      });

      if (container) {
        insertAfterIndex(
          targetIndex,
          duplicateAndOffsetElement([container, element]),
        );
      } else {
        insertAfterIndex(targetIndex, duplicateAndOffsetElement(element));
      }

      continue;
    }

    // default duplication (regular elements)
    // -------------------------------------------------------------------------

    insertAfterIndex(
      findLastIndex(elementsWithClones, (el) => el.id === element.id),
      duplicateAndOffsetElement(element),
    );
  }

  // ---------------------------------------------------------------------------

  bindTextToShapeAfterDuplication(
    elementsWithClones,
    oldElements,
    oldIdToDuplicatedId,
  );
  fixBindingsAfterDuplication(
    elementsWithClones,
    oldElements,
    oldIdToDuplicatedId,
  );
  bindElementsToFramesAfterDuplication(
    elementsWithClones,
    oldElements,
    oldIdToDuplicatedId,
  );

  const nextElementsToSelect =
    excludeElementsInFramesFromSelection(newElements);

  return {
    elements: elementsWithClones,
    appState: {
      ...appState,
      ...selectGroupsForSelectedElements(
        {
          editingGroupId: appState.editingGroupId,
          selectedElementIds: nextElementsToSelect.reduce(
            (acc: Record<ExcalidrawElement["id"], true>, element) => {
              if (!isBoundToContainer(element)) {
                acc[element.id] = true;
              }
              return acc;
            },
            {},
          ),
        },
        getNonDeletedElements(elementsWithClones),
        appState,
        null,
      ),
    },
  };
};
