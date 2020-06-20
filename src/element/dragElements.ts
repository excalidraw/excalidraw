import { NonDeletedExcalidrawElement } from "./types";
import { getCommonBounds } from "./bounds";
import { mutateElement } from "./mutateElement";
import { GRID_SIZE } from "../renderer/renderScene"; // FIXME

export const dragElements = (
  selectedElements: NonDeletedExcalidrawElement[],
  pointerX: number,
  pointerY: number,
) => {
  if (GRID_SIZE) {
    pointerX = Math.round(pointerX / GRID_SIZE) * GRID_SIZE;
    pointerY = Math.round(pointerY / GRID_SIZE) * GRID_SIZE;
  }
  const [x1, y1] = getCommonBounds(selectedElements);
  selectedElements.forEach((element) => {
    mutateElement(element, {
      x: pointerX + element.x - x1,
      y: pointerY + element.y - y1,
    });
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
