import {
  arrayToMap,
  DEFAULT_COLLISION_THRESHOLD,
  DEFAULT_TRANSFORM_HANDLE_SPACING,
  isReadonlyArray,
} from "@excalidraw/common";
import {
  excludeElementsInFramesFromSelection,
  getCommonBounds,
  getSelectedElements,
  getSelectedGroupForElement,
  isBoundToContainer,
  isEmbeddableElement,
  isFrameLikeElement,
  isLinearElement,
  LinearElementEditor,
  makeNextSelectedElementIds,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  GroupId,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { Mutable } from "@excalidraw/common/utility-types";

import type {
  AppClassProperties,
  AppState,
  InteractiveCanvasAppState,
} from "../types";
import type App from "./App";

export const selectGroupsForSelectedElements = (function () {
  type SelectGroupsReturnType = Pick<
    InteractiveCanvasAppState,
    "selectedGroupIds" | "editingGroupId" | "selectedElementIds"
  >;

  let lastSelectedElements: readonly NonDeletedExcalidrawElement[] | null =
    null;
  let lastElements: readonly NonDeletedExcalidrawElement[] | null = null;
  let lastReturnValue: SelectGroupsReturnType | null = null;

  const _selectGroups = (
    selectedElements: readonly NonDeletedExcalidrawElement[],
    elements: readonly NonDeletedExcalidrawElement[],
    appState: Pick<AppState, "selectedElementIds" | "editingGroupId">,
    prevAppState: InteractiveCanvasAppState,
  ): SelectGroupsReturnType => {
    if (
      lastReturnValue !== undefined &&
      elements === lastElements &&
      selectedElements === lastSelectedElements &&
      appState.editingGroupId === lastReturnValue?.editingGroupId
    ) {
      return lastReturnValue;
    }

    const selectedGroupIds: Record<GroupId, boolean> = {};
    // Gather all the groups withing selected elements
    for (const selectedElement of selectedElements) {
      let groupIds = selectedElement.groupIds;
      if (appState.editingGroupId) {
        // handle the case where a group is nested within a group
        const indexOfEditingGroup = groupIds.indexOf(appState.editingGroupId);
        if (indexOfEditingGroup > -1) {
          groupIds = groupIds.slice(0, indexOfEditingGroup);
        }
      }
      if (groupIds.length > 0) {
        const lastSelectedGroup = groupIds[groupIds.length - 1];
        selectedGroupIds[lastSelectedGroup] = true;
      }
    }

    // Gather all the elements within selected groups
    const groupElementsIndex: Record<GroupId, string[]> = {};
    const selectedElementIdsInGroups = elements.reduce(
      (acc: Record<string, true>, element) => {
        if (element.isDeleted) {
          return acc;
        }

        const groupId = element.groupIds.find((id) => selectedGroupIds[id]);

        if (groupId) {
          acc[element.id] = true;

          // Populate the index
          if (!Array.isArray(groupElementsIndex[groupId])) {
            groupElementsIndex[groupId] = [element.id];
          } else {
            groupElementsIndex[groupId].push(element.id);
          }
        }
        return acc;
      },
      {},
    );

    for (const groupId of Object.keys(groupElementsIndex)) {
      // If there is one element in the group, and the group is selected or it's being edited, it's not a group
      if (groupElementsIndex[groupId].length < 2) {
        if (selectedGroupIds[groupId]) {
          selectedGroupIds[groupId] = false;
        }
      }
    }

    lastElements = elements;
    lastSelectedElements = selectedElements;

    lastReturnValue = {
      editingGroupId: appState.editingGroupId,
      selectedGroupIds,
      selectedElementIds: makeNextSelectedElementIds(
        {
          ...appState.selectedElementIds,
          ...selectedElementIdsInGroups,
        },
        prevAppState,
      ),
    };

    return lastReturnValue;
  };

  /**
   * When you select an element, you often want to actually select the whole group it's in, unless
   * you're currently editing that group.
   */
  const selectGroupsForSelectedElements = (
    appState: Pick<AppState, "selectedElementIds" | "editingGroupId">,
    elements: readonly NonDeletedExcalidrawElement[],
    prevAppState: InteractiveCanvasAppState,
    /**
     * supply null in cases where you don't have access to App instance and
     * you don't care about optimizing selectElements retrieval
     */
    app: AppClassProperties | null,
  ): Mutable<
    Pick<
      InteractiveCanvasAppState,
      "selectedGroupIds" | "editingGroupId" | "selectedElementIds"
    >
  > => {
    const selectedElements = app
      ? app.scene.getSelectedElements({
          selectedElementIds: appState.selectedElementIds,
          // supplying elements explicitly in case we're passed non-state elements
          elements,
        })
      : getSelectedElements(elements, appState);

    if (!selectedElements.length) {
      return {
        selectedGroupIds: {},
        editingGroupId: null,
        selectedElementIds: makeNextSelectedElementIds(
          appState.selectedElementIds,
          prevAppState,
        ),
      };
    }

    return _selectGroups(selectedElements, elements, appState, prevAppState);
  };

  selectGroupsForSelectedElements.clearCache = () => {
    lastElements = null;
    lastSelectedElements = null;
    lastReturnValue = null;
  };

  return selectGroupsForSelectedElements;
})();

/**
 * The line editor of a lone selected line or arrow (with its labels) —
 * the current one if it's already that element's.
 */
const getLinearElementEditor = (
  targetElements: readonly NonDeletedExcalidrawElement[],
  allElements: readonly NonDeletedExcalidrawElement[],
  appState: Pick<AppState, "selectedLinearElement">,
) => {
  const linears = targetElements.filter(isLinearElement);
  if (linears.length === 1) {
    const linear = linears[0];
    const boundElements = linear.boundElements?.map((def) => def.id) ?? [];
    const onlySingleLinearSelected = targetElements.every(
      (el) => el.id === linear.id || boundElements.includes(el.id),
    );

    if (onlySingleLinearSelected) {
      // keep the current one, e.g. not to reset its `hoverPointIndex`
      if (appState.selectedLinearElement?.elementId === linear.id) {
        return appState.selectedLinearElement;
      }
      return new LinearElementEditor(linear, arrayToMap(allElements));
    }
  }

  return null;
};

/**
 * The selection of the given elements alone, with their groups (within the
 * edited group): a frame wins over its children, bound text is left to its
 * container, and a lone line or arrow gets its line editor.
 *
 * @param allElements the (non-deleted) elements the selection is in
 */
export const getSelectionStateForElements = (
  targetElements: readonly NonDeletedExcalidrawElement[],
  allElements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
) => {
  return {
    selectedLinearElement: getLinearElementEditor(
      targetElements,
      allElements,
      appState,
    ),
    ...selectGroupsForSelectedElements(
      {
        editingGroupId: appState.editingGroupId,
        selectedElementIds: excludeElementsInFramesFromSelection(
          targetElements,
        ).reduce((acc: Record<ExcalidrawElement["id"], true>, element) => {
          if (!isBoundToContainer(element)) {
            acc[element.id] = true;
          }
          return acc;
        }, {}),
      },
      allElements,
      appState,
      null,
    ),
  };
};

/**
 * The selection with the given elements added, with their groups (within the
 * edited group).
 *
 * A frame and its children aren't selected at the same time: an added frame
 * deselects its children, an added child of a selected (or added) frame is
 * left out, and an added element grouped with frames deselects those frames'
 * children. In the element link selector, the added elements replace the
 * selection (unless one's group is selected).
 *
 * @param allElements the (non-deleted) elements the selection is in
 */
export const getSelectionStateAddingElements = (
  targetElements: readonly NonDeletedExcalidrawElement[],
  allElements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
) => {
  const elements = targetElements.filter(
    (element) => !isBoundToContainer(element),
  );

  let nextSelectedElementIds: Record<ExcalidrawElement["id"], true> = {
    ...appState.selectedElementIds,
  };
  for (const element of elements) {
    nextSelectedElementIds[element.id] = true;
  }

  const addedFrameIds = new Set<ExcalidrawElement["id"]>();
  // of the added elements neither frames nor in frames, which could be
  // grouped with frames
  const addedGroupIds = new Set<string>();
  for (const element of elements) {
    if (isFrameLikeElement(element)) {
      addedFrameIds.add(element.id);
    } else if (element.frameId) {
      // in a frame that's selected (or added)
      if (nextSelectedElementIds[element.frameId]) {
        delete nextSelectedElementIds[element.id];
      }
    } else {
      for (const groupId of element.groupIds) {
        addedGroupIds.add(groupId);
      }
    }
  }

  // frames grouped with the added elements are selected along with them
  const framesInAddedGroups = new Set<ExcalidrawElement["id"]>();
  if (addedGroupIds.size) {
    for (const element of allElements) {
      if (
        isFrameLikeElement(element) &&
        element.groupIds.some((groupId) => addedGroupIds.has(groupId))
      ) {
        framesInAddedGroups.add(element.id);
      }
    }
  }

  // deselect the previously selected children of those frames (and their
  // groups)
  if (addedFrameIds.size || framesInAddedGroups.size) {
    const deselectedGroupIds = new Set<string>();
    for (const element of allElements) {
      const { frameId } = element;
      if (!frameId || !appState.selectedElementIds[element.id]) {
        continue;
      }
      if (addedFrameIds.has(frameId)) {
        delete nextSelectedElementIds[element.id];
      }
      if (framesInAddedGroups.has(frameId)) {
        delete nextSelectedElementIds[element.id];
        for (const groupId of element.groupIds) {
          deselectedGroupIds.add(groupId);
        }
      }
    }
    if (deselectedGroupIds.size) {
      for (const element of allElements) {
        if (
          element.groupIds.some((groupId) => deselectedGroupIds.has(groupId))
        ) {
          delete nextSelectedElementIds[element.id];
        }
      }
    }
  }

  // in the element link selector, keep only one shape or group selected at a
  // time: the added elements replace the selection unless one's group is
  // selected
  if (
    appState.openDialog?.name === "elementLinkSelector" &&
    !elements.some((element) =>
      element.groupIds.some((groupId) => appState.selectedGroupIds[groupId]),
    )
  ) {
    nextSelectedElementIds = {};
    for (const element of elements) {
      nextSelectedElementIds[element.id] = true;
    }
  }

  return selectGroupsForSelectedElements(
    {
      editingGroupId: appState.editingGroupId,
      selectedElementIds: nextSelectedElementIds,
    },
    allElements,
    appState,
    null,
  );
};

/**
 * The selection with the given elements removed — with the group they're
 * selected via (if any) — and a lone remaining line or arrow getting its
 * line editor.
 *
 * @param allElements the (non-deleted) elements the selection is in
 */
export const getSelectionStateRemovingElements = (
  targetElements: readonly NonDeletedExcalidrawElement[],
  allElements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
) => {
  const nextSelectedElementIds = { ...appState.selectedElementIds };
  const removedGroupIds = new Set<string>();
  for (const element of targetElements) {
    delete nextSelectedElementIds[element.id];
    const groupId = getSelectedGroupForElement(appState, element);
    if (groupId) {
      removedGroupIds.add(groupId);
    }
  }
  if (removedGroupIds.size) {
    for (const element of allElements) {
      if (element.groupIds.some((groupId) => removedGroupIds.has(groupId))) {
        delete nextSelectedElementIds[element.id];
      }
    }
  }

  const remainingElements = getSelectedElements(allElements, {
    selectedElementIds: nextSelectedElementIds,
  });

  return {
    ...selectGroupsForSelectedElements(
      {
        editingGroupId: appState.editingGroupId,
        selectedElementIds: nextSelectedElementIds,
      },
      allElements,
      appState,
      null,
    ),
    selectedLinearElement:
      remainingElements.length === 1 && isLinearElement(remainingElements[0])
        ? getLinearElementEditor(remainingElements, allElements, appState)
        : null,
  };
};

/** elements, or their ids — one or many */
export type ElementsOrIds =
  | ExcalidrawElement
  | ExcalidrawElement["id"]
  | readonly (ExcalidrawElement | ExcalidrawElement["id"])[];

/**
 * The selection: selecting elements, adding them to or removing them from
 * the selection, and clearing it — keeping its rules: an element is selected
 * with its group (but within the edited group), a frame and its children
 * aren't selected at the same time, and a lone line or arrow gets its line
 * editor (see the `getSelectionState*()` functions above).
 *
 * Elements are taken by id from the scene: missing and deleted ones are
 * skipped.
 */
export class AppSelection {
  constructor(private app: App) {}

  /**
   * Selects the elements alone (with their groups).
   *
   * Like `add()` and `remove()`, shows the link popup of a lone selected
   * element with a link (or an embeddable), and hides it otherwise.
   */
  select(elementsOrIds: ElementsOrIds) {
    const elements = this.resolve(elementsOrIds);
    this.app.setState((prevState) =>
      this.withLinkPopup(
        prevState,
        getSelectionStateForElements(
          elements,
          this.app.scene.getNonDeletedElements(),
          prevState,
        ),
      ),
    );
  }

  /**
   * Adds the elements (with their groups) to the selection.
   */
  add(elementsOrIds: ElementsOrIds) {
    const elements = this.resolve(elementsOrIds);
    this.app.setState((prevState) =>
      this.withLinkPopup(
        prevState,
        getSelectionStateAddingElements(
          elements,
          this.app.scene.getNonDeletedElements(),
          prevState,
        ),
      ),
    );
  }

  /**
   * Removes the elements from the selection — with the group they're
   * selected via.
   */
  remove(elementsOrIds: ElementsOrIds) {
    const elements = this.resolve(elementsOrIds);
    this.app.setState((prevState) =>
      this.withLinkPopup(
        prevState,
        getSelectionStateRemovingElements(
          elements,
          this.app.scene.getNonDeletedElements(),
          prevState,
        ),
      ),
    );
  }

  /**
   * Clears the selection, leaving the edited group.
   */
  clear() {
    this.app.setState({
      selectedElementIds: makeNextSelectedElementIds({}, this.app.state),
      selectedGroupIds: {},
      editingGroupId: null,
      activeEmbeddable: null,
      showHyperlinkPopup: false,
    });
  }

  /**
   * The next selection state with its link popup: shown for a lone selected
   * element with a link (or an embeddable) — the link editor staying open if
   * it's the same element — and hidden otherwise.
   */
  private withLinkPopup<T extends Pick<AppState, "selectedElementIds">>(
    prevState: AppState,
    nextState: T,
  ): T & Pick<AppState, "showHyperlinkPopup"> {
    const ids = Object.keys(nextState.selectedElementIds);
    const element =
      ids.length === 1
        ? this.app.scene.getNonDeletedElementsMap().get(ids[0])
        : undefined;
    if (!element || !(element.link || isEmbeddableElement(element))) {
      return { ...nextState, showHyperlinkPopup: false };
    }
    const prevIds = Object.keys(prevState.selectedElementIds);
    return {
      ...nextState,
      showHyperlinkPopup:
        prevState.showHyperlinkPopup === "editor" &&
        prevIds.length === 1 &&
        prevIds[0] === element.id
          ? "editor"
          : "info",
    };
  }

  isASelectedElement(hitElement: ExcalidrawElement | null): boolean {
    return (
      hitElement != null && this.app.state.selectedElementIds[hitElement.id]
    );
  }

  isHittingCommonBoundingBoxOfSelectedElements(
    point: Readonly<{ x: number; y: number }>,
    selectedElements: readonly ExcalidrawElement[],
  ): boolean {
    if (selectedElements.length < 2) {
      return false;
    }

    // How many pixels off the shape boundary we still consider a hit
    const threshold = Math.max(
      DEFAULT_COLLISION_THRESHOLD / this.app.state.zoom.value,
      1,
    );
    const boundsPadding =
      (DEFAULT_TRANSFORM_HANDLE_SPACING * 2) / this.app.state.zoom.value;
    const [x1, y1, x2, y2] = getCommonBounds(selectedElements);
    return (
      point.x > x1 - boundsPadding - threshold &&
      point.x < x2 + boundsPadding + threshold &&
      point.y > y1 - boundsPadding - threshold &&
      point.y < y2 + boundsPadding + threshold
    );
  }

  /** the scene's (non-deleted) elements, by id, once each */
  private resolve(elementsOrIds: ElementsOrIds) {
    const elementsMap = this.app.scene.getNonDeletedElementsMap();
    const elements = new Map<
      ExcalidrawElement["id"],
      NonDeletedExcalidrawElement
    >();
    for (const elementOrId of (isReadonlyArray(elementsOrIds)
      ? elementsOrIds
      : [elementsOrIds]) as readonly (ExcalidrawElement | string)[]) {
      const id = typeof elementOrId === "string" ? elementOrId : elementOrId.id;
      const element = elementsMap.get(id);
      if (element) {
        elements.set(id, element);
      }
    }
    return [...elements.values()];
  }
}
