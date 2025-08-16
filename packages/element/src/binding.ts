import {
  KEYS,
  arrayToMap,
  invariant,
  isAlwaysInsideBinding,
  tupleToCoors,
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
  PRECISION,
} from "@excalidraw/math";

import type { LineSegment, LocalPoint, Radians } from "@excalidraw/math";

import type { AppState } from "@excalidraw/excalidraw/types";

import type { MapEntry, Mutable } from "@excalidraw/common/utility-types";

import {
  doBoundsIntersect,
  getCenterForBounds,
  getElementBounds,
} from "./bounds";
import {
  bindingBorderTest,
  getHoveredElementForBinding,
  getHoveredElementForBindingAndIfItsPrecise,
  hitElementItself,
  intersectElementWithLineSegment,
  maxBindingDistanceFromOutline,
} from "./collision";
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
  NonDeleted<ExcalidrawArrowElement>,
  "start" | "end" | "both",
  NonDeleted<ExcalidrawBindableElement>,
];

export type BindingStrategy =
  // Create a new binding with this mode
  | {
      mode: BindMode;
      element: NonDeleted<ExcalidrawBindableElement>;
      focusPoint: GlobalPoint;
    }
  // Break the binding
  | {
      mode: null;
      element?: undefined;
      focusPoint?: undefined;
    }
  // Keep the existing binding
  | {
      mode: undefined;
      element?: undefined;
      focusPoint?: undefined;
    };

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

export const bindOrUnbindBindingElement = (
  arrow: NonDeleted<ExcalidrawArrowElement>,
  draggingPoints: PointsPositionUpdates,
  scene: Scene,
  appState: AppState,
  opts?: {
    newArrow: boolean;
  },
) => {
  const { start, end } = getBindingStrategyForDraggingBindingElementEndpoints(
    arrow,
    draggingPoints,
    scene.getNonDeletedElementsMap(),
    scene.getNonDeletedElements(),
    appState,
    {
      ...opts,
    },
  );

  bindOrUnbindBindingElementEdge(arrow, start, "start", scene);
  bindOrUnbindBindingElementEdge(arrow, end, "end", scene);
  if (!isElbowArrow(arrow) && (start.focusPoint || end.focusPoint)) {
    // If the strategy dictates a focus point override, then
    // update the arrow points to point to the focus point.
    const updates: PointsPositionUpdates = new Map();

    if (start.focusPoint) {
      updates.set(0, {
        point:
          updateBoundPoint(
            arrow,
            "startBinding",
            arrow.startBinding,
            start.element,
            scene.getNonDeletedElementsMap(),
          ) || arrow.points[0],
      });
    }

    if (end.focusPoint) {
      updates.set(arrow.points.length - 1, {
        point:
          updateBoundPoint(
            arrow,
            "endBinding",
            arrow.endBinding,
            end.element,
            scene.getNonDeletedElementsMap(),
          ) || arrow.points[arrow.points.length - 1],
      });
    }

    LinearElementEditor.movePoints(arrow, scene, updates);
  }

  return { start, end };
};

const bindOrUnbindBindingElementEdge = (
  arrow: NonDeleted<ExcalidrawArrowElement>,
  { mode, element, focusPoint }: BindingStrategy,
  startOrEnd: "start" | "end",
  scene: Scene,
): void => {
  if (mode === null) {
    // null means break the binding
    unbindBindingElement(arrow, startOrEnd, scene);
  } else if (mode !== undefined) {
    bindBindingElement(arrow, element, mode, startOrEnd, scene, focusPoint);
  }
};

