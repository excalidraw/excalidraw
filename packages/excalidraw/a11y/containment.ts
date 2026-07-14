import { getBoundTextElement } from "@excalidraw/element";

import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";

import { getSceneReadingOrder } from "./readingOrder";

/**
 * Geometric containment ("layers"): many boards express structure by nesting
 * boxes inside larger labeled boxes (swimlanes, zones, architecture layers)
 * instead of frames or arrows. Sighted users read that nesting at a glance;
 * this derives it so descriptions can say `inside "Shared Enablers"` and
 * containers can say "contains 12 elements".
 *
 * A container is a labeled rectangle/ellipse/diamond; an element belongs to
 * the smallest container whose bounding box fully encloses it. The index is
 * cached per elements map (Scene memoizes the map between mutations).
 */

type ContainmentIndex = {
  /** element id -> id of its nearest (smallest) enclosing labeled shape */
  containerOf: Map<string, string>;
  /** container id -> ids of elements whose nearest container it is */
  childrenOf: Map<string, string[]>;
};

// beyond this the O(elements × containers) sweep isn't worth the payoff
const MAX_ELEMENTS_FOR_CONTAINMENT = 3000;
const TOLERANCE = 1;

const indexCache = new WeakMap<ElementsMap, ContainmentIndex>();

const isContainerShape = (element: ExcalidrawElement) =>
  element.type === "rectangle" ||
  element.type === "ellipse" ||
  element.type === "diamond";

const encloses = (container: ExcalidrawElement, element: ExcalidrawElement) =>
  container.x - TOLERANCE <= element.x &&
  container.y - TOLERANCE <= element.y &&
  container.x + container.width + TOLERANCE >= element.x + element.width &&
  container.y + container.height + TOLERANCE >= element.y + element.height;

const buildIndex = (elementsMap: ElementsMap): ContainmentIndex => {
  const containerOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  const index = { containerOf, childrenOf };

  if (elementsMap.size > MAX_ELEMENTS_FOR_CONTAINMENT) {
    return index;
  }

  // labeled shapes only — "inside an unnamed rectangle" doesn't orient anyone
  const containers = [...elementsMap.values()]
    .filter(
      (el) =>
        !el.isDeleted &&
        isContainerShape(el) &&
        getBoundTextElement(el, elementsMap)?.text,
    )
    .sort((a, b) => a.width * a.height - b.width * b.height);

  if (!containers.length) {
    return index;
  }

  for (const element of elementsMap.values()) {
    if (
      element.isDeleted ||
      // bound labels are announced as part of their container
      ("containerId" in element && element.containerId)
    ) {
      continue;
    }
    const area = element.width * element.height;
    for (const container of containers) {
      if (
        container.id !== element.id &&
        container.width * container.height > area &&
        encloses(container, element)
      ) {
        containerOf.set(element.id, container.id);
        let children = childrenOf.get(container.id);
        if (!children) {
          children = [];
          childrenOf.set(container.id, children);
        }
        children.push(element.id);
        break;
      }
    }
  }
  return index;
};

const getIndex = (elementsMap: ElementsMap): ContainmentIndex => {
  let index = indexCache.get(elementsMap);
  if (!index) {
    index = buildIndex(elementsMap);
    indexCache.set(elementsMap, index);
  }
  return index;
};

/** the nearest labeled shape visually enclosing this element, if any */
export const getGeometricContainer = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): ExcalidrawElement | null => {
  const containerId = getIndex(elementsMap).containerOf.get(element.id);
  return (containerId && elementsMap.get(containerId)) || null;
};

/** how many elements this shape visually encloses (as nearest container) */
export const getContainedElementsCount = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): number => getIndex(elementsMap).childrenOf.get(element.id)?.length ?? 0;

/**
 * The elements visually nested inside this box (those whose nearest labeled
 * container it is), in reading order; for frames, the frame's members.
 */
export const getContainedElements = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): ExcalidrawElement[] => {
  let children: ExcalidrawElement[];
  if (element.type === "frame" || element.type === "magicframe") {
    children = [...elementsMap.values()].filter(
      (el) =>
        !el.isDeleted &&
        el.frameId === element.id &&
        !("containerId" in el && el.containerId),
    );
  } else {
    children = (getIndex(elementsMap).childrenOf.get(element.id) ?? [])
      .map((id) => elementsMap.get(id))
      .filter((el): el is ExcalidrawElement => !!el && !el.isDeleted);
  }
  return getSceneReadingOrder(children);
};
