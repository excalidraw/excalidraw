import { useEffect } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { createCanvasTools } from "./tools";

import type { WebMcpDocument } from "./modelContext";

/**
 * 在浏览器支持 WebMCP 时注册画布工具，并在编辑器卸载时统一注销。
 */
export const useWebMcpTools = (
  excalidrawAPI: ExcalidrawImperativeAPI | null,
  ownerDocument: Document | null,
) => {
  useEffect(() => {
    if (!excalidrawAPI || !ownerDocument?.defaultView) {
      return;
    }

    const modelContext = (ownerDocument as WebMcpDocument).modelContext;
    if (!modelContext) {
      return;
    }

    const controller = new ownerDocument.defaultView.AbortController();
    const registrations = createCanvasTools(excalidrawAPI).map((tool) =>
      modelContext.registerTool(tool, { signal: controller.signal }),
    );
    void Promise.all(registrations).catch(() => {
      controller.abort();
    });

    return () => {
      controller.abort();
    };
  }, [excalidrawAPI, ownerDocument]);
};
