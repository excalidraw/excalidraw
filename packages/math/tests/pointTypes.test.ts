import {
  pointCenter,
  pointDistance,
  pointFrom,
  pointFromVector,
  pointTranslate,
} from "../src/point";
import { vector } from "../src/vector";

import type { GlobalPoint, LocalPoint, ViewportPoint } from "../src/types";

// Type-level guarantees for the point brands. These are enforced by
// `yarn test:typecheck`; the runtime assertions only keep vitest happy.
describe("point type brands", () => {
  it("defaults un-annotated points to scene space", () => {
    const p = pointFrom(1, 2);
    const scene: GlobalPoint | LocalPoint = p;
    // @ts-expect-error scene points are not viewport points
    const viewport: ViewportPoint = p;

    expect([scene, viewport]).toHaveLength(2);
  });

  it("preserves the ViewportPoint brand through generic helpers", () => {
    const a = pointFrom<ViewportPoint>(0, 0);
    const b = pointFrom<ViewportPoint>(4, 4);

    // un-annotated on purpose: the brand must come from the arguments,
    // not from an expected return type
    const center = pointCenter(a, b);
    const translated = pointTranslate(a, vector(1, 1));
    const fromVector = pointFromVector(vector(1, 1), a);

    const results: ViewportPoint[] = [center, translated, fromVector];
    expect(results).toHaveLength(3);
  });

  it("rejects mixing coordinate spaces", () => {
    const global = pointFrom<GlobalPoint>(0, 0);
    const viewport = pointFrom<ViewportPoint>(3, 4);

    // @ts-expect-error GlobalPoint and ViewportPoint cannot be mixed
    expect(pointDistance(global, viewport)).toBe(5);
  });
});
