import { invariant, toBrandedType, type Bounds } from "@excalidraw/common";

import { clamp, pointFrom, PRECISION } from "@excalidraw/math";

import type {
  AppState,
  PendingExcalidrawElements,
} from "@excalidraw/excalidraw/types";

import { bindBindingElement } from "./binding";
import { updateElbowArrowPoints } from "./elbowArrow";
import { LinearElementEditor } from "./linearElementEditor";
import { mutateElement } from "./mutateElement";
import {
  newArrowElement,
  newElement,
  newStickyNoteElement,
} from "./newElement";
import { aabbForElement } from "./bounds";
import { elementsAreInFrameBounds, elementOverlapsWithFrame } from "./frame";
import {
  isBindableElement,
  isArrowElement,
  isFrameElement,
  isFlowchartNodeElement,
} from "./typeChecks";
import {
  type NonDeleted,
  type ElementsMap,
  type ExcalidrawBindableElement,
  type ExcalidrawElement,
  type ExcalidrawFlowchartNodeElement,
  type NonDeletedExcalidrawElement,
  type NonDeletedSceneElementsMap,
  type Ordered,
  type OrderedExcalidrawElement,
} from "./types";

import type { Scene } from "./Scene";

export type LinkDirection = "up" | "right" | "down" | "left";

const VERTICAL_OFFSET = 100;
const HORIZONTAL_OFFSET = 100;

type Interval = { start: number; end: number };

const mergeIntervals = (intervals: Interval[]): Interval[] => {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];

  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }

  return merged;
};

const intervalIsFree = (start: number, size: number, occupied: Interval[]) =>
  occupied.every((o) => start + size <= o.start || start >= o.end);

// Nearest `start` for a segment of `size` avoiding every occupied interval,
// searching both sides of `ideal`; a tie resolves toward the positive side.
const findNearestFreeSlot = (
  ideal: number,
  size: number,
  occupied: Interval[],
): number => {
  if (intervalIsFree(ideal, size, occupied)) {
    return ideal;
  }

  const gapStarts = [-Infinity, ...occupied.map((o) => o.end)];
  const gapEnds = [...occupied.map((o) => o.start), Infinity];

  let best = ideal;
  let bestDistance = Infinity;
  for (let i = 0; i < gapStarts.length; i++) {
    if (gapEnds[i] - gapStarts[i] < size) {
      continue;
    }
    const start = clamp(ideal, gapStarts[i], gapEnds[i] - size);
    const distance = Math.abs(start - ideal);
    if (distance <= bestDistance) {
      best = start;
      bestDistance = distance;
    }
  }

  return best;
};

// Walk the arrow bindings to collect every node that belongs to the same
// flowchart as `node` — the whole connected component acts as the obstacle
// set during placement (#8518).
const getConnectedFlowchartNodes = (
  node: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
): ExcalidrawBindableElement[] => {
  // one pass over the scene, so the walk below costs the size of the chart,
  // not chart nodes × all arrows in the scene
  const neighbors = new Map<string, string[]>();
  const addNeighbor = (from: string, to: string) => {
    const list = neighbors.get(from);
    if (list) {
      list.push(to);
    } else {
      neighbors.set(from, [to]);
    }
  };
  for (const element of elementsMap.values()) {
    if (isArrowElement(element) && element.startBinding && element.endBinding) {
      addNeighbor(element.startBinding.elementId, element.endBinding.elementId);
      addNeighbor(element.endBinding.elementId, element.startBinding.elementId);
    }
  }

  const visited = new Set<string>([node.id]);
  const queue: string[] = [node.id];
  const connected: ExcalidrawBindableElement[] = [];

  for (let i = 0; i < queue.length; i++) {
    for (const neighborId of neighbors.get(queue[i]) ?? []) {
      if (visited.has(neighborId)) {
        continue;
      }

      visited.add(neighborId);
      const neighbor = elementsMap.get(neighborId);
      if (neighbor && isBindableElement(neighbor)) {
        connected.push(neighbor);
        queue.push(neighborId);
      }
    }
  }

  return connected;
};

