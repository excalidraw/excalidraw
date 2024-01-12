import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../excalidraw/element/types";

export const getContainerElement = (
  element:
    | (ExcalidrawElement & {
        containerId: ExcalidrawElement["id"] | null;
      })
    | null,
  sceneElements: readonly NonDeletedExcalidrawElement[],
) => {
  if (!element) {
    return null;
  }
  if (element.containerId) {
    return sceneElements.find((ele) => ele.id === element.containerId);
  }
  return null;
};

export const getBoundTextElementId = (container: ExcalidrawElement | null) => {
  return container?.boundElements?.length
    ? container?.boundElements?.filter((ele) => ele.type === "text")[0]?.id ||
        null
    : null;
};

export const getBoundTextElement = (
  element: ExcalidrawElement | null,
  sceneElements: readonly NonDeletedExcalidrawElement[],
) => {
  if (!element) {
    return null;
  }
  const boundTextElementId = getBoundTextElementId(element);
  if (boundTextElementId) {
    return sceneElements.find((ele) => ele.id === boundTextElementId);
  }
  return null;
};
