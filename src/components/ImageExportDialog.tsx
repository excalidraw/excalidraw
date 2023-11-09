import React, { useEffect, useRef, useState } from "react";

import type { ActionManager } from "../actions/manager";
import type { AppClassProperties, BinaryFiles, UIAppState } from "../types";

import {
  actionExportWithDarkMode,
  actionChangeExportBackground,
  actionChangeExportEmbedScene,
  actionChangeExportScale,
  actionChangeProjectName,
} from "../actions/actionExport";
import { probablySupportsClipboardBlob } from "../clipboard";
import {
  DEFAULT_EXPORT_PADDING,
  EXPORT_IMAGE_TYPES,
  isFirefox,
  EXPORT_SCALES,
} from "../constants";

import { canvasToBlob } from "../data/blob";
import { nativeFileSystemSupported } from "../data/filesystem";
import { NonDeletedExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { isSomeElementSelected } from "../scene";
import { exportToCanvas } from "../packages/utils";

import { copyIcon, downloadIcon, helpIcon } from "./icons";
import { Dialog } from "./Dialog";
import { RadioGroup } from "./RadioGroup";
import { Switch } from "./Switch";
import { Tooltip } from "./Tooltip";

import "./ImageExportDialog.scss";
import { useAppProps } from "./App";
import { FilledButton } from "./FilledButton";
import { cloneJSON } from "../utils";
import { prepareElementsForExport } from "../data";

const supportsContextFilters =
  "filter" in document.createElement("canvas").getContext("2d")!;

export const ErrorCanvasPreview = () => {
  return (
    <div>
      <h3>{t("canvasError.cannotShowPreview")}</h3>
      <p>
        <span>{t("canvasError.canvasTooBig")}</span>
      </p>
      <em>({t("canvasError.canvasTooBigTip")})</em>
    </div>
  );
};

type ImageExportModalProps = {
  appStateSnapshot: Readonly<UIAppState>;
  elementsSnapshot: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  actionManager: ActionManager;
  onExportImage: AppClassProperties["onExportImage"];
};

const ImageExportModal = ({
  appStateSnapshot,
  elementsSnapshot,
  files,
  actionManager,
  onExportImage,
}: ImageExportModalProps) => {
  const hasSelection = isSomeElementSelected(
    elementsSnapshot,
    appStateSnapshot,
  );

  const appProps = useAppProps();
  const [projectName, setProjectName] = useState(appStateSnapshot.name);
  const [exportSelectionOnly, setExportSelectionOnly] = useState(hasSelection);
  const [exportWithBackground, setExportWithBackground] = useState(
    appStateSnapshot.exportBackground,
  );
  const [exportDarkMode, setExportDarkMode] = useState(
    appStateSnapshot.exportWithDarkMode,
  );
  const [embedScene, setEmbedScene] = useState(
    appStateSnapshot.exportEmbedScene,
  );
  const [exportScale, setExportScale] = useState(appStateSnapshot.exportScale);

  const previewRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<Error | null>(null);

  const { exportedElements, exportingFrame } = prepareElementsForExport(
    elementsSnapshot,
    appStateSnapshot,
    exportSelectionOnly,
  );

  useEffect(() => {
    const previewNode = previewRef.current;
    if (!previewNode) {
      return;
    }
    const maxWidth = previewNode.offsetWidth;
    const maxHeight = previewNode.offsetHeight;
    if (!maxWidth) {
      return;
    }
    exportToCanvas({
      elements: exportedElements,
      appState: {
        ...appStateSnapshot,
        name: projectName,
        exportBackground: exportWithBackground,
        exportWithDarkMode: exportDarkMode,
        exportScale,
        exportEmbedScene: embedScene,
      },
      files,
      exportPadding: DEFAULT_EXPORT_PADDING,
      maxWidthOrHeight: Math.max(maxWidth, maxHeight),
      exportingFrame,
    })
      .then((canvas) => {
        setRenderError(null);
        // if converting to blob fails, there's some problem that will
        // likely prevent preview and export (e.g. canvas too big)
        return canvasToBlob(canvas).then(() => {
          previewNode.replaceChildren(canvas);
        });
      })
      .catch((error) => {
        console.error(error);
        setRenderError(error);
      });
  }, [
    appStateSnapshot,
    files,
    exportedElements,
    exportingFrame,
    projectName,
    exportWithBackground,
    exportDarkMode,
    exportScale,
    embedScene,
  ]);

  return (
    <div className="ImageExportModal">
      <h3>{t("imageExportDialog.header")}</h3>
      <div className="ImageExportModal__preview">
        <div className="ImageExportModal__preview__canvas" ref={previewRef}>
          {renderError && <ErrorCanvasPreview />}
        </div>
        <div className="ImageExportModal__preview__filename">
          {!nativeFileSystemSupported && (
            <input
              type="text"
              className="TextInput"
              value={projectName}
              style={{ width: "30ch" }}
              disabled={
                typeof appProps.name !== "undefined" ||
                appStateSnapshot.viewModeEnabled
              }
              onChange={(event) => {
                setProjectName(event.target.value);
                actionManager.executeAction(
                  actionChangeProjectName,
                  "ui",
                  event.target.value,
                );
              }}
            />
          )}
        </div>
      </div>
      <div className="ImageExportModal__settings">
        <h3>{t("imageExportDialog.header")}</h3>
        {hasSelection && (
          <ExportSetting
            label={t("imageExportDialog.label.onlySelected")}
            name="exportOnlySelected"
          >
            <Switch
              name="exportOnlySelected"
              checked={exportSelectionOnly}
              onChange={(checked) => {
                setExportSelectionOnly(checked);
              }}
            />
          </ExportSetting>
        )}
        <ExportSetting
          label={t("imageExportDialog.label.withBackground")}
          name="exportBackgroundSwitch"
        >
          <Switch
            name="exportBackgroundSwitch"
            checked={exportWithBackground}
            onChange={(checked) => {
              setExportWithBackground(checked);
              actionManager.executeAction(
                actionChangeExportBackground,
                "ui",
                checked,
              );
            }}
          />
        </ExportSetting>
        {supportsContextFilters && (
          <ExportSetting
            label={t("imageExportDialog.label.darkMode")}
            name="exportDarkModeSwitch"
          >
            <Switch
              name="exportDarkModeSwitch"
              checked={exportDarkMode}
              onChange={(checked) => {
                setExportDarkMode(checked);
                actionManager.executeAction(
                  actionExportWithDarkMode,
                  "ui",
                  checked,
                );
              }}
            />
          </ExportSetting>
        )}
        <ExportSetting
          label={t("imageExportDialog.label.embedScene")}
          tooltip={t("imageExportDialog.tooltip.embedScene")}
          name="exportEmbedSwitch"
        >
          <Switch
            name="exportEmbedSwitch"
            checked={embedScene}
            onChange={(checked) => {
              setEmbedScene(checked);
              actionManager.executeAction(
                actionChangeExportEmbedScene,
                "ui",
                checked,
              );
            }}
          />
        </ExportSetting>
        <ExportSetting
          label={t("imageExportDialog.label.scale")}
          name="exportScale"
        >
          <RadioGroup
            name="exportScale"
            value={exportScale}
            onChange={(scale) => {
              setExportScale(scale);
              actionManager.executeAction(actionChangeExportScale, "ui", scale);
            }}
            choices={EXPORT_SCALES.map((scale) => ({
              value: scale,
              label: `${scale}\u00d7`,
            }))}
          />
        </ExportSetting>

        <div className="ImageExportModal__settings__buttons">
          <FilledButton
            className="ImageExportModal__settings__buttons__button"
            label={t("imageExportDialog.title.exportToPng")}
            onClick={() =>
              onExportImage(EXPORT_IMAGE_TYPES.png, exportedElements, {
                exportingFrame,
              })
            }
            startIcon={downloadIcon}
          >
            {t("imageExportDialog.button.exportToPng")}
          </FilledButton>
          <FilledButton
            className="ImageExportModal__settings__buttons__button"
            label={t("imageExportDialog.title.exportToSvg")}
            onClick={() =>
              onExportImage(EXPORT_IMAGE_TYPES.svg, exportedElements, {
                exportingFrame,
              })
            }
            startIcon={downloadIcon}
          >
            {t("imageExportDialog.button.exportToSvg")}
          </FilledButton>
          {(probablySupportsClipboardBlob || isFirefox) && (
            <FilledButton
              className="ImageExportModal__settings__buttons__button"
              label={t("imageExportDialog.title.copyPngToClipboard")}
              onClick={() =>
                onExportImage(EXPORT_IMAGE_TYPES.clipboard, exportedElements, {
                  exportingFrame,
                })
              }
              startIcon={copyIcon}
            >
              {t("imageExportDialog.button.copyPngToClipboard")}
            </FilledButton>
          )}
        </div>
      </div>
    </div>
  );
};

type ExportSettingProps = {
  label: string;
  children: React.ReactNode;
  tooltip?: string;
  name?: string;
};

const ExportSetting = ({
  label,
  children,
  tooltip,
  name,
}: ExportSettingProps) => {
  return (
    <div className="ImageExportModal__settings__setting" title={label}>
      <label
        htmlFor={name}
        className="ImageExportModal__settings__setting__label"
      >
        {label}
        {tooltip && (
          <Tooltip label={tooltip} long={true}>
            {helpIcon}
          </Tooltip>
        )}
      </label>
      <div className="ImageExportModal__settings__setting__content">
        {children}
      </div>
    </div>
  );
};

export const ImageExportDialog = ({
  elements,
  appState,
  files,
  actionManager,
  onExportImage,
  onCloseRequest,
}: {
  appState: UIAppState;
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  actionManager: ActionManager;
  onExportImage: AppClassProperties["onExportImage"];
  onCloseRequest: () => void;
}) => {
  // we need to take a snapshot so that the exported state can't be modified
  // while the dialog is open
  const [{ appStateSnapshot, elementsSnapshot }] = useState(() => {
    return {
      appStateSnapshot: cloneJSON(appState),
      elementsSnapshot: cloneJSON(elements),
    };
  });

  return (
    <Dialog onCloseRequest={onCloseRequest} size="wide" title={false}>
      <ImageExportModal
        elementsSnapshot={elementsSnapshot}
        appStateSnapshot={appStateSnapshot}
        files={files}
        actionManager={actionManager}
        onExportImage={onExportImage}
      />
    </Dialog>
  );
};
