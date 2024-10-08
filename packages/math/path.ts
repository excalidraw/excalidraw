import { pointDistance } from "./point";
import type { LocalPoint } from "./types";

/**
 * Checks if the first and last point are close enough to be considered a loop
 *
 * @param points
 * @param threshold
 * @returns
 */
export const pathIsALoop = (
  points: readonly LocalPoint[],
  /** supply if you want the loop detection to account for current zoom */
  threshold: number,
  //zoomValue: Zoom["value"] = 1 as NormalizedZoomValue,
): boolean => {
  if (points.length >= 3) {
    const [first, last] = [points[0], points[points.length - 1]];
    const distance = pointDistance(first, last);

    // Adjusting LINE_CONFIRM_THRESHOLD to current zoom so that when zoomed in
    // really close we make the threshold smaller, and vice versa.

    return distance <= threshold; // LINE_CONFIRM_THRESHOLD / zoomValue;
  }
  return false;
};
