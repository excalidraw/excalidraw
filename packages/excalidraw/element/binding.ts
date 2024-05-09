import * as GA from "../ga";
import * as GAPoint from "../gapoints";
import * as GADirection from "../gadirections";
import * as GALine from "../galines";
import * as GATransform from "../gatransforms";

import type {
  ExcalidrawBindableElement,
  ExcalidrawElement,
  ExcalidrawRectangleElement,
  ExcalidrawDiamondElement,
  ExcalidrawEllipseElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawImageElement,
  ExcalidrawFrameLikeElement,
  ExcalidrawIframeLikeElement,
  NonDeleted,
  ExcalidrawLinearElement,
  PointBinding,
  NonDeletedExcalidrawElement,
  ElementsMap,
  NonDeletedSceneElementsMap,
  ExcalidrawTextElement,
  ExcalidrawArrowElement,
} from "./types";

import { getElementAbsoluteCoords } from "./bounds";
import type { AppClassProperties, AppState, Point } from "../types";
import { isPointOnShape } from "../../utils/collision";
import { getElementAtPosition } from "../scene";
import {
  isArrowElement,
  isBindableElement,
  isBindingElement,
  isBoundToContainer,
  isLinearElement,
  isTextElement,
} from "./typeChecks";
import type { ElementUpdate } from "./mutateElement";
import { mutateElement } from "./mutateElement";
import Scene from "../scene/Scene";
import { LinearElementEditor } from "./linearElementEditor";
import { arrayToMap, tupleToCoors } from "../utils";
import { KEYS } from "../keys";
import { getBoundTextElement, handleBindTextResize } from "./textElement";

export type SuggestedBinding =
  | NonDeleted<ExcalidrawBindableElement>
  | SuggestedPointBinding;

export type SuggestedPointBinding = [
  NonDeleted<ExcalidrawLinearElement>,
  "start" | "end" | "both",
  NonDeleted<ExcalidrawBindableElement>,
];

export const shouldEnableBindingForPointerEvent = (
  event: React.PointerEvent<HTMLElement>,
) => {
  return !event[KEYS.CTRL_OR_CMD];
};

export const isBindingEnabled = (appState: AppState): boolean => {
  return appState.isBindingEnabled;
};

const getNonDeletedElements = (
  scene: Scene,
  ids: readonly ExcalidrawElement["id"][],
): NonDeleted<ExcalidrawElement>[] => {
  const result: NonDeleted<ExcalidrawElement>[] = [];
  ids.forEach((id) => {
    const element = scene.getNonDeletedElement(id);
    if (element != null) {
      result.push(element);
    }
  });
  return result;
};

export const bindOrUnbindLinearElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  startBindingElement: ExcalidrawBindableElement | null | "keep",
  endBindingElement: ExcalidrawBindableElement | null | "keep",
  elementsMap: NonDeletedSceneElementsMap,
): void => {
  const boundToElementIds: Set<ExcalidrawBindableElement["id"]> = new Set();
  const unboundFromElementIds: Set<ExcalidrawBindableElement["id"]> = new Set();
  bindOrUnbindLinearElementEdge(
    linearElement,
    startBindingElement,
    endBindingElement,
    "start",
    boundToElementIds,
    unboundFromElementIds,
    elementsMap,
  );
  bindOrUnbindLinearElementEdge(
    linearElement,
    endBindingElement,
    startBindingElement,
    "end",
    boundToElementIds,
    unboundFromElementIds,
    elementsMap,
  );

  const onlyUnbound = Array.from(unboundFromElementIds).filter(
    (id) => !boundToElementIds.has(id),
  );

  getNonDeletedElements(Scene.getScene(linearElement)!, onlyUnbound).forEach(
    (element) => {
      mutateElement(element, {
        boundElements: element.boundElements?.filter(
          (element) =>
            element.type !== "arrow" || element.id !== linearElement.id,
        ),
      });
    },
  );
};

const bindOrUnbindLinearElementEdge = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  bindableElement: ExcalidrawBindableElement | null | "keep",
  otherEdgeBindableElement: ExcalidrawBindableElement | null | "keep",
  startOrEnd: "start" | "end",
  // Is mutated
  boundToElementIds: Set<ExcalidrawBindableElement["id"]>,
  // Is mutated
  unboundFromElementIds: Set<ExcalidrawBindableElement["id"]>,
  elementsMap: NonDeletedSceneElementsMap,
): void => {
  // "keep" is for method chaining convenience, a "no-op", so just bail out
  if (bindableElement === "keep") {
    return;
  }

  // null means break the bind, so nothing to consider here
  if (bindableElement === null) {
    const unbound = unbindLinearElement(linearElement, startOrEnd);
    if (unbound != null) {
      unboundFromElementIds.add(unbound);
    }
    return;
  }

  // While complext arrows can do anything, simple arrow with both ends trying
  // to bind to the same bindable should not be allowed, start binding takes
  // precedence
  if (isLinearElementSimple(linearElement)) {
    if (
      otherEdgeBindableElement == null ||
      (otherEdgeBindableElement === "keep"
        ? // TODO: Refactor - Needlessly complex
          !isLinearElementSimpleAndAlreadyBoundOnOppositeEdge(
            linearElement,
            bindableElement,
            startOrEnd,
          )
        : startOrEnd === "start" ||
          otherEdgeBindableElement.id !== bindableElement.id)
    ) {
      bindLinearElement(
        linearElement,
        bindableElement,
        startOrEnd,
        elementsMap,
      );
      boundToElementIds.add(bindableElement.id);
    }
  } else {
    bindLinearElement(linearElement, bindableElement, startOrEnd, elementsMap);
    boundToElementIds.add(bindableElement.id);
  }
};

