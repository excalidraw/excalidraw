import {
  CURSOR_TYPE,
  DEFAULT_COLLISION_THRESHOLD,
  DEFAULT_TRANSFORM_HANDLE_SPACING,
  DRAGGING_THRESHOLD,
  getGridPoint,
  isSelectionLikeTool,
  KEYS,
  shouldMaintainAspectRatio,
  shouldResizeFromCenter,
  shouldRotateWithDiscreteAngle,
  tupleToCoors,
} from "@excalidraw/common";
import {
  cropElement,
  editGroupForSelectedElement,
  getCommonBounds,
  getElementsInGroup,
  getElementsInResizingFrame,
  getElementWithTransformHandleType,
  getFrameChildren,
  getResizeArrowDirection,
  getResizeOffsetXY,
  getTransformHandleTypeFromCoords,
  handleFocusPointPointerDown,
  hitElementBoundingBoxOnly,
  isBindingElement,
  isElbowArrow,
  isElementInGroup,
  isEmbeddableElement,
  isFrameLikeElement,
  isImageElement,
  isInitializedImageElement,
  isLinearElement,
  isNonDeletedElement,
  isSelectedViaGroup,
  isStickyNoteElement,
  LinearElementEditor,
  makeNextSelectedElementIds,
  selectGroupsForSelectedElements,
  transformElements,
  updateBoundElements,
} from "@excalidraw/element";
import { pointDistance, pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { actionToggleLinearEditor } from "../actions";
import { getSelectedElements } from "../scene";

import { snapResizingElements } from "../snapping";

import type React from "react";
import type { PointerDownState } from "../types";
import type App from "./App";

/**
 * The selection tool's (and the lasso's) selection: what a pointer down
 * selects, what a click (a pointer up without a drag) does to the selection —
 * including alt-click cycling through the overlapping elements — and the
 * selection's transform handles (resizing, rotating, cropping).
 */
export class AppSelectionTool {
  constructor(private app: App) {}

  clearSelectionIfNotUsingSelection = (): void => {
    if (!isSelectionLikeTool(this.app.state.activeTool.type)) {
      this.app.setState({
        selectedElementIds: makeNextSelectedElementIds({}, this.app.state),
        selectedGroupIds: {},
        editingGroupId: null,
        activeEmbeddable: null,
      });
    }
  };

  /**
   * @returns whether the pointer event has been completely handled
   */
  handleSelectionOnPointerDown = (
    event: React.PointerEvent<HTMLElement>,
    pointerDownState: PointerDownState,
  ): boolean => {
    if (isSelectionLikeTool(this.app.state.activeTool.type)) {
      if (this.app.duplicate.hitEditedElement(pointerDownState)) {
        return false;
      }

      const elements = this.app.scene.getNonDeletedElements();
      const elementsMap = this.app.scene.getNonDeletedElementsMap();
      const selectedElements = this.app.scene.getSelectedElements(
        this.app.state,
      );

      if (
        selectedElements.length === 1 &&
        !this.app.state.selectedLinearElement?.isEditing &&
        !isElbowArrow(selectedElements[0]) &&
        !(
          isLinearElement(selectedElements[0]) &&
          (this.app.editorInterface.userAgent.isMobileDevice ||
            selectedElements[0].points.length === 2)
        ) &&
        !(
          this.app.state.selectedLinearElement &&
          this.app.state.selectedLinearElement.hoverPointIndex !== -1
        )
      ) {
        const elementWithTransformHandleType =
          getElementWithTransformHandleType(
            elements,
            this.app.state,
            pointerDownState.origin.x,
            pointerDownState.origin.y,
            this.app.state.zoom,
            event.pointerType,
            this.app.scene.getNonDeletedElementsMap(),
            this.app.editorInterface,
          );
        if (elementWithTransformHandleType != null) {
          if (
            elementWithTransformHandleType.transformHandleType === "rotation"
          ) {
            this.app.setState({
              resizingElement: elementWithTransformHandleType.element,
            });
            pointerDownState.resize.handleType =
              elementWithTransformHandleType.transformHandleType;
          } else if (this.app.state.croppingElementId) {
            pointerDownState.resize.handleType =
              elementWithTransformHandleType.transformHandleType;
          } else {
            this.app.setState({
              resizingElement: elementWithTransformHandleType.element,
            });
            pointerDownState.resize.handleType =
              elementWithTransformHandleType.transformHandleType;
          }
        }
      } else if (selectedElements.length > 1) {
        pointerDownState.resize.handleType = getTransformHandleTypeFromCoords(
          getCommonBounds(selectedElements),
          pointerDownState.origin.x,
          pointerDownState.origin.y,
          this.app.state.zoom,
          event.pointerType,
          this.app.editorInterface,
        );
      }
      if (pointerDownState.resize.handleType) {
        pointerDownState.resize.isResizing = true;
        pointerDownState.resize.offset = tupleToCoors(
          getResizeOffsetXY(
            pointerDownState.resize.handleType,
            selectedElements,
            elementsMap,
            pointerDownState.origin.x,
            pointerDownState.origin.y,
          ),
        );
        if (
          selectedElements.length === 1 &&
          isLinearElement(selectedElements[0]) &&
          selectedElements[0].points.length === 2
        ) {
          pointerDownState.resize.arrowDirection = getResizeArrowDirection(
            pointerDownState.resize.handleType,
            selectedElements[0],
          );
        }
        // an alt-click on a resize handle (over the selected element) cycles
        // the selection too — alt-resizing starts past the drag threshold
        if (pointerDownState.resize.handleType !== "rotation") {
          pointerDownState.hit.cycleTarget = this.getSelectionCycleTarget(
            event,
            this.app.getElementsAtPosition(
              pointerDownState.origin.x,
              pointerDownState.origin.y,
            ),
          );
        }
      } else {
        if (this.app.state.selectedLinearElement) {
          const linearElementEditor = this.app.state.selectedLinearElement;
          const ret = LinearElementEditor.handlePointerDown(
            event,
            this.app,
            this.app.store,
            pointerDownState.origin,
            linearElementEditor,
            this.app.scene,
          );

          if (ret.hitElement) {
            pointerDownState.hit.element = ret.hitElement;
          }
          pointerDownState.hit.arrowLabel = ret.hitBoundText;
          if (ret.linearElementEditor) {
            this.app.setState({
              selectedLinearElement: ret.linearElementEditor,
            });
          }
          if (ret.didAddPoint) {
            return true;
          }

          // Also check at current pointer position if focus point is being hovered
          // (in case we're clicking directly without a prior move event)
          const elementsMap = this.app.scene.getNonDeletedElementsMap();
          const arrow = LinearElementEditor.getElement(
            linearElementEditor.elementId,
            elementsMap,
          ) as any;

          if (arrow && isBindingElement(arrow)) {
            const {
              hitFocusPoint,
              pointerOffset,
              arrowOtherEndpointInitialBinding,
            } = handleFocusPointPointerDown(
              arrow,
              pointerDownState,
              elementsMap,
              this.app.state,
            );

            // If focus point is hit, update state and prevent element selection
            if (hitFocusPoint) {
              this.app.setState({
                selectedLinearElement: {
                  ...linearElementEditor,
                  hoveredFocusPointBinding: hitFocusPoint,
                  draggedFocusPointBinding: hitFocusPoint,
                  pointerOffset,
                  initialState: {
                    ...linearElementEditor.initialState,
                    arrowOtherEndpointInitialBinding,
                  },
                },
              });
              return false;
            }
          }
        }

        const allHitElements = this.app.getElementsAtPosition(
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
        const hitElementMightBeLocked = this.app.getElementAtPosition(
          pointerDownState.origin.x,
          pointerDownState.origin.y,
          {
            allHitElements,
          },
        );

        if (
          !hitElementMightBeLocked ||
          hitElementMightBeLocked.id !== this.app.state.activeLockedId
        ) {
          this.app.setState({
            activeLockedId: null,
          });
        }

        if (
          hitElementMightBeLocked &&
          hitElementMightBeLocked.locked &&
          !unlockedHitElements.some(
            (el) => this.app.state.selectedElementIds[el.id],
          )
        ) {
          pointerDownState.hit.element = null;
        } else {
          // hitElement may already be set above, so check first
          pointerDownState.hit.element =
            pointerDownState.hit.element ??
            this.app.getElementAtPosition(
              pointerDownState.origin.x,
              pointerDownState.origin.y,
            );
        }

        this.app.hitLinkElement = this.app.getElementLinkAtPosition(
          pointerDownState.origin,
          hitElementMightBeLocked,
        );

        if (this.app.hitLinkElement) {
          return true;
        }

        if (
          this.app.state.croppingElementId &&
          pointerDownState.hit.element?.id !== this.app.state.croppingElementId
        ) {
          this.app.finishImageCropping();
        }

        if (pointerDownState.hit.element) {
          // Early return if pointer is hitting link icon
          const hitLinkElement = this.app.getElementLinkAtPosition(
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

        pointerDownState.hit.cycleTarget = this.getSelectionCycleTarget(
          event,
          unlockedHitElements,
        );
        // the selection cycles on pointerup — or, on an alt-drag, is what's
        // duplicated
        if (pointerDownState.hit.cycleTarget) {
          this.app.setState({
            previousSelectedElementIds: this.app.state.selectedElementIds,
          });
          return false;
        }

        const hitElement = pointerDownState.hit.element;
        const someHitElementIsSelected =
          pointerDownState.hit.allHitElements.some((element) =>
            this.isASelectedElement(element),
          ) ||
          // the selected linear element's point handles, midpoint knob and
          // label extend beyond its own hit area, so a hit reported by
          // `LinearElementEditor.handlePointerDown` counts even when the
          // position-based hit test above missed the element
          (hitElement !== null && this.isASelectedElement(hitElement));
        if (
          (hitElement === null || !someHitElementIsSelected) &&
          !event.shiftKey &&
          !pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements &&
          (!this.app.state.selectedLinearElement?.isEditing ||
            (hitElement &&
              hitElement?.id !==
                this.app.state.selectedLinearElement?.elementId))
        ) {
          this.clearSelection(hitElement);
        }

        if (this.app.state.selectedLinearElement?.isEditing) {
          this.app.setState((prevState) => ({
            selectedLinearElement: prevState.selectedLinearElement
              ? {
                  ...prevState.selectedLinearElement,
                  isEditing:
                    !!hitElement &&
                    hitElement.id ===
                      this.app.state.selectedLinearElement?.elementId,
                }
              : null,
            selectedElementIds: prevState.selectedLinearElement
              ? makeNextSelectedElementIds(
                  {
                    [prevState.selectedLinearElement.elementId]: true,
                  },
                  this.app.state,
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
              if (this.app.state.openDialog?.name === "elementLinkSelector") {
                this.app.setOpenDialog(null);
              }
              this.app.lassoTrail.startPath(
                pointerDownState.origin.x,
                pointerDownState.origin.y,
                event.shiftKey,
              );
              this.app.setActiveTool({ type: "lasso", fromSelection: true });
              return false;
            }
            if (!this.app.state.selectedElementIds[hitElement.id]) {
              pointerDownState.hit.wasAddedToSelection = true;
            }
            this.app.setState((prevState) => ({
              ...editGroupForSelectedElement(prevState, hitElement),
              previousSelectedElementIds: this.app.state.selectedElementIds,
            }));
            // mark as not completely handled so as to allow dragging etc.
            return false;
          }

          // deselect if item is selected
          // if shift is not clicked, this will always return true
          // otherwise, it will trigger selection based on current
          // state of the box
          if (!this.app.state.selectedElementIds[hitElement.id]) {
            // if we are currently editing a group, exiting editing mode and deselect the group.
            if (
              this.app.state.editingGroupId &&
              !isElementInGroup(hitElement, this.app.state.editingGroupId)
            ) {
              this.app.setState({
                selectedElementIds: makeNextSelectedElementIds(
                  {},
                  this.app.state,
                ),
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
              this.app.setState((prevState) => {
                let nextSelectedElementIds: { [id: string]: true } = {
                  ...prevState.selectedElementIds,
                  [hitElement.id]: true,
                };

                const previouslySelectedElements: ExcalidrawElement[] = [];

                Object.keys(prevState.selectedElementIds).forEach((id) => {
                  const element = this.app.scene.getElement(id);
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
                          this.app.scene.getNonDeletedElements(),
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
                              this.app.scene.getNonDeletedElements(),
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
                    this.app.scene.getNonDeletedElements(),
                    prevState,
                    this.app,
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

        this.app.setState({
          previousSelectedElementIds: this.app.state.selectedElementIds,
        });
      }
    }
    return false;
  };

  maybeHandleCrop = (
    pointerDownState: PointerDownState,
    event: MouseEvent | KeyboardEvent,
  ): boolean => {
    // to crop, we must already be in the cropping mode, where croppingElement has been set
    if (!this.app.state.croppingElementId) {
      return false;
    }

    const transformHandleType = pointerDownState.resize.handleType;
    const pointerCoords = pointerDownState.lastCoords;
    const [x, y] = getGridPoint(
      pointerCoords.x - pointerDownState.resize.offset.x,
      pointerCoords.y - pointerDownState.resize.offset.y,
      event[KEYS.CTRL_OR_CMD] ? null : this.app.getEffectiveGridSize(),
    );

    const croppingElement = this.app.scene
      .getNonDeletedElementsMap()
      .get(this.app.state.croppingElementId);

    if (
      transformHandleType &&
      croppingElement &&
      isImageElement(croppingElement)
    ) {
      const croppingAtStateStart = pointerDownState.originalElements.get(
        croppingElement.id,
      );

      const image =
        isInitializedImageElement(croppingElement) &&
        this.app.imageCache.get(croppingElement.fileId)?.image;

      if (
        croppingAtStateStart &&
        isImageElement(croppingAtStateStart) &&
        image &&
        !(image instanceof Promise)
      ) {
        const [gridX, gridY] = getGridPoint(
          pointerCoords.x,
          pointerCoords.y,
          event[KEYS.CTRL_OR_CMD] ? null : this.app.getEffectiveGridSize(),
        );

        const dragOffset = {
          x: gridX - pointerDownState.originInGrid.x,
          y: gridY - pointerDownState.originInGrid.y,
        };

        this.app.maybeCacheReferenceSnapPoints(event, [croppingElement]);

        const { snapOffset, snapLines } = snapResizingElements(
          [croppingElement],
          [croppingAtStateStart],
          this.app,
          event,
          dragOffset,
          transformHandleType,
        );

        this.app.scene.mutateElement(
          croppingElement,
          cropElement(
            croppingElement,
            this.app.scene.getNonDeletedElementsMap(),
            transformHandleType,
            image.naturalWidth,
            image.naturalHeight,
            x + snapOffset.x,
            y + snapOffset.y,
            event.shiftKey
              ? croppingAtStateStart.width / croppingAtStateStart.height
              : undefined,
          ),
        );

        updateBoundElements(croppingElement, this.app.scene);

        this.app.setState({
          isCropping: transformHandleType && transformHandleType !== "rotation",
          snapLines,
        });
      }

      return true;
    }

    return false;
  };

  maybeHandleResize = (
    pointerDownState: PointerDownState,
    event: MouseEvent | KeyboardEvent,
  ): boolean => {
    const selectedElements = this.app.scene.getSelectedElements(this.app.state);
    const selectedFrames = selectedElements.filter(isFrameLikeElement);

    const transformHandleType = pointerDownState.resize.handleType;

    if (
      // Frames cannot be rotated.
      (selectedFrames.length > 0 && transformHandleType === "rotation") ||
      // Elbow arrows cannot be transformed (resized or rotated).
      (selectedElements.length === 1 && isElbowArrow(selectedElements[0])) ||
      // Do not resize when in crop mode
      this.app.state.croppingElementId
    ) {
      return false;
    }

    // an alt-resize resizes only once it's a deliberate drag, leaving
    // alt-clicks to cycle the selection
    if (
      event.altKey &&
      transformHandleType &&
      transformHandleType !== "rotation" &&
      !this.app.state.isResizing &&
      pointDistance(
        pointFrom(pointerDownState.origin.x, pointerDownState.origin.y),
        pointFrom(pointerDownState.lastCoords.x, pointerDownState.lastCoords.y),
      ) *
        this.app.state.zoom.value <
        DRAGGING_THRESHOLD
    ) {
      return true;
    }

    this.app.activeResizeHandle =
      transformHandleType && transformHandleType !== "rotation"
        ? transformHandleType
        : null;
    this.app.setState({
      // TODO: rename this state field to "isScaling" to distinguish
      // it from the generic "isResizing" which includes scaling and
      // rotating
      isResizing: transformHandleType && transformHandleType !== "rotation",
      isRotating: transformHandleType === "rotation",
      activeEmbeddable: null,
    });
    const pointerCoords = pointerDownState.lastCoords;
    let [resizeX, resizeY] = getGridPoint(
      pointerCoords.x - pointerDownState.resize.offset.x,
      pointerCoords.y - pointerDownState.resize.offset.y,
      event[KEYS.CTRL_OR_CMD] ? null : this.app.getEffectiveGridSize(),
    );

    const frameElementsOffsetsMap = new Map<
      string,
      {
        x: number;
        y: number;
      }
    >();

    selectedFrames.forEach((frame) => {
      const elementsInFrame = getFrameChildren(
        this.app.scene.getNonDeletedElements(),
        frame.id,
      );

      elementsInFrame.forEach((element) => {
        frameElementsOffsetsMap.set(frame.id + element.id, {
          x: element.x - frame.x,
          y: element.y - frame.y,
        });
      });
    });

    // check needed for avoiding flickering when a key gets pressed
    // during dragging
    if (!this.app.state.selectedElementsAreBeingDragged) {
      const [gridX, gridY] = getGridPoint(
        pointerCoords.x,
        pointerCoords.y,
        event[KEYS.CTRL_OR_CMD] ? null : this.app.getEffectiveGridSize(),
      );

      const dragOffset = {
        x: gridX - pointerDownState.originInGrid.x,
        y: gridY - pointerDownState.originInGrid.y,
      };

      const originalElements = [...pointerDownState.originalElements.values()];

      this.app.maybeCacheReferenceSnapPoints(event, selectedElements);

      const { snapOffset, snapLines } = snapResizingElements(
        selectedElements,
        getSelectedElements(originalElements, this.app.state),
        this.app,
        event,
        dragOffset,
        transformHandleType,
      );

      resizeX += snapOffset.x;
      resizeY += snapOffset.y;

      this.app.setState({
        snapLines,
      });
    }

    // images are proportional by default, and so is a sticky note's corner
    // (its label's font ceiling scales with it); Shift frees them. A note's
    // edges stay free by default — Shift constrains them like any shape.
    const proportionalByDefault =
      selectedElements.some((element) => isImageElement(element)) ||
      (selectedElements.length === 1 &&
        isStickyNoteElement(selectedElements[0]) &&
        typeof transformHandleType === "string" &&
        transformHandleType.length === 2);

    if (
      transformElements(
        pointerDownState.originalElements,
        transformHandleType,
        selectedElements,
        this.app.scene,
        shouldRotateWithDiscreteAngle(event),
        shouldResizeFromCenter(event),
        proportionalByDefault
          ? !shouldMaintainAspectRatio(event)
          : shouldMaintainAspectRatio(event),
        resizeX,
        resizeY,
        pointerDownState.resize.center.x,
        pointerDownState.resize.center.y,
      )
    ) {
      const elementsToHighlight = new Set<NonDeletedExcalidrawElement>();
      selectedFrames.forEach((frame) => {
        getElementsInResizingFrame(
          this.app.scene.getNonDeletedElements(),
          frame,
          this.app.state,
          this.app.scene.getNonDeletedElementsMap(),
        ).forEach((element) => {
          if (isNonDeletedElement(element)) {
            elementsToHighlight.add(element);
          } else {
            // SAFETY: This should never happen, but log it just in case
            console.error(
              "[NONDELETED][INVARIANT] Skipped highlighting deleted element in resizing frame",
            );
          }
        });
      });

      this.app.setState({
        elementsToHighlight: [...elementsToHighlight],
      });

      return true;
    }
    return false;
  };

  /**
   * Updates the selection on a click (no drag): the element below the
   * selected one on an alt-click, the clicked element added to or removed
   * from the selection with shift, or selected, and the selection cleared
   * by a click hitting only a bounding box.
   *
   * @returns whether the pointer event has been completely handled
   */
  handleSelectionOnPointerUp = (
    childEvent: PointerEvent,
    pointerDownState: PointerDownState,
    elementsMap: NonDeletedSceneElementsMap,
  ): boolean => {
    const hitElement = pointerDownState.hit.element;

    // alt-click: select the element below the selected one
    const cycleTarget =
      !pointerDownState.drag.hasOccurred && !this.app.state.isResizing
        ? pointerDownState.hit.cycleTarget
        : null;
    if (cycleTarget) {
      this.app.setState((prevState) => {
        const nextState = selectGroupsForSelectedElements(
          {
            editingGroupId: prevState.editingGroupId,
            selectedElementIds: { [cycleTarget.id]: true },
          },
          this.app.scene.getNonDeletedElements(),
          prevState,
          this.app,
        );
        return {
          ...nextState,
          selectedLinearElement:
            isLinearElement(cycleTarget) &&
            Object.keys(nextState.selectedElementIds).length === 1
              ? prevState.selectedLinearElement?.elementId === cycleTarget.id
                ? prevState.selectedLinearElement
                : new LinearElementEditor(
                    cycleTarget,
                    this.app.scene.getNonDeletedElementsMap(),
                  )
              : null,
          showHyperlinkPopup: false,
        };
      });
    }

    if (
      !cycleTarget &&
      hitElement &&
      !pointerDownState.drag.hasOccurred &&
      !pointerDownState.hit.wasAddedToSelection &&
      // if we're editing a line, pointerup shouldn't switch selection if
      // box selected
      (!this.app.state.selectedLinearElement?.isEditing ||
        !pointerDownState.boxSelection.hasOccurred) &&
      // hitElement can be set when alt + ctrl to toggle lasso and we will
      // just respect the selected elements from lasso instead
      this.app.state.activeTool.type !== "lasso"
    ) {
      // when inside line editor, shift selects points instead
      if (
        childEvent.shiftKey &&
        !this.app.state.selectedLinearElement?.isEditing
      ) {
        if (this.app.state.selectedElementIds[hitElement.id]) {
          if (isSelectedViaGroup(this.app.state, hitElement)) {
            this.app.setState((_prevState) => {
              const nextSelectedElementIds = {
                ..._prevState.selectedElementIds,
              };

              // We want to unselect all groups hitElement is part of
              // as well as all elements that are part of the groups
              // hitElement is part of
              for (const groupedElement of hitElement.groupIds.flatMap(
                (groupId) =>
                  getElementsInGroup(
                    this.app.scene.getNonDeletedElements(),
                    groupId,
                  ),
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
          } else if (!this.app.state.selectedLinearElement?.isDragging) {
            // remove element from selection while
            // keeping prev elements selected

            this.app.setState((prevState) => {
              const newSelectedElementIds = {
                ...prevState.selectedElementIds,
              };
              delete newSelectedElementIds[hitElement!.id];
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
        } else if (
          hitElement.frameId &&
          this.app.state.selectedElementIds[hitElement.frameId]
        ) {
          // when hitElement is part of a selected frame, deselect the frame
          // to avoid frame and containing elements selected simultaneously
          this.app.setState((prevState) => {
            const nextSelectedElementIds: {
              [id: string]: true;
            } = {
              ...prevState.selectedElementIds,
              [hitElement.id]: true,
            };
            // deselect the frame
            delete nextSelectedElementIds[hitElement.frameId!];

            // deselect groups containing the frame
            (this.app.scene.getElement(hitElement.frameId!)?.groupIds ?? [])
              .flatMap((gid) =>
                getElementsInGroup(this.app.scene.getNonDeletedElements(), gid),
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
                this.app.scene.getNonDeletedElements(),
                prevState,
                this.app,
              ),
              showHyperlinkPopup:
                hitElement.link || isEmbeddableElement(hitElement)
                  ? "info"
                  : false,
            };
          });
        } else {
          // add element to selection while keeping prev elements selected
          this.app.setState((_prevState) => ({
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
        this.app.setState((prevState) => ({
          ...selectGroupsForSelectedElements(
            {
              editingGroupId: prevState.editingGroupId,
              selectedElementIds: { [hitElement.id]: true },
            },
            this.app.scene.getNonDeletedElements(),
            prevState,
            this.app,
          ),
          selectedLinearElement:
            isLinearElement(hitElement) &&
            // Don't set `selectedLinearElement` if its same as the hitElement, this is mainly to prevent resetting the `hoverPointIndex` to -1.
            // Future we should update the API to take care of setting the correct `hoverPointIndex` when initialized
            prevState.selectedLinearElement?.elementId !== hitElement.id
              ? new LinearElementEditor(
                  hitElement,
                  this.app.scene.getNonDeletedElementsMap(),
                )
              : prevState.selectedLinearElement,
        }));
      }
    }

    if (
      !cycleTarget &&
      // do not clear selection if lasso is active
      this.app.state.activeTool.type !== "lasso" &&
      // not elbow midpoint dragged
      !(hitElement && isElbowArrow(hitElement)) &&
      // not dragged
      !pointerDownState.drag.hasOccurred &&
      // not resized
      !this.app.state.isResizing &&
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
            threshold: this.app.getElementHitThreshold(hitElement),
            frameNameBound: isFrameLikeElement(hitElement)
              ? this.app.frameNameBoundsCache.get(hitElement)
              : null,
          },
          elementsMap,
        )) ||
        (!hitElement &&
          pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements))
    ) {
      if (this.app.state.selectedLinearElement?.isEditing) {
        // Exit editing mode but keep the element selected
        this.app.actionManager.executeAction(actionToggleLinearEditor);
      } else {
        // Deselect selected elements
        this.app.setState({
          selectedElementIds: makeNextSelectedElementIds({}, this.app.state),
          selectedGroupIds: {},
          editingGroupId: null,
          activeEmbeddable: null,
        });
      }
      // reset cursor
      this.app.cursor.set(CURSOR_TYPE.AUTO);
      return true;
    }

    return false;
  };

  clearSelection(hitElement: ExcalidrawElement | null): void {
    this.app.setState((prevState) => ({
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
    this.app.setState({
      selectedElementIds: makeNextSelectedElementIds({}, this.app.state),
      activeEmbeddable: null,
      previousSelectedElementIds: this.app.state.selectedElementIds,
      selectedLinearElement: null,
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

  /**
   * The element an alt-click selects: the selectable unit (an element, or
   * the group a click would select) below the selected one among the hit
   * elements, wrapping around to the topmost — or `null` unless it's an
   * alt-click and exactly one unit is selected and it's under the pointer.
   * Inside an edited group, it cycles through the group's elements only,
   * never leaving the group.
   */
  private getSelectionCycleTarget(
    event: React.PointerEvent<HTMLElement>,
    hitElements: readonly NonDeleted<ExcalidrawElement>[],
  ): NonDeleted<ExcalidrawElement> | null {
    if (
      !event.altKey ||
      event[KEYS.CTRL_OR_CMD] ||
      event.shiftKey ||
      this.app.state.selectedLinearElement?.isEditing ||
      this.app.state.croppingElementId
    ) {
      return null;
    }

    const { editingGroupId } = this.app.state;
    const unitOf = (element: ExcalidrawElement) => {
      const editingGroupIndex = editingGroupId
        ? element.groupIds.indexOf(editingGroupId)
        : -1;
      const groupIds =
        editingGroupIndex > -1
          ? element.groupIds.slice(0, editingGroupIndex)
          : element.groupIds;
      return groupIds.length ? groupIds[groupIds.length - 1] : element.id;
    };
    if (editingGroupId) {
      hitElements = hitElements.filter((element) =>
        isElementInGroup(element, editingGroupId),
      );
    }

    const selectedUnits = new Set(
      this.app.scene.getSelectedElements(this.app.state).map(unitOf),
    );
    if (selectedUnits.size !== 1) {
      return null;
    }
    const [selectedUnit] = selectedUnits;

    // topmost first, each unit at its topmost hit element
    const units = new Map<string, NonDeleted<ExcalidrawElement>>();
    for (let index = hitElements.length - 1; index > -1; index--) {
      const unit = unitOf(hitElements[index]);
      if (!units.has(unit)) {
        units.set(unit, hitElements[index]);
      }
    }
    const order = [...units.keys()];
    const selectedIndex = order.indexOf(selectedUnit);
    if (selectedIndex === -1) {
      return null;
    }
    // (the selected unit itself if alone)
    return units.get(order[(selectedIndex + 1) % order.length])!;
  }
}
