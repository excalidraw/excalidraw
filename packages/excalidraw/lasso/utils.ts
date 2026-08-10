import { simplify } from "points-on-curve";

import {
  polygonFromPoints,
  lineSegment,
  pointFrom,
  pointOnLineSegment,
  polygonIncludesPointNonZero,
  PRECISION,
} from "@excalidraw/math";

import { type Bounds } from "@excalidraw/common";

import {
  boundsContainBounds,
  computeBoundTextPosition,
  doBoundsIntersect,
  elementOverlapsWithFrame,
  getBoundTextElement,
  getContainingFrame,
  getElementBounds,
  intersectElementWithLineSegment,
  isBoundToContainer,
  pointInsideBoundsInclusive,
} from "@excalidraw/element";

import type {
  ElementsSegmentsMap,
  GlobalPoint,
  LineSegment,
  Polygon,
} from "@excalidraw/math/types";
import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";

import type { BoxSelectionMode } from "../types";

export const getLassoSelectedElementIds = (input: {
  lassoPath: GlobalPoint[];
  elements: readonly ExcalidrawElement[];
  elementsMap: ElementsMap;
  elementsSegments: ElementsSegmentsMap;
  intersectedElements: Set<ExcalidrawElement["id"]>;
  enclosedElements: Set<ExcalidrawElement["id"]>;
  simplifyDistance?: number;
  mode?: BoxSelectionMode;
}): {
  selectedElementIds: string[];
} => {
  const {
    lassoPath,
    elements,
    elementsMap,
    elementsSegments,
    intersectedElements,
    enclosedElements,
    simplifyDistance,
    mode = "contain",
  } = input;
  // simplify the path to reduce the number of points
  let path: GlobalPoint[] = lassoPath;
  if (simplifyDistance) {
    path = simplify(lassoPath, simplifyDistance) as GlobalPoint[];
  }
  // bound text is never selected on its own, it's covered by its container
  const selectableElements = elements.filter(
    (el) => !el.locked && !isBoundToContainer(el),
  );
  // as the path might not enclose a shape anymore, clear before checking
  enclosedElements.clear();
  intersectedElements.clear();
  const lassoBounds = lassoPath.reduce(
    (acc, item) => {
      return [
        Math.min(acc[0], item[0]),
        Math.min(acc[1], item[1]),
        Math.max(acc[2], item[0]),
        Math.max(acc[3], item[1]),
      ];
    },
    [Infinity, Infinity, -Infinity, -Infinity],
  ) as Bounds;
  const lassoPolygon = polygonFromPoints(path);
  const containBounds: Bounds = [
    lassoBounds[0] - PRECISION,
    lassoBounds[1] - PRECISION,
    lassoBounds[2] + PRECISION,
    lassoBounds[3] + PRECISION,
  ];

  for (const element of selectableElements) {
    // Only the visible (frame-clipped) portion of an element is relevant for
    // selection, so everything outside of its frame is disregarded below
    const bounds = getElementBounds(element, elementsMap);
    const clipBounds = getFrameClipBounds(element, bounds, elementsMap);

    // First check if the lasso segment intersects the element's axis-aligned
    // bounding box as it is much faster than checking intersection against
    // the element's shape
    const elementBounds = clipToBounds(bounds, clipBounds);

    if (
      doBoundsIntersect(lassoBounds, elementBounds) &&
      !intersectedElements.has(element.id) &&
      !enclosedElements.has(element.id)
    ) {
      if (
        mode === "contain" &&
        !boundsContainBounds(containBounds, elementBounds)
      ) {
        continue;
      }

      const segments = getSelectionSegments(
        element,
        elementsMap,
        elementsSegments,
        clipBounds,
      );
      const enclosed = enclosureTest(
        lassoPolygon,
        segments,
        elementBounds,
        mode,
      );
      if (mode === "contain") {
        if (
          enclosed &&
          !intersectionTest(path, element, elementsMap, clipBounds)
        ) {
          enclosedElements.add(element.id);
        }
      } else if (enclosed) {
        enclosedElements.add(element.id);
      } else if (intersectionTest(path, element, elementsMap, clipBounds)) {
        intersectedElements.add(element.id);
      }
    }
  }

  const results =
    mode === "contain"
      ? excludeIncompleteGroups([...enclosedElements], elementsMap)
      : [...intersectedElements, ...enclosedElements];

  return {
    selectedElementIds: results,
  };
};

