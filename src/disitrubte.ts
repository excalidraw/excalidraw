import { ExcalidrawElement } from "./element/types";
import { newElementWith } from "./element/mutateElement";
import { getCommonBounds } from "./element";

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  midX: number;
  midY: number;
}

export interface Distribution {
  space: "between";
  axis: "x" | "y";
}

export const distributeElements = (
  selectedElements: ExcalidrawElement[],
  distribution: Distribution,
): ExcalidrawElement[] => {
  const [start, end, mid] =
    distribution.axis === "x"
      ? (["minX", "maxX", "midX"] as const)
      : (["minY", "maxY", "midY"] as const);

  const groups = getMaximumGroups(selectedElements)
    .map((group) => [group, getCommonBoundingBox(group)] as const)
    .sort((a, b) => a[1][mid] - b[1][mid]);

  const [max, min] = groups.reduce<number[]>((acc, cur) => {
    const tmp = cur[1][mid];
    return [
      acc[0] !== undefined ? Math.max(acc[0], tmp) : tmp,
      acc[1] !== undefined ? Math.min(acc[1], tmp) : tmp,
    ];
  }, []);

  const step = (max - min) / groups.length;
  let pos = min;

  return groups.flatMap(([group, box], i) => {
    const translation = {
      x: 0,
      y: 0,
    };

    if (i > 0 && i < groups.length - 1) {
      pos += step;
      translation[distribution.axis] =
        Math.round(pos - (box[end] - box[start]) / 2) - box[start];
    }

    return group.map((element) =>
      newElementWith(element, {
        x: element.x + translation.x,
        y: element.y + translation.y,
      }),
    );
  });
};

export const getMaximumGroups = (
  elements: ExcalidrawElement[],
): ExcalidrawElement[][] => {
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

  return Array.from(groups.values());
};

const getCommonBoundingBox = (elements: ExcalidrawElement[]): Box => {
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);

  return {
    minX,
    minY,
    maxX,
    maxY,
    midX: (minX + maxX) / 2,
    midY: (minY + maxY) / 2,
  };
};
