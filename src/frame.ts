import { ExcalidrawElement } from "./element/types";

export const getElementsInFrame = (
  elements: readonly ExcalidrawElement[],
  frameId: string,
) => elements.filter((element) => element.frameId === frameId);
