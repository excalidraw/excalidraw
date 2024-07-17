import { type LineSegment } from "../../utils";
import BinaryHeap from "../binaryheap";
import type { Heading } from "../math";
import {
  HEADING_DOWN,
  HEADING_LEFT,
  HEADING_RIGHT,
  HEADING_UP,
  PointInTriangle,
  addVectors,
  arePointsEqual,
  pointToVector,
  rotatePoint,
  scalePointFromOrigin,
  scaleVector,
  subtractVectors,
  translatePoint,
  vectorToHeading,
} from "../math";
import { getSizeFromPoints } from "../points";
import { getElementAtPosition } from "../scene/comparisons";
import type Scene from "../scene/Scene";
import type { Point } from "../types";
import { toBrandedType, tupleToCoors } from "../utils";
import {
  bindPointToSnapToElementOutline,
  distanceToBindableElement,
  avoidRectangularCorner,
  snapToMid,
  FIXED_BINDING_DISTANCE,
  bindingBorderTest,
} from "./binding";
import type { Bounds } from "./bounds";
import { LinearElementEditor } from "./linearElementEditor";
import { mutateElement } from "./mutateElement";
import { isBindableElement, isRectanguloidElement } from "./typeChecks";
import type {
  NonDeleted,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "./types";
import {
  type ElementsMap,
  type ExcalidrawArrowElement,
  type ExcalidrawBindableElement,
  type ExcalidrawElement,
  type OrderedExcalidrawElement,
  type PointBinding,
} from "./types";

type Node = {
  f: number;
  g: number;
  h: number;
  closed: boolean;
  visited: boolean;
  parent: Node | null;
  pos: Point;
  addr: [number, number];
};

type Grid = {
  row: number;
  col: number;
  data: (Node | null)[];
};

export const mutateElbowArrow = (
  arrow: ExcalidrawArrowElement,
  scene: Scene,
  nextPoints: readonly Point[],
  offset?: Point,
  otherUpdates?: {
    startBinding?: PointBinding | null;
    endBinding?: PointBinding | null;
  },
  options?: {
    changedElements?: Map<string, OrderedExcalidrawElement>;
    isDragging?: boolean;
    disableBinding?: boolean;
    informMutation?: boolean;
  },
) => {
  const elements = options?.changedElements
    ? [
        ...scene.getNonDeletedElements(),
        ...[...options?.changedElements].map(([_, value]) => value),
      ]
    : scene.getNonDeletedElements();
  const elementsMap = options?.changedElements
    ? // Only relevant at redrawBoundArrows during history actions
      toBrandedType<NonDeletedSceneElementsMap>(
        new Map([
          ...scene.getNonDeletedElementsMap(),
          ...options?.changedElements,
        ]),
      )
    : scene.getNonDeletedElementsMap();
  const [origStartElement, origEndElement] = [
    arrow.startBinding &&
      getBindableElementForId(arrow.startBinding.elementId, elementsMap),
    arrow.endBinding &&
      getBindableElementForId(arrow.endBinding.elementId, elementsMap),
  ];
  let [startGlobalPoint, endGlobalPoint] = [
    translatePoint(nextPoints[0], [
      arrow.x + (offset ? offset[0] : 0),
      arrow.y + (offset ? offset[1] : 0),
    ]),
    translatePoint(nextPoints[nextPoints.length - 1], [
      arrow.x + (offset ? offset[0] : 0),
      arrow.y + (offset ? offset[1] : 0),
    ]),
  ];
  const [startElement, endElement] = [
    options?.isDragging
      ? getHoveredElement(startGlobalPoint, elements, elementsMap)
      : origStartElement,
    options?.isDragging
      ? getHoveredElement(endGlobalPoint, elements, elementsMap)
      : origEndElement,
  ];
  if (options?.isDragging) {
    const startSnap =
      startElement &&
      bindPointToSnapToElementOutline(
        startGlobalPoint,
        startElement,
        elementsMap,
      );
    const endSnap =
      endElement &&
      bindPointToSnapToElementOutline(endGlobalPoint, endElement, elementsMap);
    startGlobalPoint =
      startElement && startSnap
        ? isRectanguloidElement(startElement)
          ? snapToMid(
              startElement,
              avoidRectangularCorner(startElement, startSnap),
            )
          : startSnap
        : startGlobalPoint;
    endGlobalPoint =
      endElement && endSnap
        ? isRectanguloidElement(endElement)
          ? snapToMid(endElement, avoidRectangularCorner(endElement, endSnap))
          : endSnap
        : endGlobalPoint;
  } else {
    startGlobalPoint = origStartElement
      ? bindPointToSnapToElementOutline(
          startGlobalPoint,
          origStartElement,
          elementsMap,
        )
      : startGlobalPoint;
    endGlobalPoint = origEndElement
      ? bindPointToSnapToElementOutline(
          endGlobalPoint,
          origEndElement,
          elementsMap,
        )
      : endGlobalPoint;
  }

  const [startHeading, endHeading] = [
    startElement
      ? headingForPointFromElement(
          startElement,
          aabbForElement(
            startElement,
            Array(4).fill(
              distanceToBindableElement(
                startElement,
                startGlobalPoint,
                elementsMap,
              ),
            ) as [number, number, number, number],
          ),
          startGlobalPoint,
        )
      : vectorToHeading(pointToVector(endGlobalPoint, startGlobalPoint)),
    endElement
      ? headingForPointFromElement(
          endElement,
          aabbForElement(
            endElement,
            Array(4).fill(
              distanceToBindableElement(
                endElement,
                endGlobalPoint,
                elementsMap,
              ),
            ) as [number, number, number, number],
          ),
          endGlobalPoint,
        )
      : vectorToHeading(pointToVector(startGlobalPoint, endGlobalPoint)),
  ];
  const [startBounds, endBounds] = [
    startElement
      ? aabbForElement(
          startElement,
          offsetFromHeading(startHeading, FIXED_BINDING_DISTANCE * 2),
        )
      : ([
          // Start point
          startGlobalPoint[0] - 2,
          startGlobalPoint[1] - 2,
          startGlobalPoint[0] + 2,
          startGlobalPoint[1] + 2,
        ] as Bounds),
    endElement
      ? aabbForElement(
          endElement,
          offsetFromHeading(endHeading, FIXED_BINDING_DISTANCE * 2),
        )
      : ([
          // End point
          endGlobalPoint[0] - 2,
          endGlobalPoint[1] - 2,
          endGlobalPoint[0] + 2,
          endGlobalPoint[1] + 2,
        ] as Bounds),
  ];
  const common = commonAABB([startBounds, endBounds]);
  const dynamicAABBs = generateDynamicAABBs(
    startBounds,
    endBounds,
    common,
    !startElement && !endElement ? 0 : 20,
  );
  const startDonglePosition = getDonglePosition(
    dynamicAABBs[0],
    startHeading,
    startGlobalPoint,
  );
  const endDonglePosition = getDonglePosition(
    dynamicAABBs[1],
    endHeading,
    endGlobalPoint,
  );
  const boundingBoxes = [...(dynamicAABBs ?? [])].filter(
    (aabb) => aabb !== null,
  );

  // Canculate Grid positions
  const grid = calculateGrid(
    boundingBoxes,
    startDonglePosition ? startDonglePosition : startGlobalPoint,
    startHeading,
    endDonglePosition ? endDonglePosition : endGlobalPoint,
    endHeading,
    common,
  );
  const startDongle =
    startDonglePosition && pointToGridNode(startDonglePosition, grid);
  const endDongle =
    endDonglePosition && pointToGridNode(endDonglePosition, grid);

  // Do not allow stepping on the true end or true start points
  const endNode = pointToGridNode(endGlobalPoint, grid);
  if (endNode && endElement) {
    endNode.closed = true;
  }
  const startNode = pointToGridNode(startGlobalPoint, grid);
  if (startNode && arrow.startBinding) {
    startNode.closed = true;
  }
  const overlap =
    dynamicAABBs.length === 2 &&
    startDongle &&
    endDongle &&
    (pointInsideBounds(startDongle.pos, dynamicAABBs[1]) ||
      pointInsideBounds(endDongle.pos, dynamicAABBs[0]));

  // Create path to end dongle from start dongle
  const path = astar(
    startDongle ? startDongle : startNode!,
    endDongle ? endDongle : endNode!,
    grid,
    startHeading ? startHeading : HEADING_RIGHT,
    endHeading ? endHeading : HEADING_RIGHT,
    overlap ? [] : boundingBoxes,
  );

  if (path) {
    const points = path.map((node) => [node.pos[0], node.pos[1]]) as Point[];
    startDongle && points.unshift(startGlobalPoint);
    endDongle && points.push(endGlobalPoint);

    mutateElement(
      arrow,
      {
        ...otherUpdates,
        ...normalizedArrowElementUpdate(simplifyElbowArrowPoints(points), 0, 0),
        angle: 0,
        roundness: null,
      },
      options?.informMutation,
    );
  } else {
    console.error("Elbow arrow cannot find a route");
  }
};

const offsetFromHeading = (
  heading: Heading,
  head: number,
): [number, number, number, number] => {
  const side = 1;
  switch (heading) {
    case HEADING_UP:
      return [head, side, side, side];
    case HEADING_RIGHT:
      return [side, head, side, side];
    case HEADING_DOWN:
      return [side, side, head, side];
  }

  return [side, side, side, head];
};

/**
 * Routing algorithm.
 */
const astar = (
  start: Node,
  end: Node,
  grid: Grid,
  startHeading: Heading,
  endHeading: Heading,
  aabbs: Bounds[],
) => {
  const bendMultiplier = m_dist(start.pos, end.pos);
  const open = new BinaryHeap<Node>((node) => node.f);

  open.push(start);

  while (open.size() > 0) {
    // Grab the lowest f(x) to process next.  Heap keeps this sorted for us.
    const current = open.pop();

    if (!current || current.closed) {
      // Current is not passable, continue with next element
      continue;
    }

    // End case -- result has been found, return the traced path.
    if (current === end) {
      return pathTo(start, current);
    }

    // Normal case -- move current from open to closed, process each of its neighbors.
    current.closed = true;

    // Find all neighbors for the current node.
    const neighbors = getNeighbors(current.addr, grid);

    for (let i = 0; i < 4; i++) {
      const neighbor = neighbors[i];

      if (!neighbor || neighbor.closed) {
        // Not a valid node to process, skip to next neighbor.
        continue;
      }

      // Intersect
      const neighborHalfPoint = scalePointFromOrigin(
        neighbor.pos,
        current.pos,
        0.5,
      );
      if (
        isAnyTrue(
          ...aabbs.map((aabb) => pointInsideBounds(neighborHalfPoint, aabb)),
        )
      ) {
        continue;
      }

      // The g score is the shortest distance from start to current node.
      // We need to check if the path we have arrived at this neighbor is the shortest one we have seen yet.
      const neighborHeading = neighborIndexToHeading(i as 0 | 1 | 2 | 3);
      const previousDirection = current.parent
        ? vectorToHeading(pointToVector(current.pos, current.parent.pos))
        : startHeading;

      // Do not allow going in reverse
      const reverseHeading = scaleVector(previousDirection, -1);
      const neighborIsReverseRoute =
        arePointsEqual(reverseHeading, neighborHeading) ||
        (arePointsEqual(start.addr, neighbor.addr) &&
          arePointsEqual(neighborHeading, startHeading)) ||
        (arePointsEqual(end.addr, neighbor.addr) &&
          arePointsEqual(neighborHeading, endHeading));
      if (neighborIsReverseRoute) {
        continue;
      }

      const directionChange = previousDirection !== neighborHeading;
      const gScore =
        current.g +
        m_dist(neighbor.pos, current.pos) +
        (directionChange ? Math.pow(bendMultiplier, 3) : 0);

      const beenVisited = neighbor.visited;

      if (!beenVisited || gScore < neighbor.g) {
        const estBendCount = estimateSegmentCount(
          neighbor,
          end,
          neighborHeading,
          endHeading,
        );
        // Found an optimal (so far) path to this node.  Take score for node to see how good it is.
        neighbor.visited = true;
        neighbor.parent = current;
        neighbor.h =
          m_dist(end.pos, neighbor.pos) +
          estBendCount * Math.pow(bendMultiplier, 2);
        neighbor.g = gScore;
        neighbor.f = neighbor.g + neighbor.h;
        if (!beenVisited) {
          // Pushing to heap will put it in proper place based on the 'f' value.
          open.push(neighbor);
        } else {
          // Already seen the node, but since it has been rescored we need to reorder it in the heap
          open.rescoreElement(neighbor);
        }
      }
    }
  }

  return null;
};

const pathTo = (start: Node, node: Node) => {
  let curr = node;
  const path = [];
  while (curr.parent) {
    path.unshift(curr);
    curr = curr.parent;
  }
  path.unshift(start);

  return path;
};

const m_dist = (a: Point, b: Point) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

/**
 * Create a dynamically resizing bounding box for the given heading
 */
const generateDynamicAABBs = (
  a: Bounds,
  b: Bounds,
  common: Bounds,
  offset?: number,
): Bounds[] => {
  const first = [
    a[0] > b[2]
      ? a[1] > b[3] || a[3] < b[1]
        ? Math.min((a[0] + b[2]) / 2, a[0] - (offset ?? 0))
        : (a[0] + b[2]) / 2
      : a[0] > b[0]
      ? a[0] - (offset ?? 0)
      : common[0] - (offset ?? 0),
    a[1] > b[3]
      ? a[0] > b[2] || a[2] < b[0]
        ? Math.min((a[1] + b[3]) / 2, a[1] - (offset ?? 0))
        : (a[1] + b[3]) / 2
      : a[1] > b[1]
      ? a[1] - (offset ?? 0)
      : common[1] - (offset ?? 0),
    a[2] < b[0]
      ? a[1] > b[3] || a[3] < b[1]
        ? Math.max((a[2] + b[0]) / 2, a[2] + (offset ?? 0))
        : (a[2] + b[0]) / 2
      : a[2] < b[2]
      ? a[2] + (offset ?? 0)
      : common[2] + (offset ?? 0),
    a[3] < b[1]
      ? a[0] > b[2] || a[2] < b[0]
        ? Math.max((a[3] + b[1]) / 2, a[3] + (offset ?? 0))
        : (a[3] + b[1]) / 2
      : a[3] < b[3]
      ? a[3] + (offset ?? 0)
      : common[3] + (offset ?? 0),
  ] as Bounds;
  const second = [
    b[0] > a[2]
      ? b[1] > a[3] || b[3] < a[1]
        ? Math.min((b[0] + a[2]) / 2, b[0] - (offset ?? 0))
        : (b[0] + a[2]) / 2
      : b[0] > a[0]
      ? b[0] - (offset ?? 0)
      : common[0] - (offset ?? 0),
    b[1] > a[3]
      ? b[0] > a[2] || b[2] < a[0]
        ? Math.min((b[1] + a[3]) / 2, b[1] - (offset ?? 0))
        : (b[1] + a[3]) / 2
      : b[1] > a[1]
      ? b[1] - (offset ?? 0)
      : common[1] - (offset ?? 0),
    b[2] < a[0]
      ? b[1] > a[3] || b[3] < a[1]
        ? Math.max((b[2] + a[0]) / 2, b[2] + (offset ?? 0))
        : (b[2] + a[0]) / 2
      : b[2] < a[2]
      ? b[2] + (offset ?? 0)
      : common[2] + (offset ?? 0),
    b[3] < a[1]
      ? b[0] > a[2] || b[2] < a[0]
        ? Math.max((b[3] + a[1]) / 2, b[3] + (offset ?? 0))
        : (b[3] + a[1]) / 2
      : b[3] < a[3]
      ? b[3] + (offset ?? 0)
      : common[3] + (offset ?? 0),
  ] as Bounds;

  const c = commonAABB([first, second]);

  if (
    first[2] - first[0] + second[2] - second[0] > c[2] - c[0] + 0.00000000001 &&
    first[3] - first[1] + second[3] - second[1] > c[3] - c[1] + 0.00000000001
  ) {
    const offsetX = Math.min(
      offset ?? 0,
      (first[2] - first[0] + (second[2] - second[0]) - (c[2] - c[0])) / 2,
    );
    const offsetY = Math.min(
      offset ?? 0,
      (first[3] - first[1] + (second[3] - second[1]) - (c[3] - c[1])) / 2,
    );

    return [
      [
        first[0] + (offsetX === (offset ?? 0) ? 0 : offsetX),
        first[1] + (offsetY === (offset ?? 0) ? 0 : offsetY),
        first[2] - (offsetX === (offset ?? 0) ? 0 : offsetX),
        first[3] - (offsetY === (offset ?? 0) ? 0 : offsetY),
      ],
      [
        second[0] + (offsetX === (offset ?? 0) ? 0 : offsetX),
        second[1] + (offsetY === (offset ?? 0) ? 0 : offsetY),
        second[2] - (offsetX === (offset ?? 0) ? 0 : offsetX),
        second[3] - (offsetY === (offset ?? 0) ? 0 : offsetY),
      ],
    ];
  }

  return [first, second];
};

/**
 * Calculates the grid from which the node points are placed on
 * based on the axis-aligned bounding boxes.
 */
const calculateGrid = (
  aabbs: Bounds[],
  start: Point,
  startHeading: Heading,
  end: Point,
  endHeading: Heading,
  common: Bounds,
): Grid => {
  const horizontal = new Set<number>();
  const vertical = new Set<number>();

  if (startHeading === HEADING_LEFT || startHeading === HEADING_RIGHT) {
    vertical.add(start[1]);
  } else {
    horizontal.add(start[0]);
  }
  if (endHeading === HEADING_LEFT || endHeading === HEADING_RIGHT) {
    vertical.add(end[1]);
  } else {
    horizontal.add(end[0]);
  }

  aabbs.forEach((aabb) => {
    horizontal.add(aabb[0]);
    horizontal.add(aabb[2]);
    vertical.add(aabb[1]);
    vertical.add(aabb[3]);
  });

  horizontal.add(common[0]);
  horizontal.add(common[2]);
  vertical.add(common[1]);
  vertical.add(common[3]);

  const _vertical = Array.from(vertical).sort((a, b) => a - b); // TODO: Do we need sorting?
  const _horizontal = Array.from(horizontal).sort((a, b) => a - b); // TODO: Do we need sorting?

  return {
    row: _vertical.length,
    col: _horizontal.length,
    data: _vertical.flatMap((y, row) =>
      _horizontal.map(
        (x, col): Node => ({
          f: 0,
          g: 0,
          h: 0,
          closed: false,
          visited: false,
          parent: null,
          addr: [col, row] as [number, number],
          pos: [x, y] as Point,
        }),
      ),
    ),
  };
};

const isAnyTrue = (...args: boolean[]): boolean =>
  Math.max(...args.map((arg) => (arg ? 1 : 0))) > 0;

const getDonglePosition = (
  bounds: Bounds,
  heading: Heading,
  point: Point,
): Point => {
  switch (heading) {
    case HEADING_UP:
      return [point[0], bounds[1]];
    case HEADING_RIGHT:
      return [bounds[2], point[1]];
    case HEADING_DOWN:
      return [point[0], bounds[3]];
  }
  return [bounds[0], point[1]];
};

export const segmentsIntersectAt = (
  a: Readonly<LineSegment>,
  b: Readonly<LineSegment>,
): Point | null => {
  const r = subtractVectors(a[1], a[0]);
  const s = subtractVectors(b[1], b[0]);
  const denominator = crossProduct(r, s);

  if (denominator === 0) {
    return null;
  }

  const i = subtractVectors(b[0], a[0]);
  const u = crossProduct(i, r) / denominator;
  const t = crossProduct(i, s) / denominator;

  if (u === 0) {
    return null;
  }

  const p = addVectors(a[0], scaleVector(r, t));

  if (t > 0 && t < 1 && u > 0 && u < 1) {
    return p;
  }

  return null;
};

export const crossProduct = (a: Point, b: Point): number =>
  a[0] * b[1] - a[1] * b[0];

const estimateSegmentCount = (
  start: Node,
  end: Node,
  startHeading: Heading,
  endHeading: Heading,
) => {
  if (endHeading === HEADING_RIGHT) {
    switch (startHeading) {
      case HEADING_RIGHT: {
        if (start.pos[0] >= end.pos[0]) {
          return 4;
        }
        if (start.pos[1] === end.pos[1]) {
          return 0;
        }
        return 2;
      }
      case HEADING_UP:
        if (start.pos[1] > end.pos[1] && start.pos[0] < end.pos[0]) {
          return 1;
        }
        return 3;
      case HEADING_DOWN:
        if (start.pos[1] < end.pos[1] && start.pos[0] < end.pos[0]) {
          return 1;
        }
        return 3;
      case HEADING_LEFT:
        if (start.pos[1] === end.pos[1]) {
          return 4;
        }
        return 2;
    }
  } else if (endHeading === HEADING_LEFT) {
    switch (startHeading) {
      case HEADING_RIGHT:
        if (start.pos[1] === end.pos[1]) {
          return 4;
        }
        return 2;
      case HEADING_UP:
        if (start.pos[1] > end.pos[1] && start.pos[0] > end.pos[0]) {
          return 1;
        }
        return 3;
      case HEADING_DOWN:
        if (start.pos[1] < end.pos[1] && start.pos[0] > end.pos[0]) {
          return 1;
        }
        return 3;
      case HEADING_LEFT:
        if (start.pos[0] <= end.pos[0]) {
          return 4;
        }
        if (start.pos[1] === end.pos[1]) {
          return 0;
        }
        return 2;
    }
  } else if (endHeading === HEADING_UP) {
    switch (startHeading) {
      case HEADING_RIGHT:
        if (start.pos[1] > end.pos[1] && start.pos[0] < end.pos[0]) {
          return 1;
        }
        return 3;
      case HEADING_UP:
        if (start.pos[1] >= end.pos[1]) {
          return 4;
        }
        if (start.pos[0] === end.pos[0]) {
          return 0;
        }
        return 2;
      case HEADING_DOWN:
        if (start.pos[0] === end.pos[0]) {
          return 4;
        }
        return 2;
      case HEADING_LEFT:
        if (start.pos[1] > end.pos[1] && start.pos[0] > end.pos[0]) {
          return 1;
        }
        return 3;
    }
  } else if (endHeading === HEADING_DOWN) {
    switch (startHeading) {
      case HEADING_RIGHT:
        if (start.pos[1] < end.pos[1] && start.pos[0] < end.pos[0]) {
          return 1;
        }
        return 3;
      case HEADING_UP:
        if (start.pos[0] === end.pos[0]) {
          return 4;
        }
        return 2;
      case HEADING_DOWN:
        if (start.pos[1] <= end.pos[1]) {
          return 4;
        }
        if (start.pos[0] === end.pos[0]) {
          return 0;
        }
        return 2;
      case HEADING_LEFT:
        if (start.pos[1] < end.pos[1] && start.pos[0] > end.pos[0]) {
          return 1;
        }
        return 3;
    }
  }
  return 0;
};

/**
 * Get neighboring points for a gived grid address
 */
const getNeighbors = ([col, row]: [number, number], grid: Grid) =>
  [
    gridNodeFromAddr([col, row - 1], grid),
    gridNodeFromAddr([col + 1, row], grid),
    gridNodeFromAddr([col, row + 1], grid),
    gridNodeFromAddr([col - 1, row], grid),
  ] as [Node | null, Node | null, Node | null, Node | null];

const gridNodeFromAddr = (
  [col, row]: [col: number, row: number],
  grid: Grid,
): Node | null => {
  if (col < 0 || col >= grid.col || row < 0 || row >= grid.row) {
    return null;
  }

  return grid.data[row * grid.col + col] ?? null;
};

/**
 * Get node for global point on canvas (if exists)
 */
const pointToGridNode = (point: Point, grid: Grid): Node | null => {
  for (let col = 0; col < grid.col; col++) {
    for (let row = 0; row < grid.row; row++) {
      const candidate = gridNodeFromAddr([col, row], grid);
      if (
        candidate &&
        point[0] === candidate.pos[0] &&
        point[1] === candidate.pos[1]
      ) {
        return candidate;
      }
    }
  }

  return null;
};

/**
 * Get the axis-aligned bounding box for a given element
 */
export const aabbForElement = (
  element: ExcalidrawElement,
  offset?: [number, number, number, number],
) => {
  const bbox = {
    minX: element.x,
    minY: element.y,
    maxX: element.x + element.width,
    maxY: element.y + element.height,
    midX: element.x + element.width / 2,
    midY: element.y + element.height / 2,
  };

  const center = [bbox.midX, bbox.midY] as Point;
  const [topLeftX, topLeftY] = rotatePoint(
    [bbox.minX, bbox.minY],
    center,
    element.angle,
  );
  const [topRightX, topRightY] = rotatePoint(
    [bbox.maxX, bbox.minY],
    center,
    element.angle,
  );
  const [bottomRightX, bottomRightY] = rotatePoint(
    [bbox.maxX, bbox.maxY],
    center,
    element.angle,
  );
  const [bottomLeftX, bottomLeftY] = rotatePoint(
    [bbox.minX, bbox.maxY],
    center,
    element.angle,
  );

  const bounds = [
    Math.min(topLeftX, topRightX, bottomRightX, bottomLeftX),
    Math.min(topLeftY, topRightY, bottomRightY, bottomLeftY),
    Math.max(topLeftX, topRightX, bottomRightX, bottomLeftX),
    Math.max(topLeftY, topRightY, bottomRightY, bottomLeftY),
  ] as Bounds;

  if (offset) {
    const [topOffset, rightOffset, downOffset, leftOffset] = offset;
    return [
      bounds[0] - leftOffset,
      bounds[1] - topOffset,
      bounds[2] + rightOffset,
      bounds[3] + downOffset,
    ] as Bounds;
  }

  return bounds;
};

// Gets the heading for the point by creating a bounding box around the rotated
// close fitting bounding box, then creating 4 search cones around the center of
// the external bbox.
export const headingForPointFromElement = (
  element: ExcalidrawBindableElement,
  aabb: Bounds,
  point: Point,
): Heading => {
  const SEARCH_CONE_MULTIPLIER = 2;

  const midPoint = getCenterForBounds(aabb);

  if (element.type === "diamond") {
    if (point[0] < element.x) {
      return HEADING_LEFT;
    } else if (point[1] < element.y) {
      return HEADING_UP;
    } else if (point[0] > element.x + element.width) {
      return HEADING_RIGHT;
    } else if (point[1] > element.y + element.height) {
      return HEADING_DOWN;
    }

    const top = rotatePoint(
      scalePointFromOrigin(
        [element.x + element.width / 2, element.y],
        midPoint,
        SEARCH_CONE_MULTIPLIER,
      ),
      midPoint,
      element.angle,
    );
    const right = rotatePoint(
      scalePointFromOrigin(
        [element.x + element.width, element.y + element.height / 2],
        midPoint,
        SEARCH_CONE_MULTIPLIER,
      ),
      midPoint,
      element.angle,
    );
    const bottom = rotatePoint(
      scalePointFromOrigin(
        [element.x + element.width / 2, element.y + element.height],
        midPoint,
        SEARCH_CONE_MULTIPLIER,
      ),
      midPoint,
      element.angle,
    );
    const left = rotatePoint(
      scalePointFromOrigin(
        [element.x, element.y + element.height / 2],
        midPoint,
        SEARCH_CONE_MULTIPLIER,
      ),
      midPoint,
      element.angle,
    );

    if (PointInTriangle(point, top, right, midPoint)) {
      return diamondHeading(top, right);
    } else if (PointInTriangle(point, right, bottom, midPoint)) {
      return diamondHeading(right, bottom);
    } else if (PointInTriangle(point, bottom, left, midPoint)) {
      return diamondHeading(bottom, left);
    }

    return diamondHeading(left, top);
  }

  const topLeft = scalePointFromOrigin(
    [aabb[0], aabb[1]],
    midPoint,
    SEARCH_CONE_MULTIPLIER,
  );
  const topRight = scalePointFromOrigin(
    [aabb[2], aabb[1]],
    midPoint,
    SEARCH_CONE_MULTIPLIER,
  );
  const bottomLeft = scalePointFromOrigin(
    [aabb[0], aabb[3]],
    midPoint,
    SEARCH_CONE_MULTIPLIER,
  );
  const bottomRight = scalePointFromOrigin(
    [aabb[2], aabb[3]],
    midPoint,
    SEARCH_CONE_MULTIPLIER,
  );

  return PointInTriangle(point, topLeft, topRight, midPoint)
    ? HEADING_UP
    : PointInTriangle(point, topRight, bottomRight, midPoint)
    ? HEADING_RIGHT
    : PointInTriangle(point, bottomRight, bottomLeft, midPoint)
    ? HEADING_DOWN
    : HEADING_LEFT;
};

const lineAngle = (a: Point, b: Point): number => {
  const theta = Math.atan2(b[1] - a[1], b[0] - a[0]) * (180 / Math.PI);
  return theta < 0 ? 360 + theta : theta;
};

const diamondHeading = (a: Point, b: Point) => {
  const angle = lineAngle(a, b);
  if (angle >= 315 || angle < 45) {
    return HEADING_UP;
  } else if (angle >= 45 && angle < 135) {
    return HEADING_RIGHT;
  } else if (angle >= 135 && angle < 225) {
    return HEADING_DOWN;
  }
  return HEADING_LEFT;
};

const commonAABB = (aabbs: Bounds[]): Bounds => [
  Math.min(...aabbs.map((aabb) => aabb[0])),
  Math.min(...aabbs.map((aabb) => aabb[1])),
  Math.max(...aabbs.map((aabb) => aabb[2])),
  Math.max(...aabbs.map((aabb) => aabb[3])),
];

/// UTILS

const getCenterForBounds = (bounds: Bounds): Point => [
  bounds[0] + (bounds[2] - bounds[0]) / 2,
  bounds[1] + (bounds[3] - bounds[1]) / 2,
];

const getBindableElementForId = (
  id: string,
  elementsMap: ElementsMap,
): ExcalidrawBindableElement | null => {
  const element = elementsMap.get(id);
  if (element && isBindableElement(element)) {
    return element;
  }

  return null;
};

const pointInsideBounds = (p: Point, bounds: Bounds): boolean =>
  p[0] > bounds[0] && p[0] < bounds[2] && p[1] > bounds[1] && p[1] < bounds[3];

const normalizedArrowElementUpdate = (
  global: Point[],
  externalOffsetX?: number,
  externalOffsetY?: number,
) => {
  const offsetX = global[0][0];
  const offsetY = global[0][1];

  const points = global.map(
    (point, _idx) => [point[0] - offsetX, point[1] - offsetY] as const,
  );

  return {
    points,
    x: offsetX + (externalOffsetX ?? 0),
    y: offsetY + (externalOffsetY ?? 0),
    ...getSizeFromPoints(points),
  };
};

/// If last and current segments have the same heading, skip the middle point
const simplifyElbowArrowPoints = (points: Point[]): Point[] =>
  points
    .slice(2)
    .reduce(
      (result, point) =>
        arePointsEqual(
          vectorToHeading(
            pointToVector(result[result.length - 1], result[result.length - 2]),
          ),
          vectorToHeading(pointToVector(point, result[result.length - 1])),
        )
          ? [...result.slice(0, -1), point]
          : [...result, point],
      [points[0] ?? [0, 0], points[1] ?? [1, 0]],
    );

const neighborIndexToHeading = (idx: number): Heading => {
  switch (idx) {
    case 0:
      return HEADING_UP;
    case 1:
      return HEADING_RIGHT;
    case 2:
      return HEADING_DOWN;
  }
  return HEADING_LEFT;
};

const getGlobalFixedPoints = (
  arrow: ExcalidrawArrowElement,
  elementsMap: ElementsMap,
) => {
  const startElement =
    arrow.startBinding && elementsMap.get(arrow.startBinding.elementId);
  const endElement =
    arrow.endBinding && elementsMap.get(arrow.endBinding.elementId);
  const startPoint: Point =
    startElement && arrow.startBinding
      ? rotatePoint(
          [
            startElement.x +
              startElement.width * arrow.startBinding.fixedPoint[0],
            startElement.y +
              startElement.height * arrow.startBinding.fixedPoint[1],
          ],
          [
            startElement.x + startElement.width / 2,
            startElement.y + startElement.height / 2,
          ],
          startElement.angle,
        )
      : [arrow.x + arrow.points[0][0], arrow.y + arrow.points[0][1]];
  const endPoint: Point =
    endElement && arrow.endBinding
      ? rotatePoint(
          [
            endElement.x + endElement.width * arrow.endBinding.fixedPoint[0],
            endElement.y + endElement.height * arrow.endBinding.fixedPoint[1],
          ],
          [
            endElement.x + endElement.width / 2,
            endElement.y + endElement.height / 2,
          ],
          endElement.angle,
        )
      : [
          arrow.x + arrow.points[arrow.points.length - 1][0],
          arrow.y + arrow.points[arrow.points.length - 1][1],
        ];

  return [startPoint, endPoint];
};

export const getArrowLocalFixedPoints = (
  arrow: ExcalidrawArrowElement,
  elementsMap: ElementsMap,
) => {
  const [startPoint, endPoint] = getGlobalFixedPoints(arrow, elementsMap);

  return [
    LinearElementEditor.pointFromAbsoluteCoords(arrow, startPoint, elementsMap),
    LinearElementEditor.pointFromAbsoluteCoords(arrow, endPoint, elementsMap),
  ];
};

const getHoveredElement = (
  p: Point,
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: NonDeletedSceneElementsMap,
) => {
  const hoveredElement = getElementAtPosition(
    elements,
    (element) =>
      isBindableElement(element, false) &&
      (bindingBorderTest(element, tupleToCoors(p), elementsMap) ||
        pointInsideBounds(p, aabbForElement(element))),
  );

  return hoveredElement as NonDeleted<ExcalidrawBindableElement> | null;
};
