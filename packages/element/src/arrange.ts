import { getCommonBoundingBox } from "./bounds";

import { getMaximumGroups } from "./groups";

import { mutateElement } from "./mutateElement";

import { GrowingPacker, type Block } from "./arrange-algorithms/packer";

import type { BoundingBox } from "./bounds";

import type {
  ElementsMap,
  ExcalidrawElement,
  ArrangeAlgorithms,
} from "./types";

interface Group {
  group: ExcalidrawElement[];
  boundingBox: BoundingBox;
}

/**
 * Updates all elements relative to the group position
 */
const mutateGroup = (
  group: ExcalidrawElement[],
  update: { x: number; y: number },
) => {
  // Determine the delta of the group position, vs the new update position
  const groupBoundingBox = getCommonBoundingBox(group);
  const deltaX = update.x - groupBoundingBox.minX;
  const deltaY = update.y - groupBoundingBox.minY;
  // Update the elements in the group

  group.forEach((element) => {
    mutateElement(element, {
      x: element.x + deltaX,
      y: element.y + deltaY,
    });
  });
};

const arrangeElementsBinaryTreePacking = (
  groups: Group[],
  gap: number,
): ExcalidrawElement[] => {
  const flattendGroups = groups.flatMap((g) => g.group);
  const commonBoundingBox = getCommonBoundingBox(flattendGroups);
  const origin = {
    x: commonBoundingBox.minX,
    y: commonBoundingBox.minY,
  };

  const groupBlocks: (Block & {
    group: ExcalidrawElement[];
  })[] = groups
    // sort gropus by maxSide, highest to lowest
    .sort(
      (a, b) =>
        Math.max(b.boundingBox.width, b.boundingBox.height) -
        Math.max(a.boundingBox.width, a.boundingBox.height),
    )
    .map((g) => ({
      w: g.boundingBox.width,
      h: g.boundingBox.height,
      group: g.group,
    }));

  const packer = new GrowingPacker(gap);
  packer.fit(groupBlocks);

  const groupsAdded = [];
  for (let n = 0; n < groupBlocks.length; n++) {
    const block = groupBlocks[n];
    if (block.fit) {
      // Add to elements translation
      groupsAdded.push(block);
      // DrawRectangle(block.fit.x, block.fit.y, block.w, block.h);
    }
  }
  // For each groupsAdded, we need to actually perform the translation
  // and update the elements
  groupsAdded.forEach((group) => {
    mutateGroup(group.group, {
      x: origin.x + (group.fit?.x ?? 0),
      y: origin.y + (group.fit?.y ?? 0),
    });
  });

  return groupsAdded.flatMap((group) => group.group);
};

const arrangeElements = (
  selectedElements: ExcalidrawElement[],
  elementsMap: ElementsMap,
  algorithm: ArrangeAlgorithms,
  gap: number,
): ExcalidrawElement[] => {
  // Determine the groups that we would be rearranging, as we don't want to be
  // making any manipulations within groups
  const groups: ExcalidrawElement[][] = getMaximumGroups(
    selectedElements,
    elementsMap,
  );
  const groupBoundingBoxes = groups.map((group) => ({
    group,
    boundingBox: getCommonBoundingBox(group),
  }));

  switch (algorithm) {
    case "bin-packing":
      return arrangeElementsBinaryTreePacking(groupBoundingBoxes, gap);
    default:
      console.warn(
        `Unimplemented algorithm [${algorithm}] - using bin-packing`,
      );
      return arrangeElementsBinaryTreePacking(groupBoundingBoxes, gap);
  }
};

export { arrangeElements };
