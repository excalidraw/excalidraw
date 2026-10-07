import {
  DEFAULT_COLLISION_THRESHOLD,
  DEFAULT_TRANSFORM_HANDLE_SPACING,
} from "@excalidraw/common";
import {
  getCommonBounds,
  getElementsInGroup,
  getFrameChildren,
  isEmbeddableElement,
  isFrameLikeElement,
  isLinearElement,
  isSelectedViaGroup,
  LinearElementEditor,
  makeNextSelectedElementIds,
  selectGroupsForSelectedElements,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { getSelectedElements } from "../scene";

import type App from "./App";

/**
 * The selection: selecting an element, adding it to or removing it from the
 * selection, and clearing it — keeping its rules: an element is selected
 * with its group (but within the edited group), a frame and its children
 * aren't selected at the same time, and a lone line or arrow gets its line
 * editor.
 */
export class AppSelection {
  constructor(private app: App) {}

  /**
   * Selects the element alone (with its group).
   */
  select(element: NonDeletedExcalidrawElement) {
    this.app.setState((prevState) => ({
      ...selectGroupsForSelectedElements(
        {
          editingGroupId: prevState.editingGroupId,
          selectedElementIds: { [element.id]: true },
        },
        this.app.scene.getNonDeletedElements(),
        prevState,
        this.app,
      ),
      selectedLinearElement: isLinearElement(element)
        ? // Don't set `selectedLinearElement` if its same as the element, this is mainly to prevent resetting the `hoverPointIndex` to -1.
          // Future we should update the API to take care of setting the correct `hoverPointIndex` when initialized
          prevState.selectedLinearElement?.elementId === element.id
          ? prevState.selectedLinearElement
          : new LinearElementEditor(
              element,
              this.app.scene.getNonDeletedElementsMap(),
            )
        : null,
    }));
  }

  /**
   * Adds the element (with its group) to the selection, and shows its link.
   *
   * A frame and its children aren't selected at the same time: a frame
   * deselects its children, and a child of a selected frame isn't added.
   */
  add(element: NonDeletedExcalidrawElement) {
    this.app.setState((prevState) => {
      let nextSelectedElementIds: { [id: string]: true } = {
        ...prevState.selectedElementIds,
        [element.id]: true,
      };

      const previouslySelectedElements: ExcalidrawElement[] = [];

      Object.keys(prevState.selectedElementIds).forEach((id) => {
        const selectedElement = this.app.scene.getElement(id);
        selectedElement && previouslySelectedElements.push(selectedElement);
      });

      // if element is frame-like, deselect all of its elements
      // if they are selected
      if (isFrameLikeElement(element)) {
        getFrameChildren(previouslySelectedElements, element.id).forEach(
          (child) => {
            delete nextSelectedElementIds[child.id];
          },
        );
      } else if (element.frameId) {
        // if element is in a frame and its frame has been selected
        // disable selection for the given element
        if (nextSelectedElementIds[element.frameId]) {
          delete nextSelectedElementIds[element.id];
        }
      } else {
        // element is neither a frame nor an element in a frame
        // but since element could be in a group with some frames
        // this means selecting element will have the frames selected as well
        // because we want to keep the invariant:
        // - frames and their elements are not selected at the same time
        // we deselect elements in those frames that were previously selected

        const groupIds = element.groupIds;
        const framesInGroups = new Set(
          groupIds
            .flatMap((gid) =>
              getElementsInGroup(this.app.scene.getNonDeletedElements(), gid),
            )
            .filter((groupElement) => isFrameLikeElement(groupElement))
            .map((frame) => frame.id),
        );

        if (framesInGroups.size > 0) {
          previouslySelectedElements.forEach((selectedElement) => {
            if (
              selectedElement.frameId &&
              framesInGroups.has(selectedElement.frameId)
            ) {
              // deselect element and groups containing the element
              delete nextSelectedElementIds[selectedElement.id];
              selectedElement.groupIds
                .flatMap((gid) =>
                  getElementsInGroup(
                    this.app.scene.getNonDeletedElements(),
                    gid,
                  ),
                )
                .forEach((groupElement) => {
                  delete nextSelectedElementIds[groupElement.id];
                });
            }
          });
        }
      }

      // Finally, in shape selection mode, we'd like to
      // keep only one shape or group selected at a time.
      // This means, if the element is a different shape or group
      // than the previously selected ones, we deselect the previous ones
      // and select the element
      if (prevState.openDialog?.name === "elementLinkSelector") {
        if (!element.groupIds.some((gid) => prevState.selectedGroupIds[gid])) {
          nextSelectedElementIds = {
            [element.id]: true,
          };
        }
      }

      return {
        ...selectGroupsForSelectedElements(
          {
            editingGroupId: prevState.editingGroupId,
            selectedElementIds: nextSelectedElementIds,
          },
          this.app.scene.getNonDeletedElements(),
          prevState,
          this.app,
        ),
        showHyperlinkPopup:
          element.link || isEmbeddableElement(element) ? "info" : false,
      };
    });
  }

  /**
   * Removes the element from the selection — the whole group if it's
   * selected via its group.
   */
  remove(element: NonDeletedExcalidrawElement) {
    if (isSelectedViaGroup(this.app.state, element)) {
      this.app.setState((_prevState) => {
        const nextSelectedElementIds = {
          ..._prevState.selectedElementIds,
        };

        // We want to unselect all groups element is part of
        // as well as all elements that are part of the groups
        // element is part of
        for (const groupedElement of element.groupIds.flatMap((groupId) =>
          getElementsInGroup(this.app.scene.getNonDeletedElements(), groupId),
        )) {
          delete nextSelectedElementIds[groupedElement.id];
        }

        return {
          selectedGroupIds: {
            ..._prevState.selectedElementIds,
            ...element.groupIds
              .map((gId) => ({ [gId]: false }))
              .reduce((prev, acc) => ({ ...prev, ...acc }), {}),
          },
          selectedElementIds: makeNextSelectedElementIds(
            nextSelectedElementIds,
            _prevState,
          ),
        };
      });
    } else {
      // remove element from selection while
      // keeping prev elements selected
      this.app.setState((prevState) => {
        const newSelectedElementIds = {
          ...prevState.selectedElementIds,
        };
        delete newSelectedElementIds[element.id];
        const newSelectedElements = getSelectedElements(
          this.app.scene.getNonDeletedElements(),
          { selectedElementIds: newSelectedElementIds },
        );

        return {
          ...selectGroupsForSelectedElements(
            {
              editingGroupId: prevState.editingGroupId,
              selectedElementIds: newSelectedElementIds,
            },
            this.app.scene.getNonDeletedElements(),
            prevState,
            this.app,
          ),
          // set selectedLinearElement only if thats the only element selected
          selectedLinearElement:
            newSelectedElements.length === 1 &&
            isLinearElement(newSelectedElements[0])
              ? new LinearElementEditor(
                  newSelectedElements[0],
                  this.app.scene.getNonDeletedElementsMap(),
                )
              : prevState.selectedLinearElement,
        };
      });
    }
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
    });
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
}
