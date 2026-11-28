import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import {
  getBindingGap,
  repairBindings,
  unbindBindingElement,
} from "../src/binding";
import { newArrowElement, newElement } from "../src/newElement";
import { Scene } from "../src/Scene";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElbowArrowElement,
  ExcalidrawElement,
  FixedPointBinding,
} from "../src/types";

const rect = (
  id: string,
  x = 0,
  extra: Partial<ExcalidrawElement> = {},
): ExcalidrawElement =>
  ({
    ...newElement({ type: "rectangle", x, y: 0, width: 100, height: 100 }),
    id,
    ...extra,
  } as ExcalidrawElement);

const arrow = (
  id: string,
  from: [number, number],
  to: [number, number],
  extra: Partial<ExcalidrawArrowElement> = {},
): ExcalidrawArrowElement => ({
  ...newArrowElement({
    type: "arrow",
    elbowed: !!extra.elbowed,
    x: from[0],
    y: from[1],
    points: [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(to[0] - from[0], to[1] - from[1]),
    ],
  }),
  id,
  ...extra,
});

/** minimal bound text; `newTextElement` would need font measurement */
const label = (id: string, containerId: string | null) =>
  ({ ...rect(id), type: "text", containerId } as unknown as ExcalidrawElement);

const elbow = (
  id: string,
  from: [number, number],
  to: [number, number],
  extra: Partial<ExcalidrawArrowElement> = {},
) => arrow(id, from, to, { ...extra, elbowed: true });

const P = (x: number, y: number) => pointFrom<LocalPoint>(x, y);

/** every segment of an elbow arrow must be horizontal or vertical */
const isOrthogonal = (element: ExcalidrawArrowElement) =>
  element.points
    .slice(1)
    .every(
      ([x, y], i) => x === element.points[i][0] || y === element.points[i][1],
    );

const byId = (elements: readonly ExcalidrawElement[]) =>
  Object.fromEntries(elements.map((element) => [element.id, element])) as any;

