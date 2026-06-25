import { arrayToMap } from "@excalidraw/common";
import {
  pointFrom,
  rangeInclusive,
  type GlobalPoint,
  type Radians,
} from "@excalidraw/math";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getDefaultAppState } from "../appState";
import {
  getElementsCorners,
  getVisibleGaps,
  getReferenceSnapPoints,
  SnapCache,
  snapDraggedElements,
} from "../snapping";

import { API } from "./helpers/api";

import type {
  AppClassProperties,
  AppState,
  NormalizedZoomValue,
} from "../types";

type ReferenceSnapPoints = NonNullable<
  ReturnType<typeof SnapCache.getReferenceSnapPoints>
>;

const NO_MODIFIER_KEYS = {
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};

const createSnappingApp = (appState: Partial<AppState> = {}) =>
  ({
    props: {},
    state: {
      ...getDefaultAppState(),
      objectsSnapModeEnabled: true,
      width: 1000,
      height: 1000,
      offsetLeft: 0,
      offsetTop: 0,
      ...appState,
    },
  } as AppClassProperties);

const getHorizontalPointSnapLineCoordinates = (
  snapLines: ReturnType<typeof snapDraggedElements>["snapLines"],
) => {
  return snapLines
    .filter((snapLine) => snapLine.type === "points")
    .filter((snapLine) => {
      const [firstPoint, lastPoint] = snapLine.points;

      return firstPoint[1] === lastPoint[1];
    })
    .map((snapLine) => {
      return snapLine.points[0][1];
    })
    .sort((a, b) => a - b);
};

const getVerticalPointSnapLineCoordinates = (
  snapLines: ReturnType<typeof snapDraggedElements>["snapLines"],
) => {
  return snapLines
    .filter((snapLine) => snapLine.type === "points")
    .filter((snapLine) => {
      const [firstPoint, lastPoint] = snapLine.points;

      return firstPoint[0] === lastPoint[0];
    })
    .map((snapLine) => {
      return snapLine.points[0][0];
    })
    .sort((a, b) => a - b);
};

const getHorizontalPointSnapLineMaxX = (
  snapLines: ReturnType<typeof snapDraggedElements>["snapLines"],
) => {
  const horizontalSnapLine = snapLines
    .filter((snapLine) => snapLine.type === "points")
    .find((snapLine) => {
      const [firstPoint, lastPoint] = snapLine.points;

      return firstPoint[1] === lastPoint[1];
    });

  if (!horizontalSnapLine) {
    return null;
  }

  return horizontalSnapLine.points[horizontalSnapLine.points.length - 1][0];
};

const getHorizontalPointSnapLineXRange = (
  snapLines: ReturnType<typeof snapDraggedElements>["snapLines"],
) => {
  const horizontalSnapLine = snapLines
    .filter((snapLine) => snapLine.type === "points")
    .find((snapLine) => {
      const [firstPoint, lastPoint] = snapLine.points;

      return firstPoint[1] === lastPoint[1];
    });

  if (!horizontalSnapLine) {
    return null;
  }

  return [
    horizontalSnapLine.points[0][0],
    horizontalSnapLine.points[horizontalSnapLine.points.length - 1][0],
  ] as const;
};

const getHorizontalGapSnapLines = (
  snapLines: ReturnType<typeof snapDraggedElements>["snapLines"],
) => {
  return snapLines.filter(
    (snapLine) =>
      snapLine.type === "gap" && snapLine.direction === "horizontal",
  );
};

const getVerticalGapSnapLines = (
  snapLines: ReturnType<typeof snapDraggedElements>["snapLines"],
) => {
  return snapLines.filter(
    (snapLine) => snapLine.type === "gap" && snapLine.direction === "vertical",
  );
};

const getPointKeys = (points: ReturnType<typeof getElementsCorners>) => {
  return points.map((point) => point.join(","));
};

const getReferenceSnapPointKeys = (
  elements: ExcalidrawElement[],
  selectedElements: ExcalidrawElement[],
  app: AppClassProperties,
) => {
  return new Set(
    getReferenceSnapPoints(
      elements,
      selectedElements,
      app.state,
      arrayToMap(elements),
    ).map((snapPoint) => snapPoint.point.join(",")),
  );
};

