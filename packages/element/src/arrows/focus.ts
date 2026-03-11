import { pointDistance, pointFrom, type GlobalPoint } from "@excalidraw/math";
import { invariant } from "@excalidraw/common";

import type { AppState, NullableGridSize } from "@excalidraw/excalidraw/types";

import {
  bindBindingElement,
  calculateFixedPointForNonElbowArrowBinding,
  FOCUS_POINT_SIZE,
  getBindingGap,
  getGlobalFixedPointForBindableElement,
  isBindingEnabled,
  maxBindingDistance_simple,
  unbindBindingElement,
  updateBoundPoint,
} from "../binding";
import {
  isBindableElement,
  isBindingElement,
  isElbowArrow,
} from "../typeChecks";
import { LinearElementEditor } from "../linearElementEditor";
import { getHoveredElementForFocusPoint, hitElementItself } from "../collision";
import { moveArrowAboveBindable } from "../zindex";

import type {
  ElementsMap,
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  NonDeletedSceneElementsMap,
  PointsPositionUpdates,
} from "../types";

import type { Scene } from "../Scene";

export const isFocusPointVisible = (
  focusPoint: GlobalPoint,
  arrow: ExcalidrawArrowElement,
  bindableElement: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
  appState: {
    isBindingEnabled: AppState["isBindingEnabled"];
    zoom: AppState["zoom"];
  },
  ignoreOverlap = false,
): boolean => {
  // No focus point management for elbow arrows, because elbow arrows
  // always have their focus point at the arrow point itself
  if (
    isElbowArrow(arrow) ||
    !isBindingEnabled(appState) ||
    arrow.points.length !== 2
  ) {
    return false;
  }

  // Avoid showing the focus point indicator if the focus point is essentially
  // on top of the arrow point it belongs to itself, if not ignoring specifically
  if (!ignoreOverlap) {
    const associatedPointIdx =
      arrow.startBinding?.elementId === bindableElement.id
        ? 0
        : arrow.points.length - 1;
    const associatedArrowPoint =
      LinearElementEditor.getPointAtIndexGlobalCoordinates(
        arrow,
        associatedPointIdx,
        elementsMap,
      );

    if (
      pointDistance(focusPoint, associatedArrowPoint) <
      (FOCUS_POINT_SIZE * 1.5) / appState.zoom.value
    ) {
      return false;
    }
  }

  // Check if the focus point is within the element's shape bounds
  return hitElementItself({
    element: bindableElement,
    elementsMap,
    point: focusPoint,
    threshold: getBindingGap(bindableElement, arrow),
    overrideShouldTestInside: true,
  });
};

