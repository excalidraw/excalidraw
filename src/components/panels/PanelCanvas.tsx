import React from "react";

import { Panel } from "../Panel";
import { ActionManager } from "../../actions";
import { ExcalidrawElement } from "../../element/types";
import { AppState } from "../../types";
import { UpdaterFn } from "../../actions/types";

interface PanelCanvasProps {
  actionManager: ActionManager;
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  syncActionResult: UpdaterFn;
}

export const PanelCanvas: React.FC<PanelCanvasProps> = ({
  actionManager,
  elements,
  appState,
  syncActionResult
}) => {
  return (
    <Panel title="Canvas">
      {actionManager.renderAction(
        "changeViewBackgroundColor",
        elements,
        appState,
        syncActionResult
      )}

      {actionManager.renderAction(
        "clearCanvas",
        elements,
        appState,
        syncActionResult
      )}
    </Panel>
  );
};
