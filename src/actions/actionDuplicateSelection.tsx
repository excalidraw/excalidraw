import { KEYS } from "../keys";
import { register } from "./register";
import { ExcalidrawElement } from "../element/types";
import { duplicateElement, getNonDeletedElements } from "../element";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { arrayToMap, getShortcutKey } from "../utils";
import { LinearElementEditor } from "../element/linearElementEditor";
import {
  selectGroupsForSelectedElements,
  getSelectedGroupForElement,
  getElementsInGroup,
} from "../groups";
import { AppState } from "../types";
import { fixBindingsAfterDuplication } from "../element/binding";
import { ActionResult } from "./types";
import { GRID_SIZE } from "../constants";
import {
  bindTextToShapeAfterDuplication,
  getBoundTextElement,
} from "../element/textElement";
import { isBoundToContainer } from "../element/typeChecks";
import { normalizeElementOrder } from "../element/sortElements";
import { DuplicateIcon } from "../components/icons";

export const actionDuplicateSelection = register({
  name: "duplicateSelection",
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    // duplicate selected point(s) if editing a line
    if (appState.editingLinearElement) {
      const ret = LinearElementEditor.duplicateSelectedPoints(appState);

      if (!ret) {
        return false;
      }

      return {
        elements,
        appState: ret.appState,
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
): Partial<ActionResult> => {
  // ---------------------------------------------------------------------------

  // step (1)

  const sortedElements = normalizeElementOrder(elements);
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

  const selectedElementIds = arrayToMap(
    getSelectedElements(sortedElements, appState, true),
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

  const markAsProcessed = (elements: ExcalidrawElement[]) => {
    for (const element of elements) {
      processedIds.set(element.id, true);
    }
    return elements;
  };

  const elementsWithClones: ExcalidrawElement[] = [];

  let index = -1;

  while (++index < sortedElements.length) {
    const element = sortedElements[index];

    if (processedIds.get(element.id)) {
      continue;
    }

    const boundTextElement = getBoundTextElement(element);
    if (selectedElementIds.get(element.id)) {
      // if a group or a container/bound-text, duplicate atomically
      if (element.groupIds.length || boundTextElement) {
        const groupId = getSelectedGroupForElement(appState, element);
        if (groupId) {
          const groupElements = getElementsInGroup(sortedElements, groupId);
          elementsWithClones.push(
            ...markAsProcessed([
              ...groupElements,
              ...groupElements.map((element) =>
                duplicateAndOffsetElement(element),
              ),
            ]),
          );
          continue;
        }
        if (boundTextElement) {
          elementsWithClones.push(
            ...markAsProcessed([
              element,
              boundTextElement,
              duplicateAndOffsetElement(element),
              duplicateAndOffsetElement(boundTextElement),
            ]),
          );
          continue;
        }
      }
      elementsWithClones.push(
        ...markAsProcessed([element, duplicateAndOffsetElement(element)]),
      );
    } else {
      elementsWithClones.push(...markAsProcessed([element]));
    }
  }

  // step (2)

  // second pass to remove duplicates. We loop from the end as it's likelier
  // that the last elements are in the correct order (contiguous or otherwise).
  // Thus we need to reverse as the last step (3).

  const finalElementsReversed: ExcalidrawElement[] = [];

  const finalElementIds = new Map<ExcalidrawElement["id"], true>();
  index = elementsWithClones.length;

  while (--index >= 0) {
    const element = elementsWithClones[index];
    if (!finalElementIds.get(element.id)) {
      finalElementIds.set(element.id, true);
      finalElementsReversed.push(element);
    }
  }

  // step (3)

  const finalElements = finalElementsReversed.reverse();

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

  return {
    elements: finalElements,
    appState: selectGroupsForSelectedElements(
      {
        ...appState,
        selectedGroupIds: {},
        selectedElementIds: newElements.reduce(
          (acc: Record<ExcalidrawElement["id"], true>, element) => {
            if (!isBoundToContainer(element)) {
              acc[element.id] = true;
            }
            return acc;
          },
          {},
        ),
      },
      getNonDeletedElements(finalElements),
    ),
  };
};