// Updates the arrow endpoints in "orbit" configuration
const focusPointUpdate = (
  arrow: ExcalidrawArrowElement,
  bindableElement: ExcalidrawBindableElement | null,
  isStartBinding: boolean,
  elementsMap: NonDeletedSceneElementsMap,
  scene: Scene,
  appState: AppState,
  switchToInsideBinding: boolean,
) => {
  const pointUpdates = new Map();

  const bindingField = isStartBinding ? "startBinding" : "endBinding";
  const adjacentBindingField = isStartBinding ? "endBinding" : "startBinding";
  let currentBinding = arrow[bindingField];
  let adjacentBinding = arrow[adjacentBindingField];

  // Update the dragged focus point related end
  if (currentBinding && bindableElement) {
    // Update the targeted bindings
    const boundToSameElement =
      bindableElement &&
      adjacentBinding &&
      currentBinding.elementId === adjacentBinding.elementId;
    if (switchToInsideBinding || boundToSameElement) {
      currentBinding = {
        ...currentBinding,
        mode: "inside",
      };
    } else {
      currentBinding = {
        ...currentBinding,
        mode: "orbit",
      };
    }

    const pointIndex = isStartBinding ? 0 : arrow.points.length - 1;
    const newPoint = updateBoundPoint(
      arrow,
      bindingField as "startBinding" | "endBinding",
      currentBinding,
      bindableElement,
      elementsMap,
    );

    if (newPoint) {
      pointUpdates.set(pointIndex, { point: newPoint });
    }
  }

  // Also update the adjacent end if it has a binding
  if (adjacentBinding && adjacentBinding.mode === "orbit") {
    const adjacentBindableElement = elementsMap.get(
      adjacentBinding.elementId,
    ) as ExcalidrawBindableElement;

    if (
      adjacentBindableElement &&
      isBindableElement(adjacentBindableElement) &&
      isBindingEnabled(appState)
    ) {
      // Same shape bound on both ends
      const boundToSameElementAfterUpdate =
        bindableElement && adjacentBinding.elementId === bindableElement.id;
      if (switchToInsideBinding || boundToSameElementAfterUpdate) {
        adjacentBinding = {
          ...adjacentBinding,
          mode: "inside",
        };
      } else {
        adjacentBinding = {
          ...adjacentBinding,
          mode: "orbit",
        };
      }

      const adjacentPointIndex = isStartBinding ? arrow.points.length - 1 : 0;
      const adjacentNewPoint = updateBoundPoint(
        arrow,
        adjacentBindingField,
        adjacentBinding,
        adjacentBindableElement,
        elementsMap,
      );

      if (adjacentNewPoint) {
        pointUpdates.set(adjacentPointIndex, {
          point: adjacentNewPoint,
        });
      }
    }
  }

  if (pointUpdates.size > 0) {
    LinearElementEditor.movePoints(arrow, scene, pointUpdates, {
      [bindingField]: currentBinding,
      [adjacentBindingField]: adjacentBinding,
    });
  }
};

export const handleFocusPointDrag = (
  linearElementEditor: LinearElementEditor,
  elementsMap: NonDeletedSceneElementsMap,
  pointerCoords: { x: number; y: number },
  scene: Scene,
  appState: AppState,
  gridSize: NullableGridSize,
  switchToInsideBinding: boolean,
) => {
  const arrow = LinearElementEditor.getElement(
    linearElementEditor.elementId,
    elementsMap,
  ) as any;

  // Sanity checks
  if (
    !arrow ||
    !isBindingElement(arrow) ||
    isElbowArrow(arrow) ||
    !linearElementEditor.hoveredFocusPointBinding ||
    !linearElementEditor.draggedFocusPointBinding
  ) {
    return;
  }

  const isStartBinding =
    linearElementEditor.draggedFocusPointBinding === "start";
  const binding = isStartBinding ? arrow.startBinding : arrow.endBinding;
  const { x: offsetX, y: offsetY } = linearElementEditor.pointerOffset;
  const point = pointFrom<GlobalPoint>(
    pointerCoords.x - offsetX,
    pointerCoords.y - offsetY,
  );
  const bindingField = isStartBinding ? "startBinding" : "endBinding";
  const hit = getHoveredElementForFocusPoint(
    point,
    arrow,
    scene.getNonDeletedElements(),
    elementsMap,
    maxBindingDistance_simple(appState.zoom),
  );

  // Hovering a bindable element
  if (hit && isBindingEnabled(appState)) {
    // Break existing binding if bound to another shape or if binding is disabled
    if (arrow[bindingField] && hit.id !== binding?.elementId) {
      unbindBindingElement(
        arrow,
        linearElementEditor.draggedFocusPointBinding,
        scene,
      );
    }

    // Handle binding mode switch
    const newMode =
      switchToInsideBinding && arrow[bindingField]?.mode === "orbit"
        ? "inside"
        : !switchToInsideBinding && arrow[bindingField]?.mode === "inside"
        ? "orbit"
        : null;

    // If no existing binding, create it
    if (!arrow[bindingField] || newMode) {
      // Create a new binding if none exists
      bindBindingElement(
        arrow,
        hit,
        newMode || "orbit",
        linearElementEditor.draggedFocusPointBinding,
        scene,
        point,
      );
    }

    // Update the binding's fixed point
    scene.mutateElement(arrow, {
      [bindingField]: {
        ...arrow[bindingField],
        elementId: hit.id,
        mode: newMode || arrow[bindingField]?.mode || "orbit",
        ...calculateFixedPointForNonElbowArrowBinding(
          arrow,
          hit,
          linearElementEditor.draggedFocusPointBinding,
          elementsMap,
          point,
        ),
      },
    });
  } else {
    // Not hovering any bindable element, move the arrow endpoint
    const pointUpdates: PointsPositionUpdates = new Map();
    const pointIndex = isStartBinding ? 0 : arrow.points.length - 1;
    pointUpdates.set(pointIndex, {
      point: LinearElementEditor.createPointAt(
        arrow,
        elementsMap,
        point[0],
        point[1],
        gridSize,
      ),
    });
    LinearElementEditor.movePoints(arrow, scene, pointUpdates);
    if (arrow[bindingField]) {
      unbindBindingElement(arrow, isStartBinding ? "start" : "end", scene);
    }
  }

  // Update the arrow endpoints
  focusPointUpdate(
    arrow,
    hit,
    isStartBinding,
    elementsMap,
    scene,
    appState,
    switchToInsideBinding,
  );

  if (hit && isBindingEnabled(appState)) {
    moveArrowAboveBindable(
      point,
      arrow,
      scene.getElementsIncludingDeleted(),
      elementsMap,
      scene,
      hit,
    );
  }
};