// Place a cluster of `count` equally-sized nodes next to `parent`:
// - the primary axis (the creation direction) is fixed at exactly one gap
//   away from the parent, forming a search band the cluster will occupy
// - along the cross axis the cluster slides into the free slot nearest the
//   parent-centered ideal, treating band obstacles as immovable
// - `stickyCrossStart` anchors an already-visible pending cluster that an
//   obstacle pushed off-center: growing it extends it at either end so the
//   existing pending nodes keep their positions, unless the grown cluster
//   centers on the parent again or no longer fits there
const placeCluster = (
  parent: ExcalidrawFlowchartNodeElement,
  direction: LinkDirection,
  count: number,
  obstacles: readonly Bounds[],
  stickyCrossStart: number | null,
): { positions: { x: number; y: number }[]; crossStart: number } => {
  const horizontal = direction === "left" || direction === "right";
  // INSIGHT: new nodes copy the parent's dimensions
  const nodePrimarySize = horizontal ? parent.width : parent.height;
  const nodeCrossSize = horizontal ? parent.height : parent.width;
  const primaryGap = horizontal ? HORIZONTAL_OFFSET : VERTICAL_OFFSET;
  const crossGap = horizontal ? VERTICAL_OFFSET : HORIZONTAL_OFFSET;

  const parentPrimaryStart = horizontal ? parent.x : parent.y;
  const parentCrossCenter = horizontal
    ? parent.y + parent.height / 2
    : parent.x + parent.width / 2;

  const primaryStart =
    direction === "right" || direction === "down"
      ? parentPrimaryStart + nodePrimarySize + primaryGap
      : parentPrimaryStart - primaryGap - nodePrimarySize;

  // the band widened by one gap on both sides, so nodes the cluster would end
  // up closer than a gap to count as obstacles too; the near side stops
  // exactly at the parent's facing edge, keeping the parent's row out
  const [zoneStart, zoneEnd] =
    direction === "right" || direction === "down"
      ? [
          parentPrimaryStart + nodePrimarySize,
          primaryStart + nodePrimarySize + primaryGap,
        ]
      : [primaryStart - primaryGap, parentPrimaryStart];

  // cross-axis intervals of the obstacles in that zone, inflated so the
  // cluster keeps at least one gap of clearance
  const occupied = mergeIntervals(
    obstacles
      .filter((bounds) => {
        const start = horizontal ? bounds[0] : bounds[1];
        const end = horizontal ? bounds[2] : bounds[3];
        // Ignore rounding noise so nodes a full gap away stay out of the zone.
        return start < zoneEnd - PRECISION && end > zoneStart + PRECISION;
      })
      .map((bounds) => ({
        start: (horizontal ? bounds[1] : bounds[0]) - crossGap,
        end: (horizontal ? bounds[3] : bounds[2]) + crossGap,
      })),
  );

  const step = nodeCrossSize + crossGap;
  const clusterCrossSize = count * nodeCrossSize + (count - 1) * crossGap;
  const centeredStart = parentCrossCenter - clusterCrossSize / 2;

  // the centered slot sorts first (zero distance), so the cluster re-centers
  // whenever it fits there
  const anchoredStart =
    stickyCrossStart === null
      ? null
      : [centeredStart, stickyCrossStart, stickyCrossStart - step]
          .filter((start) => intervalIsFree(start, clusterCrossSize, occupied))
          .sort(
            (a, b) =>
              Math.abs(a + clusterCrossSize / 2 - parentCrossCenter) -
              Math.abs(b + clusterCrossSize / 2 - parentCrossCenter),
          )[0] ?? null;

  const crossStart =
    anchoredStart ??
    findNearestFreeSlot(centeredStart, clusterCrossSize, occupied);

  const positions = Array.from({ length: count }, (_, index) => {
    const cross = crossStart + index * step;
    return horizontal
      ? { x: primaryStart, y: cross }
      : { x: cross, y: primaryStart };
  });

  return { positions, crossStart };
};

const cloneFlowchartNode = (
  template: ExcalidrawFlowchartNodeElement,
  x: number,
  y: number,
) => {
  const commonNodeProps = {
    x,
    y,
    width: template.width,
    height: template.height,
    roundness: template.roundness,
    roughness: template.roughness,
    backgroundColor: template.backgroundColor,
    strokeColor: template.strokeColor,
    strokeWidth: template.strokeWidth,
    opacity: template.opacity,
    fillStyle: template.fillStyle,
    strokeStyle: template.strokeStyle,
  };

  const node =
    template.type === "stickynote"
      ? newStickyNoteElement({
          type: "stickynote",
          ...commonNodeProps,
          baseHeight: template.baseHeight,
        })
      : newElement({
          type: template.type,
          ...commonNodeProps,
        });

  invariant(
    isFlowchartNodeElement(node),
    "not an ExcalidrawFlowchartNodeElement",
  );

  return node;
};

