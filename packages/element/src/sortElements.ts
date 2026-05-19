import { arrayToMap } from "@excalidraw/common";

import type { ExcalidrawElement } from "./types";

const defragmentGroups = (elements: readonly ExcalidrawElement[]) => {
  const groupIdAtLevel = (element: ExcalidrawElement, level: number) => {
    return element.groupIds[element.groupIds.length - level - 1];
  };

  const orderLevel = (
    levelElements: readonly ExcalidrawElement[],
    level: number,
  ): ExcalidrawElement[] => {
    const buckets = new Map<string, ExcalidrawElement[]>();
    // Slots preserve first-occurrence order: a groupId reserves its slot
    // the first time one of its members is seen; loose elements occupy
    // their own slot. Groups are then expanded (and recursed into) in place.
    const slots: (ExcalidrawElement | string)[] = [];

    for (const element of levelElements) {
      const groupId = groupIdAtLevel(element, level);
      if (groupId === undefined) {
        slots.push(element);
        continue;
      }
      let bucket = buckets.get(groupId);
      if (!bucket) {
        bucket = [];
        buckets.set(groupId, bucket);
        slots.push(groupId);
      }
      bucket.push(element);
    }

    return slots.flatMap((slot) =>
      typeof slot === "string"
        ? orderLevel(buckets.get(slot)!, level + 1)
        : [slot],
    );
  };

  // `groupIds` is stored innermost-first, so the outermost group is the
  // last entry. We recurse from level 0 (outermost) inward.
  const sortedElements = orderLevel(elements, 0);

  // if there's a bug which resulted in losing some of the elements, return
  // original instead as that's better than losing data
  if (sortedElements.length !== elements.length) {
    console.error("defragmentGroups: lost some elements... bailing!");
    return elements;
  }

  return sortedElements;
};

/**
 * In theory, when we have text elements bound to a container, they
 * should be right after the container element in the elements array.
 * However, this is not guaranteed due to old and potential future bugs.
 *
 * This function sorts containers and their bound texts together. It prefers
 * original z-index of container (i.e. it moves bound text elements after
 * containers).
 */
const normalizeBoundElementsOrder = (
  elements: readonly ExcalidrawElement[],
) => {
  const elementsMap = arrayToMap(elements);

  const sortedElements = new Set<ExcalidrawElement>();

  for (const element of elements) {
    if (sortedElements.has(element)) {
      continue;
    }

    if (element.boundElements?.length) {
      sortedElements.add(element);
      for (const boundElement of element.boundElements) {
        const child = elementsMap.get(boundElement.id);
        if (child && boundElement.type === "text") {
          sortedElements.add(child);
        }
      }
      continue;
    }

    // if element has a container and container lists it, skip this element
    // as it'll be taken care of by the container
    if (
      element.type === "text" &&
      element.containerId &&
      elementsMap
        .get(element.containerId)
        ?.boundElements?.some((el) => el.id === element.id)
    ) {
      continue;
    }

    sortedElements.add(element);
  }

  // if there's a bug which resulted in losing some of the elements, return
  // original instead as that's better than losing data
  if (sortedElements.size !== elements.length) {
    console.error(
      "normalizeBoundElementsOrder: lost some elements... bailing!",
    );
    return elements;
  }

  return [...sortedElements];
};

export const normalizeElementOrder = (
  elements: readonly ExcalidrawElement[],
) => {
  return normalizeBoundElementsOrder(defragmentGroups(elements));
};
