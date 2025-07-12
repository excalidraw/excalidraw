import { KEYS, arrayToMap, invariant, tupleToCoors } from "@excalidraw/common";

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
import { hitElementItself, intersectElementWithLineSegment } from "./collision";
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
  NonDeletedExcalidrawElement,
  ElementsMap,
  NonDeletedSceneElementsMap,
  ExcalidrawTextElement,
  ExcalidrawArrowElement,
  ExcalidrawElbowArrowElement,
  FixedPoint,
  FixedPointBinding,
  PointsPositionUpdates,
  Ordered,
  BindMode,
} from "./types";

export type SuggestedBinding =
  | NonDeleted<ExcalidrawBindableElement>
  | SuggestedPointBinding;

export type SuggestedPointBinding = [
  NonDeleted<ExcalidrawLinearElement>,
  "start" | "end" | "both",
  NonDeleted<ExcalidrawBindableElement>,
];

export const FIXED_BINDING_DISTANCE = 5;
export const BINDING_HIGHLIGHT_THICKNESS = 10;

export const shouldEnableBindingForPointerEvent = (
  event: React.PointerEvent<HTMLElement>,
) => {
  return !event[KEYS.CTRL_OR_CMD];
};

export const isBindingEnabled = (appState: AppState): boolean => {
  return appState.isBindingEnabled;
};

export const bindOrUnbindLinearElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  startBindingElement: ExcalidrawBindableElement | null | undefined,
  startBindingStrategy: BindMode | "keep" | null,
  endBindingElement: ExcalidrawBindableElement | null | undefined,
  endBindingStrategy: BindMode | "keep" | null,
  scene: Scene,
): void => {
  if (startBindingStrategy !== "keep" && startBindingElement !== undefined) {
    bindOrUnbindLinearElementEdge(
      linearElement,
      startBindingElement,
      startBindingStrategy,
      "start",
      scene,
    );
  }
  if (endBindingStrategy !== "keep" && endBindingElement !== undefined) {
    bindOrUnbindLinearElementEdge(
      linearElement,
      endBindingElement,
      endBindingStrategy,
      "end",
      scene,
    );
  }
};

const bindOrUnbindLinearElementEdge = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  bindableElement: ExcalidrawBindableElement | null,
  mode: BindMode | null,
  startOrEnd: "start" | "end",
  scene: Scene,
): void => {
  if (bindableElement === null || mode === null) {
    // null means break the binding
    unbindLinearElement(linearElement, startOrEnd, scene);
  } else {
    bindLinearElement(linearElement, bindableElement, mode, startOrEnd, scene);
  }
};

const getOriginalBindingsIfStillCloseToArrowEnds = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  elementsMap: NonDeletedSceneElementsMap,
  zoom?: AppState["zoom"],
): (NonDeleted<ExcalidrawElement> | null)[] =>
  (["start", "end"] as const).map((edge) => {
    const coors = tupleToCoors(
      LinearElementEditor.getPointAtIndexGlobalCoordinates(
        linearElement,
        edge === "start" ? 0 : -1,
        elementsMap,
      ),
    );
    const elementId =
      edge === "start"
        ? linearElement.startBinding?.elementId
        : linearElement.endBinding?.elementId;
    if (elementId) {
      const element = elementsMap.get(elementId);
      if (
        isBindableElement(element) &&
        bindingBorderTest(
          element,
          pointFrom<GlobalPoint>(coors.x, coors.y),
          elementsMap,
          zoom,
        )
      ) {
        return element;
      }
    }

    return null;
  });

const hoveredElementAndIfItsPrecise = (
  selectedElement: NonDeleted<ExcalidrawLinearElement>,
  elements: readonly Ordered<NonDeletedExcalidrawElement>[],
  elementsMap: NonDeletedSceneElementsMap,
  zoom: AppState["zoom"],
  pointIndex: number,
): [NonDeleted<ExcalidrawBindableElement> | null, boolean] => {
  const { x, y } = tupleToCoors(
    LinearElementEditor.getPointAtIndexGlobalCoordinates(
      selectedElement,
      pointIndex,
      elementsMap,
    ),
  );
  const hoveredElement = getHoveredElementForBinding(
    pointFrom<GlobalPoint>(x, y),
    elements,
    elementsMap,
    zoom,
  );
  const hit =
    !!hoveredElement &&
    hitElementItself({
      element: hoveredElement,
      elementsMap,
      point: pointFrom<GlobalPoint>(x, y),
      threshold: 0,
    });

  return [hoveredElement, hit];
};