export const addNewNodes = (
  startNode: NonDeleted<ExcalidrawFlowchartNodeElement>,
  appState: Pick<AppState, "currentItemEndArrowhead" | "zoom">,
  direction: LinkDirection,
  scene: Scene,
  numberOfNodes: number,
  stickyCrossStart: number | null = null,
) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const obstacles = getConnectedFlowchartNodes(startNode, elementsMap).map(
    (node) => aabbForElement(node, elementsMap),
  );

  const { positions, crossStart } = placeCluster(
    startNode,
    direction,
    numberOfNodes,
    obstacles,
    stickyCrossStart,
  );

  const nodes: NonDeletedExcalidrawElement[] = [];
  for (const position of positions) {
    const nextNode = cloneFlowchartNode(startNode, position.x, position.y);
    const bindingArrow = createBindingArrow(
      startNode,
      nextNode,
      direction,
      appState,
      scene,
    );

    nodes.push(nextNode, bindingArrow);
  }

  return { nodes, crossStart };
};

const createBindingArrow = (
  startBindingElement: NonDeleted<ExcalidrawFlowchartNodeElement>,
  endBindingElement: NonDeleted<ExcalidrawFlowchartNodeElement>,
  direction: LinkDirection,
  appState: Pick<AppState, "currentItemEndArrowhead" | "zoom">,
  scene: Scene,
) => {
  let startX: number;
  let startY: number;

  const PADDING = 6;

  switch (direction) {
    case "up": {
      startX = startBindingElement.x + startBindingElement.width / 2;
      startY = startBindingElement.y - PADDING;
      break;
    }
    case "down": {
      startX = startBindingElement.x + startBindingElement.width / 2;
      startY = startBindingElement.y + startBindingElement.height + PADDING;
      break;
    }
    case "right": {
      startX = startBindingElement.x + startBindingElement.width + PADDING;
      startY = startBindingElement.y + startBindingElement.height / 2;
      break;
    }
    case "left": {
      startX = startBindingElement.x - PADDING;
      startY = startBindingElement.y + startBindingElement.height / 2;
      break;
    }
  }

  let endX: number;
  let endY: number;

  switch (direction) {
    case "up": {
      endX = endBindingElement.x + endBindingElement.width / 2 - startX;
      endY = endBindingElement.y + endBindingElement.height - startY + PADDING;
      break;
    }
    case "down": {
      endX = endBindingElement.x + endBindingElement.width / 2 - startX;
      endY = endBindingElement.y - startY - PADDING;
      break;
    }
    case "right": {
      endX = endBindingElement.x - startX - PADDING;
      endY = endBindingElement.y - startY + endBindingElement.height / 2;
      break;
    }
    case "left": {
      endX = endBindingElement.x + endBindingElement.width - startX + PADDING;
      endY = endBindingElement.y - startY + endBindingElement.height / 2;
      break;
    }
  }

  const bindingArrow = newArrowElement({
    type: "arrow",
    x: startX,
    y: startY,
    startArrowhead: null,
    endArrowhead: appState.currentItemEndArrowhead,
    strokeColor: startBindingElement.strokeColor,
    strokeStyle: startBindingElement.strokeStyle,
    strokeWidth: startBindingElement.strokeWidth,
    opacity: startBindingElement.opacity,
    roughness: startBindingElement.roughness,
    points: [pointFrom(0, 0), pointFrom(endX, endY)],
    elbowed: true,
  });

  const elementsMap = scene.getNonDeletedElementsMap();

  bindBindingElement(
    bindingArrow,
    startBindingElement,
    "orbit",
    "start",
    scene,
    appState.zoom,
  );
  bindBindingElement(
    bindingArrow,
    endBindingElement,
    "orbit",
    "end",
    scene,
    appState.zoom,
  );

  const changedElements = new Map<string, OrderedExcalidrawElement>();
  changedElements.set(
    startBindingElement.id,
    startBindingElement as OrderedExcalidrawElement,
  );
  changedElements.set(
    endBindingElement.id,
    endBindingElement as OrderedExcalidrawElement,
  );
  changedElements.set(
    bindingArrow.id,
    bindingArrow as OrderedExcalidrawElement,
  );

  LinearElementEditor.movePoints(
    bindingArrow,
    scene,
    new Map([
      [
        1,
        {
          point: bindingArrow.points[1],
        },
      ],
    ]),
  );

  const update = updateElbowArrowPoints(
    bindingArrow,
    toBrandedType<NonDeletedSceneElementsMap>(
      new Map([
        ...elementsMap.entries(),
        [startBindingElement.id, startBindingElement],
        [endBindingElement.id, endBindingElement],
        [bindingArrow.id, bindingArrow],
      ] as [string, Ordered<NonDeletedExcalidrawElement>][]),
    ),
    { points: bindingArrow.points },
  );

  return {
    ...bindingArrow,
    ...update,
    isDeleted: bindingArrow.isDeleted,
  };
};

