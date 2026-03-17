import { getNonDeletedElements } from "@excalidraw/element";

import {
  newElementWith,
  deepCopyElement,
  bumpVersion,
} from "@excalidraw/element";

import { getBoundTextElement } from "@excalidraw/element";

import { selectGroup, addToGroup } from "@excalidraw/element";

import { syncMovedIndices } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import { KEYS, randomId, randomInteger, arrayToMap } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

import { ToolButton } from "../components/ToolButton";
import { StackToScaleIcon } from "../components/icons";
import { t } from "../i18n";
import { isSomeElementSelected } from "../scene";
import { getShortcutKey } from "../shortcut";
import { register } from "./register";

import type { AppClassProperties, AppState } from "../types";

// px offset per copy — creates the "stacked cards" depth effect
const STACK_OFFSETS = [
  { dx: -8, dy: -8 },
  { dx: -16, dy: -16 },
];

const STACKABLE_TYPES = new Set(["rectangle", "diamond", "ellipse"]);

// shared between perform/predicate/PanelComponent
const getStackableElement = (
  appState: AppState,
  app: AppClassProperties,
): ExcalidrawElement | null => {
  const selected = app.scene.getSelectedElements({
    selectedElementIds: appState.selectedElementIds,
    includeBoundTextElement: false,
  });

  if (selected.length !== 1 || !STACKABLE_TYPES.has(selected[0].type)) {
    return null;
  }

  return selected[0];
};

export const actionStackToScale = register({
  name: "stackToScale",
  label: "labels.stackToScale",
  icon: StackToScaleIcon,
  trackEvent: { category: "element" },

  perform: (elements, appState, _, app) => {
    const el = getStackableElement(appState, app);
    if (!el) {
      return false;
    }

    const elementsMap = arrayToMap(elements);
    const boundText = getBoundTextElement(el, elementsMap);
    const groupId = randomId();
    let nextElements = [...elements];
    const copies: ExcalidrawElement[] = [];

    for (const { dx, dy } of STACK_OFFSETS) {
      const copy = deepCopyElement(el);
      copy.id = randomId();
      copy.seed = randomInteger();
      copy.x = el.x + dx;
      copy.y = el.y + dy;
      copy.groupIds = [groupId];
      copy.boundElements = []; // strip text — only the front element keeps its label
      bumpVersion(copy);
      copies.push(copy);
    }

    // splice copies before the original so they sit behind it in z-order
    // (later index = rendered on top)
    const idx = nextElements.findIndex((e) => e.id === el.id);
    nextElements.splice(
      idx,
      0,
      ...(copies.reverse() as OrderedExcalidrawElement[]),
    );

    // tag the original (+ its bound text if any) with the new group id;
    // the copies already got it during creation
    const needsGroup = new Set([el.id, ...(boundText ? [boundText.id] : [])]);
    nextElements = nextElements.map((e) =>
      needsGroup.has(e.id)
        ? newElementWith(e, {
            groupIds: addToGroup(
              e.groupIds,
              groupId,
              appState.editingGroupId,
            ),
          })
        : e,
    );

    // keep fractional indices in sync after the splice
    const touched = new Set([
      ...copies.map((c) => c.id),
      el.id,
      ...(boundText ? [boundText.id] : []),
    ]);
    const reorderedElements = syncMovedIndices(
      nextElements,
      arrayToMap(nextElements.filter((e) => touched.has(e.id))),
    );

    return {
      appState: {
        ...appState,
        ...selectGroup(
          groupId,
          { ...appState, selectedGroupIds: {} },
          getNonDeletedElements(reorderedElements),
        ),
      },
      elements: reorderedElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },

  predicate: (_elements, appState, _, app) =>
    getStackableElement(appState, app) !== null,

  keyTest: (event) =>
    !event.shiftKey && event[KEYS.CTRL_OR_CMD] && event.key === KEYS.J,

  PanelComponent: ({ elements, appState, updateData, app }) => (
    <ToolButton
      hidden={!getStackableElement(appState, app)}
      type="button"
      icon={StackToScaleIcon}
      onClick={() => updateData(null)}
      title={`${t("labels.stackToScale")} — ${getShortcutKey("CtrlOrCmd+J")}`}
      aria-label={t("labels.stackToScale")}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});
