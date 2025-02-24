import {
  HEADING_DOWN,
  HEADING_LEFT,
  HEADING_RIGHT,
  HEADING_UP,
  compareHeading,
  headingForPointFromElement,
  type Heading,
} from "./heading";
import { bindLinearElement } from "./binding";
import { LinearElementEditor } from "./linearElementEditor";
import { newArrowElement, newElement } from "./newElement";
import type { SceneElementsMap } from "./types";
import {
  type ElementsMap,
  type ExcalidrawBindableElement,
  type ExcalidrawElement,
  type ExcalidrawFlowchartNodeElement,
  type NonDeletedSceneElementsMap,
  type Ordered,
  type OrderedExcalidrawElement,
} from "./types";
import { KEYS } from "../keys";
import type { AppState, PendingExcalidrawElements } from "../types";
import { mutateElement } from "./mutateElement";
import { elementOverlapsWithFrame, elementsAreInFrameBounds } from "../frame";
import {
  isBindableElement,
  isElbowArrow,
  isFrameElement,
  isFlowchartNodeElement,
} from "./typeChecks";
import { invariant, toBrandedType } from "../utils";
import { pointFrom, type LocalPoint } from "../../math";
import { aabbForElement } from "../shapes";
import { updateElbowArrowPoints } from "./elbowArrow";
import type App from "../components/App";
import { makeNextSelectedElementIds } from "../scene/selection";
import { isElementCompletelyInViewport } from "./sizeHelpers";

type LinkDirection = "up" | "right" | "down" | "left";

const VERTICAL_OFFSET = 100;
const HORIZONTAL_OFFSET = 100;

export const getLinkDirectionFromKey = (key: string): LinkDirection => {
  switch (key) {
    case KEYS.ARROW_UP:
      return "up";
    case KEYS.ARROW_DOWN:
      return "down";
    case KEYS.ARROW_RIGHT:
      return "right";
    case KEYS.ARROW_LEFT:
      return "left";
    default:
      return "right";
  }
};

const getNodeRelatives = (
  type: "predecessors" | "successors",
  node: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
  direction: LinkDirection,
) => {
  const items = [...elementsMap.values()].reduce(
    (acc: { relative: ExcalidrawBindableElement; heading: Heading }[], el) => {
      let oppositeBinding;
      if (
        isElbowArrow(el) &&
        // we want check existence of the opposite binding, in the direction
        // we're interested in
        (oppositeBinding =
          el[type === "predecessors" ? "startBinding" : "endBinding"]) &&
        // similarly, we need to filter only arrows bound to target node
        el[type === "predecessors" ? "endBinding" : "startBinding"]
          ?.elementId === node.id
      ) {
        const relative = elementsMap.get(oppositeBinding.elementId);

        if (!relative) {
          return acc;
        }

        invariant(
          isBindableElement(relative),
          "not an ExcalidrawBindableElement",
        );

        const edgePoint = (
          type === "predecessors" ? el.points[el.points.length - 1] : [0, 0]
        ) as Readonly<LocalPoint>;

        const heading = headingForPointFromElement(node, aabbForElement(node), [
          edgePoint[0] + el.x,
          edgePoint[1] + el.y,
        ] as Readonly<LocalPoint>);

        acc.push({
          relative,
          heading,
        });
      }
      return acc;
    },
    [],
  );

  switch (direction) {
    case "up":
      return items
        .filter((item) => compareHeading(item.heading, HEADING_UP))
        .map((item) => item.relative);
    case "down":
      return items
        .filter((item) => compareHeading(item.heading, HEADING_DOWN))
        .map((item) => item.relative);
    case "right":
      return items
        .filter((item) => compareHeading(item.heading, HEADING_RIGHT))
        .map((item) => item.relative);
    case "left":
      return items
        .filter((item) => compareHeading(item.heading, HEADING_LEFT))
        .map((item) => item.relative);
  }
};

const getSuccessors = (
  node: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
  direction: LinkDirection,
) => {
  return getNodeRelatives("successors", node, elementsMap, direction);
};