// Alt+arrow navigation moves to whichever node of the flowchart *looks* next
// in the pressed direction. Picture a bubble growing out of the current node
// that way: an ellipse that always touches the node's center, with its own
// center on the pressed axis, somewhat longer than it's wide. The first node
// it reaches wins, which makes a node count as far as
//
//   forward + (NAVIGATION_SIDEWAYS_WEIGHT * sideways)² / forward
//
// - straight ahead that's just how far the node is
// - the more off to the side, the farther it counts: twice its forward
//   distance at about 35°, and steeply more past that, so a node that's
//   mostly beside the current one only wins when little else lies that way
//
// The offsets are measured between centers. When the two nodes differ in
// size, the bigger one counts as a node of the smaller one's size, slid within
// itself as close to the other as it gets — so a wide node is in line with
// every node above or below it, and as near as its nearest end.
//
// Only nodes whose center lies past the current one's edge in the pressed
// direction take part: a node right above or below it isn't to its left.
//
// Near-ties (within 10%) go to a node the current one links to, then to one
// linking to it, then to the one more level with the current one's center,
// then reading order (the upper one for left/right, the left one for
// up/down).
const NAVIGATION_TIE_TOLERANCE = 0.1;
// How much longer than wide the bubble is. The higher, the more often a node
// straight ahead wins over nearer ones off to the side; from about 1.75 on, a
// near node at 50° stops beating a far one at 30°.
const NAVIGATION_SIDEWAYS_WEIGHT = 1.5;

export class FlowChartNavigator {
  isExploring: boolean = false;

  clear() {
    this.isExploring = false;
  }

  exploreByDirection(
    element: ExcalidrawElement,
    elementsMap: ElementsMap,
    direction: LinkDirection,
  ): ExcalidrawElement["id"] | null {
    if (!isBindableElement(element)) {
      return null;
    }

    const next = FlowChartNavigator.findNodeInDirection(
      element,
      elementsMap,
      direction,
    );

    if (!next) {
      return null;
    }

    this.isExploring = true;

    return next.id;
  }

