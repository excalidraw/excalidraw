import { isShallowEqual } from "@excalidraw/common";

import { getNormalizedZoom } from "./normalize";

import type {
  AnimateTranslateCanvasValues,
  AppState,
  ScrollConstraints,
} from "../types";

// Constants for viewport zoom factor and overscroll allowance
const MIN_VIEWPORT_ZOOM_FACTOR = 0.1;
const MAX_VIEWPORT_ZOOM_FACTOR = 1;
const DEFAULT_VIEWPORT_ZOOM_FACTOR = 0.2;
const DEFAULT_OVERSCROLL_ALLOWANCE = 0.2;

// Memoization variable to cache constraints for performance optimization
let memoizedValues: {
  previousState: Pick<
    AppState,
    "zoom" | "width" | "height" | "scrollConstraints"
  >;
  constraints: ReturnType<typeof calculateConstraints>;
  allowOverscroll: boolean;
} | null = null;

type CanvasTranslate = Pick<AppState, "scrollX" | "scrollY" | "zoom">;

/**
 * Calculates the zoom levels necessary to fit the constrained scrollable area within the viewport on the X and Y axes.
 *
 * The function considers the dimensions of the scrollable area, the dimensions of the viewport, the viewport zoom factor,
 * and whether the zoom should be locked. It then calculates the necessary zoom levels for the X and Y axes separately.
 * If the zoom should be locked, it calculates the maximum zoom level that fits the scrollable area within the viewport,
 * factoring in the viewport zoom factor. If the zoom should not be locked, the maximum zoom level is set to null.
 *
 * @param scrollConstraints - The constraints of the scrollable area including width, height, and position.
 * @param width - The width of the viewport.
 * @param height - The height of the viewport.
 * @returns An object containing the calculated zoom levels for the X and Y axes, and the initial zoom level.
 */
const calculateZoomLevel = (
  scrollConstraints: ScrollConstraints,
  width: AppState["width"],
  height: AppState["height"],
) => {
  const viewportZoomFactor = scrollConstraints.viewportZoomFactor
    ? Math.min(
        MAX_VIEWPORT_ZOOM_FACTOR,
        Math.max(
          scrollConstraints.viewportZoomFactor,
          MIN_VIEWPORT_ZOOM_FACTOR,
        ),
      )
    : DEFAULT_VIEWPORT_ZOOM_FACTOR;

  const scrollableWidth = scrollConstraints.width;
  const scrollableHeight = scrollConstraints.height;
  const zoomLevelX = width / scrollableWidth;
  const zoomLevelY = height / scrollableHeight;
  const initialZoomLevel = getNormalizedZoom(
    Math.min(zoomLevelX, zoomLevelY) * viewportZoomFactor,
  );
  return { zoomLevelX, zoomLevelY, initialZoomLevel };
};

/**
 * Calculates the effective zoom level based on the scroll constraints and current zoom.
 *
 * @param params - Object containing scrollConstraints, width, height, and zoom.
 * @returns An object with the effective zoom level, initial zoom level, and zoom levels for X and Y axes.
 */
const calculateZoom = ({
  scrollConstraints,
  width,
  height,
  zoom,
}: {
  scrollConstraints: ScrollConstraints;
  width: AppState["width"];
  height: AppState["height"];
  zoom: AppState["zoom"];
}) => {
  const { zoomLevelX, zoomLevelY, initialZoomLevel } = calculateZoomLevel(
    scrollConstraints,
    width,
    height,
  );
  const effectiveZoom = scrollConstraints.lockZoom
    ? Math.max(initialZoomLevel, zoom.value)
    : zoom.value;
  return {
    effectiveZoom: getNormalizedZoom(effectiveZoom),
    initialZoomLevel,
    zoomLevelX,
    zoomLevelY,
  };
};

/**
 * Calculates the scroll bounds (min and max scroll values) based on the scroll constraints and zoom level.
 *
 * @param params - Object containing scrollConstraints, width, height, effectiveZoom, zoomLevelX, zoomLevelY, and allowOverscroll.
 * @returns An object with min and max scroll values for X and Y axes.
 */
