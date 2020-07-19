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
  maxBindingGap,
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

// Supports translating, rotating and scaling `changedElement` with bound
// linear elements.
// Because scaling involves moving the focus points as well, it is
// done before the `changedElement` is updated, and the `newSize` is passed
// in explicitly.
export const updateBoundElements = (
  changedElement: NonDeletedExcalidrawElement,
  newSize?: { width: number; height: number },
) => {
  const boundElementIds = changedElement.boundElementIds ?? [];
  if (boundElementIds.length === 0) {
    return;
  }
  (Scene.getScene(changedElement)!.getNonDeletedElements(
    changedElement.boundElementIds ?? [],
  ) as NonDeleted<ExcalidrawLinearElement>[]).forEach((boundElement) => {
    maybeUpdateBoundPoint(
      boundElement,
      "start",
      boundElement.startBinding,
      changedElement as ExcalidrawBindableElement,
      newSize,
    );
    maybeUpdateBoundPoint(
      boundElement,
      "end",
      boundElement.endBinding,
      changedElement as ExcalidrawBindableElement,
      newSize,
    );
  });
};

const maybeUpdateBoundPoint = (
  boundElement: NonDeleted<ExcalidrawLinearElement>,
  startOrEnd: "start" | "end",
  binding: PointBinding | null | undefined,
  changedElement: ExcalidrawBindableElement,
  newSize: { width: number; height: number } | undefined,
): void => {
  if (binding?.elementId === changedElement.id) {
    updateBoundPoint(
      boundElement,
      startOrEnd,
      binding,
      changedElement,
      newSize,
    );
  }
};

const updateBoundPoint = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  startOrEnd: "start" | "end",
  currentBinding: PointBinding,
  changedElement: ExcalidrawBindableElement,
  newSize: { width: number; height: number } | undefined,
): void => {
  const binding = maybeCalculateFocusPointAndGapWhenScaling(
    changedElement,
    currentBinding,
    newSize,
  );
  const direction = startOrEnd === "start" ? -1 : 1;
  const edgePointIndex = direction === -1 ? 0 : linearElement.points.length - 1;
  const adjacentPointIndex = edgePointIndex - direction;
  const draggedFocusPointAbsolute = pointInAbsoluteCoords(
    changedElement,
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
      changedElement,
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
    { [startOrEnd === "start" ? "startBinding" : "endBinding"]: binding },
  );
};

const maybeCalculateFocusPointAndGapWhenScaling = (
  changedElement: ExcalidrawBindableElement,
  currentBinding: PointBinding,
  newSize: { width: number; height: number } | undefined,
): PointBinding => {
  if (newSize == null) {
    return currentBinding;
  }
  const { gap, focusPoint, elementId } = currentBinding;
  const { width: newWidth, height: newHeight } = newSize;
  const newGap = Math.min(maxBindingGap(newWidth, newHeight), gap);

  const { width, height } = changedElement;
  const [x, y] = focusPoint;
  const newFocusPoint: Point = [
    x * (newWidth / width),
    y * (newHeight / height),
  ];
  return { elementId, gap: newGap, focusPoint: newFocusPoint };
};
