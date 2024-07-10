import { HEADING_DOWN, HEADING_LEFT, HEADING_RIGHT, HEADING_UP } from "../math";
import type Scene from "../scene/Scene";
import { bindLinearElement } from "./binding";
import { LinearElementEditor } from "./linearElementEditor";
import { newArrowElement, newElement } from "./newElement";
import { aabbForElement, headingForPointFromElement } from "./routing";
import type {
  ElementsMap,
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElement,
  ExcalidrawGenericElement,
  NonDeletedSceneElementsMap,
  OrderedExcalidrawElement,
} from "./types";
import { KEYS } from "../keys";

type SuccessorDirection = "up" | "right" | "down" | "left";
const VERTICAL_OFFSET = 100;
const HORIZONTAL_OFFSET = 100;

export const getSuccessorDirectionFromKey = (
  key: string,
): SuccessorDirection => {
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

const getSuccessors = (
  element: ExcalidrawGenericElement,
  elementsMap: ElementsMap,
  direction: SuccessorDirection = "right",
) => {
  const boundElbowArrows = element.boundElements
    ?.filter((boundEl) => boundEl.type === "arrow")
    .map(
      (boundArrow) => elementsMap.get(boundArrow.id) as ExcalidrawArrowElement,
    )
    .filter(
      (boundArrow) =>
        boundArrow?.elbowed &&
        boundArrow.startBinding?.elementId === element.id &&
        boundArrow.endBinding,
    );

  if (!boundElbowArrows || boundElbowArrows.length === 0) {
    return [];
  }

  const successorsAndHeadingFors = boundElbowArrows.map((boundArrow) => {
    const successor = elementsMap.get(boundArrow.endBinding!.elementId)!;
    const headingFor = headingForPointFromElement(
      element as ExcalidrawBindableElement,
      aabbForElement(element),
      [boundArrow.x, boundArrow.y],
    );

    return {
      successor,
      headingFor,
    };
  });

  switch (direction) {
    case "up":
      return successorsAndHeadingFors
        .filter(
          (successorAndHeadingFor) =>
            successorAndHeadingFor.headingFor[0] === HEADING_UP[0] &&
            successorAndHeadingFor.headingFor[1] === HEADING_UP[1],
        )
        .map((successorAndHeadingFor) => successorAndHeadingFor.successor);
    case "down":
      return successorsAndHeadingFors
        .filter(
          (successorAndHeadingFor) =>
            successorAndHeadingFor.headingFor[0] === HEADING_DOWN[0] &&
            successorAndHeadingFor.headingFor[1] === HEADING_DOWN[1],
        )
        .map((successorAndHeadingFor) => successorAndHeadingFor.successor);
    case "right":
      return successorsAndHeadingFors
        .filter(
          (successorAndHeadingFor) =>
            successorAndHeadingFor.headingFor[0] === HEADING_RIGHT[0] &&
            successorAndHeadingFor.headingFor[1] === HEADING_RIGHT[1],
        )
        .map((successorAndHeadingFor) => successorAndHeadingFor.successor);
    case "left":
      return successorsAndHeadingFors
        .filter(
          (successorAndHeadingFor) =>
            successorAndHeadingFor.headingFor[0] === HEADING_LEFT[0] &&
            successorAndHeadingFor.headingFor[1] === HEADING_LEFT[1],
        )
        .map((successorAndHeadingFor) => successorAndHeadingFor.successor);
  }
};

export const getPredecessors = (
  element: ExcalidrawGenericElement,
  elementsMap: ElementsMap,
  direction: SuccessorDirection = "right",
) => {
  // find elbow arrows whose endBinding is the given element
  const comingInArrows = [...elementsMap.values()]
    .filter(
      (el) =>
        el.type === "arrow" &&
        el.startBinding &&
        el.endBinding?.elementId === element.id,
    )
    .map((arrow) => elementsMap.get(arrow.id)) as ExcalidrawArrowElement[];

  const predecessorsAndHeadingFors = comingInArrows.map((elbowArrow) => {
    const predecessor = elementsMap.get(elbowArrow.startBinding!.elementId)!;
    const lastPoint = elbowArrow.points[elbowArrow.points.length - 1];

    const headingFor = headingForPointFromElement(
      element as ExcalidrawBindableElement,
      aabbForElement(element),
      [lastPoint[0] + elbowArrow.x, lastPoint[1] + elbowArrow.y],
    );

    return {
      predecessor,
      headingFor,
    };
  });

  switch (direction) {
    case "up":
      return predecessorsAndHeadingFors
        .filter(
          (predecessorAndHeadingFor) =>
            predecessorAndHeadingFor.headingFor[0] === HEADING_UP[0] &&
            predecessorAndHeadingFor.headingFor[1] === HEADING_UP[1],
        )
        .map(
          (predecessorAndHeadingFor) => predecessorAndHeadingFor.predecessor,
        );
    case "down":
      return predecessorsAndHeadingFors
        .filter(
          (predecessorAndHeadingFor) =>
            predecessorAndHeadingFor.headingFor[0] === HEADING_DOWN[0] &&
            predecessorAndHeadingFor.headingFor[1] === HEADING_DOWN[1],
        )
        .map(
          (predecessorAndHeadingFor) => predecessorAndHeadingFor.predecessor,
        );
    case "right":
      return predecessorsAndHeadingFors
        .filter(
          (predecessorAndHeadingFor) =>
            predecessorAndHeadingFor.headingFor[0] === HEADING_RIGHT[0] &&
            predecessorAndHeadingFor.headingFor[1] === HEADING_RIGHT[1],
        )
        .map(
          (predecessorAndHeadingFor) => predecessorAndHeadingFor.predecessor,
        );
    case "left":
      return predecessorsAndHeadingFors
        .filter(
          (predecessorAndHeadingFor) =>
            predecessorAndHeadingFor.headingFor[0] === HEADING_LEFT[0] &&
            predecessorAndHeadingFor.headingFor[1] === HEADING_LEFT[1],
        )
        .map(
          (predecessorAndHeadingFor) => predecessorAndHeadingFor.predecessor,
        );
  }
};

const addNewNode = (
  element: ExcalidrawGenericElement,
  elementsMap: ElementsMap,
  scene: Scene,
  direction: SuccessorDirection = "right",
) => {
  const successors = getSuccessors(element, elementsMap, direction);
  const predeccessors = getPredecessors(element, elementsMap, direction);

  const getOffsets = (
    element: ExcalidrawGenericElement,
    linkedNodes: ExcalidrawElement[],
    direction: SuccessorDirection,
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
            (HORIZONTAL_OFFSET + element.width) *
            (direction === "left" ? -1 : 1),
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
  });

  const bindingArrow = createBindingArrow(
    element,
    nextNode,
    elementsMap,
    scene,
    direction,
  );

  return {
    nextNode,
    bindingArrow,
  };
};