const getBindingStrategyForDraggingArrowEndpoints = (
  selectedElement: NonDeleted<ExcalidrawLinearElement>,
  isBindingEnabled: boolean,
  draggingPoints: readonly number[],
  elementsMap: NonDeletedSceneElementsMap,
  elements: readonly Ordered<NonDeletedExcalidrawElement>[],
  zoom: AppState["zoom"],
  globalBindMode?: BindMode,
): [
  {
    element: NonDeleted<ExcalidrawBindableElement> | null | undefined;
    mode: BindMode | "keep" | null;
  },
  {
    element: NonDeleted<ExcalidrawBindableElement> | null | undefined;
    mode: BindMode | "keep" | null;
  },
] => {
  const startIdx = 0;
  const endIdx = selectedElement.points.length - 1;
  const startDragged = draggingPoints.findIndex((i) => i === startIdx) > -1;
  const endDragged = draggingPoints.findIndex((i) => i === endIdx) > -1;

  // If both ends are dragged, we don't bind to anything and break existing bindings
  if (startDragged && endDragged) {
    return [
      { element: null, mode: null },
      { element: null, mode: null },
    ];
  }

  let start: {
    element: NonDeleted<ExcalidrawBindableElement> | null | undefined;
    mode: BindMode | "keep";
  } = { element: undefined, mode: "keep" };
  if (startDragged && isBindingEnabled) {
    const [hoveredElement, hit] = hoveredElementAndIfItsPrecise(
      selectedElement,
      elements,
      elementsMap,
      zoom,
      startIdx,
    );

    start = {
      element: hoveredElement,
      mode: globalBindMode || hit ? "inside" : "orbit",
    };
  }

  let end: {
    element: NonDeleted<ExcalidrawBindableElement> | null | undefined;
    mode: BindMode | "keep";
  } = { element: undefined, mode: "keep" };
  if (endDragged && isBindingEnabled) {
    const [hoveredElement, hit] = hoveredElementAndIfItsPrecise(
      selectedElement,
      elements,
      elementsMap,
      zoom,
      endIdx,
    );

    end = {
      element: hoveredElement,
      mode: globalBindMode || hit ? "inside" : "orbit",
    };
  }

  return [start, end];
};

export const bindOrUnbindLinearElements = (
  selectedElements: NonDeleted<ExcalidrawLinearElement>[],
  isBindingEnabled: boolean,
  draggingPoints: readonly number[],
  scene: Scene,
  zoom: AppState["zoom"],
): void => {
  selectedElements.forEach((selectedElement) => {
    if (draggingPoints.length) {
      // The arrow edge points are dragged (i.e. start, end)
      const [
        { element: startElement, mode: startMode },
        { element: endElement, mode: endMode },
      ] = getBindingStrategyForDraggingArrowEndpoints(
        selectedElement,
        isBindingEnabled,
        draggingPoints,
        scene.getNonDeletedElementsMap(),
        scene.getNonDeletedElements(),
        zoom,
      );
      bindOrUnbindLinearElement(
        selectedElement,
        startElement,
        startMode,
        endElement,
        endMode,
        scene,
      );
    } else {
      bindOrUnbindLinearElement(
        selectedElement,
        null,
        "orbit",
        null,
        "orbit",
        scene,
      );
    }
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
  startOrEndOrBoth: "start" | "end" | "both",
  scene: Scene,
  zoom: AppState["zoom"],
): ExcalidrawBindableElement[] => {
  const startCoords = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    linearElement,
    0,
    scene.getNonDeletedElementsMap(),
  );
  const endCoords = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    linearElement,
    -1,
    scene.getNonDeletedElementsMap(),
  );
  const startHovered = getHoveredElementForBinding(
    startCoords,
    scene.getNonDeletedElements(),
    scene.getNonDeletedElementsMap(),
    zoom,
  );
  const endHovered = getHoveredElementForBinding(
    endCoords,
    scene.getNonDeletedElements(),
    scene.getNonDeletedElementsMap(),
    zoom,
  );

  const suggestedBindings = [];

  if (startHovered != null && startHovered.id === endHovered?.id) {
    const hitStart = hitElementItself({
      element: startHovered,
      elementsMap: scene.getNonDeletedElementsMap(),
      point: pointFrom<GlobalPoint>(startCoords[0], startCoords[1]),
      threshold: 0,
    });
    const hitEnd = hitElementItself({
      element: endHovered,
      elementsMap: scene.getNonDeletedElementsMap(),
      point: pointFrom<GlobalPoint>(endCoords[0], endCoords[1]),
      threshold: 0,
    });
    if (hitStart && hitEnd) {
      suggestedBindings.push(startHovered);
    }
  } else if (startOrEndOrBoth === "start" && startHovered != null) {
    suggestedBindings.push(startHovered);
  } else if (startOrEndOrBoth === "end" && endHovered != null) {
    suggestedBindings.push(endHovered);
  }

  return suggestedBindings;
};