export const getPredecessors = (
  node: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
  direction: LinkDirection,
) => {
  return getNodeRelatives("predecessors", node, elementsMap, direction);
};

const getOffsets = (
  element: ExcalidrawFlowchartNodeElement,
  linkedNodes: ExcalidrawElement[],
  direction: LinkDirection,
) => {
  const _HORIZONTAL_OFFSET = HORIZONTAL_OFFSET + element.width;

  // check if vertical space or horizontal space is available first
  if (direction === "up" || direction === "down") {
    const _VERTICAL_OFFSET = VERTICAL_OFFSET + element.height;
    // check vertical space
    const minX = element.x;
    const maxX = element.x + element.width;

    // vertical space is available
    if (
      linkedNodes.every(
        (linkedNode) =>
          linkedNode.x + linkedNode.width < minX || linkedNode.x > maxX,
      )
    ) {
      return {
        x: 0,
        y: _VERTICAL_OFFSET * (direction === "up" ? -1 : 1),
      };
    }
  } else if (direction === "right" || direction === "left") {
    const minY = element.y;
    const maxY = element.y + element.height;

    if (
      linkedNodes.every(
        (linkedNode) =>
          linkedNode.y + linkedNode.height < minY || linkedNode.y > maxY,
      )
    ) {
      return {
        x:
          (HORIZONTAL_OFFSET + element.width) * (direction === "left" ? -1 : 1),
        y: 0,
      };
    }
  }

  if (direction === "up" || direction === "down") {
    const _VERTICAL_OFFSET = VERTICAL_OFFSET + element.height;
    const y = linkedNodes.length === 0 ? _VERTICAL_OFFSET : _VERTICAL_OFFSET;
    const x =
      linkedNodes.length === 0
        ? 0
        : (linkedNodes.length + 1) % 2 === 0
        ? ((linkedNodes.length + 1) / 2) * _HORIZONTAL_OFFSET
        : (linkedNodes.length / 2) * _HORIZONTAL_OFFSET * -1;

    if (direction === "up") {
      return {
        x,
        y: y * -1,
      };
    }

    return {
      x,
      y,
    };
  }

  const _VERTICAL_OFFSET = VERTICAL_OFFSET + element.height;
  const x =
    (linkedNodes.length === 0 ? HORIZONTAL_OFFSET : HORIZONTAL_OFFSET) +
    element.width;
  const y =
    linkedNodes.length === 0
      ? 0
      : (linkedNodes.length + 1) % 2 === 0
      ? ((linkedNodes.length + 1) / 2) * _VERTICAL_OFFSET
      : (linkedNodes.length / 2) * _VERTICAL_OFFSET * -1;

  if (direction === "left") {
    return {
      x: x * -1,
      y,
    };
  }
  return {
    x,
    y,
  };
};

const addNewNode = (
  element: ExcalidrawFlowchartNodeElement,
  elementsMap: ElementsMap,
  appState: AppState,
  direction: LinkDirection,
) => {
  const successors = getSuccessors(element, elementsMap, direction);
  const predeccessors = getPredecessors(element, elementsMap, direction);

  const offsets = getOffsets(
    element,
    [...successors, ...predeccessors],
    direction,
  );

  const nextNode = newElement({
    type: element.type,
    x: element.x + offsets.x,
    y: element.y + offsets.y,
    // TODO: extract this to a util
    width: element.width,
    height: element.height,
    roundness: element.roundness,
    roughness: element.roughness,
    backgroundColor: element.backgroundColor,
    strokeColor: element.strokeColor,
    strokeWidth: element.strokeWidth,
    opacity: element.opacity,
    fillStyle: element.fillStyle,
    strokeStyle: element.strokeStyle,
  });

  invariant(
    isFlowchartNodeElement(nextNode),
    "not an ExcalidrawFlowchartNodeElement",
  );

  const bindingArrow = createBindingArrow(
    element,
    nextNode,
    elementsMap,
    direction,
    appState,
  );

  return {
    nextNode,
    bindingArrow,
  };
};