const calculateScrollBounds = ({
  scrollConstraints,
  width,
  height,
  effectiveZoom,
  zoomLevelX,
  zoomLevelY,
  allowOverscroll,
}: {
  scrollConstraints: ScrollConstraints;
  width: AppState["width"];
  height: AppState["height"];
  effectiveZoom: number;
  zoomLevelX: number;
  zoomLevelY: number;
  allowOverscroll: boolean;
}) => {
  const overscrollAllowance =
    scrollConstraints.overscrollAllowance ?? DEFAULT_OVERSCROLL_ALLOWANCE;
  const validatedOverscroll = Math.min(Math.max(overscrollAllowance, 0), 1);

  const calculateCenter = (zoom: number) => {
    const centerX =
      scrollConstraints.x + (scrollConstraints.width - width / zoom) / -2;
    const centerY =
      scrollConstraints.y + (scrollConstraints.height - height / zoom) / -2;
    return { centerX, centerY };
  };

  const { centerX, centerY } = calculateCenter(effectiveZoom);

  const overscrollValue = Math.min(
    validatedOverscroll * scrollConstraints.width,
    validatedOverscroll * scrollConstraints.height,
  );

  const fitsX = effectiveZoom <= zoomLevelX;
  const fitsY = effectiveZoom <= zoomLevelY;

  const getScrollRange = (
    axis: "x" | "y",
    fits: boolean,
    constraint: ScrollConstraints,
    viewportSize: number,
    zoom: number,
    overscroll: number,
  ) => {
    const { pos, size } =
      axis === "x"
        ? { pos: constraint.x, size: constraint.width }
        : { pos: constraint.y, size: constraint.height };
    const center = axis === "x" ? centerX : centerY;
    if (allowOverscroll) {
      return fits
        ? { min: center - overscroll, max: center + overscroll }
        : {
            min: pos - size + viewportSize / zoom - overscroll,
            max: pos + overscroll,
          };
    }
    return fits
      ? { min: center, max: center }
      : { min: pos - size + viewportSize / zoom, max: pos };
  };

  const xRange = getScrollRange(
    "x",
    fitsX,
    scrollConstraints,
    width,
    effectiveZoom,
    overscrollValue,
  );
  const yRange = getScrollRange(
    "y",
    fitsY,
    scrollConstraints,
    height,
    effectiveZoom,
    overscrollValue,
  );

  return {
    minScrollX: xRange.min,
    maxScrollX: xRange.max,
    minScrollY: yRange.min,
    maxScrollY: yRange.max,
  };
};

/**
 * Calculates the scroll constraints including min and max scroll values and the effective zoom level.
 *
 * @param params - Object containing scrollConstraints, width, height, zoom, and allowOverscroll.
 * @returns An object with min and max scroll values, effective zoom, and initial zoom level.
 */
const calculateConstraints = ({
  scrollConstraints,
  width,
  height,
  zoom,
  allowOverscroll,
}: {
  scrollConstraints: ScrollConstraints;
  width: AppState["width"];
  height: AppState["height"];
  zoom: AppState["zoom"];
  allowOverscroll: boolean;
}) => {
  const { effectiveZoom, initialZoomLevel, zoomLevelX, zoomLevelY } =
    calculateZoom({ scrollConstraints, width, height, zoom });
  const scrollBounds = calculateScrollBounds({
    scrollConstraints,
    width,
    height,
    effectiveZoom,
    zoomLevelX,
    zoomLevelY,
    allowOverscroll,
  });

  return {
    ...scrollBounds,
    effectiveZoom: { value: effectiveZoom },
    initialZoomLevel,
  };
};

/**
 * Constrains the scroll values within the provided min and max bounds.
 *
 * @param params - Object containing scrollX, scrollY, minScrollX, maxScrollX, minScrollY, maxScrollY, and constrainedZoom.
 * @returns An object with constrained scrollX, scrollY, and zoom.
 */
const constrainScrollValues = ({
  scrollX,
  scrollY,
  minScrollX,
  maxScrollX,
  minScrollY,
  maxScrollY,
  constrainedZoom,
}: {
  scrollX: number;
  scrollY: number;
  minScrollX: number;
  maxScrollX: number;
  minScrollY: number;
  maxScrollY: number;
  constrainedZoom: AppState["zoom"];
}): CanvasTranslate => {
  const constrainedScrollX = Math.min(
    maxScrollX,
    Math.max(scrollX, minScrollX),
  );
  const constrainedScrollY = Math.min(
    maxScrollY,
    Math.max(scrollY, minScrollY),
  );
  return {
    scrollX: constrainedScrollX,
    scrollY: constrainedScrollY,
    zoom: constrainedZoom,
  };
};