  private static findNodeInDirection(
    node: ExcalidrawBindableElement,
    elementsMap: ElementsMap,
    direction: LinkDirection,
  ) {
    const horizontal = direction === "left" || direction === "right";
    const sign = direction === "right" || direction === "down" ? 1 : -1;
    const [minX, minY, maxX, maxY] = aabbForElement(node, elementsMap);
    const [nodeMainStart, nodeMainEnd, nodeCrossStart, nodeCrossEnd] =
      horizontal ? [minX, maxX, minY, maxY] : [minY, maxY, minX, maxX];
    const nodeMainSize = nodeMainEnd - nodeMainStart;
    const nodeCrossSize = nodeCrossEnd - nodeCrossStart;
    const nodeMainCenter = (nodeMainStart + nodeMainEnd) / 2;
    const nodeCrossCenter = (nodeCrossStart + nodeCrossEnd) / 2;

    const successors = new Set<string>();
    const predecessors = new Set<string>();
    for (const element of elementsMap.values()) {
      if (
        isArrowElement(element) &&
        element.startBinding &&
        element.endBinding
      ) {
        if (element.startBinding.elementId === node.id) {
          successors.add(element.endBinding.elementId);
        }
        if (element.endBinding.elementId === node.id) {
          predecessors.add(element.startBinding.elementId);
        }
      }
    }
    const linkRank = (id: string) =>
      successors.has(id) ? 0 : predecessors.has(id) ? 1 : 2;

    const candidates = getConnectedFlowchartNodes(node, elementsMap).flatMap(
      (candidate) => {
        const bounds = aabbForElement(candidate, elementsMap);
        const [mainStart, mainEnd, crossStart, crossEnd] = horizontal
          ? [bounds[0], bounds[2], bounds[1], bounds[3]]
          : [bounds[1], bounds[3], bounds[0], bounds[2]];
        const mainSize = mainEnd - mainStart;
        const crossSize = crossEnd - crossStart;
        const mainCenter = (mainStart + mainEnd) / 2;
        const crossCenter = (crossStart + crossEnd) / 2;

        // offsets between the centers, less the room the bigger node has to
        // slide toward the other within itself
        const forward =
          (mainCenter - nodeMainCenter) * sign -
          Math.abs(mainSize - nodeMainSize) / 2;
        const sideways = Math.max(
          Math.abs(crossCenter - nodeCrossCenter) -
            Math.abs(crossSize - nodeCrossSize) / 2,
          0,
        );

        // the center has to lie past the current node's edge
        if (forward <= Math.min(mainSize, nodeMainSize) / 2) {
          return [];
        }

        return [
          {
            node: candidate,
            distance:
              forward + (NAVIGATION_SIDEWAYS_WEIGHT * sideways) ** 2 / forward,
            crossCenter,
          },
        ];
      },
    );

    if (!candidates.length) {
      return null;
    }

    const nearest = Math.min(
      ...candidates.map((candidate) => candidate.distance),
    );
    const tolerance = Math.max(nearest * NAVIGATION_TIE_TOLERANCE, 1);
    // how far a candidate's center is off the current node's center line;
    // within a pixel it's a tie (symmetric layouts), left to reading order
    const offset = (candidate: typeof candidates[number]) =>
      Math.abs(candidate.crossCenter - nodeCrossCenter);
    const compareOffsets = (
      a: typeof candidates[number],
      b: typeof candidates[number],
    ) => (Math.abs(offset(a) - offset(b)) > 1 ? offset(a) - offset(b) : 0);

    return candidates
      .filter((candidate) => candidate.distance <= nearest + tolerance)
      .sort(
        (a, b) =>
          linkRank(a.node.id) - linkRank(b.node.id) ||
          compareOffsets(a, b) ||
          a.crossCenter - b.crossCenter ||
          a.distance - b.distance,
      )[0].node;
  }
}

export class FlowChartCreator {
  isCreatingChart: boolean = false;
  private numberOfNodes: number = 0;
  private direction: LinkDirection | null = null;
  // cross-axis anchor of the pending cluster, so growing it keeps the
  // already-visible pending nodes in place
  private clusterCrossStart: number | null = null;
  pendingNodes: PendingExcalidrawElements | null = null;

  createNodes(
    startNode: NonDeleted<ExcalidrawFlowchartNodeElement>,
    appState: Pick<AppState, "currentItemEndArrowhead" | "zoom">,
    direction: LinkDirection,
    scene: Scene,
  ) {
    const elementsMap = scene.getNonDeletedElementsMap();

    if (direction !== this.direction) {
      this.numberOfNodes = 1;
      this.clusterCrossStart = null;
    } else {
      this.numberOfNodes += 1;
    }

    const { nodes, crossStart } = addNewNodes(
      startNode,
      appState,
      direction,
      scene,
      this.numberOfNodes,
      this.clusterCrossStart,
    );

    this.isCreatingChart = true;
    this.direction = direction;
    this.clusterCrossStart = crossStart;
    this.pendingNodes = nodes;

    // add pending nodes to the same frame as the start node
    // if every pending node is at least intersecting with the frame
    if (startNode.frameId) {
      const frame = elementsMap.get(startNode.frameId);

      invariant(
        frame && isFrameElement(frame),
        "not an ExcalidrawFrameElement",
      );

      if (
        frame &&
        this.pendingNodes.every(
          (node) =>
            elementsAreInFrameBounds([node], frame, elementsMap) ||
            elementOverlapsWithFrame(node, frame, elementsMap),
        )
      ) {
        this.pendingNodes = this.pendingNodes.map((node) =>
          mutateElement(node, elementsMap, {
            frameId: startNode.frameId,
          }),
        );
      }
    }
  }

  clear() {
    this.isCreatingChart = false;
    this.pendingNodes = null;
    this.direction = null;
    this.numberOfNodes = 0;
    this.clusterCrossStart = null;
  }
}

export const isNodeInFlowchart = (
  element: ExcalidrawFlowchartNodeElement,
  elementsMap: ElementsMap,
) => {
  for (const [, el] of elementsMap) {
    if (
      el.type === "arrow" &&
      (el.startBinding?.elementId === element.id ||
        el.endBinding?.elementId === element.id)
    ) {
      return true;
    }
  }

  return false;
};