describe("repairBindings", () => {
  // must work headless, i.e. without any DOM
  beforeEach(() => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("leaves unbound endpoints alone without mutating input", () => {
    const input = [rect("a"), rect("b", 300), arrow("x", [102, 50], [298, 50])];
    const snapshot = JSON.stringify(input);

    const { a, b, x } = byId(repairBindings(input));

    expect(x.startBinding).toBeNull();
    expect(x.endBinding).toBeNull();
    expect(a.boundElements).toBeNull();
    expect(b.boundElements).toBeNull();
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("drops dangling bindings and stale records", () => {
    const binding = {
      elementId: "missing",
      mode: "orbit",
      fixedPoint: [0.5001, 0.5001],
    } as FixedPointBinding;

    const input = [
      rect("a", 500, {
        boundElements: [
          { id: "x", type: "arrow" },
          { id: "gone", type: "arrow" },
        ],
      }),
      arrow("x", [0, 0], [100, 0], { startBinding: binding }),
    ];
    const snapshot = JSON.stringify(input);

    const { a, x } = byId(repairBindings(input));

    expect(x.startBinding).toBeNull();
    expect(a.boundElements).toEqual([]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("keeps label records that bind back and drops invalid ones", () => {
    const { a } = byId(
      repairBindings([
        rect("a", 0, {
          boundElements: [
            { id: "t", type: "text" },
            { id: "u", type: "text" },
            { id: "d", type: "arrow" },
            { id: "r", type: "arrow" },
          ],
        }),
        label("t", "a"),
        label("u", null),
        arrow("d", [300, 50], [102, 50], {
          isDeleted: true,
          endBinding: { elementId: "a", mode: "orbit", fixedPoint: [1, 0.4] },
        }),
        rect("r", 500),
      ]),
    );

    // only the label pointing back survives: not the unbound label, the
    // deleted arrow, or the rectangle, which cannot be bound
    expect(a.boundElements).toEqual([{ id: "t", type: "text" }]);
  });

  it("drops bindings to deleted targets", () => {
    const { a, x } = byId(
      repairBindings([
        rect("a", 0, {
          isDeleted: true,
          boundElements: [{ id: "x", type: "arrow" }],
        }),
        arrow("x", [300, 50], [102, 50], {
          endBinding: { elementId: "a", mode: "orbit", fixedPoint: [1, 0.5] },
        }),
      ]),
    );

    expect(x.endBinding).toBeNull();
    // deleted elements are passed through untouched
    expect(a.boundElements).toEqual([{ id: "x", type: "arrow" }]);
  });

  it("drops bindings to non-bindable targets without recording on them", () => {
    const { x, y } = byId(
      repairBindings([
        arrow("y", [0, 0], [100, 0]),
        arrow("x", [300, 50], [100, 0], {
          endBinding: { elementId: "y", mode: "orbit", fixedPoint: [1, 0.5] },
        }),
      ]),
    );

    expect(x.endBinding).toBeNull();
    expect(y.boundElements).toBeNull();
  });

  it("removes duplicate records", () => {
    const { a } = byId(
      repairBindings([
        rect("a", 0, {
          boundElements: [
            { id: "x", type: "arrow" },
            { id: "x", type: "arrow" },
          ],
        }),
        arrow("x", [300, 50], [102, 50], {
          endBinding: { elementId: "a", mode: "orbit", fixedPoint: [1, 0.4] },
        }),
      ]),
    );

    expect(a.boundElements).toEqual([{ id: "x", type: "arrow" }]);
  });

  it("normalizes the fixed point of complete bindings", () => {
    const normalized = {
      elementId: "a",
      mode: "orbit",
      fixedPoint: [1, 0.4],
    } as FixedPointBinding;

    const { x, y, z } = byId(
      repairBindings([
        rect("a"),
        arrow("x", [300, 50], [102, 50], {
          endBinding: { elementId: "a", mode: "orbit", fixedPoint: [1, 0.5] },
        }),
        arrow("y", [300, 40], [102, 40], { endBinding: normalized }),
        arrow("z", [300, 30], [102, 30], {
          endBinding: { elementId: "a", mode: "orbit", fixedPoint: [50, 0.4] },
        }),
      ]),
    );

    expect(x.endBinding.fixedPoint).toEqual([1, 0.5001]);
    expect(z.endBinding.fixedPoint).toEqual([10, 0.4]);
    // already normalized bindings are left untouched
    expect(y.endBinding).toBe(normalized);
  });

  it("records a declared binding on its target", () => {
    const binding = {
      elementId: "a",
      mode: "orbit",
      fixedPoint: [1, 0.4],
    } as FixedPointBinding;

    const { a, b } = byId(
      repairBindings([
        rect("a"),
        rect("b", 500, { boundElements: [{ id: "y", type: "arrow" }] }),
        arrow("x", [300, 50], [102, 50], { endBinding: binding }),
        arrow("y", [300, 40], [498, 40], {
          endBinding: { ...binding, elementId: "b", fixedPoint: [0, 0.4] },
        }),
        arrow("z", [300, 30], [498, 30], {
          endBinding: { ...binding, elementId: "b", fixedPoint: [0, 0.3] },
        }),
      ]),
    );

    expect(a.boundElements).toEqual([{ id: "x", type: "arrow" }]);
    // appended to existing records
    expect(b.boundElements).toEqual([
      { id: "y", type: "arrow" },
      { id: "z", type: "arrow" },
    ]);
  });

  it("records an arrow bound at both ends to the same element once", () => {
    const { a } = byId(
      repairBindings([
        rect("a"),
        arrow("x", [102, 20], [102, 80], {
          startBinding: { elementId: "a", mode: "orbit", fixedPoint: [1, 0.2] },
          endBinding: { elementId: "a", mode: "orbit", fixedPoint: [1, 0.8] },
        }),
      ]),
    );

    expect(a.boundElements).toEqual([{ id: "x", type: "arrow" }]);
  });

  it("repairs locked arrows and locked targets", () => {
    const { a, x } = byId(
      repairBindings([
        rect("a", 0, { locked: true }),
        arrow("x", [300, 50], [102, 50], {
          locked: true,
          endBinding: { elementId: "a", mode: "orbit", fixedPoint: [1, 0.5] },
        }),
      ]),
    );

    expect(a.boundElements).toEqual([{ id: "x", type: "arrow" }]);
    expect(x.endBinding.fixedPoint).toEqual([1, 0.5001]);
  });

  it("completes a binding missing mode and fixedPoint", () => {
    const { x, y } = byId(
      repairBindings([
        rect("a"),
        arrow("x", [300, 50], [102, 50], {
          endBinding: { elementId: "a" } as FixedPointBinding,
        }),
        arrow("y", [102, 40], [300, 40], {
          startBinding: { elementId: "a" } as FixedPointBinding,
        }),
      ]),
    );

    expect(x.endBinding.mode).toBe("orbit");
    expect(x.endBinding.fixedPoint).toHaveLength(2);
    // re-derived from the first point, just outside the right side
    expect(y.startBinding.mode).toBe("orbit");
    expect(y.startBinding.fixedPoint[0]).toBeGreaterThan(1);
    expect(y.startBinding.fixedPoint[1]).toBeCloseTo(0.4, 1);
  });

  it("re-derives bindings with an invalid mode or fixedPoint", () => {
    const { x, y, z } = byId(
      repairBindings([
        rect("a"),
        arrow("x", [300, 50], [102, 50], {
          endBinding: {
            elementId: "a",
            mode: "bogus",
            fixedPoint: [1, 0.4],
          } as unknown as FixedPointBinding,
        }),
        arrow("y", [300, 40], [102, 40], {
          endBinding: {
            elementId: "a",
            mode: "orbit",
            fixedPoint: [NaN, 0.4],
          } as FixedPointBinding,
        }),
        arrow("z", [300, 30], [102, 30], {
          endBinding: { elementId: "a", mode: "orbit" } as FixedPointBinding,
        }),
      ]),
    );

    expect(x.endBinding.mode).toBe("orbit");
    for (const { endBinding } of [x, y, z]) {
      expect(endBinding.fixedPoint.every(Number.isFinite)).toBe(true);
      // re-derived from the endpoint, just outside the right side
      expect(endBinding.fixedPoint[0]).toBeGreaterThan(1);
    }
  });

  it("completes a binding as inside when the endpoint is inside", () => {
    const { x } = byId(
      repairBindings([
        rect("a"),
        arrow("x", [300, 50], [50, 40], {
          endBinding: { elementId: "a" } as FixedPointBinding,
        }),
      ]),
    );

    expect(x.endBinding.mode).toBe("inside");
  });

  it("snaps a bound endpoint onto the moved target", () => {
    const { x } = byId(
      repairBindings([
        // moved within binding distance of the endpoint
        rect("a", 1000),
        arrow("x", [300, 50], [990, 50], {
          endBinding: {
            elementId: "a",
            mode: "orbit",
            fixedPoint: [0, 0.5001],
          },
        }),
      ]),
    );

    const endX = x.x + x.points[x.points.length - 1][0];
    expect(endX).toBeGreaterThan(990);
    expect(endX).toBeLessThan(1000);
  });

  it("extends a bound endpoint falling short of its target onto it", () => {
    const { a, x } = byId(
      repairBindings([
        rect("a", 1000),
        // ends 100px short of a: within its end segment's length
        arrow("x", [300, 50], [900, 50], {
          endBinding: {
            elementId: "a",
            mode: "orbit",
            // not where the end reaches a, so re-derived from where it does
            fixedPoint: [0, 0.2],
          },
        }),
      ]),
    );

    expect(x.endBinding).toMatchObject({ elementId: "a", mode: "orbit" });
    expect(x.endBinding.fixedPoint[1]).toBeCloseTo(0.5, 2);
    const [endX, endY] = x.points[x.points.length - 1];
    expect(x.x + endX).toBeCloseTo(1000 - getBindingGap(a));
    expect(x.y + endY).toBeCloseTo(50, 1);
    expect(a.boundElements).toEqual([{ id: "x", type: "arrow" }]);
  });

  it("unbinds a bound endpoint beyond reach of its target where given", () => {
    const { a, x } = byId(
      repairBindings([
        // the end segment points away from it
        rect("a", 1000),
        arrow("x", [300, 50], [102, 50], {
          endBinding: {
            elementId: "a",
            mode: "orbit",
            fixedPoint: [0, 0.5001],
          },
        }),
      ]),
    );

    expect(x).toMatchObject({
      endBinding: null,
      x: 300,
      y: 50,
      points: [
        [0, 0],
        [-198, 0],
      ],
    });
    expect(a.boundElements).toEqual([]);
  });

  it("keeps the binding of the other end bound to the same element", () => {
    const { a, x } = byId(
      repairBindings([
        rect("a"),
        arrow("x", [102, 50], [600, 50], {
          startBinding: {
            elementId: "a",
            mode: "orbit",
            fixedPoint: [1, 0.5001],
          },
          endBinding: {
            elementId: "a",
            mode: "orbit",
            fixedPoint: [0.5001, 1],
          },
        }),
      ]),
    );

    expect(x.startBinding?.elementId).toBe("a");
    expect(x.endBinding).toBeNull();
    expect(a.boundElements).toEqual([{ id: "x", type: "arrow" }]);
  });

  describe("elbow arrows", () => {
    it("completes a binding in orbit mode when the endpoint is inside", () => {
      const { b, x } = byId(
        repairBindings([
          rect("b", 300, { y: 200 }),
          elbow("x", [102, 50], [320, 230], {
            endBinding: { elementId: "b" } as FixedPointBinding,
          }),
        ]),
      );

      expect(x.endBinding).toMatchObject({ elementId: "b", mode: "orbit" });
      // snapped outside the left side rather than kept inside
      expect(x.endBinding.fixedPoint[0]).toBeLessThan(0);
      expect(b.boundElements).toEqual([{ id: "x", type: "arrow" }]);
      expect(isOrthogonal(x)).toBe(true);
    });

    it("completes a binding missing mode and fixedPoint as orbit", () => {
      const { x } = byId(
        repairBindings([
          rect("a"),
          elbow("x", [300, 50], [102, 50], {
            endBinding: { elementId: "a" } as FixedPointBinding,
          }),
        ]),
      );

      expect(x.endBinding.mode).toBe("orbit");
      expect(x.endBinding.fixedPoint).toHaveLength(2);
    });

    it.each([
      ["empty", []],
      // the normalized form of no fixed segments
      ["null", null],
      ["pinned", [{ index: 2, start: P(100, 0), end: P(100, 200) }]],
    ] as const)(
      "reroutes orthogonally to a moved target with %s fixed segments",
      (_, fixedSegments) => {
        const { x } = byId(
          repairBindings([
            // moved within binding distance of the endpoint
            rect("a", 505, { y: 230 }),
            elbow("x", [300, 50], [500, 250], {
              points: [P(0, 0), P(100, 0), P(100, 200), P(200, 200)],
              fixedSegments,
              endBinding: {
                elementId: "a",
                mode: "orbit",
                fixedPoint: [0, 0.5001],
              },
            } as Partial<ExcalidrawElbowArrowElement>),
          ]),
        );

        // elbow arrows end exactly at their fixed point
        const [endX, endY] = x.points[x.points.length - 1];
        expect(x.x + endX).toBeCloseTo(505, 0);
        expect(x.y + endY).toBeCloseTo(280, 0);
        expect(isOrthogonal(x)).toBe(true);
        expect(x.fixedSegments ?? []).toHaveLength(fixedSegments?.length ?? 0);
      },
    );

    it.each([
      ["a to b", "start"],
      ["b to a", "end"],
    ] as const)(
      "decides both end bindings before moving either, bound %s",
      (_, aEnd) => {
        const bEnd = aEnd === "start" ? "end" : "start";
        // falls 50px short of a, and ends far below b
        const route: [number, number][] = [
          [150, 10],
          [550, 10],
          [550, 500],
        ];
        if (aEnd === "end") {
          route.reverse();
        }
        const [[x0, y0]] = route;
        const { a, b, x } = byId(
          repairBindings([
            rect("a", 0, { height: 20 }),
            rect("b", 500, { height: 20 }),
            elbow("x", route[0], route[2], {
              points: route.map(([px, py]) => P(px - x0, py - y0)),
              [`${aEnd}Binding`]: {
                elementId: "a",
                mode: "orbit",
                fixedPoint: [1, 0.5001],
              },
              [`${bEnd}Binding`]: {
                elementId: "b",
                mode: "orbit",
                fixedPoint: [0.5001, 1],
              },
            } as Partial<ExcalidrawElbowArrowElement>),
          ]),
        );
        const point = (startOrEnd: "start" | "end") => {
          const [px, py] =
            x.points[startOrEnd === "start" ? 0 : x.points.length - 1];
          return [x.x + px, x.y + py];
        };

        expect(x[`${aEnd}Binding`]?.elementId).toBe("a");
        expect(point(aEnd)[0]).toBeCloseTo(100 + getBindingGap(a), 0);
        expect(x[`${bEnd}Binding`]).toBeNull();
        expect(point(bEnd)[0]).toBeCloseTo(550);
        expect(point(bEnd)[1]).toBeCloseTo(500);
        expect(a.boundElements).toEqual([{ id: "x", type: "arrow" }]);
        expect(b.boundElements ?? []).toEqual([]);
        expect(isOrthogonal(x)).toBe(true);
      },
    );

    it("does not mutate the fixed segments of the input", () => {
      // collinear with the previous segment, so normalization merges them
      const segment = Object.freeze({
        index: 2,
        start: P(40, 0),
        end: P(80, 0),
      });
      const input = elbow("x", [0, 0], [200, 100], {
        points: [P(0, 0), P(40, 0), P(80, 0), P(80, 100), P(200, 100)],
        fixedSegments: [segment],
      } as Partial<ExcalidrawElbowArrowElement>);
      const snapshot = JSON.stringify(input);

      repairBindings([input]);

      expect(JSON.stringify(input)).toBe(snapshot);
    });

    it("drops a dangling binding and keeps the route orthogonal", () => {
      const { x } = byId(
        repairBindings([
          elbow("x", [0, 0], [200, 100], {
            startBinding: {
              elementId: "missing",
              mode: "orbit",
              fixedPoint: [1, 0.5001],
            },
          }),
        ]),
      );

      expect(x.startBinding).toBeNull();
      expect(isOrthogonal(x)).toBe(true);
    });

    it("normalizes the fixed point of complete bindings", () => {
      const { x } = byId(
        repairBindings([
          rect("a"),
          elbow("x", [300, 10], [102, 50], {
            endBinding: {
              elementId: "a",
              mode: "orbit",
              fixedPoint: [1.06, 0.5],
            },
          }),
        ]),
      );

      expect(x.endBinding.fixedPoint).toEqual([1.06, 0.5001]);
      expect(isOrthogonal(x)).toBe(true);
    });

    it("normalizes a declared inside binding to orbit", () => {
      const { x } = byId(
        repairBindings([
          rect("a"),
          elbow("x", [300, 10], [90, 50], {
            endBinding: {
              elementId: "a",
              mode: "inside",
              fixedPoint: [0.9, 0.5001],
            },
          }),
        ]),
      );

      expect(x.endBinding.mode).toBe("orbit");
      // re-derived onto the outline, just outside the right side
      expect(x.endBinding.fixedPoint[0]).toBeGreaterThan(1);
      expect(isOrthogonal(x)).toBe(true);
    });
  });
});

describe("unbindBindingElement", () => {
  it("unbinds an arrow whose target is missing", () => {
    const x = arrow("x", [0, 0], [100, 0], {
      endBinding: {
        elementId: "missing",
        mode: "orbit",
        fixedPoint: [0, 0.5001],
      },
    });
    const scene = new Scene([x], { skipValidation: true });

    expect(unbindBindingElement(x, "end", scene)).toBe("missing");
    expect(x.endBinding).toBeNull();
  });
});
