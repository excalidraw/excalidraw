import { AppState, ScrollConstraints } from "../types";
import { isShallowEqual } from "../utils";
import { getNormalizedZoom } from "./zoom";

/**
 * Calculates the scroll center coordinates and the optimal zoom level to fit the constrained scrollable area within the viewport.
 *
 * This method first calculates the necessary zoom level to fit the entire constrained scrollable area within the viewport.
 * Then it calculates the constraints for the viewport given the new zoom level and the current scrollable area dimensions.
 * The function returns an object containing the optimal scroll positions and zoom level.
 *
 * @param scrollConstraints - The constraints of the scrollable area including width, height, and position.
 * @param appState - An object containing the current horizontal and vertical scroll positions.
 * @returns An object containing the calculated optimal horizontal and vertical scroll positions and zoom level.
 *
 * @example
 *
 * const { scrollX, scrollY, zoom } = this.calculateConstrainedScrollCenter(scrollConstraints, { scrollX, scrollY });
 */
export const calculateConstrainedScrollCenter = (
  state: AppState,
  { scrollX, scrollY }: Pick<AppState, "scrollX" | "scrollY">,
): {
  scrollX: AppState["scrollX"];
  scrollY: AppState["scrollY"];
  zoom: AppState["zoom"];
} => {
  const { width, height, zoom, scrollConstraints } = state;

  if (!scrollConstraints) {
    return { scrollX, scrollY, zoom };
  }

  const { zoomLevelX, zoomLevelY, initialZoomLevel } = calculateZoomLevel(
    scrollConstraints,
    width,
    height,
  );

  // The zoom level to contain the whole constrained area in view
  const _zoom = {
    value: getNormalizedZoom(
      initialZoomLevel ?? Math.min(zoomLevelX, zoomLevelY),
    ),
  };

  const constraints = calculateConstraints({
    scrollConstraints,
    width,
    height,
    zoom: _zoom,
    allowOverscroll: false,
  });

  return {
    scrollX: constraints.minScrollX,
    scrollY: constraints.minScrollY,
    zoom: constraints.constrainedZoom,
  };
};

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
 * @returns An object containing the calculated zoom levels for the X and Y axes, and the maximum zoom level if applicable.
 */
const calculateZoomLevel = (
  scrollConstraints: ScrollConstraints,
  width: AppState["width"],
  height: AppState["height"],
) => {
  const DEFAULT_VIEWPORT_ZOOM_FACTOR = 0.7;

  const viewportZoomFactor = scrollConstraints.viewportZoomFactor
    ? Math.min(1, Math.max(scrollConstraints.viewportZoomFactor, 0.1))
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
  // Set the overscroll allowance percentage
  const OVERSCROLL_ALLOWANCE_PERCENTAGE = 0.2;

  /**
   * Calculates the center position of the constrained scroll area.
   * @returns The X and Y coordinates of the center position.
   */
  const calculateConstrainedScrollCenter = (zoom: number) => {
    const constrainedScrollCenterX =
      scrollConstraints.x + (scrollConstraints.width - width / zoom) / -2;
    const constrainedScrollCenterY =
      scrollConstraints.y + (scrollConstraints.height - height / zoom) / -2;
    return { constrainedScrollCenterX, constrainedScrollCenterY };
  };

  /**
   * Calculates the overscroll allowance values for the constrained area.
   * @returns The overscroll allowance values for the X and Y axes.
   */
  const calculateOverscrollAllowance = () => {
    const overscrollAllowanceX =
      OVERSCROLL_ALLOWANCE_PERCENTAGE * scrollConstraints.width;
    const overscrollAllowanceY =
      OVERSCROLL_ALLOWANCE_PERCENTAGE * scrollConstraints.height;

    return Math.min(overscrollAllowanceX, overscrollAllowanceY);
  };

  /**
   * Calculates the minimum and maximum scroll values based on the current state.
   * @param shouldAdjustForCenteredViewX - Whether the view should be adjusted for centered view on X axis - when constrained area width fits the viewport.
   * @param shouldAdjustForCenteredViewY - Whether the view should be adjusted for centered view on Y axis - when constrained area height fits the viewport.
   * @param overscrollAllowanceX - The overscroll allowance value for the X axis.
   * @param overscrollAllowanceY - The overscroll allowance value for the Y axis.
   * @param constrainedScrollCenterX - The X coordinate of the constrained scroll area center.
   * @param constrainedScrollCenterY - The Y coordinate of the constrained scroll area center.
   * @returns The minimum and maximum scroll values for the X and Y axes.
   */
  const calculateMinMaxScrollValues = (
    shouldAdjustForCenteredViewX: boolean,
    shouldAdjustForCenteredViewY: boolean,
    overscrollAllowance: number,
    constrainedScrollCenterX: number,
    constrainedScrollCenterY: number,
    zoom: number,
  ) => {
    let maxScrollX;
    let minScrollX;
    let maxScrollY;
    let minScrollY;

    // Handling the X-axis
    if (allowOverscroll) {
      if (shouldAdjustForCenteredViewX) {
        maxScrollX = constrainedScrollCenterX + overscrollAllowance;
        minScrollX = constrainedScrollCenterX - overscrollAllowance;
      } else {
        maxScrollX = scrollConstraints.x + overscrollAllowance;
        minScrollX =
          scrollConstraints.x -
          scrollConstraints.width +
          width / zoom -
          overscrollAllowance;
      }
    } else if (shouldAdjustForCenteredViewX) {
      maxScrollX = constrainedScrollCenterX;
      minScrollX = constrainedScrollCenterX;
    } else {
      maxScrollX = scrollConstraints.x;
      minScrollX = scrollConstraints.x - scrollConstraints.width + width / zoom;
    }

    // Handling the Y-axis
    if (allowOverscroll) {
      if (shouldAdjustForCenteredViewY) {
        maxScrollY = constrainedScrollCenterY + overscrollAllowance;
        minScrollY = constrainedScrollCenterY - overscrollAllowance;
      } else {
        maxScrollY = scrollConstraints.y + overscrollAllowance;
        minScrollY =
          scrollConstraints.y -
          scrollConstraints.height +
          height / zoom -
          overscrollAllowance;
      }
    } else if (shouldAdjustForCenteredViewY) {
      maxScrollY = constrainedScrollCenterY;
      minScrollY = constrainedScrollCenterY;
    } else {
      maxScrollY = scrollConstraints.y;
      minScrollY =
        scrollConstraints.y - scrollConstraints.height + height / zoom;
    }

    return { maxScrollX, minScrollX, maxScrollY, minScrollY };
  };

  const { zoomLevelX, zoomLevelY, initialZoomLevel } = calculateZoomLevel(
    scrollConstraints,
    width,
    height,
  );

  const constrainedZoom = getNormalizedZoom(
    scrollConstraints.lockZoom
      ? Math.max(initialZoomLevel, zoom.value)
      : zoom.value,
  );
  const { constrainedScrollCenterX, constrainedScrollCenterY } =
    calculateConstrainedScrollCenter(constrainedZoom);
  const overscrollAllowance = calculateOverscrollAllowance();
  const shouldAdjustForCenteredViewX = constrainedZoom <= zoomLevelX;
  const shouldAdjustForCenteredViewY = constrainedZoom <= zoomLevelY;
  const { maxScrollX, minScrollX, maxScrollY, minScrollY } =
    calculateMinMaxScrollValues(
      shouldAdjustForCenteredViewX,
      shouldAdjustForCenteredViewY,
      overscrollAllowance,
      constrainedScrollCenterX,
      constrainedScrollCenterY,
      constrainedZoom,
    );

  return {
    maxScrollX,
    minScrollX,
    maxScrollY,
    minScrollY,
    constrainedZoom: {
      value: constrainedZoom,
    },
    initialZoomLevel,
  };
};

