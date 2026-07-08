import {
  ARROW_TYPE,
  BIND_MODE_TIMEOUT,
  CURSOR_TYPE,
  ELEMENT_SHIFT_TRANSLATE_AMOUNT,
  ELEMENT_TRANSLATE_AMOUNT,
  KEYS,
  LINE_CONFIRM_THRESHOLD,
  MINIMUM_ARROW_SIZE,
  ROUNDNESS,
  getFeatureFlag,
  getGridPoint,
  invariant,
  isArrowKey,
  isShallowEqual,
  shouldRotateWithDiscreteAngle,
  updateActiveTool,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import {
  LinearElementEditor,
  bindOrUnbindBindingElement,
  bindOrUnbindBindingElements,
  calculateFixedPointForNonElbowArrowBinding,
  doBoundsIntersect,
  elementOverlapsWithFrame,
  getBindingStrategyForDraggingBindingElementEndpoints,
  getContainingFrame,
  getElementBounds,
  getHoveredElementForBinding,
  getSnapOutlineMidPoint,
  handleFocusPointDrag,
  handleFocusPointHover,
  handleFocusPointPointerDown,
  handleFocusPointPointerUp,
  hitElementItself,
  isArrowElement,
  isBindableElement,
  isBindingElement,
  isBindingElementType,
  isBindingEnabled,
  isElbowArrow,
  isLineElement,
  isLinearElement,
  isPathALoop,
  isPointInElement,
  isSimpleArrow,
  makeNextSelectedElementIds,
  maxBindingDistance_simple,
  maybeHandleArrowPointlikeDrag,
  newArrowElement,
  newElementWith,
  newLinearElement,
  removeElementsFromFrame,
  updateBoundElements,
} from "@excalidraw/element";
import { pointDistance, pointFrom } from "@excalidraw/math";

import { flushSync } from "react-dom";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";

import type {
  Arrowhead,
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElbowArrowElement,
  ExcalidrawElement,
  ExcalidrawLinearElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { actionFinalize, actionToggleLinearEditor } from "./actions";
import { resetCursor, setCursor, setCursorForShape } from "./cursor";

import type React from "react";

import type { App, AppState, PointerDownState } from "./types";

export const handleSkipBindMode = (app: App) => {
  if (
    app.state.selectedLinearElement?.initialState &&
    !app.state.selectedLinearElement.initialState.arrowStartIsInside
  ) {
    invariant(
      app.lastPointerMoveCoords,
      "Missing last pointer move coords when changing bind skip mode for arrow start",
    );
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const hoveredElement = getHoveredElementForBinding(
      pointFrom<GlobalPoint>(
        app.lastPointerMoveCoords.x,
        app.lastPointerMoveCoords.y,
      ),
      app.scene.getNonDeletedElements(),
      elementsMap,
    );
    const element = LinearElementEditor.getElement(
      app.state.selectedLinearElement.elementId,
      elementsMap,
    );

    if (
      element?.startBinding &&
      hoveredElement?.id === element.startBinding.elementId
    ) {
      app.setState({
        selectedLinearElement: {
          ...app.state.selectedLinearElement,
          initialState: {
            ...app.state.selectedLinearElement.initialState,
            arrowStartIsInside: true,
          },
        },
      });
    }
  }

  if (app.state.bindMode === "orbit") {
    if (app.bindModeHandler) {
      clearTimeout(app.bindModeHandler);
      app.bindModeHandler = null;
    }

    // PERF: It's okay since it's a single trigger from a key handler
    // or single call from pointer move handler because the bindMode check
    // will not pass the second time
    flushSync(() => {
      app.setState({
        bindMode: "skip",
      });
    });

    if (
      app.lastPointerMoveCoords &&
      app.state.selectedLinearElement?.selectedPointsIndices &&
      app.state.selectedLinearElement?.selectedPointsIndices.length
    ) {
      const { x, y } = app.lastPointerMoveCoords;
      const event =
        app.lastPointerMoveEvent ?? app.lastPointerDownEvent?.nativeEvent;
      invariant(event, "Last event must exist");
      const deltaX = x - app.state.selectedLinearElement.pointerOffset.x;
      const deltaY = y - app.state.selectedLinearElement.pointerOffset.y;
      const newState = app.state.multiElement
        ? LinearElementEditor.handlePointerMove(
            event,
            app,
            deltaX,
            deltaY,
            app.state.selectedLinearElement,
          )
        : LinearElementEditor.handlePointDragging(
            event,
            app,
            deltaX,
            deltaY,
            app.state.selectedLinearElement,
          );
      if (newState) {
        app.setState(newState);
      }
    }
  }
};

export const resetDelayedBindMode = (app: App) => {
  if (app.bindModeHandler) {
    clearTimeout(app.bindModeHandler);
    app.bindModeHandler = null;
  }

  if (app.state.bindMode !== "orbit") {
    // We need this iteration to complete binding and change
    // back to orbit mode after that
    setTimeout(() =>
      app.setState({
        bindMode: "orbit",
      }),
    );
  }
};

export const handleDelayedBindModeChange = (
  app: App,
  arrow: ExcalidrawArrowElement,
  hoveredElement: NonDeletedExcalidrawElement | null,
) => {
  if (arrow.isDeleted || isElbowArrow(arrow)) {
    return;
  }

  const effector = () => {
    app.bindModeHandler = null;

    invariant(
      app.lastPointerMoveCoords,
      "Expected lastPointerMoveCoords to be set",
    );

    if (!app.state.multiElement) {
      if (
        !app.state.selectedLinearElement ||
        !app.state.selectedLinearElement.selectedPointsIndices ||
        !app.state.selectedLinearElement.selectedPointsIndices.length
      ) {
        return;
      }

      const startDragged =
        app.state.selectedLinearElement.selectedPointsIndices.includes(0);
      const endDragged =
        app.state.selectedLinearElement.selectedPointsIndices.includes(
          arrow.points.length - 1,
        );

      // Check if the whole arrow is dragged by selecting all endpoints
      if ((!startDragged && !endDragged) || (startDragged && endDragged)) {
        return;
      }
    }

    const { x, y } = app.lastPointerMoveCoords;
    const hoveredElement = getHoveredElementForBinding(
      pointFrom<GlobalPoint>(x, y),
      app.scene.getNonDeletedElements(),
      app.scene.getNonDeletedElementsMap(),
    );

    if (hoveredElement && app.state.bindMode !== "skip") {
      invariant(
        app.state.selectedLinearElement?.elementId === arrow.id,
        "The selectedLinearElement is expected to not change while a bind mode timeout is ticking",
      );

      // Once the start is set to inside binding, it remains so
      const arrowStartIsInside =
        app.state.selectedLinearElement.initialState.arrowStartIsInside ||
        arrow.startBinding?.elementId === hoveredElement.id;

      // Change the global binding mode
      flushSync(() => {
        invariant(
          app.state.selectedLinearElement,
          "this.state.selectedLinearElement must exist",
        );

        app.setState({
          bindMode: "inside",
          selectedLinearElement: {
            ...app.state.selectedLinearElement,
            initialState: {
              ...app.state.selectedLinearElement.initialState,
              arrowStartIsInside,
            },
          },
        });
      });

      const event =
        app.lastPointerMoveEvent ?? app.lastPointerDownEvent?.nativeEvent;
      invariant(event, "Last event must exist");
      const deltaX = x - app.state.selectedLinearElement.pointerOffset.x;
      const deltaY = y - app.state.selectedLinearElement.pointerOffset.y;
      const newState = app.state.multiElement
        ? LinearElementEditor.handlePointerMove(
            event,
            app,
            deltaX,
            deltaY,
            app.state.selectedLinearElement,
          )
        : LinearElementEditor.handlePointDragging(
            event,
            app,
            deltaX,
            deltaY,
            app.state.selectedLinearElement,
          );
      if (newState) {
        app.setState(newState);
      }
    }
  };

  let isOverlapping = false;
  if (app.state.selectedLinearElement?.selectedPointsIndices) {
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const startDragged =
      app.state.selectedLinearElement.selectedPointsIndices.includes(0);
    const endDragged =
      app.state.selectedLinearElement.selectedPointsIndices.includes(
        arrow.points.length - 1,
      );
    const startElement = startDragged
      ? hoveredElement
      : arrow.startBinding && elementsMap.get(arrow.startBinding.elementId);
    const endElement = endDragged
      ? hoveredElement
      : arrow.endBinding && elementsMap.get(arrow.endBinding.elementId);
    const startBounds =
      startElement && getElementBounds(startElement, elementsMap);
    const endBounds = endElement && getElementBounds(endElement, elementsMap);
    isOverlapping = !!(
      startBounds &&
      endBounds &&
      startElement.id !== endElement.id &&
      doBoundsIntersect(startBounds, endBounds)
    );
  }

  const startDragged =
    app.state.selectedLinearElement?.selectedPointsIndices?.includes(0);
  const endDragged =
    app.state.selectedLinearElement?.selectedPointsIndices?.includes(
      arrow.points.length - 1,
    );
  const currentBinding = startDragged
    ? "startBinding"
    : endDragged
    ? "endBinding"
    : null;
  const otherBinding = startDragged
    ? "endBinding"
    : endDragged
    ? "startBinding"
    : null;
  const isAlreadyInsideBindingToSameElement =
    (otherBinding &&
      arrow[otherBinding]?.mode === "inside" &&
      arrow[otherBinding]?.elementId === hoveredElement?.id) ||
    (currentBinding &&
      arrow[currentBinding]?.mode === "inside" &&
      hoveredElement?.id === arrow[currentBinding]?.elementId);

  if (
    currentBinding &&
    otherBinding &&
    arrow[currentBinding]?.mode === "inside" &&
    hoveredElement?.id !== arrow[currentBinding]?.elementId &&
    arrow[otherBinding]?.elementId !== arrow[currentBinding]?.elementId
  ) {
    // Update binding out of place to orbit mode
    app.scene.mutateElement(
      arrow,
      {
        [currentBinding]: {
          ...arrow[currentBinding],
          mode: "orbit",
        },
      },
      {
        informMutation: false,
        isDragging: true,
      },
    );
  }

  if (
    !hoveredElement ||
    (app.previousHoveredBindableElement &&
      hoveredElement.id !== app.previousHoveredBindableElement.id)
  ) {
    // Clear the timeout if we're not hovering a bindable
    if (app.bindModeHandler) {
      clearTimeout(app.bindModeHandler);
      app.bindModeHandler = null;
    }

    // Clear the inside binding mode too
    if (app.state.bindMode === "inside") {
      flushSync(() => {
        app.setState({
          bindMode: "orbit",
        });
      });
    }

    app.previousHoveredBindableElement = null;
  } else if (
    !app.bindModeHandler &&
    (!app.state.newElement || !arrow.startBinding || isOverlapping) &&
    !isAlreadyInsideBindingToSameElement
  ) {
    // We are hovering a bindable element
    app.bindModeHandler = setTimeout(effector, BIND_MODE_TIMEOUT);
  }

  app.previousHoveredBindableElement = hoveredElement;
};

export const handleHoverSelectedLinearElement = (
  app: App,
  linearElementEditor: LinearElementEditor,
  scenePointerX: number,
  scenePointerY: number,
) => {
  const elementsMap = app.scene.getNonDeletedElementsMap();

  const element = LinearElementEditor.getElement(
    linearElementEditor.elementId,
    elementsMap,
  );

  if (!element) {
    return;
  }
  if (app.state.selectedLinearElement) {
    let hoverPointIndex = -1;
    let segmentMidPointHoveredCoords = null;
    if (
      hitElementItself({
        point: pointFrom(scenePointerX, scenePointerY),
        element,
        elementsMap,
        threshold: app.getElementHitThreshold(element),
      })
    ) {
      hoverPointIndex = LinearElementEditor.getPointIndexUnderCursor(
        element,
        elementsMap,
        app.state.zoom,
        scenePointerX,
        scenePointerY,
      );
      segmentMidPointHoveredCoords =
        LinearElementEditor.getSegmentMidpointHitCoords(
          linearElementEditor,
          { x: scenePointerX, y: scenePointerY },
          app.state,
          app.scene.getNonDeletedElementsMap(),
        );
      const isHoveringAPointHandle = isElbowArrow(element)
        ? hoverPointIndex === 0 || hoverPointIndex === element.points.length - 1
        : hoverPointIndex >= 0;
      if (isHoveringAPointHandle || segmentMidPointHoveredCoords) {
        setCursor(app.interactiveCanvas, CURSOR_TYPE.POINTER);
      } else if (app.hitElement(scenePointerX, scenePointerY, element)) {
        if (
          // Elbow arrows can only be moved when unconnected
          !isElbowArrow(element) ||
          !(element.startBinding || element.endBinding)
        ) {
          if (
            app.state.activeTool.type !== "lasso" ||
            Object.keys(app.state.selectedElementIds).length > 0
          ) {
            setCursor(app.interactiveCanvas, CURSOR_TYPE.MOVE);
          }
        }
      }
    } else if (app.hitElement(scenePointerX, scenePointerY, element)) {
      if (
        // Elbow arrow can only be moved when unconnected
        !isElbowArrow(element) ||
        !(element.startBinding || element.endBinding)
      ) {
        if (
          app.state.activeTool.type !== "lasso" ||
          Object.keys(app.state.selectedElementIds).length > 0
        ) {
          setCursor(app.interactiveCanvas, CURSOR_TYPE.MOVE);
        }
      }
    }

    if (app.state.selectedLinearElement.hoverPointIndex !== hoverPointIndex) {
      app.setState({
        selectedLinearElement: {
          ...app.state.selectedLinearElement,
          hoverPointIndex,
        },
      });
    }

    if (
      !LinearElementEditor.arePointsEqual(
        app.state.selectedLinearElement.segmentMidPointHoveredCoords,
        segmentMidPointHoveredCoords,
      )
    ) {
      app.setState({
        selectedLinearElement: {
          ...app.state.selectedLinearElement,
          segmentMidPointHoveredCoords,
        },
      });
    }

    // Check for focus point hover
    let hoveredFocusPointBinding: "start" | "end" | null = null;
    const arrow = element as any;
    if (arrow.startBinding || arrow.endBinding) {
      hoveredFocusPointBinding = handleFocusPointHover(
        element as ExcalidrawArrowElement,
        scenePointerX,
        scenePointerY,
        app.scene,
        app.state,
      );
    }

    if (
      app.state.selectedLinearElement.hoveredFocusPointBinding !==
      hoveredFocusPointBinding
    ) {
      app.setState({
        selectedLinearElement: {
          ...app.state.selectedLinearElement,
          isDragging: false,
          hoveredFocusPointBinding,
        },
      });
    }

    // Set cursor to pointer when hovering over a focus point
    if (hoveredFocusPointBinding) {
      setCursor(app.interactiveCanvas, CURSOR_TYPE.POINTER);
    }
  } else {
    setCursor(app.interactiveCanvas, CURSOR_TYPE.AUTO);
  }
};

/**
 * Handles pointer down on the linear element editor (point/segment handles or
 * a hovered focus point) before generic selection handling takes place.
 *
 * @returns a boolean when the interaction was fully handled (the caller should
 * return that value from the selection pointer-down handler), or `null` to
 * continue with generic selection handling.
 */
export const linearEditorOnPointerDownHandler = (
  app: App,
  event: React.PointerEvent<HTMLElement>,
  pointerDownState: PointerDownState,
): boolean | null => {
  if (app.state.selectedLinearElement) {
    const linearElementEditor = app.state.selectedLinearElement;
    const ret = LinearElementEditor.handlePointerDown(
      event,
      app,
      app.store,
      pointerDownState.origin,
      linearElementEditor,
      app.scene,
    );
    if (ret.hitElement) {
      pointerDownState.hit.element = ret.hitElement;
    }
    if (ret.linearElementEditor) {
      app.setState({ selectedLinearElement: ret.linearElementEditor });
    }
    if (ret.didAddPoint) {
      return true;
    }

    // Also check at current pointer position if focus point is being hovered
    // (in case we're clicking directly without a prior move event)
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const arrow = LinearElementEditor.getElement(
      linearElementEditor.elementId,
      elementsMap,
    ) as any;

    if (arrow && isBindingElement(arrow)) {
      const { hitFocusPoint, pointerOffset } = handleFocusPointPointerDown(
        arrow,
        pointerDownState,
        elementsMap,
        app.state,
      );

      // If focus point is hit, update state and prevent element selection
      if (hitFocusPoint) {
        app.setState({
          selectedLinearElement: {
            ...linearElementEditor,
            hoveredFocusPointBinding: hitFocusPoint,
            draggedFocusPointBinding: hitFocusPoint,
            pointerOffset,
          },
        });
        return false;
      }
    }
  }

  return null;
};

/**
 * Pointer down with the arrow or line tool active: either continues a
 * multi-point element (committing/finalizing points) or creates a new linear
 * element.
 */
export const linearToolOnPointerDownHandler = (
  app: App,
  event: React.PointerEvent<HTMLElement>,
  elementType: ExcalidrawLinearElement["type"],
  pointerDownState: PointerDownState,
): void => {
  if (event.ctrlKey) {
    flushSync(() => {
      app.setState({
        isBindingEnabled: app.state.bindingPreference !== "enabled",
      });
    });
  }

  if (app.state.multiElement) {
    const { multiElement, selectedLinearElement } = app.state;

    invariant(
      selectedLinearElement,
      "selectedLinearElement is expected to be set",
    );

    // finalize if completing a loop
    if (
      multiElement.type === "line" &&
      isPathALoop(multiElement.points, app.state.zoom.value)
    ) {
      flushSync(() => {
        app.setState({
          selectedLinearElement: {
            ...selectedLinearElement,
            lastCommittedPoint:
              multiElement.points[multiElement.points.length - 1],
            initialState: {
              ...selectedLinearElement.initialState,
              lastClickedPoint: -1, // Disable dragging
            },
          },
        });
      });
      app.actionManager.executeAction(actionFinalize);
      return;
    }

    // Elbow arrows cannot be created by putting down points
    // only the start and end points can be defined
    if (isElbowArrow(multiElement) && multiElement.points.length > 1) {
      app.actionManager.executeAction(actionFinalize, "ui", {
        event: event.nativeEvent,
        sceneCoords: {
          x: pointerDownState.origin.x,
          y: pointerDownState.origin.y,
        },
      });
      return;
    }

    const { x: rx, y: ry } = multiElement;
    const { lastCommittedPoint } = selectedLinearElement;
    const sceneCoords = viewportCoordsToSceneCoords(event, app.state);
    const { start, end } =
      isBindingElement(multiElement) && isBindingEnabled(app.state)
        ? getBindingStrategyForDraggingBindingElementEndpoints(
            multiElement,
            new Map([
              [
                multiElement.points.length - 1,
                {
                  point: multiElement.points[multiElement.points.length - 1],
                  isDragging: false,
                },
              ],
            ]),
            sceneCoords.x,
            sceneCoords.y,
            app.scene.getNonDeletedElementsMap(),
            app.scene.getNonDeletedElements(),
            app.state,
            {
              newArrow: Boolean(app.state.newElement),
              zoom: app.state.zoom,
            },
          )
        : { end: { mode: undefined } };

    const elementsMap = app.scene.getNonDeletedElementsMap();
    // Auto-confirm when both ends bind to the SAME element and the end point
    // lands on the outline rather than inside it
    const endOutsideSameElement =
      start?.mode != null &&
      end.mode != null &&
      start.element.id === end.element.id &&
      !isPointInElement(end.focusPoint, end.element, elementsMap);
    const boundOutsideFromElsewhere =
      end.mode === "orbit" &&
      multiElement.startBinding?.elementId !== end.element?.id;
    const lastCommittedPointIsInsideCommitZone =
      lastCommittedPoint &&
      pointDistance(
        pointFrom(
          pointerDownState.origin.x - rx,
          pointerDownState.origin.y - ry,
        ),
        lastCommittedPoint,
      ) < LINE_CONFIRM_THRESHOLD;

    // clicking inside commit zone → finalize arrow
    if (
      boundOutsideFromElsewhere || // Outside -> orbit: Bind immediately
      endOutsideSameElement || // End outside the start's element: Bind immediately
      (multiElement.points.length > 1 && lastCommittedPointIsInsideCommitZone)
    ) {
      app.actionManager.executeAction(actionFinalize, "ui", {
        event: event.nativeEvent,
        sceneCoords: {
          x: pointerDownState.origin.x,
          y: pointerDownState.origin.y,
        },
      });
      return;
    }

    app.setState((prevState) => ({
      selectedElementIds: makeNextSelectedElementIds(
        {
          ...prevState.selectedElementIds,
          [multiElement.id]: true,
        },
        prevState,
      ),
    }));

    setCursor(app.interactiveCanvas, CURSOR_TYPE.POINTER);
  } else {
    const [gridX, gridY] = getGridPoint(
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
    );

    const topLayerFrame = app.getTopLayerFrameAtSceneCoords({
      x: gridX,
      y: gridY,
    });

    /* If arrow is pre-arrowheads, it will have undefined for both start and end arrowheads.
    If so, we want it to be null for start and "arrow" for end. If the linear item is not
    an arrow, we want it to be null for both. Otherwise, we want it to use the
    values from appState. */

    const { currentItemStartArrowhead, currentItemEndArrowhead } = app.state;
    const [startArrowhead, endArrowhead] =
      elementType === "arrow"
        ? [currentItemStartArrowhead, currentItemEndArrowhead]
        : [null, null];

    const element =
      elementType === "arrow"
        ? newArrowElement({
            type: elementType,
            x: gridX,
            y: gridY,
            strokeColor: app.state.currentItemStrokeColor,
            backgroundColor: app.state.currentItemBackgroundColor,
            fillStyle: app.state.currentItemFillStyle,
            strokeWidth: app.getCurrentItemStrokeWidth(elementType),
            strokeStyle: app.state.currentItemStrokeStyle,
            roughness: app.state.currentItemRoughness,
            opacity: app.state.currentItemOpacity,
            roundness:
              app.state.currentItemArrowType === ARROW_TYPE.round
                ? { type: ROUNDNESS.PROPORTIONAL_RADIUS }
                : // note, roundness doesn't have any effect for elbow arrows,
                  // but it's best to set it to null as well
                  null,
            startArrowhead,
            endArrowhead,
            locked: false,
            frameId: topLayerFrame ? topLayerFrame.id : null,
            elbowed: app.state.currentItemArrowType === ARROW_TYPE.elbow,
            fixedSegments:
              app.state.currentItemArrowType === ARROW_TYPE.elbow ? [] : null,
          })
        : newLinearElement({
            type: elementType,
            x: gridX,
            y: gridY,
            strokeColor: app.state.currentItemStrokeColor,
            backgroundColor: app.state.currentItemBackgroundColor,
            fillStyle: app.state.currentItemFillStyle,
            strokeWidth: app.getCurrentItemStrokeWidth(elementType),
            strokeStyle: app.state.currentItemStrokeStyle,
            roughness: app.state.currentItemRoughness,
            opacity: app.state.currentItemOpacity,
            roundness:
              app.state.currentItemRoundness === "round"
                ? { type: ROUNDNESS.PROPORTIONAL_RADIUS }
                : null,
            locked: false,
            frameId: topLayerFrame ? topLayerFrame.id : null,
          });

    const point = pointFrom<GlobalPoint>(
      pointerDownState.origin.x,
      pointerDownState.origin.y,
    );
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const boundElement = isBindingEnabled(app.state)
      ? getHoveredElementForBinding(
          point,
          app.scene.getNonDeletedElements(),
          elementsMap,
        )
      : null;

    app.scene.mutateElement(element, {
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(0, 0)],
    });

    app.insertNewElement(element);

    if (isBindingElement(element)) {
      // Do the initial binding so the binding strategy has the initial state
      bindOrUnbindBindingElement(
        element,
        new Map([
          [
            0,
            {
              point: pointFrom<LocalPoint>(0, 0),
              isDragging: false,
            },
          ],
        ]),
        point[0],
        point[1],
        app.scene,
        app.state,
        {
          newArrow: true,
          altKey: event.altKey,
          initialBinding: true,
          angleLocked: shouldRotateWithDiscreteAngle(event.nativeEvent),
        },
      );
    }

    // NOTE: We need the flushSync here for the
    // delayed bind mode change to see the right state
    // (specifically the `newElement`)
    flushSync(() => {
      app.setState((prevState) => {
        let linearElementEditor = null;
        let nextSelectedElementIds = prevState.selectedElementIds;
        if (isLinearElement(element)) {
          linearElementEditor = new LinearElementEditor(
            element,
            app.scene.getNonDeletedElementsMap(),
          );

          const endIdx = element.points.length - 1;
          linearElementEditor = {
            ...linearElementEditor,
            selectedPointsIndices: [endIdx],
            initialState: {
              ...linearElementEditor.initialState,
              arrowStartIsInside: event.altKey,
              lastClickedPoint: endIdx,
              origin: pointFrom<GlobalPoint>(
                pointerDownState.origin.x,
                pointerDownState.origin.y,
              ),
            },
          };
        }

        nextSelectedElementIds = !app.state.activeTool.locked
          ? makeNextSelectedElementIds({ [element.id]: true }, prevState)
          : prevState.selectedElementIds;

        return {
          ...prevState,
          bindMode: "orbit",
          newElement: element,
          suggestedBinding:
            boundElement && isBindingElement(element)
              ? {
                  element: boundElement,
                  midPoint: getSnapOutlineMidPoint(
                    point,
                    boundElement,
                    elementsMap,
                    app.state.zoom,
                  ),
                }
              : null,
          selectedElementIds: nextSelectedElementIds,
          selectedLinearElement: linearElementEditor,
        };
      });
    });

    if (isBindingElement(element) && getFeatureFlag("COMPLEX_BINDINGS")) {
      handleDelayedBindModeChange(app, element, boundElement);
    }
  }
};

/**
 * Handles the linear-element concerns of a canvas pointer move (outside of a
 * pointer-down drag): updating the line editor in edit mode, suggesting
 * bindings while a binding tool is active, and driving multi-point element
 * creation.
 *
 * @returns whether the multi-point creation branch handled the event (in which
 * case the caller should return early).
 */
export const linearPointerMoveHandler = (
  app: App,
  event: React.PointerEvent<HTMLCanvasElement>,
  scenePointerX: number,
  scenePointerY: number,
): boolean => {
  if (
    app.state.selectedLinearElement?.isEditing &&
    !app.state.selectedLinearElement.isDragging
  ) {
    const editingLinearElement = app.state.newElement
      ? null
      : LinearElementEditor.handlePointerMoveInEditMode(
          event,
          scenePointerX,
          scenePointerY,
          app,
        );

    if (
      editingLinearElement &&
      editingLinearElement !== app.state.selectedLinearElement
    ) {
      // Since we are reading from previous state which is not possible with
      // automatic batching in React 18 hence using flush sync to synchronously
      // update the state. Check https://github.com/excalidraw/excalidraw/pull/5508 for more details.
      flushSync(() => {
        app.setState({
          selectedLinearElement: editingLinearElement,
        });
      });
    }
  }

  if (isBindingElementType(app.state.activeTool.type)) {
    // Hovering with a selected tool or creating new linear element via click
    // and point
    const { newElement } = app.state;
    if (!newElement && isBindingEnabled(app.state)) {
      const globalPoint = pointFrom<GlobalPoint>(scenePointerX, scenePointerY);
      const elementsMap = app.scene.getNonDeletedElementsMap();
      const hoveredElement = getHoveredElementForBinding(
        globalPoint,
        app.scene.getNonDeletedElements(),
        elementsMap,
        maxBindingDistance_simple(app.state.zoom),
      );
      if (hoveredElement) {
        app.setState({
          suggestedBinding: {
            element: hoveredElement,
            midPoint: getSnapOutlineMidPoint(
              globalPoint,
              hoveredElement,
              elementsMap,
              app.state.zoom,
            ),
          },
        });
      } else if (app.state.suggestedBinding) {
        app.setState({
          suggestedBinding: null,
        });
      }
    }
  }

  if (app.state.multiElement && app.state.selectedLinearElement) {
    const { multiElement, selectedLinearElement } = app.state;
    const { x: rx, y: ry, points } = multiElement;
    const lastPoint = points[points.length - 1];

    const { lastCommittedPoint } = selectedLinearElement;

    setCursorForShape(app.interactiveCanvas, app.state);

    if (lastPoint === lastCommittedPoint) {
      if (
        // if we haven't yet created a temp point and we're beyond commit-zone
        // threshold, add a point
        pointDistance(
          pointFrom(scenePointerX - rx, scenePointerY - ry),
          lastPoint,
        ) >= LINE_CONFIRM_THRESHOLD
      ) {
        app.store.scheduleCapture();
        flushSync(() => {
          invariant(
            app.state.selectedLinearElement?.initialState,
            "initialState must be set",
          );
          app.setState({
            selectedLinearElement: {
              ...app.state.selectedLinearElement,
              lastCommittedPoint: points[points.length - 1],
              selectedPointsIndices: [multiElement.points.length],
              initialState: {
                ...app.state.selectedLinearElement.initialState,
                lastClickedPoint: multiElement.points.length,
              },
            },
          });
        });
        app.scene.mutateElement(
          multiElement,
          {
            points: [
              ...points,
              pointFrom<LocalPoint>(scenePointerX - rx, scenePointerY - ry),
            ],
          },
          { informMutation: false, isDragging: false },
        );
      } else {
        setCursor(app.interactiveCanvas, CURSOR_TYPE.POINTER);
        // in this branch, we're inside the commit zone, and no uncommitted
        // point exists. Thus do nothing (don't add/remove points).
      }
    } else if (
      points.length > 2 &&
      lastCommittedPoint &&
      pointDistance(
        pointFrom(scenePointerX - rx, scenePointerY - ry),
        lastCommittedPoint,
      ) < LINE_CONFIRM_THRESHOLD
    ) {
      setCursor(app.interactiveCanvas, CURSOR_TYPE.POINTER);
      app.scene.mutateElement(
        multiElement,
        {
          points: points.slice(0, -1),
        },
        { informMutation: false, isDragging: false },
      );
      const newLastIdx = multiElement.points.length - 1;
      app.setState({
        selectedLinearElement: {
          ...selectedLinearElement,
          selectedPointsIndices: selectedLinearElement.selectedPointsIndices
            ? [
                ...new Set(
                  selectedLinearElement.selectedPointsIndices.map((idx) =>
                    Math.min(idx, newLastIdx),
                  ),
                ),
              ]
            : selectedLinearElement.selectedPointsIndices,
          lastCommittedPoint: multiElement.points[newLastIdx],
          initialState: {
            ...selectedLinearElement.initialState,
            lastClickedPoint: newLastIdx,
          },
        },
      });
    } else {
      if (isPathALoop(points, app.state.zoom.value)) {
        setCursor(app.interactiveCanvas, CURSOR_TYPE.POINTER);
      }

      // Update arrow points
      const elementsMap = app.scene.getNonDeletedElementsMap();

      if (isSimpleArrow(multiElement)) {
        const hoveredElement = getHoveredElementForBinding(
          pointFrom<GlobalPoint>(scenePointerX, scenePointerY),
          app.scene.getNonDeletedElements(),
          elementsMap,
        );

        if (getFeatureFlag("COMPLEX_BINDINGS")) {
          handleDelayedBindModeChange(app, multiElement, hoveredElement);
        }
      }

      invariant(
        app.state.selectedLinearElement,
        "Expected selectedLinearElement to be set to operate on a linear element",
      );

      const newState = LinearElementEditor.handlePointerMove(
        event.nativeEvent,
        app,
        scenePointerX,
        scenePointerY,
        app.state.selectedLinearElement,
      );
      if (newState) {
        app.setState(newState);
      }
    }

    return true;
  }

  if (app.state.activeTool.type === "arrow") {
    const hit = getHoveredElementForBinding(
      pointFrom<GlobalPoint>(scenePointerX, scenePointerY),
      app.scene.getNonDeletedElements(),
      app.scene.getNonDeletedElementsMap(),
      maxBindingDistance_simple(app.state.zoom),
    );
    const scenePointer = pointFrom<GlobalPoint>(scenePointerX, scenePointerY);
    const elementsMap = app.scene.getNonDeletedElementsMap();
    if (hit && !isPointInElement(scenePointer, hit, elementsMap)) {
      app.setState({
        suggestedBinding: {
          element: hit,
          midPoint: getSnapOutlineMidPoint(
            scenePointer,
            hit,
            elementsMap,
            app.state.zoom,
          ),
        },
      });
    }
  }

  return false;
};

/**
 * While dragging, moves the fixed segment (mid-segment handle) of an elbow
 * arrow.
 *
 * @returns whether the drag was handled (the caller should return early).
 */
export const linearFixedSegmentDragFromPointerDownHandler = (
  app: App,
  event: PointerEvent,
  pointerCoords: { x: number; y: number },
): boolean => {
  if (
    app.state.selectedLinearElement &&
    app.state.selectedLinearElement.elbowed &&
    app.state.selectedLinearElement.initialState.segmentMidpoint.index
  ) {
    const [gridX, gridY] = getGridPoint(
      pointerCoords.x,
      pointerCoords.y,
      event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
    );

    let index =
      app.state.selectedLinearElement.initialState.segmentMidpoint.index;
    if (index < 0) {
      const nextCoords = LinearElementEditor.getSegmentMidpointHitCoords(
        {
          ...app.state.selectedLinearElement,
          segmentMidPointHoveredCoords: null,
        },
        { x: gridX, y: gridY },
        app.state,
        app.scene.getNonDeletedElementsMap(),
      );
      index = nextCoords
        ? LinearElementEditor.getSegmentMidPointIndex(
            app.state.selectedLinearElement,
            app.state,
            nextCoords,
            app.scene.getNonDeletedElementsMap(),
          )
        : -1;
    }

    const ret = LinearElementEditor.moveFixedSegment(
      app.state.selectedLinearElement,
      index,
      gridX,
      gridY,
      app.scene,
    );

    app.setState({
      selectedLinearElement: {
        ...app.state.selectedLinearElement,
        isDragging: true,
        segmentMidPointHoveredCoords: ret.segmentMidPointHoveredCoords,
        initialState: ret.initialState,
      },
    });
    return true;
  }

  return false;
};

/**
 * While dragging with a selected linear element, handles focus point
 * dragging, midpoint creation and point dragging.
 *
 * @returns whether the event was consumed (the caller should return early);
 * `false` falls through to the generic element-drag handling.
 */
export const linearPointDraggingFromPointerDownHandler = (
  app: App,
  pointerDownState: PointerDownState,
  event: PointerEvent,
  pointerCoords: { x: number; y: number },
  elementsMap: NonDeletedSceneElementsMap,
): boolean => {
  if (app.state.selectedLinearElement) {
    const linearElementEditor = app.state.selectedLinearElement;

    // Handle focus point dragging if needed
    if (linearElementEditor.draggedFocusPointBinding) {
      handleFocusPointDrag(
        linearElementEditor,
        elementsMap,
        pointerCoords,
        app.scene,
        app.state,
        app.getEffectiveGridSize(),
        event.altKey,
      );
      app.setState({
        selectedLinearElement: {
          ...linearElementEditor,
          isDragging: false,
          selectedPointsIndices: [],
          initialState: {
            ...linearElementEditor.initialState,
            lastClickedPoint: -1,
          },
        },
      });
      return true;
    }

    if (
      LinearElementEditor.shouldAddMidpoint(
        app.state.selectedLinearElement,
        pointerCoords,
        app.state,
        elementsMap,
      )
    ) {
      const ret = LinearElementEditor.addMidpoint(
        app.state.selectedLinearElement,
        pointerCoords,
        app,
        !event[KEYS.CTRL_OR_CMD],
        app.scene,
      );
      if (!ret) {
        return true;
      }

      // Since we are reading from previous state which is not possible with
      // automatic batching in React 18 hence using flush sync to synchronously
      // update the state. Check https://github.com/excalidraw/excalidraw/pull/5508 for more details.

      flushSync(() => {
        if (app.state.selectedLinearElement) {
          app.setState({
            selectedLinearElement: {
              ...app.state.selectedLinearElement,
              initialState: ret.pointerDownState,
              selectedPointsIndices: ret.selectedPointsIndices,
              segmentMidPointHoveredCoords: null,
            },
          });
        }
      });

      return true;
    } else if (
      linearElementEditor.initialState.segmentMidpoint.value !== null &&
      !linearElementEditor.initialState.segmentMidpoint.added
    ) {
      return true;
    } else if (linearElementEditor.initialState.lastClickedPoint > -1) {
      const element = LinearElementEditor.getElement(
        linearElementEditor.elementId,
        elementsMap,
      );

      if (element?.isDeleted) {
        return true;
      }

      if (isBindingElement(element)) {
        const hoveredElement = getHoveredElementForBinding(
          pointFrom<GlobalPoint>(pointerCoords.x, pointerCoords.y),
          app.scene.getNonDeletedElements(),
          elementsMap,
        );

        if (getFeatureFlag("COMPLEX_BINDINGS")) {
          handleDelayedBindModeChange(app, element, hoveredElement);
        }
      }

      if (
        event.altKey &&
        !app.state.selectedLinearElement?.initialState?.arrowStartIsInside &&
        getFeatureFlag("COMPLEX_BINDINGS")
      ) {
        handleSkipBindMode(app);
      }

      // Ignore drag requests if the arrow modification already happened
      if (linearElementEditor.initialState.lastClickedPoint === -1) {
        return true;
      }

      const newState = LinearElementEditor.handlePointDragging(
        event,
        app,
        pointerCoords.x,
        pointerCoords.y,
        linearElementEditor,
      );

      if (newState) {
        pointerDownState.lastCoords.x = pointerCoords.x;
        pointerDownState.lastCoords.y = pointerCoords.y;
        pointerDownState.drag.hasOccurred = true;

        // NOTE: Optimize setState calls because it
        // affects history and performance
        if (
          newState.suggestedBinding !== app.state.suggestedBinding ||
          !isShallowEqual(
            newState.selectedLinearElement?.selectedPointsIndices ?? [],
            app.state.selectedLinearElement?.selectedPointsIndices ?? [],
          ) ||
          newState.selectedLinearElement?.hoverPointIndex !==
            app.state.selectedLinearElement?.hoverPointIndex ||
          newState.selectedLinearElement?.customLineAngle !==
            app.state.selectedLinearElement?.customLineAngle ||
          app.state.selectedLinearElement.isDragging !==
            newState.selectedLinearElement?.isDragging ||
          app.state.selectedLinearElement?.initialState?.altFocusPoint !==
            newState.selectedLinearElement?.initialState?.altFocusPoint
        ) {
          app.setState(newState);
        }

        return true;
      }
    }
  }

  return false;
};

/**
 * While dragging during creation of a new linear element, drags its last
 * point.
 *
 * @returns whether the new element is a linear element and was handled (the
 * caller should skip the generic new-element drag handling).
 */
export const maybeDragNewLinearElement = (
  app: App,
  event: PointerEvent,
  pointerDownState: PointerDownState,
  newElement: NonNullable<AppState["newElement"]>,
  gridX: number,
  gridY: number,
): boolean => {
  if (isLinearElement(newElement) && !newElement.isDeleted) {
    pointerDownState.drag.hasOccurred = true;
    const points = newElement.points;

    invariant(
      points.length > 1,
      "Do not create linear elements with less than 2 points",
    );

    let linearElementEditor = app.state.selectedLinearElement;

    if (
      !linearElementEditor ||
      linearElementEditor.elementId !== newElement.id
    ) {
      linearElementEditor = new LinearElementEditor(
        newElement,
        app.scene.getNonDeletedElementsMap(),
      );
    }

    const lastClickedPointOutOfBounds =
      linearElementEditor &&
      (linearElementEditor.initialState.lastClickedPoint < 0 ||
        linearElementEditor.initialState.lastClickedPoint >= points.length);
    if (lastClickedPointOutOfBounds) {
      console.warn(
        "Last clicked point is out of bounds. Attempting to fix it.",
      );
      linearElementEditor = {
        ...linearElementEditor,
        selectedPointsIndices: [points.length - 1],
        initialState: {
          ...linearElementEditor.initialState,
          prevSelectedPointsIndices: null,
          lastClickedPoint: points.length - 1,
        },
        hoverPointIndex: points.length - 1,
      };
    }

    app.setState({
      newElement,
      ...LinearElementEditor.handlePointDragging(
        event,
        app,
        gridX,
        gridY,
        linearElementEditor,
      )!,
    });

    return true;
  }

  return false;
};

/**
 * While box-selecting inside the line editor, selects the points of the edited
 * linear element instead of elements.
 *
 * @returns whether the line editor consumed the box selection (the caller
 * should skip regular box-select).
 */
export const linearBoxSelectionFromPointerDownHandler = (
  app: App,
  event: PointerEvent,
): boolean => {
  if (app.state.selectedLinearElement?.isEditing) {
    LinearElementEditor.handleBoxSelection(
      event,
      app.state,
      app.setState.bind(app),
      app.scene.getNonDeletedElementsMap(),
    );
    return true;
  }

  return false;
};

/**
 * Finalizes the linear-element interaction on pointer up: renormalizes elbow
 * arrows bound to an indirectly moved element and ends point dragging / focus
 * point dragging of the selected linear element.
 *
 * `elementsMap` is the pointer-up-time non-deleted elements map captured at
 * the start of the pointer-up handler.
 */
export const linearElementOnPointerUpFromPointerDownHandler = (
  app: App,
  pointerDownState: PointerDownState,
  childEvent: PointerEvent,
  sceneCoords: { x: number; y: number },
  elementsMap: NonDeletedSceneElementsMap,
): void => {
  if (pointerDownState.drag.hasOccurred && pointerDownState.hit?.element?.id) {
    const element = elementsMap.get(pointerDownState.hit.element.id);
    if (isBindableElement(element)) {
      // Renormalize elbow arrows when they are changed via indirect move
      element.boundElements
        ?.filter((e) => e.type === "arrow")
        .map((e) => elementsMap.get(e.id))
        .filter((e) => isElbowArrow(e))
        .forEach((e) => {
          !!e && app.scene.mutateElement(e, {});
        });
    }
  }

  // Handle end of dragging a point of a linear element, might close a loop
  // and sets binding element
  if (
    app.state.selectedLinearElement?.isEditing &&
    !app.state.newElement &&
    app.state.selectedLinearElement.draggedFocusPointBinding === null
  ) {
    if (
      !pointerDownState.boxSelection.hasOccurred &&
      pointerDownState.hit?.element?.id !==
        app.state.selectedLinearElement.elementId &&
      app.state.selectedLinearElement.draggedFocusPointBinding === null
    ) {
      app.actionManager.executeAction(actionFinalize);
    } else {
      const editingLinearElement = LinearElementEditor.handlePointerUp(
        childEvent,
        app.state.selectedLinearElement,
        app.state,
        app.scene,
      );
      app.actionManager.executeAction(actionFinalize, "ui", {
        event: childEvent,
        sceneCoords,
      });
      if (editingLinearElement !== app.state.selectedLinearElement) {
        app.setState({
          selectedLinearElement: editingLinearElement,
          suggestedBinding: null,
        });
      }
    }
  } else if (app.state.selectedLinearElement) {
    // Normalize elbow arrow points, remove close parallel segments
    if (app.state.selectedLinearElement.elbowed) {
      const element = LinearElementEditor.getElement(
        app.state.selectedLinearElement.elementId,
        app.scene.getNonDeletedElementsMap(),
      );
      if (element) {
        app.scene.mutateElement(element as ExcalidrawElbowArrowElement, {});
      }
    }

    if (app.state.selectedLinearElement.draggedFocusPointBinding) {
      handleFocusPointPointerUp(app.state.selectedLinearElement, app.scene);
      app.setState({
        selectedLinearElement: {
          ...app.state.selectedLinearElement,
          draggedFocusPointBinding: null,
        },
      });
    } else if (
      pointerDownState.hit?.element?.id !==
      app.state.selectedLinearElement.elementId
    ) {
      const selectedELements = app.scene.getSelectedElements(app.state);
      // set selectedLinearElement to null if there is more than one element selected since we don't want to show linear element handles
      if (selectedELements.length > 1) {
        app.setState({ selectedLinearElement: null });
      }
    } else if (app.state.selectedLinearElement.isDragging) {
      app.setState({
        selectedLinearElement: {
          ...app.state.selectedLinearElement,
          isDragging: false,
        },
      });
      app.actionManager.executeAction(actionFinalize, "ui", {
        event: childEvent,
        sceneCoords,
      });
    }

    if (
      app.state.newElement &&
      app.state.multiElement &&
      isLinearElement(app.state.newElement) &&
      app.state.selectedLinearElement
    ) {
      const { multiElement } = app.state;

      app.setState({
        selectedLinearElement: {
          ...app.state.selectedLinearElement,
          lastCommittedPoint:
            multiElement.points[multiElement.points.length - 1],
        },
      });
    }
  }
};

/**
 * On pointer up while creating a new linear element: either enters multi-point
 * mode (short click) or finalizes the dragged-out element.
 *
 * `newElement`, `multiElement` and `activeTool` must be the state snapshot
 * taken at the start of the pointer-up handler, *before* state is reset.
 *
 * @returns whether the new element was a linear element (the caller should
 * return early).
 */
export const linearNewElementOnPointerUpHandler = (
  app: App,
  childEvent: PointerEvent,
  pointerDownState: PointerDownState,
  newElement: AppState["newElement"],
  multiElement: AppState["multiElement"],
  activeTool: AppState["activeTool"],
  sceneCoords: { x: number; y: number },
): boolean => {
  if (isLinearElement(newElement)) {
    const pointerCoords = viewportCoordsToSceneCoords(childEvent, app.state);

    const dragDistance =
      pointDistance(
        pointFrom(pointerCoords.x, pointerCoords.y),
        pointFrom(pointerDownState.origin.x, pointerDownState.origin.y),
      ) * app.state.zoom.value;

    if (
      (!pointerDownState.drag.hasOccurred ||
        dragDistance < MINIMUM_ARROW_SIZE) &&
      newElement &&
      !multiElement
    ) {
      if (app.editorInterface.isTouchScreen) {
        const FIXED_DELTA_X = Math.min(
          (app.state.width * 0.7) / app.state.zoom.value,
          100,
        );

        app.scene.mutateElement(
          newElement,
          {
            x: newElement.x - FIXED_DELTA_X / 2,
            points: [
              pointFrom<LocalPoint>(0, 0),
              pointFrom<LocalPoint>(FIXED_DELTA_X, 0),
            ],
          },
          { informMutation: false, isDragging: false },
        );

        app.actionManager.executeAction(actionFinalize);
      } else {
        // Movement out of commit area will create the point
        app.setState({
          multiElement: newElement,
          newElement,
        });
      }
    } else if (pointerDownState.drag.hasOccurred && !multiElement) {
      app.store.scheduleCapture();

      if (isLinearElement(newElement)) {
        app.actionManager.executeAction(actionFinalize, "ui", {
          event: childEvent,
          sceneCoords,
        });
      }
      app.setState({ suggestedBinding: null });
      if (!activeTool.locked) {
        resetCursor(app.interactiveCanvas);
        app.setState((prevState) => ({
          newElement: null,
          activeTool: updateActiveTool(app.state, {
            type: app.state.preferredSelectionTool.type,
          }),
          selectedElementIds: makeNextSelectedElementIds(
            {
              ...prevState.selectedElementIds,
              [newElement.id]: true,
            },
            prevState,
          ),
          selectedLinearElement: new LinearElementEditor(
            newElement,
            app.scene.getNonDeletedElementsMap(),
          ),
        }));
      } else {
        app.setState({
          newElement: null,
        });
      }
      // so that the scene gets rendered again to display the newly drawn linear as well
      app.scene.triggerUpdate();
    }
    return true;
  }

  return false;
};

/**
 * When editing the points of a linear element, we check if the linear element
 * still is in the frame afterwards; if not, the linear element will be removed
 * from its frame (if any).
 *
 * `elementsMap` is the pointer-up-time non-deleted elements map captured at
 * the start of the pointer-up handler.
 *
 * @returns whether the linear-element case applied (the caller should skip the
 * generic selected-elements frame membership update).
 */
export const linearFrameMembershipOnPointerUpHandler = (
  app: App,
  elementsMap: NonDeletedSceneElementsMap,
): boolean => {
  if (
    app.state.selectedLinearElement &&
    app.state.selectedLinearElement.isDragging
  ) {
    const linearElement = app.scene.getElement(
      app.state.selectedLinearElement.elementId,
    );

    if (linearElement?.frameId) {
      const frame = getContainingFrame(linearElement, elementsMap);

      if (frame && linearElement) {
        if (
          !elementOverlapsWithFrame(
            linearElement,
            frame,
            app.scene.getNonDeletedElementsMap(),
          )
        ) {
          // remove the linear element from all groups
          // before removing it from the frame as well
          app.scene.mutateElement(linearElement, {
            groupIds: [],
          });

          removeElementsFromFrame(
            [linearElement],
            app.scene.getNonDeletedElementsMap(),
          );

          app.scene.triggerUpdate();
        }
      }
    }

    return true;
  }

  return false;
};

/**
 * Handles the arrow/binding concerns of a key release: ALT point-like drag,
 * bind-mode restoration and fixed-point binding updates after arrow-key moves.
 */
export const linearAltKeyDownBindModeHandler = (
  app: App,
  event: React.KeyboardEvent | KeyboardEvent,
): void => {
  // Handle Alt key for bind mode
  if (event.key === KEYS.ALT) {
    if (getFeatureFlag("COMPLEX_BINDINGS")) {
      handleSkipBindMode(app);
    } else {
      maybeHandleArrowPointlikeDrag({ app, event });
    }
  }
};

export const linearCtrlKeyDownBindModeHandler = (
  app: App,
  event: React.KeyboardEvent | KeyboardEvent,
): void => {
  if (event[KEYS.CTRL_OR_CMD] && !event.repeat) {
    if (getFeatureFlag("COMPLEX_BINDINGS")) {
      resetDelayedBindMode(app);
    }

    flushSync(() => {
      app.setState({
        isBindingEnabled: app.state.bindingPreference !== "enabled",
      });
    });

    maybeHandleArrowPointlikeDrag({ app, event });
  }
};

/**
 * Moves the selected elements by a keyboard step when an arrow key is pressed,
 * dropping bound arrows whose bound element isn't part of the selection and
 * updating bound elements after the move.
 *
 * @returns whether an arrow key was handled (the caller should skip the
 * `Enter` branch).
 */
export const linearArrowKeyMoveFromKeyDownHandler = (
  app: App,
  event: React.KeyboardEvent | KeyboardEvent,
): boolean => {
  if (!isArrowKey(event.key)) {
    return false;
  }

  let selectedElements = app.scene.getSelectedElements({
    selectedElementIds: app.state.selectedElementIds,
    includeBoundTextElement: true,
    includeElementsInFrames: true,
  });

  const arrowIdsToRemove = new Set<string>();

  selectedElements
    .filter((el): el is NonDeleted<ExcalidrawArrowElement> =>
      isBindingElement(el),
    )
    .filter((arrow) => {
      const startElementNotInSelection =
        arrow.startBinding &&
        !selectedElements.some((el) => el.id === arrow.startBinding?.elementId);
      const endElementNotInSelection =
        arrow.endBinding &&
        !selectedElements.some((el) => el.id === arrow.endBinding?.elementId);
      return startElementNotInSelection || endElementNotInSelection;
    })
    .forEach((arrow) => arrowIdsToRemove.add(arrow.id));

  selectedElements = selectedElements.filter(
    (el) => !arrowIdsToRemove.has(el.id),
  );

  const step =
    (app.getEffectiveGridSize() &&
      (event.shiftKey
        ? ELEMENT_TRANSLATE_AMOUNT
        : app.getEffectiveGridSize())) ||
    (event.shiftKey
      ? ELEMENT_SHIFT_TRANSLATE_AMOUNT
      : ELEMENT_TRANSLATE_AMOUNT);

  let offsetX = 0;
  let offsetY = 0;

  if (event.key === KEYS.ARROW_LEFT) {
    offsetX = -step;
  } else if (event.key === KEYS.ARROW_RIGHT) {
    offsetX = step;
  } else if (event.key === KEYS.ARROW_UP) {
    offsetY = -step;
  } else if (event.key === KEYS.ARROW_DOWN) {
    offsetY = step;
  }

  selectedElements.forEach((element) => {
    app.scene.mutateElement(
      element,
      {
        x: element.x + offsetX,
        y: element.y + offsetY,
      },
      { informMutation: false, isDragging: false },
    );

    updateBoundElements(element, app.scene, {
      simultaneouslyUpdated: selectedElements,
    });
  });

  app.scene.triggerUpdate();

  event.preventDefault();

  return true;
};

export const linearOnKeyUpHandler = (app: App, event: KeyboardEvent): void => {
  if (event.key === KEYS.ALT) {
    maybeHandleArrowPointlikeDrag({ app, event });
  }

  if (
    (event.key === KEYS.ALT && app.state.bindMode === "skip") ||
    (!event[KEYS.CTRL_OR_CMD] && !isBindingEnabled(app.state))
  ) {
    // Handle Alt key release for bind mode
    app.setState({
      bindMode: "orbit",
    });

    // Restart the timer if we're creating/editing a linear element and hovering over an element
    if (app.lastPointerMoveEvent && getFeatureFlag("COMPLEX_BINDINGS")) {
      const scenePointer = viewportCoordsToSceneCoords(
        {
          clientX: app.lastPointerMoveEvent.clientX,
          clientY: app.lastPointerMoveEvent.clientY,
        },
        app.state,
      );

      const hoveredElement = getHoveredElementForBinding(
        pointFrom<GlobalPoint>(scenePointer.x, scenePointer.y),
        app.scene.getNonDeletedElements(),
        app.scene.getNonDeletedElementsMap(),
      );

      if (app.state.selectedLinearElement) {
        const element = LinearElementEditor.getElement(
          app.state.selectedLinearElement.elementId,
          app.scene.getNonDeletedElementsMap(),
        );

        if (isBindingElement(element)) {
          handleDelayedBindModeChange(app, element, hoveredElement);
        }
      }
    }
  }
  if (!event[KEYS.CTRL_OR_CMD]) {
    const preferenceEnabled = app.state.bindingPreference === "enabled";
    if (app.state.isBindingEnabled !== preferenceEnabled) {
      flushSync(() => {
        app.setState({ isBindingEnabled: preferenceEnabled });
      });
    }

    maybeHandleArrowPointlikeDrag({ app, event });
  }
  if (isArrowKey(event.key)) {
    bindOrUnbindBindingElements(
      app.scene.getSelectedElements(app.state).filter(isArrowElement),
      app.scene,
      app.state,
    );

    const elementsMap = app.scene.getNonDeletedElementsMap();

    app.scene
      .getSelectedElements(app.state)
      .filter(isSimpleArrow)
      .forEach((element) => {
        // Update the fixed point bindings for non-elbow arrows
        // when the pointer is released, so that they are correctly positioned
        // after the drag.
        if (element.startBinding) {
          app.scene.mutateElement(element, {
            startBinding: {
              ...element.startBinding,
              ...calculateFixedPointForNonElbowArrowBinding(
                element,
                elementsMap.get(
                  element.startBinding.elementId,
                ) as ExcalidrawBindableElement,
                "start",
                elementsMap,
              ),
            },
          });
        }
        if (element.endBinding) {
          app.scene.mutateElement(element, {
            endBinding: {
              ...element.endBinding,
              ...calculateFixedPointForNonElbowArrowBinding(
                element,
                elementsMap.get(
                  element.endBinding.elementId,
                ) as ExcalidrawBindableElement,
                "end",
                elementsMap,
              ),
            },
          });
        }
      });

    app.setState({ suggestedBinding: null });
  }
};

const toggleArrowheadAtEndpoint = (
  app: App,
  element: ExcalidrawArrowElement,
  side: "start" | "end",
) => {
  const currentArrowhead =
    side === "start" ? element.startArrowhead : element.endArrowhead;

  app.store.scheduleCapture();

  let arrowheadUpdate:
    | { startArrowhead: Arrowhead | null }
    | { endArrowhead: Arrowhead | null };

  if (currentArrowhead) {
    app.removedArrowheads.set(`${element.id}:${side}`, currentArrowhead);
    arrowheadUpdate =
      side === "start" ? { startArrowhead: null } : { endArrowhead: null };
  } else {
    const arrowhead =
      app.removedArrowheads.get(`${element.id}:${side}`) ??
      (side === "start"
        ? app.state.currentItemStartArrowhead
        : app.state.currentItemEndArrowhead) ??
      "arrow";
    arrowheadUpdate =
      side === "start"
        ? { startArrowhead: arrowhead }
        : { endArrowhead: arrowhead };
  }

  app.scene.mapElements((_element) => {
    if (_element.id === element.id && isArrowElement(_element)) {
      return newElementWith(_element, arrowheadUpdate);
    }
    return _element;
  });
};

/**
 * Handles double click on a selected linear element: toggling an arrowhead
 * when double-clicking an arrow endpoint, entering the line editor, or
 * deleting an elbow arrow fixed segment.
 *
 * @returns whether the double click was handled (the caller should return
 * early).
 */
export const linearElementDoubleClickHandler = (
  app: App,
  event: Pick<
    React.MouseEvent<HTMLCanvasElement>,
    | "type"
    | "clientX"
    | "clientY"
    | "altKey"
    | "ctrlKey"
    | "metaKey"
    | "shiftKey"
  >,
  selectedElements: readonly NonDeletedExcalidrawElement[],
  sceneX: number,
  sceneY: number,
): boolean => {
  if (selectedElements.length === 1 && isLinearElement(selectedElements[0])) {
    const selectedLinearElement: ExcalidrawLinearElement = selectedElements[0];

    if (
      !event[KEYS.CTRL_OR_CMD] &&
      isArrowElement(selectedLinearElement) &&
      app.state.selectedLinearElement?.elementId === selectedLinearElement.id
    ) {
      const clickedPointIndex = LinearElementEditor.getPointIndexUnderCursor(
        selectedLinearElement,
        app.scene.getNonDeletedElementsMap(),
        app.state.zoom,
        sceneX,
        sceneY,
      );
      if (
        clickedPointIndex === 0 ||
        clickedPointIndex === selectedLinearElement.points.length - 1
      ) {
        toggleArrowheadAtEndpoint(
          app,
          selectedLinearElement,
          clickedPointIndex === 0 ? "start" : "end",
        );
        return true;
      }
    }

    if (
      ((event[KEYS.CTRL_OR_CMD] && isSimpleArrow(selectedLinearElement)) ||
        isLineElement(selectedLinearElement)) &&
      (!app.state.selectedLinearElement?.isEditing ||
        app.state.selectedLinearElement.elementId !== selectedLinearElement.id)
    ) {
      // Use the proper action to ensure immediate history capture
      app.actionManager.executeAction(actionToggleLinearEditor);
      return true;
    } else if (
      app.state.selectedLinearElement &&
      isElbowArrow(selectedElements[0])
    ) {
      const hitCoords = LinearElementEditor.getSegmentMidpointHitCoords(
        app.state.selectedLinearElement,
        { x: sceneX, y: sceneY },
        app.state,
        app.scene.getNonDeletedElementsMap(),
      );
      const midPoint = hitCoords
        ? LinearElementEditor.getSegmentMidPointIndex(
            app.state.selectedLinearElement,
            app.state,
            hitCoords,
            app.scene.getNonDeletedElementsMap(),
          )
        : -1;

      if (midPoint && midPoint > -1) {
        app.store.scheduleCapture();
        LinearElementEditor.deleteFixedSegment(
          selectedElements[0],
          app.scene,
          midPoint,
        );

        const nextCoords = LinearElementEditor.getSegmentMidpointHitCoords(
          {
            ...app.state.selectedLinearElement,
            segmentMidPointHoveredCoords: null,
          },
          { x: sceneX, y: sceneY },
          app.state,
          app.scene.getNonDeletedElementsMap(),
        );
        const nextIndex = nextCoords
          ? LinearElementEditor.getSegmentMidPointIndex(
              app.state.selectedLinearElement,
              app.state,
              nextCoords,
              app.scene.getNonDeletedElementsMap(),
            )
          : null;

        app.setState({
          selectedLinearElement: {
            ...app.state.selectedLinearElement,
            initialState: {
              ...app.state.selectedLinearElement.initialState,
              segmentMidpoint: {
                index: nextIndex,
                value: hitCoords,
                added: false,
              },
            },
            segmentMidPointHoveredCoords: nextCoords,
          },
        });

        return true;
      }
    } else if (
      app.state.selectedLinearElement?.isEditing &&
      app.state.selectedLinearElement.elementId === selectedLinearElement.id &&
      isLineElement(selectedLinearElement)
    ) {
      return true;
    }
  }

  return false;
};

/**
 * On pointer up, selects the hit linear element for point editing when it is
 * the only selected element.
 */
export const maybeSelectLinearElementOnPointerUp = (
  app: App,
  hitElement: ExcalidrawElement | null,
): void => {
  if (
    app.state.selectedLinearElement?.elementId !== hitElement?.id &&
    isLinearElement(hitElement)
  ) {
    const selectedElements = app.scene.getSelectedElements(app.state);
    // set selectedLinearElement when no other element selected except
    // the one we've hit
    if (selectedElements.length === 1) {
      app.setState({
        selectedLinearElement: new LinearElementEditor(
          hitElement,
          app.scene.getNonDeletedElementsMap(),
        ),
      });
    }
  }
};
