import { ExcalidrawElement } from "./element/types";
import { newElementWith } from "./element/mutateElement";
import { getCommonBounds } from "./element";

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type AlignmentType =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "verticallyCentered"
  | "horizontallyCentered";

export const alignElements = (
  elements: ExcalidrawElement[],
  type: AlignmentType,
): ExcalidrawElement[] => {
  const groups: Map<
    String,
    ExcalidrawElement[]
  > = getAlignmentGroupsForElements(elements);

  const groupBoundingBoxes = new Map<String, Box>();
  groups.forEach((group, groupId) => {
    const [minX, minY, maxX, maxY] = getCommonBounds(group);
    groupBoundingBoxes.set(groupId, { minX, minY, maxX, maxY });
  });

  const referenceElement = getReferenceElement(
    Array.from(groupBoundingBoxes.values()),
    type,
  );

  const updatedElements: ExcalidrawElement[] = [];

  groups.forEach((group, groupId) => {
    const translation = calculateTranslation(
      groupBoundingBoxes.get(groupId) as Box,
      referenceElement,
      type,
    ) as {
      x: number;
      y: number;
    };

    group.forEach((e) =>
      updatedElements.push(
        newElementWith(e, {
          x: e.x + translation.x,
          y: e.y + translation.y,
        }),
      ),
    );
  });

  return updatedElements;
};

export const getAlignmentGroupsForElements = (
  elements: ExcalidrawElement[],
) => {
  const groups: Map<String, ExcalidrawElement[]> = new Map<
    String,
    ExcalidrawElement[]
  >();

  elements.forEach((element: ExcalidrawElement) => {
    const groupId =
      element.groupIds.length === 0
        ? element.id
        : element.groupIds[element.groupIds.length - 1];

    const currentGroupMembers = groups.get(groupId) || [];

    groups.set(groupId, [...currentGroupMembers, element]);
  });

  return groups;
};

export const getReferenceElement = (
  groupBoundingBoxes: Box[],
  type: AlignmentType,
) => {
  if (type === "top") {
    return {
      minY: Math.min(...groupBoundingBoxes.map(({ minY }) => minY)),
    } as Box;
  } else if (type === "bottom") {
    return {
      maxY: Math.max(...groupBoundingBoxes.map(({ maxY }) => maxY)),
    } as Box;
  } else if (type === "left") {
    return {
      minX: Math.min(...groupBoundingBoxes.map(({ minX }) => minX)),
    } as Box;
  } else if (type === "right") {
    return {
      maxX: Math.max(...groupBoundingBoxes.map(({ maxX }) => maxX)),
    } as Box;
  } else if (type === "horizontallyCentered") {
    const minX = Math.min(...groupBoundingBoxes.map(({ minX }) => minX));
    const maxX = Math.max(...groupBoundingBoxes.map(({ maxX }) => maxX));

    return { minX, maxX } as Box;
  } //else if (type === "verticallyCentered") {
  const minY = Math.min(...groupBoundingBoxes.map(({ minY }) => minY));
  const maxY = Math.max(...groupBoundingBoxes.map(({ maxY }) => maxY));

  return { minY, maxY } as Box;
};

const calculateTranslation = (
  groupBoundingBox: Box,
  referenceElement: Box,
  type: AlignmentType,
): { x: number; y: number } => {
  if (type === "top") {
    return {
      x: 0,
      y: referenceElement.minY - groupBoundingBox.minY,
    };
  } else if (type === "bottom") {
    return {
      x: 0,
      y: referenceElement.maxY - groupBoundingBox.maxY,
    };
  } else if (type === "left") {
    return {
      x: referenceElement.minX - groupBoundingBox.minX,
      y: 0,
    };
  } else if (type === "right") {
    return {
      x: referenceElement.maxX - groupBoundingBox.maxX,
      y: 0,
    };
  } else if (type === "horizontallyCentered") {
    return {
      x:
        (referenceElement.minX + referenceElement.maxX) / 2 -
        (groupBoundingBox.minX + groupBoundingBox.maxX) / 2,
      y: 0,
    };
  } // else if (type === "verticallyCentered")
  return {
    x: 0,
    y:
      (referenceElement.minY + referenceElement.maxY) / 2 -
      (groupBoundingBox.minY + groupBoundingBox.maxY) / 2,
  };
};
