import {
  NonDeletedExcalidrawElement,
  ExcalidrawLinearElement,
  NonDeleted,
} from "./types";
import { getCommonBounds } from "./bounds";
import { mutateElement } from "./mutateElement";
import { SHAPES } from "../shapes";
import { getPerfectElementSize } from "./sizeHelpers";
import { LinearElementEditor } from "./linearElementEditor";
import Scene from "../scene/Scene";

export const dragSelectedElements = (
  selectedElements: NonDeletedExcalidrawElement[],
  pointerX: number,
  pointerY: number,
  scene: Scene,
) => {
  const [x1, y1] = getCommonBounds(selectedElements);
  const offset = { x: pointerX - x1, y: pointerY - y1 };
  selectedElements.forEach((element) => {
    mutateElement(element, {
      x: element.x + offset.x,
      y: element.y + offset.y,
    });
    updateBoundElementsOnDrag(element, offset, scene);
  });
};

const updateBoundElementsOnDrag = (
  draggedElement: NonDeletedExcalidrawElement,
  offset: { x: number; y: number },
  scene: Scene,
) => {
  scene
    .getNonDeletedElements(draggedElement.boundElementIds ?? [])
    .forEach((boundElement) => {
      boundElement = boundElement as NonDeleted<ExcalidrawLinearElement>;
      if (boundElement.startBinding?.elementId === draggedElement.id) {
        LinearElementEditor.movePointByOffset(boundElement, 0, offset);
      }
      if (boundElement.endBinding?.elementId === draggedElement.id) {
        LinearElementEditor.movePointByOffset(
          boundElement,
          boundElement.points.length - 1,
          offset,
        );
      }
    });
};

export const getDragOffsetXY = (
  selectedElements: NonDeletedExcalidrawElement[],
  x: number,
  y: number,
): [number, number] => {
  const [x1, y1] = getCommonBounds(selectedElements);
  return [x - x1, y - y1];
};

export const dragNewElement = (
  draggingElement: NonDeletedExcalidrawElement,
  elementType: typeof SHAPES[number]["value"],
  originX: number,
  originY: number,
  x: number,
  y: number,
  width: number,
  height: number,
  isResizeWithSidesSameLength: boolean,
  isResizeCenterPoint: boolean,
) => {
  if (isResizeWithSidesSameLength) {
    ({ width, height } = getPerfectElementSize(
      elementType,
      width,
      y < originY ? -height : height,
    ));

    if (height < 0) {
      height = -height;
    }
  }

  let newX = x < originX ? originX - width : originX;
  let newY = y < originY ? originY - height : originY;

  if (isResizeCenterPoint) {
    width += width;
    height += height;
    newX = originX - width / 2;
    newY = originY - height / 2;
  }

  if (width !== 0 && height !== 0) {
    mutateElement(draggingElement, {
      x: newX,
      y: newY,
      width: width,
      height: height,
    });
  }
};
