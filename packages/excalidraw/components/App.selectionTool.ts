import {
  CURSOR_TYPE,
  DRAGGING_THRESHOLD,
  getGridPoint,
  isSelectionLikeTool,
  KEYS,
  shouldMaintainAspectRatio,
  shouldResizeFromCenter,
  shouldRotateWithDiscreteAngle,
  tupleToCoors,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  addElementsToFrame,
  cropElement,
  dragSelectedElements,
  getCommonBounds,
  getCommonFrameId,
  getElementAbsoluteCoords,
  getElementsInGroup,
  getElementsInResizingFrame,
  getElementWithTransformHandleType,
  getFrameChildren,
  getResizeArrowDirection,
  getResizeOffsetXY,
  getTransformHandleTypeFromCoords,
  getUncroppedWidthAndHeight,
  handleFocusPointPointerDown,
  hitElementBoundingBoxOnly,
  isBindingElement,
  isElbowArrow,
  isElementInFrame,
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
  transformElements,
  updateBoundElements,
  updateFrameMembershipOfSelectedElements,
} from "@excalidraw/element";
import {
  clamp,
  pointDistance,
  pointFrom,
  pointRotateRads,
  vector,
  vectorDot,
  vectorFromPoint,
  vectorNormalize,
  vectorSubtract,
} from "@excalidraw/math";

import type { TransformHandleType } from "@excalidraw/element";
import type {
  ExcalidrawElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
  PointerType,
} from "@excalidraw/element/types";

import { actionToggleLinearEditor } from "../actions";
import {
  getElementsWithinSelection,
  getSelectedElements,
  isSomeElementSelected,
} from "../scene";

import { snapDraggedElements, snapResizingElements } from "../snapping";

