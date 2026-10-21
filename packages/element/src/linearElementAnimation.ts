import type { LinearElementAnimation } from "./types";

/** Treat invalid or future animation formats as static without affecting geometry. */
export const restoreLinearElementAnimation = (
  value: unknown,
): LinearElementAnimation | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const animation = value as Partial<LinearElementAnimation>;
  if (
    !["dots", "dashes", "pulse"].includes(animation.type ?? "") ||
    ![0.5, 1, 2].includes(animation.speed ?? 0) ||
    !["forward", "reverse"].includes(animation.direction ?? "")
  ) {
    return null;
  }
  return {
    type: animation.type!,
    speed: animation.speed!,
    direction: animation.direction!,
  };
};
