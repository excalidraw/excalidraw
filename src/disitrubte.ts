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
  width: number;
  height: number;
}

export interface Distribution {
  space: "between";
  axis: "x" | "y";
}

export const distributeElements = (
  selectedElements: ExcalidrawElement[],
  distribution: Distribution,
): ExcalidrawElement[] => {
  const [start, mid, end, extent] =
    distribution.axis === "x"
      ? (["minX", "midX", "maxX", "width"] as const)
      : (["minY", "midY", "maxY", "height"] as const);

  const bounds = getCommonBoundingBox(selectedElements);
  const groups = getMaximumGroups(selectedElements)
    .map((group) => [group, getCommonBoundingBox(group)] as const)
    .sort((a, b) => a[1][mid] - b[1][mid]);

  let span = 0;
  for (const group of groups) {
    span += group[1][extent];
  }

  const step = (bounds[extent] - span) / (groups.length - 1);

  if (step < 0) {
    // If we have a negative step, we'll need to distribute from centers
    // rather than from gaps. Buckle up, this is a weird one.

    // Get indices of boxes that define start and end of our bounding box
    const index0 = groups.findIndex((g) => g[1][start] === bounds[start]);
    const index1 = groups.findIndex((g) => g[1][end] === bounds[end]);

    // Get our step, based on the distance between the center points of our
    // start and end boxes
    const step =
      (groups[index1][1][mid] - groups[index0][1][mid]) / (groups.length - 1);

    let pos = groups[index0][1][mid];

    return groups.flatMap(([group, box], index) => {
      const translation = {
        x: 0,
        y: 0,
      };

      // Don't move our start and end boxes
      if (index !== index0 && index !== index1) {
        pos += step;
        translation[distribution.axis] = pos - box[mid];
      }

      return group.map((element) =>
        newElementWith(element, {
          x: element.x + translation.x,
          y: element.y + translation.y,
        }),
      );
    });
  }

  // Distribute from gaps

  let pos = bounds[start];

  return groups.flatMap(([group, box]) => {
    const translation = {
      x: 0,
      y: 0,
    };

    translation[distribution.axis] = pos - box[start];

    pos += step;
    pos += box[extent];

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
    width: maxX - minX,
    height: maxY - minY,
    midX: (minX + maxX) / 2,
    midY: (minY + maxY) / 2,
  };
};