import { selectGroupsForSelectedElements } from "./App.selection";

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
      this.app.selection.clear();
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

      const elementsMap = this.app.scene.getNonDeletedElementsMap();
      const selectedElements = this.app.scene.getSelectedElements(
        this.app.state,
      );

      const transformHandle = this.getTransformHandleAt(
        selectedElements,
        pointerDownState.origin.x,
        pointerDownState.origin.y,
        event.pointerType,
      );
      if (transformHandle) {
        // (in the crop editor, the handles crop the image rather than resize it)
        if (
          transformHandle.element &&
          (transformHandle.transformHandleType === "rotation" ||
            !this.app.state.croppingElementId)
        ) {
          this.app.setState({ resizingElement: transformHandle.element });
        }
        pointerDownState.resize.handleType =
          transformHandle.transformHandleType;
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
            this.app.selection.isASelectedElement(element),
          ) ||
          // the selected linear element's point handles, midpoint knob and
          // label extend beyond its own hit area, so a hit reported by
          // `LinearElementEditor.handlePointerDown` counts even when the
          // position-based hit test above missed the element
          (hitElement !== null &&
            this.app.selection.isASelectedElement(hitElement));
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
            this.app.setState({
              previousSelectedElementIds: this.app.state.selectedElementIds,
            });
            this.app.selection.select(hitElement, { deep: true });
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
              this.app.selection.clear();
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
              this.app.selection.add(hitElement);
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
   * Drags the selection (or, in the crop editor, the image within its crop) —
   * duplicating it on an alt-drag past the drag threshold.
   *
   * @returns whether the pointer event has been completely handled
   */
  handleSelectionDragOnPointerMove = (
    event: PointerEvent,
    pointerDownState: PointerDownState,
    pointerCoords: { x: number; y: number },
    lastPointerCoords: { x: number; y: number },
    elementsMap: NonDeletedSceneElementsMap,
  ): boolean => {
    const hasHitASelectedElement = pointerDownState.hit.allHitElements.some(
      (element) => this.app.selection.isASelectedElement(element),
    );

    const isSelectingPointsInLineEditor =
      this.app.state.selectedLinearElement?.isEditing &&
      event.shiftKey &&
      this.app.state.selectedLinearElement.elementId ===
        pointerDownState.hit.element?.id;

    if (
      (hasHitASelectedElement ||
        pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements) &&
      !isSelectingPointsInLineEditor &&
      !pointerDownState.drag.blockDragging
    ) {
      const selectedElements = this.app.scene.getSelectedElements(
        this.app.state,
      );
      if (
        selectedElements.length > 0 &&
        selectedElements.every((element) => element.locked)
      ) {
        return true;
      }

      // an alt-drag duplicates only once it's a deliberate drag, leaving
      // alt-clicks to cycle the selection
      if (
        event.altKey &&
        !pointerDownState.drag.hasOccurred &&
        pointDistance(
          pointFrom(pointerDownState.origin.x, pointerDownState.origin.y),
          pointFrom(pointerCoords.x, pointerCoords.y),
        ) *
          this.app.state.zoom.value <
          DRAGGING_THRESHOLD
      ) {
        return true;
      }

      const selectedElementsHasAFrame = selectedElements.some((e) =>
        isFrameLikeElement(e),
      );
      const frameToHighlight = selectedElementsHasAFrame
        ? null
        : this.app.getTopLayerFrameAtSceneCoords(pointerCoords, {
            currentFrameId: getCommonFrameId(selectedElements),
            excludeElementIds: this.app.state.selectedElementIds,
          });
      // Only update the state if there is a difference
      this.app.updateFrameToHighlight(frameToHighlight);

      // Marking that click was used for dragging to check
      // if elements should be deselected on pointerup
      pointerDownState.drag.hasOccurred = true;

      // prevent immediate dragging during lasso selection to avoid element displacement
      // only allow dragging if we're not in the middle of lasso selection
      // (on mobile, allow dragging if we hit an element)
      if (
        this.app.state.activeTool.type === "lasso" &&
        this.app.lassoTrail.hasCurrentTrail &&
        !(
          this.app.editorInterface.formFactor !== "desktop" &&
          pointerDownState.hit.element
        ) &&
        !this.app.state.activeTool.fromSelection
      ) {
        return true;
      }

      // Clear lasso trail when starting to drag selected elements with lasso tool
      // Only clear if we're actually dragging (not during lasso selection)
      if (
        this.app.state.activeTool.type === "lasso" &&
        selectedElements.length > 0 &&
        pointerDownState.drag.hasOccurred &&
        !this.app.state.activeTool.fromSelection
      ) {
        this.app.lassoTrail.endPath();
      }

      // prevent dragging even if we're no longer holding cmd/ctrl otherwise
      // it would have weird results (stuff jumping all over the screen)
      // Checking for editingTextElement to avoid jump while editing on mobile #6503
      if (
        selectedElements.length > 0 &&
        !pointerDownState.withCmdOrCtrl &&
        !this.app.state.editingTextElement &&
        this.app.state.activeEmbeddable?.state !== "active"
      ) {
        const dragOffset = {
          x: pointerCoords.x - pointerDownState.drag.origin.x,
          y: pointerCoords.y - pointerDownState.drag.origin.y,
        };

        const originalElements = [
          ...pointerDownState.originalElements.values(),
        ];

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
        if (this.app.state.croppingElementId) {
          const croppingElement = this.app.scene
            .getNonDeletedElementsMap()
            .get(this.app.state.croppingElementId);

          if (
            croppingElement &&
            isImageElement(croppingElement) &&
            croppingElement.crop !== null &&
            pointerDownState.hit.element === croppingElement
          ) {
            const crop = croppingElement.crop;
            const image =
              isInitializedImageElement(croppingElement) &&
              this.app.imageCache.get(croppingElement.fileId)?.image;

            if (image && !(image instanceof Promise)) {
              const uncroppedSize = getUncroppedWidthAndHeight(croppingElement);
              const instantDragOffset = vector(
                pointerCoords.x - lastPointerCoords.x,
                pointerCoords.y - lastPointerCoords.y,
              );

              // to reduce cursor:image drift, we need to take into account
              // the canvas image element scaling so we can accurately
              // track the pixels on movement
              instantDragOffset[0] *= image.naturalWidth / uncroppedSize.width;
              instantDragOffset[1] *=
                image.naturalHeight / uncroppedSize.height;

              const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
                croppingElement,
                elementsMap,
              );

              const topLeft = vectorFromPoint(
                pointRotateRads(
                  pointFrom(x1, y1),
                  pointFrom(cx, cy),
                  croppingElement.angle,
                ),
              );
              const topRight = vectorFromPoint(
                pointRotateRads(
                  pointFrom(x2, y1),
                  pointFrom(cx, cy),
                  croppingElement.angle,
                ),
              );
              const bottomLeft = vectorFromPoint(
                pointRotateRads(
                  pointFrom(x1, y2),
                  pointFrom(cx, cy),
                  croppingElement.angle,
                ),
              );
              const topEdge = vectorNormalize(
                vectorSubtract(topRight, topLeft),
              );
              const leftEdge = vectorNormalize(
                vectorSubtract(bottomLeft, topLeft),
              );

              // project instantDrafOffset onto leftEdge and topEdge to decompose
              const offsetVector = vector(
                vectorDot(instantDragOffset, topEdge),
                vectorDot(instantDragOffset, leftEdge),
              );

              const nextCrop = {
                ...crop,
                x: clamp(
                  crop.x -
                    offsetVector[0] * Math.sign(croppingElement.scale[0]),
                  0,
                  image.naturalWidth - crop.width,
                ),
                y: clamp(
                  crop.y -
                    offsetVector[1] * Math.sign(croppingElement.scale[1]),
                  0,
                  image.naturalHeight - crop.height,
                ),
              };

              this.app.scene.mutateElement(croppingElement, {
                crop: nextCrop,
              });

              return true;
            }
          }
        }

        // Snap cache *must* be synchronously popuplated before initial drag,
        // otherwise the first drag even will not snap, causing a jump before
        // it snaps to its position if previously snapped already.
        this.app.maybeCacheVisibleGaps(event, selectedElements);
        this.app.maybeCacheReferenceSnapPoints(event, selectedElements);

        const { snapOffset, snapLines } = snapDraggedElements(
          originalElements,
          dragOffset,
          this.app,
          event,
          this.app.scene.getNonDeletedElementsMap(),
        );

        this.app.setState({ snapLines });

        // when we're editing the name of a frame, we want the user to be
        // able to select and interact with the text input
        if (!this.app.state.editingFrame) {
          dragSelectedElements(
            pointerDownState,
            selectedElements,
            dragOffset,
            this.app.scene,
            snapOffset,
            event[KEYS.CTRL_OR_CMD] ? null : this.app.getEffectiveGridSize(),
          );
        }

        this.app.setState({
          selectedElementsAreBeingDragged: true,
          // element is being dragged and selectionElement that was created on pointer down
          // should be removed
          selectionElement: null,
        });

        // We duplicate the selected element if alt is pressed on pointer move
        if (event.altKey && !pointerDownState.hit.hasBeenDuplicated) {
          this.app.duplicate.duplicateDraggedSelection(pointerDownState, event);
        }

        return true;
      }
    }

    return false;
  };

  /**
   * Box-selects with the selection tool — the line editor's points, while
   * editing a line.
   */
  handleBoxSelectionOnPointerMove = (
    event: PointerEvent,
    pointerDownState: PointerDownState,
  ) => {
    if (this.app.state.activeTool.type === "selection") {
      pointerDownState.boxSelection.hasOccurred = true;

      const elements = this.app.scene.getNonDeletedElements();

      // box-select line editor points
      if (this.app.state.selectedLinearElement?.isEditing) {
        LinearElementEditor.handleBoxSelection(
          event,
          this.app.state,
          this.app.setState.bind(this.app),
          this.app.scene.getNonDeletedElementsMap(),
        );
        // regular box-select
      } else {
        let shouldReuseSelection = true;

        if (
          !event.shiftKey &&
          isSomeElementSelected(elements, this.app.state)
        ) {
          if (pointerDownState.withCmdOrCtrl && pointerDownState.hit.element) {
            this.app.setState((prevState) =>
              selectGroupsForSelectedElements(
                {
                  ...prevState,
                  selectedElementIds: {
                    [pointerDownState.hit.element!.id]: true,
                  },
                },
                this.app.scene.getNonDeletedElements(),
                prevState,
                this.app,
              ),
            );
          } else {
            shouldReuseSelection = false;
          }
        }
        const elementsWithinSelection = this.app.state.selectionElement
          ? getElementsWithinSelection(
              elements,
              this.app.state.selectionElement,
              this.app.scene.getNonDeletedElementsMap(),
              false,
              this.app.state.boxSelectionMode,
            )
          : [];

        this.app.setState((prevState) => {
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
              this.app.scene.getNonDeletedElements(),
              prevState,
              this.app,
            ),
            // select linear element only when we haven't box-selected anything else
            selectedLinearElement:
              elementsWithinSelection.length === 1 &&
              isLinearElement(elementsWithinSelection[0])
                ? new LinearElementEditor(
                    elementsWithinSelection[0],
                    this.app.scene.getNonDeletedElementsMap(),
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
   * After dragging the selection: the dragged elements join the frame they're
   * dropped in, or leave theirs (and the edited group, if they leave it).
   */
  handleSelectionDragOnPointerUp = (childEvent: PointerEvent) => {
    const sceneCoords = viewportCoordsToSceneCoords(childEvent, this.app.state);
    // update the relationships between selected elements and frames
    const selectedElements = this.app.scene.getSelectedElements(this.app.state);
    const topLayerFrame = this.app.getTopLayerFrameAtSceneCoords(sceneCoords, {
      currentFrameId: getCommonFrameId(selectedElements),
      excludeElementIds: this.app.state.selectedElementIds,
    });
    let nextElements = this.app.scene.getElementsMapIncludingDeleted();

    const updateGroupIdsAfterEditingGroup = (elements: ExcalidrawElement[]) => {
      if (elements.length > 0) {
        for (const element of elements) {
          const index = element.groupIds.indexOf(
            this.app.state.editingGroupId!,
          );

          this.app.scene.mutateElement(
            element,
            {
              groupIds: element.groupIds.slice(0, index),
            },
            { informMutation: false, isDragging: false },
          );
        }

        nextElements.forEach((element) => {
          if (
            element.groupIds.length &&
            getElementsInGroup(
              nextElements,
              element.groupIds[element.groupIds.length - 1],
            ).length < 2
          ) {
            this.app.scene.mutateElement(
              element,
              {
                groupIds: [],
              },
              { informMutation: false, isDragging: false },
            );
          }
        });

        this.app.setState({
          editingGroupId: null,
        });
      }
    };

    if (topLayerFrame && !this.app.state.selectedElementIds[topLayerFrame.id]) {
      const elementsToAdd = selectedElements.filter((element) =>
        isElementInFrame(element, nextElements, this.app.state),
      );

      if (this.app.state.editingGroupId) {
        updateGroupIdsAfterEditingGroup(elementsToAdd);
      }

      nextElements = addElementsToFrame(
        nextElements,
        elementsToAdd,
        topLayerFrame,
      );
    } else if (!topLayerFrame) {
      if (this.app.state.editingGroupId) {
        const elementsToRemove = selectedElements.filter(
          (element) =>
            element.frameId &&
            !isElementInFrame(element, nextElements, this.app.state),
        );

        updateGroupIdsAfterEditingGroup(elementsToRemove);
      }
    }

    nextElements = updateFrameMembershipOfSelectedElements(
      nextElements,
      this.app.state,
      this.app,
    );

    this.app.scene.replaceAllElements(nextElements);
  };

  /**
   * The selection's transform handle at the scene point, if any — with its
   * element, for a lone selected element.
   *
   * A lone selected element has none while the line editor is open or one of
   * its line points is hovered, nor does an elbow arrow, a two-point line or
   * arrow, or (on mobile devices) any line or arrow. The selection has none in
   * the element link selector.
   */
  getTransformHandleAt(
    selectedElements: readonly NonDeletedExcalidrawElement[],
    sceneX: number,
    sceneY: number,
    pointerType: PointerType,
  ): {
    element?: NonDeletedExcalidrawElement;
    transformHandleType: TransformHandleType;
  } | null {
    const { state, editorInterface } = this.app;
    if (state.openDialog?.name === "elementLinkSelector") {
      return null;
    }

    if (selectedElements.length === 1) {
      const [element] = selectedElements;
      if (
        state.selectedLinearElement?.isEditing ||
        (state.selectedLinearElement &&
          state.selectedLinearElement.hoverPointIndex !== -1) ||
        isElbowArrow(element) ||
        // HACK: Disable transform handles for linear elements on mobile until a
        // better way of showing them is found
        (isLinearElement(element) &&
          (editorInterface.userAgent.isMobileDevice ||
            element.points.length === 2))
      ) {
        return null;
      }
      const elementWithTransformHandleType = getElementWithTransformHandleType(
        this.app.scene.getNonDeletedElements(),
        state,
        sceneX,
        sceneY,
        state.zoom,
        pointerType,
        this.app.scene.getNonDeletedElementsMap(),
        editorInterface,
      );
      return elementWithTransformHandleType?.transformHandleType
        ? {
            element: elementWithTransformHandleType.element,
            transformHandleType:
              elementWithTransformHandleType.transformHandleType,
          }
        : null;
    }

    if (selectedElements.length > 1) {
      const transformHandleType = getTransformHandleTypeFromCoords(
        getCommonBounds(selectedElements),
        sceneX,
        sceneY,
        state.zoom,
        pointerType,
        editorInterface,
      );
      return transformHandleType ? { transformHandleType } : null;
    }

    return null;
  }

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
      this.app.selection.select(cycleTarget);
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
          if (
            isSelectedViaGroup(this.app.state, hitElement) ||
            // if not dragging a linear element point (outside editor)
            !this.app.state.selectedLinearElement?.isDragging
          ) {
            this.app.selection.remove(hitElement);
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
        this.app.selection.select(hitElement);
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
        this.app.selection.clear();
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

  /** whether an alt-click on the selection (over other elements) cycles it */
  canCycleSelection = () => this.getCyclableSelectedUnit() !== null;

  /**
   * The selectable unit (an element, or the group a click would select) an
   * element belongs to. Inside an edited group, its elements are units of
   * their own.
   */
  private getSelectableUnit(element: ExcalidrawElement) {
    const { editingGroupId } = this.app.state;
    const editingGroupIndex = editingGroupId
      ? element.groupIds.indexOf(editingGroupId)
      : -1;
    const groupIds =
      editingGroupIndex > -1
        ? element.groupIds.slice(0, editingGroupIndex)
        : element.groupIds;
    return groupIds.length ? groupIds[groupIds.length - 1] : element.id;
  }

  /**
   * The selected unit, if an alt-click can cycle away from it: exactly one
   * is selected, and neither the linear nor the crop editor is open.
   */
  private getCyclableSelectedUnit(): string | null {
    if (
      this.app.state.selectedLinearElement?.isEditing ||
      this.app.state.croppingElementId
    ) {
      return null;
    }
    const selectedUnits = new Set(
      this.app.scene
        .getSelectedElements(this.app.state)
        .map((element) => this.getSelectableUnit(element)),
    );
    return selectedUnits.size === 1 ? [...selectedUnits][0] : null;
  }

  /**
   * The element an alt-click selects: the selectable unit below the selected
   * one among the hit elements, wrapping around to the topmost — or `null`
   * unless it's an alt-click, the selection can cycle, and it's under the
   * pointer. Inside an edited group, it cycles through the group's elements
   * only, never leaving the group.
   */
  private getSelectionCycleTarget(
    event: React.PointerEvent<HTMLElement>,
    hitElements: readonly NonDeleted<ExcalidrawElement>[],
  ): NonDeleted<ExcalidrawElement> | null {
    if (!event.altKey || event[KEYS.CTRL_OR_CMD] || event.shiftKey) {
      return null;
    }
    const selectedUnit = this.getCyclableSelectedUnit();
    if (!selectedUnit) {
      return null;
    }

    const { editingGroupId } = this.app.state;
    if (editingGroupId) {
      hitElements = hitElements.filter((element) =>
        isElementInGroup(element, editingGroupId),
      );
    }

    // topmost first, each unit at its topmost hit element
    const units = new Map<string, NonDeleted<ExcalidrawElement>>();
    for (let index = hitElements.length - 1; index > -1; index--) {
      const unit = this.getSelectableUnit(hitElements[index]);
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
