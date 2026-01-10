import type { PanningMode } from "../types";

/**
 * Restricts pan delta values based on the current panning mode.
 * @param panningMode - The current panning mode (free, vertical, horizontal or both)
 * @param deltaX - The horizontal pan delta
 * @param deltaY - The vertical pan delta
 * @returns An object with restricted deltaX and deltaY values
 */
export const restrictPanDelta = (
  panningMode: PanningMode,
  deltaX: number,
  deltaY: number,
): { deltaX: number; deltaY: number } => {
  switch (panningMode) {
    case "fixed":
      // No panning allowed (both axes fixed)
      return { deltaX: 0, deltaY: 0 };
    case "horizontalFixed":
      // Horizontal is fixed (no horizontal movement) -> allow vertical only
      return { deltaX: 0, deltaY };
    case "verticalFixed":
      // Vertical is fixed (no vertical movement) -> allow horizontal only
      return { deltaX, deltaY: 0 };
    case "free":
    default:
      // Allow panning in all directions
      return { deltaX, deltaY };
  }
};
