import { ExcalidrawElement } from "./element/types";
import { newElementWith } from "./element/mutateElement";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

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

export const calculateBoundingBoxesForGroups = (
  groups: Map<String, ExcalidrawElement[]>,
) => {
  const groupBoundingBoxes = new Map<String, Box>();

  groups.forEach((group, groupId) => {
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

export const getReferenceElement = (
  elements: Box[],
  { axis, position }: Alignment,
): Box => {
  const dimension = axis === "x" ? "width" : "height";

  const startElement = elements.reduce((start, current) =>
    current[axis] < start[axis] ? current : start,
  );

  const endElement = elements.reduce((end, current) =>
    current[axis] + current[dimension] > end[axis] + end[dimension]
      ? current
      : end,
  );

  if (position === "start") {
    return startElement;
  } else if (position === "end") {
    return endElement;
  }

  //if (position === "center")
  return {
    x: startElement.x,
    y: startElement.y,
    width: endElement.x + endElement.width - startElement.x,
    height: endElement.y + endElement.height - startElement.y,
  };
};

const alignStart = (
  referenceElementPosition: number,
  boundingBoxPosition: number,
) => {
  return referenceElementPosition - boundingBoxPosition;
};

const alignCenter = (
  referenceElementPosition: number,
  referenceElementSize: number,
  boundingBoxPosition: number,
  boundingBoxSize: number,
) => {
  return (
    referenceElementPosition +
    referenceElementSize / 2 -
    (boundingBoxPosition + boundingBoxSize / 2)
  );
};

const alignEnd = (
  referenceElementPosition: number,
  referenceElementSize: number,
  boundingBoxPosition: number,
  boundingBoxSize: number,
) => {
  return (
    referenceElementPosition +
    referenceElementSize -
    (boundingBoxPosition + boundingBoxSize)
  );
};

export interface Alignment {
  position: "start" | "center" | "end";
  axis: "x" | "y";
}

const calculateTranslation = (
  referenceElement: Box,
  boundingBox: Box,
  { axis, position }: Alignment,
) => {
  const dimension = axis === "x" ? "width" : "height";

  const translation = {
    x: 0,
    y: 0,
  };

  if (position === "start") {
    translation[axis] = alignStart(referenceElement[axis], boundingBox[axis]);
  } else if (position === "center") {
    translation[axis] = alignCenter(
      referenceElement[axis],
      referenceElement[dimension],
      boundingBox[axis],
      boundingBox[dimension],
    );
  } else if (position === "end") {
    translation[axis] = alignEnd(
      referenceElement[axis],
      referenceElement[dimension],
      boundingBox[axis],
      boundingBox[dimension],
    );
  }

  return translation;
};

export const alignElements = (
  elements: ExcalidrawElement[],
  alignment: Alignment,
): ExcalidrawElement[] => {
  const groups = getAlignmentGroupsForElements(elements);
  const groupBoundingBoxes: Map<String, Box> = calculateBoundingBoxesForGroups(
    groups,
  );

  const referenceElement = getReferenceElement(
    Array.from(groupBoundingBoxes.values()),
    alignment,
  );

  return elements.map((element) => {
    const boundingBox: Box = groupBoundingBoxes.get(
      element.groupIds.length === 0
        ? element.id
        : element.groupIds[element.groupIds.length - 1],
    ) as Box;

    const translation = calculateTranslation(
      referenceElement,
      boundingBox,
      alignment,
    ) as { x: number; y: number };

    return newElementWith(element, {
      x: element.x + translation.x,
      y: element.y + translation.y,
    });
  });
};
