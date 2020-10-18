import { ExcalidrawElement } from "./element/types";
import { newElementWith } from "./element/mutateElement";

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

    const currentNoGroupArray = groups.get(groupId) || [];

    groups.set(groupId, [...currentNoGroupArray, element]);
  });

  return groups;
};

export const calculateBoundingboxForGroups = (
  groups: Map<String, ExcalidrawElement[]>,
) => {
  const groupBoundingBoxes = new Map<String, Box>();

  groups.forEach((group, groupId) => {
    // Calculate the bounding box
    const { x } = group.reduce((leftmost, current) =>
      current.x < leftmost.x ? current : leftmost,
    );

    const { y } = group.reduce((topmost, current) =>
      current.y < topmost.y ? current : topmost,
    );

    const rightmost = group.reduce((rightmost, current) =>
      current.x + current.width > rightmost.x + rightmost.width
        ? current
        : rightmost,
    );
    const width = rightmost.x + rightmost.width - x;

    const bottommost = group.reduce((bottommost, current) =>
      current.y + current.height > bottommost.y + bottommost.height
        ? current
        : bottommost,
    );
    const height = bottommost.y + bottommost.height - y;

    groupBoundingBoxes.set(groupId, {
      x,
      y,
      width,
      height,
    });
  });

  return groupBoundingBoxes;
};

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AlignmentType =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "verticallyCentered"
  | "horizontallyCentered";

export const getReferenceElement = (elements: Box[], type: AlignmentType) => {
  const axis = type === "top" || type === "bottom" ? "y" : "x";
  const dimension = type === "top" || type === "bottom" ? "height" : "width";

  if (type === "top" || type === "left") {
    return elements.reduce((start, current) =>
      current[axis] < start[axis] ? current : start,
    );
  } else if (type === "right" || type === "bottom") {
    return elements.reduce((end, current) =>
      current[axis] + current[dimension] > end[axis] + end[dimension]
        ? current
        : end,
    );
  } else if (type === "verticallyCentered" || type === "horizontallyCentered") {
    const startElement = elements.reduce((start, current) =>
      current[axis] < start[axis] ? current : start,
    );

    const endElement = elements.reduce((end, current) =>
      current[axis] + current[dimension] > end[axis] + end[dimension]
        ? current
        : end,
    );

    return {
      x: startElement.x,
      y: startElement.y,
      width: endElement.x + endElement.width - startElement.x,
      height: endElement.y + endElement.height - startElement.y,
    };
  }
};

const calculateTranslation = (
  referenceElement: Box,
  boundingBox: Box,
  type: AlignmentType,
) => {
  if (type === "verticallyCentered") {
    return {
      x: 0,
      y:
        referenceElement.y +
        referenceElement.height / 2 -
        (boundingBox.y + boundingBox.height / 2),
    };
  } else if (type === "horizontallyCentered") {
    return {
      x:
        referenceElement.x +
        referenceElement.width / 2 -
        (boundingBox.x + boundingBox.width / 2),
      y: 0,
    };
  } else if (type === "top") {
    return {
      x: 0,
      y: referenceElement.y - boundingBox.y,
    };
  } else if (type === "bottom") {
    return {
      x: 0,
      y:
        referenceElement.y +
        referenceElement.height -
        boundingBox.y -
        boundingBox.height,
    };
  } else if (type === "left") {
    return {
      x: referenceElement.x - boundingBox.x,
      y: 0,
    };
  } else if (type === "right") {
    return {
      x:
        referenceElement.x +
        referenceElement.width -
        boundingBox.x -
        boundingBox.width,
      y: 0,
    };
  }
};

export const alignElements = (
  elements: ExcalidrawElement[],
  type: AlignmentType,
): ExcalidrawElement[] => {
  const groups = getAlignmentGroupsForElements(elements);
  const groupBoundingBoxes: Map<String, Box> = calculateBoundingboxForGroups(
    groups,
  );

  const referenceElement = getReferenceElement(
    Array.from(groupBoundingBoxes.values()),
    type,
  );

  const updatedElements: ExcalidrawElement[] = [];

  groups.forEach((elements, groupId) => {
    const boundingBox: Box = groupBoundingBoxes.get(groupId) as Box;
    if (!boundingBox || !referenceElement) {
      return;
    }

    const translation = calculateTranslation(
      referenceElement,
      boundingBox,
      type,
    ) as { x: number; y: number };

    elements.forEach((e) =>
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
