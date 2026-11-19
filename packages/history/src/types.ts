import type { LinearElementEditor } from "@excalidraw/element";

import type {
  ElementsState,
  SceneElementsMap,
} from "@excalidraw/element/types";

/**
 * The part of the editor state the store and history read and write.
 * The editor's `AppState` (`@excalidraw/excalidraw/types`) extends it.
 */
export type HistoryAppState = Pick<
  ElementsState,
  | "viewBackgroundColor"
  | "editingGroupId"
  | "selectedElementIds"
  | "selectedGroupIds"
  | "selectedLinearElement"
  | "croppingElementId"
> & {
  name: string | null;
  /** the id of the locked element or group hit on pointer down, if any */
  activeLockedId: string | null;
  /** locked multi-selections, keyed by their group id */
  lockedMultiSelections: { [groupId: string]: true };
};

export type ObservedAppState = ObservedStandaloneAppState &
  ObservedElementsAppState;

export type ObservedStandaloneAppState = {
  name: HistoryAppState["name"];
  viewBackgroundColor: HistoryAppState["viewBackgroundColor"];
};

export type ObservedElementsAppState = {
  editingGroupId: HistoryAppState["editingGroupId"];
  selectedElementIds: HistoryAppState["selectedElementIds"];
  selectedGroupIds: HistoryAppState["selectedGroupIds"];
  selectedLinearElement: {
    elementId: LinearElementEditor["elementId"];
    isEditing: boolean;
  } | null;
  croppingElementId: HistoryAppState["croppingElementId"];
  lockedMultiSelections: HistoryAppState["lockedMultiSelections"];
  activeLockedId: HistoryAppState["activeLockedId"];
};

/**
 * The editor the store observes: its scene and its current state.
 */
export interface StoreHost {
  scene: {
    getElementsMapIncludingDeleted(): SceneElementsMap;
  };
  state: HistoryAppState;
}
