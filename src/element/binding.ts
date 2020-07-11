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
      "startBoundElementID",
    );
  }
  const hoveredElement = getHoveredElementForBinding(
    appState,
    scene,
    pointerCoords,
  );
  if (hoveredElement != null) {
    bindLinearElement(linearElement, hoveredElement, "endBoundElementID");
  }
};

const bindLinearElement = (
  linearElement: ExcalidrawLinearElement,
  hoveredElement: ExcalidrawBindableElement,
  startOrEndBoundElementIDField: "startBoundElementID" | "endBoundElementID",
): void => {
  mutateElement(linearElement, {
    [startOrEndBoundElementIDField]: hoveredElement.id,
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