/**
 * The bounds an element is clipped to by the frame containing it, or `null`
 * when the element isn't clipped at all.
 */
const getFrameClipBounds = (
  element: ExcalidrawElement,
  elementBounds: Bounds,
  elementsMap: ElementsMap,
): Bounds | null => {
  const frame = getContainingFrame(element, elementsMap);

  if (!frame) {
    return null;
  }

  const frameBounds = getElementBounds(frame, elementsMap);

  // nothing is clipped away from an element fitting inside its frame
  if (boundsContainBounds(frameBounds, elementBounds)) {
    return null;
  }

  return elementOverlapsWithFrame(element, frame, elementsMap)
    ? frameBounds
    : null;
};

const clipToBounds = (bounds: Bounds, clipBounds: Bounds | null): Bounds =>
  clipBounds
    ? [
        Math.max(bounds[0], clipBounds[0]),
        Math.max(bounds[1], clipBounds[1]),
        Math.min(bounds[2], clipBounds[2]),
        Math.min(bounds[3], clipBounds[3]),
      ]
    : bounds;

/**
 * The segments taking part in the selection tests: the element's own outline
 * together with its label's, clipped to the element's containing frame.
 */
const getSelectionSegments = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  elementsSegments: ElementsSegmentsMap,
  clipBounds: Bounds | null,
): LineSegment<GlobalPoint>[] => {
  const elementSegments = elementsSegments.get(element.id) ?? [];
  const boundTextElement = getBoundTextElement(element, elementsMap);
  const boundTextSegments = boundTextElement
    ? elementsSegments.get(boundTextElement.id)
    : null;

  const segments = boundTextSegments?.length
    ? [...elementSegments, ...boundTextSegments]
    : elementSegments;

  return clipBounds ? clipSegmentsToBounds(segments, clipBounds) : segments;
};

const clipSegmentsToBounds = (
  segments: LineSegment<GlobalPoint>[],
  bounds: Bounds,
): LineSegment<GlobalPoint>[] => {
  const [minX, minY, maxX, maxY] = bounds;
  const clipped: LineSegment<GlobalPoint>[] = [];

  for (const [[x1, y1], [x2, y2]] of segments) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let t0 = 0;
    let t1 = 1;
    let inside = true;

    // clip the segment against each of the four edges in turn, narrowing down
    // the [t0, t1] portion of it which lies inside the bounds
    for (const [p, q] of [
      [-dx, x1 - minX],
      [dx, maxX - x1],
      [-dy, y1 - minY],
      [dy, maxY - y1],
    ]) {
      if (p === 0) {
        // parallel to this edge: either entirely inside or entirely outside
        if (q < 0) {
          inside = false;
          break;
        }
        continue;
      }

      const t = q / p;
      if (p < 0) {
        if (t > t1) {
          inside = false;
          break;
        }
        t0 = Math.max(t0, t);
      } else {
        if (t < t0) {
          inside = false;
          break;
        }
        t1 = Math.min(t1, t);
      }
    }

    if (inside) {
      clipped.push(
        lineSegment(
          pointFrom<GlobalPoint>(x1 + t0 * dx, y1 + t0 * dy),
          pointFrom<GlobalPoint>(x1 + t1 * dx, y1 + t1 * dy),
        ),
      );
    }
  }

  return clipped;
};

