import {
  KEYS,
  arrayToMap,
  getFeatureFlag,
  invariant,
  isTransparent,
} from "@excalidraw/common";

import {
  PRECISION,
  clamp,
  lineSegment,
  pointDistance,
  pointDistanceSq,
  pointFrom,
  pointFromVector,
  pointRotateRads,
  vectorFromPoint,
  vectorNormalize,
  vectorScale,
  type GlobalPoint,
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
  getAllHoveredElementAtPoint,
  getHoveredElementForBinding,
  intersectElementWithLineSegment,
  isBindableElementInsideOtherBindable,
  isPointInElement,
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
import { projectFixedPointOntoDiagonal } from "./utils";

import type { Scene } from "./Scene";

import type { Bounds } from "./bounds";
import type { ElementUpdate } from "./mutateElement";
import type {
  BindMode,
  ElementsMap,
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElbowArrowElement,
  ExcalidrawElement,
  ExcalidrawTextElement,
  FixedPoint,
  FixedPointBinding,
  NonDeleted,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
  Ordered,
  PointsPositionUpdates,
} from "./types";

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

/**
 * gaps exclude element strokeWidth
 *
 * IMPORTANT: currently must be > 0 (this also applies to the computed gap)
 */
export const BASE_BINDING_GAP = 10;
export const BASE_BINDING_GAP_ELBOW = 5;

export const getBindingGap = (
  bindTarget: ExcalidrawBindableElement,
  opts: Pick<ExcalidrawArrowElement, "elbowed">,
): number => {
  return (
    (opts.elbowed ? BASE_BINDING_GAP_ELBOW : BASE_BINDING_GAP) +
    bindTarget.strokeWidth / 2
  );
};

export const maxBindingDistance_simple = (zoom?: AppState["zoom"]): number => {
  const BASE_BINDING_DISTANCE = Math.max(BASE_BINDING_GAP, 15);
  const zoomValue = zoom?.value && zoom.value < 1 ? zoom.value : 1;
  return clamp(
    // reducing zoom impact so that the diff between binding distance and
    // binding gap is kept to minimum when possible
    BASE_BINDING_DISTANCE / (zoomValue * 1.5),
    BASE_BINDING_DISTANCE,
    BASE_BINDING_DISTANCE * 2,
  );
};

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
    newArrow?: boolean;
    altKey?: boolean;
    angleLocked?: boolean;
    initialBinding?: boolean;
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
      finalize: true,
    },
  );

  bindOrUnbindBindingElementEdge(arrow, start, "start", scene);
  bindOrUnbindBindingElementEdge(arrow, end, "end", scene);
  if (start.focusPoint || end.focusPoint) {
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

const bindingStrategyForElbowArrowEndpointDragging = (
  arrow: NonDeleted<ExcalidrawArrowElement>,
  draggingPoints: PointsPositionUpdates,
  elementsMap: NonDeletedSceneElementsMap,
  elements: readonly Ordered<NonDeletedExcalidrawElement>[],
  zoom?: AppState["zoom"],
): {
  start: BindingStrategy;
  end: BindingStrategy;
} => {
  invariant(draggingPoints.size === 1, "Bound elbow arrows cannot be moved");

  const update = draggingPoints.entries().next().value;

  invariant(
    update,
    "There should be a position update for dragging an elbow arrow endpoint",
  );

  const [pointIdx, { point }] = update;
  const globalPoint = LinearElementEditor.getPointGlobalCoordinates(
    arrow,
    point,
    elementsMap,
  );
  const hit = getHoveredElementForBinding(
    globalPoint,
    elements,
    elementsMap,
    (element) => maxBindingDistance_simple(zoom),
  );

  const current = hit
    ? {
        element: hit,
        mode: "orbit" as const,
        focusPoint: LinearElementEditor.getPointAtIndexGlobalCoordinates(
          arrow,
          pointIdx,
          elementsMap,
        ),
      }
    : {
        mode: null,
      };
  const other = { mode: undefined };

  return pointIdx === 0
    ? { start: current, end: other }
    : { start: other, end: current };
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
  shiftKey?: boolean,
): {
  start: BindingStrategy;
  end: BindingStrategy;
} => {
  let start: BindingStrategy = { mode: undefined };
  let end: BindingStrategy = { mode: undefined };

  const isMultiPoint = arrow.points.length > 2;
  const point = LinearElementEditor.getPointGlobalCoordinates(
    arrow,
    draggingPoints.get(startDragged ? startIdx : endIdx)!.point,
    elementsMap,
  );
  const hit = getHoveredElementForBinding(point, elements, elementsMap);

  // With new arrows this handles the binding at arrow creation
  if (startDragged) {
    if (hit) {
      start = {
        element: hit,
        mode: "inside",
        focusPoint: point,
      };
    } else {
      start = { mode: null };
    }

    return { start, end };
  }

  // With new arrows it represents the continuous dragging of the end point
  if (endDragged) {
    const origin = appState?.selectedLinearElement?.initialState.origin;

    // Inside -> inside binding
    if (hit && arrow.startBinding?.elementId === hit.id) {
      const center = pointFrom<GlobalPoint>(
        hit.x + hit.width / 2,
        hit.y + hit.height / 2,
      );

      return {
        start: isMultiPoint
          ? { mode: undefined }
          : {
              mode: "inside",
              element: hit,
              focusPoint: origin ?? center,
            },
        end: isMultiPoint
          ? { mode: "orbit", element: hit, focusPoint: point }
          : { mode: "inside", element: hit, focusPoint: point },
      };
    }

    // Check and handle nested shapes
    if (hit && arrow.startBinding) {
      const startBinding = arrow.startBinding;
      const allHits = getAllHoveredElementAtPoint(point, elements, elementsMap);

      if (allHits.find((el) => el.id === startBinding.elementId)) {
        const otherElement = elementsMap.get(
          arrow.startBinding.elementId,
        ) as ExcalidrawBindableElement;

        invariant(otherElement, "Other element must be in the elements map");

        return {
          start: isMultiPoint
            ? { mode: undefined }
            : {
                mode: otherElement.id !== hit.id ? "orbit" : "inside",
                element: otherElement,
                focusPoint: origin ?? pointFrom<GlobalPoint>(arrow.x, arrow.y),
              },
          end: {
            mode: "orbit",
            element: hit,
            focusPoint: point,
          },
        };
      }
    }

    // Inside -> outside binding
    if (arrow.startBinding && arrow.startBinding.elementId !== hit?.id) {
      const otherElement = elementsMap.get(
        arrow.startBinding.elementId,
      ) as ExcalidrawBindableElement;
      invariant(otherElement, "Other element must be in the elements map");

      const otherIsInsideBinding =
        !!appState.selectedLinearElement?.initialState.arrowStartIsInside;
      const other: BindingStrategy = {
        mode: otherIsInsideBinding ? "inside" : "orbit",
        element: otherElement,
        focusPoint: shiftKey
          ? elementCenterPoint(otherElement, elementsMap)
          : origin ?? pointFrom<GlobalPoint>(arrow.x, arrow.y),
      };

      // We are hovering another element with the end point
      const isNested =
        hit &&
        isBindableElementInsideOtherBindable(otherElement, hit, elementsMap);
      let current: BindingStrategy;
      if (hit) {
        const isInsideBinding =
          globalBindMode === "inside" || globalBindMode === "skip";
        current = {
          mode: isInsideBinding && !isNested ? "inside" : "orbit",
          element: hit,
          focusPoint: isInsideBinding || isNested ? point : point,
        };
      } else {
        current = { mode: null };
      }

      return {
        start: isMultiPoint ? { mode: undefined } : other,
        end: current,
      };
    }

    // No start binding
    if (!arrow.startBinding) {
      if (hit) {
        const isInsideBinding =
          globalBindMode === "inside" || globalBindMode === "skip";

        end = {
          mode: isInsideBinding ? "inside" : "orbit",
          element: hit,
          focusPoint: point,
        };
      } else {
        end = { mode: null };
      }

      return { start, end };
    }
  }

  invariant(false, "New arrow creation should not reach here");
};

const bindingStrategyForSimpleArrowEndpointDragging_complex = (
  point: GlobalPoint,
  currentBinding: FixedPointBinding | null,
  oppositeBinding: FixedPointBinding | null,
  elementsMap: NonDeletedSceneElementsMap,
  elements: readonly Ordered<NonDeletedExcalidrawElement>[],
  globalBindMode: AppState["bindMode"],
  arrow: NonDeleted<ExcalidrawArrowElement>,
  finalize?: boolean,
): { current: BindingStrategy; other: BindingStrategy } => {
  let current: BindingStrategy = { mode: undefined };
  let other: BindingStrategy = { mode: undefined };

  const isMultiPoint = arrow.points.length > 2;
  const hit = getHoveredElementForBinding(point, elements, elementsMap);
  const isOverlapping = oppositeBinding
    ? getAllHoveredElementAtPoint(point, elements, elementsMap).some(
        (el) => el.id === oppositeBinding.elementId,
      )
    : false;
  const oppositeElement = oppositeBinding
    ? (elementsMap.get(oppositeBinding.elementId) as ExcalidrawBindableElement)
    : null;
  const otherIsTransparent =
    isOverlapping && oppositeElement
      ? isTransparent(oppositeElement.backgroundColor)
      : false;
  const isNested =
    hit &&
    oppositeElement &&
    isBindableElementInsideOtherBindable(oppositeElement, hit, elementsMap);

  // If the global bind mode is in free binding mode, just bind
  // where the pointer is and keep the other end intact
  if (globalBindMode === "inside" || globalBindMode === "skip") {
    current = hit
      ? {
          element:
            !isOverlapping || !oppositeElement || otherIsTransparent
              ? hit
              : oppositeElement,
          focusPoint: point,
          mode: "inside",
        }
      : { mode: null };
    other =
      finalize && hit && hit.id === oppositeBinding?.elementId
        ? { mode: null }
        : other;

    return { current, other };
  }

  // Dragged point is outside of any bindable element
  // so we break any existing binding
  if (!hit) {
    return { current: { mode: null }, other };
  }

  // Already inside binding over the same hit element should remain inside bound
  if (
    hit.id === currentBinding?.elementId &&
    currentBinding.mode === "inside"
  ) {
    return {
      current: { mode: "inside", focusPoint: point, element: hit },
      other,
    };
  }

  // The dragged point is inside the hovered bindable element
  if (oppositeBinding) {
    // The opposite binding is on the same element
    if (oppositeBinding.elementId === hit.id) {
      // The opposite binding is on the binding gap of the same element
      if (oppositeBinding.mode === "orbit") {
        current = { element: hit, mode: "orbit", focusPoint: point };
        other = { mode: finalize ? null : undefined };

        return { current, other: isMultiPoint ? { mode: undefined } : other };
      }
      // The opposite binding is inside the same element
      // eslint-disable-next-line no-else-return
      else {
        current = { element: hit, mode: "inside", focusPoint: point };

        return { current, other: isMultiPoint ? { mode: undefined } : other };
      }
    }
    // The opposite binding is on a different element (or nested)
    // eslint-disable-next-line no-else-return
    else {
      // Handle the nested element case
      if (isOverlapping && oppositeElement && !otherIsTransparent) {
        current = {
          element: oppositeElement,
          mode: "inside",
          focusPoint: point,
        };
      } else {
        current = {
          element: hit,
          mode: "orbit",
          focusPoint: isNested ? point : point,
        };
      }

      return { current, other: isMultiPoint ? { mode: undefined } : other };
    }
  }
  // The opposite binding is on a different element or no binding
  else {
    current = {
      element: hit,
      mode: "orbit",
      focusPoint: point,
    };
  }

  // Must return as only one endpoint is dragged, therefore
  // the end binding strategy might accidentally gets overriden
  return { current, other: isMultiPoint ? { mode: undefined } : other };
};

export const getBindingStrategyForDraggingBindingElementEndpoints = (
  arrow: NonDeleted<ExcalidrawArrowElement>,
  draggingPoints: PointsPositionUpdates,
  elementsMap: NonDeletedSceneElementsMap,
  elements: readonly Ordered<NonDeletedExcalidrawElement>[],
  appState: AppState,
  opts?: {
    newArrow?: boolean;
    angleLocked?: boolean;
    altKey?: boolean;
    finalize?: boolean;
    initialBinding?: boolean;
    zoom?: AppState["zoom"];
  },
): { start: BindingStrategy; end: BindingStrategy } => {
  if (getFeatureFlag("COMPLEX_BINDINGS")) {
    return getBindingStrategyForDraggingBindingElementEndpoints_complex(
      arrow,
      draggingPoints,
      elementsMap,
      elements,
      appState,
      opts,
    );
  }

  return getBindingStrategyForDraggingBindingElementEndpoints_simple(
    arrow,
    draggingPoints,
    elementsMap,
    elements,
    appState,
    opts,
  );
};

const getBindingStrategyForDraggingBindingElementEndpoints_simple = (
  arrow: NonDeleted<ExcalidrawArrowElement>,
  draggingPoints: PointsPositionUpdates,
  elementsMap: NonDeletedSceneElementsMap,
  elements: readonly Ordered<NonDeletedExcalidrawElement>[],
  appState: AppState,
  opts?: {
    newArrow?: boolean;
    angleLocked?: boolean;
    altKey?: boolean;
    finalize?: boolean;
    initialBinding?: boolean;
    zoom?: AppState["zoom"];
  },
): { start: BindingStrategy; end: BindingStrategy } => {
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

  // Handle simpler elbow arrow binding
  if (isElbowArrow(arrow)) {
    return bindingStrategyForElbowArrowEndpointDragging(
      arrow,
      draggingPoints,
      elementsMap,
      elements,
      opts?.zoom,
    );
  }

  const otherBinding = startDragged ? arrow.endBinding : arrow.startBinding;
  const localPoint = draggingPoints.get(
    startDragged ? startIdx : endIdx,
  )?.point;
  invariant(
    localPoint,
    `Local point must be defined for ${
      startDragged ? "start" : "end"
    } dragging`,
  );
  const globalPoint = LinearElementEditor.getPointGlobalCoordinates(
    arrow,
    localPoint,
    elementsMap,
  );
  const hit = getHoveredElementForBinding(
    globalPoint,
    elements,
    elementsMap,
    (e) => maxBindingDistance_simple(appState.zoom),
  );
  const pointInElement = hit && isPointInElement(globalPoint, hit, elementsMap);
  const otherBindableElement = otherBinding
    ? (elementsMap.get(
        otherBinding.elementId,
      ) as NonDeleted<ExcalidrawBindableElement>)
    : undefined;
  const otherFocusPoint =
    otherBinding &&
    otherBindableElement &&
    getGlobalFixedPointForBindableElement(
      otherBinding.fixedPoint,
      otherBindableElement,
      elementsMap,
    );
  const otherFocusPointIsInElement =
    otherBindableElement &&
    otherFocusPoint &&
    isPointInElement(otherFocusPoint, otherBindableElement, elementsMap);

  // Handle outside-outside binding to the same element
  if (otherBinding && otherBinding.elementId === hit?.id) {
    invariant(
      !opts?.newArrow || appState.selectedLinearElement?.initialState.origin,
      "appState.selectedLinearElement.initialState.origin must be defined for new arrows",
    );

    return {
      start: {
        mode: "inside",
        element: hit,
        focusPoint: startDragged
          ? globalPoint
          : // NOTE: Can only affect the start point because new arrows always drag the end point
          opts?.newArrow
          ? appState.selectedLinearElement!.initialState.origin!
          : LinearElementEditor.getPointAtIndexGlobalCoordinates(
              arrow,
              0,
              elementsMap,
            ), // startFixedPoint,
      },
      end: {
        mode: "inside",
        element: hit,
        focusPoint: endDragged
          ? globalPoint
          : LinearElementEditor.getPointAtIndexGlobalCoordinates(
              arrow,
              -1,
              elementsMap,
            ), // endFixedPoint
      },
    };
  }

  // Handle special alt key case to inside bind no matter what
  if (opts?.altKey) {
    return {
      start: startDragged
        ? hit
          ? {
              mode: "inside",
              element: hit,
              focusPoint: globalPoint,
            }
          : { mode: null }
        : start,
      end: endDragged
        ? hit
          ? {
              mode: "inside",
              element: hit,
              focusPoint: globalPoint,
            }
          : { mode: null }
        : end,
    };
  }

  // Handle normal cases
  const current: BindingStrategy = hit
    ? pointInElement
      ? {
          mode: "inside",
          element: hit,
          focusPoint: globalPoint,
        }
      : {
          mode: "orbit",
          element: hit,
          focusPoint:
            projectFixedPointOntoDiagonal(
              arrow,
              globalPoint,
              hit,
              startDragged ? "start" : "end",
              elementsMap,
            ) || globalPoint,
        }
    : { mode: null };

  const otherEndpoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    arrow,
    startDragged ? -1 : 0,
    elementsMap,
  );

  const other: BindingStrategy =
    otherBindableElement &&
    !otherFocusPointIsInElement &&
    appState.selectedLinearElement?.initialState.altFocusPoint
      ? {
          mode: "orbit",
          element: otherBindableElement,
          focusPoint: appState.selectedLinearElement.initialState.altFocusPoint,
        }
      : opts?.angleLocked && otherBindableElement
      ? {
          mode: "orbit",
          element: otherBindableElement,
          focusPoint:
            projectFixedPointOntoDiagonal(
              arrow,
              otherEndpoint,
              otherBindableElement,
              startDragged ? "end" : "start",
              elementsMap,
            ) || otherEndpoint,
        }
      : { mode: undefined };

  return {
    start: startDragged ? current : other,
    end: endDragged ? current : other,
  };
};

