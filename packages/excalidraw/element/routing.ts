import BinaryHeap from "../binaryheap";
import type { Heading } from "../math";
import {
  HEADING_DOWN,
  HEADING_LEFT,
  HEADING_RIGHT,
  HEADING_UP,
  PointInTriangle,
  arePointsEqual,
  magnitudeSq,
  pointToVector,
  rotatePoint,
  scalePointFromOrigin,
  translatePoint,
  vectorToHeading,
} from "../math";
import type Scene from "../scene/Scene";
import type { Point } from "../types";
import { debugClear, debugDrawPoint, debugDrawSegments } from "../visualdebug";
import { distanceToBindableElement, maxBindingGap } from "./binding";
import type { Bounds } from "./bounds";
import { mutateElement } from "./mutateElement";
import { isBindableElement } from "./typeChecks";
import type {
  ElementsMap,
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElement,
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
  offset: Point,
) => {
  debugClear();

  const [startGlobalPoint, endGlobalPoint] = [
    translatePoint(nextPoints[0], [arrow.x, arrow.y]),
    translatePoint(nextPoints[nextPoints.length - 1], [arrow.x, arrow.y]),
  ];
  const elementsMap = scene.getNonDeletedElementsMap();
  const [startElement, endElement] = [
    // TODO: Memoize
    arrow.startBinding &&
      getBindableElementForId(arrow.startBinding.elementId, elementsMap),
    arrow.endBinding &&
      getBindableElementForId(arrow.endBinding.elementId, elementsMap),
  ];

  const [startAABB, endAABB] = [
    // TODO: Memoize
    startElement && aabbForElement(startElement),
    endElement && aabbForElement(endElement),
  ];

  const bias = Math.max(
    // TODO: Memoize
    startElement
      ? maxBindingGap(startElement, startElement.width, startElement.height)
      : 0,
    endElement
      ? maxBindingGap(endElement, endElement.width, endElement.height)
      : 0,
  );

  const common = commonAABB(
    [
      startElement && aabbForElement(startElement, bias),
      endElement && aabbForElement(endElement, bias),
    ].filter((x) => x !== null) as Bounds[],
  );

  const [startHeading, endHeading] = [
    startElement &&
      headingForPointOnElement(
        startElement,
        aabbForElement(
          startElement,
          distanceToBindableElement(
            startElement,
            startGlobalPoint,
            elementsMap,
          ),
        ),
        startGlobalPoint,
      ),
    endElement &&
      headingForPointOnElement(
        endElement,
        aabbForElement(
          endElement,
          distanceToBindableElement(endElement, endGlobalPoint, elementsMap),
        ),
        endGlobalPoint,
      ),
  ];

  console.log(
    [startElement?.x, startElement?.y],
    [
      startElement?.x ?? 0 + (arrow.endBinding?.fixedPoint[0] ?? 0),
      startElement?.y ?? 0 + (arrow.endBinding?.fixedPoint[1] ?? 0),
    ],
  );

  const grid = calculateGrid(
    [startAABB, endAABB].filter((aabb) => aabb !== null) as Bounds[],
    [common],
    startGlobalPoint,
    startHeading,
    endGlobalPoint,
    endHeading,
    0.001, // TODO: Is this even needed?
  );

  const startDonglePosition =
    startGlobalPoint &&
    startHeading &&
    getDonglePosition(startGlobalPoint, startHeading, grid);
  const startDongle =
    startDonglePosition && pointToGridNode(startDonglePosition, grid);
  const endDonglePosition =
    endGlobalPoint &&
    endHeading &&
    getDonglePosition(endGlobalPoint, endHeading, grid);
  const endDongle =
    endDonglePosition && pointToGridNode(endDonglePosition, grid);

  // Do not allow stepping on the true end or true start points
  const endNode = pointToGridNode(endGlobalPoint, grid);
  if (endNode) {
    endNode.closed = true;
  }
  const startNode = pointToGridNode(startGlobalPoint, grid);
  if (startNode) {
    startNode.closed = true;
  }

  // Create path to end dongle from start dongle
  const path =
    startDongle &&
    endDongle &&
    endHeading &&
    astar(startDongle, endDongle, grid, startHeading, endHeading);

  if (path) {
    startGlobalPoint && debugDrawPoint(startGlobalPoint, "green");
    path.forEach((node) => debugDrawPoint(node.pos, "red"));
    endGlobalPoint && debugDrawPoint(endGlobalPoint, "green");

    const points = path.map((node) => [node.pos[0], node.pos[1]]) as Point[];
    points.unshift(startGlobalPoint);
    points.push(endGlobalPoint);
    mutateElement(arrow, {
      ...normalizedArrowElementUpdate(
        simplifyElbowArrowPoints(points),
        offset[0],
        offset[1],
      ),
    });
  }

  // Debug
  // grid.data.forEach(
  //   (node) =>
  //     node &&
  //     debugDrawPoint(
  //       node.pos,
  //       `rgb(${Math.floor(node.addr[0] * (240 / grid.row))}, ${Math.floor(
  //         node.addr[1] * (240 / grid.col),
  //       )}, 255)`,
  //     ),
  // );
  for (let col = 0; col < grid.col; col++) {
    const a = gridNodeFromAddr([col, 0], grid)?.pos;
    const b = gridNodeFromAddr([col, grid.row - 1], grid)?.pos;
    a && b && debugDrawSegments([a, b], "#DDD");
  }
  for (let row = 0; row < grid.row; row++) {
    const a = gridNodeFromAddr([0, row], grid)?.pos;
    const b = gridNodeFromAddr([grid.col - 1, row], grid)?.pos;
    a && b && debugDrawSegments([a, b], "#DDD");
  }
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
) => {
  const multiplier = magnitudeSq(pointToVector(end.pos, start.pos));
  const open = new BinaryHeap<Node>((node) => node.f);

  let closest = start;

  start.h = magnitudeSq(pointToVector(end.pos, start.pos));

  open.push(start);

  while (open.size() > 0) {
    // Grab the lowest f(x) to process next.  Heap keeps this sorted for us.
    const current = open.pop();

    if (!current) {
      // Current is not passable, continue with next element
      continue;
    }

    // End case -- result has been found, return the traced path.
    if (current === end) {
      return pathTo(start, current);
    }

    // Normal case -- move currentNode from open to closed, process each of its neighbors.
    current.closed = true;

    // Find all neighbors for the current node.
    const neighbors = getNeighbors(current.addr, grid);

    for (let i = 0; i < 4; i++) {
      const neighbor = neighbors[i];

      if (!neighbor || neighbor.closed) {
        // Not a valid node to process, skip to next neighbor.
        continue;
      }

      // The g score is the shortest distance from start to current node.
      // We need to check if the path we have arrived at this neighbor is the shortest one we have seen yet.
      const neighborDirection = neighborIndexToHeading(i as 0 | 1 | 2 | 3);
      const previousDirection = current.parent
        ? vectorToHeading(pointToVector(current.pos, current.parent.pos))
        : startHeading;
      const directionChange = previousDirection !== neighborDirection;
      const gScore =
        current.g +
        magnitudeSq(pointToVector(neighbor.pos, current.pos)) + // Right triangle a^2 + b^2 = hypot^2
        (directionChange ? multiplier * multiplier * 10000 : 0); // TODO: 10000 here is just an approx!
      //console.log(gScore, multiplier * multiplier);
      const beenVisited = neighbor.visited;

      if (!beenVisited || gScore < neighbor.g) {
        const estBendCount = estimateSegmentCount(
          neighbor,
          end,
          neighborDirection,
          endHeading,
        );
        // Found an optimal (so far) path to this node.  Take score for node to see how good it is.
        neighbor.visited = true;
        neighbor.parent = current;
        neighbor.h =
          neighbor.h ||
          magnitudeSq(pointToVector(end.pos, neighbor.pos)) +
            estBendCount * multiplier * multiplier;
        neighbor.g = gScore;
        neighbor.f = neighbor.g + neighbor.h;

        // If the neighbour is closer than the current closest node or if it's equally close but has
        // a cheaper path than the current closest node then it becomes the closest node
        if (
          neighbor.h < closest.h ||
          (neighbor.h === closest.h && neighbor.g < closest.g)
        ) {
          closest = neighbor;
        }

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

  return pathTo(start, closest);
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
 * Calculates the grid from which the node points are placed on
 * based on the axis-aligned bounding boxes.
 */
const calculateGrid = (
  aabbs: Bounds[],
  additionalAabbs: Bounds[],
  start: Point,
  startHeading: Heading | null,
  end: Point,
  endHeading: Heading | null,
  offset: number,
): Grid => {
  const horizontal = new Set<number>();
  const vertical = new Set<number>();

  aabbs.forEach((aabb) => {
    horizontal.add(aabb[0]);
    horizontal.add(aabb[2]);
    vertical.add(aabb[1]);
    vertical.add(aabb[3]);
  });
  additionalAabbs.forEach((aabb) => {
    horizontal.add(aabb[0]);
    horizontal.add(aabb[2]);
    vertical.add(aabb[1]);
    vertical.add(aabb[3]);
  });

  // Binding points are also nodes
  if (startHeading) {
    // if (startHeading === HEADING_LEFT || startHeading === HEADING_RIGHT) {
    //   vertical.add(start[1]);
    // } else {
    //   horizontal.add(start[0]);
    // }
    vertical.add(start[1]);
    horizontal.add(start[0]);
  }
  if (endHeading) {
    vertical.add(end[1]);
    horizontal.add(end[0]);
    // if (endHeading === HEADING_LEFT || endHeading === HEADING_RIGHT) {
    //   vertical.add(end[1]);
    // } else {
    //   horizontal.add(end[0]);
    // }
  }

  // Add halfway points as well
  const verticalSorted = Array.from(vertical).sort((a, b) => a - b);
  const horizontalSorted = Array.from(horizontal).sort((a, b) => a - b);
  for (let i = 0; i < verticalSorted.length - 1; i++) {
    const v = verticalSorted[i];
    const v2 = verticalSorted[i + 1] ?? 0;
    if (v2 - v > offset) {
      vertical.add((v + v2) / 2);
    }
  }
  for (let i = 0; i < horizontalSorted.length - 1; i++) {
    const h = horizontalSorted[i];
    const h2 = horizontalSorted[i + 1];
    if (h2 - h > offset) {
      horizontal.add((h + h2) / 2);
    }
  }

  const _vertical = Array.from(vertical).sort((a, b) => a - b); // TODO: Do we need sorting?
  const _horizontal = Array.from(horizontal).sort((a, b) => a - b); // TODO: Do we need sorting?

  return {
    row: _vertical.length,
    col: _horizontal.length,
    data: _vertical
      .flatMap((y, row) =>
        _horizontal.map(
          (x, col): Node => ({
            f: 0,
            g: 0,
            h: 0,
            //direction: null,
            closed: false,
            visited: false,
            parent: null,
            addr: [col, row] as [number, number],
            pos: [x, y] as Point,
          }),
        ),
      )
      //.filter(filterUnique) // TODO: Do we need unique values?
      .map((node) =>
        Math.max(
          ...aabbs.map((aabb) =>
            pointInsideOrOnBounds(node.pos, aabb) ? 1 : 0,
          ),
        ) === 0
          ? node
          : null,
      ),
  };
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

const getDonglePosition = (p: Point, heading: Heading, grid: Grid) => {
  switch (heading) {
    case HEADING_UP:
      return (
        grid.data
          .filter((node) => node && node.pos[0] === p[0] && node.pos[1] < p[1])
          .reduce(
            (closest, node) =>
              node && node.pos[1] > closest[1] ? node.pos : closest,
            [p[0], -Infinity] as Point,
          ) ?? p
      );
    case HEADING_DOWN:
      return (
        grid.data
          .filter((node) => node && node.pos[0] === p[0] && node.pos[1] > p[1])
          .reduce(
            (closest, node) =>
              node && node.pos[1] < closest[1] ? node.pos : closest,
            [p[0], Infinity] as Point,
          ) ?? p
      );
    case HEADING_LEFT:
      return (
        grid.data
          .filter((node) => node && node.pos[1] === p[1] && node.pos[0] < p[0])
          .reduce(
            (closest, node) =>
              node && node.pos[0] > closest[0] ? node.pos : closest,
            [-Infinity, p[1]] as Point,
          ) ?? p
      );
    case HEADING_RIGHT:
      return (
        grid.data
          .filter((node) => node && node.pos[1] === p[1] && node.pos[0] > p[0])
          .reduce(
            (closest, node) =>
              node && node.pos[0] < closest[0] ? node.pos : closest,
            [Infinity, p[1]] as Point,
          ) ?? p
      );
  }

  return p;
};

const headingToNeighborIndex = (heading: Heading): 0 | 1 | 2 | 3 => {
  switch (heading) {
    case HEADING_UP:
      return 0;
    case HEADING_RIGHT:
      return 1;
    case HEADING_DOWN:
      return 2;
  }
  return 3;
};

const neighborIndexToHeading = (index: 0 | 1 | 2 | 3): Heading => {
  switch (index) {
    case 0:
      return HEADING_UP;
    case 1:
      return HEADING_RIGHT;
    case 2:
      return HEADING_DOWN;
  }
  return HEADING_LEFT;
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
const aabbForElement = (element: ExcalidrawElement, offset?: number) => {
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
    return [
      bounds[0] - (offset ?? 0),
      bounds[1] - (offset ?? 0),
      bounds[2] + (offset ?? 0),
      bounds[3] + (offset ?? 0),
    ] as Bounds;
  }

  return bounds;
};
// Gets the heading for the point by creating a bounding box around the rotated
// close fitting bounding box, then creating 4 search cones around the center of
// the external bbox.
const headingForPointOnElement = (
  element: ExcalidrawBindableElement,
  aabb: Bounds,
  point: Point,
): Heading | null => {
  const SEARCH_CONE_MULTIPLIER = 2;

  const midPoint = getCenterForBounds(aabb);
  const ROTATION = element.type === "diamond" ? Math.PI / 4 : 0;

  const topLeft = rotatePoint(
    scalePointFromOrigin([aabb[0], aabb[1]], midPoint, SEARCH_CONE_MULTIPLIER),
    midPoint,
    ROTATION,
  );
  const topRight = rotatePoint(
    scalePointFromOrigin([aabb[2], aabb[1]], midPoint, SEARCH_CONE_MULTIPLIER),
    midPoint,
    ROTATION,
  );
  const bottomLeft = rotatePoint(
    scalePointFromOrigin([aabb[0], aabb[3]], midPoint, SEARCH_CONE_MULTIPLIER),
    midPoint,
    ROTATION,
  );
  const bottomRight = rotatePoint(
    scalePointFromOrigin([aabb[2], aabb[3]], midPoint, SEARCH_CONE_MULTIPLIER),
    midPoint,
    ROTATION,
  );

  if (element.type === "diamond") {
    // TODO: Optimize this. No need for triangle searchlights
    return PointInTriangle(point, topLeft, topRight, midPoint)
      ? HEADING_RIGHT
      : PointInTriangle(point, topRight, bottomRight, midPoint)
      ? HEADING_RIGHT
      : PointInTriangle(point, bottomRight, bottomLeft, midPoint)
      ? HEADING_LEFT
      : HEADING_LEFT;
  }

  return PointInTriangle(point, topLeft, topRight, midPoint)
    ? HEADING_UP
    : PointInTriangle(point, topRight, bottomRight, midPoint)
    ? HEADING_RIGHT
    : PointInTriangle(point, bottomRight, bottomLeft, midPoint)
    ? HEADING_DOWN
    : HEADING_LEFT;
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

const filterUnique = <T>(item: T, idx: number, coords: T[]) =>
  coords.indexOf(item) === idx;

const pointInsideOrOnBounds = (p: Point, bounds: Bounds): boolean =>
  p[0] >= bounds[0] &&
  p[0] <= bounds[2] &&
  p[1] >= bounds[1] &&
  p[1] <= bounds[3];

const normalizedArrowElementUpdate = (
  points: Point[],
  externalOffsetX?: number,
  externalOffsetY?: number,
) => {
  const offsetX = points[0][0];
  const offsetY = points[0][1];
  const [farthestX, farthestY] = points.reduce(
    (farthest, point) => [
      farthest[0] < point[0] ? point[0] : farthest[0],
      farthest[1] < point[1] ? point[1] : farthest[1],
    ],
    points[0],
  );

  return {
    points: points.map((point, _idx) => {
      return [point[0] - offsetX, point[1] - offsetY] as const;
    }),
    x: offsetX + (externalOffsetX ?? 0),
    y: offsetY + (externalOffsetY ?? 0),
    width: farthestX - offsetX + (externalOffsetX ?? 0),
    height: farthestY - offsetY + (externalOffsetY ?? 0),
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
