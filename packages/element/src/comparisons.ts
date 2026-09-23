import type { ElementOrToolType } from "@excalidraw/excalidraw/types";

export const hasBackground = (type: ElementOrToolType) =>
  type === "rectangle" ||
  type === "stickynote" ||
  type === "iframe" ||
  type === "embeddable" ||
  type === "ellipse" ||
  type === "diamond" ||
  type === "line" ||
  type === "freedraw" ||
  type === "autoshape" ||
  // tool-only type; makes the `G` background shortcut work for bucket fill
  type === "bucketfill";

export const hasFillStyle = (type: ElementOrToolType) =>
  hasBackground(type) && type !== "stickynote";

export const hasStrokeColor = (type: ElementOrToolType) =>
  type === "rectangle" ||
  type === "stickynote" ||
  type === "ellipse" ||
  type === "diamond" ||
  type === "freedraw" ||
  type === "arrow" ||
  type === "line" ||
  type === "text" ||
  type === "embeddable" ||
  type === "autoshape";

export const hasStrokeWidth = (type: ElementOrToolType) =>
  type === "rectangle" ||
  type === "iframe" ||
  type === "embeddable" ||
  type === "ellipse" ||
  type === "diamond" ||
  type === "freedraw" ||
  type === "arrow" ||
  type === "line" ||
  type === "autoshape";

export const hasStrokeStyle = (type: ElementOrToolType) =>
  type === "rectangle" ||
  type === "iframe" ||
  type === "embeddable" ||
  type === "ellipse" ||
  type === "diamond" ||
  type === "arrow" ||
  type === "line" ||
  type === "autoshape";

export const hasRoughness = (type: ElementOrToolType) =>
  hasStrokeStyle(type) || type === "stickynote";

export const hasFreedrawMode = (type: ElementOrToolType) => type === "freedraw";

export const canChangeRoundness = (type: ElementOrToolType) =>
  type === "rectangle" ||
  type === "iframe" ||
  type === "embeddable" ||
  type === "line" ||
  type === "diamond" ||
  type === "stickynote" ||
  type === "image";

export const toolIsArrow = (type: ElementOrToolType) => type === "arrow";

export const canHaveArrowheads = (type: ElementOrToolType) => type === "arrow";
