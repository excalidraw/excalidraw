import {
  ExcalidrawLinearElement,
  ExcalidrawBindableElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
  PointBinding,
  ExcalidrawElement,
} from "./types";
import { getElementAtPosition } from "../scene";
import { AppState } from "../types";
import {
  isBindableElement,
  isLinearElement,
  isBindingElement,
} from "./typeChecks";
import {
  bindingBorderTest,
  distanceToBindableElement,
  maxBindingGap,
  determineFocusDistance,
  intersectElementWithLine,
  determineFocusPoint,
} from "./collision";
import { mutateElement } from "./mutateElement";
import Scene from "../scene/Scene";
import { LinearElementEditor } from "./linearElementEditor";
import { tupleToCoors } from "../utils";

export const bindOrUnbindLinearElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  startBindingElement: ExcalidrawBindableElement | null | "keep",
  endBindingElement: ExcalidrawBindableElement | null | "keep",
): void => {
  if (startBindingElement !== "keep") {
    if (startBindingElement != null) {
      bindLinearElement(linearElement, startBindingElement, "start");
    } else {
      unbindLinearElement(linearElement, "start");
    }
  }
  if (endBindingElement !== "keep") {
    if (endBindingElement != null) {
      bindLinearElement(linearElement, endBindingElement, "end");
    } else {
      unbindLinearElement(linearElement, "end");
    }
  }
};

export const bindOrUnbindSelectedElements = (
  elements: NonDeleted<ExcalidrawElement>[],
): void => {
  elements.forEach((linearElement) => {
    if (isLinearElement(linearElement)) {
      bindOrUnbindLinearElement(
        linearElement,
        getElligibleElementForBindingElement(linearElement, "start"),
        getElligibleElementForBindingElement(linearElement, "end"),
      );
    }
  });
};

export const maybeBindLinearElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  appState: AppState,
  scene: Scene,
  pointerCoords: { x: number; y: number },
): void => {
  if (appState.boundElement != null) {
    bindLinearElement(linearElement, appState.boundElement, "start");
  }
  const hoveredElement = getHoveredElementForBinding(pointerCoords, scene);
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
      ...calculateFocusAndGap(linearElement, hoveredElement, startOrEnd),
    } as PointBinding,
  });
  mutateElement(hoveredElement, {
    boundElementIds: [
      ...new Set([...(hoveredElement.boundElementIds ?? []), linearElement.id]),
    ],
  });
};

const unbindLinearElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  startOrEnd: "start" | "end",
): void => {
  const field = startOrEnd === "start" ? "startBinding" : "endBinding";
  const binding = linearElement[field];
  if (binding == null) {
    return;
  }
  const bindingElement = Scene.getScene(linearElement)!.getNonDeletedElement(
    binding.elementId,
  );
  mutateElement(linearElement, { [field]: null });
  if (bindingElement == null) {
    return;
  }
  mutateElement(bindingElement, {
    boundElementIds: bindingElement.boundElementIds?.filter(
      (id) => id !== linearElement.id,
    ),
  });
};

export const getHoveredElementForBinding = (
  pointerCoords: {
    x: number;
    y: number;
  },
  scene: Scene,
): NonDeleted<ExcalidrawBindableElement> | null => {
  const hoveredElement = getElementAtPosition(
    scene.getElements(),
    (element) =>
      isBindableElement(element) &&
      bindingBorderTest(element, pointerCoords.x, pointerCoords.y),
  );
  return hoveredElement as NonDeleted<ExcalidrawBindableElement> | null;
};

const calculateFocusAndGap = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  hoveredElement: ExcalidrawBindableElement,
  startOrEnd: "start" | "end",
): { focus: number; gap: number } => {
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
  return {
    focus: determineFocusDistance(hoveredElement, adjacentPoint, edgePoint),
    gap: Math.max(1, distanceToBindableElement(hoveredElement, edgePoint)),
  };
};

