import { newElementWith } from "./element/mutateElement";
import { getMaximumGroups } from "./groups";
import type { ElementsMap, ExcalidrawElement } from "./element/types";
import { getCommonBounds } from "./element/bounds";

export interface Distribution {
  space: "between";
  axis: "x" | "y";
}

export const distributeElements = (
  selectedElements: ExcalidrawElement[],
  elementsMap: ElementsMap,
  distribution: Distribution,
): ExcalidrawElement[] => {
  const [start, mid, end, extent] =
    distribution.axis === "x"
      ? (["minX", "midX", "maxX", "width"] as const)
      : (["minY", "midY", "maxY", "height"] as const);

  const bb = getCommonBounds(selectedElements);
  const bounds = {
    minX: bb[0],
    minY: bb[1],
    maxX: bb[2],
    maxY: bb[3],
    midX: (bb[0] + bb[2]) / 2,
    midY: (bb[1] + bb[3]) / 2,
    width: bb[2] - bb[0],
    height: bb[3] - bb[1],
  };
  const groups = getMaximumGroups(selectedElements, elementsMap)
    .map((group) => {
      const bounds = getCommonBounds(group);

      return [
        group,
        {
          minX: bounds[0],
          minY: bounds[1],
          maxX: bounds[2],
          maxY: bounds[3],
          midX: (bounds[0] + bounds[2]) / 2,
          midY: (bounds[1] + bounds[3]) / 2,
          width: bounds[2] - bounds[0],
          height: bounds[3] - bounds[1],
        },
      ] as const;
    })
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