const getOriginalBindingIfStillCloseOfLinearElementEdge = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  edge: "start" | "end",
  app: AppClassProperties,
): NonDeleted<ExcalidrawElement> | null => {
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const coors = getLinearElementEdgeCoors(linearElement, edge, elementsMap);
  const elementId =
    edge === "start"
      ? linearElement.startBinding?.elementId
      : linearElement.endBinding?.elementId;
  if (elementId) {
    const element = elementsMap.get(
      elementId,
    ) as NonDeleted<ExcalidrawBindableElement>;
    if (bindingBorderTest(element, coors, app)) {
      return element;
    }
  }

  return null;
};

const getOriginalBindingsIfStillCloseToArrowEnds = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  app: AppClassProperties,
): (NonDeleted<ExcalidrawElement> | null)[] =>
  ["start", "end"].map((edge) =>
    getOriginalBindingIfStillCloseOfLinearElementEdge(
      linearElement,
      edge as "start" | "end",
      app,
    ),
  );

const getBindingStrategyForDraggingArrowEndpoints = (
  selectedElement: NonDeleted<ExcalidrawLinearElement>,
  isBindingEnabled: boolean,
  draggingPoints: readonly number[],
  app: AppClassProperties,
): (NonDeleted<ExcalidrawBindableElement> | null | "keep")[] => {
  const startIdx = 0;
  const endIdx = selectedElement.points.length - 1;
  const startDragged = draggingPoints.findIndex((i) => i === startIdx) > -1;
  const endDragged = draggingPoints.findIndex((i) => i === endIdx) > -1;
  const start = startDragged
    ? isBindingEnabled
      ? getElligibleElementForBindingElement(selectedElement, "start", app)
      : null // If binding is disabled and start is dragged, break all binds
    : // We have to update the focus and gap of the binding, so let's rebind
      getElligibleElementForBindingElement(selectedElement, "start", app);
  const end = endDragged
    ? isBindingEnabled
      ? getElligibleElementForBindingElement(selectedElement, "end", app)
      : null // If binding is disabled and end is dragged, break all binds
    : // We have to update the focus and gap of the binding, so let's rebind
      getElligibleElementForBindingElement(selectedElement, "end", app);

  return [start, end];
};

const getBindingStrategyForDraggingArrowOrJoints = (
  selectedElement: NonDeleted<ExcalidrawLinearElement>,
  app: AppClassProperties,
  isBindingEnabled: boolean,
): (NonDeleted<ExcalidrawBindableElement> | null | "keep")[] => {
  const [startIsClose, endIsClose] = getOriginalBindingsIfStillCloseToArrowEnds(
    selectedElement,
    app,
  );
  const start = startIsClose
    ? isBindingEnabled
      ? getElligibleElementForBindingElement(selectedElement, "start", app)
      : null
    : null;
  const end = endIsClose
    ? isBindingEnabled
      ? getElligibleElementForBindingElement(selectedElement, "end", app)
      : null
    : null;

  return [start, end];
};

export const bindOrUnbindLinearElements = (
  selectedElements: NonDeleted<ExcalidrawLinearElement>[],
  app: AppClassProperties,
  isBindingEnabled: boolean,
  draggingPoints: readonly number[] | null,
): void => {
  selectedElements.forEach((selectedElement) => {
    const [start, end] = draggingPoints?.length
      ? // The arrow edge points are dragged (i.e. start, end)
        getBindingStrategyForDraggingArrowEndpoints(
          selectedElement,
          isBindingEnabled,
          draggingPoints ?? [],
          app,
        )
      : // The arrow itself (the shaft) or the inner joins are dragged
        getBindingStrategyForDraggingArrowOrJoints(
          selectedElement,
          app,
          isBindingEnabled,
        );

    bindOrUnbindLinearElement(
      selectedElement,
      start,
      end,
      app.scene.getNonDeletedElementsMap(),
    );
  });
};

export const getSuggestedBindingsForArrows = (
  selectedElements: NonDeleted<ExcalidrawElement>[],
  app: AppClassProperties,
): SuggestedBinding[] => {
  // HOT PATH: Bail out if selected elements list is too large
  if (selectedElements.length > 50) {
    return [];
  }

  return (
    selectedElements
      .filter(isLinearElement)
      .flatMap((element) =>
        getOriginalBindingsIfStillCloseToArrowEnds(element, app),
      )
      .filter(
        (element): element is NonDeleted<ExcalidrawBindableElement> =>
          element !== null,
      )
      // Filter out bind candidates which are in the
      // same selection / group with the arrow
      //
      // TODO: Is it worth turning the list into a set to avoid dupes?
      .filter(
        (element) =>
          selectedElements.filter((selected) => selected.id === element?.id)
            .length === 0,
      )
  );
};

export const maybeBindLinearElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  appState: AppState,
  pointerCoords: { x: number; y: number },
  app: AppClassProperties,
): void => {
  if (appState.startBoundElement != null) {
    bindLinearElement(
      linearElement,
      appState.startBoundElement,
      "start",
      app.scene.getNonDeletedElementsMap(),
    );
  }
  const hoveredElement = getHoveredElementForBinding(pointerCoords, app);
  if (
    hoveredElement != null &&
    !isLinearElementSimpleAndAlreadyBoundOnOppositeEdge(
      linearElement,
      hoveredElement,
      "end",
    )
  ) {
    bindLinearElement(
      linearElement,
      hoveredElement,
      "end",
      app.scene.getNonDeletedElementsMap(),
    );
  }
};

export const bindLinearElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  hoveredElement: ExcalidrawBindableElement,
  startOrEnd: "start" | "end",
  elementsMap: NonDeletedSceneElementsMap,
): void => {
  mutateElement(linearElement, {
    [startOrEnd === "start" ? "startBinding" : "endBinding"]: {
      elementId: hoveredElement.id,
      ...calculateFocusAndGap(
        linearElement,
        hoveredElement,
        startOrEnd,
        elementsMap,
      ),
    } as PointBinding,
  });

  const boundElementsMap = arrayToMap(hoveredElement.boundElements || []);
  if (!boundElementsMap.has(linearElement.id)) {
    mutateElement(hoveredElement, {
      boundElements: (hoveredElement.boundElements || []).concat({
        id: linearElement.id,
        type: "arrow",
      }),
    });
  }
};

