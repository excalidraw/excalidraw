import React from "react";
import { PanelTools } from "./panels/PanelTools";
import { Panel } from "./Panel";
import { PanelSelection } from "./panels/PanelSelection";
import {
  hasBackground,
  someElementIsSelected,
  hasStroke,
  hasText,
  exportCanvas
} from "../scene";
import { ExcalidrawElement } from "../element/types";
import { PanelCanvas } from "./panels/PanelCanvas";
import { PanelExport } from "./panels/PanelExport";
import { ExportType } from "../scene/types";
import { AppState } from "../types";
import { ActionManager } from "../actions";
import { UpdaterFn } from "../actions/types";

interface SidePanelProps {
  actionManager: ActionManager;
  elements: readonly ExcalidrawElement[];
  syncActionResult: UpdaterFn;
  appState: AppState;
  onToolChange: (elementType: string) => void;
  canvas: HTMLCanvasElement;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  actionManager,
  syncActionResult,
  elements,
  onToolChange,
  appState,
  canvas
}) => {
  return (
    <div className="sidePanel">
      <PanelTools
        activeTool={appState.elementType}
        onToolChange={value => {
          onToolChange(value);
        }}
      />
      <Panel title="Selection" hide={!someElementIsSelected(elements)}>
        <PanelSelection
          actionManager={actionManager}
          syncActionResult={syncActionResult}
          elements={elements}
          appState={appState}
        />

        {actionManager.renderAction(
          "changeStrokeColor",
          elements,
          appState,
          syncActionResult
        )}

        {hasBackground(elements) && (
          <>
            {actionManager.renderAction(
              "changeBackgroundColor",
              elements,
              appState,
              syncActionResult
            )}

            {actionManager.renderAction(
              "changeFillStyle",
              elements,
              appState,
              syncActionResult
            )}
          </>
        )}

        {hasStroke(elements) && (
          <>
            {actionManager.renderAction(
              "changeStrokeWidth",
              elements,
              appState,
              syncActionResult
            )}

            {actionManager.renderAction(
              "changeSloppiness",
              elements,
              appState,
              syncActionResult
            )}
          </>
        )}

        {hasText(elements) && (
          <>
            {actionManager.renderAction(
              "changeFontSize",
              elements,
              appState,
              syncActionResult
            )}

            {actionManager.renderAction(
              "changeFontFamily",
              elements,
              appState,
              syncActionResult
            )}
          </>
        )}

        {actionManager.renderAction(
          "changeOpacity",
          elements,
          appState,
          syncActionResult
        )}

        {actionManager.renderAction(
          "deleteSelectedElements",
          elements,
          appState,
          syncActionResult
        )}
      </Panel>
      <PanelCanvas
        actionManager={actionManager}
        syncActionResult={syncActionResult}
        elements={elements}
        appState={appState}
      />
      <PanelExport
        actionManager={actionManager}
        syncActionResult={syncActionResult}
        elements={elements}
        appState={appState}
        onExportCanvas={(type: ExportType) => {
          const exportedElements = elements.some(element => element.isSelected)
            ? elements.filter(element => element.isSelected)
            : elements;
          return exportCanvas(type, exportedElements, canvas, appState);
        }}
      />
    </div>
  );
};