/**
 * Inverts the scroll constraints to align with the state scrollX and scrollY values, which are inverted.
 * This is a temporary fix and should be removed once issue #5965 is resolved.
 *
 * @param originalScrollConstraints - The original scroll constraints.
 * @returns The aligned scroll constraints with inverted x and y coordinates.
 */
const alignScrollConstraints = (
  originalScrollConstraints: ScrollConstraints,
): ScrollConstraints => {
  return {
    ...originalScrollConstraints,
    x: originalScrollConstraints.x * -1,
    y: originalScrollConstraints.y * -1,
  };
};

/**
 * Determines whether the current viewport is outside the constrained area.
 *
 * @param state - The application state.
 * @returns True if the viewport is outside the constrained area, false otherwise.
 */
const isViewportOutsideOfConstrainedArea = (state: AppState): boolean => {
  if (!state.scrollConstraints) {
    return false;
  }

  const {
    scrollX,
    scrollY,
    width,
    height,
    scrollConstraints: inverseScrollConstraints,
    zoom,
  } = state;

  const scrollConstraints = alignScrollConstraints(inverseScrollConstraints);

  const adjustedWidth = width / zoom.value;
  const adjustedHeight = height / zoom.value;

  return (
    scrollX > scrollConstraints.x ||
    scrollX - adjustedWidth < scrollConstraints.x - scrollConstraints.width ||
    scrollY > scrollConstraints.y ||
    scrollY - adjustedHeight < scrollConstraints.y - scrollConstraints.height
  );
};

/**
 * Calculates the scroll center coordinates and the optimal zoom level to fit the constrained scrollable area within the viewport.
 *
 * @param state - The application state.
 * @param scroll - Object containing current scrollX and scrollY.
 * @returns An object with the calculated scrollX, scrollY, and zoom.
 */
export const calculateConstrainedScrollCenter = (
  state: AppState,
  { scrollX, scrollY }: Pick<AppState, "scrollX" | "scrollY">,
): CanvasTranslate => {
  const { width, height, scrollConstraints } = state;
  if (!scrollConstraints) {
    return { scrollX, scrollY, zoom: state.zoom };
  }

  const adjustedConstraints = alignScrollConstraints(scrollConstraints);
  const zoomLevels = calculateZoomLevel(adjustedConstraints, width, height);
  const initialZoom = { value: zoomLevels.initialZoomLevel };
  const constraints = calculateConstraints({
    scrollConstraints: adjustedConstraints,
    width,
    height,
    zoom: initialZoom,
    allowOverscroll: false,
  });

  return {
    scrollX: constraints.minScrollX,
    scrollY: constraints.minScrollY,
    zoom: constraints.effectiveZoom,
  };
};

/**
 * Encodes scroll constraints into a compact string.
 *
 * @param constraints - The scroll constraints to encode.
 * @returns A compact encoded string representing the scroll constraints.
 */
export const encodeConstraints = (constraints: ScrollConstraints): string => {
  const payload = {
    x: constraints.x,
    y: constraints.y,
    w: constraints.width,
    h: constraints.height,
    a: !!constraints.animateOnNextUpdate,
    l: !!constraints.lockZoom,
    v: constraints.viewportZoomFactor ?? 1,
    oa: constraints.overscrollAllowance ?? DEFAULT_OVERSCROLL_ALLOWANCE,
  };
  const serialized = JSON.stringify(payload);
  return encodeURIComponent(window.btoa(serialized).replace(/=+/, ""));
};

/**
 * Decodes a compact string back into scroll constraints.
 *
 * @param encoded - The encoded string representing the scroll constraints.
 * @returns The decoded scroll constraints object.
 */
export const decodeConstraints = (encoded: string): ScrollConstraints => {
  try {
    const decodedStr = window.atob(decodeURIComponent(encoded));
    const parsed = JSON.parse(decodedStr) as {
      x: number;
      y: number;
      w: number;
      h: number;
      a: boolean;
      l: boolean;
      v: number;
      oa: number;
    };
    return {
      x: parsed.x || 0,
      y: parsed.y || 0,
      width: parsed.w || 0,
      height: parsed.h || 0,
      lockZoom: parsed.l || false,
      viewportZoomFactor: parsed.v || 1,
      animateOnNextUpdate: parsed.a || false,
      overscrollAllowance: parsed.oa || DEFAULT_OVERSCROLL_ALLOWANCE,
    };
  } catch (error) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      animateOnNextUpdate: false,
      lockZoom: false,
      viewportZoomFactor: 1,
      overscrollAllowance: DEFAULT_OVERSCROLL_ALLOWANCE,
    };
  }
};

