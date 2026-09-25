import type { AppState } from "@excalidraw/excalidraw/types";

import { updateBoundElements } from "./binding";
import { getCommonBoundingBox } from "./bounds";

import { getSelectedElementsByGroup } from "./groups";

import { getNonDeletedElements } from ".";

import type { Scene } from "./Scene";

import type { ElementsMap, NonDeletedExcalidrawElement } from "./types";

export interface Distribution {
  space: "between";
  axis: "x" | "y";
}

export const distributeElements = (
  selectedElements: NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
  distribution: Distribution,
  appState: Readonly<AppState>,
  scene: Scene,
): NonDeletedExcalidrawElement[] => {
  const [start, mid, extent] =
    distribution.axis === "x"
      ? (["minX", "midX", "width"] as const)
      : (["minY", "midY", "height"] as const);

  const bounds = getCommonBoundingBox(selectedElements);
  const groups = getSelectedElementsByGroup(
    selectedElements,
    elementsMap,
    appState,
  )
    .map(getNonDeletedElements) // Nothing to distribute on deleted elements
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

    // Anchor on the outermost boxes by center. `groups` is already sorted by
    // center, so those are simply the first and the last one. Picking them by
    // which box touches the bounding box edges instead would break when a
    // single wide box defines both edges: it would be picked twice, making the
    // step 0 and collapsing every box between onto one center.
    const lastIndex = groups.length - 1;

    // Get our step, based on the distance between the center points of our
    // start and end boxes
    const step =
      (groups[lastIndex][1][mid] - groups[0][1][mid]) / (groups.length - 1);

    let pos = groups[0][1][mid];

    return groups.flatMap(([group, box], index) => {
      const translation = {
        x: 0,
        y: 0,
      };

      // Don't move our start and end boxes
      if (index !== 0 && index !== lastIndex) {
        pos += step;
        translation[distribution.axis] = pos - box[mid];
      }

      return group.map((element) => {
        const updatedElement = scene.mutateElement(element, {
          x: element.x + translation.x,
          y: element.y + translation.y,
        });
        updateBoundElements(element, scene, {
          simultaneouslyUpdated: group,
        });
        return updatedElement;
      });
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

    return group.map((element) => {
      const updatedElement = scene.mutateElement(element, {
        x: element.x + translation.x,
        y: element.y + translation.y,
      });
      updateBoundElements(element, scene, {
        simultaneouslyUpdated: group,
      });
      return updatedElement;
    });
  });
};
