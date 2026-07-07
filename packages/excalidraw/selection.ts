import {
  arrayToMap,
  CURSOR_TYPE,
  DEFAULT_COLLISION_THRESHOLD,
  DEFAULT_TRANSFORM_HANDLE_SPACING,
  isSelectionLikeTool,
  KEYS,
  randomInteger,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  deepCopyElement,
  dragSelectedElements,
  duplicateElements,
  editGroupForSelectedElement,
  getCommonBounds,
  getCommonFrameId,
  getElementsInGroup,
  getFrameChildren,
  getSelectedElements,
  getSelectionStateForElements,
  hitElementBoundingBoxOnly,
  isBindableElement,
  isElbowArrow,
  isElementInGroup,
  isEmbeddableElement,
  isFrameLikeElement,
  isLinearElement,
  isSelectedViaGroup,
  LinearElementEditor,
  makeNextSelectedElementIds,
  newElementWith,
  selectGroupsForSelectedElements,
  syncMovedIndices,
  updateBoundElements,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";
import { flushSync } from "react-dom";

import type {
  ExcalidrawElement,
  NonDeleted,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { actionToggleLinearEditor } from "./actions";
import { setCursor } from "./cursor";
import {
  linearBoxSelectionFromPointerDownHandler,
  linearEditorOnPointerDownHandler,
} from "./linear";
import { maybeMoveCropRegion, resizeSetupOnPointerDownHandler } from "./resize";
import { getElementsWithinSelection, isSomeElementSelected } from "./scene";
import { snapDraggedElements } from "./snapping";

import type React from "react";

import type { App, PointerDownState } from "./types";

export const deselectElements = (app: App): void => {
  app.setState({
    selectedElementIds: makeNextSelectedElementIds({}, app.state),
    selectedGroupIds: {},
    editingGroupId: null,
    activeEmbeddable: null,
  });
};

export const clearSelectionIfNotUsingSelection = (app: App): void => {
  if (!isSelectionLikeTool(app.state.activeTool.type)) {
    app.setState({
      selectedElementIds: makeNextSelectedElementIds({}, app.state),
      selectedGroupIds: {},
      editingGroupId: null,
      activeEmbeddable: null,
    });
  }
};

export const isASelectedElement = (
  app: App,
  hitElement: ExcalidrawElement | null,
): boolean => {
  return hitElement != null && app.state.selectedElementIds[hitElement.id];
};

export const isHittingCommonBoundingBoxOfSelectedElements = (
  app: App,
  point: Readonly<{ x: number; y: number }>,
  selectedElements: readonly ExcalidrawElement[],
): boolean => {
  if (selectedElements.length < 2) {
    return false;
  }

  // How many pixels off the shape boundary we still consider a hit
  const threshold = Math.max(
    DEFAULT_COLLISION_THRESHOLD / app.state.zoom.value,
    1,
  );
  const boundsPadding =
    (DEFAULT_TRANSFORM_HANDLE_SPACING * 2) / app.state.zoom.value;
  const [x1, y1, x2, y2] = getCommonBounds(selectedElements);
  return (
    point.x > x1 - boundsPadding - threshold &&
    point.x < x2 + boundsPadding + threshold &&
    point.y > y1 - boundsPadding - threshold &&
    point.y < y2 + boundsPadding + threshold
  );
};

export const clearSelection = (
  app: App,
  hitElement: ExcalidrawElement | null,
): void => {
  app.setState((prevState) => ({
    selectedElementIds: makeNextSelectedElementIds({}, prevState),
    activeEmbeddable: null,
    selectedGroupIds: {},
    // Continue editing the same group if the user selected a different
    // element from it
    editingGroupId:
      prevState.editingGroupId &&
      hitElement != null &&
      isElementInGroup(hitElement, prevState.editingGroupId)
        ? prevState.editingGroupId
        : null,
  }));
  app.setState({
    selectedElementIds: makeNextSelectedElementIds({}, app.state),
    activeEmbeddable: null,
    previousSelectedElementIds: app.state.selectedElementIds,
    selectedLinearElement: null,
  });
};

/**
 * Handles selection concerns on pointer down while a selection-like tool is
 * active: transform-handle grab, line editor interaction, hit testing, link
 * hits, deep (ctrl) selection, lasso initiation and (de)selecting the hit
 * element.
 *
 * @returns whether the pointer event has been completely handled (the caller
 * should return early).
 */
export const selectionOnPointerDownHandler = (
  app: App,
  event: React.PointerEvent<HTMLElement>,
  pointerDownState: PointerDownState,
): boolean => {
  if (isSelectionLikeTool(app.state.activeTool.type)) {
    if (resizeSetupOnPointerDownHandler(app, event, pointerDownState)) {
      // a transform (resize/rotate) handle was grabbed; resize setup takes
      // over the pointer interaction, so skip selection handling below
    } else {
      const linearEditorGate = linearEditorOnPointerDownHandler(
        app,
        event,
        pointerDownState,
      );
      if (linearEditorGate !== null) {
        return linearEditorGate;
      }

      const allHitElements = app.getElementsAtPosition(
        pointerDownState.origin.x,
        pointerDownState.origin.y,
        {
          includeLockedElements: true,
        },
      );
      const unlockedHitElements = allHitElements.filter((e) => !e.locked);

      // Cannot set preferSelected in getElementAtPosition as we do in pointer move; consider:
      // A & B: both unlocked, A selected, B on top, A & B overlaps in some way
      // we want to select B when clicking on the overlapping area
      const hitElementMightBeLocked = app.getElementAtPosition(
        pointerDownState.origin.x,
        pointerDownState.origin.y,
        {
          allHitElements,
        },
      );

      if (
        !hitElementMightBeLocked ||
        hitElementMightBeLocked.id !== app.state.activeLockedId
      ) {
        app.setState({
          activeLockedId: null,
        });
      }

      if (
        hitElementMightBeLocked &&
        hitElementMightBeLocked.locked &&
        !unlockedHitElements.some((el) => app.state.selectedElementIds[el.id])
      ) {
        pointerDownState.hit.element = null;
      } else {
        // hitElement may already be set above, so check first
        pointerDownState.hit.element =
          pointerDownState.hit.element ??
          app.getElementAtPosition(
            pointerDownState.origin.x,
            pointerDownState.origin.y,
          );
      }

      app.hitLinkElement = app.getElementLinkAtPosition(
        pointerDownState.origin,
        hitElementMightBeLocked,
      );

      if (app.hitLinkElement) {
        return true;
      }

      if (
        app.state.croppingElementId &&
        pointerDownState.hit.element?.id !== app.state.croppingElementId
      ) {
        app.finishImageCropping();
      }

      if (pointerDownState.hit.element) {
        // Early return if pointer is hitting link icon
        const hitLinkElement = app.getElementLinkAtPosition(
          {
            x: pointerDownState.origin.x,
            y: pointerDownState.origin.y,
          },
          pointerDownState.hit.element,
        );
        if (hitLinkElement) {
          return false;
        }
      }

      // For overlapped elements one position may hit
      // multiple elements
      pointerDownState.hit.allHitElements = unlockedHitElements;

      const hitElement = pointerDownState.hit.element;
      const someHitElementIsSelected = pointerDownState.hit.allHitElements.some(
        (element) => isASelectedElement(app, element),
      );
      if (
        (hitElement === null || !someHitElementIsSelected) &&
        !event.shiftKey &&
        !pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements &&
        (!app.state.selectedLinearElement?.isEditing ||
          (hitElement &&
            hitElement?.id !== app.state.selectedLinearElement?.elementId))
      ) {
        clearSelection(app, hitElement);
      }

      if (app.state.selectedLinearElement?.isEditing) {
        app.setState((prevState) => ({
          selectedLinearElement: prevState.selectedLinearElement
            ? {
                ...prevState.selectedLinearElement,
                isEditing:
                  !!hitElement &&
                  hitElement.id === app.state.selectedLinearElement?.elementId,
              }
            : null,
          selectedElementIds: prevState.selectedLinearElement
            ? makeNextSelectedElementIds(
                {
                  [prevState.selectedLinearElement.elementId]: true,
                },
                app.state,
              )
            : makeNextSelectedElementIds({}, prevState),
        }));
        // If we click on something
      } else if (hitElement != null) {
        // == deep selection ==
        // on CMD/CTRL, drill down to hit element regardless of groups etc.
        if (event[KEYS.CTRL_OR_CMD]) {
          if (event.altKey) {
            // ctrl + alt means we're lasso selecting - start lasso trail and switch to lasso tool

            // Close any open dialogs that might interfere with lasso selection
            if (app.state.openDialog?.name === "elementLinkSelector") {
              app.setOpenDialog(null);
            }
            app.lassoTrail.startPath(
              pointerDownState.origin.x,
              pointerDownState.origin.y,
              event.shiftKey,
            );
            app.setActiveTool({ type: "lasso", fromSelection: true });
            return false;
          }
          if (!app.state.selectedElementIds[hitElement.id]) {
            pointerDownState.hit.wasAddedToSelection = true;
          }
          app.setState((prevState) => ({
            ...editGroupForSelectedElement(prevState, hitElement),
            previousSelectedElementIds: app.state.selectedElementIds,
          }));
          // mark as not completely handled so as to allow dragging etc.
          return false;
        }

        // deselect if item is selected
        // if shift is not clicked, this will always return true
        // otherwise, it will trigger selection based on current
        // state of the box
        if (!app.state.selectedElementIds[hitElement.id]) {
          // if we are currently editing a group, exiting editing mode and deselect the group.
          if (
            app.state.editingGroupId &&
            !isElementInGroup(hitElement, app.state.editingGroupId)
          ) {
            app.setState({
              selectedElementIds: makeNextSelectedElementIds({}, app.state),
              selectedGroupIds: {},
              editingGroupId: null,
              activeEmbeddable: null,
            });
          }

          // Add hit element to selection. At this point if we're not holding
          // SHIFT the previously selected element(s) were deselected above
          // (make sure you use setState updater to use latest state)
          // With shift-selection, we want to make sure that frames and their containing
          // elements are not selected at the same time.
          if (
            !someHitElementIsSelected &&
            !pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements
          ) {
            app.setState((prevState) => {
              let nextSelectedElementIds: { [id: string]: true } = {
                ...prevState.selectedElementIds,
                [hitElement.id]: true,
              };

              const previouslySelectedElements: ExcalidrawElement[] = [];

              Object.keys(prevState.selectedElementIds).forEach((id) => {
                const element = app.scene.getElement(id);
                element && previouslySelectedElements.push(element);
              });

              // if hitElement is frame-like, deselect all of its elements
              // if they are selected
              if (isFrameLikeElement(hitElement)) {
                getFrameChildren(
                  previouslySelectedElements,
                  hitElement.id,
                ).forEach((element) => {
                  delete nextSelectedElementIds[element.id];
                });
              } else if (hitElement.frameId) {
                // if hitElement is in a frame and its frame has been selected
                // disable selection for the given element
                if (nextSelectedElementIds[hitElement.frameId]) {
                  delete nextSelectedElementIds[hitElement.id];
                }
              } else {
                // hitElement is neither a frame nor an element in a frame
                // but since hitElement could be in a group with some frames
                // this means selecting hitElement will have the frames selected as well
                // because we want to keep the invariant:
                // - frames and their elements are not selected at the same time
                // we deselect elements in those frames that were previously selected

                const groupIds = hitElement.groupIds;
                const framesInGroups = new Set(
                  groupIds
                    .flatMap((gid) =>
                      getElementsInGroup(
                        app.scene.getNonDeletedElements(),
                        gid,
                      ),
                    )
                    .filter((element) => isFrameLikeElement(element))
                    .map((frame) => frame.id),
                );

                if (framesInGroups.size > 0) {
                  previouslySelectedElements.forEach((element) => {
                    if (
                      element.frameId &&
                      framesInGroups.has(element.frameId)
                    ) {
                      // deselect element and groups containing the element
                      delete nextSelectedElementIds[element.id];
                      element.groupIds
                        .flatMap((gid) =>
                          getElementsInGroup(
                            app.scene.getNonDeletedElements(),
                            gid,
                          ),
                        )
                        .forEach((element) => {
                          delete nextSelectedElementIds[element.id];
                        });
                    }
                  });
                }
              }

              // Finally, in shape selection mode, we'd like to
              // keep only one shape or group selected at a time.
              // This means, if the hitElement is a different shape or group
              // than the previously selected ones, we deselect the previous ones
              // and select the hitElement
              if (prevState.openDialog?.name === "elementLinkSelector") {
                if (
                  !hitElement.groupIds.some(
                    (gid) => prevState.selectedGroupIds[gid],
                  )
                ) {
                  nextSelectedElementIds = {
                    [hitElement.id]: true,
                  };
                }
              }

              return {
                ...selectGroupsForSelectedElements(
                  {
                    editingGroupId: prevState.editingGroupId,
                    selectedElementIds: nextSelectedElementIds,
                  },
                  app.scene.getNonDeletedElements(),
                  prevState,
                  app,
                ),
                showHyperlinkPopup:
                  hitElement.link || isEmbeddableElement(hitElement)
                    ? "info"
                    : false,
              };
            });
            pointerDownState.hit.wasAddedToSelection = true;
          }
        }
      }

      app.setState({
        previousSelectedElementIds: app.state.selectedElementIds,
      });
    }
  }
  return false;
};

/**
 * While dragging with selected element(s) under the pointer, drags the
 * selection (including frame highlighting, crop-region panning, lasso guards
 * and alt-duplication).
 *
 * @returns whether the event was consumed by dragging the selection (the
 * caller should return early); `false` falls through to box-selection / new
 * element handling.
 */
export const selectionElementsDragFromPointerDownHandler = (
  app: App,
  pointerDownState: PointerDownState,
  event: PointerEvent,
  pointerCoords: { x: number; y: number },
  lastPointerCoords: { x: number; y: number },
  elementsMap: NonDeletedSceneElementsMap,
): boolean => {
  const hasHitASelectedElement = pointerDownState.hit.allHitElements.some(
    (element) => isASelectedElement(app, element),
  );

  const isSelectingPointsInLineEditor =
    app.state.selectedLinearElement?.isEditing &&
    event.shiftKey &&
    app.state.selectedLinearElement.elementId ===
      pointerDownState.hit.element?.id;

  if (
    (hasHitASelectedElement ||
      pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements) &&
    !isSelectingPointsInLineEditor &&
    !pointerDownState.drag.blockDragging
  ) {
    const selectedElements = app.scene.getSelectedElements(app.state);
    if (
      selectedElements.length > 0 &&
      selectedElements.every((element) => element.locked)
    ) {
      return true;
    }

    const selectedElementsHasAFrame = selectedElements.some((e) =>
      isFrameLikeElement(e),
    );
    const frameToHighlight = selectedElementsHasAFrame
      ? null
      : app.getTopLayerFrameAtSceneCoords(pointerCoords, {
          currentFrameId: getCommonFrameId(selectedElements),
          excludeElementIds: app.state.selectedElementIds,
        });
    // Only update the state if there is a difference
    app.updateFrameToHighlight(frameToHighlight);

    // Marking that click was used for dragging to check
    // if elements should be deselected on pointerup
    pointerDownState.drag.hasOccurred = true;

    // prevent immediate dragging during lasso selection to avoid element displacement
    // only allow dragging if we're not in the middle of lasso selection
    // (on mobile, allow dragging if we hit an element)
    if (
      app.state.activeTool.type === "lasso" &&
      app.lassoTrail.hasCurrentTrail &&
      !(
        app.editorInterface.formFactor !== "desktop" &&
        pointerDownState.hit.element
      ) &&
      !app.state.activeTool.fromSelection
    ) {
      return true;
    }

    // Clear lasso trail when starting to drag selected elements with lasso tool
    // Only clear if we're actually dragging (not during lasso selection)
    if (
      app.state.activeTool.type === "lasso" &&
      selectedElements.length > 0 &&
      pointerDownState.drag.hasOccurred &&
      !app.state.activeTool.fromSelection
    ) {
      app.lassoTrail.endPath();
    }

    // prevent dragging even if we're no longer holding cmd/ctrl otherwise
    // it would have weird results (stuff jumping all over the screen)
    // Checking for editingTextElement to avoid jump while editing on mobile #6503
    if (
      selectedElements.length > 0 &&
      !pointerDownState.withCmdOrCtrl &&
      !app.state.editingTextElement &&
      app.state.activeEmbeddable?.state !== "active"
    ) {
      const dragOffset = {
        x: pointerCoords.x - pointerDownState.drag.origin.x,
        y: pointerCoords.y - pointerDownState.drag.origin.y,
      };

      const originalElements = [...pointerDownState.originalElements.values()];

      // We only drag in one direction if shift is pressed
      const lockDirection = event.shiftKey;

      if (lockDirection) {
        const distanceX = Math.abs(dragOffset.x);
        const distanceY = Math.abs(dragOffset.y);

        const lockX = lockDirection && distanceX < distanceY;
        const lockY = lockDirection && distanceX > distanceY;

        if (lockX) {
          dragOffset.x = 0;
        }

        if (lockY) {
          dragOffset.y = 0;
        }
      }

      // #region move crop region
      if (
        maybeMoveCropRegion(
          app,
          pointerDownState,
          pointerCoords,
          lastPointerCoords,
          elementsMap,
        )
      ) {
        return true;
      }

      // Snap cache *must* be synchronously popuplated before initial drag,
      // otherwise the first drag even will not snap, causing a jump before
      // it snaps to its position if previously snapped already.
      app.maybeCacheVisibleGaps(event, selectedElements);
      app.maybeCacheReferenceSnapPoints(event, selectedElements);

      const { snapOffset, snapLines } = snapDraggedElements(
        originalElements,
        dragOffset,
        app,
        event,
        app.scene.getNonDeletedElementsMap(),
      );

      app.setState({ snapLines });

      // when we're editing the name of a frame, we want the user to be
      // able to select and interact with the text input
      if (!app.state.editingFrame) {
        dragSelectedElements(
          pointerDownState,
          selectedElements,
          dragOffset,
          app.scene,
          snapOffset,
          event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
        );
      }

      app.setState({
        selectedElementsAreBeingDragged: true,
        // element is being dragged and selectionElement that was created on pointer down
        // should be removed
        selectionElement: null,
      });

      // We duplicate the selected element if alt is pressed on pointer move
      if (event.altKey && !pointerDownState.hit.hasBeenDuplicated) {
        // Move the currently selected elements to the top of the z index stack, and
        // put the duplicates where the selected elements used to be.
        // (the origin point where the dragging started)

        pointerDownState.hit.hasBeenDuplicated = true;

        const elements = app.scene.getElementsIncludingDeleted();
        const hitElement = pointerDownState.hit.element;
        const selectedElements = app.scene.getSelectedElements({
          selectedElementIds: app.state.selectedElementIds,
          includeBoundTextElement: true,
          includeElementsInFrames: true,
        });
        if (
          hitElement &&
          // hit element may not end up being selected
          // if we're alt-dragging a common bounding box
          // over the hit element
          pointerDownState.hit.wasAddedToSelection &&
          !selectedElements.find((el) => el.id === hitElement.id)
        ) {
          selectedElements.push(hitElement);
        }

        const idsOfElementsToDuplicate = new Map(
          selectedElements.map((el) => [el.id, el]),
        );

        const {
          duplicatedElements,
          duplicateElementsMap,
          elementsWithDuplicates,
          origIdToDuplicateId,
        } = duplicateElements({
          type: "in-place",
          elements,
          appState: app.state,
          randomizeSeed: true,
          idsOfElementsToDuplicate,
          overrides: ({ duplicateElement, origElement }) => {
            return {
              // reset to the original element's frameId (unless we've
              // duplicated alongside a frame in which case we need to
              // keep the duplicate frame's id) so that the element
              // frame membership is refreshed on pointerup
              // NOTE this is a hacky solution and should be done
              // differently
              frameId: duplicateElement.frameId ?? origElement.frameId,
              seed: randomInteger(),
            };
          },
        });
        duplicatedElements.forEach((element) => {
          pointerDownState.originalElements.set(
            element.id,
            deepCopyElement(element),
          );
        });

        const mappedClonedElements = elementsWithDuplicates.map((el) => {
          if (idsOfElementsToDuplicate.has(el.id)) {
            const origEl = pointerDownState.originalElements.get(el.id);

            if (origEl) {
              return newElementWith(el, {
                x: origEl.x,
                y: origEl.y,
              });
            }
          }
          return el;
        });

        const mappedNewSceneElements = app.props.onDuplicate?.(
          mappedClonedElements,
          elements,
        );

        const elementsWithIndices = syncMovedIndices(
          mappedNewSceneElements || mappedClonedElements,
          arrayToMap(duplicatedElements),
        );

        // we need to update synchronously so as to keep pointerDownState,
        // appState, and scene elements in sync
        flushSync(() => {
          // swap hit element with the duplicated one
          if (pointerDownState.hit.element) {
            const cloneId = origIdToDuplicateId.get(
              pointerDownState.hit.element.id,
            );
            const clonedElement = cloneId && duplicateElementsMap.get(cloneId);
            pointerDownState.hit.element = clonedElement || null;
          }
          // swap hit elements with the duplicated ones
          pointerDownState.hit.allHitElements =
            pointerDownState.hit.allHitElements.reduce(
              (
                acc: typeof pointerDownState.hit.allHitElements,
                origHitElement,
              ) => {
                const cloneId = origIdToDuplicateId.get(origHitElement.id);
                const clonedElement =
                  cloneId && duplicateElementsMap.get(cloneId);
                if (clonedElement) {
                  acc.push(clonedElement);
                }

                return acc;
              },
              [],
            );

          // update drag origin to the position at which we started
          // the duplication so that the drag offset is correct
          pointerDownState.drag.origin = viewportCoordsToSceneCoords(
            event,
            app.state,
          );

          // switch selected elements to the duplicated ones
          app.setState((prevState) => ({
            ...getSelectionStateForElements(
              duplicatedElements,
              app.scene.getNonDeletedElements(),
              prevState,
            ),
          }));

          app.scene.replaceAllElements(elementsWithIndices);
          selectedElements.forEach((element) => {
            if (
              isBindableElement(element) &&
              element.boundElements?.some((other) => other.type === "arrow")
            ) {
              updateBoundElements(element, app.scene);
            }
          });

          app.maybeCacheVisibleGaps(event, selectedElements, true);
          app.maybeCacheReferenceSnapPoints(event, selectedElements, true);
        });
      }

      return true;
    }
  }

  return false;
};

/**
 * While dragging with the selection tool active, box-selects the elements
 * within the selection element (deferring to point box-selection inside the
 * line editor).
 */
export const selectionBoxSelectFromPointerDownHandler = (
  app: App,
  pointerDownState: PointerDownState,
  event: PointerEvent,
): void => {
  if (app.state.activeTool.type === "selection") {
    pointerDownState.boxSelection.hasOccurred = true;

    const elements = app.scene.getNonDeletedElements();

    // box-select line editor points
    if (linearBoxSelectionFromPointerDownHandler(app, event)) {
      // regular box-select
    } else {
      let shouldReuseSelection = true;

      if (!event.shiftKey && isSomeElementSelected(elements, app.state)) {
        if (pointerDownState.withCmdOrCtrl && pointerDownState.hit.element) {
          app.setState((prevState) =>
            selectGroupsForSelectedElements(
              {
                ...prevState,
                selectedElementIds: {
                  [pointerDownState.hit.element!.id]: true,
                },
              },
              app.scene.getNonDeletedElements(),
              prevState,
              app,
            ),
          );
        } else {
          shouldReuseSelection = false;
        }
      }
      const elementsWithinSelection = app.state.selectionElement
        ? getElementsWithinSelection(
            elements,
            app.state.selectionElement,
            app.scene.getNonDeletedElementsMap(),
            false,
            app.state.boxSelectionMode,
          )
        : [];

      app.setState((prevState) => {
        const nextSelectedElementIds = {
          ...(shouldReuseSelection && prevState.selectedElementIds),
          ...elementsWithinSelection.reduce(
            (acc: Record<ExcalidrawElement["id"], true>, element) => {
              acc[element.id] = true;
              return acc;
            },
            {},
          ),
        };

        if (pointerDownState.hit.element) {
          // if using ctrl/cmd, select the hitElement only if we
          // haven't box-selected anything else
          if (!elementsWithinSelection.length) {
            nextSelectedElementIds[pointerDownState.hit.element.id] = true;
          } else {
            delete nextSelectedElementIds[pointerDownState.hit.element.id];
          }
        }

        prevState = !shouldReuseSelection
          ? { ...prevState, selectedGroupIds: {}, editingGroupId: null }
          : prevState;

        return {
          ...selectGroupsForSelectedElements(
            {
              editingGroupId: prevState.editingGroupId,
              selectedElementIds: nextSelectedElementIds,
            },
            app.scene.getNonDeletedElements(),
            prevState,
            app,
          ),
          // select linear element only when we haven't box-selected anything else
          selectedLinearElement:
            elementsWithinSelection.length === 1 &&
            isLinearElement(elementsWithinSelection[0])
              ? new LinearElementEditor(
                  elementsWithinSelection[0],
                  app.scene.getNonDeletedElementsMap(),
                )
              : null,
          showHyperlinkPopup:
            elementsWithinSelection.length === 1 &&
            (elementsWithinSelection[0].link ||
              isEmbeddableElement(elementsWithinSelection[0]))
              ? "info"
              : false,
        };
      });
    }
  }
};

/**
 * Handles selection on pointer up when element(s) weren't dragged or added to
 * the selection on pointer down: shift-(de)selection, group (de)selection,
 * frame deselection, selecting the hit element, and deselecting everything
 * when only the bounding box was hit.
 *
 * `hitElement` must be captured from `pointerDownState.hit.element` before
 * this call.
 *
 * @returns whether the selection was cleared / linear editor exited (the
 * caller should return early).
 */
export const selectionOnPointerUpFromPointerDownHandler = (
  app: App,
  pointerDownState: PointerDownState,
  childEvent: PointerEvent,
  hitElement: NonDeleted<ExcalidrawElement> | null,
  elementsMap: NonDeletedSceneElementsMap,
): boolean => {
  if (
    hitElement &&
    !pointerDownState.drag.hasOccurred &&
    !pointerDownState.hit.wasAddedToSelection &&
    // if we're editing a line, pointerup shouldn't switch selection if
    // box selected
    (!app.state.selectedLinearElement?.isEditing ||
      !pointerDownState.boxSelection.hasOccurred) &&
    // hitElement can be set when alt + ctrl to toggle lasso and we will
    // just respect the selected elements from lasso instead
    app.state.activeTool.type !== "lasso"
  ) {
    // when inside line editor, shift selects points instead
    if (childEvent.shiftKey && !app.state.selectedLinearElement?.isEditing) {
      if (app.state.selectedElementIds[hitElement.id]) {
        if (isSelectedViaGroup(app.state, hitElement)) {
          app.setState((_prevState) => {
            const nextSelectedElementIds = {
              ..._prevState.selectedElementIds,
            };

            // We want to unselect all groups hitElement is part of
            // as well as all elements that are part of the groups
            // hitElement is part of
            for (const groupedElement of hitElement.groupIds.flatMap(
              (groupId) =>
                getElementsInGroup(app.scene.getNonDeletedElements(), groupId),
            )) {
              delete nextSelectedElementIds[groupedElement.id];
            }

            return {
              selectedGroupIds: {
                ..._prevState.selectedElementIds,
                ...hitElement.groupIds
                  .map((gId) => ({ [gId]: false }))
                  .reduce((prev, acc) => ({ ...prev, ...acc }), {}),
              },
              selectedElementIds: makeNextSelectedElementIds(
                nextSelectedElementIds,
                _prevState,
              ),
            };
          });
          // if not dragging a linear element point (outside editor)
        } else if (!app.state.selectedLinearElement?.isDragging) {
          // remove element from selection while
          // keeping prev elements selected

          app.setState((prevState) => {
            const newSelectedElementIds = {
              ...prevState.selectedElementIds,
            };
            delete newSelectedElementIds[hitElement!.id];
            const newSelectedElements = getSelectedElements(
              app.scene.getNonDeletedElements(),
              { selectedElementIds: newSelectedElementIds },
            );

            return {
              ...selectGroupsForSelectedElements(
                {
                  editingGroupId: prevState.editingGroupId,
                  selectedElementIds: newSelectedElementIds,
                },
                app.scene.getNonDeletedElements(),
                prevState,
                app,
              ),
              // set selectedLinearElement only if thats the only element selected
              selectedLinearElement:
                newSelectedElements.length === 1 &&
                isLinearElement(newSelectedElements[0])
                  ? new LinearElementEditor(
                      newSelectedElements[0],
                      app.scene.getNonDeletedElementsMap(),
                    )
                  : prevState.selectedLinearElement,
            };
          });
        }
      } else if (
        hitElement.frameId &&
        app.state.selectedElementIds[hitElement.frameId]
      ) {
        // when hitElement is part of a selected frame, deselect the frame
        // to avoid frame and containing elements selected simultaneously
        app.setState((prevState) => {
          const nextSelectedElementIds: {
            [id: string]: true;
          } = {
            ...prevState.selectedElementIds,
            [hitElement.id]: true,
          };
          // deselect the frame
          delete nextSelectedElementIds[hitElement.frameId!];

          // deselect groups containing the frame
          (app.scene.getElement(hitElement.frameId!)?.groupIds ?? [])
            .flatMap((gid) =>
              getElementsInGroup(app.scene.getNonDeletedElements(), gid),
            )
            .forEach((element) => {
              delete nextSelectedElementIds[element.id];
            });

          return {
            ...selectGroupsForSelectedElements(
              {
                editingGroupId: prevState.editingGroupId,
                selectedElementIds: nextSelectedElementIds,
              },
              app.scene.getNonDeletedElements(),
              prevState,
              app,
            ),
            showHyperlinkPopup:
              hitElement.link || isEmbeddableElement(hitElement)
                ? "info"
                : false,
          };
        });
      } else {
        // add element to selection while keeping prev elements selected
        app.setState((_prevState) => ({
          selectedElementIds: makeNextSelectedElementIds(
            {
              ..._prevState.selectedElementIds,
              [hitElement!.id]: true,
            },
            _prevState,
          ),
        }));
      }
    } else {
      app.setState((prevState) => ({
        ...selectGroupsForSelectedElements(
          {
            editingGroupId: prevState.editingGroupId,
            selectedElementIds: { [hitElement.id]: true },
          },
          app.scene.getNonDeletedElements(),
          prevState,
          app,
        ),
        selectedLinearElement:
          isLinearElement(hitElement) &&
          // Don't set `selectedLinearElement` if its same as the hitElement, this is mainly to prevent resetting the `hoverPointIndex` to -1.
          // Future we should update the API to take care of setting the correct `hoverPointIndex` when initialized
          prevState.selectedLinearElement?.elementId !== hitElement.id
            ? new LinearElementEditor(
                hitElement,
                app.scene.getNonDeletedElementsMap(),
              )
            : prevState.selectedLinearElement,
      }));
    }
  }

  if (
    // do not clear selection if lasso is active
    app.state.activeTool.type !== "lasso" &&
    // not elbow midpoint dragged
    !(hitElement && isElbowArrow(hitElement)) &&
    // not dragged
    !pointerDownState.drag.hasOccurred &&
    // not resized
    !app.state.isResizing &&
    // only hitting the bounding box of the previous hit element
    ((hitElement &&
      hitElementBoundingBoxOnly(
        {
          point: pointFrom(
            pointerDownState.origin.x,
            pointerDownState.origin.y,
          ),
          element: hitElement,
          elementsMap,
          threshold: app.getElementHitThreshold(hitElement),
          frameNameBound: isFrameLikeElement(hitElement)
            ? app.frameNameBoundsCache.get(hitElement)
            : null,
        },
        elementsMap,
      )) ||
      (!hitElement &&
        pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements))
  ) {
    if (app.state.selectedLinearElement?.isEditing) {
      // Exit editing mode but keep the element selected
      app.actionManager.executeAction(actionToggleLinearEditor);
    } else {
      // Deselect selected elements
      app.setState({
        selectedElementIds: makeNextSelectedElementIds({}, app.state),
        selectedGroupIds: {},
        editingGroupId: null,
        activeEmbeddable: null,
      });
    }
    // reset cursor
    setCursor(app.interactiveCanvas, CURSOR_TYPE.AUTO);
    return true;
  }

  return false;
};
