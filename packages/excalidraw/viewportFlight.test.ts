import { flightPath } from "./viewportFlight";

import type { NormalizedZoomValue } from "./types";

const screen = { width: 1000, height: 600 };

const viewport = (scrollX: number, scrollY: number, zoom: number) => ({
  scrollX,
  scrollY,
  zoom: { value: zoom as NormalizedZoomValue },
});

/** The scene point at the center of the screen. */
const centerOf = (v: ReturnType<typeof viewport>) => ({
  x: screen.width / 2 / v.zoom.value - v.scrollX,
  y: screen.height / 2 / v.zoom.value - v.scrollY,
});

const samples = (n: number) => Array.from({ length: n + 1 }, (_, i) => i / n);

describe("flightPath", () => {
  describe("between two frames 50 views apart at 4x", () => {
    // at 4x a view is 250 scene units wide
    const from = viewport(0, 0, 4);
    const target = viewport(-12_500, -3_000, 4);
    const path = flightPath(from, target, screen);

    it("starts exactly on the first viewport", () => {
      expect(path.at(0)).toEqual(from);
    });

    it("lands exactly on the target", () => {
      expect(path.at(1)).toEqual(target);
    });

    it("zooms out on the way", () => {
      const lowest = Math.min(...samples(50).map((f) => path.at(f).zoom.value));
      expect(lowest).toBeLessThan(4 / 10);
    });

    it("moves the view center monotonically toward the target", () => {
      const end = centerOf(target);
      const distances = samples(50).map((f) => {
        const c = centerOf(path.at(f));
        return Math.hypot(end.x - c.x, end.y - c.y);
      });
      const increases = distances.filter((d, i) => i && d > distances[i - 1]);
      expect(increases).toEqual([]);
    });

    it("is longer, in the paper's metric, than a hop of one view", () => {
      const hop = flightPath(from, viewport(-250, 0, 4), screen);
      expect(path.length).toBeGreaterThan(hop.length);
    });
  });

  describe("zooming in 8x without moving the center", () => {
    const from = viewport(0, 0, 1);
    const target = viewport(-437.5, -262.5, 8);
    const path = flightPath(from, target, screen);

    it("keeps the center still", () => {
      const c = centerOf(path.at(0.5));
      expect([c.x, c.y].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([
        500, 300,
      ]);
    });

    it("is halfway, geometrically, halfway through", () => {
      expect(path.at(0.5).zoom.value).toBeCloseTo(Math.sqrt(8), 9);
    });
  });
});