/**
 * Constrains the scroll values within the constrained area.
 * @param maxScrollX - The maximum scroll value for the X axis.
 * @param minScrollX - The minimum scroll value for the X axis.
 * @param maxScrollY - The maximum scroll value for the Y axis.
 * @param minScrollY - The minimum scroll value for the Y axis.
 * @returns The constrained scroll values for the X and Y axes.
 */
const constrainScrollValues = ({
  scrollX,
  scrollY,
  maxScrollX,
  minScrollX,
  maxScrollY,
  minScrollY,
  constrainedZoom,
}: {
  scrollX: number;
  scrollY: number;
  maxScrollX: number;
  minScrollX: number;
  maxScrollY: number;
  minScrollY: number;
  constrainedZoom: AppState["zoom"];
}) => {
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
 * Determines whether the current viewport is outside the constrained area defined in the AppState.
 *
 * @param state - The application state containing scroll, zoom, and constraint information.
 * @returns True if the viewport is outside the constrained area; otherwise undefined.
 */
const isViewportOutsideOfConstrainedArea = (state: AppState) => {
  if (!state.scrollConstraints) {
    return false;
  }

  const { scrollX, scrollY, width, height, scrollConstraints, zoom } = state;

  // Adjust scroll and dimensions according to the zoom level
  const adjustedScrollX = scrollX * zoom.value;
  const adjustedScrollY = scrollY * zoom.value;
  const adjustedWidth = width / zoom.value;
  const adjustedHeight = height / zoom.value;

  return (
    adjustedScrollX > scrollConstraints.x ||
    adjustedScrollX - adjustedWidth <
      scrollConstraints.x - scrollConstraints.width ||
    adjustedScrollY > scrollConstraints.y ||
    adjustedScrollY - adjustedHeight <
      scrollConstraints.y - scrollConstraints.height
  );
};

let memoizedValues: {
  previousState: Pick<
    AppState,
    "zoom" | "width" | "height" | "scrollConstraints"
  >;
  constraints: ReturnType<typeof calculateConstraints>;
  allowOverscroll: boolean;
} | null = null;

/**
 * Constrains the AppState scroll values within the defined scroll constraints.
 *
 * @param state - The original AppState with the current scroll position, dimensions, and constraints.
 * @returns A new AppState object with scroll values constrained as per the defined constraints.
 */
export const constrainScrollState = (
  state: AppState,
  allowOverscroll = true,
): AppState => {
  if (!state.scrollConstraints) {
    return state;
  }
  const { scrollX, scrollY, width, height, scrollConstraints, zoom } = state;

  const canUseMemoizedValues =
    memoizedValues && // there are memoized values
    memoizedValues.previousState.scrollConstraints && // can't use memoized values if there were no scrollConstraints in memoizedValues
    memoizedValues.allowOverscroll === allowOverscroll && // allowOverscroll is the same as in memoizedValues
    // current scrollConstraints are the same as in memoizedValues
    isShallowEqual(
      state.scrollConstraints,
      memoizedValues.previousState.scrollConstraints!,
    ) &&
    // current zoom and window dimensions are equal to those in memoizedValues
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

  const constrainedValues = constrainScrollValues({
    ...constraints,
    scrollX,
    scrollY,
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

  return {
    ...state,
    scrollConstraints: {
      ...state.scrollConstraints,
      animateOnNextUpdate: isViewportOutsideOfConstrainedArea(state),
    },
    ...constrainedValues,
  };
};