const primeReferenceSnapPoints = (
  elements: ExcalidrawElement[],
  selectedElements: ExcalidrawElement[],
) => {
  const selectedElementIds = new Set(
    selectedElements.map((element) => element.id),
  );
  const elementsMap = arrayToMap(elements);

  SnapCache.setReferenceSnapPoints(
    elements
      .filter((element) => !selectedElementIds.has(element.id))
      .flatMap((element) => {
        const corners = getElementsCorners([element], elementsMap);

        return corners.map((point, index) => ({
          point,
          type: index === corners.length - 1 ? "center" : "outer",
          snapSourceId: element.id,
        }));
      }) as Parameters<typeof SnapCache.setReferenceSnapPoints>[0],
  );
};

describe("snapping", () => {
  afterEach(() => {
    SnapCache.destroy();
  });

  it("does not use frame children as references when snapping outside elements", () => {
    const frame = API.createElement({
      type: "frame",
      id: "frame",
      x: 0,
      y: 0,
      width: 300,
      height: 300,
    });
    const frameChild = API.createElement({
      type: "rectangle",
      id: "frameChild",
      x: 37,
      y: 53,
      width: 71,
      height: 83,
      frameId: frame.id,
    });
    const selected = API.createElement({
      type: "rectangle",
      id: "selected",
      x: 400,
      y: 50,
      width: 100,
      height: 100,
    });
    const elements = [frame, frameChild, selected];
    const app = createSnappingApp({
      selectedElementIds: { [selected.id]: true },
    });

    const referenceSnapPointKeys = getReferenceSnapPointKeys(
      elements,
      [selected],
      app,
    );
    const frameChildPointKeys = getPointKeys(
      getElementsCorners([frameChild], arrayToMap(elements)),
    );

    expect(
      frameChildPointKeys.some((pointKey) =>
        referenceSnapPointKeys.has(pointKey),
      ),
    ).toBe(false);
  });

  it("uses frame siblings as references when snapping elements in the same frame", () => {
    const frame = API.createElement({
      type: "frame",
      id: "frame",
      x: 0,
      y: 0,
      width: 300,
      height: 300,
    });
    const sibling = API.createElement({
      type: "rectangle",
      id: "sibling",
      x: 37,
      y: 53,
      width: 71,
      height: 83,
      frameId: frame.id,
    });
    const selected = API.createElement({
      type: "rectangle",
      id: "selected",
      x: 150,
      y: 50,
      width: 100,
      height: 100,
      frameId: frame.id,
    });
    const elements = [frame, sibling, selected];
    const app = createSnappingApp({
      selectedElementIds: { [selected.id]: true },
    });

    const referenceSnapPointKeys = getReferenceSnapPointKeys(
      elements,
      [selected],
      app,
    );
    const siblingPointKeys = getPointKeys(
      getElementsCorners([sibling], arrayToMap(elements)),
    );

    expect(
      siblingPointKeys.some((pointKey) => referenceSnapPointKeys.has(pointKey)),
    ).toBe(true);
  });

  it("does not use frame children as references when snapping the frame itself", () => {
    const frame = API.createElement({
      type: "frame",
      id: "frame",
      x: 0,
      y: 0,
      width: 300,
      height: 300,
    });
    const frameChild = API.createElement({
      type: "rectangle",
      id: "frameChild",
      x: 37,
      y: 53,
      width: 71,
      height: 83,
      frameId: frame.id,
    });
    const elements = [frame, frameChild];
    const app = createSnappingApp({
      selectedElementIds: { [frame.id]: true },
    });

    const referenceSnapPointKeys = getReferenceSnapPointKeys(
      elements,
      [frame],
      app,
    );
    const frameChildPointKeys = getPointKeys(
      getElementsCorners([frameChild], arrayToMap(elements)),
    );

    expect(
      frameChildPointKeys.some((pointKey) =>
        referenceSnapPointKeys.has(pointKey),
      ),
    ).toBe(false);
  });

  it("does not use frame children as visible gap references when snapping outside elements", () => {
    const frame = API.createElement({
      type: "frame",
      id: "frame",
      x: 0,
      y: 0,
      width: 500,
      height: 300,
    });
    const frameChildA = API.createElement({
      type: "rectangle",
      id: "frameChildA",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      frameId: frame.id,
    });
    const frameChildB = API.createElement({
      type: "rectangle",
      id: "frameChildB",
      x: 250,
      y: 50,
      width: 100,
      height: 100,
      frameId: frame.id,
    });
    const selected = API.createElement({
      type: "rectangle",
      id: "selected",
      x: 700,
      y: 50,
      width: 100,
      height: 100,
    });
    const elements = [frame, frameChildA, frameChildB, selected];
    const app = createSnappingApp({
      selectedElementIds: { [selected.id]: true },
    });

    const visibleGaps = getVisibleGaps(
      elements,
      [selected],
      app.state,
      arrayToMap(elements),
    );

    expect(visibleGaps.horizontalGaps).toHaveLength(0);
    expect(visibleGaps.verticalGaps).toHaveLength(0);
  });

  it("filters center and inner outer point snaplines for the same reference", () => {
    const angle = 0.68 as Radians;
    const reference = API.createElement({
      type: "rectangle",
      id: "reference",
      x: 0,
      y: 0,
      width: 140,
      height: 140,
      angle,
    });
    const selected = API.createElement({
      type: "rectangle",
      id: "selected",
      x: 200,
      y: 0,
      width: 140,
      height: 140,
      angle,
    });
    const elements = [reference, selected];
    const app = createSnappingApp({
      selectedElementIds: { [selected.id]: true },
    });

    primeReferenceSnapPoints(elements, [selected]);

    const { snapLines } = snapDraggedElements(
      elements,
      { x: 0, y: 0 },
      app,
      NO_MODIFIER_KEYS,
      arrayToMap(elements),
    );

    expect(getHorizontalPointSnapLineCoordinates(snapLines)).toHaveLength(2);
  });

  it("keeps a snapline that is redundant for one reference but needed for another", () => {
    const angle = 0.68 as Radians;
    const selected = API.createElement({
      type: "rectangle",
      id: "selected",
      x: 200,
      y: 0,
      width: 140,
      height: 140,
      angle,
    });
    const elements = [selected];
    const elementsMap = arrayToMap(elements);
    const selectedSnapPoints = getElementsCorners([selected], elementsMap);
    const outerSnapPoints = selectedSnapPoints.slice(0, -1);
    const centerSnapPoint = selectedSnapPoints[selectedSnapPoints.length - 1];
    const innerOuterSnapPoint = [...outerSnapPoints].sort(
      (a, b) => a[1] - b[1],
    )[1];
    const app = createSnappingApp({
      selectedElementIds: { [selected.id]: true },
    });

    const referenceSnapPoints: ReferenceSnapPoints = [
      ...outerSnapPoints.map((point) => ({
        point: pointFrom<GlobalPoint>(point[0] - 200, point[1]),
        type: "outer" as const,
        snapSourceId: "referenceA",
      })),
      {
        point: pointFrom<GlobalPoint>(
          centerSnapPoint[0] - 200,
          centerSnapPoint[1],
        ),
        type: "center" as const,
        snapSourceId: "referenceA",
      },
      {
        point: pointFrom<GlobalPoint>(
          innerOuterSnapPoint[0] - 300,
          innerOuterSnapPoint[1],
        ),
        type: "outer" as const,
        snapSourceId: "referenceB",
      },
    ];

    SnapCache.setReferenceSnapPoints(referenceSnapPoints);

    const { snapLines } = snapDraggedElements(
      elements,
      { x: 0, y: 0 },
      app,
      NO_MODIFIER_KEYS,
      elementsMap,
    );

    expect(getHorizontalPointSnapLineCoordinates(snapLines)).toHaveLength(3);
  });

  it("keeps a center snapline when no outer snaplines imply it", () => {
    const reference = API.createElement({
      type: "rectangle",
      id: "reference",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const selected = API.createElement({
      type: "rectangle",
      id: "selected",
      x: 200,
      y: 25,
      width: 50,
      height: 50,
    });
    const elements = [reference, selected];
    const app = createSnappingApp({
      selectedElementIds: { [selected.id]: true },
    });

    primeReferenceSnapPoints(elements, [selected]);

    const { snapLines } = snapDraggedElements(
      elements,
      { x: 0, y: 0 },
      app,
      NO_MODIFIER_KEYS,
      arrayToMap(elements),
    );

    expect(getHorizontalPointSnapLineCoordinates(snapLines)).toEqual([50]);
  });

  it("filters center snaplines when matching outer offsets differ by rounding precision", () => {
    const selected = API.createElement({
      type: "rectangle",
      id: "selected",
      x: 2532.227563984471,
      y: -1553.9657067952232,
      width: 140.1015625,
      height: 140.1015625,
    });
    const reference = API.createElement({
      type: "rectangle",
      id: "reference",
      x: 2532.2275640966914,
      y: -1299.4323092037737,
      width: 140.1015625,
      height: 140.1015625,
    });
    const elements = [reference, selected];
    const app = createSnappingApp({
      selectedElementIds: { [selected.id]: true },
    });

    primeReferenceSnapPoints(elements, [selected]);

    const { snapLines } = snapDraggedElements(
      elements,
      { x: 0, y: 0 },
      app,
      NO_MODIFIER_KEYS,
      arrayToMap(elements),
    );

    expect(getVerticalPointSnapLineCoordinates(snapLines)).toEqual([
      2532.227564, 2672.329126,
    ]);
  });

  it("keeps outer snaplines stable while dragging a snapped element through rounding-equivalent offsets", () => {
    const referenceMiddle = API.createElement({
      type: "rectangle",
      id: "referenceMiddle",
      x: 2532.22756398447,
      y: -1553.9657067952237,
      width: 140.1015625,
      height: 140.1015625,
    });
    const referenceAbove = API.createElement({
      type: "rectangle",
      id: "referenceAbove",
      x: 2532.2275637826165,
      y: -1779.7363232531268,
      width: 140.1015625,
      height: 140.1015625,
    });
    const selected = API.createElement({
      type: "rectangle",
      id: "selected",
      x: 2532.227563096691,
      y: -1328.1950902037736,
      width: 140.1015625,
      height: 140.1015625,
    });
    const elements = [referenceAbove, referenceMiddle, selected];
    const app = createSnappingApp({
      selectedElementIds: { [selected.id]: true },
    });

    primeReferenceSnapPoints(elements, [selected]);

    for (const dragOffsetX of [-4, -1, -0.1, 0, 0.1, 1, 4]) {
      const { snapLines } = snapDraggedElements(
        elements,
        { x: dragOffsetX, y: 0 },
        app,
        NO_MODIFIER_KEYS,
        arrayToMap(elements),
      );
      const coordinates = getVerticalPointSnapLineCoordinates(snapLines);

      expect(coordinates).toHaveLength(2);
      expect(coordinates[1] - coordinates[0]).toBeCloseTo(selected.width, 5);
    }
  });

  it("keeps same-offset point snaps even across distant references", () => {
    const selected = API.createElement({
      type: "rectangle",
      id: "selected",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const elements = [selected];
    const app = createSnappingApp({
      selectedElementIds: { [selected.id]: true },
    });

    SnapCache.setReferenceSnapPoints([
      {
        point: pointFrom<GlobalPoint>(220, 50),
        type: "center",
        snapSourceId: "near",
      },
      {
        point: pointFrom<GlobalPoint>(900, 50),
        type: "center",
        snapSourceId: "far",
      },
    ]);

    const { snapLines } = snapDraggedElements(
      elements,
      { x: 0, y: 0 },
      app,
      NO_MODIFIER_KEYS,
      arrayToMap(elements),
    );

    expect(getHorizontalPointSnapLineMaxX(snapLines)).toBe(900);
  });

  it("prefers a nearby point snap over a slightly better far offset", () => {
    const selected = API.createElement({
      type: "rectangle",
      id: "selected",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const elements = [selected];
    const app = createSnappingApp({
      selectedElementIds: { [selected.id]: true },
    });

    SnapCache.setReferenceSnapPoints([
      {
        point: pointFrom<GlobalPoint>(220, 54),
        type: "center",
        snapSourceId: "near",
      },
      {
        point: pointFrom<GlobalPoint>(900, 50),
        type: "center",
        snapSourceId: "far",
      },
    ]);

    const { snapOffset, snapLines } = snapDraggedElements(
      elements,
      { x: 0, y: 0 },
      app,
      NO_MODIFIER_KEYS,
      arrayToMap(elements),
    );

    expect(snapOffset.y).toBe(4);
    expect(getHorizontalPointSnapLineMaxX(snapLines)).toBe(220);
  });

  it("keeps same-offset point snaps when references form a continuous cluster", () => {
    const selected = API.createElement({
      type: "rectangle",
      id: "selected",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const elements = [selected];
    const app = createSnappingApp({
      selectedElementIds: { [selected.id]: true },
    });

    SnapCache.setReferenceSnapPoints([
      {
        point: pointFrom<GlobalPoint>(200, 50),
        type: "center",
        snapSourceId: "referenceA",
      },
      {
        point: pointFrom<GlobalPoint>(350, 50),
        type: "center",
        snapSourceId: "referenceB",
      },
      {
        point: pointFrom<GlobalPoint>(500, 50),
        type: "center",
        snapSourceId: "referenceC",
      },
    ]);

    const { snapLines } = snapDraggedElements(
      elements,
      { x: 0, y: 0 },
      app,
      NO_MODIFIER_KEYS,
      arrayToMap(elements),
    );

    expect(getHorizontalPointSnapLineMaxX(snapLines)).toBe(500);
  });

  it("keeps same-source same-offset point snaps across zoom-scaled cluster breaks", () => {
    const reference = API.createElement({
      type: "rectangle",
      id: "reference",
      x: 0,
      y: 0,
      width: 140.1015625,
      height: 140.1015625,
    });
    const selected = API.createElement({
      type: "rectangle",
      id: "selected",
      x: 338.608871112217,
      y: 0,
      width: 140.1015625,
      height: 140.1015625,
    });
    const elements = [reference, selected];
    const app = createSnappingApp({
      selectedElementIds: { [selected.id]: true },
      zoom: { value: 1.5 as NormalizedZoomValue },
    });

    primeReferenceSnapPoints(elements, [selected]);

    const { snapLines } = snapDraggedElements(
      elements,
      { x: 0, y: 0 },
      app,
      NO_MODIFIER_KEYS,
      arrayToMap(elements),
    );

    const range = getHorizontalPointSnapLineXRange(snapLines);

    expect(range).not.toBe(null);
    expect(range![0]).toBeCloseTo(reference.x, 6);
    expect(range![1]).toBeCloseTo(selected.x + selected.width, 6);
  });

  it("renders gap snaplines when rounded bounds touch the reference gap overlap", () => {
    const selected = API.createElement({
      type: "rectangle",
      id: "selected",
      x: 0,
      y: 0.0000004,
      width: 100,
      height: 100,
    });
    const elements = [selected];
    const app = createSnappingApp({
      selectedElementIds: { [selected.id]: true },
    });

    SnapCache.setVisibleGaps({
      horizontalGaps: [
        {
          startBounds: [200, -100, 300, 0],
          endBounds: [400, -100, 500, 0],
          startSide: [pointFrom(300, -100), pointFrom(300, 0)],
          endSide: [pointFrom(400, -100), pointFrom(400, 0)],
          overlap: rangeInclusive(-100, 0),
          length: 100,
        },
      ],
      verticalGaps: [],
    });

    const { snapLines } = snapDraggedElements(
      elements,
      { x: 0, y: 0 },
      app,
      NO_MODIFIER_KEYS,
      arrayToMap(elements),
    );

    expect(getHorizontalGapSnapLines(snapLines)).toHaveLength(2);
  });

  it("renders gap snaplines when the winning gap offset only differs by rounding precision", () => {
    const selected = API.createElement({
      type: "rectangle",
      id: "selected",
      x: 0,
      y: 399.999999,
      width: 100,
      height: 100,
    });
    const elements = [selected];
    const app = createSnappingApp({
      selectedElementIds: { [selected.id]: true },
    });

    SnapCache.setReferenceSnapPoints([
      {
        point: pointFrom<GlobalPoint>(0, 399.999999),
        type: "outer",
        snapSourceId: "reference",
      },
    ]);
    SnapCache.setVisibleGaps({
      horizontalGaps: [],
      verticalGaps: [
        {
          startBounds: [0, 100, 100, 200],
          endBounds: [0, 250, 100, 350],
          startSide: [pointFrom(0, 200), pointFrom(100, 200)],
          endSide: [pointFrom(0, 250), pointFrom(100, 250)],
          overlap: rangeInclusive(0, 100),
          length: 50,
        },
      ],
    });

    const { snapLines } = snapDraggedElements(
      elements,
      { x: 0, y: 0 },
      app,
      NO_MODIFIER_KEYS,
      arrayToMap(elements),
    );

    expect(getVerticalGapSnapLines(snapLines)).toHaveLength(2);
  });
});