export const handleFocusPointPointerDown = (
  arrow: ExcalidrawArrowElement,
  pointerDownState: { origin: { x: number; y: number } },
  elementsMap: NonDeletedSceneElementsMap,
  appState: AppState,
): {
  hitFocusPoint: "start" | "end" | null;
  pointerOffset: { x: number; y: number };
} => {
  const pointerPos = pointFrom(
    pointerDownState.origin.x,
    pointerDownState.origin.y,
  );
  const hitThreshold = (FOCUS_POINT_SIZE * 1.5) / appState.zoom.value;

  // Check start binding focus point
  if (arrow.startBinding?.elementId) {
    const bindableElement = elementsMap.get(arrow.startBinding.elementId);
    if (
      bindableElement &&
      isBindableElement(bindableElement) &&
      !bindableElement.isDeleted
    ) {
      const focusPoint = getGlobalFixedPointForBindableElement(
        arrow.startBinding.fixedPoint,
        bindableElement,
        elementsMap,
      );
      if (
        isFocusPointVisible(
          focusPoint,
          arrow,
          bindableElement,
          elementsMap,
          appState,
        ) &&
        pointDistance(pointerPos, focusPoint) <= hitThreshold
      ) {
        return {
          hitFocusPoint: "start",
          pointerOffset: {
            x: pointerPos[0] - focusPoint[0],
            y: pointerPos[1] - focusPoint[1],
          },
        };
      }
    }
  }

  // Check end binding focus point (only if start not already hit)
  if (arrow.endBinding?.elementId) {
    const bindableElement = elementsMap.get(arrow.endBinding.elementId);
    if (
      bindableElement &&
      isBindableElement(bindableElement) &&
      !bindableElement.isDeleted
    ) {
      const focusPoint = getGlobalFixedPointForBindableElement(
        arrow.endBinding.fixedPoint,
        bindableElement,
        elementsMap,
      );
      if (
        isFocusPointVisible(
          focusPoint,
          arrow,
          bindableElement,
          elementsMap,
          appState,
        ) &&
        pointDistance(pointerPos, focusPoint) <= hitThreshold
      ) {
        return {
          hitFocusPoint: "end",
          pointerOffset: {
            x: pointerPos[0] - focusPoint[0],
            y: pointerPos[1] - focusPoint[1],
          },
        };
      }
    }
  }

  return {
    hitFocusPoint: null,
    pointerOffset: { x: 0, y: 0 },
  };
};

