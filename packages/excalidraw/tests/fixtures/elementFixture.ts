import { DEFAULT_FONT_FAMILY } from "@excalidraw/common";

import type { Radians } from "@excalidraw/math";

import type { ExcalidrawElement } from "@excalidraw/element/types";

const elementBase: Omit<ExcalidrawElement, "type"> = {
  id: "vWrqOAfkind2qcm7LDAGZ",
  x: 414,
  y: 237,
  width: 214,
  height: 214,
  angle: 0 as Radians,
  strokeColor: "#000000",
  backgroundColor: "#15aabf",
  fillStyle: "hachure",
  strokeWidth: 1,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  groupIds: [],
  frameId: null,
  roundness: null,
  index: null,
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
export const embeddableFixture: ExcalidrawElement = {
  ...elementBase,
  type: "embeddable",
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

export const textFixture: ExcalidrawElement = {
  ...elementBase,
  type: "text",
  fontSize: 20,
  fontFamily: DEFAULT_FONT_FAMILY,
  text: "original text",
  originalText: "original text",
  textAlign: "left",
  verticalAlign: "top",
  containerId: null,
  lineHeight: 1.25 as any,
  autoResize: false,
};
