import React from "react";
import { ActionManager } from "../../actions";
import { ExcalidrawElement } from "../../element/types";
import { AppState } from "../../types";
import { UpdaterFn } from "../../actions/types";

interface PanelSelectionProps {
  actionManager: ActionManager;
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  syncActionResult: UpdaterFn;
}

export const PanelSelection: React.FC<PanelSelectionProps> = ({
  actionManager,
  elements,
  appState,
  syncActionResult
}) => {
  return (
    <div>
      <div className="buttonList">
        {actionManager.renderAction(
          "bringForward",
          elements,
          appState,
          syncActionResult
        )}
        {actionManager.renderAction(
          "bringToFront",
          elements,
          appState,
          syncActionResult
        )}
        {actionManager.renderAction(
          "sendBackward",
          elements,
          appState,
          syncActionResult
        )}
        {actionManager.renderAction(
          "sendToBack",
          elements,
          appState,
          syncActionResult
        )}
      </div>
    </div>
  );
};