export const handleFocusPointPointerUp = (
  linearElementEditor: LinearElementEditor,
  scene: Scene,
) => {
  invariant(
    linearElementEditor.draggedFocusPointBinding,
    "Must have a dragged focus point at pointer release",
  );

  const arrow = LinearElementEditor.getElement<ExcalidrawArrowElement>(
    linearElementEditor.elementId,
    scene.getNonDeletedElementsMap(),
  );
  invariant(arrow, "Arrow must be in the scene");

  // Clean up
  const bindingKey =
    linearElementEditor.draggedFocusPointBinding === "start"
      ? "startBinding"
      : "endBinding";
  const otherBindingKey =
    linearElementEditor.draggedFocusPointBinding === "start"
      ? "endBinding"
      : "startBinding";
  const boundElementId = arrow[bindingKey]?.elementId;
  const otherBoundElementId = arrow[otherBindingKey]?.elementId;
  const oldBoundElement =
    boundElementId &&
    scene
      .getNonDeletedElements()
      .find(
        (element) =>
          element.id !== boundElementId &&
          element.id !== otherBoundElementId &&
          isBindableElement(element) &&
          element.boundElements?.find(({ id }) => id === arrow.id),
      );
  if (oldBoundElement) {
    scene.mutateElement(oldBoundElement, {
      boundElements: oldBoundElement.boundElements?.filter(
        ({ id }) => id !== arrow.id,
      ),
    });
  }

  // Record the new bound element
  const boundElement =
    boundElementId && scene.getNonDeletedElementsMap().get(boundElementId);
  if (boundElement) {
    scene.mutateElement(boundElement, {
      boundElements: [
        ...(boundElement.boundElements || [])?.filter(
          ({ id }) => id !== arrow.id,
        ),
        {
          id: arrow.id,
          type: "arrow",
        },
      ],
    });
  }
};

export const handleFocusPointHover = (
  arrow: ExcalidrawArrowElement,
  scenePointerX: number,
  scenePointerY: number,
  scene: Scene,
  appState: AppState,
): "start" | "end" | null => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const pointerPos = pointFrom(scenePointerX, scenePointerY);
  const hitThreshold = (FOCUS_POINT_SIZE * 1.5) / appState.zoom.value;

  // Check start binding focus point
  if (arrow.startBinding?.elementId) {
    const bindableElement = elementsMap.get(arrow.startBinding.elementId);
    if (
      bindableElement &&
      isBindableElement(bindableElement) &&
      !bindableElement.isDeleted
    ) {
      const focusPoint = getGlobalFixedPointForBindableElement(
        arrow.startBinding.fixedPoint,
        bindableElement,
        elementsMap,
      );
      if (
        isFocusPointVisible(
          focusPoint,
          arrow,
          bindableElement,
          elementsMap,
          appState,
        ) &&
        pointDistance(pointerPos, focusPoint) <= hitThreshold
      ) {
        return "start";
      }
    }
  }

  // Check end binding focus point (only if start not already hovered)
  if (arrow.endBinding?.elementId) {
    const bindableElement = elementsMap.get(arrow.endBinding.elementId);
    if (
      bindableElement &&
      isBindableElement(bindableElement) &&
      !bindableElement.isDeleted
    ) {
      const focusPoint = getGlobalFixedPointForBindableElement(
        arrow.endBinding.fixedPoint,
        bindableElement,
        elementsMap,
      );
      if (
        isFocusPointVisible(
          focusPoint,
          arrow,
          bindableElement,
          elementsMap,
          appState,
        ) &&
        pointDistance(pointerPos, focusPoint) <= hitThreshold
      ) {
        return "end";
      }
    }
  }

  return null;
};
