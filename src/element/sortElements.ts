import { arrayToMap } from "../utils";
import { ExcalidrawElement } from "./types";

/**
 * In theory, when we have text elements bound to a container, they
 * should be right after the container element in the elements array.
 * However, there is no guarantee that this is the case (because of some bug
 * some time ago).
 *
 * This function sorts containers and their bound texts together while
 * preserving the z-index as much as possible
 * @param elements
 * @returns ExcalidrawElement[] sorted so texts and their bound containers are together
 */
export const sortBoundTextElementsAndContainersTogether = (
  elements: readonly ExcalidrawElement[],
) => {
  type LocalElement = ExcalidrawElement & {
    _children: LocalElement[];
  };

  const elementsMap = arrayToMap(elements) as Map<
    ExcalidrawElement["id"],
    ExcalidrawElement
  >;

  const elementsCopy: LocalElement[] = elements.map((e) => ({
    ...e,
    _children: [],
  }));
  const elementsCopyMap = arrayToMap(elementsCopy) as Map<
    LocalElement["id"],
    LocalElement
  >;

  // build trees that preserve z-index
  const trees = [];

  for (const element of elementsCopy) {
    if (element.boundElements?.length) {
      element.boundElements.forEach((boundElement) => {
        if (boundElement.type === "text") {
          element._children.push(elementsCopyMap.get(boundElement.id)!);
        }
      });
      trees.push(element);
    } else if (element.type === "text") {
      if (!element.containerId) {
        trees.push(element);
      }
    } else {
      trees.push(element);
    }
  }

  // use trees to sort elements
  const elementsOrdered: ExcalidrawElement[] = [];
  for (const root of trees) {
    elementsOrdered.push(elementsMap.get(root.id)!);
    for (const child of root._children) {
      elementsOrdered.push(elementsMap.get(child.id)!);
    }
  }

  return elementsOrdered;
};