export const addNewNodes = (
  startNode: ExcalidrawFlowchartNodeElement,
  elementsMap: ElementsMap,
  appState: AppState,
  direction: LinkDirection,
  numberOfNodes: number,
) => {
  // always start from 0 and distribute evenly
  const newNodes: ExcalidrawElement[] = [];

  for (let i = 0; i < numberOfNodes; i++) {
    let nextX: number;
    let nextY: number;
    if (direction === "left" || direction === "right") {
      const totalHeight =
        VERTICAL_OFFSET * (numberOfNodes - 1) +
        numberOfNodes * startNode.height;

      const startY = startNode.y + startNode.height / 2 - totalHeight / 2;

      let offsetX = HORIZONTAL_OFFSET + startNode.width;
      if (direction === "left") {
        offsetX *= -1;
      }
      nextX = startNode.x + offsetX;
      const offsetY = (VERTICAL_OFFSET + startNode.height) * i;
      nextY = startY + offsetY;
    } else {
      const totalWidth =
        HORIZONTAL_OFFSET * (numberOfNodes - 1) +
        numberOfNodes * startNode.width;
      const startX = startNode.x + startNode.width / 2 - totalWidth / 2;
      let offsetY = VERTICAL_OFFSET + startNode.height;

      if (direction === "up") {
        offsetY *= -1;
      }
      nextY = startNode.y + offsetY;
      const offsetX = (HORIZONTAL_OFFSET + startNode.width) * i;
      nextX = startX + offsetX;
    }

    const nextNode = newElement({
      type: startNode.type,
      x: nextX,
      y: nextY,
      // TODO: extract this to a util
      width: startNode.width,
      height: startNode.height,
      roundness: startNode.roundness,
      roughness: startNode.roughness,
      backgroundColor: startNode.backgroundColor,
      strokeColor: startNode.strokeColor,
      strokeWidth: startNode.strokeWidth,
      opacity: startNode.opacity,
      fillStyle: startNode.fillStyle,
      strokeStyle: startNode.strokeStyle,
    });

    invariant(
      isFlowchartNodeElement(nextNode),
      "not an ExcalidrawFlowchartNodeElement",
    );

    const bindingArrow = createBindingArrow(
      startNode,
      nextNode,
      elementsMap,
      direction,
      appState,
    );

    newNodes.push(nextNode);
    newNodes.push(bindingArrow);
  }

  return newNodes;
};

