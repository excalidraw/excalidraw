import type { LinearElementAnimation } from "./types";

export const DEFAULT_ANIMATION_SIZE = 8;
export const MAX_ANIMATION_COUNT = 20;

/** Restore both previous formats: preset speeds and separate dot/dots types. */
export const restoreLinearElementAnimation = (
  value: unknown,
): LinearElementAnimation | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const animation = value as Record<string, unknown>;
  const legacy = animation.size === undefined;
  const speed = animation.speed;
  const size = legacy ? DEFAULT_ANIMATION_SIZE : animation.size;
  const type =
    animation.type === "dots"
      ? "dot"
      : animation.type === "gaps"
      ? "gap"
      : animation.type;
  const count =
    animation.count === undefined
      ? animation.type === "dots" || animation.type === "gaps"
        ? 8
        : 1
      : animation.count;
  if (
    typeof type !== "string" ||
    !["dot", "gap", "dashes", "pulse"].includes(type) ||
    (legacy && !["dots", "dashes", "pulse"].includes(String(animation.type))) ||
    typeof speed !== "number" ||
    !Number.isFinite(speed) ||
    (legacy ? ![0.5, 1, 2].includes(speed) : speed < 0 || speed > 1) ||
    typeof size !== "number" ||
    !Number.isFinite(size) ||
    size < 1 ||
    size > 100 ||
    typeof count !== "number" ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_ANIMATION_COUNT ||
    (animation.direction !== "forward" && animation.direction !== "reverse")
  ) {
    return null;
  }
  return {
    type: type as LinearElementAnimation["type"],
    count,
    speed: legacy ? speed / 2 : speed,
    size,
    direction: animation.direction,
  };
};

/** Seconds per complete trip, independent of the number of moving items. */
export const getAnimationDuration = (speed: number) =>
  2.5 / Math.max(speed, 0.01);

export const getAnimationProgress = (
  time: number,
  animation: LinearElementAnimation,
  itemIndex = 0,
) => {
  const timeProgress =
    animation.speed === 0
      ? 0
      : time / 1000 / getAnimationDuration(animation.speed);
  const progress = (((timeProgress + itemIndex / animation.count) % 1) + 1) % 1;
  return animation.direction === "reverse" ? 1 - progress : progress;
};
