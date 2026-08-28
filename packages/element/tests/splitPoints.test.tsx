import { vi } from "vitest";

import { pointFrom } from "@excalidraw/math";
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

import type { LocalPoint } from "@excalidraw/math";

import { RoughGenerator } from "roughjs/bin/generator";

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
import { generateLinearCollisionShape } from "../src/shape";
import { LinearElementEditor } from "../src/linearElementEditor";

import type { ExcalidrawArrowElement, NonDeleted } from "../src/types";

const { h } = window;
const mouse = new Pointer("mouse");

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
    points: [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(100, 100),
      pointFrom<LocalPoint>(200, 0),
    ],
    ...overrides,
  }) as NonDeleted<ExcalidrawArrowElement>;

describe("arrow split points", () => {
  describe("helpers", () => {
    it("only curved simple arrows can be split", () => {
      expect(canSplitPoints(createArrow())).toBe(true);
      expect(canSplitPoints(createArrow({ roundness: null }))).toBe(false);
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
            type: "line",
            roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
          }),
        ),
      ).toBe(false);
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
      const ops = drawable.sets[0].ops;

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

    const fivePointArrow = () =>
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

      // the second curve starts exactly at the split point, points[1]
      expect(split.querySelector("path")!.getAttribute("d")).toContain(
        "M100 100",
      );
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

    const selectArrow = (arrow: NonDeleted<ExcalidrawArrowElement>) => {
      API.setElements([arrow]);
      API.setSelectedElements([arrow]);
      act(() => {
        h.setState({
          selectedLinearElement: new LinearElementEditor(
            arrow,
            arrayToMap(h.elements),
          ),
        });
      });
    };

    it("toggles a split on the point under the cursor", () => {
      const arrow = createArrow({ x: 100, y: 100 });
      selectArrow(arrow);

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

    it("does not split sharp arrows", () => {
      const arrow = createArrow({ x: 100, y: 100, roundness: null });
      selectArrow(arrow);

      mouse.doubleClickAt(200, 200);
      expect((h.elements[0] as ExcalidrawArrowElement).splitPoints).toEqual(
        null,
      );
    });

    it("does not split arrow endpoints", () => {
      const arrow = createArrow({ x: 100, y: 100 });
      selectArrow(arrow);

      mouse.doubleClickAt(100, 100);
      expect((h.elements[0] as ExcalidrawArrowElement).splitPoints).toEqual(
        null,
      );
    });
  });
});
