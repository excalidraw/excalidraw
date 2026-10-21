import { pointFrom, type ViewportPoint } from "@excalidraw/math";

import { validateElbowPoints } from "../src/elbowArrow";

// Scene-space element code must not accept viewport points. Enforced by
// `yarn test:typecheck`.
describe("element point types", () => {
  it("rejects ViewportPoint in elbow arrow validation", () => {
    const points = [
      pointFrom<ViewportPoint>(0, 0),
      pointFrom<ViewportPoint>(0, 10),
    ];

    // @ts-expect-error elbow arrow points are scene/element space
    expect(validateElbowPoints(points)).toBe(true);
  });
});