const getBindingStrategyForDraggingBindingElementEndpoints_complex = (
  arrow: NonDeleted<ExcalidrawArrowElement>,
  draggingPoints: PointsPositionUpdates,
  elementsMap: NonDeletedSceneElementsMap,
  elements: readonly Ordered<NonDeletedExcalidrawElement>[],
  appState: AppState,
  opts?: {
    newArrow?: boolean;
    shiftKey?: boolean;
    finalize?: boolean;
    initialBinding?: boolean;
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

  // Handle simpler elbow arrow binding
  if (isElbowArrow(arrow)) {
    return bindingStrategyForElbowArrowEndpointDragging(
      arrow,
      draggingPoints,
      elementsMap,
      elements,
    );
  }

  // Handle new arrow creation separately, as it is special
  if (opts?.newArrow) {
    const { start, end } = bindingStrategyForNewSimpleArrowEndpointDragging(
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
      opts?.shiftKey,
    );

    return { start, end };
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

    const { current, other } =
      bindingStrategyForSimpleArrowEndpointDragging_complex(
        globalPoint,
        arrow.startBinding,
        arrow.endBinding,
        elementsMap,
        elements,
        globalBindMode,
        arrow,
        opts?.finalize,
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
    const { current, other } =
      bindingStrategyForSimpleArrowEndpointDragging_complex(
        globalPoint,
        arrow.endBinding,
        arrow.startBinding,
        elementsMap,
        elements,
        globalBindMode,
        arrow,
        opts?.finalize,
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
            changedElement.id ===
              element[
                bindingProp === "startBinding" ? "endBinding" : "startBinding"
              ]?.elementId)
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
  const bindDistance = maxBindingDistance_simple(zoom);

  return distance > bindDistance ? null : distance;
};

export const bindPointToSnapToElementOutline = (
  arrowElement: ExcalidrawArrowElement,
  bindableElement: ExcalidrawBindableElement,
  startOrEnd: "start" | "end",
  elementsMap: ElementsMap,
  customIntersector?: LineSegment<GlobalPoint>,
): GlobalPoint => {
  const elbowed = isElbowArrow(arrowElement);
  const point = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    arrowElement,
    startOrEnd === "start" ? 0 : -1,
    elementsMap,
  );

  if (arrowElement.points.length < 2) {
    // New arrow creation, so no snapping
    return point;
  }

  const edgePoint =
    isRectanguloidElement(bindableElement) && elbowed
      ? avoidRectangularCorner(
          arrowElement,
          bindableElement,
          elementsMap,
          point,
        )
      : point;
  const adjacentPoint =
    customIntersector && !elbowed
      ? customIntersector[1]
      : LinearElementEditor.getPointAtIndexGlobalCoordinates(
          arrowElement,
          startOrEnd === "start" ? 1 : -2,
          elementsMap,
        );
  const bindingGap = getBindingGap(bindableElement, arrowElement);
  const aabb = aabbForElement(bindableElement, elementsMap);
  const bindableCenter = getCenterForBounds(aabb);

  let intersection: GlobalPoint | null = null;
  if (elbowed) {
    const isHorizontal = headingIsHorizontal(
      headingForPointFromElement(bindableElement, aabb, point),
    );
    const snapPoint = snapToMid(
      arrowElement,
      bindableElement,
      elementsMap,
      edgePoint,
    );
    const otherPoint = pointFrom<GlobalPoint>(
      isHorizontal ? bindableCenter[0] : snapPoint[0],
      !isHorizontal ? bindableCenter[1] : snapPoint[1],
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
      bindingGap,
    ).sort(pointDistanceSq)[0];

    if (!intersection) {
      const anotherPoint = pointFrom<GlobalPoint>(
        !isHorizontal ? bindableCenter[0] : snapPoint[0],
        isHorizontal ? bindableCenter[1] : snapPoint[1],
      );
      const anotherIntersector = lineSegment(
        anotherPoint,
        pointFromVector(
          vectorScale(
            vectorNormalize(vectorFromPoint(snapPoint, anotherPoint)),
            Math.max(bindableElement.width, bindableElement.height) * 2,
          ),
          anotherPoint,
        ),
      );
      intersection = intersectElementWithLineSegment(
        bindableElement,
        elementsMap,
        anotherIntersector,
        BASE_BINDING_GAP_ELBOW,
      ).sort(pointDistanceSq)[0];
    }
  } else {
    let intersector = customIntersector;
    if (!intersector) {
      const halfVector = vectorScale(
        vectorNormalize(vectorFromPoint(edgePoint, adjacentPoint)),
        pointDistance(edgePoint, adjacentPoint) +
          Math.max(bindableElement.width, bindableElement.height) +
          bindingGap * 2,
      );
      intersector =
        customIntersector ??
        lineSegment(
          pointFromVector(halfVector, adjacentPoint),
          pointFromVector(vectorScale(halfVector, -1), adjacentPoint),
        );
    }

    intersection =
      pointDistance(edgePoint, adjacentPoint) < 1
        ? edgePoint
        : intersectElementWithLineSegment(
            bindableElement,
            elementsMap,
            intersector,
            bindingGap,
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

export const avoidRectangularCorner = (
  arrowElement: ExcalidrawArrowElement,
  bindTarget: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
  p: GlobalPoint,
): GlobalPoint => {
  const center = elementCenterPoint(bindTarget, elementsMap);
  const nonRotatedPoint = pointRotateRads(
    p,
    center,
    -bindTarget.angle as Radians,
  );

  const bindingGap = getBindingGap(bindTarget, arrowElement);

  if (nonRotatedPoint[0] < bindTarget.x && nonRotatedPoint[1] < bindTarget.y) {
    // Top left
    if (nonRotatedPoint[1] - bindTarget.y > -bindingGap) {
      return pointRotateRads<GlobalPoint>(
        pointFrom(bindTarget.x - bindingGap, bindTarget.y),
        center,
        bindTarget.angle,
      );
    }
    return pointRotateRads(
      pointFrom(bindTarget.x, bindTarget.y - bindingGap),
      center,
      bindTarget.angle,
    );
  } else if (
    nonRotatedPoint[0] < bindTarget.x &&
    nonRotatedPoint[1] > bindTarget.y + bindTarget.height
  ) {
    // Bottom left
    if (nonRotatedPoint[0] - bindTarget.x > -bindingGap) {
      return pointRotateRads(
        pointFrom(bindTarget.x, bindTarget.y + bindTarget.height + bindingGap),
        center,
        bindTarget.angle,
      );
    }
    return pointRotateRads(
      pointFrom(bindTarget.x - bindingGap, bindTarget.y + bindTarget.height),
      center,
      bindTarget.angle,
    );
  } else if (
    nonRotatedPoint[0] > bindTarget.x + bindTarget.width &&
    nonRotatedPoint[1] > bindTarget.y + bindTarget.height
  ) {
    // Bottom right
    if (nonRotatedPoint[0] - bindTarget.x < bindTarget.width + bindingGap) {
      return pointRotateRads(
        pointFrom(
          bindTarget.x + bindTarget.width,
          bindTarget.y + bindTarget.height + bindingGap,
        ),
        center,
        bindTarget.angle,
      );
    }
    return pointRotateRads(
      pointFrom(
        bindTarget.x + bindTarget.width + bindingGap,
        bindTarget.y + bindTarget.height,
      ),
      center,
      bindTarget.angle,
    );
  } else if (
    nonRotatedPoint[0] > bindTarget.x + bindTarget.width &&
    nonRotatedPoint[1] < bindTarget.y
  ) {
    // Top right
    if (nonRotatedPoint[0] - bindTarget.x < bindTarget.width + bindingGap) {
      return pointRotateRads(
        pointFrom(bindTarget.x + bindTarget.width, bindTarget.y - bindingGap),
        center,
        bindTarget.angle,
      );
    }
    return pointRotateRads(
      pointFrom(bindTarget.x + bindTarget.width + bindingGap, bindTarget.y),
      center,
      bindTarget.angle,
    );
  }

  return p;
};

const snapToMid = (
  arrowElement: ExcalidrawArrowElement,
  bindTarget: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
  p: GlobalPoint,
  tolerance: number = 0.05,
): GlobalPoint => {
  const { x, y, width, height, angle } = bindTarget;
  const center = elementCenterPoint(bindTarget, elementsMap, -0.1, -0.1);
  const nonRotated = pointRotateRads(p, center, -angle as Radians);

  const bindingGap = getBindingGap(bindTarget, arrowElement);

  // snap-to-center point is adaptive to element size, but we don't want to go
  // above and below certain px distance
  const verticalThreshold = clamp(tolerance * height, 5, 80);
  const horizontalThreshold = clamp(tolerance * width, 5, 80);

  // Too close to the center makes it hard to resolve direction precisely
  if (pointDistance(center, nonRotated) < bindingGap) {
    return p;
  }

  if (
    nonRotated[0] <= x + width / 2 &&
    nonRotated[1] > center[1] - verticalThreshold &&
    nonRotated[1] < center[1] + verticalThreshold
  ) {
    // LEFT
    return pointRotateRads<GlobalPoint>(
      pointFrom(x - bindingGap, center[1]),
      center,
      angle,
    );
  } else if (
    nonRotated[1] <= y + height / 2 &&
    nonRotated[0] > center[0] - horizontalThreshold &&
    nonRotated[0] < center[0] + horizontalThreshold
  ) {
    // TOP
    return pointRotateRads(pointFrom(center[0], y - bindingGap), center, angle);
  } else if (
    nonRotated[0] >= x + width / 2 &&
    nonRotated[1] > center[1] - verticalThreshold &&
    nonRotated[1] < center[1] + verticalThreshold
  ) {
    // RIGHT
    return pointRotateRads(
      pointFrom(x + width + bindingGap, center[1]),
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
      pointFrom(center[0], y + height + bindingGap),
      center,
      angle,
    );
  } else if (bindTarget.type === "diamond") {
    const distance = bindingGap;
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

const compareElementArea = (
  a: ExcalidrawBindableElement,
  b: ExcalidrawBindableElement,
) => b.width ** 2 + b.height ** 2 - (a.width ** 2 + a.height ** 2);

export const updateBoundPoint = (
  arrow: NonDeleted<ExcalidrawArrowElement>,
  startOrEnd: "startBinding" | "endBinding",
  binding: FixedPointBinding | null | undefined,
  bindableElement: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
  customIntersector?: LineSegment<GlobalPoint>,
): LocalPoint | null => {
  if (
    binding == null ||
    // We only need to update the other end if this is a 2 point line element
    (binding.elementId !== bindableElement.id && arrow.points.length > 2)
  ) {
    return null;
  }

  const global = getGlobalFixedPointForBindableElement(
    normalizeFixedPoint(binding.fixedPoint),
    bindableElement,
    elementsMap,
  );
  const pointIndex =
    startOrEnd === "startBinding" ? 0 : arrow.points.length - 1;
  const elbowed = isElbowArrow(arrow);
  const otherBinding =
    startOrEnd === "startBinding" ? arrow.endBinding : arrow.startBinding;
  const otherBindableElement =
    otherBinding &&
    (elementsMap.get(otherBinding.elementId)! as ExcalidrawBindableElement);
  const bounds = getElementBounds(bindableElement, elementsMap);
  const otherBounds =
    otherBindableElement && getElementBounds(otherBindableElement, elementsMap);
  const isLargerThanOther =
    otherBindableElement &&
    compareElementArea(bindableElement, otherBindableElement) <
      // if both shapes the same size, pretend the other is larger
      (startOrEnd === "endBinding" ? 1 : 0);
  const isOverlapping = otherBounds && doBoundsIntersect(bounds, otherBounds);

  // GOAL: If the arrow becomes too short, we want to jump the arrow endpoints
  // to the exact focus points on the elements.
  // INTUITION: We're not interested in the exacts length of the arrow (which
  // will change if we change where we route it), we want to know the length of
  // the part which lies outside of both shapes and consider that as a trigger
  // to change where we point the arrow. Avoids jumping the arrow in and out
  // at every frame.
  let arrowTooShort = false;
  if (
    !isOverlapping &&
    !elbowed &&
    arrow.startBinding &&
    arrow.endBinding &&
    otherBindableElement &&
    arrow.points.length === 2
  ) {
    const startFocusPoint = getGlobalFixedPointForBindableElement(
      arrow.startBinding.fixedPoint,
      startOrEnd === "startBinding" ? bindableElement : otherBindableElement,
      elementsMap,
    );
    const endFocusPoint = getGlobalFixedPointForBindableElement(
      arrow.endBinding.fixedPoint,
      startOrEnd === "endBinding" ? bindableElement : otherBindableElement,
      elementsMap,
    );
    const segment = lineSegment(startFocusPoint, endFocusPoint);
    const startIntersection = intersectElementWithLineSegment(
      startOrEnd === "endBinding" ? bindableElement : otherBindableElement,
      elementsMap,
      segment,
      0,
      true,
    );
    const endIntersection = intersectElementWithLineSegment(
      startOrEnd === "startBinding" ? bindableElement : otherBindableElement,
      elementsMap,
      segment,
      0,
      true,
    );
    if (startIntersection.length > 0 && endIntersection.length > 0) {
      const len = pointDistance(startIntersection[0], endIntersection[0]);
      arrowTooShort = len < 40;
    }
  }

  const isNested = (arrowTooShort || isOverlapping) && isLargerThanOther;

  let _customIntersector = customIntersector;
  if (!elbowed && !_customIntersector) {
    const [x1, y1, x2, y2] = LinearElementEditor.getElementAbsoluteCoords(
      arrow,
      elementsMap,
    );
    const center = pointFrom<GlobalPoint>((x1 + x2) / 2, (y1 + y2) / 2);
    const edgePoint = isRectanguloidElement(bindableElement)
      ? avoidRectangularCorner(arrow, bindableElement, elementsMap, global)
      : global;
    const adjacentPoint = pointRotateRads(
      pointFrom<GlobalPoint>(
        arrow.x +
          arrow.points[pointIndex === 0 ? 1 : arrow.points.length - 2][0],
        arrow.y +
          arrow.points[pointIndex === 0 ? 1 : arrow.points.length - 2][1],
      ),
      center,
      arrow.angle as Radians,
    );
    const bindingGap = getBindingGap(bindableElement, arrow);
    const halfVector = vectorScale(
      vectorNormalize(vectorFromPoint(edgePoint, adjacentPoint)),
      pointDistance(edgePoint, adjacentPoint) +
        Math.max(bindableElement.width, bindableElement.height) +
        bindingGap * 2,
    );
    _customIntersector = lineSegment(
      pointFromVector(halfVector, adjacentPoint),
      pointFromVector(vectorScale(halfVector, -1), adjacentPoint),
    );
  }

  const maybeOutlineGlobal =
    binding.mode === "orbit" && bindableElement
      ? isNested
        ? global
        : bindPointToSnapToElementOutline(
            {
              ...arrow,
              points: [
                pointIndex === 0
                  ? LinearElementEditor.createPointAt(
                      arrow,
                      elementsMap,
                      global[0],
                      global[1],
                      null,
                    )
                  : arrow.points[0],
                ...arrow.points.slice(1, -1),
                pointIndex === arrow.points.length - 1
                  ? LinearElementEditor.createPointAt(
                      arrow,
                      elementsMap,
                      global[0],
                      global[1],
                      null,
                    )
                  : arrow.points[arrow.points.length - 1],
              ],
            },
            bindableElement,
            pointIndex === 0 ? "start" : "end",
            elementsMap,
            _customIntersector,
          )
      : global;

  return LinearElementEditor.createPointAt(
    arrow,
    elementsMap,
    maybeOutlineGlobal[0],
    maybeOutlineGlobal[1],
    null,
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
  fixedPointRatio: FixedPoint,
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
