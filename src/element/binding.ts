import {
  ExcalidrawLinearElement,
  ExcalidrawBindableElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
  PointBinding,
} from "./types";
import { AppState, Point } from "../types";
import { getElementAtPosition } from "../scene";
import { isBindableElement } from "./typeChecks";
import {
  bindingBorderTest,
  intersectElementWithLine,
  distanceToBindableElement,
  pointInAbsoluteCoords,
} from "./collision";
import { mutateElement } from "./mutateElement";
import Scene from "../scene/Scene";
import { centerPoint } from "../math";
import { LinearElementEditor } from "./linearElementEditor";
import { pointRelativeTo } from "./bounds";

export const maybeBindLinearElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  appState: AppState,
  scene: Scene,
  pointerCoords: { x: number; y: number },
): void => {
  if (appState.boundElement != null) {
    bindLinearElement(linearElement, appState.boundElement, "start");
  }
  const hoveredElement = getHoveredElementForBinding(
    appState,
    scene,
    pointerCoords,
  );
  if (hoveredElement != null) {
    bindLinearElement(linearElement, hoveredElement, "end");
  }
};

const bindLinearElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  hoveredElement: ExcalidrawBindableElement,
  startOrEnd: "start" | "end",
): void => {
  mutateElement(linearElement, {
    [startOrEnd === "start" ? "startBinding" : "endBinding"]: {
      elementId: hoveredElement.id,
      ...calculateFocusPointAndGap(linearElement, hoveredElement, startOrEnd),
    },
  });
  mutateElement(hoveredElement, {
    boundElementIds: [
      ...new Set([...(hoveredElement.boundElementIds ?? []), linearElement.id]),
    ],
  });
};

export const getHoveredElementForBinding = (
  appState: AppState,
  scene: Scene,
  pointerCoords: {
    x: number;
    y: number;
  },
): NonDeleted<ExcalidrawBindableElement> | null => {
  const hoveredElement = getElementAtPosition(
    scene.getElements(),
    appState,
    pointerCoords.x,
    pointerCoords.y,
    (element, _, x, y) =>
      isBindableElement(element) && bindingBorderTest(element, appState, x, y),
  );
  return hoveredElement as NonDeleted<ExcalidrawBindableElement> | null;
};

const calculateFocusPointAndGap = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  hoveredElement: ExcalidrawBindableElement,
  startOrEnd: "start" | "end",
): { focusPoint: Point; gap: number } => {
  const direction = startOrEnd === "start" ? -1 : 1;
  const edgePointIndex = direction === -1 ? 0 : linearElement.points.length - 1;
  const adjacentPointIndex = edgePointIndex - direction;
  const edgePoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    linearElement,
    edgePointIndex,
  );
  const adjacentPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    linearElement,
    adjacentPointIndex,
  );
  const intersections = intersectElementWithLine(
    hoveredElement,
    adjacentPoint,
    edgePoint,
  );
  if (intersections.length === 0) {
    // The linear element is not pointing at the shape, just bind to
    // the position of the edge point
    return { focusPoint: pointRelativeTo(hoveredElement, edgePoint), gap: 0 };
  }

  const [intersectionNear, intersectionFar] = intersections;

  return {
    focusPoint: pointRelativeTo(
      hoveredElement,
      centerPoint(intersectionNear, intersectionFar),
    ),
    gap: distanceToBindableElement(hoveredElement, edgePoint),
  };
};

export const updateBoundElements = (
  draggedElement: NonDeletedExcalidrawElement,
) => {
  const boundElementIds = draggedElement.boundElementIds ?? [];
  if (boundElementIds.length === 0) {
    return;
  }
  (Scene.getScene(draggedElement)!.getNonDeletedElements(
    draggedElement.boundElementIds ?? [],
  ) as NonDeleted<ExcalidrawLinearElement>[]).forEach((boundElement) => {
    maybeUpdateBoundPoint(
      boundElement,
      "start",
      boundElement.startBinding,
      draggedElement as ExcalidrawBindableElement,
    );
    maybeUpdateBoundPoint(
      boundElement,
      "end",
      boundElement.endBinding,
      draggedElement as ExcalidrawBindableElement,
    );
  });
};

const maybeUpdateBoundPoint = (
  boundElement: NonDeleted<ExcalidrawLinearElement>,
  startOrEnd: "start" | "end",
  binding: PointBinding | null | undefined,
  draggedElement: ExcalidrawBindableElement,
): void => {
  if (binding?.elementId === draggedElement.id) {
    updateBoundPoint(boundElement, startOrEnd, binding, draggedElement);
  }
};

const updateBoundPoint = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  startOrEnd: "start" | "end",
  binding: PointBinding,
  draggedElement: ExcalidrawBindableElement,
): void => {
  const direction = startOrEnd === "start" ? -1 : 1;
  const edgePointIndex = direction === -1 ? 0 : linearElement.points.length - 1;
  const adjacentPointIndex = edgePointIndex - direction;
  const draggedFocusPointAbsolute = pointInAbsoluteCoords(
    draggedElement,
    binding.focusPoint,
  );
  let newEdgePoint;
  // The linear element was not originally pointing inside the bound shape,
  // we use simple binding without focus points
  if (binding.gap === 0) {
    newEdgePoint = draggedFocusPointAbsolute;
  } else {
    const adjacentPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
      linearElement,
      adjacentPointIndex,
    );
    const intersections = intersectElementWithLine(
      draggedElement,
      adjacentPoint,
      draggedFocusPointAbsolute,
      binding.gap,
    );
    if (intersections.length === 0) {
      // TODO: This should never happen, but it does due to scaling/rotating
      return;
    }
    // Guaranteed to intersect because focusPoint is always inside the shape
    newEdgePoint = intersections[0];
  }
  LinearElementEditor.movePoint(
    linearElement,
    edgePointIndex,
    LinearElementEditor.pointFromAbsoluteCoords(linearElement, newEdgePoint),
  );
};
