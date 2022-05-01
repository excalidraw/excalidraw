import { KEYS } from "../keys";
import { register } from "./register";
import { ExcalidrawElement } from "../element/types";
import { duplicateElement, getNonDeletedElements } from "../element";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { ToolButton } from "../components/ToolButton";
import { clone } from "../components/icons";
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
import { sortBoundTextElementsAndContainersTogether } from "../element/sortElements";

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
  const sortedElements = sortBoundTextElementsAndContainersTogether(elements);
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
  const selectedElementIds = arrayToMap(
    getSelectedElements(sortedElements, appState, true),
  );
  while (index < sortedElements.length) {
    const element = sortedElements[index];
    const boundTextElement = getBoundTextElement(element);
    if (selectedElementIds.get(element.id)) {
      if (element.groupIds.length || boundTextElement) {
        const groupId = getSelectedGroupForElement(appState, element);
        // if group selected, duplicate it atomically
        if (groupId) {
          const groupElements = getElementsInGroup(sortedElements, groupId);
          finalElements.push(
            ...groupElements,
            ...groupElements.map((element) =>
              duplicateAndOffsetElement(element),
            ),
          );
          index = index + groupElements.length;
          continue;
        }
        // If container + bounding text(s), interweave z-index-wise
        if (boundTextElement) {
          finalElements.push(
            element,
            boundTextElement,
            duplicateAndOffsetElement(element),
            duplicateAndOffsetElement(boundTextElement),
          );
          // if multiple text elements can be bound to a container
          // change 2 to boundTextElements.length
          index = index + 2;
          continue;
        }
      }
      finalElements.push(element, duplicateAndOffsetElement(element));
    } else {
      finalElements.push(element);
    }
    index++;
  }
  bindTextToShapeAfterDuplication(
    finalElements,
    oldElements,
    oldIdToDuplicatedId,
  );
  fixBindingsAfterDuplication(finalElements, oldElements, oldIdToDuplicatedId);

  return {
    elements: finalElements,
    appState: selectGroupsForSelectedElements(
      {
        ...appState,
        selectedGroupIds: {},
        selectedElementIds: newElements.reduce((acc, element) => {
          if (!isBoundToContainer(element)) {
            acc[element.id] = true;
          }
          return acc;
        }, {} as any),
      },
      getNonDeletedElements(finalElements),
    ),
  };
};
