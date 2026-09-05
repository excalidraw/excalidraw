import type { Options } from "roughjs/bin/core";

/**
 * Tunables for the hand-drawn UI bits. Adjust here rather than in components.
 */

/** Fixed seed: keeps every sketch identical across renders and reloads. */
export const ROUGH_SEED = 42;

/** Box size of a chat-list bullet, in px. */
export const BULLET_SIZE = 18;

/** How far the circle is inset inside its box, so rough edges are not clipped. */
export const BULLET_INSET = 4;

export const BULLET_OPTIONS: Options = {
  strokeWidth: 1,
  fillStyle: "cross-hatch",
  fillWeight: 0.5,
  hachureGap: 4,
  roughness: 1,
  seed: ROUGH_SEED,
};

/** Highlight drawn behind the selected chat row. */
export const SELECTION_OPTIONS: Options = {
  stroke: "#adb5bd",
  strokeWidth: 1,
  fill: "#c9ccd1",
  fillStyle: "cross-hatch",
  fillWeight: 0.5,
  hachureGap: 8,
  roughness: 1.2,
  seed: ROUGH_SEED,
};

/** Hand-drawn frame for the settings dialog, its inputs and list boxes. */
export const FRAME_OPTIONS: Options = {
  stroke: "#1b1b1f",
  strokeWidth: 1.6,
  roughness: 1,
  bowing: 0.8,
  seed: ROUGH_SEED,
};

/** Lighter sketch for inputs and the rules inside a list box. */
export const FIELD_OPTIONS: Options = {
  ...FRAME_OPTIONS,
  strokeWidth: 1.2,
};

/** Below this width the sidebar collapses into the hamburger drawer. */
export const NARROW_QUERY = "(max-width: 860px)";
