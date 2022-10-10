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
import { bindTextToShapeAfterDuplication } from "../element/textElement";
import { isBoundToContainer } from "../element/typeChecks";

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
      icon={
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 5.333H6.667c-.737 0-1.334.597-1.334 1.334V12c0 .736.597 1.333 1.334 1.333H12c.736 0 1.333-.597 1.333-1.333V6.667c0-.737-.597-1.334-1.333-1.334Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10.667 5.333V4a1.333 1.333 0 0 0-1.334-1.333H4A1.333 1.333 0 0 0 2.667 4v5.333A1.333 1.333 0 0 0 4 10.667h1.333"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      }
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
    getSelectedElements(elements, appState, true),
  );
  while (index < elements.length) {
    const element = elements[index];
    if (selectedElementIds.get(element.id)) {
      if (element.groupIds.length) {
        const groupId = getSelectedGroupForElement(appState, element);
        // if group selected, duplicate it atomically
        if (groupId) {
          const groupElements = getElementsInGroup(elements, groupId);
          finalElements.push(
            ...groupElements,
            ...groupElements.map((element) =>
              duplicateAndOffsetElement(element),
            ),
          );
          index = index + groupElements.length;
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
