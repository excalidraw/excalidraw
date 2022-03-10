import React, { useState } from "react";
import { ActionsManagerInterface } from "../actions/types";
import { NonDeletedExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { useIsMobile } from "./App";
import { AppState, ExportOpts, BinaryFiles } from "../types";
import { Dialog } from "./Dialog";
import { exportFile, exportToFileIcon, link } from "./icons";
import { ToolButton } from "./ToolButton";
import { actionSaveFileToDisk } from "../actions/actionExport";
import { Card } from "./Card";

import {
  Alert,
  AlertIcon,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
} from "@chakra-ui/react";

import { useSbState } from "@switchboardcc/sdk";

import "./ExportDialog.scss";
import { nativeFileSystemSupported } from "../data/filesystem";

export type ExportCB = (
  elements: readonly NonDeletedExcalidrawElement[],
  scale?: number,
) => void;

const JSONExportModal = ({
  elements,
  appState,
  files,
  actionManager,
  exportOpts,
  canvas,
}: {
  appState: AppState;
  files: BinaryFiles;
  elements: readonly NonDeletedExcalidrawElement[];
  actionManager: ActionsManagerInterface;
  onCloseRequest: () => void;
  exportOpts: ExportOpts;
  canvas: HTMLCanvasElement | null;
}) => {
  const { onExportToBackend } = exportOpts;

  const [state, setState] = useSbState("5");
  return (
    <div className="ExportDialog ExportDialog--json">
      {state && !state.finished && (
        <Alert
          status="success"
          variant="subtle"
          flexDirection="row"
          alignItems="center"
          justifyContent="center"
          textAlign="center"
        >
          <AlertIcon />
          🎉 You did it! You’re an Excalidraw pro now!
        </Alert>
      )}
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
              id="SB-save"
              title={t("exportDialog.disk_button")}
              aria-label={t("exportDialog.disk_button")}
              showAriaLabel={true}
              onClick={() => {
                actionManager.executeAction(actionSaveFileToDisk);
              }}
            />
          </Card>
        )}
        {onExportToBackend && (
          <Card color="pink">
            <div className="Card-icon">{link}</div>
            <h2>{t("exportDialog.link_title")}</h2>
            <div className="Card-details">{t("exportDialog.link_details")}</div>
            <ToolButton
              className="Card-button"
              type="button"
              title={t("exportDialog.link_button")}
              aria-label={t("exportDialog.link_button")}
              showAriaLabel={true}
              onClick={() =>
                onExportToBackend(elements, appState, files, canvas)
              }
            />
          </Card>
        )}
        {exportOpts.renderCustomUI &&
          exportOpts.renderCustomUI(elements, appState, files, canvas)}
      </div>
    </div>
  );
};

const ExportButtonWrapper = (props: any) => {
  const [state, setState] = useSbState("4");
  if (!state || !state.active || state.finished) {
    return props.children;
  }
  return (
    <Popover isOpen={!state.finished}>
      <PopoverTrigger>
        <div>{props.children}</div>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverBody>
          Looking good! Let’s export this drawing so you can share it with
          others. Click the Save as image button to save this as a PNG, SVG, or
          copy it to your clipboard.
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

export const JSONExportDialog = ({
  elements,
  appState,
  files,
  actionManager,
  exportOpts,
  canvas,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
  actionManager: ActionsManagerInterface;
  exportOpts: ExportOpts;
  canvas: HTMLCanvasElement | null;
}) => {
  const [modalIsShown, setModalIsShown] = useState(false);

  const [modalBannerState, setModalBannerState] = useSbState("5");
  const handleClose = React.useCallback(() => {
    setModalBannerState({ ...modalBannerState, finished: true });
    setModalIsShown(false);
  }, [modalBannerState, setModalBannerState]);
  const [state, setState] = useSbState("4");

  return (
    <ExportButtonWrapper>
      <ToolButton
        onClick={() => {
          if (!state.finished) {
            setState({ ...state, finished: true });
          }
          setModalIsShown(true);
        }}
        data-testid="json-export-button"
        id="SB-export"
        icon={exportFile}
        type="button"
        aria-label={t("buttons.export")}
        showAriaLabel={useIsMobile()}
        title={t("buttons.export")}
      />
      {modalIsShown && (
        <Dialog onCloseRequest={handleClose} title={t("buttons.export")}>
          <JSONExportModal
            elements={elements}
            appState={appState}
            files={files}
            actionManager={actionManager}
            onCloseRequest={handleClose}
            exportOpts={exportOpts}
            canvas={canvas}
          />
        </Dialog>
      )}
    </ExportButtonWrapper>
  );
};
