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

export const maybeBindStartOfLinearElement = (
  linearElement: ExcalidrawLinearElement,
  appState: AppState,
  scene: Scene,
  pointerCoords: { x: number; y: number },
): NonDeleted<ExcalidrawBindableElement> | null => {
  return maybeBindLinearElement(
    linearElement,
    "startBoundElementID",
    appState,
    scene,
    pointerCoords,
  );
};

export const maybeBindEndOfLinearElement = (
  linearElement: ExcalidrawLinearElement,
  appState: AppState,
  scene: Scene,
  pointerCoords: { x: number; y: number },
): void => {
  maybeBindLinearElement(
    linearElement,
    "endBoundElementID",
    appState,
    scene,
    pointerCoords,
  );
};

const maybeBindLinearElement = (
  linearElement: ExcalidrawLinearElement,
  startOrEndBoundElementIDField: "startBoundElementID" | "endBoundElementID",
  appState: AppState,
  scene: Scene,
  pointerCoords: { x: number; y: number },
): NonDeleted<ExcalidrawBindableElement> | null => {
  const hoveredElement = getHoveredElementForBinding(
    appState,
    scene,
    pointerCoords,
  );
  if (hoveredElement != null) {
    mutateElement(linearElement, {
      [startOrEndBoundElementIDField]: hoveredElement.id,
    });
    mutateElement(hoveredElement, {
      boundElementIds: [
        ...new Set([
          ...(hoveredElement.boundElementIds ?? []),
          linearElement.id,
        ]),
      ],
    });
  }
  return hoveredElement;
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