export const bindLinearElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  hoveredElement: ExcalidrawBindableElement,
  mode: BindMode,
  startOrEnd: "start" | "end",
  scene: Scene,
  focusPoint?: GlobalPoint,
): void => {
  if (!isArrowElement(linearElement)) {
    return;
  }

  const elementsMap = scene.getNonDeletedElementsMap();

  let binding: FixedPointBinding;

  if (isElbowArrow(linearElement)) {
    binding = {
      elementId: hoveredElement.id,
      mode: "orbit",
      ...calculateFixedPointForElbowArrowBinding(
        linearElement,
        hoveredElement,
        startOrEnd,
        elementsMap,
      ),
    };
  } else {
    binding = {
      elementId: hoveredElement.id,
      mode,
      ...calculateFixedPointForNonElbowArrowBinding(
        linearElement,
        hoveredElement,
        startOrEnd,
        elementsMap,
        focusPoint,
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

export const unbindLinearElement = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  startOrEnd: "start" | "end",
  scene: Scene,
): ExcalidrawBindableElement["id"] | null => {
  const field = startOrEnd === "start" ? "startBinding" : "endBinding";
  const binding = linearElement[field];

  if (binding == null) {
    return null;
  }

  const oppositeBinding =
    linearElement[startOrEnd === "start" ? "endBinding" : "startBinding"];

  if (oppositeBinding?.elementId !== binding.elementId) {
    // Only remove the record on the bound element if the other
    // end is not bound to the same element
    const boundElement = scene
      .getNonDeletedElementsMap()
      .get(binding.elementId) as ExcalidrawBindableElement;
    scene.mutateElement(boundElement, {
      boundElements: boundElement.boundElements?.filter(
        (element) => element.id !== linearElement.id,
      ),
    });
  }

  scene.mutateElement(linearElement, { [field]: null });

  return binding.elementId;
};

export const getHoveredElementForBinding = (
  point: Readonly<GlobalPoint>,
  elements: readonly Ordered<NonDeletedExcalidrawElement>[],
  elementsMap: NonDeletedSceneElementsMap,
  zoom?: AppState["zoom"],
): NonDeleted<ExcalidrawBindableElement> | null => {
  const candidateElements: NonDeleted<ExcalidrawBindableElement>[] = [];
  // We need to to hit testing from front (end of the array) to back (beginning of the array)
  // because array is ordered from lower z-index to highest and we want element z-index
  // with higher z-index
  for (let index = elements.length - 1; index >= 0; --index) {
    const element = elements[index];

    invariant(
      !element.isDeleted,
      "Elements in the function parameter for getAllElementsAtPositionForBinding() should not contain deleted elements",
    );

    if (
      isBindableElement(element, false) &&
      bindingBorderTest(element, point, elementsMap, zoom)
    ) {
      candidateElements.push(element);
    }
  }

  if (!candidateElements || candidateElements.length === 0) {
    return null;
  }

  if (candidateElements.length === 1) {
    return candidateElements[0];
  }

  // Prefer smaller shapes
  return candidateElements
    .sort(
      (a, b) => b.width ** 2 + b.height ** 2 - (a.width ** 2 + a.height ** 2),
    )
    .pop() as NonDeleted<ExcalidrawBindableElement>;
};

// Supports translating, rotating and scaling `changedElement` with bound
// linear elements.
export const updateBoundElements = (
  changedElement: NonDeletedExcalidrawElement,
  scene: Scene,
  options?: {
    simultaneouslyUpdated?: readonly ExcalidrawElement[];
    changedElements?: Map<string, ExcalidrawElement>;
  },
) => {
  if (!isBindableElement(changedElement)) {
    return;
  }

  const { simultaneouslyUpdated } = options ?? {};
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
      ? // PERF: If the arrow is bound to the same element on both ends.
        startBindingElement?.id === element.endBinding.elementId
        ? startBindingElement
        : elementsMap.get(element.endBinding.elementId)
      : null;

    let startBounds: Bounds | null = null;
    let endBounds: Bounds | null = null;
    if (startBindingElement && endBindingElement) {
      startBounds = getElementBounds(startBindingElement, elementsMap);
      endBounds = getElementBounds(endBindingElement, elementsMap);
    }

    // `linearElement` is being moved/scaled already, just update the binding
    if (simultaneouslyUpdatedElementIds.has(element.id)) {
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
            element[bindingProp],
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
      moveMidPointsWithElement:
        !!startBindingElement &&
        startBindingElement?.id === endBindingElement?.id,
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
  zoom: AppState["zoom"],
  options?: {
    simultaneouslyUpdated?: readonly ExcalidrawElement[];
    newSize?: { width: number; height: number };
  },
) => {
  if (isLinearElement(latestElement)) {
    bindOrUnbindLinearElements([latestElement], true, [], scene, zoom);
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
  const bindDistance = maxBindingDistanceFromOutline(
    bindableElement,
    bindableElement.width,
    bindableElement.height,
    zoom,
  );

  return distance > bindDistance ? null : distance;
};

export const bindPointToSnapToElementOutline = (
  linearElement: ExcalidrawLinearElement,
  bindableElement: ExcalidrawBindableElement,
  startOrEnd: "start" | "end",
  elementsMap: ElementsMap,
): GlobalPoint => {
  const aabb = aabbForElement(bindableElement, elementsMap);
  const localP =
    linearElement.points[
      startOrEnd === "start" ? 0 : linearElement.points.length - 1
    ];
  const globalP = pointFrom<GlobalPoint>(
    linearElement.x + localP[0],
    linearElement.y + localP[1],
  );

  if (linearElement.points.length < 2) {
    // New arrow creation, so no snapping
    return globalP;
  }

  const edgePoint = isRectanguloidElement(bindableElement)
    ? avoidRectangularCorner(bindableElement, elementsMap, globalP)
    : globalP;
  const elbowed = isElbowArrow(linearElement);
  const center = getCenterForBounds(aabb);
  const adjacentPointIdx =
    startOrEnd === "start" ? 1 : linearElement.points.length - 2;
  const adjacentPoint = pointRotateRads(
    pointFrom<GlobalPoint>(
      linearElement.x + linearElement.points[adjacentPointIdx][0],
      linearElement.y + linearElement.points[adjacentPointIdx][1],
    ),
    center,
    linearElement.angle ?? 0,
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

  return intersection;
};

export const getOutlineAvoidingPoint = (
  element: NonDeleted<ExcalidrawLinearElement>,
  hoveredElement: ExcalidrawBindableElement | null,
  coords: GlobalPoint,
  pointIndex: number,
  elementsMap: ElementsMap,
): GlobalPoint => {
  if (hoveredElement) {
    const newPoints = Array.from(element.points);
    newPoints[pointIndex] = pointFrom<LocalPoint>(
      coords[0] - element.x,
      coords[1] - element.y,
    );

    return bindPointToSnapToElementOutline(
      {
        ...element,
        points: newPoints,
      },
      hoveredElement,
      pointIndex === 0 ? "start" : "end",
      elementsMap,
    );
  }

  return coords;
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

export const updateBoundPoint = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  startOrEnd: "startBinding" | "endBinding",
  binding: FixedPointBinding | null | undefined,
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

  const fixedPoint = normalizeFixedPoint(binding.fixedPoint);
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
  const maybeOutlineGlobal =
    binding.mode === "orbit"
      ? getOutlineAvoidingPoint(
          linearElement,
          bindableElement,
          rotatedGlobal,
          startOrEnd === "startBinding" ? 0 : linearElement.points.length - 1,
          elementsMap,
        )
      : rotatedGlobal;

  return LinearElementEditor.pointFromAbsoluteCoords(
    linearElement,
    maybeOutlineGlobal,
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

export const calculateFixedPointForNonElbowArrowBinding = (
  linearElement: NonDeleted<ExcalidrawLinearElement>,
  hoveredElement: ExcalidrawBindableElement,
  startOrEnd: "start" | "end",
  elementsMap: ElementsMap,
  focusPoint?: GlobalPoint,
): { fixedPoint: FixedPoint } => {
  const edgePoint = focusPoint
    ? focusPoint
    : LinearElementEditor.getPointAtIndexGlobalCoordinates(
        linearElement,
        startOrEnd === "start" ? 0 : -1,
        elementsMap,
      );

  // Convert the global point to element-local coordinates
  const elementCenter = pointFrom(
    hoveredElement.x + hoveredElement.width / 2,
    hoveredElement.y + hoveredElement.height / 2,
  );

  // Rotate the point to account for element rotation
  const nonRotatedPoint = pointRotateRads(
    edgePoint,
    elementCenter,
    -hoveredElement.angle as Radians,
  );

  // Calculate the ratio relative to the element's bounds
  const fixedPointX =
    (nonRotatedPoint[0] - hoveredElement.x) / hoveredElement.width;
  const fixedPointY =
    (nonRotatedPoint[1] - hoveredElement.y) / hoveredElement.height;

  return {
    fixedPoint: normalizeFixedPoint([fixedPointX, fixedPointY]),
  };
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

const bindingBorderTest = (
  element: NonDeleted<ExcalidrawBindableElement>,
  [x, y]: Readonly<GlobalPoint>,
  elementsMap: NonDeletedSceneElementsMap,
  zoom?: AppState["zoom"],
): boolean => {
  const p = pointFrom<GlobalPoint>(x, y);
  const threshold = maxBindingDistanceFromOutline(
    element,
    element.width,
    element.height,
    zoom,
  );
  const shouldTestInside =
    // disable fullshape snapping for frame elements so we
    // can bind to frame children
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

export const maxBindingDistanceFromOutline = (
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
  arrow: ExcalidrawArrowElement,
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