/**
 * In "contain" mode a group is only selected if every one of its members is,
 * mirroring marquee selection.
 *
 * NOTE: currently we only support top-level group handling since we don't
 * support box selecting while editing the group/subgroup
 */
const excludeIncompleteGroups = (
  selectedElementIds: ExcalidrawElement["id"][],
  elementsMap: ElementsMap,
): ExcalidrawElement["id"][] => {
  if (!selectedElementIds.some((id) => elementsMap.get(id)?.groupIds.length)) {
    return selectedElementIds;
  }

  const groups = new Map<string, ExcalidrawElement["id"][]>();

  for (const element of elementsMap.values()) {
    const groupId = element.groupIds.at(-1);

    // ignored elements such as bound text and locked elements must not
    // affect group selection
    if (!groupId || element.locked || isBoundToContainer(element)) {
      continue;
    }

    const group = groups.get(groupId);
    if (group) {
      group.push(element.id);
    } else {
      groups.set(groupId, [element.id]);
    }
  }

  if (!groups.size) {
    return selectedElementIds;
  }

  const selected = new Set(selectedElementIds);

  return selectedElementIds.filter((id) => {
    const groupId = elementsMap.get(id)?.groupIds.at(-1);
    const group = groupId ? groups.get(groupId) : null;

    return !group || group.every((memberId) => selected.has(memberId));
  });
};

const enclosureTest = (
  lassoPolygon: Polygon<GlobalPoint>,
  segments: LineSegment<GlobalPoint>[],
  elementBounds: Bounds,
  mode: BoxSelectionMode,
): boolean => {
  const quantifier = mode === "contain" ? "every" : "some";

  const includesPoint = (point: GlobalPoint) =>
    polygonIncludesPointNonZero(point, lassoPolygon) ||
    (mode === "contain" && isPointOnPolygon(point, lassoPolygon));

  // NOTE: elements without an outline (e.g. a single point freedraw dot) are
  // tested by the corners of their bounding box instead
  if (segments.length === 0) {
    return boundsCorners(elementBounds)[quantifier](includesPoint);
  }

  return segments[quantifier]((segment) => segment[quantifier](includesPoint));
};

const boundsCorners = ([minX, minY, maxX, maxY]: Bounds): GlobalPoint[] => [
  pointFrom(minX, minY),
  pointFrom(maxX, minY),
  pointFrom(maxX, maxY),
  pointFrom(minX, maxY),
];

const isPointOnPolygon = (
  point: GlobalPoint,
  polygon: Polygon<GlobalPoint>,
): boolean =>
  polygon.some(
    (vertex, index) =>
      index > 0 &&
      pointOnLineSegment(point, lineSegment(polygon[index - 1], vertex)),
  );

const intersectionTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
  clipBounds: Bounds | null,
): boolean => {
  const lassoSegments = lassoPath
    .slice(1)
    .map((point: GlobalPoint, index) => lineSegment(lassoPath[index], point))
    .concat([lineSegment(lassoPath[lassoPath.length - 1], lassoPath[0])]);

  const boundTextElement = getBoundTextElement(element, elementsMap);

  // hits on the part of the element clipped away by its frame are invisible,
  // hence they do not count as an intersection
  const intersects = (
    target: ExcalidrawElement,
    lassoSegment: LineSegment<GlobalPoint>,
  ) => {
    const hits = intersectElementWithLineSegment(
      target,
      elementsMap,
      lassoSegment,
      0,
      !clipBounds,
    );

    return clipBounds
      ? hits.some((hit) => pointInsideBoundsInclusive(hit, clipBounds))
      : hits.length > 0;
  };

  return lassoSegments.some(
    (lassoSegment) =>
      intersects(element, lassoSegment) ||
      (!!boundTextElement &&
        intersects(
          {
            ...boundTextElement,
            ...computeBoundTextPosition(element, boundTextElement, elementsMap),
          },
          lassoSegment,
        )),
  );
};
