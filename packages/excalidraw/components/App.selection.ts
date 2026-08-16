// Existing in-process selection dependencies are imported directly. this.app
// replaces one-callback-per-function dependency wrappers.
import { KEYS, isSelectionLikeTool, tupleToCoors } from "@excalidraw/common";
import {
  LinearElementEditor,
  editGroupForSelectedElement,
  getCommonBounds,
  getElementWithTransformHandleType,
  getElementsInGroup,
  getFrameChildren,
  getResizeArrowDirection,
  getResizeOffsetXY,
  getTransformHandleTypeFromCoords,
  handleFocusPointPointerDown,
  isBindingElement,
  isElbowArrow,
  isElementInGroup,
  isEmbeddableElement,
  isFrameLikeElement,
  isLinearElement,
  isSelectedViaGroup,
  makeNextSelectedElementIds,
  selectGroupsForSelectedElements,
  type Store,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { GlobalCoord } from "@excalidraw/math";

import {
  getElementsWithinSelection,
  getSelectedElements,
  isSomeElementSelected,
} from "../scene";

import type React from "react";

import type { PointerDownState } from "../types";
import type App from "./App";

export class AppSelection {
  constructor(private readonly app: App, private readonly store: Store) {}

  /**
   * @returns whether the pointer event has been completely handled and the
   * shared pointer move/up lifecycle should not be installed
   */
  handlePointerDown = (
    event: React.PointerEvent<HTMLElement>,
    pointerDownState: PointerDownState,
  ): boolean => {
    if (isSelectionLikeTool(this.app.state.activeTool.type)) {
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
      } else {
        if (this.app.state.selectedLinearElement) {
          const linearElementEditor = this.app.state.selectedLinearElement;
          const ret = LinearElementEditor.handlePointerDown(
            event,
            this.app,
            this.store,
            pointerDownState.origin,
            linearElementEditor,
            this.app.scene,
          );
          if (ret.hitElement) {
            pointerDownState.hit.element = ret.hitElement;
          }
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

        const hitElement = pointerDownState.hit.element;
        const someHitElementIsSelected =
          pointerDownState.hit.allHitElements.some((element) =>
            this.app.isASelectedElement(element),
          );
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
          // if shift is not clicked, this.app will always return true
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

            // Add hit element to selection. At this.app point if we're not holding
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
                  // this.app means selecting hitElement will have the frames selected as well
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
                // this.app means, if the hitElement is a different shape or group
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

  /**
   * Resolves click-selection decisions that pointer-down intentionally defers
   * so the same interaction can still become a drag.
   */
  handlePointerUp = (
    event: PointerEvent,
    pointerDownState: PointerDownState,
  ): void => {
    const hitElement = pointerDownState.hit.element;

    if (
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
      if (event.shiftKey && !this.app.state.selectedLinearElement?.isEditing) {
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
  };

  /**
   * @returns whether the pointer move belongs to a box or lasso selection
   * gesture element dragging and resizing still need coverage
   */
  handlePointerMove = (
    event: PointerEvent,
    pointerDownState: PointerDownState,
    pointerCoords: GlobalCoord,
  ): boolean => {

      if (this.state.selectionElement) {
        pointerDownState.lastCoords.x = pointerCoords.x;
        pointerDownState.lastCoords.y = pointerCoords.y;
        if (event.altKey) {
          this.setActiveTool(
            { type: "lasso", fromSelection: true },
            { keepSelection: event.shiftKey },
          );
          this.lassoTrail.startPath(
            pointerDownState.origin.x,
            pointerDownState.origin.y,
            event.shiftKey,
          );
          this.setAppState({
            selectionElement: null,
          });
          return;
        }
        this.maybeDragNewGenericElement(pointerDownState, event);
      } else if (this.state.activeTool.type === "lasso") {
        if (!event.altKey && this.state.activeTool.fromSelection) {
          this.setActiveTool({ type: "selection" });
          this.createGenericElementOnPointerDown("selection", pointerDownState);
          pointerDownState.lastCoords.x = pointerCoords.x;
          pointerDownState.lastCoords.y = pointerCoords.y;
          this.maybeDragNewGenericElement(pointerDownState, event);
          this.lassoTrail.endPath();
        } else {
          this.lassoTrail.addPointToPath(
            pointerCoords.x,
            pointerCoords.y,
            event.shiftKey,
          );
        }
      } else {;

      if (this.state.activeTool.type === "selection") {
        pointerDownState.boxSelection.hasOccurred = true;

        const elements = this.scene.getNonDeletedElements();

        // box-select line editor points
        if (this.state.selectedLinearElement?.isEditing) {
          LinearElementEditor.handleBoxSelection(
            event,
            this.state,
            this.setState.bind(this),
            this.scene.getNonDeletedElementsMap(),
          );
          // regular box-select
        } else {
          let shouldReuseSelection = true;

          if (!event.shiftKey && isSomeElementSelected(elements, this.state)) {
            if (
              pointerDownState.withCmdOrCtrl &&
              pointerDownState.hit.element
            ) {
              this.setState((prevState) =>
                selectGroupsForSelectedElements(
                  {
                    ...prevState,
                    selectedElementIds: {
                      [pointerDownState.hit.element!.id]: true,
                    },
                  },
                  this.scene.getNonDeletedElements(),
                  prevState,
                  this,
                ),
              );
            } else {
              shouldReuseSelection = false;
            }
          }
          const elementsWithinSelection = this.state.selectionElement
            ? getElementsWithinSelection(
                elements,
                this.state.selectionElement,
                this.scene.getNonDeletedElementsMap(),
                false,
                this.state.boxSelectionMode,
              )
            : [];

          this.setState((prevState) => {
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
                this.scene.getNonDeletedElements(),
                prevState,
                this,
              ),
              // select linear element only when we haven't box-selected anything else
              selectedLinearElement:
                elementsWithinSelection.length === 1 &&
                isLinearElement(elementsWithinSelection[0])
                  ? new LinearElementEditor(
                      elementsWithinSelection[0],
                      this.scene.getNonDeletedElementsMap(),
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

  private clearSelection(hitElement: ExcalidrawElement | null): void {
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
}
