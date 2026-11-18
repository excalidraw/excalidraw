import type { ShapeType } from "./types";

/**
 * Default keyboard shortcuts for the tools the kit can draw with. These are
 * the stock Excalidraw shortcuts; hosts that remap them can pass
 * `toolKeys` to the driver (or the fixture factory).
 */
export const DEFAULT_TOOL_KEYS: Record<ShapeType, string> = {
  rectangle: "r",
  diamond: "d",
  ellipse: "o",
  arrow: "a",
  line: "l",
  freedraw: "p",
  text: "t",
  frame: "f",
};
