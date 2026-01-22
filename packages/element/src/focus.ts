import {
  lineSegment,
  pointDistance,
  pointDistanceSq,
  pointFrom,
  pointFromVector,
  vectorFromPoint,
  vectorScale,
  type GlobalPoint,
} from "@excalidraw/math";
import { invariant } from "@excalidraw/common";

import type { AppState, NullableGridSize } from "@excalidraw/excalidraw/types";

import {
  bindBindingElement,
  calculateFixedPointForNonElbowArrowBinding,
  FOCUS_POINT_SIZE,
  getGlobalFixedPointForBindableElement,
  isBindingEnabled,
  maxBindingDistance_simple,
  unbindBindingElement,
  updateBoundPoint,
} from "./binding";
import {
  isBindableElement,
  isBindingElement,
  isElbowArrow,
} from "./typeChecks";
import { LinearElementEditor } from "./linearElementEditor";
import {
  getHoveredElementForBinding,
  hitElementItself,
  intersectElementWithLineSegment,
  isPointInElement,
} from "./collision";

import type {
  ElementsMap,
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  NonDeletedSceneElementsMap,
  PointsPositionUpdates,
} from "./types";

import type { Scene } from "./Scene";

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
  if (isElbowArrow(arrow) || !isBindingEnabled(appState)) {
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
    threshold: 1,
    overrideShouldTestInside: true,
  });
};

// Updates the arrow endpoints in "orbit" configuration
const focusPointOrbitUpdate = (
  arrow: ExcalidrawArrowElement,
  bindableElement: ExcalidrawBindableElement,
  isStartBinding: boolean,
  elementsMap: NonDeletedSceneElementsMap,
  scene: Scene,
) => {
  if (!arrow[isStartBinding ? "startBinding" : "endBinding"]) {
    return;
  }

  // Update the targeted bindings
  const updatedBinding = arrow[isStartBinding ? "startBinding" : "endBinding"];
  const pointUpdates = new Map();
  const pointIndex = isStartBinding ? 0 : arrow.points.length - 1;
  const bindingField = isStartBinding ? "startBinding" : "endBinding";
  const newPoint = updateBoundPoint(
    arrow,
    bindingField as "startBinding" | "endBinding",
    updatedBinding,
    bindableElement,
    elementsMap,
  );

  if (newPoint) {
    pointUpdates.set(pointIndex, { point: newPoint });
  }

  // Also update the adjacent end if it has a binding
  const adjacentBindingField = isStartBinding ? "endBinding" : "startBinding";
  const adjacentBinding = isStartBinding
    ? arrow.endBinding
    : arrow.startBinding;

  if (adjacentBinding?.elementId) {
    const adjacentBindableElement = elementsMap.get(
      adjacentBinding.elementId,
    ) as ExcalidrawBindableElement;

    if (
      adjacentBindableElement &&
      isBindableElement(adjacentBindableElement) &&
      !adjacentBindableElement.isDeleted
    ) {
      const adjacentPointIndex = isStartBinding ? arrow.points.length - 1 : 0;

      const adjacentNewPoint = updateBoundPoint(
        arrow,
        adjacentBindingField as "startBinding" | "endBinding",
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
      [bindingField]: {
        ...updatedBinding,
        mode: "orbit",
      },
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
    !linearElementEditor.hoveredFocusPointBinding
  ) {
    return;
  }

  const isStartBinding =
    linearElementEditor.hoveredFocusPointBinding === "start";
  const binding = isStartBinding ? arrow.startBinding : arrow.endBinding;
  const { x: offsetX, y: offsetY } = linearElementEditor.pointerOffset;
  const point = pointFrom<GlobalPoint>(
    pointerCoords.x - offsetX,
    pointerCoords.y - offsetY,
  );
  const hit = getHoveredElementForBinding(
    point,
    scene.getNonDeletedElements(),
    elementsMap,
    maxBindingDistance_simple(appState.zoom),
  );
  const bindingField = isStartBinding ? "startBinding" : "endBinding";

  if (hit) {
    // Hovering a bindable element...
    const insideBindableElement =
      hit && isPointInElement(point, hit, elementsMap);
    const arrowAdjacentPoint =
      LinearElementEditor.getPointAtIndexGlobalCoordinates(
        arrow,
        isStartBinding ? 1 : arrow.points.length - 2,
        elementsMap,
      );
    const arrowEndPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
      arrow,
      isStartBinding ? 0 : arrow.points.length - 1,
      elementsMap,
    );
    const intersector = lineSegment(
      arrowAdjacentPoint,
      pointFromVector(
        vectorScale(
          vectorFromPoint(point, arrowAdjacentPoint),
          Math.max(hit.width, hit.height) * 2 +
            pointDistance(arrowAdjacentPoint, point) * 2,
        ),
        arrowAdjacentPoint,
      ),
    );
    const focusPoint = insideBindableElement
      ? // Direct focus point positioning inside the bindable element
        point
      : // Outline focus point positioning when outside the bindable element
        intersectElementWithLineSegment(hit, elementsMap, intersector, 0).sort(
          (a, b) =>
            pointDistanceSq(a, arrowEndPoint) -
            pointDistanceSq(b, arrowEndPoint),
        )[0] || point;

    // Break existing binding if any
    if (arrow[bindingField] && hit.id !== binding?.elementId) {
      unbindBindingElement(
        arrow,
        linearElementEditor.hoveredFocusPointBinding,
        scene,
      );
    }

    // If no existing binding, create it
    if (!arrow[bindingField] && isBindingEnabled(appState)) {
      // Create a new binding if none exists
      bindBindingElement(
        arrow,
        hit,
        "orbit",
        linearElementEditor.hoveredFocusPointBinding,
        scene,
        point,
      );
    }

    // Update the binding's fixed point
    scene.mutateElement(arrow, {
      [bindingField]: {
        ...arrow[bindingField],
        ...calculateFixedPointForNonElbowArrowBinding(
          arrow,
          hit,
          linearElementEditor.hoveredFocusPointBinding,
          elementsMap,
          focusPoint,
        ),
      },
    });

    // Update the arrow endpoints
    focusPointOrbitUpdate(arrow, hit, isStartBinding, elementsMap, scene);
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
        gridSize, // TODO: Test around binding areas
      ),
    });
    LinearElementEditor.movePoints(arrow, scene, pointUpdates);
    if (arrow[bindingField]) {
      unbindBindingElement(arrow, isStartBinding ? "start" : "end", scene);
    }
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
    linearElementEditor.hoveredFocusPointBinding,
    "Must have a hovered focus point",
  );

  const arrow = LinearElementEditor.getElement<ExcalidrawArrowElement>(
    linearElementEditor.elementId,
    scene.getNonDeletedElementsMap(),
  );
  invariant(arrow, "Arrow must be in the scene");

  // Clean up
  const bindingKey =
    linearElementEditor.hoveredFocusPointBinding === "start"
      ? "startBinding"
      : "endBinding";
  const otherBindingKey =
    linearElementEditor.hoveredFocusPointBinding === "start"
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