// Supports translating, rotating and scaling `changedElement` with bound
// linear elements.
// Because scaling involves moving the focus points as well, it is
// done before the `changedElement` is updated, and the `newSize` is passed
// in explicitly.
export const updateBoundElements = (
  changedElement: NonDeletedExcalidrawElement,
  options?: {
    simultaneouslyUpdated?: readonly ExcalidrawElement[];
    newSize?: { width: number; height: number };
  },
) => {
  const boundElementIds = changedElement.boundElementIds ?? [];
  if (boundElementIds.length === 0) {
    return;
  }
  const { newSize, simultaneouslyUpdated } = options ?? {};
  const simultaneouslyUpdatedElementIds = getSimultaneouslyUpdatedElementIds(
    simultaneouslyUpdated,
  );
  (Scene.getScene(changedElement)!.getNonDeletedElements(
    boundElementIds,
  ) as NonDeleted<ExcalidrawLinearElement>[]).forEach((linearElement) => {
    const bindingElement = changedElement as ExcalidrawBindableElement;
    if (!doesNeedUpdate(linearElement, bindingElement)) {
      return;
    }
    const startBinding = maybeCalculateNewGapWhenScaling(
      bindingElement,
      linearElement.startBinding,
      newSize,
    );
    const endBinding = maybeCalculateNewGapWhenScaling(
      bindingElement,
      linearElement.endBinding,
      newSize,
    );
    // `linearElement` is being moved/scaled already, just update the binding
    if (simultaneouslyUpdatedElementIds.has(linearElement.id)) {
      mutateElement(linearElement, { startBinding, endBinding });
      return;
    }
    updateBoundPoint(
      linearElement,
      "start",
      startBinding,
      changedElement as ExcalidrawBindableElement,
    );
    updateBoundPoint(
      linearElement,
      "end",
      endBinding,
      changedElement as ExcalidrawBindableElement,
    );
  });
};

const doesNeedUpdate = (
  boundElement: NonDeleted<ExcalidrawLinearElement>,
  changedElement: ExcalidrawBindableElement,
) => {
  return (
    boundElement.startBinding?.elementId === changedElement.id ||
    boundElement.endBinding?.elementId === changedElement.id
  );
};

const getSimultaneouslyUpdatedElementIds = (
  simultaneouslyUpdated: readonly ExcalidrawElement[] | undefined,
): Set<ExcalidrawElement["id"]> => {
  return new Set((simultaneouslyUpdated || []).map((element) => element.id));
};

const updateBoundPoint = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  startOrEnd: "start" | "end",
  binding: PointBinding | null | undefined,
  changedElement: ExcalidrawBindableElement,
): void => {
  if (
    binding == null ||
    // We only need to update the other end if this is a 2 point line element
    (binding.elementId !== changedElement.id && linearElement.points.length > 2)
  ) {
    return;
  }
  const bindingElement = Scene.getScene(linearElement)!.getElement(
    binding.elementId,
  ) as ExcalidrawBindableElement | null;
  if (bindingElement == null) {
    // We're not cleaning up after deleted elements atm., so handle this case
    return;
  }
  const direction = startOrEnd === "start" ? -1 : 1;
  const edgePointIndex = direction === -1 ? 0 : linearElement.points.length - 1;
  const adjacentPointIndex = edgePointIndex - direction;
  const adjacentPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    linearElement,
    adjacentPointIndex,
  );
  const focusPointAbsolute = determineFocusPoint(
    bindingElement,
    binding.focus,
    adjacentPoint,
  );
  let newEdgePoint;
  // The linear element was not originally pointing inside the bound shape,
  // we can point directly at the focus point
  if (binding.gap === 0) {
    newEdgePoint = focusPointAbsolute;
  } else {
    const intersections = intersectElementWithLine(
      bindingElement,
      adjacentPoint,
      focusPointAbsolute,
      binding.gap,
    );
    if (intersections.length === 0) {
      // This should never happen, since focusPoint should always be
      // inside the element, but just in case, bail out
      newEdgePoint = focusPointAbsolute;
    } else {
      // Guaranteed to intersect because focusPoint is always inside the shape
      newEdgePoint = intersections[0];
    }
  }
  LinearElementEditor.movePoint(
    linearElement,
    edgePointIndex,
    LinearElementEditor.pointFromAbsoluteCoords(linearElement, newEdgePoint),
    { [startOrEnd === "start" ? "startBinding" : "endBinding"]: binding },
  );
};

const maybeCalculateNewGapWhenScaling = (
  changedElement: ExcalidrawBindableElement,
  currentBinding: PointBinding | null | undefined,
  newSize: { width: number; height: number } | undefined,
): PointBinding | null | undefined => {
  if (currentBinding == null || newSize == null) {
    return currentBinding;
  }
  const { gap, focus, elementId } = currentBinding;
  const { width: newWidth, height: newHeight } = newSize;
  const { width, height } = changedElement;
  const newGap = Math.max(
    1,
    Math.min(
      maxBindingGap(newWidth, newHeight),
      gap * (newWidth < newHeight ? newWidth / width : newHeight / height),
    ),
  );
  return { elementId, gap: newGap, focus };
};

export const getEligibleElementsForBinding = (
  elements: NonDeleted<ExcalidrawElement>[],
): NonDeleted<ExcalidrawBindableElement>[] => {
  return elements
    .filter((element) => isBindingElement(element))
    .flatMap((linearElement) =>
      getElligibleElementsForBindingElement(
        linearElement as NonDeleted<ExcalidrawLinearElement>,
      ),
    );
};

const getElligibleElementsForBindingElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
): NonDeleted<ExcalidrawBindableElement>[] => {
  return [
    getElligibleElementForBindingElement(linearElement, "start"),
    getElligibleElementForBindingElement(linearElement, "end"),
  ].filter(
    (element): element is NonDeleted<ExcalidrawBindableElement> =>
      element != null,
  );
};

const getElligibleElementForBindingElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  startOrEnd: "start" | "end",
): NonDeleted<ExcalidrawBindableElement> | null => {
  const index = startOrEnd === "start" ? 0 : -1;
  return getHoveredElementForBinding(
    tupleToCoors(
      LinearElementEditor.getPointAtIndexGlobalCoordinates(
        linearElement,
        index,
      ),
    ),
    Scene.getScene(linearElement)!,
  );
};

// We need to:
// 1: Update elements not selected to point to duplicated elements
// 2: Update duplicated elements to point to other duplicated elements
export const fixBindingsAfterDuplication = (
  sceneElements: readonly ExcalidrawElement[],
  oldElements: readonly ExcalidrawElement[],
  oldIdToDuplicatedId: Map<ExcalidrawElement["id"], ExcalidrawElement["id"]>,
  // There are three copying mechanisms: Copy-paste, duplication and alt-drag.
  // Only when alt-dragging the new "duplicates" act as the "old", while
  // the "old" elements act as the "new copy" - essentially working reverse
  // to the other two.
  duplicatesServeAsOld?: "duplicatesServeAsOld" | undefined,
): void => {
  // First collect all the binding/bindable elements, so we only update
  // each once, regardless of whether they were duplicated or not.
  const allBoundElementIds: Set<ExcalidrawElement["id"]> = new Set();
  const allBindableElementIds: Set<ExcalidrawElement["id"]> = new Set();
  const shouldReverseRoles = duplicatesServeAsOld === "duplicatesServeAsOld";
  oldElements.forEach((oldElement) => {
    const { boundElementIds } = oldElement;
    if (boundElementIds != null && boundElementIds.length > 0) {
      boundElementIds.forEach((boundElementId) => {
        if (shouldReverseRoles && !oldIdToDuplicatedId.has(boundElementId)) {
          allBoundElementIds.add(boundElementId);
        }
      });
      allBindableElementIds.add(oldIdToDuplicatedId.get(oldElement.id)!);
    }
    if (isBindingElement(oldElement)) {
      if (oldElement.startBinding != null) {
        const { elementId } = oldElement.startBinding;
        if (shouldReverseRoles && !oldIdToDuplicatedId.has(elementId)) {
          allBindableElementIds.add(elementId);
        }
      }
      if (oldElement.endBinding != null) {
        const { elementId } = oldElement.endBinding;
        if (shouldReverseRoles && !oldIdToDuplicatedId.has(elementId)) {
          allBindableElementIds.add(elementId);
        }
      }
      if (oldElement.startBinding != null || oldElement.endBinding != null) {
        allBoundElementIds.add(oldIdToDuplicatedId.get(oldElement.id)!);
      }
    }
  });

  // Update the linear elements
  (sceneElements.filter(({ id }) =>
    allBoundElementIds.has(id),
  ) as ExcalidrawLinearElement[]).forEach((element) => {
    const { startBinding, endBinding } = element;
    mutateElement(element, {
      startBinding: newBindingAfterDuplication(
        startBinding,
        oldIdToDuplicatedId,
      ),
      endBinding: newBindingAfterDuplication(endBinding, oldIdToDuplicatedId),
    });
  });

  // Update the bindable shapes
  sceneElements
    .filter(({ id }) => allBindableElementIds.has(id))
    .forEach((bindableElement) => {
      const { boundElementIds } = bindableElement;
      if (boundElementIds != null && boundElementIds.length > 0) {
        mutateElement(bindableElement, {
          boundElementIds: boundElementIds.map(
            (boundElementId) =>
              oldIdToDuplicatedId.get(boundElementId) ?? boundElementId,
          ),
        });
      }
    });
};

const newBindingAfterDuplication = (
  binding: PointBinding | null,
  oldIdToDuplicatedId: Map<ExcalidrawElement["id"], ExcalidrawElement["id"]>,
): PointBinding | null => {
  if (binding == null) {
    return null;
  }
  const { elementId, focus, gap } = binding;
  return {
    focus,
    gap,
    elementId: oldIdToDuplicatedId.get(elementId) ?? elementId,
  };
};