// Don't bind both ends of a simple segment
const isLinearElementSimpleAndAlreadyBoundOnOppositeEdge = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  bindableElement: ExcalidrawBindableElement,
  startOrEnd: "start" | "end",
): boolean => {
  const otherBinding =
    linearElement[startOrEnd === "start" ? "endBinding" : "startBinding"];
  return isLinearElementSimpleAndAlreadyBound(
    linearElement,
    otherBinding?.elementId,
    bindableElement,
  );
};

export const isLinearElementSimpleAndAlreadyBound = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  alreadyBoundToId: ExcalidrawBindableElement["id"] | undefined,
  bindableElement: ExcalidrawBindableElement,
): boolean => {
  return (
    alreadyBoundToId === bindableElement.id &&
    isLinearElementSimple(linearElement)
  );
};

const isLinearElementSimple = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
): boolean => linearElement.points.length < 3;

const unbindLinearElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  startOrEnd: "start" | "end",
): ExcalidrawBindableElement["id"] | null => {
  const field = startOrEnd === "start" ? "startBinding" : "endBinding";
  const binding = linearElement[field];
  if (binding == null) {
    return null;
  }
  mutateElement(linearElement, { [field]: null });
  return binding.elementId;
};

export const getHoveredElementForBinding = (
  pointerCoords: {
    x: number;
    y: number;
  },
  app: AppClassProperties,
): NonDeleted<ExcalidrawBindableElement> | null => {
  const hoveredElement = getElementAtPosition(
    app.scene.getNonDeletedElements(),
    (element) =>
      isBindableElement(element, false) &&
      bindingBorderTest(element, pointerCoords, app),
  );
  return hoveredElement as NonDeleted<ExcalidrawBindableElement> | null;
};

const calculateFocusAndGap = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  hoveredElement: ExcalidrawBindableElement,
  startOrEnd: "start" | "end",
  elementsMap: NonDeletedSceneElementsMap,
): { focus: number; gap: number } => {
  const direction = startOrEnd === "start" ? -1 : 1;
  const edgePointIndex = direction === -1 ? 0 : linearElement.points.length - 1;
  const adjacentPointIndex = edgePointIndex - direction;

  const edgePoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    linearElement,
    edgePointIndex,
    elementsMap,
  );
  const adjacentPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    linearElement,
    adjacentPointIndex,
    elementsMap,
  );
  return {
    focus: determineFocusDistance(
      hoveredElement,
      adjacentPoint,
      edgePoint,
      elementsMap,
    ),
    gap: Math.max(
      1,
      distanceToBindableElement(hoveredElement, edgePoint, elementsMap),
    ),
  };
};

