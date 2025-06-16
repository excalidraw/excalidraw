import {
  KEYS,
  arrayToMap,
  isBindingFallthroughEnabled,
  tupleToCoors,
  invariant,
  isDevEnv,
  isTestEnv,
} from "@excalidraw/common";

import {
  lineSegment,
  pointFrom,
  pointRotateRads,
  type GlobalPoint,
  vectorFromPoint,
  pointDistanceSq,
  clamp,
  pointDistance,
  pointFromVector,
  vectorScale,
  vectorNormalize,
  vectorCross,
  pointsEqual,
  lineSegmentIntersectionPoints,
  PRECISION,
} from "@excalidraw/math";

import type { LocalPoint, Radians } from "@excalidraw/math";

import type { AppState } from "@excalidraw/excalidraw/types";

import type { MapEntry, Mutable } from "@excalidraw/common/utility-types";

import {
  doBoundsIntersect,
  getCenterForBounds,
  getElementBounds,
} from "./bounds";
import { intersectElementWithLineSegment } from "./collision";
import { distanceToElement } from "./distance";
import {
  headingForPointFromElement,
  headingIsHorizontal,
  vectorToHeading,
  type Heading,
} from "./heading";
import { LinearElementEditor } from "./linearElementEditor";
import { mutateElement } from "./mutateElement";
import { getBoundTextElement, handleBindTextResize } from "./textElement";
import {
  isArrowElement,
  isBindableElement,
  isBoundToContainer,
  isElbowArrow,
  isFixedPointBinding,
  isFrameLikeElement,
  isLinearElement,
  isRectanguloidElement,
  isTextElement,
} from "./typeChecks";

import { aabbForElement, elementCenterPoint } from "./bounds";
import { updateElbowArrowPoints } from "./elbowArrow";

import type { Scene } from "./Scene";

import type { Bounds } from "./bounds";
import type { ElementUpdate } from "./mutateElement";
import type {
  ExcalidrawBindableElement,
  ExcalidrawElement,
  NonDeleted,
  ExcalidrawLinearElement,
  PointBinding,
  NonDeletedExcalidrawElement,
  ElementsMap,
  NonDeletedSceneElementsMap,
  ExcalidrawTextElement,
  ExcalidrawArrowElement,
  ExcalidrawElbowArrowElement,
  FixedPoint,
  FixedPointBinding,
  PointsPositionUpdates,
} from "./types";

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

export const FIXED_BINDING_DISTANCE = 5;
export const BINDING_HIGHLIGHT_THICKNESS = 10;

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
  scene: Scene,
): void => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const boundToElementIds: Set<ExcalidrawBindableElement["id"]> = new Set();
  const unboundFromElementIds: Set<ExcalidrawBindableElement["id"]> = new Set();
  bindOrUnbindLinearElementEdge(
    linearElement,
    startBindingElement,
    endBindingElement,
    "start",
    boundToElementIds,
    unboundFromElementIds,
    scene,
    elementsMap,
  );
  bindOrUnbindLinearElementEdge(
    linearElement,
    endBindingElement,
    startBindingElement,
    "end",
    boundToElementIds,
    unboundFromElementIds,
    scene,
    elementsMap,
  );

  const onlyUnbound = Array.from(unboundFromElementIds).filter(
    (id) => !boundToElementIds.has(id),
  );

  getNonDeletedElements(scene, onlyUnbound).forEach((element) => {
    scene.mutateElement(element, {
      boundElements: element.boundElements?.filter(
        (element) =>
          element.type !== "arrow" || element.id !== linearElement.id,
      ),
    });
  });
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
  scene: Scene,
  elementsMap: ElementsMap,
): void => {
  // "keep" is for method chaining convenience, a "no-op", so just bail out
  if (bindableElement === "keep") {
    return;
  }

  // null means break the bind, so nothing to consider here
  if (bindableElement === null) {
    const unbound = unbindLinearElement(linearElement, startOrEnd, scene);
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
      bindLinearElement(linearElement, bindableElement, startOrEnd, scene);
      boundToElementIds.add(bindableElement.id);
    }
  } else {
    bindLinearElement(linearElement, bindableElement, startOrEnd, scene);
    boundToElementIds.add(bindableElement.id);
  }
};

const getOriginalBindingsIfStillCloseToArrowEnds = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  elementsMap: NonDeletedSceneElementsMap,
  zoom?: AppState["zoom"],
): (NonDeleted<ExcalidrawElement> | null)[] =>
  (["start", "end"] as const).map((edge) => {
    const coors = getLinearElementEdgeCoors(linearElement, edge, elementsMap);
    const elementId =
      edge === "start"
        ? linearElement.startBinding?.elementId
        : linearElement.endBinding?.elementId;
    if (elementId) {
      const element = elementsMap.get(elementId);
      if (
        isBindableElement(element) &&
        bindingBorderTest(element, coors, elementsMap, zoom)
      ) {
        return element;
      }
    }

    return null;
  });

const getBindingStrategyForDraggingArrowEndpoints = (
  selectedElement: NonDeleted<ExcalidrawLinearElement>,
  isBindingEnabled: boolean,
  draggingPoints: readonly number[],
  elementsMap: NonDeletedSceneElementsMap,
  elements: readonly NonDeletedExcalidrawElement[],
  zoom?: AppState["zoom"],
): (NonDeleted<ExcalidrawBindableElement> | null | "keep")[] => {
  const startIdx = 0;
  const endIdx = selectedElement.points.length - 1;
  const startDragged = draggingPoints.findIndex((i) => i === startIdx) > -1;
  const endDragged = draggingPoints.findIndex((i) => i === endIdx) > -1;
  const start = startDragged
    ? isBindingEnabled
      ? getEligibleElementForBindingElement(
          selectedElement,
          "start",
          elementsMap,
          elements,
          zoom,
        )
      : null // If binding is disabled and start is dragged, break all binds
    : "keep";
  const end = endDragged
    ? isBindingEnabled
      ? getEligibleElementForBindingElement(
          selectedElement,
          "end",
          elementsMap,
          elements,
          zoom,
        )
      : null // If binding is disabled and end is dragged, break all binds
    : "keep";

  return [start, end];
};

const getBindingStrategyForDraggingArrowOrJoints = (
  selectedElement: NonDeleted<ExcalidrawLinearElement>,
  elementsMap: NonDeletedSceneElementsMap,
  elements: readonly NonDeletedExcalidrawElement[],
  isBindingEnabled: boolean,
  zoom?: AppState["zoom"],
): (NonDeleted<ExcalidrawBindableElement> | null | "keep")[] => {
  // Elbow arrows don't bind when dragged as a whole
  if (isElbowArrow(selectedElement)) {
    return ["keep", "keep"];
  }

  const [startIsClose, endIsClose] = getOriginalBindingsIfStillCloseToArrowEnds(
    selectedElement,
    elementsMap,
    zoom,
  );
  const start = startIsClose
    ? isBindingEnabled
      ? getEligibleElementForBindingElement(
          selectedElement,
          "start",
          elementsMap,
          elements,
          zoom,
        )
      : null
    : null;
  const end = endIsClose
    ? isBindingEnabled
      ? getEligibleElementForBindingElement(
          selectedElement,
          "end",
          elementsMap,
          elements,
          zoom,
        )
      : null
    : null;

  return [start, end];
};

