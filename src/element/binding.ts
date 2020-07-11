import {
  ExcalidrawLinearElement,
  ExcalidrawBindableElement,
  NonDeleted,
} from "./types";
import { AppState } from "../types";
import { getElementAtPosition } from "../scene";
import { isBindableElement } from "./typeChecks";
import { bindingBorderTest } from "./collision";
import { mutateElement } from "./mutateElement";
import Scene from "../scene/Scene";

export const maybeBindLinearElement = (
  linearElement: ExcalidrawLinearElement,
  appState: AppState,
  scene: Scene,
  pointerCoords: { x: number; y: number },
): void => {
  if (appState.boundElement != null) {
    bindLinearElement(
      linearElement,
      appState.boundElement,
      "start",
    );
  }
  const hoveredElement = getHoveredElementForBinding(
    appState,
    scene,
    pointerCoords,
  );
  if (hoveredElement != null) {
    bindLinearElement(
      linearElement,
      hoveredElement,
      "end",
    );
  }
};

const bindLinearElement = (
  linearElement: ExcalidrawLinearElement,
  hoveredElement: ExcalidrawBindableElement,
  startOrEnd: "start" | "end",
): void => {

  mutateElement(linearElement, {
    [startOrEnd === "start" ? "startBinding" : "endBinding"]: {
      element: hoveredElement,
      ...calculateFocusPointAndGap(linearElement, hoveredElement, startOrEnd),
    }
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
  linearElement: ExcalidrawLinearElement,
  hoveredElement: ExcalidrawBindableElement,
  startOrEnd: "start" | "end",
): { focusPoint: Point; gap: number } => {
  const direction = startOrEnd === "start" ? -1 : 1;
  const edgePointIndex = direction === -1 ? 0 : linearElement.points.length - 1;
  const adjacentPointIndex = edgePointIndex - direction;
  const edgePoint = linearElement.points[edgePointIndex];
  const adjacentPoint = linearElement.points[adjacentPointIndex];
   = intersectElementWithSemiLine(
    hoveredElement,
    adjacentPoint,
    edgePoint,
  );
  const [nearIntersection, farIntersection] = 
  return {
    focusPoint: centerPoint(nearIntersection, farIntersection),
    gap: distanceBetweenPoints(nearIntersection, farIntersection),
  };
};