type Options = { allowOverscroll: boolean; disableAnimation: boolean };
const DEFAULT_OPTION: Options = {
  allowOverscroll: true,
  disableAnimation: false,
};

/**
 * Constrains the AppState scroll values within the defined scroll constraints.
 *
 * constraintMode can be "elastic", "rigid", or "loose":
 * - "elastic": snaps to constraints but allows overscroll
 * - "rigid": snaps to constraints without overscroll
 * - "loose": allows overscroll and disables animation/snapping to constraints
 *
 * @param state - The original AppState.
 * @param options - Options for allowing overscroll and disabling animation.
 * @returns A new AppState object with constrained scroll values.
 */
export const constrainScrollState = (
  state: AppState,
  constraintMode: "elastic" | "rigid" | "loose" = "elastic",
): AppState => {
  if (!state.scrollConstraints) {
    return state;
  }
  const {
    scrollX,
    scrollY,
    width,
    height,
    scrollConstraints: inverseScrollConstraints,
    zoom,
  } = state;

  let allowOverscroll: boolean;
  let disableAnimation: boolean;

  switch (constraintMode) {
    case "elastic":
      ({ allowOverscroll, disableAnimation } = DEFAULT_OPTION);
      break;
    case "rigid":
      allowOverscroll = false;
      disableAnimation = false;
      break;
    case "loose":
      allowOverscroll = true;
      disableAnimation = true;
      break;
    default:
      ({ allowOverscroll, disableAnimation } = DEFAULT_OPTION);
      break;
  }

  const scrollConstraints = alignScrollConstraints(inverseScrollConstraints);

  const canUseMemoizedValues =
    memoizedValues &&
    memoizedValues.previousState.scrollConstraints &&
    memoizedValues.allowOverscroll === allowOverscroll &&
    isShallowEqual(
      state.scrollConstraints,
      memoizedValues.previousState.scrollConstraints,
    ) &&
    isShallowEqual(
      { zoom: zoom.value, width, height },
      {
        zoom: memoizedValues.previousState.zoom.value,
        width: memoizedValues.previousState.width,
        height: memoizedValues.previousState.height,
      },
    );

  const constraints = canUseMemoizedValues
    ? memoizedValues!.constraints
    : calculateConstraints({
        scrollConstraints,
        width,
        height,
        zoom,
        allowOverscroll,
      });

  if (!canUseMemoizedValues) {
    memoizedValues = {
      previousState: {
        zoom: state.zoom,
        width: state.width,
        height: state.height,
        scrollConstraints: state.scrollConstraints,
      },
      constraints,
      allowOverscroll,
    };
  }

  const constrainedValues =
    zoom.value >= constraints.effectiveZoom.value
      ? constrainScrollValues({
          scrollX,
          scrollY,
          minScrollX: constraints.minScrollX,
          maxScrollX: constraints.maxScrollX,
          minScrollY: constraints.minScrollY,
          maxScrollY: constraints.maxScrollY,
          constrainedZoom: constraints.effectiveZoom,
        })
      : calculateConstrainedScrollCenter(state, { scrollX, scrollY });

  return {
    ...state,
    scrollConstraints: {
      ...state.scrollConstraints,
      animateOnNextUpdate: disableAnimation
        ? false
        : isViewportOutsideOfConstrainedArea(state),
    },
    ...constrainedValues,
  };
};

/**
 * Checks if two canvas translate values are close within a threshold.
 *
 * @param from - First set of canvas translate values.
 * @param to - Second set of canvas translate values.
 * @returns True if the values are close, false otherwise.
 */
export const areCanvasTranslatesClose = (
  from: AnimateTranslateCanvasValues,
  to: AnimateTranslateCanvasValues,
): boolean => {
  const threshold = 0.1;
  return (
    Math.abs(from.scrollX - to.scrollX) < threshold &&
    Math.abs(from.scrollY - to.scrollY) < threshold &&
    Math.abs(from.zoom - to.zoom) < threshold
  );
};