const createBindingArrow = (
  startBindingElement: ExcalidrawFlowchartNodeElement,
  endBindingElement: ExcalidrawFlowchartNodeElement,
  elementsMap: ElementsMap,
  direction: LinkDirection,
  appState: AppState,
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

  bindLinearElement(
    bindingArrow,
    startBindingElement,
    "start",
    elementsMap as NonDeletedSceneElementsMap,
  );
  bindLinearElement(
    bindingArrow,
    endBindingElement,
    "end",
    elementsMap as NonDeletedSceneElementsMap,
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

  LinearElementEditor.movePoints(bindingArrow, [
    {
      index: 1,
      point: bindingArrow.points[1],
    },
  ]);

  const update = updateElbowArrowPoints(
    bindingArrow,
    toBrandedType<SceneElementsMap>(
      new Map([
        ...elementsMap.entries(),
        [startBindingElement.id, startBindingElement],
        [endBindingElement.id, endBindingElement],
        [bindingArrow.id, bindingArrow],
      ] as [string, Ordered<ExcalidrawElement>][]),
    ),
    { points: bindingArrow.points },
  );

  return {
    ...bindingArrow,
    ...update,
  };
};

export class FlowChartNavigator {
  isExploring: boolean = false;

  private app: App;
  private siblingNodes: ExcalidrawElement[] = [];
  private siblingIndex: number = 0;
  private direction: LinkDirection | null = null;

  constructor(app: App) {
    this.app = app;
  }

  clear() {
    this.isExploring = false;
    this.siblingNodes = [];
    this.siblingIndex = 0;
    this.direction = null;
  }

  /**
   * Explore the flowchart by the given direction.
   *
   * The exploration follows a (near) breadth-first approach: when there're multiple
   * nodes at the same level, we allow the user to traverse through them before
   * moving to the next level.
   *
   * Unlike breadth-first search, we return to the first node at the same level.
   */
  exploreByDirection(element: ExcalidrawElement, direction: LinkDirection) {
    if (!isBindableElement(element)) {
      return;
    }

    const elementsMap = this.app.scene.getNonDeletedElementsMap();

    // clear if going at a different direction
    if (direction !== this.direction) {
      this.clear();
    }

    /**
     * if we're already exploring (holding the alt key)
     * and the direction is the same as the previous one
     * and there're multiple nodes at the same level
     * then we should traverse through them before moving to the next level
     */
    if (
      this.isExploring &&
      direction === this.direction &&
      this.siblingNodes.length > 1
    ) {
      this.siblingIndex++;

      // there're more unexplored nodes at the same level
      if (this.siblingIndex < this.siblingNodes.length) {
        return this.goToNode(this.siblingNodes[this.siblingIndex].id);
      }

      this.goToNode(this.siblingNodes[0].id);
      this.clear();
    }

    const nodes = [
      ...getSuccessors(element, elementsMap, direction),
      ...getPredecessors(element, elementsMap, direction),
    ];

    if (nodes.length > 0) {
      this.siblingIndex = 0;
      this.isExploring = true;
      this.siblingNodes = nodes;
      this.direction = direction;

      this.goToNode(nodes[0].id);
    }
  }

  private goToNode = (nodeId: ExcalidrawElement["id"]) => {
    this.app.setState((prevState) => ({
      selectedElementIds: makeNextSelectedElementIds(
        {
          [nodeId]: true,
        },
        prevState,
      ),
    }));

    const nextNode = this.app.scene.getNonDeletedElementsMap().get(nodeId);

    if (
      nextNode &&
      !isElementCompletelyInViewport(
        [nextNode],
        this.app.canvas.width / window.devicePixelRatio,
        this.app.canvas.height / window.devicePixelRatio,
        {
          offsetLeft: this.app.state.offsetLeft,
          offsetTop: this.app.state.offsetTop,
          scrollX: this.app.state.scrollX,
          scrollY: this.app.state.scrollY,
          zoom: this.app.state.zoom,
        },
        this.app.scene.getNonDeletedElementsMap(),
        this.app.getEditorUIOffsets(),
      )
    ) {
      this.app.scrollToContent(nextNode, {
        animate: true,
        duration: 300,
        canvasOffsets: this.app.getEditorUIOffsets(),
      });
    }
  };
}

export class FlowChartCreator {
  isCreatingChart: boolean = false;
  private numberOfNodes: number = 0;
  private direction: LinkDirection | null = "right";
  pendingNodes: PendingExcalidrawElements | null = null;

  createNodes(
    startNode: ExcalidrawFlowchartNodeElement,
    elementsMap: ElementsMap,
    appState: AppState,
    direction: LinkDirection,
  ) {
    if (direction !== this.direction) {
      const { nextNode, bindingArrow } = addNewNode(
        startNode,
        elementsMap,
        appState,
        direction,
      );

      this.numberOfNodes = 1;
      this.isCreatingChart = true;
      this.direction = direction;
      this.pendingNodes = [nextNode, bindingArrow];
    } else {
      this.numberOfNodes += 1;
      const newNodes = addNewNodes(
        startNode,
        elementsMap,
        appState,
        direction,
        this.numberOfNodes,
      );

      this.isCreatingChart = true;
      this.direction = direction;
      this.pendingNodes = newNodes;
    }

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
          mutateElement(
            node,
            {
              frameId: startNode.frameId,
            },
            false,
          ),
        );
      }
    }
  }

  clear() {
    this.isCreatingChart = false;
    this.pendingNodes = null;
    this.direction = null;
    this.numberOfNodes = 0;
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
