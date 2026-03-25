import type { GlobalPoint, LocalPoint, Rectangle } from "./types";

export function rectangle<P extends GlobalPoint | LocalPoint>(
  topLeft: P,
  bottomRight: P,
): Rectangle<P> {
  return [topLeft, bottomRight] as Rectangle<P>;
}