export const bindOrUnbindLinearElements = (
  selectedElements: NonDeleted<ExcalidrawLinearElement>[],
  isBindingEnabled: boolean,
  draggingPoints: readonly number[] | null,
  scene: Scene,
  zoom?: AppState["zoom"],
): void => {
  selectedElements.forEach((selectedElement) => {
    const [start, end] = draggingPoints?.length
      ? // The arrow edge points are dragged (i.e. start, end)
        getBindingStrategyForDraggingArrowEndpoints(
          selectedElement,
          isBindingEnabled,
          draggingPoints ?? [],
          scene.getNonDeletedElementsMap(),
          scene.getNonDeletedElements(),
          zoom,
        )
      : // The arrow itself (the shaft) or the inner joins are dragged
        getBindingStrategyForDraggingArrowOrJoints(
          selectedElement,
          scene.getNonDeletedElementsMap(),
          scene.getNonDeletedElements(),
          isBindingEnabled,
          zoom,
        );

    bindOrUnbindLinearElement(selectedElement, start, end, scene);
  });
};

export const getSuggestedBindingsForArrows = (
  selectedElements: NonDeleted<ExcalidrawElement>[],
  elementsMap: NonDeletedSceneElementsMap,
  zoom: AppState["zoom"],
): SuggestedBinding[] => {
  // HOT PATH: Bail out if selected elements list is too large
  if (selectedElements.length > 50) {
    return [];
  }

  return (
    selectedElements
      .filter(isLinearElement)
      .flatMap((element) =>
        getOriginalBindingsIfStillCloseToArrowEnds(element, elementsMap, zoom),
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

export const maybeSuggestBindingsForLinearElementAtCoords = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  /** scene coords */
  pointerCoords: {
    x: number;
    y: number;
  }[],
  scene: Scene,
  zoom: AppState["zoom"],
  // During line creation the start binding hasn't been written yet
  // into `linearElement`
  oppositeBindingBoundElement?: ExcalidrawBindableElement | null,
): ExcalidrawBindableElement[] =>
  Array.from(
    pointerCoords.reduce(
      (acc: Set<NonDeleted<ExcalidrawBindableElement>>, coords) => {
        const hoveredBindableElement = getHoveredElementForBinding(
          coords,
          scene.getNonDeletedElements(),
          scene.getNonDeletedElementsMap(),
          zoom,
          isElbowArrow(linearElement),
          isElbowArrow(linearElement),
        );

        if (
          hoveredBindableElement != null &&
          !isLinearElementSimpleAndAlreadyBound(
            linearElement,
            oppositeBindingBoundElement?.id,
            hoveredBindableElement,
          )
        ) {
          acc.add(hoveredBindableElement);
        }

        return acc;
      },
      new Set() as Set<NonDeleted<ExcalidrawBindableElement>>,
    ),
  );

export const maybeBindLinearElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  appState: AppState,
  pointerCoords: { x: number; y: number },
  scene: Scene,
): void => {
  const elements = scene.getNonDeletedElements();
  const elementsMap = scene.getNonDeletedElementsMap();

  if (appState.startBoundElement != null) {
    bindLinearElement(
      linearElement,
      appState.startBoundElement,
      "start",
      scene,
    );
  }

  const hoveredElement = getHoveredElementForBinding(
    pointerCoords,
    elements,
    elementsMap,
    appState.zoom,
    isElbowArrow(linearElement),
    isElbowArrow(linearElement),
  );

  if (hoveredElement !== null) {
    if (
      !isLinearElementSimpleAndAlreadyBoundOnOppositeEdge(
        linearElement,
        hoveredElement,
        "end",
      )
    ) {
      bindLinearElement(linearElement, hoveredElement, "end", scene);
    }
  }
};

const normalizePointBinding = (
  binding: { focus: number; gap: number },
  hoveredElement: ExcalidrawBindableElement,
) => ({
  ...binding,
  gap: Math.min(
    binding.gap,
    maxBindingGap(hoveredElement, hoveredElement.width, hoveredElement.height),
  ),
});

export const bindLinearElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  hoveredElement: ExcalidrawBindableElement,
  startOrEnd: "start" | "end",
  scene: Scene,
): void => {
  if (!isArrowElement(linearElement)) {
    return;
  }

  let binding: PointBinding | FixedPointBinding = {
    elementId: hoveredElement.id,
    ...normalizePointBinding(
      calculateFocusAndGap(
        linearElement,
        hoveredElement,
        startOrEnd,
        scene.getNonDeletedElementsMap(),
      ),
      hoveredElement,
    ),
  };

  if (isElbowArrow(linearElement)) {
    binding = {
      ...binding,
      ...calculateFixedPointForElbowArrowBinding(
        linearElement,
        hoveredElement,
        startOrEnd,
        scene.getNonDeletedElementsMap(),
      ),
    };
  }

  scene.mutateElement(linearElement, {
    [startOrEnd === "start" ? "startBinding" : "endBinding"]: binding,
  });

  const boundElementsMap = arrayToMap(hoveredElement.boundElements || []);
  if (!boundElementsMap.has(linearElement.id)) {
    scene.mutateElement(hoveredElement, {
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
): boolean => linearElement.points.length < 3 && !isElbowArrow(linearElement);

const unbindLinearElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  startOrEnd: "start" | "end",
  scene: Scene,
): ExcalidrawBindableElement["id"] | null => {
  const field = startOrEnd === "start" ? "startBinding" : "endBinding";
  const binding = linearElement[field];
  if (binding == null) {
    return null;
  }
  scene.mutateElement(linearElement, { [field]: null });
  return binding.elementId;
};

export const getHoveredElementForBinding = (
  pointerCoords: {
    x: number;
    y: number;
  },
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: NonDeletedSceneElementsMap,
  zoom?: AppState["zoom"],
  fullShape?: boolean,
  considerAllElements?: boolean,
): NonDeleted<ExcalidrawBindableElement> | null => {
  if (considerAllElements) {
    let cullRest = false;
    const candidateElements = getAllElementsAtPositionForBinding(
      elements,
      (element) =>
        isBindableElement(element, false) &&
        bindingBorderTest(
          element,
          pointerCoords,
          elementsMap,
          zoom,
          (fullShape ||
            !isBindingFallthroughEnabled(
              element as ExcalidrawBindableElement,
            )) &&
            // disable fullshape snapping for frame elements so we
            // can bind to frame children
            !isFrameLikeElement(element),
        ),
    ).filter((element) => {
      if (cullRest) {
        return false;
      }

      if (!isBindingFallthroughEnabled(element as ExcalidrawBindableElement)) {
        cullRest = true;
      }

      return true;
    }) as NonDeleted<ExcalidrawBindableElement>[] | null;

    // Return early if there are no candidates or just one candidate
    if (!candidateElements || candidateElements.length === 0) {
      return null;
    }

    if (candidateElements.length === 1) {
      return candidateElements[0] as NonDeleted<ExcalidrawBindableElement>;
    }

    // Prefer the shape with the border being tested (if any)
    const borderTestElements = candidateElements.filter((element) =>
      bindingBorderTest(element, pointerCoords, elementsMap, zoom, false),
    );
    if (borderTestElements.length === 1) {
      return borderTestElements[0];
    }

    // Prefer smaller shapes
    return candidateElements
      .sort(
        (a, b) => b.width ** 2 + b.height ** 2 - (a.width ** 2 + a.height ** 2),
      )
      .pop() as NonDeleted<ExcalidrawBindableElement>;
  }

  const hoveredElement = getElementAtPositionForBinding(
    elements,
    (element) =>
      isBindableElement(element, false) &&
      bindingBorderTest(
        element,
        pointerCoords,
        elementsMap,
        zoom,
        // disable fullshape snapping for frame elements so we
        // can bind to frame children
        (fullShape || !isBindingFallthroughEnabled(element)) &&
          !isFrameLikeElement(element),
      ),
  );

  return hoveredElement as NonDeleted<ExcalidrawBindableElement> | null;
};

const getElementAtPositionForBinding = (
  elements: readonly NonDeletedExcalidrawElement[],
  isAtPositionFn: (element: NonDeletedExcalidrawElement) => boolean,
) => {
  let hitElement = null;
  // We need to to hit testing from front (end of the array) to back (beginning of the array)
  // because array is ordered from lower z-index to highest and we want element z-index
  // with higher z-index
  for (let index = elements.length - 1; index >= 0; --index) {
    const element = elements[index];
    if (element.isDeleted) {
      continue;
    }
    if (isAtPositionFn(element)) {
      hitElement = element;
      break;
    }
  }

  return hitElement;
};

const getAllElementsAtPositionForBinding = (
  elements: readonly NonDeletedExcalidrawElement[],
  isAtPositionFn: (element: NonDeletedExcalidrawElement) => boolean,
) => {
  const elementsAtPosition: NonDeletedExcalidrawElement[] = [];
  // We need to to hit testing from front (end of the array) to back (beginning of the array)
  // because array is ordered from lower z-index to highest and we want element z-index
  // with higher z-index
  for (let index = elements.length - 1; index >= 0; --index) {
    const element = elements[index];
    if (element.isDeleted) {
      continue;
    }

    if (isAtPositionFn(element)) {
      elementsAtPosition.push(element);
    }
  }

  return elementsAtPosition;
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
      elementsMap,
      adjacentPoint,
      edgePoint,
    ),
    gap: Math.max(1, distanceToElement(hoveredElement, elementsMap, edgePoint)),
  };
};