export const addNewNodes = (
  startNode: ExcalidrawGenericElement,
  elementsMap: ElementsMap,
  scene: Scene,
  direction: SuccessorDirection,
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
    });

    const bindingArrow = createBindingArrow(
      startNode,
      nextNode,
      elementsMap,
      scene,
      direction,
    );

    newNodes.push(nextNode);
    newNodes.push(bindingArrow);
  }

  return newNodes;
};

const createBindingArrow = (
  startBindingElement: ExcalidrawGenericElement,
  endBindingElement: ExcalidrawGenericElement,
  elementsMap: ElementsMap,
  scene: Scene,
  direction: SuccessorDirection,
) => {
  let startX: number;
  let startY: number;

  switch (direction) {
    case "up": {
      startX = startBindingElement.x + startBindingElement.width / 2;
      startY = startBindingElement.y;
      break;
    }
    case "down": {
      startX = startBindingElement.x + startBindingElement.width / 2;
      startY = startBindingElement.y + startBindingElement.height;
      break;
    }
    case "right": {
      startX = startBindingElement.x + startBindingElement.width;
      startY = startBindingElement.y + startBindingElement.height / 2;
      break;
    }
    case "left": {
      startX = startBindingElement.x;
      startY = startBindingElement.y + startBindingElement.height / 2;
      break;
    }
  }

  let endX: number;
  let endY: number;

  switch (direction) {
    case "up": {
      endX = endBindingElement.x + endBindingElement.width / 2 - startX;
      endY = endBindingElement.y + endBindingElement.height - startY;
      break;
    }
    case "down": {
      endX = endBindingElement.x + endBindingElement.width / 2 - startX;
      endY = endBindingElement.y - startY;
      break;
    }
    case "right": {
      endX = endBindingElement.x - startX;
      endY = endBindingElement.y - startY + endBindingElement.height / 2;
      break;
    }
    case "left": {
      endX = endBindingElement.x + endBindingElement.width - startX;
      endY = endBindingElement.y - startY + endBindingElement.height / 2;
      break;
    }
  }

  const bindingArrow = newArrowElement({
    type: "arrow",
    x: startX,
    y: startY,
    startArrowhead: null,
    endArrowhead: "arrow",
    points: [
      [0, 0],
      [endX, endY],
    ],
    elbowed: true,
  });

  bindLinearElement(
    bindingArrow,
    startBindingElement as ExcalidrawBindableElement,
    "start",
    elementsMap as NonDeletedSceneElementsMap,
  );
  bindLinearElement(
    bindingArrow,
    endBindingElement as ExcalidrawBindableElement,
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

  LinearElementEditor.movePoints(
    bindingArrow,
    [
      {
        index: 1,
        point: bindingArrow.points[1],
      },
    ],
    scene,
    {},
    {
      changedElements,
    },
  );

  return bindingArrow;
};

export class FlowChartNavigator {
  private isExploringSameLevelNodes: boolean = false;
  private sameLevelNodes: ExcalidrawElement[] = [];
  private sameLevelIndex: number = 0;
  // set it to the opposite of the defalut creation direction
  private direction: SuccessorDirection = "left";

  clear() {
    this.isExploringSameLevelNodes = false;
    this.sameLevelNodes = [];
    this.sameLevelIndex = 0;
    this.direction = "left";
  }

  exploreNode(
    element: ExcalidrawGenericElement,
    elementsMap: ElementsMap,
    direction: SuccessorDirection,
  ): string | null {
    if (
      this.isExploringSameLevelNodes &&
      direction === this.direction &&
      this.sameLevelNodes.length > 1 &&
      this.sameLevelNodes.some((node) => node.id === element.id)
    ) {
      this.sameLevelIndex =
        (this.sameLevelIndex + 1) % this.sameLevelNodes.length;

      return this.sameLevelNodes[this.sameLevelIndex].id;
    }

    // explore again
    this.clear();
    const nodes = [
      ...getSuccessors(element, elementsMap, direction),
      ...getPredecessors(element, elementsMap, direction),
    ];

    if (nodes.length > 0) {
      this.isExploringSameLevelNodes = true;
      this.sameLevelNodes = nodes;
      this.direction = direction;

      return nodes[0].id;
    }

    return null;
  }

  wasExploring() {
    if (this.isExploringSameLevelNodes) {
      this.clear();
      return true;
    }
    return false;
  }
}

export class FlowChartCreator {
  isCreatingChart: boolean = false;
  private numberOfNodes: number = 0;
  private direction: SuccessorDirection | null = "right";
  pendingNodes: ExcalidrawElement[] = [];

  createNodes(
    startNode: ExcalidrawGenericElement,
    elementsMap: ElementsMap,
    scene: Scene,
    direction: SuccessorDirection,
  ) {
    if (direction !== this.direction) {
      const { nextNode, bindingArrow } = addNewNode(
        startNode,
        elementsMap,
        scene,
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
        scene,
        direction,
        this.numberOfNodes,
      );

      this.isCreatingChart = true;
      this.direction = direction;
      this.pendingNodes = newNodes;
    }
  }

  clear() {
    this.isCreatingChart = false;
    this.pendingNodes = [];
    this.direction = null;
    this.numberOfNodes = 0;
  }
}