// Supports translating, rotating and scaling `changedElement` with bound
// linear elements.
// Because scaling involves moving the focus points as well, it is
// done before the `changedElement` is updated, and the `newSize` is passed
// in explicitly.
export const updateBoundElements = (
  changedElement: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
  options?: {
    simultaneouslyUpdated?: readonly ExcalidrawElement[];
    newSize?: { width: number; height: number };
  },
) => {
  const { newSize, simultaneouslyUpdated } = options ?? {};
  const simultaneouslyUpdatedElementIds = getSimultaneouslyUpdatedElementIds(
    simultaneouslyUpdated,
  );

  if (!isBindableElement(changedElement)) {
    return;
  }

  boundElementsVisitor(elementsMap, changedElement, (element) => {
    if (!isLinearElement(element) || element.isDeleted) {
      return;
    }

    // In case the boundElements are stale
    if (!doesNeedUpdate(element, changedElement)) {
      return;
    }
    const bindings = {
      startBinding: maybeCalculateNewGapWhenScaling(
        changedElement,
        element.startBinding,
        newSize,
      ),
      endBinding: maybeCalculateNewGapWhenScaling(
        changedElement,
        element.endBinding,
        newSize,
      ),
    };

    // `linearElement` is being moved/scaled already, just update the binding
    if (simultaneouslyUpdatedElementIds.has(element.id)) {
      mutateElement(element, bindings);
      return;
    }

    bindableElementsVisitor(
      elementsMap,
      element,
      (bindableElement, bindingProp) => {
        if (
          bindableElement &&
          isBindableElement(bindableElement) &&
          (bindingProp === "startBinding" || bindingProp === "endBinding")
        ) {
          updateBoundPoint(
            element,
            bindingProp,
            bindings[bindingProp],
            bindableElement,
            elementsMap,
          );
        }
      },
    );

    const boundText = getBoundTextElement(element, elementsMap);
    if (boundText && !boundText.isDeleted) {
      handleBindTextResize(element, elementsMap, false);
    }
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
  startOrEnd: "startBinding" | "endBinding",
  binding: PointBinding | null | undefined,
  bindableElement: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
): void => {
  if (
    binding == null ||
    // We only need to update the other end if this is a 2 point line element
    (binding.elementId !== bindableElement.id &&
      linearElement.points.length > 2)
  ) {
    return;
  }

  const direction = startOrEnd === "startBinding" ? -1 : 1;
  const edgePointIndex = direction === -1 ? 0 : linearElement.points.length - 1;
  const adjacentPointIndex = edgePointIndex - direction;
  const adjacentPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    linearElement,
    adjacentPointIndex,
    elementsMap,
  );
  const focusPointAbsolute = determineFocusPoint(
    bindableElement,
    binding.focus,
    adjacentPoint,
    elementsMap,
  );
  let newEdgePoint;
  // The linear element was not originally pointing inside the bound shape,
  // we can point directly at the focus point
  if (binding.gap === 0) {
    newEdgePoint = focusPointAbsolute;
  } else {
    const intersections = intersectElementWithLine(
      bindableElement,
      adjacentPoint,
      focusPointAbsolute,
      binding.gap,
      elementsMap,
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
  LinearElementEditor.movePoints(
    linearElement,
    [
      {
        index: edgePointIndex,
        point: LinearElementEditor.pointFromAbsoluteCoords(
          linearElement,
          newEdgePoint,
          elementsMap,
        ),
      },
    ],
    { [startOrEnd]: binding },
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
      maxBindingGap(changedElement, newWidth, newHeight),
      gap * (newWidth < newHeight ? newWidth / width : newHeight / height),
    ),
  );
  return { elementId, gap: newGap, focus };
};

const getElligibleElementForBindingElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  startOrEnd: "start" | "end",
  app: AppClassProperties,
): NonDeleted<ExcalidrawBindableElement> | null => {
  return getHoveredElementForBinding(
    getLinearElementEdgeCoors(
      linearElement,
      startOrEnd,
      app.scene.getNonDeletedElementsMap(),
    ),
    app,
  );
};

const getLinearElementEdgeCoors = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  startOrEnd: "start" | "end",
  elementsMap: NonDeletedSceneElementsMap,
): { x: number; y: number } => {
  const index = startOrEnd === "start" ? 0 : -1;
  return tupleToCoors(
    LinearElementEditor.getPointAtIndexGlobalCoordinates(
      linearElement,
      index,
      elementsMap,
    ),
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
    const { boundElements } = oldElement;
    if (boundElements != null && boundElements.length > 0) {
      boundElements.forEach((boundElement) => {
        if (shouldReverseRoles && !oldIdToDuplicatedId.has(boundElement.id)) {
          allBoundElementIds.add(boundElement.id);
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
  (
    sceneElements.filter(({ id }) =>
      allBoundElementIds.has(id),
    ) as ExcalidrawLinearElement[]
  ).forEach((element) => {
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
      const { boundElements } = bindableElement;
      if (boundElements != null && boundElements.length > 0) {
        mutateElement(bindableElement, {
          boundElements: boundElements.map((boundElement) =>
            oldIdToDuplicatedId.has(boundElement.id)
              ? {
                  id: oldIdToDuplicatedId.get(boundElement.id)!,
                  type: boundElement.type,
                }
              : boundElement,
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

export const fixBindingsAfterDeletion = (
  sceneElements: readonly ExcalidrawElement[],
  deletedElements: readonly ExcalidrawElement[],
): void => {
  const elements = arrayToMap(sceneElements);

  for (const element of deletedElements) {
    BoundElement.unbindAffected(elements, element, mutateElement);
    BindableElement.unbindAffected(elements, element, mutateElement);
  }
};

const newBoundElements = (
  boundElements: ExcalidrawElement["boundElements"],
  idsToRemove: Set<ExcalidrawElement["id"]>,
  elementsToAdd: Array<ExcalidrawElement> = [],
) => {
  if (!boundElements) {
    return null;
  }

  const nextBoundElements = boundElements.filter(
    (boundElement) => !idsToRemove.has(boundElement.id),
  );

  nextBoundElements.push(
    ...elementsToAdd.map(
      (x) =>
        ({ id: x.id, type: x.type } as
          | ExcalidrawArrowElement
          | ExcalidrawTextElement),
    ),
  );

  return nextBoundElements;
};

const bindingBorderTest = (
  element: NonDeleted<ExcalidrawBindableElement>,
  { x, y }: { x: number; y: number },
  app: AppClassProperties,
): boolean => {
  const threshold = maxBindingGap(element, element.width, element.height);
  const shape = app.getElementShape(element);
  return isPointOnShape([x, y], shape, threshold);
};

export const maxBindingGap = (
  element: ExcalidrawElement,
  elementWidth: number,
  elementHeight: number,
): number => {
  // Aligns diamonds with rectangles
  const shapeRatio = element.type === "diamond" ? 1 / Math.sqrt(2) : 1;
  const smallerDimension = shapeRatio * Math.min(elementWidth, elementHeight);
  // We make the bindable boundary bigger for bigger elements
  return Math.max(16, Math.min(0.25 * smallerDimension, 32));
};

const distanceToBindableElement = (
  element: ExcalidrawBindableElement,
  point: Point,
  elementsMap: ElementsMap,
): number => {
  switch (element.type) {
    case "rectangle":
    case "image":
    case "text":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      return distanceToRectangle(element, point, elementsMap);
    case "diamond":
      return distanceToDiamond(element, point, elementsMap);
    case "ellipse":
      return distanceToEllipse(element, point, elementsMap);
  }
};

const distanceToRectangle = (
  element:
    | ExcalidrawRectangleElement
    | ExcalidrawTextElement
    | ExcalidrawFreeDrawElement
    | ExcalidrawImageElement
    | ExcalidrawIframeLikeElement
    | ExcalidrawFrameLikeElement,
  point: Point,
  elementsMap: ElementsMap,
): number => {
  const [, pointRel, hwidth, hheight] = pointRelativeToElement(
    element,
    point,
    elementsMap,
  );
  return Math.max(
    GAPoint.distanceToLine(pointRel, GALine.equation(0, 1, -hheight)),
    GAPoint.distanceToLine(pointRel, GALine.equation(1, 0, -hwidth)),
  );
};

const distanceToDiamond = (
  element: ExcalidrawDiamondElement,
  point: Point,
  elementsMap: ElementsMap,
): number => {
  const [, pointRel, hwidth, hheight] = pointRelativeToElement(
    element,
    point,
    elementsMap,
  );
  const side = GALine.equation(hheight, hwidth, -hheight * hwidth);
  return GAPoint.distanceToLine(pointRel, side);
};

const distanceToEllipse = (
  element: ExcalidrawEllipseElement,
  point: Point,
  elementsMap: ElementsMap,
): number => {
  const [pointRel, tangent] = ellipseParamsForTest(element, point, elementsMap);
  return -GALine.sign(tangent) * GAPoint.distanceToLine(pointRel, tangent);
};

const ellipseParamsForTest = (
  element: ExcalidrawEllipseElement,
  point: Point,
  elementsMap: ElementsMap,
): [GA.Point, GA.Line] => {
  const [, pointRel, hwidth, hheight] = pointRelativeToElement(
    element,
    point,
    elementsMap,
  );
  const [px, py] = GAPoint.toTuple(pointRel);

  // We're working in positive quadrant, so start with `t = 45deg`, `tx=cos(t)`
  let tx = 0.707;
  let ty = 0.707;

  const a = hwidth;
  const b = hheight;

  // This is a numerical method to find the params tx, ty at which
  // the ellipse has the closest point to the given point
  [0, 1, 2, 3].forEach((_) => {
    const xx = a * tx;
    const yy = b * ty;

    const ex = ((a * a - b * b) * tx ** 3) / a;
    const ey = ((b * b - a * a) * ty ** 3) / b;

    const rx = xx - ex;
    const ry = yy - ey;

    const qx = px - ex;
    const qy = py - ey;

    const r = Math.hypot(ry, rx);
    const q = Math.hypot(qy, qx);

    tx = Math.min(1, Math.max(0, ((qx * r) / q + ex) / a));
    ty = Math.min(1, Math.max(0, ((qy * r) / q + ey) / b));
    const t = Math.hypot(ty, tx);
    tx /= t;
    ty /= t;
  });

  const closestPoint = GA.point(a * tx, b * ty);

  const tangent = GALine.orthogonalThrough(pointRel, closestPoint);
  return [pointRel, tangent];
};

// Returns:
//   1. the point relative to the elements (x, y) position
//   2. the point relative to the element's center with positive (x, y)
//   3. half element width
//   4. half element height
//
// Note that for linear elements the (x, y) position is not at the
// top right corner of their boundary.
//
// Rectangles, diamonds and ellipses are symmetrical over axes,
// and other elements have a rectangular boundary,
// so we only need to perform hit tests for the positive quadrant.
const pointRelativeToElement = (
  element: ExcalidrawElement,
  pointTuple: Point,
  elementsMap: ElementsMap,
): [GA.Point, GA.Point, number, number] => {
  const point = GAPoint.from(pointTuple);
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
  const center = coordsCenter(x1, y1, x2, y2);
  // GA has angle orientation opposite to `rotate`
  const rotate = GATransform.rotation(center, element.angle);
  const pointRotated = GATransform.apply(rotate, point);
  const pointRelToCenter = GA.sub(pointRotated, GADirection.from(center));
  const pointRelToCenterAbs = GAPoint.abs(pointRelToCenter);
  const elementPos = GA.offset(element.x, element.y);
  const pointRelToPos = GA.sub(pointRotated, elementPos);
  const halfWidth = (x2 - x1) / 2;
  const halfHeight = (y2 - y1) / 2;
  return [pointRelToPos, pointRelToCenterAbs, halfWidth, halfHeight];
};

const relativizationToElementCenter = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): GA.Transform => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
  const center = coordsCenter(x1, y1, x2, y2);
  // GA has angle orientation opposite to `rotate`
  const rotate = GATransform.rotation(center, element.angle);
  const translate = GA.reverse(
    GATransform.translation(GADirection.from(center)),
  );
  return GATransform.compose(rotate, translate);
};

const coordsCenter = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): GA.Point => {
  return GA.point((x1 + x2) / 2, (y1 + y2) / 2);
};

// The focus distance is the oriented ratio between the size of
// the `element` and the "focus image" of the element on which
// all focus points lie, so it's a number between -1 and 1.
// The line going through `a` and `b` is a tangent to the "focus image"
// of the element.
const determineFocusDistance = (
  element: ExcalidrawBindableElement,
  // Point on the line, in absolute coordinates
  a: Point,
  // Another point on the line, in absolute coordinates (closer to element)
  b: Point,
  elementsMap: ElementsMap,
): number => {
  const relateToCenter = relativizationToElementCenter(element, elementsMap);
  const aRel = GATransform.apply(relateToCenter, GAPoint.from(a));
  const bRel = GATransform.apply(relateToCenter, GAPoint.from(b));
  const line = GALine.through(aRel, bRel);
  const q = element.height / element.width;
  const hwidth = element.width / 2;
  const hheight = element.height / 2;
  const n = line[2];
  const m = line[3];
  const c = line[1];
  const mabs = Math.abs(m);
  const nabs = Math.abs(n);
  let ret;
  switch (element.type) {
    case "rectangle":
    case "image":
    case "text":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      ret = c / (hwidth * (nabs + q * mabs));
      break;
    case "diamond":
      ret = mabs < nabs ? c / (nabs * hwidth) : c / (mabs * hheight);
      break;
    case "ellipse":
      ret = c / (hwidth * Math.sqrt(n ** 2 + q ** 2 * m ** 2));
      break;
  }
  return ret || 0;
};

const determineFocusPoint = (
  element: ExcalidrawBindableElement,
  // The oriented, relative distance from the center of `element` of the
  // returned focusPoint
  focus: number,
  adjecentPoint: Point,
  elementsMap: ElementsMap,
): Point => {
  if (focus === 0) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    const center = coordsCenter(x1, y1, x2, y2);
    return GAPoint.toTuple(center);
  }
  const relateToCenter = relativizationToElementCenter(element, elementsMap);
  const adjecentPointRel = GATransform.apply(
    relateToCenter,
    GAPoint.from(adjecentPoint),
  );
  const reverseRelateToCenter = GA.reverse(relateToCenter);
  let point;
  switch (element.type) {
    case "rectangle":
    case "image":
    case "text":
    case "diamond":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      point = findFocusPointForRectangulars(element, focus, adjecentPointRel);
      break;
    case "ellipse":
      point = findFocusPointForEllipse(element, focus, adjecentPointRel);
      break;
  }
  return GAPoint.toTuple(GATransform.apply(reverseRelateToCenter, point));
};

// Returns 2 or 0 intersection points between line going through `a` and `b`
// and the `element`, in ascending order of distance from `a`.
const intersectElementWithLine = (
  element: ExcalidrawBindableElement,
  // Point on the line, in absolute coordinates
  a: Point,
  // Another point on the line, in absolute coordinates
  b: Point,
  // If given, the element is inflated by this value
  gap: number = 0,
  elementsMap: ElementsMap,
): Point[] => {
  const relateToCenter = relativizationToElementCenter(element, elementsMap);
  const aRel = GATransform.apply(relateToCenter, GAPoint.from(a));
  const bRel = GATransform.apply(relateToCenter, GAPoint.from(b));
  const line = GALine.through(aRel, bRel);
  const reverseRelateToCenter = GA.reverse(relateToCenter);
  const intersections = getSortedElementLineIntersections(
    element,
    line,
    aRel,
    gap,
  );
  return intersections.map((point) =>
    GAPoint.toTuple(GATransform.apply(reverseRelateToCenter, point)),
  );
};

const getSortedElementLineIntersections = (
  element: ExcalidrawBindableElement,
  // Relative to element center
  line: GA.Line,
  // Relative to element center
  nearPoint: GA.Point,
  gap: number = 0,
): GA.Point[] => {
  let intersections: GA.Point[];
  switch (element.type) {
    case "rectangle":
    case "image":
    case "text":
    case "diamond":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      const corners = getCorners(element);
      intersections = corners
        .flatMap((point, i) => {
          const edge: [GA.Point, GA.Point] = [point, corners[(i + 1) % 4]];
          return intersectSegment(line, offsetSegment(edge, gap));
        })
        .concat(
          corners.flatMap((point) => getCircleIntersections(point, gap, line)),
        );
      break;
    case "ellipse":
      intersections = getEllipseIntersections(element, gap, line);
      break;
  }
  if (intersections.length < 2) {
    // Ignore the "edge" case of only intersecting with a single corner
    return [];
  }
  const sortedIntersections = intersections.sort(
    (i1, i2) =>
      GAPoint.distance(i1, nearPoint) - GAPoint.distance(i2, nearPoint),
  );
  return [
    sortedIntersections[0],
    sortedIntersections[sortedIntersections.length - 1],
  ];
};

const getCorners = (
  element:
    | ExcalidrawRectangleElement
    | ExcalidrawImageElement
    | ExcalidrawDiamondElement
    | ExcalidrawTextElement
    | ExcalidrawIframeLikeElement
    | ExcalidrawFrameLikeElement,
  scale: number = 1,
): GA.Point[] => {
  const hx = (scale * element.width) / 2;
  const hy = (scale * element.height) / 2;
  switch (element.type) {
    case "rectangle":
    case "image":
    case "text":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      return [
        GA.point(hx, hy),
        GA.point(hx, -hy),
        GA.point(-hx, -hy),
        GA.point(-hx, hy),
      ];
    case "diamond":
      return [
        GA.point(0, hy),
        GA.point(hx, 0),
        GA.point(0, -hy),
        GA.point(-hx, 0),
      ];
  }
};

// Returns intersection of `line` with `segment`, with `segment` moved by
// `gap` in its polar direction.
// If intersection coincides with second segment point returns empty array.
const intersectSegment = (
  line: GA.Line,
  segment: [GA.Point, GA.Point],
): GA.Point[] => {
  const [a, b] = segment;
  const aDist = GAPoint.distanceToLine(a, line);
  const bDist = GAPoint.distanceToLine(b, line);
  if (aDist * bDist >= 0) {
    // The intersection is outside segment `(a, b)`
    return [];
  }
  return [GAPoint.intersect(line, GALine.through(a, b))];
};

const offsetSegment = (
  segment: [GA.Point, GA.Point],
  distance: number,
): [GA.Point, GA.Point] => {
  const [a, b] = segment;
  const offset = GATransform.translationOrthogonal(
    GADirection.fromTo(a, b),
    distance,
  );
  return [GATransform.apply(offset, a), GATransform.apply(offset, b)];
};

const getEllipseIntersections = (
  element: ExcalidrawEllipseElement,
  gap: number,
  line: GA.Line,
): GA.Point[] => {
  const a = element.width / 2 + gap;
  const b = element.height / 2 + gap;
  const m = line[2];
  const n = line[3];
  const c = line[1];
  const squares = a * a * m * m + b * b * n * n;
  const discr = squares - c * c;
  if (squares === 0 || discr <= 0) {
    return [];
  }
  const discrRoot = Math.sqrt(discr);
  const xn = -a * a * m * c;
  const yn = -b * b * n * c;
  return [
    GA.point(
      (xn + a * b * n * discrRoot) / squares,
      (yn - a * b * m * discrRoot) / squares,
    ),
    GA.point(
      (xn - a * b * n * discrRoot) / squares,
      (yn + a * b * m * discrRoot) / squares,
    ),
  ];
};

const getCircleIntersections = (
  center: GA.Point,
  radius: number,
  line: GA.Line,
): GA.Point[] => {
  if (radius === 0) {
    return GAPoint.distanceToLine(line, center) === 0 ? [center] : [];
  }
  const m = line[2];
  const n = line[3];
  const c = line[1];
  const [a, b] = GAPoint.toTuple(center);
  const r = radius;
  const squares = m * m + n * n;
  const discr = r * r * squares - (m * a + n * b + c) ** 2;
  if (squares === 0 || discr <= 0) {
    return [];
  }
  const discrRoot = Math.sqrt(discr);
  const xn = a * n * n - b * m * n - m * c;
  const yn = b * m * m - a * m * n - n * c;

  return [
    GA.point((xn + n * discrRoot) / squares, (yn - m * discrRoot) / squares),
    GA.point((xn - n * discrRoot) / squares, (yn + m * discrRoot) / squares),
  ];
};

// The focus point is the tangent point of the "focus image" of the
// `element`, where the tangent goes through `point`.
const findFocusPointForEllipse = (
  ellipse: ExcalidrawEllipseElement,
  // Between -1 and 1 (not 0) the relative size of the "focus image" of
  // the element on which the focus point lies
  relativeDistance: number,
  // The point for which we're trying to find the focus point, relative
  // to the ellipse center.
  point: GA.Point,
): GA.Point => {
  const relativeDistanceAbs = Math.abs(relativeDistance);
  const a = (ellipse.width * relativeDistanceAbs) / 2;
  const b = (ellipse.height * relativeDistanceAbs) / 2;

  const orientation = Math.sign(relativeDistance);
  const [px, pyo] = GAPoint.toTuple(point);

  // The calculation below can't handle py = 0
  const py = pyo === 0 ? 0.0001 : pyo;

  const squares = px ** 2 * b ** 2 + py ** 2 * a ** 2;
  // Tangent mx + ny + 1 = 0
  const m =
    (-px * b ** 2 +
      orientation * py * Math.sqrt(Math.max(0, squares - a ** 2 * b ** 2))) /
    squares;

  let n = (-m * px - 1) / py;

  if (n === 0) {
    // if zero {-0, 0}, fall back to a same-sign value in the similar range
    n = (Object.is(n, -0) ? -1 : 1) * 0.01;
  }

  const x = -(a ** 2 * m) / (n ** 2 * b ** 2 + m ** 2 * a ** 2);
  return GA.point(x, (-m * x - 1) / n);
};

const findFocusPointForRectangulars = (
  element:
    | ExcalidrawRectangleElement
    | ExcalidrawImageElement
    | ExcalidrawDiamondElement
    | ExcalidrawTextElement
    | ExcalidrawIframeLikeElement
    | ExcalidrawFrameLikeElement,
  // Between -1 and 1 for how far away should the focus point be relative
  // to the size of the element. Sign determines orientation.
  relativeDistance: number,
  // The point for which we're trying to find the focus point, relative
  // to the element center.
  point: GA.Point,
): GA.Point => {
  const relativeDistanceAbs = Math.abs(relativeDistance);
  const orientation = Math.sign(relativeDistance);
  const corners = getCorners(element, relativeDistanceAbs);

  let maxDistance = 0;
  let tangentPoint: null | GA.Point = null;
  corners.forEach((corner) => {
    const distance = orientation * GALine.through(point, corner)[1];
    if (distance > maxDistance) {
      maxDistance = distance;
      tangentPoint = corner;
    }
  });
  return tangentPoint!;
};
export const bindingProperties: Set<BindableProp | BindingProp> = new Set([
  "boundElements",
  "frameId",
  "containerId",
  "startBinding",
  "endBinding",
]);

export type BindableProp = "boundElements";

export type BindingProp =
  | "frameId"
  | "containerId"
  | "startBinding"
  | "endBinding";

type BoundElementsVisitingFunc = (
  boundElement: ExcalidrawElement | undefined,
  bindingProp: BindableProp,
  bindingId: string,
) => void;

type BindableElementVisitingFunc = (
  bindableElement: ExcalidrawElement | undefined,
  bindingProp: BindingProp,
  bindingId: string,
) => void;

/**
 * Tries to visit each bound element (does not have to be found).
 */
const boundElementsVisitor = (
  elements: ElementsMap,
  element: ExcalidrawElement,
  visit: BoundElementsVisitingFunc,
) => {
  if (isBindableElement(element)) {
    // create new instance so that possible mutations won't play a role in visiting order
    const boundElements = element.boundElements?.slice() ?? [];

    // last added text should be the one we keep (~previous are duplicates)
    boundElements.forEach(({ id }) => {
      visit(elements.get(id), "boundElements", id);
    });
  }
};

/**
 * Tries to visit each bindable element (does not have to be found).
 */
const bindableElementsVisitor = (
  elements: ElementsMap,
  element: ExcalidrawElement,
  visit: BindableElementVisitingFunc,
) => {
  if (element.frameId) {
    const id = element.frameId;
    visit(elements.get(id), "frameId", id);
  }

  if (isBoundToContainer(element)) {
    const id = element.containerId;
    visit(elements.get(id), "containerId", id);
  }

  if (isArrowElement(element)) {
    if (element.startBinding) {
      const id = element.startBinding.elementId;
      visit(elements.get(id), "startBinding", id);
    }

    if (element.endBinding) {
      const id = element.endBinding.elementId;
      visit(elements.get(id), "endBinding", id);
    }
  }
};

/**
 * Bound element containing bindings to `frameId`, `containerId`, `startBinding` or `endBinding`.
 */
export class BoundElement {
  /**
   * Unbind the affected non deleted bindable elements (removing element from `boundElements`).
   * - iterates non deleted bindable elements (`containerId` | `startBinding.elementId` | `endBinding.elementId`) of the current element
   * - prepares updates to unbind each bindable element's `boundElements` from the current element
   */
  public static unbindAffected(
    elements: ElementsMap,
    boundElement: ExcalidrawElement | undefined,
    updateElementWith: (
      affected: ExcalidrawElement,
      updates: ElementUpdate<ExcalidrawElement>,
    ) => void,
  ) {
    if (!boundElement) {
      return;
    }

    bindableElementsVisitor(elements, boundElement, (bindableElement) => {
      // bindable element is deleted, this is fine
      if (!bindableElement || bindableElement.isDeleted) {
        return;
      }

      boundElementsVisitor(
        elements,
        bindableElement,
        (_, __, boundElementId) => {
          if (boundElementId === boundElement.id) {
            updateElementWith(bindableElement, {
              boundElements: newBoundElements(
                bindableElement.boundElements,
                new Set([boundElementId]),
              ),
            });
          }
        },
      );
    });
  }

  /**
   * Rebind the next affected non deleted bindable elements (adding element to `boundElements`).
   * - iterates non deleted bindable elements (`containerId` | `startBinding.elementId` | `endBinding.elementId`) of the current element
   * - prepares updates to rebind each bindable element's `boundElements` to the current element
   *
   * NOTE: rebind expects that affected elements were previously unbound with `BoundElement.unbindAffected`
   */
  public static rebindAffected = (
    elements: ElementsMap,
    boundElement: ExcalidrawElement | undefined,
    updateElementWith: (
      affected: ExcalidrawElement,
      updates: ElementUpdate<ExcalidrawElement>,
    ) => void,
  ) => {
    // don't try to rebind element that is deleted
    if (!boundElement || boundElement.isDeleted) {
      return;
    }

    bindableElementsVisitor(
      elements,
      boundElement,
      (bindableElement, bindingProp) => {
        // unbind from bindable elements, as bindings from non deleted elements into deleted elements are incorrect
        if (!bindableElement || bindableElement.isDeleted) {
          updateElementWith(boundElement, { [bindingProp]: null });
          return;
        }

        // frame bindings are unidirectional, there is nothing to rebind
        if (bindingProp === "frameId") {
          return;
        }

        if (
          bindableElement.boundElements?.find((x) => x.id === boundElement.id)
        ) {
          return;
        }

        if (isArrowElement(boundElement)) {
          // rebind if not found!
          updateElementWith(bindableElement, {
            boundElements: newBoundElements(
              bindableElement.boundElements,
              new Set(),
              new Array(boundElement),
            ),
          });
        }

        if (isTextElement(boundElement)) {
          if (!bindableElement.boundElements?.find((x) => x.type === "text")) {
            // rebind only if there is no other text bound already
            updateElementWith(bindableElement, {
              boundElements: newBoundElements(
                bindableElement.boundElements,
                new Set(),
                new Array(boundElement),
              ),
            });
          } else {
            // unbind otherwise
            updateElementWith(boundElement, { [bindingProp]: null });
          }
        }
      },
    );
  };
}

/**
 * Bindable element containing bindings to `boundElements`.
 */
export class BindableElement {
  /**
   * Unbind the affected non deleted bound elements (resetting `containerId`, `startBinding`, `endBinding` to `null`).
   * - iterates through non deleted `boundElements` of the current element
   * - prepares updates to unbind each bound element from the current element
   */
  public static unbindAffected(
    elements: ElementsMap,
    bindableElement: ExcalidrawElement | undefined,
    updateElementWith: (
      affected: ExcalidrawElement,
      updates: ElementUpdate<ExcalidrawElement>,
    ) => void,
  ) {
    if (!bindableElement) {
      return;
    }

    boundElementsVisitor(elements, bindableElement, (boundElement) => {
      // bound element is deleted, this is fine
      if (!boundElement || boundElement.isDeleted) {
        return;
      }

      bindableElementsVisitor(
        elements,
        boundElement,
        (_, bindingProp, bindableElementId) => {
          // making sure there is an element to be unbound
          if (bindableElementId === bindableElement.id) {
            updateElementWith(boundElement, { [bindingProp]: null });
          }
        },
      );
    });
  }

  /**
   * Rebind the affected non deleted bound elements (for now setting only `containerId`, as we cannot rebind arrows atm).
   * - iterates through non deleted `boundElements` of the current element
   * - prepares updates to rebind each bound element to the current element or unbind it from `boundElements` in case of conflicts
   *
   * NOTE: rebind expects that affected elements were previously unbound with `BindaleElement.unbindAffected`
   */
  public static rebindAffected = (
    elements: ElementsMap,
    bindableElement: ExcalidrawElement | undefined,
    updateElementWith: (
      affected: ExcalidrawElement,
      updates: ElementUpdate<ExcalidrawElement>,
    ) => void,
  ) => {
    // don't try to rebind element that is deleted (i.e. updated as deleted)
    if (!bindableElement || bindableElement.isDeleted) {
      return;
    }

    boundElementsVisitor(
      elements,
      bindableElement,
      (boundElement, _, boundElementId) => {
        // unbind from bindable elements, as bindings from non deleted elements into deleted elements are incorrect
        if (!boundElement || boundElement.isDeleted) {
          updateElementWith(bindableElement, {
            boundElements: newBoundElements(
              bindableElement.boundElements,
              new Set([boundElementId]),
            ),
          });
          return;
        }

        if (isTextElement(boundElement)) {
          const boundElements = bindableElement.boundElements?.slice() ?? [];
          // check if this is the last element in the array, if not, there is an previously bound text which should be unbound
          if (
            boundElements.reverse().find((x) => x.type === "text")?.id ===
            boundElement.id
          ) {
            if (boundElement.containerId !== bindableElement.id) {
              // rebind if not bound already!
              updateElementWith(boundElement, {
                containerId: bindableElement.id,
              } as ElementUpdate<ExcalidrawTextElement>);
            }
          } else {
            if (boundElement.containerId !== null) {
              // unbind if not unbound already
              updateElementWith(boundElement, {
                containerId: null,
              } as ElementUpdate<ExcalidrawTextElement>);
            }

            // unbind from boundElements as the element got bound to some other element in the meantime
            updateElementWith(bindableElement, {
              boundElements: newBoundElements(
                bindableElement.boundElements,
                new Set([boundElement.id]),
              ),
            });
          }
        }
      },
    );
  };
}