// Supports translating, rotating and scaling `changedElement` with bound
// linear elements.
export const updateBoundElements = (
  changedElement: NonDeletedExcalidrawElement,
  scene: Scene,
  options?: {
    simultaneouslyUpdated?: readonly ExcalidrawElement[];
    newSize?: { width: number; height: number };
    changedElements?: Map<string, ExcalidrawElement>;
  },
) => {
  if (!isBindableElement(changedElement)) {
    return;
  }

  const { newSize, simultaneouslyUpdated } = options ?? {};
  const simultaneouslyUpdatedElementIds = getSimultaneouslyUpdatedElementIds(
    simultaneouslyUpdated,
  );

  let elementsMap: ElementsMap = scene.getNonDeletedElementsMap();
  if (options?.changedElements) {
    elementsMap = new Map(elementsMap) as typeof elementsMap;
    options.changedElements.forEach((element) => {
      elementsMap.set(element.id, element);
    });
  }

  boundElementsVisitor(elementsMap, changedElement, (element) => {
    if (!isLinearElement(element) || element.isDeleted) {
      return;
    }

    // In case the boundElements are stale
    if (!doesNeedUpdate(element, changedElement)) {
      return;
    }

    // Check for intersections before updating bound elements incase connected elements overlap
    const startBindingElement = element.startBinding
      ? elementsMap.get(element.startBinding.elementId)
      : null;
    const endBindingElement = element.endBinding
      ? elementsMap.get(element.endBinding.elementId)
      : null;

    let startBounds: Bounds | null = null;
    let endBounds: Bounds | null = null;
    if (startBindingElement && endBindingElement) {
      startBounds = getElementBounds(startBindingElement, elementsMap);
      endBounds = getElementBounds(endBindingElement, elementsMap);
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
      scene.mutateElement(element, bindings);
      return;
    }

    const updates = bindableElementsVisitor(
      elementsMap,
      element,
      (bindableElement, bindingProp) => {
        if (
          bindableElement &&
          isBindableElement(bindableElement) &&
          (bindingProp === "startBinding" || bindingProp === "endBinding") &&
          (changedElement.id === element[bindingProp]?.elementId ||
            (changedElement.id ===
              element[
                bindingProp === "startBinding" ? "endBinding" : "startBinding"
              ]?.elementId &&
              !doBoundsIntersect(startBounds, endBounds)))
        ) {
          const point = updateBoundPoint(
            element,
            bindingProp,
            bindings[bindingProp],
            bindableElement,
            elementsMap,
          );

          if (point) {
            return [
              bindingProp === "startBinding" ? 0 : element.points.length - 1,
              { point },
            ] as MapEntry<PointsPositionUpdates>;
          }
        }

        return null;
      },
    ).filter(
      (update): update is MapEntry<PointsPositionUpdates> => update !== null,
    );

    LinearElementEditor.movePoints(element, scene, new Map(updates), {
      ...(changedElement.id === element.startBinding?.elementId
        ? { startBinding: bindings.startBinding }
        : {}),
      ...(changedElement.id === element.endBinding?.elementId
        ? { endBinding: bindings.endBinding }
        : {}),
    });

    const boundText = getBoundTextElement(element, elementsMap);
    if (boundText && !boundText.isDeleted) {
      handleBindTextResize(element, scene, false);
    }
  });
};

