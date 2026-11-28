import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  addElements,
  deleteElements,
  fitToContent,
  readCanvas,
  updateElements,
} from "./canvas";
import { TOOL_SCHEMAS } from "./schemas";

import type { WebMcpTool } from "./modelContext";

/**
 * 为当前编辑器实例创建 WebMCP 工具定义。
 */
export const createCanvasTools = (
  excalidrawAPI: ExcalidrawImperativeAPI,
): WebMcpTool[] => [
  {
    name: "read_canvas",
    title: "Read canvas",
    description:
      "Read a compact, paginated snapshot of the current Excalidraw canvas.",
    inputSchema: TOOL_SCHEMAS.read_canvas,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: (input, options) => readCanvas(excalidrawAPI, input, options),
  },
  {
    name: "add_elements",
    title: "Add canvas elements",
    description:
      "Add supported Excalidraw elements as one undoable canvas change.",
    inputSchema: TOOL_SCHEMAS.add_elements,
    annotations: { readOnlyHint: false, consequentialHint: true },
    execute: (input, options) => addElements(excalidrawAPI, input, options),
  },
  {
    name: "update_elements",
    title: "Update canvas elements",
    description:
      "Update safe properties on existing elements as one undoable canvas change.",
    inputSchema: TOOL_SCHEMAS.update_elements,
    annotations: { readOnlyHint: false, consequentialHint: true },
    execute: (input, options) => updateElements(excalidrawAPI, input, options),
  },
  {
    name: "delete_elements",
    title: "Delete canvas elements",
    description:
      "Delete elements and repair their bindings as one undoable canvas change.",
    inputSchema: TOOL_SCHEMAS.delete_elements,
    annotations: { readOnlyHint: false, consequentialHint: true },
    execute: (input, options) => deleteElements(excalidrawAPI, input, options),
  },
  {
    name: "fit_to_content",
    title: "Fit canvas content",
    description:
      "Fit the viewport to all visible elements or to the current selection.",
    inputSchema: TOOL_SCHEMAS.fit_to_content,
    annotations: { readOnlyHint: false, consequentialHint: false },
    execute: (input, options) => fitToContent(excalidrawAPI, input, options),
  },
];
