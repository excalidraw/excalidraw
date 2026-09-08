import { vi } from "vitest";

import {
  distanceToLineSegment,
  lineSegment,
  pointFrom,
  polygonFromPoints,
  polygonIncludesPoint,
} from "@excalidraw/math";
import { pointsOnBezierCurves } from "points-on-curve";
import { ROUNDNESS, arrayToMap, reseed } from "@excalidraw/common";
import {
  Excalidraw,
  exportToCanvas,
  exportToSvg,
} from "@excalidraw/excalidraw";
import { actionDuplicateSelection } from "@excalidraw/excalidraw/actions";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { Pointer } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  act,
  render,
  unmountComponent,
} from "@excalidraw/excalidraw/tests/test-utils";
import { RoughGenerator } from "roughjs/bin/generator";

import type { GlobalPoint, LocalPoint, Radians } from "@excalidraw/math";

import {
  canSplitPoints,
  generateSplitCurves,
  getSplitPointGroups,
  getSplitPoints,
  isSplitPoint,
  shiftSplitPointsOnDelete,
  shiftSplitPointsOnDuplicate,
  shiftSplitPointsOnInsert,
  toggleSplitPoint,
} from "../src/splitPoints";
import { generateLinearCollisionShape, getElementShape } from "../src/shape";
import { LinearElementEditor } from "../src/linearElementEditor";
import {
  getElementBounds,
  getElementPointsCoords,
  getResizedElementAbsoluteCoords,
} from "../src/bounds";
import { transformElements } from "../src/resizeElements";

import type { Op } from "roughjs/bin/core";

import type {
  ExcalidrawArrowElement,
  ExcalidrawLineElement,
  ExcalidrawLinearElement,
  NonDeleted,
} from "../src/types";

const { h } = window;
const mouse = new Pointer("mouse");

const distanceToOutline = (point: LocalPoint, outline: readonly LocalPoint[]) =>
  Math.min(
    ...outline.map((vertex, idx) =>
      distanceToLineSegment(
        point,
        lineSegment(vertex, outline[(idx + 1) % outline.length]),
      ),
    ),
  );

const basePoints = () => [
  pointFrom<LocalPoint>(0, 0),
  pointFrom<LocalPoint>(100, 100),
  pointFrom<LocalPoint>(200, 0),
];

const createArrow = (
  overrides: Partial<ExcalidrawArrowElement> = {},
): NonDeleted<ExcalidrawArrowElement> =>
  API.createElement({
    type: "arrow",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    roughness: 0,
    roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
    points: basePoints(),
    ...overrides,
  }) as NonDeleted<ExcalidrawArrowElement>;

const createLine = (
  overrides: Partial<
    Pick<
      ExcalidrawLineElement,
      | "x"
      | "y"
      | "width"
      | "height"
      | "angle"
      | "points"
      | "roundness"
      | "splitPoints"
      | "polygon"
    >
  > = {},
): NonDeleted<ExcalidrawLineElement> =>
  API.createElement({
    type: "line",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    roughness: 0,
    roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
    points: basePoints(),
    ...overrides,
  }) as NonDeleted<ExcalidrawLineElement>;

