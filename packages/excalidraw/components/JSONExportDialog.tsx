import React from "react";

import { arrayToMap, getFrame, MIME_TYPES } from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import { getElementBounds } from "@excalidraw/element/bounds";

import { actionSaveFileToDisk } from "../actions/actionExport";

import { trackEvent } from "../analytics";
import { fileSave, nativeFileSystemSupported } from "../data/filesystem";
import { t } from "../i18n";
import { getSelectedElements, isSomeElementSelected } from "../scene";

import { Card } from "./Card";
import { Dialog } from "./Dialog";
import { ToolButton } from "./ToolButton";
import { exportToFileIcon, LinkIcon, polygonIcon } from "./icons";

import "./ExportDialog.scss";

import type { ActionManager } from "../actions/manager";

import type { ExportOpts, BinaryFiles, UIAppState } from "../types";

interface GameNode {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
}

const exportGameNodes = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: UIAppState,
) => {
  const selectedElements = isSomeElementSelected(elements, appState)
    ? getSelectedElements(elements, appState)
    : [];

  const elementsMap = arrayToMap(elements);

  const gameNodes: GameNode[] = selectedElements
    .filter(
      (element) => element.type === "rectangle" || element.type === "text",
    )
    .map((element) => {
      const [minX, minY, maxX, maxY] = getElementBounds(element, elementsMap);
      
      const node: GameNode = {
        type: element.type,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };

      if (element.type === "text") {
        node.text = (element as any).text;
      }

      return node;
    });

  return gameNodes;
};

const saveGameNodes = async (gameNodes: GameNode[]) => {
  const jsonString = JSON.stringify(gameNodes, null, 2);
  const blob = new Blob([jsonString], { type: MIME_TYPES.json });

  await fileSave(blob, {
    name: "game_nodes",
    extension: "json",
    description: "Game Nodes JSON",
  });
};

export type ExportCB = (
  elements: readonly NonDeletedExcalidrawElement[],
  scale?: number,
) => void;

const JSONExportModal = ({
  elements,
  appState,
  setAppState,
  files,
  actionManager,
  exportOpts,
  canvas,
  onCloseRequest,
}: {
  appState: UIAppState;
  setAppState: React.Component<any, UIAppState>["setState"];
  files: BinaryFiles;
  elements: readonly NonDeletedExcalidrawElement[];
  actionManager: ActionManager;
  onCloseRequest: () => void;
  exportOpts: ExportOpts;
  canvas: HTMLCanvasElement;
}) => {
  const { onExportToBackend } = exportOpts;
  return (
    <div className="ExportDialog ExportDialog--json">
      <div className="ExportDialog-cards">
        {exportOpts.saveFileToDisk && (
          <Card color="lime">
            <div className="Card-icon">{exportToFileIcon}</div>
            <h2>{t("exportDialog.disk_title")}</h2>
            <div className="Card-details">
              {t("exportDialog.disk_details")}
              {!nativeFileSystemSupported &&
                actionManager.renderAction("changeProjectName")}
            </div>
            <ToolButton
              className="Card-button"
              type="button"
              title={t("exportDialog.disk_button")}
              aria-label={t("exportDialog.disk_button")}
              showAriaLabel={true}
              onClick={() => {
                actionManager.executeAction(actionSaveFileToDisk, "ui");
              }}
            />
          </Card>
        )}
        {onExportToBackend && (
          <Card color="pink">
            <div className="Card-icon">{LinkIcon}</div>
            <h2>{t("exportDialog.link_title")}</h2>
            <div className="Card-details">{t("exportDialog.link_details")}</div>
            <ToolButton
              className="Card-button"
              type="button"
              title={t("exportDialog.link_button")}
              aria-label={t("exportDialog.link_button")}
              showAriaLabel={true}
              onClick={async () => {
                try {
                  trackEvent("export", "link", `ui (${getFrame()})`);
                  await onExportToBackend(elements, appState, files);
                  onCloseRequest();
                } catch (error: any) {
                  setAppState({ errorMessage: error.message });
                }
              }}
            />
          </Card>
        )}
        <Card color="purple">
          <div className="Card-icon">{polygonIcon}</div>
          <h2>{t("exportDialog.gameNode_title")}</h2>
          <div className="Card-details">
            {t("exportDialog.gameNode_details")}
          </div>
          <ToolButton
            className="Card-button"
            type="button"
            title={t("exportDialog.gameNode_button")}
            aria-label={t("exportDialog.gameNode_button")}
            showAriaLabel={true}
            onClick={async () => {
              try {
                const gameNodes = exportGameNodes(elements, appState);
                await saveGameNodes(gameNodes);
                onCloseRequest();
              } catch (error: any) {
                setAppState({ errorMessage: error.message });
              }
            }}
          />
        </Card>
        {exportOpts.renderCustomUI &&
          exportOpts.renderCustomUI(elements, appState, files, canvas)}
      </div>
    </div>
  );
};

export const JSONExportDialog = ({
  elements,
  appState,
  files,
  actionManager,
  exportOpts,
  canvas,
  setAppState,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  appState: UIAppState;
  files: BinaryFiles;
  actionManager: ActionManager;
  exportOpts: ExportOpts;
  canvas: HTMLCanvasElement;
  setAppState: React.Component<any, UIAppState>["setState"];
}) => {
  const handleClose = React.useCallback(() => {
    setAppState({ openDialog: null });
  }, [setAppState]);

  return (
    <>
      {appState.openDialog?.name === "jsonExport" && (
        <Dialog onCloseRequest={handleClose} title={t("buttons.export")}>
          <JSONExportModal
            elements={elements}
            appState={appState}
            setAppState={setAppState}
            files={files}
            actionManager={actionManager}
            onCloseRequest={handleClose}
            exportOpts={exportOpts}
            canvas={canvas}
          />
        </Dialog>
      )}
    </>
  );
};
