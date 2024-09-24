import type { ElementsMap, ExcalidrawElement } from "./element/types";
import { newElementWith } from "./element/mutateElement";
import { getCommonBounds, type Bounds } from "./element/bounds";
import { getMaximumGroups } from "./groups";

export interface Alignment {
  position: "start" | "center" | "end";
  axis: "x" | "y";
}

export const alignElements = (
  selectedElements: ExcalidrawElement[],
  elementsMap: ElementsMap,
  alignment: Alignment,
): ExcalidrawElement[] => {
  const groups: ExcalidrawElement[][] = getMaximumGroups(
    selectedElements,
    elementsMap,
  );
  const selectionBounds = getCommonBounds(selectedElements);

  return groups.flatMap((group) => {
    const translation = calculateTranslation(group, selectionBounds, alignment);
    return group.map((element) =>
      newElementWith(element, {
        x: element.x + translation.x,
        y: element.y + translation.y,
      }),
    );
  });
};

const calculateTranslation = (
  group: ExcalidrawElement[],
  selectionBounds: Bounds,
  { axis, position }: Alignment,
): { x: number; y: number } => {
  const selectionBoundingBox = {
    minX: selectionBounds[0],
    minY: selectionBounds[1],
    maxX: selectionBounds[2],
    maxY: selectionBounds[3],
    midX: (selectionBounds[0] + selectionBounds[2]) / 2,
    midY: (selectionBounds[1] + selectionBounds[3]) / 2,
    width: selectionBounds[2] - selectionBounds[0],
    height: selectionBounds[3] - selectionBounds[1],
  };
  const groupBounds = getCommonBounds(group);
  const groupBoundingBox = {
    minX: groupBounds[0],
    minY: groupBounds[1],
    maxX: groupBounds[2],
    maxY: groupBounds[3],
    midX: (groupBounds[0] + groupBounds[2]) / 2,
    midY: (groupBounds[1] + groupBounds[3]) / 2,
    width: groupBounds[2] - groupBounds[0],
    height: groupBounds[3] - groupBounds[1],
  };

  const [min, max]: ["minX" | "minY", "maxX" | "maxY"] =
    axis === "x" ? ["minX", "maxX"] : ["minY", "maxY"];

  const noTranslation = { x: 0, y: 0 };
  if (position === "start") {
    return {
      ...noTranslation,
      [axis]: selectionBoundingBox[min] - groupBoundingBox[min],
    };
  } else if (position === "end") {
    return {
      ...noTranslation,
      [axis]: selectionBoundingBox[max] - groupBoundingBox[max],
    };
  } // else if (position === "center") {
  return {
    ...noTranslation,
    [axis]:
      (selectionBoundingBox[min] + selectionBoundingBox[max]) / 2 -
      (groupBoundingBox[min] + groupBoundingBox[max]) / 2,
  };
};
