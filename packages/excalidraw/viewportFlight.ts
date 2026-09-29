import type { NormalizedZoomValue } from "./types";

type Viewport = {
  scrollX: number;
  scrollY: number;
  zoom: { value: NormalizedZoomValue };
};

/**
 * Van Wijk and Nuij's trade-off between zooming and panning ("Smooth and
 * efficient zooming and panning", 2003); d3.interpolateZoom uses the same.
 * sqrt(2) is the paper's recommended value.
 */
const RHO = Math.SQRT2;

/** Below this many scene units between view centers, a flight is a pure zoom. */
const EPSILON = 1e-9;

export type FlightPath = {
  /**
   * The path's length in the paper's metric: roughly, how many view widths
   * the eye travels. Proportional to the flight's natural duration.
   */
  length: number;
  /** The viewport a `factor` (0 to 1) of the way along the path. */
  at: (factor: number) => Viewport;
};

/**
 * The shortest-looking camera path from one viewport to another on a screen
 * of `width` by `height` px: between distant targets it zooms out, pans
 * across at the wider view, and zooms back in, so the destination comes into
 * view early instead of rushing past at full zoom.
 */
export const flightPath = (
  from: Viewport,
  target: Viewport,
  { width, height }: { width: number; height: number },
): FlightPath => {
  // A view is its center in scene coordinates and the scene width it shows.
  const center = (v: Viewport) => ({
    x: width / 2 / v.zoom.value - v.scrollX,
    y: height / 2 / v.zoom.value - v.scrollY,
  });
  const c0 = center(from);
  const c1 = center(target);
  const w0 = width / from.zoom.value;
  const w1 = width / target.zoom.value;
  const dx = c1.x - c0.x;
  const dy = c1.y - c0.y;
  const d = Math.hypot(dx, dy);

  const viewport = (x: number, y: number, w: number): Viewport => {
    const zoom = (width / w) as NormalizedZoomValue;
    return {
      scrollX: width / 2 / zoom - x,
      scrollY: height / 2 / zoom - y,
      zoom: { value: zoom },
    };
  };

  const land = (factor: number, pose: () => Viewport) =>
    factor <= 0 ? { ...from } : factor >= 1 ? { ...target } : pose();

  if (d < EPSILON) {
    const k = Math.log(w1 / w0);
    return {
      length: Math.abs(k) / RHO,
      at: (factor) =>
        land(factor, () =>
          viewport(
            c0.x + dx * factor,
            c0.y + dy * factor,
            w0 * Math.exp(k * factor),
          ),
        ),
    };
  }

  const r = (w: number, sign: 1 | -1) => {
    const b =
      (w1 * w1 - w0 * w0 + sign * RHO ** 4 * d * d) / (2 * w * RHO ** 2 * d);
    return Math.log(Math.sqrt(b * b + 1) - b);
  };
  const r0 = r(w0, 1);
  const r1 = r(w1, -1);
  const length = (r1 - r0) / RHO;
  return {
    length,
    at: (factor) =>
      land(factor, () => {
        const s = factor * length;
        // How far along the straight line between centers, in scene units.
        const u =
          (w0 / (RHO * RHO)) *
          (Math.cosh(r0) * Math.tanh(RHO * s + r0) - Math.sinh(r0));
        return viewport(
          c0.x + (dx / d) * u,
          c0.y + (dy / d) * u,
          (w0 * Math.cosh(r0)) / Math.cosh(RHO * s + r0),
        );
      }),
  };
};