export const updateBindings = (
  latestElement: ExcalidrawElement,
  scene: Scene,
  options?: {
    simultaneouslyUpdated?: readonly ExcalidrawElement[];
    newSize?: { width: number; height: number };
    zoom?: AppState["zoom"];
  },
) => {
  if (isLinearElement(latestElement)) {
    bindOrUnbindLinearElements([latestElement], true, [], scene, options?.zoom);
  } else {
    updateBoundElements(latestElement, scene, {
      ...options,
      changedElements: new Map([[latestElement.id, latestElement]]),
    });
  }
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

export const getHeadingForElbowArrowSnap = (
  p: Readonly<GlobalPoint>,
  otherPoint: Readonly<GlobalPoint>,
  bindableElement: ExcalidrawBindableElement | undefined | null,
  aabb: Bounds | undefined | null,
  origPoint: GlobalPoint,
  elementsMap: ElementsMap,
  zoom?: AppState["zoom"],
): Heading => {
  const otherPointHeading = vectorToHeading(vectorFromPoint(otherPoint, p));

  if (!bindableElement || !aabb) {
    return otherPointHeading;
  }

  const distance = getDistanceForBinding(
    origPoint,
    bindableElement,
    elementsMap,
    zoom,
  );

  if (!distance) {
    return vectorToHeading(
      vectorFromPoint(p, elementCenterPoint(bindableElement, elementsMap)),
    );
  }

  return headingForPointFromElement(bindableElement, aabb, p);
};

const getDistanceForBinding = (
  point: Readonly<GlobalPoint>,
  bindableElement: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
  zoom?: AppState["zoom"],
) => {
  const distance = distanceToElement(bindableElement, elementsMap, point);
  const bindDistance = maxBindingGap(
    bindableElement,
    bindableElement.width,
    bindableElement.height,
    zoom,
  );

  return distance > bindDistance ? null : distance;
};

export const bindPointToSnapToElementOutline = (
  arrow: ExcalidrawElbowArrowElement,
  bindableElement: ExcalidrawBindableElement,
  startOrEnd: "start" | "end",
  elementsMap: ElementsMap,
): GlobalPoint => {
  if (isDevEnv() || isTestEnv()) {
    invariant(arrow.points.length > 1, "Arrow should have at least 2 points");
  }

  const aabb = aabbForElement(bindableElement, elementsMap);
  const localP =
    arrow.points[startOrEnd === "start" ? 0 : arrow.points.length - 1];
  const globalP = pointFrom<GlobalPoint>(
    arrow.x + localP[0],
    arrow.y + localP[1],
  );
  const edgePoint = isRectanguloidElement(bindableElement)
    ? avoidRectangularCorner(bindableElement, elementsMap, globalP)
    : globalP;
  const elbowed = isElbowArrow(arrow);
  const center = getCenterForBounds(aabb);
  const adjacentPointIdx = startOrEnd === "start" ? 1 : arrow.points.length - 2;
  const adjacentPoint = pointRotateRads(
    pointFrom<GlobalPoint>(
      arrow.x + arrow.points[adjacentPointIdx][0],
      arrow.y + arrow.points[adjacentPointIdx][1],
    ),
    center,
    arrow.angle ?? 0,
  );

  let intersection: GlobalPoint | null = null;
  if (elbowed) {
    const isHorizontal = headingIsHorizontal(
      headingForPointFromElement(bindableElement, aabb, globalP),
    );
    const snapPoint = snapToMid(bindableElement, elementsMap, edgePoint);
    const otherPoint = pointFrom<GlobalPoint>(
      isHorizontal ? center[0] : snapPoint[0],
      !isHorizontal ? center[1] : snapPoint[1],
    );
    const intersector = lineSegment(
      otherPoint,
      pointFromVector(
        vectorScale(
          vectorNormalize(vectorFromPoint(snapPoint, otherPoint)),
          Math.max(bindableElement.width, bindableElement.height) * 2,
        ),
        otherPoint,
      ),
    );
    intersection = intersectElementWithLineSegment(
      bindableElement,
      elementsMap,
      intersector,
      FIXED_BINDING_DISTANCE,
    ).sort(pointDistanceSq)[0];
  } else {
    intersection = intersectElementWithLineSegment(
      bindableElement,
      elementsMap,
      lineSegment(
        adjacentPoint,
        pointFromVector(
          vectorScale(
            vectorNormalize(vectorFromPoint(edgePoint, adjacentPoint)),
            pointDistance(edgePoint, adjacentPoint) +
              Math.max(bindableElement.width, bindableElement.height) * 2,
          ),
          adjacentPoint,
        ),
      ),
      FIXED_BINDING_DISTANCE,
    ).sort(
      (g, h) =>
        pointDistanceSq(g, adjacentPoint) - pointDistanceSq(h, adjacentPoint),
    )[0];
  }

  if (
    !intersection ||
    // Too close to determine vector from intersection to edgePoint
    pointDistanceSq(edgePoint, intersection) < PRECISION
  ) {
    return edgePoint;
  }

  return elbowed ? intersection : edgePoint;
};

export const avoidRectangularCorner = (
  element: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
  p: GlobalPoint,
): GlobalPoint => {
  const center = elementCenterPoint(element, elementsMap);
  const nonRotatedPoint = pointRotateRads(p, center, -element.angle as Radians);

  if (nonRotatedPoint[0] < element.x && nonRotatedPoint[1] < element.y) {
    // Top left
    if (nonRotatedPoint[1] - element.y > -FIXED_BINDING_DISTANCE) {
      return pointRotateRads<GlobalPoint>(
        pointFrom(element.x - FIXED_BINDING_DISTANCE, element.y),
        center,
        element.angle,
      );
    }
    return pointRotateRads(
      pointFrom(element.x, element.y - FIXED_BINDING_DISTANCE),
      center,
      element.angle,
    );
  } else if (
    nonRotatedPoint[0] < element.x &&
    nonRotatedPoint[1] > element.y + element.height
  ) {
    // Bottom left
    if (nonRotatedPoint[0] - element.x > -FIXED_BINDING_DISTANCE) {
      return pointRotateRads(
        pointFrom(
          element.x,
          element.y + element.height + FIXED_BINDING_DISTANCE,
        ),
        center,
        element.angle,
      );
    }
    return pointRotateRads(
      pointFrom(element.x - FIXED_BINDING_DISTANCE, element.y + element.height),
      center,
      element.angle,
    );
  } else if (
    nonRotatedPoint[0] > element.x + element.width &&
    nonRotatedPoint[1] > element.y + element.height
  ) {
    // Bottom right
    if (
      nonRotatedPoint[0] - element.x <
      element.width + FIXED_BINDING_DISTANCE
    ) {
      return pointRotateRads(
        pointFrom(
          element.x + element.width,
          element.y + element.height + FIXED_BINDING_DISTANCE,
        ),
        center,
        element.angle,
      );
    }
    return pointRotateRads(
      pointFrom(
        element.x + element.width + FIXED_BINDING_DISTANCE,
        element.y + element.height,
      ),
      center,
      element.angle,
    );
  } else if (
    nonRotatedPoint[0] > element.x + element.width &&
    nonRotatedPoint[1] < element.y
  ) {
    // Top right
    if (
      nonRotatedPoint[0] - element.x <
      element.width + FIXED_BINDING_DISTANCE
    ) {
      return pointRotateRads(
        pointFrom(
          element.x + element.width,
          element.y - FIXED_BINDING_DISTANCE,
        ),
        center,
        element.angle,
      );
    }
    return pointRotateRads(
      pointFrom(element.x + element.width + FIXED_BINDING_DISTANCE, element.y),
      center,
      element.angle,
    );
  }

  return p;
};

export const snapToMid = (
  element: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
  p: GlobalPoint,
  tolerance: number = 0.05,
): GlobalPoint => {
  const { x, y, width, height, angle } = element;
  const center = elementCenterPoint(element, elementsMap, -0.1, -0.1);
  const nonRotated = pointRotateRads(p, center, -angle as Radians);

  // snap-to-center point is adaptive to element size, but we don't want to go
  // above and below certain px distance
  const verticalThreshold = clamp(tolerance * height, 5, 80);
  const horizontalThreshold = clamp(tolerance * width, 5, 80);

  if (
    nonRotated[0] <= x + width / 2 &&
    nonRotated[1] > center[1] - verticalThreshold &&
    nonRotated[1] < center[1] + verticalThreshold
  ) {
    // LEFT
    return pointRotateRads<GlobalPoint>(
      pointFrom(x - FIXED_BINDING_DISTANCE, center[1]),
      center,
      angle,
    );
  } else if (
    nonRotated[1] <= y + height / 2 &&
    nonRotated[0] > center[0] - horizontalThreshold &&
    nonRotated[0] < center[0] + horizontalThreshold
  ) {
    // TOP
    return pointRotateRads(
      pointFrom(center[0], y - FIXED_BINDING_DISTANCE),
      center,
      angle,
    );
  } else if (
    nonRotated[0] >= x + width / 2 &&
    nonRotated[1] > center[1] - verticalThreshold &&
    nonRotated[1] < center[1] + verticalThreshold
  ) {
    // RIGHT
    return pointRotateRads(
      pointFrom(x + width + FIXED_BINDING_DISTANCE, center[1]),
      center,
      angle,
    );
  } else if (
    nonRotated[1] >= y + height / 2 &&
    nonRotated[0] > center[0] - horizontalThreshold &&
    nonRotated[0] < center[0] + horizontalThreshold
  ) {
    // DOWN
    return pointRotateRads(
      pointFrom(center[0], y + height + FIXED_BINDING_DISTANCE),
      center,
      angle,
    );
  } else if (element.type === "diamond") {
    const distance = FIXED_BINDING_DISTANCE;
    const topLeft = pointFrom<GlobalPoint>(
      x + width / 4 - distance,
      y + height / 4 - distance,
    );
    const topRight = pointFrom<GlobalPoint>(
      x + (3 * width) / 4 + distance,
      y + height / 4 - distance,
    );
    const bottomLeft = pointFrom<GlobalPoint>(
      x + width / 4 - distance,
      y + (3 * height) / 4 + distance,
    );
    const bottomRight = pointFrom<GlobalPoint>(
      x + (3 * width) / 4 + distance,
      y + (3 * height) / 4 + distance,
    );

    if (
      pointDistance(topLeft, nonRotated) <
      Math.max(horizontalThreshold, verticalThreshold)
    ) {
      return pointRotateRads(topLeft, center, angle);
    }
    if (
      pointDistance(topRight, nonRotated) <
      Math.max(horizontalThreshold, verticalThreshold)
    ) {
      return pointRotateRads(topRight, center, angle);
    }
    if (
      pointDistance(bottomLeft, nonRotated) <
      Math.max(horizontalThreshold, verticalThreshold)
    ) {
      return pointRotateRads(bottomLeft, center, angle);
    }
    if (
      pointDistance(bottomRight, nonRotated) <
      Math.max(horizontalThreshold, verticalThreshold)
    ) {
      return pointRotateRads(bottomRight, center, angle);
    }
  }

  return p;
};

const updateBoundPoint = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  startOrEnd: "startBinding" | "endBinding",
  binding: PointBinding | null | undefined,
  bindableElement: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
): LocalPoint | null => {
  if (
    binding == null ||
    // We only need to update the other end if this is a 2 point line element
    (binding.elementId !== bindableElement.id &&
      linearElement.points.length > 2)
  ) {
    return null;
  }

  const direction = startOrEnd === "startBinding" ? -1 : 1;
  const edgePointIndex = direction === -1 ? 0 : linearElement.points.length - 1;

  if (isElbowArrow(linearElement) && isFixedPointBinding(binding)) {
    const fixedPoint =
      normalizeFixedPoint(binding.fixedPoint) ??
      calculateFixedPointForElbowArrowBinding(
        linearElement,
        bindableElement,
        startOrEnd === "startBinding" ? "start" : "end",
        elementsMap,
      ).fixedPoint;
    const globalMidPoint = elementCenterPoint(bindableElement, elementsMap);
    const global = pointFrom<GlobalPoint>(
      bindableElement.x + fixedPoint[0] * bindableElement.width,
      bindableElement.y + fixedPoint[1] * bindableElement.height,
    );
    const rotatedGlobal = pointRotateRads(
      global,
      globalMidPoint,
      bindableElement.angle,
    );

    return LinearElementEditor.pointFromAbsoluteCoords(
      linearElement,
      rotatedGlobal,
      elementsMap,
    );
  }

  const adjacentPointIndex = edgePointIndex - direction;
  const adjacentPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    linearElement,
    adjacentPointIndex,
    elementsMap,
  );
  const focusPointAbsolute = determineFocusPoint(
    bindableElement,
    elementsMap,
    binding.focus,
    adjacentPoint,
  );

  let newEdgePoint: GlobalPoint;

  // The linear element was not originally pointing inside the bound shape,
  // we can point directly at the focus point
  if (binding.gap === 0) {
    newEdgePoint = focusPointAbsolute;
  } else {
    const edgePointAbsolute =
      LinearElementEditor.getPointAtIndexGlobalCoordinates(
        linearElement,
        edgePointIndex,
        elementsMap,
      );

    const center = elementCenterPoint(bindableElement, elementsMap);
    const interceptorLength =
      pointDistance(adjacentPoint, edgePointAbsolute) +
      pointDistance(adjacentPoint, center) +
      Math.max(bindableElement.width, bindableElement.height) * 2;
    const intersections = [
      ...intersectElementWithLineSegment(
        bindableElement,
        elementsMap,
        lineSegment<GlobalPoint>(
          adjacentPoint,
          pointFromVector(
            vectorScale(
              vectorNormalize(
                vectorFromPoint(focusPointAbsolute, adjacentPoint),
              ),
              interceptorLength,
            ),
            adjacentPoint,
          ),
        ),
        binding.gap,
      ).sort(
        (g, h) =>
          pointDistanceSq(g, adjacentPoint) - pointDistanceSq(h, adjacentPoint),
      ),
      // Fallback when arrow doesn't point to the shape
      pointFromVector(
        vectorScale(
          vectorNormalize(vectorFromPoint(focusPointAbsolute, adjacentPoint)),
          pointDistance(adjacentPoint, edgePointAbsolute),
        ),
        adjacentPoint,
      ),
    ];

    if (intersections.length > 1) {
      // The adjacent point is outside the shape (+ gap)
      newEdgePoint = intersections[0];
    } else if (intersections.length === 1) {
      // The adjacent point is inside the shape (+ gap)
      newEdgePoint = focusPointAbsolute;
    } else {
      // Shouldn't happend, but just in case
      newEdgePoint = edgePointAbsolute;
    }
  }

  return LinearElementEditor.pointFromAbsoluteCoords(
    linearElement,
    newEdgePoint,
    elementsMap,
  );
};

