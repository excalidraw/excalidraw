import type { LinearElementAnimation } from "./types";

export const DEFAULT_ANIMATION_SIZE = 8;

/** Missing size identifies the original three-speed format. */
export const restoreLinearElementAnimation = (
  value: unknown,
): LinearElementAnimation | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const animation = value as Partial<LinearElementAnimation>;
  const legacy = animation.size === undefined;
  const speed = animation.speed;
  const size = legacy ? DEFAULT_ANIMATION_SIZE : animation.size;
  if (
    !["dots", "dot", "gap", "dashes", "pulse"].includes(animation.type ?? "") ||
    (legacy && !["dots", "dashes", "pulse"].includes(animation.type ?? "")) ||
    typeof speed !== "number" ||
    !Number.isFinite(speed) ||
    (legacy ? ![0.5, 1, 2].includes(speed) : speed < 0 || speed > 1) ||
    typeof size !== "number" ||
    !Number.isFinite(size) ||
    size < 1 ||
    size > 100 ||
    !["forward", "reverse"].includes(animation.direction ?? "")
  ) {
    return null;
  }
  return {
    type: animation.type!,
    speed: legacy ? speed / 2 : speed,
    size,
    direction: animation.direction!,
  };
};

/** Seconds per complete trip for a single dot or gap. */
export const getAnimationDuration = (speed: number) =>
  2.5 / Math.max(speed, 0.01);

export const getAnimationProgress = (
  time: number,
  animation: LinearElementAnimation,
) => {
  const progress =
    (((time / 1000 / getAnimationDuration(animation.speed)) % 1) + 1) % 1;
  const position = animation.speed === 0 ? 0 : progress;
  return animation.direction === "reverse" ? 1 - position : position;
};
