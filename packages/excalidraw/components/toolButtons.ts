// Tool button state helpers shared by the toolbar and its popovers.

import type { AppClassProperties } from "../types";

/**
 * Whether a toolbar entry activating the given tool renders disabled — true
 * when the active tool is host-controlled (`props.activeTool`) and the entry
 * doesn't activate the forced tool (`setActiveTool` refuses it).
 */
export const isToolButtonDisabled = (app: AppClassProperties, type: string) =>
  app.props.activeTool != null && app.props.activeTool.type !== type;
