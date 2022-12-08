import { ExcalidrawElement } from "../../element/types";

const elementBase: Omit<ExcalidrawElement, "type"> = {
  id: "vWrqOAfkind2qcm7LDAGZ",
  x: 414,
  y: 237,
  width: 214,
  height: 214,
  angle: 0,
  strokeColor: "#000000",
  backgroundColor: "#15aabf",
  fillStyle: "hachure",
  strokeWidth: 1,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  groupIds: [],
  roundness: null,
  seed: 1041657908,
  version: 120,
  versionNonce: 1188004276,
  isDeleted: false,
  boundElements: null,
  updated: 1,
  link: null,
  locked: false,
};

export const rectangleFixture: ExcalidrawElement = {
  ...elementBase,
  type: "rectangle",
};
export const ellipseFixture: ExcalidrawElement = {
  ...elementBase,
  type: "ellipse",
};
export const diamondFixture: ExcalidrawElement = {
  ...elementBase,
  type: "diamond",
};
export const rectangleWithLinkFixture: ExcalidrawElement = {
  ...elementBase,
  type: "rectangle",
  link: "excalidraw.com",
};
