import { CURSOR_TYPE } from "@excalidraw/common";

import { AppCursor } from "./App.cursor";

import type App from "./App";
import type { AppState } from "../types";

const createApp = (
  state: Pick<
    AppState,
    "activeTool" | "currentItemFreedrawPointer" | "currentItemStrokeColor"
  >,
) => {
  const interactiveCanvas = document.createElement("canvas");
  const app = {
    interactiveCanvas,
    state,
  } as unknown as App;

  return { app, interactiveCanvas, state };
};

describe("AppCursor", () => {
  it("uses a color-aware dot cursor for freedraw", () => {
    const { app, interactiveCanvas, state } = createApp({
      activeTool: {
        type: "freedraw",
        customType: null,
        lastActiveTool: null,
        locked: false,
        fromSelection: false,
      },
      currentItemFreedrawPointer: "dot",
      currentItemStrokeColor: "#ff0000",
    });
    const cursor = new AppCursor(app);

    cursor.applyForTool();

    expect(interactiveCanvas.style.cursor).toContain("url(");
    expect(interactiveCanvas.style.cursor).toContain("%23ff0000");

    state.currentItemStrokeColor = "#00ff00";
    cursor.applyForTool();

    expect(interactiveCanvas.style.cursor).toContain("%2300ff00");
  });

  it("uses the native crosshair cursor by default", () => {
    const { app, interactiveCanvas } = createApp({
      activeTool: {
        type: "freedraw",
        customType: null,
        lastActiveTool: null,
        locked: false,
        fromSelection: false,
      },
      currentItemFreedrawPointer: "crosshair",
      currentItemStrokeColor: "#ff0000",
    });

    new AppCursor(app).applyForTool();

    expect(interactiveCanvas.style.cursor).toBe(CURSOR_TYPE.CROSSHAIR);
  });
});