export const calculateFixedPointForElbowArrowBinding = (
  linearElement: NonDeleted<ExcalidrawElbowArrowElement>,
  hoveredElement: ExcalidrawBindableElement,
  startOrEnd: "start" | "end",
  elementsMap: ElementsMap,
): { fixedPoint: FixedPoint } => {
  const bounds = [
    hoveredElement.x,
    hoveredElement.y,
    hoveredElement.x + hoveredElement.width,
    hoveredElement.y + hoveredElement.height,
  ] as Bounds;
  const snappedPoint = bindPointToSnapToElementOutline(
    linearElement,
    hoveredElement,
    startOrEnd,
    elementsMap,
  );
  const globalMidPoint = pointFrom(
    bounds[0] + (bounds[2] - bounds[0]) / 2,
    bounds[1] + (bounds[3] - bounds[1]) / 2,
  );
  const nonRotatedSnappedGlobalPoint = pointRotateRads(
    snappedPoint,
    globalMidPoint,
    -hoveredElement.angle as Radians,
  );

  return {
    fixedPoint: normalizeFixedPoint([
      (nonRotatedSnappedGlobalPoint[0] - hoveredElement.x) /
        hoveredElement.width,
      (nonRotatedSnappedGlobalPoint[1] - hoveredElement.y) /
        hoveredElement.height,
    ]),
  };
};

