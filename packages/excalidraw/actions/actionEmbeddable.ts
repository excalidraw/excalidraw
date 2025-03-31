import { updateActiveTool } from "@excalidraw/common";

import { setCursorForShape } from "../cursor";
import { CaptureUpdateAction } from "../store";

import { register } from "./register";

export const actionSetEmbeddableAsActiveTool = register({
  name: "setEmbeddableAsActiveTool",
  trackEvent: { category: "toolbar" },
  target: "Tool",
  label: "toolBar.embeddable",
  perform: (elements, appState, _, app) => {
    const nextActiveTool = updateActiveTool(appState, {
      type: "embeddable",
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
          type: "embeddable",
        }),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});
