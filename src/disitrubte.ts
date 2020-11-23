import { ExcalidrawElement } from "./element/types";
import { newElementWith } from "./element/mutateElement";
import { getCommonBounds } from "./element";

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Distribution {
  space: "between";
  axis: "x" | "y";
}

export const distributeElements = (
  selectedElements: ExcalidrawElement[],
  distribution: Distribution,
): ExcalidrawElement[] => {
  const start = distribution.axis === "x" ? "minX" : "minY";
  const extent = distribution.axis === "x" ? "width" : "height";

  const selectionBoundingBox = getCommonBoundingBox(selectedElements);

  const groups = getMaximumGroups(selectedElements)
    .map((group) => [group, getCommonBoundingBox(group)] as const)
    .sort((a, b) => a[1][start] - b[1][start]);

  let span = 0;
  for (const group of groups) {
    span += group[1][extent];
  }

  const step = (selectionBoundingBox[extent] - span) / (groups.length - 1);
  let pos = selectionBoundingBox[start];

  return groups.flatMap(([group, box]) => {
    const translation = {
      x: 0,
      y: 0,
    };

    if (Math.abs(pos - box[start]) >= 1e-6) {
      translation[distribution.axis] = pos - box[start];
    }

    pos += box[extent];
    pos += step;

    return group.map((element) =>
      newElementWith(element, {
        x: Math.round(element.x + translation.x),
        y: Math.round(element.y + translation.y),
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

const getCommonBoundingBox = (
  elements: ExcalidrawElement[],
): Box & { width: number; height: number } => {
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};