const maybeCalculateNewGapWhenScaling = (
  changedElement: ExcalidrawBindableElement,
  currentBinding: PointBinding | null | undefined,
  newSize: { width: number; height: number } | undefined,
): PointBinding | null | undefined => {
  if (currentBinding == null || newSize == null) {
    return currentBinding;
  }
  const { width: newWidth, height: newHeight } = newSize;
  const { width, height } = changedElement;
  const newGap = Math.max(
    1,
    Math.min(
      maxBindingGap(changedElement, newWidth, newHeight),
      currentBinding.gap *
        (newWidth < newHeight ? newWidth / width : newHeight / height),
    ),
  );

  return { ...currentBinding, gap: newGap };
};

const getEligibleElementForBindingElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  startOrEnd: "start" | "end",
  elementsMap: NonDeletedSceneElementsMap,
  elements: readonly NonDeletedExcalidrawElement[],
  zoom?: AppState["zoom"],
): NonDeleted<ExcalidrawBindableElement> | null => {
  return getHoveredElementForBinding(
    getLinearElementEdgeCoors(linearElement, startOrEnd, elementsMap),
    elements,
    elementsMap,
    zoom,
    isElbowArrow(linearElement),
    isElbowArrow(linearElement),
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

export const fixDuplicatedBindingsAfterDuplication = (
  duplicatedElements: ExcalidrawElement[],
  origIdToDuplicateId: Map<ExcalidrawElement["id"], ExcalidrawElement["id"]>,
  duplicateElementsMap: NonDeletedSceneElementsMap,
) => {
  for (const duplicateElement of duplicatedElements) {
    if ("boundElements" in duplicateElement && duplicateElement.boundElements) {
      Object.assign(duplicateElement, {
        boundElements: duplicateElement.boundElements.reduce(
          (
            acc: Mutable<NonNullable<ExcalidrawElement["boundElements"]>>,
            binding,
          ) => {
            const newBindingId = origIdToDuplicateId.get(binding.id);
            if (newBindingId) {
              acc.push({ ...binding, id: newBindingId });
            }
            return acc;
          },
          [],
        ),
      });
    }

    if ("containerId" in duplicateElement && duplicateElement.containerId) {
      Object.assign(duplicateElement, {
        containerId:
          origIdToDuplicateId.get(duplicateElement.containerId) ?? null,
      });
    }

    if ("endBinding" in duplicateElement && duplicateElement.endBinding) {
      const newEndBindingId = origIdToDuplicateId.get(
        duplicateElement.endBinding.elementId,
      );
      Object.assign(duplicateElement, {
        endBinding: newEndBindingId
          ? {
              ...duplicateElement.endBinding,
              elementId: newEndBindingId,
            }
          : null,
      });
    }
    if ("startBinding" in duplicateElement && duplicateElement.startBinding) {
      const newEndBindingId = origIdToDuplicateId.get(
        duplicateElement.startBinding.elementId,
      );
      Object.assign(duplicateElement, {
        startBinding: newEndBindingId
          ? {
              ...duplicateElement.startBinding,
              elementId: newEndBindingId,
            }
          : null,
      });
    }

    if (isElbowArrow(duplicateElement)) {
      Object.assign(
        duplicateElement,
        updateElbowArrowPoints(duplicateElement, duplicateElementsMap, {
          points: [
            duplicateElement.points[0],
            duplicateElement.points[duplicateElement.points.length - 1],
          ],
        }),
      );
    }
  }
};

export const fixBindingsAfterDeletion = (
  sceneElements: readonly ExcalidrawElement[],
  deletedElements: readonly ExcalidrawElement[],
): void => {
  const elements = arrayToMap(sceneElements);

  for (const element of deletedElements) {
    BoundElement.unbindAffected(elements, element, (element, updates) =>
      mutateElement(element, elements, updates),
    );
    BindableElement.unbindAffected(elements, element, (element, updates) =>
      mutateElement(element, elements, updates),
    );
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

export const bindingBorderTest = (
  element: NonDeleted<ExcalidrawBindableElement>,
  { x, y }: { x: number; y: number },
  elementsMap: NonDeletedSceneElementsMap,
  zoom?: AppState["zoom"],
  fullShape?: boolean,
): boolean => {
  const p = pointFrom<GlobalPoint>(x, y);
  const threshold = maxBindingGap(element, element.width, element.height, zoom);
  const shouldTestInside =
    // disable fullshape snapping for frame elements so we
    // can bind to frame children
    (fullShape || !isBindingFallthroughEnabled(element)) &&
    !isFrameLikeElement(element);

  // PERF: Run a cheap test to see if the binding element
  // is even close to the element
  const bounds = [
    x - threshold,
    y - threshold,
    x + threshold,
    y + threshold,
  ] as Bounds;
  const elementBounds = getElementBounds(element, elementsMap);
  if (!doBoundsIntersect(bounds, elementBounds)) {
    return false;
  }

  // Do the intersection test against the element since it's close enough
  const intersections = intersectElementWithLineSegment(
    element,
    elementsMap,
    lineSegment(elementCenterPoint(element, elementsMap), p),
  );
  const distance = distanceToElement(element, elementsMap, p);

  return shouldTestInside
    ? intersections.length === 0 || distance <= threshold
    : intersections.length > 0 && distance <= threshold;
};

export const maxBindingGap = (
  element: ExcalidrawElement,
  elementWidth: number,
  elementHeight: number,
  zoom?: AppState["zoom"],
): number => {
  const zoomValue = zoom?.value && zoom.value < 1 ? zoom.value : 1;

  // Aligns diamonds with rectangles
  const shapeRatio = element.type === "diamond" ? 1 / Math.sqrt(2) : 1;
  const smallerDimension = shapeRatio * Math.min(elementWidth, elementHeight);

  return Math.max(
    16,
    // bigger bindable boundary for bigger elements
    Math.min(0.25 * smallerDimension, 32),
    // keep in sync with the zoomed highlight
    BINDING_HIGHLIGHT_THICKNESS / zoomValue + FIXED_BINDING_DISTANCE,
  );
};

// The focus distance is the oriented ratio between the size of
// the `element` and the "focus image" of the element on which
// all focus points lie, so it's a number between -1 and 1.
// The line going through `a` and `b` is a tangent to the "focus image"
// of the element.
const determineFocusDistance = (
  element: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
  // Point on the line, in absolute coordinates
  a: GlobalPoint,
  // Another point on the line, in absolute coordinates (closer to element)
  b: GlobalPoint,
): number => {
  const center = elementCenterPoint(element, elementsMap);

  if (pointsEqual(a, b)) {
    return 0;
  }

  const rotatedA = pointRotateRads(a, center, -element.angle as Radians);
  const rotatedB = pointRotateRads(b, center, -element.angle as Radians);
  const sign =
    Math.sign(
      vectorCross(
        vectorFromPoint(rotatedB, a),
        vectorFromPoint(rotatedB, center),
      ),
    ) * -1;
  const rotatedInterceptor = lineSegment(
    rotatedB,
    pointFromVector(
      vectorScale(
        vectorNormalize(vectorFromPoint(rotatedB, rotatedA)),
        Math.max(element.width * 2, element.height * 2),
      ),
      rotatedB,
    ),
  );
  const axes =
    element.type === "diamond"
      ? [
          lineSegment(
            pointFrom<GlobalPoint>(element.x + element.width / 2, element.y),
            pointFrom<GlobalPoint>(
              element.x + element.width / 2,
              element.y + element.height,
            ),
          ),
          lineSegment(
            pointFrom<GlobalPoint>(element.x, element.y + element.height / 2),
            pointFrom<GlobalPoint>(
              element.x + element.width,
              element.y + element.height / 2,
            ),
          ),
        ]
      : [
          lineSegment(
            pointFrom<GlobalPoint>(element.x, element.y),
            pointFrom<GlobalPoint>(
              element.x + element.width,
              element.y + element.height,
            ),
          ),
          lineSegment(
            pointFrom<GlobalPoint>(element.x + element.width, element.y),
            pointFrom<GlobalPoint>(element.x, element.y + element.height),
          ),
        ];
  const interceptees =
    element.type === "diamond"
      ? [
          lineSegment(
            pointFrom<GlobalPoint>(
              element.x + element.width / 2,
              element.y - element.height,
            ),
            pointFrom<GlobalPoint>(
              element.x + element.width / 2,
              element.y + element.height * 2,
            ),
          ),
          lineSegment(
            pointFrom<GlobalPoint>(
              element.x - element.width,
              element.y + element.height / 2,
            ),
            pointFrom<GlobalPoint>(
              element.x + element.width * 2,
              element.y + element.height / 2,
            ),
          ),
        ]
      : [
          lineSegment(
            pointFrom<GlobalPoint>(
              element.x - element.width,
              element.y - element.height,
            ),
            pointFrom<GlobalPoint>(
              element.x + element.width * 2,
              element.y + element.height * 2,
            ),
          ),
          lineSegment(
            pointFrom<GlobalPoint>(
              element.x + element.width * 2,
              element.y - element.height,
            ),
            pointFrom<GlobalPoint>(
              element.x - element.width,
              element.y + element.height * 2,
            ),
          ),
        ];

  const ordered = [
    lineSegmentIntersectionPoints(rotatedInterceptor, interceptees[0]),
    lineSegmentIntersectionPoints(rotatedInterceptor, interceptees[1]),
  ]
    .filter((p): p is GlobalPoint => p !== null)
    .sort((g, h) => pointDistanceSq(g, b) - pointDistanceSq(h, b))
    .map(
      (p, idx): number =>
        (sign * pointDistance(center, p)) /
        (element.type === "diamond"
          ? pointDistance(axes[idx][0], axes[idx][1]) / 2
          : Math.sqrt(element.width ** 2 + element.height ** 2) / 2),
    )
    .sort((g, h) => Math.abs(g) - Math.abs(h));

  const signedDistanceRatio = ordered[0] ?? 0;

  return signedDistanceRatio;
};

const determineFocusPoint = (
  element: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
  // The oriented, relative distance from the center of `element` of the
  // returned focusPoint
  focus: number,
  adjacentPoint: GlobalPoint,
): GlobalPoint => {
  const center = elementCenterPoint(element, elementsMap);

  if (focus === 0) {
    return center;
  }

  const candidates = (
    element.type === "diamond"
      ? [
          pointFrom<GlobalPoint>(element.x, element.y + element.height / 2),
          pointFrom<GlobalPoint>(element.x + element.width / 2, element.y),
          pointFrom<GlobalPoint>(
            element.x + element.width,
            element.y + element.height / 2,
          ),
          pointFrom<GlobalPoint>(
            element.x + element.width / 2,
            element.y + element.height,
          ),
        ]
      : [
          pointFrom<GlobalPoint>(element.x, element.y),
          pointFrom<GlobalPoint>(element.x + element.width, element.y),
          pointFrom<GlobalPoint>(
            element.x + element.width,
            element.y + element.height,
          ),
          pointFrom<GlobalPoint>(element.x, element.y + element.height),
        ]
  )
    .map((p) =>
      pointFromVector(
        vectorScale(vectorFromPoint(p, center), Math.abs(focus)),
        center,
      ),
    )
    .map((p) => pointRotateRads(p, center, element.angle as Radians));

  const selected = [
    vectorCross(
      vectorFromPoint(adjacentPoint, candidates[0]),
      vectorFromPoint(candidates[1], candidates[0]),
    ) > 0 && // TOP
      (focus > 0
        ? vectorCross(
            vectorFromPoint(adjacentPoint, candidates[1]),
            vectorFromPoint(candidates[2], candidates[1]),
          ) < 0
        : vectorCross(
            vectorFromPoint(adjacentPoint, candidates[3]),
            vectorFromPoint(candidates[0], candidates[3]),
          ) < 0),
    vectorCross(
      vectorFromPoint(adjacentPoint, candidates[1]),
      vectorFromPoint(candidates[2], candidates[1]),
    ) > 0 && // RIGHT
      (focus > 0
        ? vectorCross(
            vectorFromPoint(adjacentPoint, candidates[2]),
            vectorFromPoint(candidates[3], candidates[2]),
          ) < 0
        : vectorCross(
            vectorFromPoint(adjacentPoint, candidates[0]),
            vectorFromPoint(candidates[1], candidates[0]),
          ) < 0),
    vectorCross(
      vectorFromPoint(adjacentPoint, candidates[2]),
      vectorFromPoint(candidates[3], candidates[2]),
    ) > 0 && // BOTTOM
      (focus > 0
        ? vectorCross(
            vectorFromPoint(adjacentPoint, candidates[3]),
            vectorFromPoint(candidates[0], candidates[3]),
          ) < 0
        : vectorCross(
            vectorFromPoint(adjacentPoint, candidates[1]),
            vectorFromPoint(candidates[2], candidates[1]),
          ) < 0),
    vectorCross(
      vectorFromPoint(adjacentPoint, candidates[3]),
      vectorFromPoint(candidates[0], candidates[3]),
    ) > 0 && // LEFT
      (focus > 0
        ? vectorCross(
            vectorFromPoint(adjacentPoint, candidates[0]),
            vectorFromPoint(candidates[1], candidates[0]),
          ) < 0
        : vectorCross(
            vectorFromPoint(adjacentPoint, candidates[2]),
            vectorFromPoint(candidates[3], candidates[2]),
          ) < 0),
  ];

  const focusPoint = selected[0]
    ? focus > 0
      ? candidates[1]
      : candidates[0]
    : selected[1]
    ? focus > 0
      ? candidates[2]
      : candidates[1]
    : selected[2]
    ? focus > 0
      ? candidates[3]
      : candidates[2]
    : focus > 0
    ? candidates[0]
    : candidates[3];

  return focusPoint;
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

type BindableElementVisitingFunc<T> = (
  bindableElement: ExcalidrawElement | undefined,
  bindingProp: BindingProp,
  bindingId: string,
) => T;

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
const bindableElementsVisitor = <T>(
  elements: ElementsMap,
  element: ExcalidrawElement,
  visit: BindableElementVisitingFunc<T>,
): T[] => {
  const result: T[] = [];

  if (element.frameId) {
    const id = element.frameId;
    result.push(visit(elements.get(id), "frameId", id));
  }

  if (isBoundToContainer(element)) {
    const id = element.containerId;
    result.push(visit(elements.get(id), "containerId", id));
  }

  if (isArrowElement(element)) {
    if (element.startBinding) {
      const id = element.startBinding.elementId;
      result.push(visit(elements.get(id), "startBinding", id));
    }

    if (element.endBinding) {
      const id = element.endBinding.elementId;
      result.push(visit(elements.get(id), "endBinding", id));
    }
  }

  return result;
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

export const getGlobalFixedPointForBindableElement = (
  fixedPointRatio: [number, number],
  element: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
): GlobalPoint => {
  const [fixedX, fixedY] = normalizeFixedPoint(fixedPointRatio);

  return pointRotateRads(
    pointFrom(
      element.x + element.width * fixedX,
      element.y + element.height * fixedY,
    ),
    elementCenterPoint(element, elementsMap),
    element.angle,
  );
};

export const getGlobalFixedPoints = (
  arrow: ExcalidrawElbowArrowElement,
  elementsMap: ElementsMap,
): [GlobalPoint, GlobalPoint] => {
  const startElement =
    arrow.startBinding &&
    (elementsMap.get(arrow.startBinding.elementId) as
      | ExcalidrawBindableElement
      | undefined);
  const endElement =
    arrow.endBinding &&
    (elementsMap.get(arrow.endBinding.elementId) as
      | ExcalidrawBindableElement
      | undefined);
  const startPoint =
    startElement && arrow.startBinding
      ? getGlobalFixedPointForBindableElement(
          arrow.startBinding.fixedPoint,
          startElement as ExcalidrawBindableElement,
          elementsMap,
        )
      : pointFrom<GlobalPoint>(
          arrow.x + arrow.points[0][0],
          arrow.y + arrow.points[0][1],
        );
  const endPoint =
    endElement && arrow.endBinding
      ? getGlobalFixedPointForBindableElement(
          arrow.endBinding.fixedPoint,
          endElement as ExcalidrawBindableElement,
          elementsMap,
        )
      : pointFrom<GlobalPoint>(
          arrow.x + arrow.points[arrow.points.length - 1][0],
          arrow.y + arrow.points[arrow.points.length - 1][1],
        );

  return [startPoint, endPoint];
};

export const getArrowLocalFixedPoints = (
  arrow: ExcalidrawElbowArrowElement,
  elementsMap: ElementsMap,
) => {
  const [startPoint, endPoint] = getGlobalFixedPoints(arrow, elementsMap);

  return [
    LinearElementEditor.pointFromAbsoluteCoords(arrow, startPoint, elementsMap),
    LinearElementEditor.pointFromAbsoluteCoords(arrow, endPoint, elementsMap),
  ];
};

export const normalizeFixedPoint = <T extends FixedPoint | null>(
  fixedPoint: T,
): T extends null ? null : FixedPoint => {
  // Do not allow a precise 0.5 for fixed point ratio
  // to avoid jumping arrow heading due to floating point imprecision
  if (
    fixedPoint &&
    (Math.abs(fixedPoint[0] - 0.5) < 0.0001 ||
      Math.abs(fixedPoint[1] - 0.5) < 0.0001)
  ) {
    return fixedPoint.map((ratio) =>
      Math.abs(ratio - 0.5) < 0.0001 ? 0.5001 : ratio,
    ) as T extends null ? null : FixedPoint;
  }
  return fixedPoint as any as T extends null ? null : FixedPoint;
};