const getOriginalBindingsIfStillCloseToBindingEnds = (
  linearElement: NonDeleted<ExcalidrawArrowElement>,
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

export const getStartGlobalEndLocalPointsForSimpleArrowBinding = (
  arrow: NonDeleted<ExcalidrawArrowElement>,
  start: BindingStrategy,
  end: BindingStrategy,
  startPoint: GlobalPoint,
  endPoint: LocalPoint,
  elementsMap: ElementsMap,
): [GlobalPoint, LocalPoint] => {
  let startGlobalPoint = startPoint;
  let endLocalPoint = endPoint;
  if (start.mode) {
    const newStartLocalPoint = updateBoundPoint(
      arrow,
      "startBinding",
      start.mode
        ? {
            ...calculateFixedPointForNonElbowArrowBinding(
              arrow,
              start.element,
              "start",
              elementsMap,
              start.focusPoint,
            ),
            elementId: start.element.id,
            mode: start.mode,
          }
        : null,
      start.element,
      elementsMap,
    );
    startGlobalPoint = newStartLocalPoint
      ? LinearElementEditor.getPointGlobalCoordinates(
          arrow,
          newStartLocalPoint,
          elementsMap,
        )
      : startGlobalPoint;
  }

  if (end.mode) {
    const newEndLocalPoint = updateBoundPoint(
      arrow,
      "endBinding",
      end.mode
        ? {
            ...calculateFixedPointForNonElbowArrowBinding(
              arrow,
              end.element,
              "end",
              elementsMap,
              end.focusPoint,
            ),
            elementId: end.element.id,
            mode: end.mode,
          }
        : null,
      end.element,
      elementsMap,
    );
    endLocalPoint = newEndLocalPoint ?? endLocalPoint;
  }

  return [
    startGlobalPoint,
    pointFrom<LocalPoint>(
      endLocalPoint[0] - (startGlobalPoint[0] - arrow.x),
      endLocalPoint[1] - (startGlobalPoint[1] - arrow.y),
    ),
  ];
};

const bindingStrategyForNewSimpleArrowEndpointDragging = (
  arrow: NonDeleted<ExcalidrawArrowElement>,
  draggingPoints: PointsPositionUpdates,
  elementsMap: NonDeletedSceneElementsMap,
  elements: readonly Ordered<NonDeletedExcalidrawElement>[],
  startDragged: boolean,
  endDragged: boolean,
  startIdx: number,
  endIdx: number,
  appState: AppState,
  globalBindMode?: AppState["bindMode"],
): {
  start: BindingStrategy;
  end: BindingStrategy;
} => {
  let start: BindingStrategy = { mode: undefined };
  let end: BindingStrategy = { mode: undefined };

  const point = LinearElementEditor.getPointGlobalCoordinates(
    arrow,
    draggingPoints.get(startDragged ? startIdx : endIdx)!.point,
    elementsMap,
  );
  const { hovered, hit } = getHoveredElementForBindingAndIfItsPrecise(
    point,
    elements,
    elementsMap,
    appState.zoom,
    true,
  );

  // With new arrows this handles the binding at arrow creation
  if (startDragged) {
    if (hovered) {
      if (hit) {
        start = {
          element: hovered,
          mode: "inside",
          focusPoint: point,
        };
      } else {
        start = {
          element: hovered,
          mode: "orbit",
          focusPoint: point,
        };
      }
    } else {
      start = { mode: null };
    }

    return { start, end };
  }

  // With new arrows it represents the continuous dragging of the end point
  if (endDragged) {
    const arrowOriginalStartPoint =
      appState?.selectedLinearElement?.pointerDownState.arrowOriginalStartPoint;

    // Inside -> inside binding
    if (hovered && hit && arrow.startBinding?.elementId === hovered.id) {
      const center = pointFrom<GlobalPoint>(
        hovered.x + hovered.width / 2,
        hovered.y + hovered.height / 2,
      );

      return {
        start: {
          mode: "inside",
          element: hovered,
          focusPoint: arrowOriginalStartPoint ?? center,
        },
        end: { mode: "inside", element: hovered, focusPoint: point },
      };
    }

    // Inside -> orbit binding
    if (hovered && !hit && arrow.startBinding?.elementId === hovered.id) {
      const center = pointFrom<GlobalPoint>(
        hovered.x + hovered.width / 2,
        hovered.y + hovered.height / 2,
      );

      return {
        start: {
          mode: globalBindMode === "inside" ? "inside" : "orbit",
          element: hovered,
          focusPoint: arrowOriginalStartPoint ?? center,
        },
        end: { mode: null },
      };
    }

    // Inside -> outside binding
    if (arrow.startBinding && arrow.startBinding.elementId !== hovered?.id) {
      const otherElement = elementsMap.get(
        arrow.startBinding.elementId,
      ) as ExcalidrawBindableElement;
      invariant(otherElement, "Other element must be in the elements map");

      const otherIsInsideBinding =
        !!appState.selectedLinearElement?.pointerDownState.arrowStartIsInside;

      const other: BindingStrategy = {
        mode: otherIsInsideBinding ? "inside" : "orbit",
        element: otherElement,
        focusPoint: snapToCenter(
          otherElement,
          elementsMap,
          arrowOriginalStartPoint ?? pointFrom<GlobalPoint>(arrow.x, arrow.y),
        ),
      };

      // We are hovering another element with the end point
      let current: BindingStrategy;
      if (hovered) {
        const isInsideBinding = globalBindMode === "inside";
        current = {
          mode: isInsideBinding ? "inside" : "orbit",
          element: hovered,
          focusPoint: snapToCenter(hovered, elementsMap, point),
        };
      } else {
        current = { mode: null };
      }

      return {
        start: other,
        end: current,
      };
    }

    // No start binding
    if (!arrow.startBinding) {
      if (hovered) {
        const isInsideBinding =
          globalBindMode === "inside" || isAlwaysInsideBinding(hovered);

        end = {
          mode: isInsideBinding ? "inside" : "orbit",
          element: hovered,
          focusPoint: point,
        };
      } else {
        end = { mode: null };
      }

      return { start, end };
    }
  }

  invariant(false, "New arrow creation should not reach here");

  return { start, end };
};

const bindingStrategyForSimpleArrowEndpointDragging = (
  point: GlobalPoint,
  oppositeBinding: FixedPointBinding | null,
  elementsMap: NonDeletedSceneElementsMap,
  elements: readonly Ordered<NonDeletedExcalidrawElement>[],
  zoom: AppState["zoom"],
  globalBindMode?: AppState["bindMode"],
  opts?: {
    newArrow?: boolean;
    appState?: AppState;
  },
): { current: BindingStrategy; other: BindingStrategy } => {
  let current: BindingStrategy = { mode: undefined };
  let other: BindingStrategy = { mode: undefined };

  const { hovered, hit } = getHoveredElementForBindingAndIfItsPrecise(
    point,
    elements,
    elementsMap,
    zoom,
    true,
  );

  // If the global bind mode is in free binding mode, just bind
  // where the pointer is and keep the other end intact
  if (
    globalBindMode === "inside" ||
    (hovered && isAlwaysInsideBinding(hovered))
  ) {
    current = hovered
      ? {
          element: hovered,
          focusPoint: point,
          mode: "inside",
        }
      : { mode: undefined };

    return { current, other };
  }

  // Dragged point is outside of any bindable element
  // so we break any existing binding
  if (!hovered) {
    return { current: { mode: null }, other };
  }

  // Dragged point is on the binding gap of a bindable element
  if (!hit) {
    // If the opposite binding (if exists) is on the same element
    if (oppositeBinding) {
      if (oppositeBinding.elementId === hovered.id) {
        return { current: { mode: null }, other };
      }
      // The opposite binding is on a different element
      // eslint-disable-next-line no-else-return
      else {
        current = {
          element: hovered,
          mode: "orbit",
          focusPoint: opts?.newArrow
            ? pointFrom<GlobalPoint>(
                hovered.x + hovered.width / 2,
                hovered.y + hovered.height / 2,
              )
            : point,
        };

        return { current, other };
      }
    }

    // No opposite binding or the opposite binding is on a different element
    current = { element: hovered, mode: "orbit", focusPoint: point };
  }
  // The dragged point is inside the hovered bindable element
  else {
    // The opposite binding is on the same element
    // eslint-disable-next-line no-lonely-if
    if (oppositeBinding) {
      if (oppositeBinding.elementId === hovered.id) {
        // The opposite binding is on the binding gap of the same element
        if (oppositeBinding.mode !== "inside") {
          current = { element: hovered, mode: "orbit", focusPoint: point };
          other = { mode: null };

          return { current, other };
        }
        // The opposite binding is inside the same element
        // eslint-disable-next-line no-else-return
        else {
          current = { element: hovered, mode: "inside", focusPoint: point };

          return { current, other };
        }
      }
      // The opposite binding is on a different element
      // eslint-disable-next-line no-else-return
      else {
        current = {
          element: hovered,
          mode: "orbit",
          focusPoint: opts?.newArrow
            ? pointFrom<GlobalPoint>(
                hovered.x + hovered.width / 2,
                hovered.y + hovered.height / 2,
              )
            : point,
        };

        return { current, other };
      }
    }
    // The opposite binding is on a different element or no binding
    else {
      current = {
        element: hovered,
        mode: "orbit",
        focusPoint: opts?.newArrow
          ? pointFrom<GlobalPoint>(
              hovered.x + hovered.width / 2,
              hovered.y + hovered.height / 2,
            )
          : point,
      };
    }
  }

  // Must return as only one endpoint is dragged, therefore
  // the end binding strategy might accidentally gets overriden
  return { current, other };
};

export const getBindingStrategyForDraggingBindingElementEndpoints = (
  arrow: NonDeleted<ExcalidrawArrowElement>,
  draggingPoints: PointsPositionUpdates,
  elementsMap: NonDeletedSceneElementsMap,
  elements: readonly Ordered<NonDeletedExcalidrawElement>[],
  appState: AppState,
  opts?: {
    newArrow?: boolean;
  },
): { start: BindingStrategy; end: BindingStrategy } => {
  const globalBindMode = appState.bindMode || "orbit";
  const startIdx = 0;
  const endIdx = arrow.points.length - 1;
  const startDragged = draggingPoints.has(startIdx);
  const endDragged = draggingPoints.has(endIdx);

  let start: BindingStrategy = { mode: undefined };
  let end: BindingStrategy = { mode: undefined };

  invariant(
    arrow.points.length > 1,
    "Do not attempt to bind linear elements with a single point",
  );

  // If none of the ends are dragged, we don't change anything
  if (!startDragged && !endDragged) {
    return { start, end };
  }

  // If both ends are dragged, we don't bind to anything
  // and break existing bindings
  if (startDragged && endDragged) {
    return { start: { mode: null }, end: { mode: null } };
  }

  // If binding is disabled and an endpoint is dragged,
  // we actively break the end binding
  if (!isBindingEnabled(appState)) {
    start = startDragged ? { mode: null } : start;
    end = endDragged ? { mode: null } : end;

    return { start, end };
  }

  // Handle simpler elbow arrow binding, which always binds as orbiting the
  // element, even if the mouse cursor is over the element itself
  if (isElbowArrow(arrow)) {
    const p = LinearElementEditor.getPointAtIndexGlobalCoordinates(
      arrow,
      startDragged ? startIdx : endIdx,
      elementsMap,
    );
    const hoveredElement = getHoveredElementForBinding(
      p,
      elements,
      elementsMap,
      appState.zoom,
    );
    const current: BindingStrategy = hoveredElement
      ? {
          element: hoveredElement,
          mode: "orbit",
          focusPoint: p,
        }
      : { mode: null };
    const other: BindingStrategy = { mode: undefined };

    return {
      start: startDragged ? current : other,
      end: startDragged ? other : current,
    };
  }

  // Handle new arrow creation separately, as it is special
  if (opts?.newArrow) {
    return bindingStrategyForNewSimpleArrowEndpointDragging(
      arrow,
      draggingPoints,
      elementsMap,
      elements,
      startDragged,
      endDragged,
      startIdx,
      endIdx,
      appState,
      globalBindMode,
    );
  }

  // Only the start point is dragged
  if (startDragged) {
    const localPoint = draggingPoints.get(startIdx)?.point;
    invariant(localPoint, "Local point must be defined for start dragging");
    const globalPoint = LinearElementEditor.getPointGlobalCoordinates(
      arrow,
      localPoint,
      elementsMap,
    );

    const { current, other } = bindingStrategyForSimpleArrowEndpointDragging(
      globalPoint,
      arrow.endBinding,
      elementsMap,
      elements,
      appState.zoom,
      globalBindMode,
      opts,
    );

    return { start: current, end: other };
  }

  // Only the end point is dragged
  if (endDragged) {
    const localPoint = draggingPoints.get(endIdx)?.point;
    invariant(localPoint, "Local point must be defined for end dragging");
    const globalPoint = LinearElementEditor.getPointGlobalCoordinates(
      arrow,
      localPoint,
      elementsMap,
    );
    const { current, other } = bindingStrategyForSimpleArrowEndpointDragging(
      globalPoint,
      arrow.startBinding,
      elementsMap,
      elements,
      appState.zoom,
      globalBindMode,
      opts,
    );

    return { start: other, end: current };
  }

  return { start, end };
};

export const bindOrUnbindBindingElements = (
  selectedArrows: NonDeleted<ExcalidrawArrowElement>[],
  scene: Scene,
  appState: AppState,
): void => {
  selectedArrows.forEach((arrow) => {
    bindOrUnbindBindingElement(
      arrow,
      new Map(), // No dragging points in this case
      scene,
      appState,
    );
  });
};

export const getSuggestedBindingsForBindingElements = (
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
      .filter(isArrowElement)
      .flatMap((element) =>
        getOriginalBindingsIfStillCloseToBindingEnds(
          element,
          elementsMap,
          zoom,
        ),
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

export const maybeSuggestBindingsForBindingElementAtCoords = (
  linearElement: NonDeleted<ExcalidrawArrowElement>,
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
      overrideShouldTestInside: true,
    });
    const hitEnd = hitElementItself({
      element: endHovered,
      elementsMap: scene.getNonDeletedElementsMap(),
      point: pointFrom<GlobalPoint>(endCoords[0], endCoords[1]),
      threshold: 0,
      overrideShouldTestInside: true,
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

export const bindBindingElement = (
  arrow: NonDeleted<ExcalidrawArrowElement>,
  hoveredElement: ExcalidrawBindableElement,
  mode: BindMode,
  startOrEnd: "start" | "end",
  scene: Scene,
  focusPoint?: GlobalPoint,
): void => {
  const elementsMap = scene.getNonDeletedElementsMap();

  let binding: FixedPointBinding;

  if (isElbowArrow(arrow)) {
    binding = {
      elementId: hoveredElement.id,
      mode: "orbit",
      ...calculateFixedPointForElbowArrowBinding(
        arrow,
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
        arrow,
        hoveredElement,
        startOrEnd,
        elementsMap,
        focusPoint,
      ),
    };
  }

  scene.mutateElement(arrow, {
    [startOrEnd === "start" ? "startBinding" : "endBinding"]: binding,
  });

  const boundElementsMap = arrayToMap(hoveredElement.boundElements || []);
  if (!boundElementsMap.has(arrow.id)) {
    scene.mutateElement(hoveredElement, {
      boundElements: (hoveredElement.boundElements || []).concat({
        id: arrow.id,
        type: "arrow",
      }),
    });
  }
};

export const unbindBindingElement = (
  arrow: NonDeleted<ExcalidrawArrowElement>,
  startOrEnd: "start" | "end",
  scene: Scene,
): ExcalidrawBindableElement["id"] | null => {
  const field = startOrEnd === "start" ? "startBinding" : "endBinding";
  const binding = arrow[field];

  if (binding == null) {
    return null;
  }

  const oppositeBinding =
    arrow[startOrEnd === "start" ? "endBinding" : "startBinding"];
  if (!oppositeBinding || oppositeBinding.elementId !== binding.elementId) {
    // Only remove the record on the bound element if the other
    // end is not bound to the same element
    const boundElement = scene
      .getNonDeletedElementsMap()
      .get(binding.elementId) as ExcalidrawBindableElement;
    scene.mutateElement(boundElement, {
      boundElements: boundElement.boundElements?.filter(
        (element) => element.id !== arrow.id,
      ),
    });
  }

  scene.mutateElement(arrow, { [field]: null });

  return binding.elementId;
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
    if (!isArrowElement(element) || element.isDeleted) {
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
  appState: AppState,
  options?: {
    simultaneouslyUpdated?: readonly ExcalidrawElement[];
    newSize?: { width: number; height: number };
  },
) => {
  if (isArrowElement(latestElement)) {
    bindOrUnbindBindingElement(latestElement, new Map(), scene, appState);
  } else {
    updateBoundElements(latestElement, scene, {
      ...options,
      changedElements: new Map([[latestElement.id, latestElement]]),
    });
  }
};

const doesNeedUpdate = (
  boundElement: NonDeleted<ExcalidrawArrowElement>,
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

  const d = distanceToElement(bindableElement, elementsMap, origPoint);
  const bindDistance = maxBindingDistanceFromOutline(
    bindableElement,
    bindableElement.width,
    bindableElement.height,
    zoom,
  );

  const distance = d > bindDistance ? null : d;

  if (!distance) {
    return vectorToHeading(
      vectorFromPoint(p, elementCenterPoint(bindableElement, elementsMap)),
    );
  }

  return headingForPointFromElement(bindableElement, aabb, p);
};

export const bindPointToSnapToElementOutline = (
  linearElement: ExcalidrawArrowElement,
  bindableElement: ExcalidrawBindableElement,
  startOrEnd: "start" | "end",
  elementsMap: ElementsMap,
  customIntersector?: LineSegment<GlobalPoint>,
): GlobalPoint => {
  const aabb = aabbForElement(bindableElement, elementsMap);
  const localPoint =
    linearElement.points[
      startOrEnd === "start" ? 0 : linearElement.points.length - 1
    ];
  const point = pointFrom<GlobalPoint>(
    linearElement.x + localPoint[0],
    linearElement.y + localPoint[1],
  );

  if (linearElement.points.length < 2) {
    // New arrow creation, so no snapping
    return point;
  }

  const edgePoint = isRectanguloidElement(bindableElement)
    ? avoidRectangularCorner(bindableElement, elementsMap, point)
    : point;
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
      headingForPointFromElement(bindableElement, aabb, point),
    );
    const snapPoint = snapToMid(bindableElement, elementsMap, edgePoint);
    const otherPoint = pointFrom<GlobalPoint>(
      isHorizontal ? center[0] : snapPoint[0],
      !isHorizontal ? center[1] : snapPoint[1],
    );
    const intersector =
      customIntersector ??
      lineSegment(
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
    const halfVector = vectorScale(
      vectorNormalize(vectorFromPoint(edgePoint, adjacentPoint)),
      pointDistance(edgePoint, adjacentPoint) +
        Math.max(bindableElement.width, bindableElement.height) +
        FIXED_BINDING_DISTANCE * 2,
    );
    const intersector =
      customIntersector ??
      lineSegment(
        pointFromVector(halfVector, adjacentPoint),
        pointFromVector(vectorScale(halfVector, -1), adjacentPoint),
      );
    intersection =
      pointDistance(edgePoint, adjacentPoint) < 1
        ? edgePoint
        : intersectElementWithLineSegment(
            bindableElement,
            elementsMap,
            intersector,
            FIXED_BINDING_DISTANCE,
          ).sort(
            (g, h) =>
              pointDistanceSq(g, adjacentPoint) -
              pointDistanceSq(h, adjacentPoint),
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
  element: NonDeleted<ExcalidrawArrowElement>,
  hoveredElement: ExcalidrawBindableElement | null,
  coords: GlobalPoint,
  pointIndex: number,
  elementsMap: ElementsMap,
  customIntersector?: LineSegment<GlobalPoint>,
): GlobalPoint => {
  if (hoveredElement) {
    return bindPointToSnapToElementOutline(
      {
        ...element,
        x: pointIndex === 0 ? coords[0] : element.x,
        y: pointIndex === 0 ? coords[1] : element.y,
        points:
          pointIndex === 0
            ? [
                pointFrom<LocalPoint>(0, 0),
                ...element.points
                  .slice(1)
                  .map((p) =>
                    pointFrom<LocalPoint>(
                      p[0] - (coords[0] - element.x),
                      p[1] - (coords[1] - element.y),
                    ),
                  ),
              ]
            : [
                ...element.points.slice(0, -1),
                pointFrom<LocalPoint>(
                  coords[0] - element.x,
                  coords[1] - element.y,
                ),
              ],
      },
      hoveredElement,
      pointIndex === 0 ? "start" : "end",
      elementsMap,
      customIntersector,
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

export const snapToCenter = (
  element: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
  p: GlobalPoint,
) => {
  const extent = Math.min(element.width, element.height);
  const center = elementCenterPoint(element, elementsMap);
  const nonRotated = pointRotateRads(p, center, -element.angle as Radians);
  if (isRectanguloidElement(element)) {
    if (
      Math.abs(nonRotated[0] - (element.x + element.width / 2)) >
        element.width * 0.9 ||
      Math.abs(nonRotated[1] - (element.y + element.height / 2)) >
        element.height * 0.9
    ) {
      return pointFrom<GlobalPoint>(center[0], center[1]);
    }
  }

  if (element.type === "diamond") {
    const center = elementCenterPoint(element, elementsMap);
    const nonRotated = pointRotateRads(p, center, -element.angle as Radians);
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    const scale = 0.9; // 90% sized inner diamond
    const halfW = (element.width / 2) * scale;
    const halfH = (element.height / 2) * scale;

    if (halfW > 0 && halfH > 0) {
      const dx = Math.abs(nonRotated[0] - cx);
      const dy = Math.abs(nonRotated[1] - cy);
      if (dx / halfW + dy / halfH <= 1) {
        return pointFrom<GlobalPoint>(center[0], center[1]);
      }
    }
  }

  if (pointDistance(nonRotated, center) < extent * 0.5) {
    return pointFrom<GlobalPoint>(center[0], center[1]);
  }
  return p;
};

const snapToMid = (
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
  arrow: NonDeleted<ExcalidrawArrowElement>,
  startOrEnd: "startBinding" | "endBinding",
  binding: FixedPointBinding | null | undefined,
  bindableElement: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
): LocalPoint | null => {
  if (
    binding == null ||
    // We only need to update the other end if this is a 2 point line element
    (binding.elementId !== bindableElement.id && arrow.points.length > 2)
  ) {
    return null;
  }

  const fixedPoint = normalizeFixedPoint(binding.fixedPoint);
  const global = getGlobalFixedPointForBindableElement(
    fixedPoint,
    bindableElement,
    elementsMap,
  );

  const maybeOutlineGlobal =
    binding.mode === "orbit"
      ? getOutlineAvoidingPoint(
          arrow,
          bindableElement,
          global,
          startOrEnd === "startBinding" ? 0 : arrow.points.length - 1,
          elementsMap,
        )
      : global;

  return LinearElementEditor.pointFromAbsoluteCoords(
    arrow,
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
  linearElement: NonDeleted<ExcalidrawArrowElement>,
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
