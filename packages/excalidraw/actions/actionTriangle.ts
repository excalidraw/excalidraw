import { updateActiveTool } from "@excalidraw/common";
import { setCursorForShape } from "../cursor";
import { CaptureUpdateAction } from "../store";
import { register } from "./register";
import { KEYS } from "../keys";

export const actionSetTriangleAsActiveTool = register({
  name: "setTriangleAsActiveTool",
  trackEvent: { category: "toolbar" },
  target: "Tool",
  label: "toolBar.triangle",
  perform: (elements, appState, _, app) => {
    const nextActiveTool = updateActiveTool(appState, {
      type: "triangle",
    });

    setCursorForShape(app.canvas, {
      ...appState,
      activeTool: nextActiveTool,
    });

    return {
      elements,
      appState: {
        ...appState,
        activeTool: updateActiveTool(appState, {
          type: "triangle",
        }),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event) => event.key.toLowerCase() === KEYS.T && !event.altKey,
});