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

export const getSuccessors = (
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
        boundArrow.elbowed &&
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

export const addNewNode = (
  element: ExcalidrawGenericElement,
  elementsMap: ElementsMap,
  scene: Scene,
  direction: SuccessorDirection = "right",
) => {
  const successors = getSuccessors(element, elementsMap, direction);

  const getOffsets = (
    element: ExcalidrawGenericElement,
    successors: ExcalidrawElement[],
    direction: SuccessorDirection,
  ) => {
    if (direction === "up" || direction === "down") {
      const _HORIZONTAL_OFFSET = HORIZONTAL_OFFSET + element.width;
      const _VERTICAL_OFFSET = VERTICAL_OFFSET + element.height - 10;
      const y =
        successors.length === 0 ? _VERTICAL_OFFSET + 10 : _VERTICAL_OFFSET;
      const x =
        successors.length === 0
          ? 0
          : (successors.length + 1) % 2 === 0
          ? ((successors.length + 1) / 2) * _HORIZONTAL_OFFSET
          : (successors.length / 2) * _HORIZONTAL_OFFSET * -1;

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
      (successors.length === 0 ? HORIZONTAL_OFFSET + 10 : HORIZONTAL_OFFSET) +
      element.width;
    const y =
      successors.length === 0
        ? 0
        : (successors.length + 1) % 2 === 0
        ? ((successors.length + 1) / 2) * _VERTICAL_OFFSET
        : (successors.length / 2) * _VERTICAL_OFFSET * -1;

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

  const offsets = getOffsets(element, successors, direction);

  const nextNode = newElement({
    type: element.type,
    x: element.x + offsets.x,
    y: element.y + offsets.y,
    width: element.width,
    height: element.height,
    roundness: element.roundness,
    roughness: element.roughness,
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