describe("arrow and line split points", () => {
  describe("helpers", () => {
    it("only curved, non-elbow arrows and lines can be split", () => {
      expect(canSplitPoints(createArrow())).toBe(true);
      expect(canSplitPoints(createLine())).toBe(true);
      expect(canSplitPoints(createArrow({ roundness: null }))).toBe(false);
      expect(canSplitPoints(createLine({ roundness: null }))).toBe(false);
      expect(
        canSplitPoints(
          API.createElement({
            type: "arrow",
            elbowed: true,
            roundness: null,
          }),
        ),
      ).toBe(false);
      expect(
        canSplitPoints(
          API.createElement({
            type: "rectangle",
            roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
          }),
        ),
      ).toBe(false);
    });

    it("toggles a split on a curved line", () => {
      expect(toggleSplitPoint(createLine(), 1)).toEqual([1]);
      expect(toggleSplitPoint(createLine({ splitPoints: [1] }), 1)).toBe(null);
      expect(
        toggleSplitPoint(createLine({ roundness: null }), 1),
      ).toBeUndefined();
    });

    it("toggles a split on and off", () => {
      const arrow = createArrow();

      expect(toggleSplitPoint(arrow, 1)).toEqual([1]);
      expect(toggleSplitPoint(createArrow({ splitPoints: [1] }), 1)).toBe(null);
    });

    it("refuses to split endpoints or out-of-range indices", () => {
      const arrow = createArrow();

      expect(toggleSplitPoint(arrow, 0)).toBeUndefined();
      expect(toggleSplitPoint(arrow, 2)).toBeUndefined();
      expect(toggleSplitPoint(arrow, -1)).toBeUndefined();
      expect(toggleSplitPoint(arrow, 7)).toBeUndefined();
    });

    it("keeps split indices sorted and deduplicated", () => {
      const arrow = createArrow({
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(50, 50),
          pointFrom<LocalPoint>(100, 0),
          pointFrom<LocalPoint>(150, 50),
          pointFrom<LocalPoint>(200, 0),
        ],
        splitPoints: [3, 3],
      });

      expect(toggleSplitPoint(arrow, 1)).toEqual([1, 3]);
    });

    it("ignores stale indices when reading splits", () => {
      const arrow = createArrow({ splitPoints: [1, 5] });

      expect(getSplitPoints(arrow)).toEqual([1]);
      expect(isSplitPoint(arrow, 1)).toBe(true);
      expect(isSplitPoint(arrow, 5)).toBe(false);
    });

    it("shifts split indices when a point is inserted", () => {
      const arrow = createArrow({
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(50, 50),
          pointFrom<LocalPoint>(100, 0),
          pointFrom<LocalPoint>(150, 50),
          pointFrom<LocalPoint>(200, 0),
        ],
        splitPoints: [1, 3],
      });

      expect(shiftSplitPointsOnInsert(arrow, 2)).toEqual([1, 4]);
      expect(shiftSplitPointsOnInsert(arrow, 1)).toEqual([2, 4]);
      expect(shiftSplitPointsOnInsert(arrow, 4)).toEqual([1, 3]);
    });

    it("shifts split indices when points are deleted", () => {
      const arrow = createArrow({
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(50, 50),
          pointFrom<LocalPoint>(100, 0),
          pointFrom<LocalPoint>(150, 50),
          pointFrom<LocalPoint>(200, 0),
        ],
        splitPoints: [1, 3],
      });

      // deleting an unrelated earlier point shifts the later splits
      expect(shiftSplitPointsOnDelete(arrow, [2])).toEqual([1, 2]);
      // deleting a split point drops that split
      expect(shiftSplitPointsOnDelete(arrow, [1])).toEqual([2]);
      // splits that would land on an endpoint are dropped
      expect(shiftSplitPointsOnDelete(arrow, [0])).toEqual([2]);
    });

    it("shifts split indices when points are duplicated", () => {
      const arrow = createArrow({
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(50, 50),
          pointFrom<LocalPoint>(100, 0),
          pointFrom<LocalPoint>(150, 50),
          pointFrom<LocalPoint>(200, 0),
        ],
        splitPoints: [3],
      });

      // a copy lands after point 1, pushing the split one along
      expect(shiftSplitPointsOnDuplicate(arrow, [1])).toEqual([4]);
      // copies after two earlier points push it two along
      expect(shiftSplitPointsOnDuplicate(arrow, [0, 2])).toEqual([5]);
      // duplicating the split point itself keeps the split on the original
      expect(shiftSplitPointsOnDuplicate(arrow, [3])).toEqual([3]);
      // later points don't affect it
      expect(shiftSplitPointsOnDuplicate(arrow, [4])).toEqual([3]);
      expect(shiftSplitPointsOnDuplicate(arrow, [])).toBeUndefined();
    });

    it("remaps dormant split indices while the element is sharp", () => {
      // a sharp element keeps its splits so switching back to curved restores
      // the same corners — point edits made meanwhile still have to move them,
      // even though none of them render
      const sharp = createArrow({
        roundness: null,
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(50, 50),
          pointFrom<LocalPoint>(100, 0),
          pointFrom<LocalPoint>(150, 50),
          pointFrom<LocalPoint>(200, 0),
        ],
        splitPoints: [3],
      });

      expect(getSplitPoints(sharp)).toEqual([]);
      expect(shiftSplitPointsOnInsert(sharp, 2)).toEqual([4]);
      expect(shiftSplitPointsOnDuplicate(sharp, [1])).toEqual([4]);
      expect(shiftSplitPointsOnDelete(sharp, [1])).toEqual([2]);
    });

    it("groups points into overlapping runs", () => {
      const points = [0, 1, 2, 3, 4];

      expect(getSplitPointGroups(points, [])).toEqual([points]);
      expect(getSplitPointGroups(points, [2])).toEqual([
        [0, 1, 2],
        [2, 3, 4],
      ]);
      expect(getSplitPointGroups(points, [1, 3])).toEqual([
        [0, 1],
        [1, 2, 3],
        [3, 4],
      ]);
    });
  });

  describe("shape generation", () => {
    it("renders a split arrow as separate curves", () => {
      const elementsMap = arrayToMap([]);
      const unsplit = generateLinearCollisionShape(createArrow(), elementsMap);
      const split = generateLinearCollisionShape(
        createArrow({ splitPoints: [1] }),
        elementsMap,
      );

      // one `move` per curve — the split arrow is two disconnected curves
      expect(unsplit.filter((op) => op.op === "move")).toHaveLength(1);
      expect(split.filter((op) => op.op === "move")).toHaveLength(2);

      // the number of segments is unchanged, only their continuity
      expect(unsplit.filter((op) => op.op === "bcurveTo")).toHaveLength(2);
      expect(split.filter((op) => op.op === "bcurveTo")).toHaveLength(2);
    });

    it("renders a split line as separate curves", () => {
      const elementsMap = arrayToMap([]);
      const unsplit = generateLinearCollisionShape(createLine(), elementsMap);
      const split = generateLinearCollisionShape(
        createLine({ splitPoints: [1] }),
        elementsMap,
      );

      expect(unsplit.filter((op) => op.op === "move")).toHaveLength(1);
      expect(split.filter((op) => op.op === "move")).toHaveLength(2);
      expect(split.filter((op) => op.op === "bcurveTo")).toHaveLength(2);
    });

    it("fills a split polygon as a single region", () => {
      // the fill comes from the whole, unsplit curve — filling each split
      // group on its own would seam the polygon along the split
      const options = {
        seed: 1,
        roughness: 0,
        fill: "#000",
        fillStyle: "solid",
      };
      const points = [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(100, 100),
        pointFrom<LocalPoint>(200, 0),
        pointFrom<LocalPoint>(0, 0),
      ];
      const drawable = generateSplitCurves(
        new RoughGenerator(),
        points,
        [1],
        options,
      );
      const strokeSets = drawable.sets.filter((set) => set.type === "path");
      const fillOps = drawable.sets
        .filter((set) => set.type === "fillPath")
        .flatMap((set) => set.ops);

      // two separate stroked curves, each kept in its own set (rough.js draws
      // each of them twice)
      expect(strokeSets).toHaveLength(2);
      expect(
        strokeSets.map(
          (set) => set.ops.filter((op) => op.op === "move").length,
        ),
      ).toEqual([2, 2]);

      // the fill is a single region — filling each curve on its own would
      // seam them closed across the split
      expect(fillOps.filter((op) => op.op === "move")).toHaveLength(1);

      // ...and it follows the split contour, not the smooth one the element
      // no longer draws. At roughness 0 the fill shape is the outline.
      const firstPass = (ops: readonly Op[]) => {
        const passEnd = ops.findIndex((op, idx) => idx > 0 && op.op === "move");

        return passEnd === -1 ? ops : ops.slice(0, passEnd);
      };

      expect(fillOps.map((op) => op.data)).toEqual(
        strokeSets.flatMap((set, idx) =>
          firstPass(set.ops)
            // only the first curve keeps its `move`; the rest continue the
            // region from where the previous one ended
            .filter((op, opIdx) => idx === 0 || opIdx > 0)
            .map((op) => op.data),
        ),
      );
    });

    it("keeps a patterned fill inside the split outline", () => {
      const points = [...basePoints(), pointFrom<LocalPoint>(0, 0)];
      const options = {
        seed: 1,
        roughness: 0,
        fill: "#000",
        fillStyle: "hachure",
      };
      const drawable = generateSplitCurves(
        new RoughGenerator(),
        points,
        [1],
        options,
      );

      // the outline the element actually draws, as a polygon
      const outline = polygonFromPoints<LocalPoint>(
        drawable.sets
          .filter((set) => set.type === "path")
          .flatMap((set) => {
            const controlPoints: LocalPoint[] = [];

            for (const op of set.ops) {
              if (op.op === "move") {
                if (controlPoints.length) {
                  break;
                }
                controlPoints.push(pointFrom(op.data[0], op.data[1]));
              } else {
                controlPoints.push(
                  pointFrom(op.data[0], op.data[1]),
                  pointFrom(op.data[2], op.data[3]),
                  pointFrom(op.data[4], op.data[5]),
                );
              }
            }

            return pointsOnBezierCurves(controlPoints, 10, 5) as LocalPoint[];
          }),
      );

      const sketch = drawable.sets.find((set) => set.type === "fillSketch");

      expect(sketch).toBeDefined();

      // every hachure line the filler produced is clipped to the contour it
      // was given, so none of it may fall outside the outline
      const strayPoints = sketch!.ops
        .flatMap((op) => [
          pointFrom<LocalPoint>(op.data[0], op.data[1]),
          pointFrom<LocalPoint>(
            op.data[op.data.length - 2],
            op.data[op.data.length - 1],
          ),
        ])
        .filter(
          (point) =>
            !polygonIncludesPoint(point, outline) &&
            // the clip lands the endpoints exactly on the outline, where an
            // even-odd test is a coin flip
            distanceToOutline(point, outline) > 1,
        );

      expect(strayPoints).toEqual([]);
    });

    it("breaks tangent continuity only at the split point", () => {
      const elementsMap = arrayToMap([]);
      // outgoing control point of the curve arriving at points[1], and the
      // incoming control point of the curve leaving it
      const tangentsAt1 = (arrow: ExcalidrawArrowElement) => {
        const ops = generateLinearCollisionShape(arrow, elementsMap);
        const arriving = ops.filter((op) => op.op === "bcurveTo")[0];
        const leaving = ops.filter((op) => op.op === "bcurveTo")[1];

        return [
          // direction into points[1]
          [
            arriving.data[4] - arriving.data[2],
            arriving.data[5] - arriving.data[3],
          ],
          // direction out of points[1]
          [
            leaving.data[0] - arriving.data[4],
            leaving.data[1] - arriving.data[5],
          ],
        ];
      };

      const cross = ([a, b]: number[][]) => a[0] * b[1] - a[1] * b[0];

      // a smooth arrow keeps a single tangent direction through points[1]
      expect(cross(tangentsAt1(createArrow()))).toBeCloseTo(0, 5);
      // a split arrow turns a corner there
      expect(
        Math.abs(cross(tangentsAt1(createArrow({ splitPoints: [1] })))),
      ).toBeGreaterThan(1);
    });

    it("makes the split arrow pass exactly through the split point", () => {
      const elementsMap = arrayToMap([]);
      const arrow = createArrow({ splitPoints: [1] });
      const ops = generateLinearCollisionShape(arrow, elementsMap);

      // the first curve ends and the second one starts at points[1]
      const firstCurveEnd = ops[1].data.slice(-2);
      const secondCurveStart = ops[2].data;

      expect(firstCurveEnd[0]).toBeCloseTo(100, 5);
      expect(firstCurveEnd[1]).toBeCloseTo(100, 5);
      expect(secondCurveStart[0]).toBeCloseTo(100, 5);
      expect(secondCurveStart[1]).toBeCloseTo(100, 5);
    });

    it("makes consecutive curves touch at any roughness", () => {
      // rough.js `curve()` randomly offsets endpoints proportionally to
      // roughness (it ignores `preserveVertices`), so without pinning, each
      // multi-stroke pass of both curves would miss the shared vertex
      // independently
      const arrow = createArrow({ splitPoints: [1], roughness: 1 });
      const drawable = generateSplitCurves(
        new RoughGenerator(),
        arrow.points,
        getSplitPoints(arrow),
        { seed: arrow.seed, roughness: arrow.roughness },
      );
      const ops = drawable.sets
        .filter((set) => set.type === "path")
        .flatMap((set) => set.ops);

      // two curves × two multi-stroke passes
      const moveIndices = ops
        .map((op, idx) => (op.op === "move" ? idx : -1))
        .filter((idx) => idx !== -1);

      expect(moveIndices).toHaveLength(4);

      const strokeEndsAt = (startIdx: number) => {
        let idx = startIdx;
        while (idx + 1 < ops.length && ops[idx + 1].op !== "move") {
          idx++;
        }
        return ops[idx].data.slice(-2);
      };

      // both passes of the first curve end exactly on the split vertex, and
      // both passes of the second curve start exactly there too
      for (const [strokeIdx, moveIdx] of moveIndices.entries()) {
        const firstCurve = strokeIdx < 2;

        if (firstCurve) {
          expect(strokeEndsAt(moveIdx)).toEqual([100, 100]);
        } else {
          expect(ops[moveIdx].data).toEqual([100, 100]);
        }
      }
    });

    // the merged drawable holds one stroke pass per curve (two when rough.js
    // double strokes them), and each pass is its own chain of cubic control
    // points; the closed shape has to convert them separately
    it.each([
      ["solid", [1]],
      ["solid", [1, 2]],
      ["dashed", [1]],
      ["dashed", [1, 2]],
    ] as const)(
      "traces the whole outline of a %s filled split polygon (splits %j)",
      (strokeStyle, splitPoints) => {
        const closedPoints = [...basePoints(), pointFrom<LocalPoint>(0, 0)];
        const polygon = (splits?: readonly number[]) =>
          API.createElement({
            type: "line",
            x: 0,
            y: 0,
            width: 200,
            height: 100,
            roughness: 0,
            roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
            points: closedPoints,
            polygon: true,
            backgroundColor: "#000000",
            fillStyle: "solid",
            strokeStyle,
            splitPoints: splits,
          }) as NonDeleted<ExcalidrawLineElement>;

        const outlineBounds = (element: NonDeleted<ExcalidrawLineElement>) => {
          const shape = getElementShape<LocalPoint>(
            element,
            arrayToMap([element]),
          );

          expect(shape.type).toBe("polygon");

          const vertices = shape.data as LocalPoint[];

          return [
            Math.min(...vertices.map((p) => p[0])),
            Math.min(...vertices.map((p) => p[1])),
            Math.max(...vertices.map((p) => p[0])),
            Math.max(...vertices.map((p) => p[1])),
          ];
        };

        const [minX, minY, maxX, maxY] = outlineBounds(polygon(splitPoints));

        // the outline goes around every vertex of the polygon — keeping only
        // some of the curves would cut it short well inside these bounds. It
        // may overshoot a little, but only as much as the unsplit one does.
        expect(minX).toBeLessThanOrEqual(0);
        expect(minY).toBeLessThanOrEqual(0);
        expect(maxX).toBeGreaterThanOrEqual(200);
        expect(maxY).toBeGreaterThanOrEqual(100);

        // ...and it stays snug around them, rather than tracing any curve
        // more than once
        expect(minX).toBeGreaterThan(-10);
        expect(minY).toBeGreaterThan(-10);
        expect(maxX).toBeLessThan(210);
        expect(maxY).toBeLessThan(110);
      },
    );
  });

  describe("resizing", () => {
    beforeEach(async () => {
      unmountComponent();
      localStorage.clear();
      reseed(7);
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      h.state.width = 1000;
      h.state.height = 1000;
    });

    // splitting both interior points turns the smooth curve — which overshoots
    // the points on every side — into three straight segments, so the drawn
    // bounds are exactly [0, 0, 100, 100]
    const squareLine = () =>
      createLine({
        width: 100,
        height: 100,
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(0, 100),
          pointFrom<LocalPoint>(100, 100),
          pointFrom<LocalPoint>(100, 0),
        ],
        splitPoints: [1, 2],
      });

    it("measures a split line by its split curves, not by one smooth curve", () => {
      const line = squareLine();

      expect(
        getResizedElementAbsoluteCoords(line, line.width, line.height, true),
      ).toEqual(getElementPointsCoords(line, line.points));
    });

    const dragEastHandleTo = (
      line: NonDeleted<ExcalidrawLineElement>,
      pointerX: number,
    ) => {
      API.setElements([line]);
      API.setSelectedElements([line]);

      const [, y1, , y2] = getElementBounds(line, arrayToMap(h.elements));

      act(() => {
        transformElements(
          new Map([[line.id, line]]),
          "e",
          [h.elements[0] as NonDeleted<ExcalidrawLineElement>],
          h.app.scene,
          false,
          false,
          false,
          pointerX,
          (y1 + y2) / 2,
          0,
          0,
        );
      });

      return getElementBounds(h.elements[0], arrayToMap(h.elements));
    };

    it("does not jump when the pointer grabs a split line's handle", () => {
      // the handle sits on the drawn right edge, so scaling from there with
      // the pointer held still has to be a no-op
      const bounds = dragEastHandleTo(squareLine(), 100);

      bounds.forEach((coord, idx) =>
        expect(coord).toBeCloseTo([0, 0, 100, 100][idx]),
      );
    });

    it("scales a split line against the outline the handles sit on", () => {
      const bounds = dragEastHandleTo(squareLine(), 150);

      bounds.forEach((coord, idx) =>
        expect(coord).toBeCloseTo([0, 0, 150, 100][idx]),
      );
    });
  });

  describe("duplicating points", () => {
    beforeEach(async () => {
      unmountComponent();
      localStorage.clear();
      reseed(7);
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      h.state.width = 1000;
      h.state.height = 1000;
    });

    const fivePointArrow = (overrides: Partial<ExcalidrawArrowElement> = {}) =>
      createArrow({
        x: 0,
        y: 0,
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(50, 50),
          pointFrom<LocalPoint>(100, 0),
          pointFrom<LocalPoint>(150, 50),
          pointFrom<LocalPoint>(200, 0),
        ],
        splitPoints: [3],
        ...overrides,
      });

    const editWithSelectedPoint = (
      arrow: NonDeleted<ExcalidrawArrowElement>,
      pointIndex: number,
    ) => {
      API.setElements([arrow]);
      API.setSelectedElements([arrow]);
      act(() => {
        h.setState({
          selectedLinearElement: {
            ...new LinearElementEditor(arrow, arrayToMap(h.elements), true),
            selectedPointsIndices: [pointIndex],
          },
        });
      });
    };

    it("keeps the split on the same point when an earlier point is duplicated", () => {
      const arrow = fivePointArrow();
      const splitPointBefore = arrow.points[3];
      editWithSelectedPoint(arrow, 1);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      const updated = h.elements[0] as ExcalidrawArrowElement;

      expect(updated.points).toHaveLength(6);
      expect(updated.splitPoints).toEqual([4]);
      // the corner is still on the very same point, not its neighbour
      expect(updated.points[4]).toEqual(splitPointBefore);
    });

    it("keeps a dormant split on the same point while the arrow is sharp", () => {
      const arrow = fivePointArrow({ roundness: null });
      const splitPointBefore = arrow.points[3];
      editWithSelectedPoint(arrow, 1);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      const updated = h.elements[0] as ExcalidrawArrowElement;

      expect(updated.points).toHaveLength(6);
      // switching back to curved has to put the corner back where it was
      expect(updated.splitPoints).toEqual([4]);
      expect(updated.points[4]).toEqual(splitPointBefore);
    });

    it("keeps the split on the original when the split point itself is duplicated", () => {
      const arrow = fivePointArrow();
      editWithSelectedPoint(arrow, 3);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      const updated = h.elements[0] as ExcalidrawArrowElement;

      expect(updated.points).toHaveLength(6);
      expect(updated.splitPoints).toEqual([3]);
    });
  });

  describe("rotated elements", () => {
    beforeEach(async () => {
      unmountComponent();
      localStorage.clear();
      reseed(7);
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      h.state.width = 1000;
      h.state.height = 1000;
    });

    const worldPoints = (element: NonDeleted<ExcalidrawLinearElement>) =>
      element.points.map((_, index) =>
        LinearElementEditor.getPointAtIndexGlobalCoordinates(
          element,
          index,
          arrayToMap(h.elements),
        ),
      );

    const rotatedLine = (
      overrides: Parameters<typeof createLine>[0] = {},
    ): NonDeleted<ExcalidrawLineElement> =>
      createLine({
        x: 100,
        y: 100,
        width: 300,
        height: 200,
        angle: (Math.PI / 2) as Radians,
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(0, 200),
          pointFrom<LocalPoint>(200, 200),
          pointFrom<LocalPoint>(200, 0),
          pointFrom<LocalPoint>(300, 0),
        ],
        ...overrides,
      });

    it("keeps a rotated line's points in place when a corner is toggled", () => {
      // the points are rotated around the center of the curve's bounds, which
      // the split moves — the element origin has to absorb that
      const rotated = rotatedLine();
      API.setElements([rotated]);

      const before = worldPoints(rotated);

      act(() => {
        const element = h.elements[0] as NonDeleted<ExcalidrawLineElement>;
        LinearElementEditor.updateSplitPoints(
          element,
          h.app.scene,
          toggleSplitPoint(element, 2)!,
        );
      });

      const updated = h.elements[0] as ExcalidrawLineElement;

      expect(updated.splitPoints).toEqual([2]);
      worldPoints(updated as NonDeleted<ExcalidrawLineElement>).forEach(
        (point, index) => {
          expect(point[0]).toBeCloseTo(before[index][0]);
          expect(point[1]).toBeCloseTo(before[index][1]);
        },
      );
    });

    it("keeps a rotated line's remaining points in place when a point is deleted", () => {
      const rotated = rotatedLine({ splitPoints: [2] });
      API.setElements([rotated]);
      API.setSelectedElements([rotated]);

      const survivors = worldPoints(rotated).filter((_, index) => index !== 1);

      act(() => {
        LinearElementEditor.deletePoints(
          h.elements[0] as NonDeleted<ExcalidrawLineElement>,
          h.app,
          [1],
        );
      });

      const updated = h.elements[0] as NonDeleted<ExcalidrawLineElement>;

      expect(updated.points).toHaveLength(4);
      expect(updated.splitPoints).toEqual([1]);
      // the deleted point's neighbours must not drift: the compensation has to
      // compare the old points against the new ones under their own splits
      worldPoints(updated).forEach((point, index) => {
        expect(point[0]).toBeCloseTo(survivors[index][0]);
        expect(point[1]).toBeCloseTo(survivors[index][1]);
      });
    });

    it("leaves an unrotated line's origin alone", () => {
      const line = createLine({ splitPoints: null });
      API.setElements([line]);

      act(() => {
        LinearElementEditor.updateSplitPoints(line, h.app.scene, [1]);
      });

      const updated = h.elements[0] as ExcalidrawLineElement;

      expect(updated.splitPoints).toEqual([1]);
      expect(updated.x).toBe(line.x);
      expect(updated.y).toBe(line.y);
    });

    it("keeps a rotated line's points in place when a point is duplicated", () => {
      const rotated = rotatedLine();
      API.setElements([rotated]);
      API.setSelectedElements([rotated]);
      act(() => {
        h.setState({
          selectedLinearElement: {
            ...new LinearElementEditor(rotated, arrayToMap(h.elements), true),
            selectedPointsIndices: [1],
          },
        });
      });

      const before = worldPoints(rotated);

      act(() => {
        h.app.actionManager.executeAction(actionDuplicateSelection);
      });

      const updated = h.elements[0] as NonDeleted<ExcalidrawLineElement>;
      const after = worldPoints(updated);

      expect(updated.points).toHaveLength(6);
      // the copy lands at index 2, so the originals map 0,1,3,4 -> 0,1,3,4
      [0, 1, 3, 4].forEach((index, original) => {
        expect(after[index][0]).toBeCloseTo(before[original][0]);
        expect(after[index][1]).toBeCloseTo(before[original][1]);
      });
    });

    it("keeps a rotated line's points in place when a midpoint is added", () => {
      const rotated = rotatedLine();
      API.setElements([rotated]);
      API.setSelectedElements([rotated]);

      const editor = new LinearElementEditor(rotated, arrayToMap(h.elements));
      const before = worldPoints(rotated);

      act(() => {
        LinearElementEditor.addMidpoint(
          {
            ...editor,
            initialState: {
              ...editor.initialState,
              segmentMidpoint: {
                index: 2,
                value: pointFrom<GlobalPoint>(0, 0),
                added: false,
              },
            },
          } as LinearElementEditor,
          { x: 100, y: 300 },
          h.app,
          false,
          h.app.scene,
        );
      });

      const updated = h.elements[0] as NonDeleted<ExcalidrawLineElement>;
      const after = worldPoints(updated);

      expect(updated.points).toHaveLength(6);
      // the midpoint lands at index 2, so the originals map 0..4 -> 0,1,3,4,5
      [0, 1, 3, 4, 5].forEach((index, original) => {
        expect(after[index][0]).toBeCloseTo(before[original][0]);
        expect(after[index][1]).toBeCloseTo(before[original][1]);
      });
    });
  });

  describe("export", () => {
    beforeEach(async () => {
      unmountComponent();
      localStorage.clear();
      reseed(7);
      await render(<Excalidraw />);
    });

    const exportArrow = async (arrow: NonDeleted<ExcalidrawArrowElement>) =>
      exportToSvg({
        elements: [arrow],
        // @ts-ignore
        appState: { ...h.state, exportBackground: false },
        files: null,
        exportPadding: 0,
      });

    // roughjs draws each curve twice (multi-stroke), so an `M` count of 2 means
    // one continuous curve and 4 means two disconnected ones
    const countSubpaths = (svg: SVGSVGElement) =>
      Array.from(svg.querySelectorAll("path")).reduce(
        (acc, path) => acc + (path.getAttribute("d")?.match(/M/g)?.length ?? 0),
        0,
      );

    it("renders the split as separate subpaths in SVG exports", async () => {
      const unsplit = await exportArrow(createArrow());
      const split = await exportArrow(createArrow({ splitPoints: [1] }));

      expect(countSubpaths(unsplit)).toBe(2);
      expect(countSubpaths(split)).toBe(4);

      // each curve is exported as its own path element, and the second one
      // starts exactly at the split point, points[1]
      const paths = Array.from(split.querySelectorAll("path")).map((path) =>
        path.getAttribute("d"),
      );

      expect(unsplit.querySelectorAll("path")).toHaveLength(1);
      expect(paths).toHaveLength(2);
      expect(paths[1]).toContain("M100 100");
    });

    it("strokes both curves in canvas (PNG) exports", async () => {
      const moveTo = vi.spyOn(CanvasRenderingContext2D.prototype, "moveTo");

      const exportArrowToCanvas = async (
        arrow: NonDeleted<ExcalidrawArrowElement>,
      ) => {
        moveTo.mockClear();
        await exportToCanvas({
          elements: [arrow],
          // @ts-ignore
          appState: { ...h.state, exportBackground: false },
          files: null,
          exportPadding: 0,
        });
        return moveTo.mock.calls.length;
      };

      expect(await exportArrowToCanvas(createArrow())).toBe(2);
      expect(await exportArrowToCanvas(createArrow({ splitPoints: [1] }))).toBe(
        4,
      );

      moveTo.mockRestore();
    });
  });

  describe("double click", () => {
    beforeEach(async () => {
      unmountComponent();
      localStorage.clear();
      reseed(7);
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      h.state.width = 1000;
      h.state.height = 1000;
    });

    const edit = (
      element: NonDeleted<ExcalidrawLinearElement>,
      isEditing = true,
    ) => {
      API.setElements([element]);
      API.setSelectedElements([element]);
      act(() => {
        h.setState({
          selectedLinearElement: new LinearElementEditor(
            element,
            arrayToMap(h.elements),
            isEditing,
          ),
        });
      });
    };

    it("toggles a split on the arrow point under the cursor", () => {
      const arrow = createArrow({ x: 100, y: 100 });
      edit(arrow);

      // point 1 is at (200, 200) in scene coords
      mouse.doubleClickAt(200, 200);
      expect((h.elements[0] as ExcalidrawArrowElement).splitPoints).toEqual([
        1,
      ]);

      mouse.doubleClickAt(200, 200);
      expect((h.elements[0] as ExcalidrawArrowElement).splitPoints).toEqual(
        null,
      );
    });

    it("toggles a split on the line point under the cursor", () => {
      const line = createLine({ x: 100, y: 100 });
      edit(line);

      mouse.doubleClickAt(200, 200);
      expect((h.elements[0] as ExcalidrawLineElement).splitPoints).toEqual([1]);

      mouse.doubleClickAt(200, 200);
      expect((h.elements[0] as ExcalidrawLineElement).splitPoints).toEqual(
        null,
      );
    });

    it("does not split sharp arrows", () => {
      const arrow = createArrow({ x: 100, y: 100, roundness: null });
      edit(arrow);

      mouse.doubleClickAt(200, 200);
      expect((h.elements[0] as ExcalidrawArrowElement).splitPoints).toEqual(
        null,
      );
    });

    it("does not split endpoints", () => {
      const arrow = createArrow({ x: 100, y: 100 });
      edit(arrow);

      mouse.doubleClickAt(100, 100);
      expect((h.elements[0] as ExcalidrawArrowElement).splitPoints).toEqual(
        null,
      );
    });

    it("does not split outside the editor", () => {
      // a double-click keeps its usual meaning until the element is edited
      for (const element of [
        createArrow({ x: 100, y: 100 }),
        createLine({ x: 100, y: 100 }),
      ]) {
        edit(element, false);

        mouse.doubleClickAt(200, 200);
        expect(
          (h.elements[0] as NonDeleted<ExcalidrawLinearElement>).splitPoints,
        ).toEqual(null);
      }
    });
  });
});
