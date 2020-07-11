import {
  ExcalidrawLinearElement,
  ExcalidrawBindableElement,
  NonDeleted,
} from "./types";
import { AppState, Point } from "../types";
import { getElementAtPosition } from "../scene";
import { isBindableElement } from "./typeChecks";
import { bindingBorderTest, intersectElementWithLine } from "./collision";
import { mutateElement } from "./mutateElement";
import Scene from "../scene/Scene";
import { centerPoint, distanceBetweenPoints } from "../math";
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
    return { focusPoint: edgePoint, gap: 0 };
  }

  const [intersection1, intersection2] = intersections;
  return {
    focusPoint: pointRelativeTo(
      hoveredElement,
      centerPoint(intersection1, intersection2),
    ),
    gap: Math.min(
      distanceBetweenPoints(intersection1, edgePoint),
      distanceBetweenPoints(intersection2, edgePoint),
    ),
  };
};
