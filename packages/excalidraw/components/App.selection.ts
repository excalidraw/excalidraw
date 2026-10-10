import {
  arrayToMap,
  DEFAULT_COLLISION_THRESHOLD,
  DEFAULT_TRANSFORM_HANDLE_SPACING,
  isReadonlyArray,
} from "@excalidraw/common";
import {
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
import type { CaptureUpdateActionType } from "@excalidraw/element";

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
 * The selection state with the line editor of what it selects: of a lone
 * selected line or arrow, once groups are expanded.
 */
const withLinearElementEditor = <
  T extends Pick<AppState, "selectedElementIds">,
>(
  selectionState: T,
  allElements: readonly NonDeletedExcalidrawElement[],
  appState: Pick<AppState, "selectedLinearElement">,
) => ({
  ...selectionState,
  selectedLinearElement: getLinearElementEditor(
    getSelectedElements(allElements, selectionState),
    allElements,
    appState,
  ),
});

/**
 * The frames that selecting the elements selects through their groups (those
 * selected along with them, within the edited group) — of the elements
 * neither frames nor in frames.
 */
const getFramesSelectedViaGroups = (
  elements: readonly ExcalidrawElement[],
  allElements: readonly NonDeletedExcalidrawElement[],
  editingGroupId: AppState["editingGroupId"],
) => {
  const groupIds = new Set<GroupId>();
  for (const element of elements) {
    if (isFrameLikeElement(element) || element.frameId) {
      continue;
    }
    const editingGroupIndex = editingGroupId
      ? element.groupIds.indexOf(editingGroupId)
      : -1;
    const elementGroupIds =
      editingGroupIndex > -1
        ? element.groupIds.slice(0, editingGroupIndex)
        : element.groupIds;
    if (elementGroupIds.length) {
      groupIds.add(elementGroupIds[elementGroupIds.length - 1]);
    }
  }

  const frameIds = new Set<ExcalidrawElement["id"]>();
  if (groupIds.size) {
    for (const element of allElements) {
      if (
        isFrameLikeElement(element) &&
        element.groupIds.some((groupId) => groupIds.has(groupId))
      ) {
        frameIds.add(element.id);
      }
    }
  }
  return frameIds;
};

/**
 * The selection of the given elements alone, with their groups (within the
 * edited group): a frame wins over its children, bound text is left to its
 * container, and a lone line or arrow gets its line editor.
 *
 * @param allElements the (non-deleted) elements the selection is in
 * @param deep select the elements themselves rather than their groups,
 *   editing their innermost group if they share it (and no group otherwise)
 *   — as Ctrl+click does
 */
export const getSelectionStateForElements = (
  targetElements: readonly NonDeletedExcalidrawElement[],
  allElements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  deep = false,
) => {
  const elements = targetElements.filter(
    (element) => !isBoundToContainer(element),
  );

  let editingGroupId = appState.editingGroupId;
  if (deep) {
    const innermostGroupIds = new Set(
      elements.map((element) => element.groupIds[0] ?? null),
    );
    editingGroupId =
      innermostGroupIds.size === 1 ? [...innermostGroupIds][0] : null;
  }

  // frames win over their children: frames selected, or selected through
  // the groups (not when deep, selecting no groups)
  const selectedFrameIds = deep
    ? new Set<ExcalidrawElement["id"]>()
    : getFramesSelectedViaGroups(elements, allElements, editingGroupId);
  for (const element of elements) {
    if (isFrameLikeElement(element)) {
      selectedFrameIds.add(element.id);
    }
  }
  const selectedElementIds: Record<ExcalidrawElement["id"], true> = {};
  for (const element of elements) {
    if (!element.frameId || !selectedFrameIds.has(element.frameId)) {
      selectedElementIds[element.id] = true;
    }
  }

  return withLinearElementEditor(
    deep
      ? {
          selectedElementIds: makeNextSelectedElementIds(
            selectedElementIds,
            appState,
          ),
          selectedGroupIds: {},
          editingGroupId,
        }
      : selectGroupsForSelectedElements(
          { editingGroupId, selectedElementIds },
          allElements,
          appState,
          null,
        ),
    allElements,
    appState,
  );
};

/**
 * The selection with the given elements added, with their groups (within the
 * edited group) — and the line editor of a lone selected line or arrow.
 *
 * A frame and its children aren't selected at the same time: an added frame
 * deselects its children, an added child of a selected (or added) frame is
 * left out, and adding elements grouped with frames deselects those frames'
 * children (and leaves the added ones out). In the element link selector, the
 * added elements replace the selection (unless one's group is selected).
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

  // frames win over their children: the added frames, and the frames selected
  // through the groups of the added elements
  const addedFrameIds = new Set<ExcalidrawElement["id"]>();
  for (const element of elements) {
    if (isFrameLikeElement(element)) {
      addedFrameIds.add(element.id);
    }
  }
  const framesInAddedGroups = getFramesSelectedViaGroups(
    elements,
    allElements,
    appState.editingGroupId,
  );
  for (const element of elements) {
    if (
      !isFrameLikeElement(element) &&
      element.frameId &&
      (nextSelectedElementIds[element.frameId] ||
        framesInAddedGroups.has(element.frameId))
    ) {
      delete nextSelectedElementIds[element.id];
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

  return withLinearElementEditor(
    selectGroupsForSelectedElements(
      {
        editingGroupId: appState.editingGroupId,
        selectedElementIds: nextSelectedElementIds,
      },
      allElements,
      appState,
      null,
    ),
    allElements,
    appState,
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

  return withLinearElementEditor(
    selectGroupsForSelectedElements(
      {
        editingGroupId: appState.editingGroupId,
        selectedElementIds: nextSelectedElementIds,
      },
      allElements,
      appState,
      null,
    ),
    allElements,
    appState,
  );
};

/** elements, or their ids — one or many */
export type ElementsOrIds =
  | ExcalidrawElement
  | ExcalidrawElement["id"]
  | readonly (ExcalidrawElement | ExcalidrawElement["id"])[];

type SelectionChangeOptions = {
  /**
   * how the change is recorded for undo (see `updateScene()`) — by default,
   * along with the next undoable change
   */
  captureUpdate?: CaptureUpdateActionType;
};

type AddOptions = SelectionChangeOptions & {
  /**
   * select locked elements too — e.g. for the context menu to offer unlocking
   * them
   */
  includeLocked?: boolean;
};

type SelectOptions = AddOptions & {
  /**
   * select the elements themselves rather than their groups, editing their
   * innermost group (if they share it) — as Ctrl+click does
   */
  deep?: boolean;
};

/**
 * The selection: selecting elements, adding them to or removing them from
 * the selection, and clearing it — keeping its rules: an element is selected
 * with its group (but within the edited group), a frame and its children
 * aren't selected at the same time, locked elements aren't selected, and a
 * lone line or arrow gets its line editor (see the `getSelectionState*()`
 * functions above).
 *
 * What hangs on the selection follows it: the link popup shows for a lone
 * selected element with a link (or an embeddable), an embed stays active only
 * while selected, cropping ends (unless the cropped image is selected again),
 * and selecting (or adding) anything but the edited text ends text editing,
 * submitting the text. The line editor ends once its line is deselected (see
 * `componentDidUpdate()`).
 *
 * Elements are taken by id from the scene: missing and deleted ones are
 * skipped.
 */
export class AppSelection {
  constructor(private app: App) {}

  /**
   * Selects the elements alone (with their groups, unless `deep`).
   */
  select = (elementsOrIds: ElementsOrIds, opts: SelectOptions = {}) => {
    const elements = this.resolve(elementsOrIds, opts.includeLocked);
    this.beforeChange(
      // (a click inside the image in the crop editor selects it again)
      elements.length === 1 &&
        elements[0].id === this.app.state.croppingElementId,
      opts,
      elements,
    );
    this.app.setState((prevState) =>
      this.withFollowingState(
        prevState,
        getSelectionStateForElements(
          elements,
          this.app.scene.getNonDeletedElements(),
          prevState,
          opts.deep,
        ),
      ),
    );
  };

  /**
   * Adds the elements (with their groups) to the selection.
   */
  add = (elementsOrIds: ElementsOrIds, opts: AddOptions = {}) => {
    const elements = this.resolve(elementsOrIds, opts.includeLocked);
    this.beforeChange(false, opts, elements);
    this.app.setState((prevState) =>
      this.withFollowingState(
        prevState,
        getSelectionStateAddingElements(
          elements,
          this.app.scene.getNonDeletedElements(),
          prevState,
        ),
      ),
    );
  };

  /**
   * Removes the elements from the selection — with the group they're
   * selected via.
   */
  remove = (
    elementsOrIds: ElementsOrIds,
    opts: SelectionChangeOptions = {},
  ) => {
    const elements = this.resolve(elementsOrIds, true);
    this.beforeChange(false, opts);
    this.app.setState((prevState) =>
      this.withFollowingState(
        prevState,
        getSelectionStateRemovingElements(
          elements,
          this.app.scene.getNonDeletedElements(),
          prevState,
        ),
      ),
    );
  };

  /**
   * Clears the selection, leaving the edited group and ending cropping.
   *
   * (Doesn't end text editing: starting it clears the selection.)
   */
  clear = (opts: SelectionChangeOptions = {}) => {
    this.app.finishImageCropping();
    if (opts.captureUpdate) {
      this.app.store.scheduleAction(opts.captureUpdate);
    }
    this.app.setState({
      selectedElementIds: makeNextSelectedElementIds({}, this.app.state),
      selectedGroupIds: {},
      editingGroupId: null,
      activeEmbeddable: null,
      showHyperlinkPopup: false,
    });
  };

  /**
   * Ends what changing the selection ends — cropping (unless
   * `keepsCroppedImage`), and text editing (unless selecting the edited text,
   * or its container) — and records the change for undo as asked.
   *
   * @param elements the elements being selected (or added) — none for a
   *   change that leaves text editing be
   */
  private beforeChange(
    keepsCroppedImage: boolean,
    { captureUpdate }: SelectionChangeOptions,
    elements?: readonly NonDeletedExcalidrawElement[],
  ) {
    const { editingTextElement } = this.app.state;
    if (
      elements &&
      editingTextElement &&
      !elements.some(
        (element) =>
          element.id === editingTextElement.id ||
          element.id === editingTextElement.containerId,
      )
    ) {
      // after the current event, as the editor submits with a flushSync (and
      // a pointer event's own blur would end it then anyway) — unless another
      // editing session started meanwhile
      const submit = this.app.text.textWysiwygSubmitHandler;
      queueMicrotask(() => {
        if (submit && this.app.text.textWysiwygSubmitHandler === submit) {
          submit();
        }
      });
    }
    if (!keepsCroppedImage) {
      this.app.finishImageCropping();
    }
    if (captureUpdate) {
      this.app.store.scheduleAction(captureUpdate);
    }
  }

  /**
   * The next selection state with what follows it: the link popup — shown for
   * a lone selected element with a link (or an embeddable), the link editor
   * staying open if it's the same element, and hidden otherwise — and the
   * active embed, which stays active only while selected.
   */
  private withFollowingState<T extends Pick<AppState, "selectedElementIds">>(
    prevState: AppState,
    nextState: T,
  ): T & Pick<AppState, "showHyperlinkPopup" | "activeEmbeddable"> {
    const activeEmbeddable =
      prevState.activeEmbeddable &&
      nextState.selectedElementIds[prevState.activeEmbeddable.element.id]
        ? prevState.activeEmbeddable
        : null;

    const ids = Object.keys(nextState.selectedElementIds);
    const element =
      ids.length === 1
        ? this.app.scene.getNonDeletedElementsMap().get(ids[0])
        : undefined;
    if (!element || !(element.link || isEmbeddableElement(element))) {
      return { ...nextState, activeEmbeddable, showHyperlinkPopup: false };
    }
    const prevIds = Object.keys(prevState.selectedElementIds);
    return {
      ...nextState,
      activeEmbeddable,
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

  /**
   * The scene's (non-deleted) elements, by id, once each — but locked ones,
   * unless `includeLocked`
   */
  private resolve(elementsOrIds: ElementsOrIds, includeLocked = false) {
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
      if (element && (includeLocked || !element.locked)) {
        elements.set(id, element);
      }
    }
    return [...elements.values()];
  }
}
