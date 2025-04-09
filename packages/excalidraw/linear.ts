import {
  CURSOR_TYPE,
  getGridPoint,
  KEYS,
  LINE_CONFIRM_THRESHOLD,
  shouldRotateWithDiscreteAngle,
  updateActiveTool,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import { getLockedLinearCursorAlignSize } from "@excalidraw/element/sizeHelpers";

import {
  isArrowElement,
  isBindingElement,
  isElbowArrow,
} from "@excalidraw/element/typeChecks";
import {
  getHoveredElementForBinding,
  getOutlineAvoidingPoint,
  isBindingEnabled,
  isLinearElementSimpleAndAlreadyBound,
  maybeBindLinearElement,
} from "@excalidraw/element/binding";

import { pointDistance, pointFrom } from "@excalidraw/math";
import { mutateElement } from "@excalidraw/element/mutateElement";

import { LinearElementEditor } from "@excalidraw/element/linearElementEditor";

import { isPathALoop } from "@excalidraw/element/shapes";

import { makeNextSelectedElementIds } from "@excalidraw/element/selection";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";

import type {
  ExcalidrawBindableElement,
  ExcalidrawLinearElement,
  NonDeleted,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { resetCursor, setCursor, setCursorForShape } from "./cursor";

import type App from "./components/App";

import type { ActiveTool, PointerDownState } from "./types";

/**
 * This function is called when the user drags the pointer to create a new linear element.
 */
export function onPointerMoveFromPointerDownOnLinearElement(
  newElement: ExcalidrawLinearElement,
  app: App,
  pointerDownState: PointerDownState,
  pointerCoords: { x: number; y: number },
  event: PointerEvent,
  elementsMap: NonDeletedSceneElementsMap,
) {
  pointerDownState.drag.hasOccurred = true;
  const points = newElement.points;
  const [gridX, gridY] = getGridPoint(
    pointerCoords.x,
    pointerCoords.y,
    event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
  );
  let dx = gridX - newElement.x;
  let dy = gridY - newElement.y;

  if (shouldRotateWithDiscreteAngle(event) && points.length === 2) {
    ({ width: dx, height: dy } = getLockedLinearCursorAlignSize(
      newElement.x,
      newElement.y,
      pointerCoords.x,
      pointerCoords.y,
    ));
  }

  if (points.length === 1) {
    let x = newElement.x + dx;
    let y = newElement.y + dy;
    if (isArrowElement(newElement)) {
      [x, y] = getOutlineAvoidingPoint(
        newElement,
        pointFrom<GlobalPoint>(pointerCoords.x, pointerCoords.y),
        newElement.points.length - 1,
        app.scene,
        app.state.zoom,
        pointFrom<GlobalPoint>(newElement.x + dx, newElement.y + dy),
      );
    }

    mutateElement(
      newElement,
      {
        points: [
          ...points,
          pointFrom<LocalPoint>(x - newElement.x, y - newElement.y),
        ],
      },
      false,
    );
  } else if (
    points.length === 2 ||
    (points.length > 1 && isElbowArrow(newElement))
  ) {
    const targets = [];

    if (isArrowElement(newElement)) {
      const [endX, endY] = getOutlineAvoidingPoint(
        newElement,
        pointFrom<GlobalPoint>(pointerCoords.x, pointerCoords.y),
        points.length - 1,
        app.scene,
        app.state.zoom,
        pointFrom<GlobalPoint>(newElement.x + dx, newElement.y + dy),
      );

      targets.push({
        index: points.length - 1,
        isDragging: true,
        point: pointFrom<LocalPoint>(endX - newElement.x, endY - newElement.y),
      });
    } else {
      targets.push({
        index: points.length - 1,
        isDragging: true,
        point: pointFrom<LocalPoint>(dx, dy),
      });
    }

    LinearElementEditor.movePoints(newElement, targets);
  }

  app.setState({
    newElement,
  });

  if (isBindingElement(newElement, false)) {
    // When creating a linear element by dragging
    maybeSuggestBindingsForLinearElementAtCoords(
      newElement,
      [pointerCoords],
      app,
      app.state.startBoundElement,
    );
  }
}

/**
 *
 */
export function handleCanvasPointerMoveForLinearElement(
  multiElement: NonDeleted<ExcalidrawLinearElement>,
  app: App,
  scenePointerX: number,
  scenePointerY: number,
  event: React.PointerEvent<HTMLCanvasElement>,
  triggerRender: (forceUpdate?: boolean) => void,
) {
  const { x: rx, y: ry } = multiElement;

  const { points, lastCommittedPoint } = multiElement;
  const lastPoint = points[points.length - 1];

  setCursorForShape(app.interactiveCanvas, app.state);

  if (lastPoint === lastCommittedPoint) {
    // if we haven't yet created a temp point and we're beyond commit-zone
    // threshold, add a point
    if (
      pointDistance(
        pointFrom(scenePointerX - rx, scenePointerY - ry),
        lastPoint,
      ) >= LINE_CONFIRM_THRESHOLD
    ) {
      mutateElement(
        multiElement,
        {
          points: [
            ...points,
            pointFrom<LocalPoint>(scenePointerX - rx, scenePointerY - ry),
          ],
        },
        false,
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
    mutateElement(
      multiElement,
      {
        points: points.slice(0, -1),
      },
      false,
    );
  } else {
    const [gridX, gridY] = getGridPoint(
      scenePointerX,
      scenePointerY,
      event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
    );

    const [lastCommittedX, lastCommittedY] =
      multiElement?.lastCommittedPoint ?? [0, 0];

    let dxFromLastCommitted = gridX - rx - lastCommittedX;
    let dyFromLastCommitted = gridY - ry - lastCommittedY;

    if (shouldRotateWithDiscreteAngle(event)) {
      ({ width: dxFromLastCommitted, height: dyFromLastCommitted } =
        getLockedLinearCursorAlignSize(
          // actual coordinate of the last committed point
          lastCommittedX + rx,
          lastCommittedY + ry,
          // cursor-grid coordinate
          gridX,
          gridY,
        ));
    }

    if (isPathALoop(points, app.state.zoom.value)) {
      setCursor(app.interactiveCanvas, CURSOR_TYPE.POINTER);
    }

    let x = multiElement.x + lastCommittedX + dxFromLastCommitted;
    let y = multiElement.y + lastCommittedY + dyFromLastCommitted;

    if (isArrowElement(multiElement)) {
      [x, y] = getOutlineAvoidingPoint(
        multiElement,
        pointFrom<GlobalPoint>(scenePointerX, scenePointerY),
        multiElement.points.length - 1,
        app.scene,
        app.state.zoom,
        pointFrom<GlobalPoint>(x, y),
      );
    }

    // update last uncommitted point
    LinearElementEditor.movePoints(multiElement, [
      {
        index: points.length - 1,
        point: pointFrom<LocalPoint>(x - multiElement.x, y - multiElement.y),
        isDragging: true,
      },
    ]);

    // in this path, we're mutating multiElement to reflect
    // how it will be after adding pointer position as the next point
    // trigger update here so that new element canvas renders again to reflect this
    triggerRender(false);
  }
}

export function onPointerUpFromPointerDownOnLinearElementHandler(
  newElement: ExcalidrawLinearElement,
  multiElement: NonDeleted<ExcalidrawLinearElement> | null,
  app: App,
  store: App["store"],
  pointerDownState: PointerDownState,
  childEvent: PointerEvent,
  activeTool: {
    lastActiveTool: ActiveTool | null;
    locked: boolean;
    fromSelection: boolean;
  } & ActiveTool,
) {
  if (newElement!.points.length > 1) {
    store.shouldCaptureIncrement();
  }
  const pointerCoords = viewportCoordsToSceneCoords(childEvent, app.state);

  if (!pointerDownState.drag.hasOccurred && newElement && !multiElement) {
    mutateElement(newElement, {
      points: [
        ...newElement.points,
        pointFrom<LocalPoint>(
          pointerCoords.x - newElement.x,
          pointerCoords.y - newElement.y,
        ),
      ],
    });
    app.setState({
      multiElement: newElement,
      newElement,
    });
  } else if (pointerDownState.drag.hasOccurred && !multiElement) {
    if (isBindingEnabled(app.state) && isBindingElement(newElement, false)) {
      maybeBindLinearElement(
        newElement,
        app.state,
        app.scene.getNonDeletedElementsMap(),
        app.scene.getNonDeletedElements(),
      );
    }
    app.setState({ suggestedBindings: [], startBoundElement: null });
    if (!activeTool.locked) {
      resetCursor(app.interactiveCanvas);
      app.setState((prevState) => ({
        newElement: null,
        activeTool: updateActiveTool(app.state, {
          type: "selection",
        }),
        selectedElementIds: makeNextSelectedElementIds(
          {
            ...prevState.selectedElementIds,
            [newElement.id]: true,
          },
          prevState,
        ),
        selectedLinearElement: new LinearElementEditor(newElement),
      }));
    } else {
      app.setState((prevState) => ({
        newElement: null,
      }));
    }
    // so that the scene gets rendered again to display the newly drawn linear as well
    app.scene.triggerUpdate();
  }
}

/**
 * Handles double click on a linear element to edit it or delete a segment
 */
export function handleDoubleClickForLinearElement(
  app: App,
  store: App["store"],
  selectedElement: NonDeleted<ExcalidrawLinearElement>,
  event: React.MouseEvent<HTMLCanvasElement>,
  sceneX: number,
  sceneY: number,
) {
  if (
    event[KEYS.CTRL_OR_CMD] &&
    (!app.state.editingLinearElement ||
      app.state.editingLinearElement.elementId !== selectedElement.id) &&
    !isElbowArrow(selectedElement)
  ) {
    store.shouldCaptureIncrement();
    app.setState({
      editingLinearElement: new LinearElementEditor(selectedElement),
    });
  } else if (app.state.selectedLinearElement && isElbowArrow(selectedElement)) {
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
      store.shouldCaptureIncrement();
      LinearElementEditor.deleteFixedSegment(selectedElement, midPoint);

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
          pointerDownState: {
            ...app.state.selectedLinearElement.pointerDownState,
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
  }
}

export function maybeSuggestBindingsForLinearElementAtCoords(
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  /** scene coords */
  pointerCoords: {
    x: number;
    y: number;
  }[],
  app: App,
  // During line creation the start binding hasn't been written yet
  // into `linearElement`
  oppositeBindingBoundElement?: ExcalidrawBindableElement | null,
) {
  if (!pointerCoords.length) {
    return;
  }

  const suggestedBindings = pointerCoords.reduce(
    (acc: NonDeleted<ExcalidrawBindableElement>[], coords) => {
      const hoveredBindableElement = getHoveredElementForBinding(
        coords,
        app.scene.getNonDeletedElements(),
        app.scene.getNonDeletedElementsMap(),
        app.state.zoom,
        isElbowArrow(linearElement),
        isElbowArrow(linearElement),
      );
      if (
        hoveredBindableElement != null &&
        !isLinearElementSimpleAndAlreadyBound(
          linearElement,
          oppositeBindingBoundElement?.id,
          hoveredBindableElement,
        )
      ) {
        acc.push(hoveredBindableElement);
      }
      return acc;
    },
    [],
  );

  app.setState({ suggestedBindings });
}
