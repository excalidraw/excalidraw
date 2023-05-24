import React, { useEffect, useRef, useState } from "react";

import type { ActionManager } from "../actions/manager";
import type { AppClassProperties, BinaryFiles, UIAppState } from "../types";

import {
  actionExportWithDarkMode,
  actionChangeExportBackground,
  actionChangeExportEmbedScene,
  actionChangeExportScale,
} from "../actions/actionExport";
import { probablySupportsClipboardBlob } from "../clipboard";
import {
  DEFAULT_EXPORT_PADDING,
  EXPORT_IMAGE_TYPES,
  isFirefox,
  EXPORT_SCALES,
} from "../constants";

import { canvasToBlob } from "../data/blob";
import { NonDeletedExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { exportToCanvas } from "../packages/utils";

import { copyIcon, downloadIcon, helpIcon } from "./icons";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { RadioGroup } from "./RadioGroup";
import { Switch } from "./Switch";
import { Tooltip } from "./Tooltip";

import "./ImageExportDialog.scss";

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
  appState: UIAppState;
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  actionManager: ActionManager;
  onExportImage: AppClassProperties["onExportImage"];
};

const ImageExportModal = ({
  appState,
  elements,
  files,
  actionManager,
  onExportImage,
}: ImageExportModalProps) => {
  const someElementIsSelected = isSomeElementSelected(elements, appState);

  const [exportSelected, setExportSelected] = useState(someElementIsSelected);
  const [exportWithBackground, setExportWithBackground] = useState(
    appState.exportBackground,
  );
  const [exportDarkMode, setExportDarkMode] = useState(
    appState.exportWithDarkMode,
  );
  const [embedScene, setEmbedScene] = useState(appState.exportEmbedScene);
  const [exportScale, setExportScale] = useState(appState.exportScale);

  const previewRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<Error | null>(null);

  const exportedElements = exportSelected
    ? getSelectedElements(elements, appState, true)
    : elements;

  useEffect(() => {
    const previewNode = previewRef.current;
    if (!previewNode) {
      return;
    }
    const maxWidth = previewNode.offsetWidth;
    if (!maxWidth) {
      return;
    }
    exportToCanvas({
      elements: exportedElements,
      appState,
      files,
      exportPadding: DEFAULT_EXPORT_PADDING,
      maxWidthOrHeight: maxWidth,
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
  }, [appState, files, exportedElements]);

  return (
    <div className="ImageExportModal">
      <h3>Export image</h3>
      <div className="ImageExportModal__preview" ref={previewRef}>
        {renderError && <ErrorCanvasPreview />}
      </div>
      <div className="ImageExportModal__settings">
        <h3>Export image</h3>
        {someElementIsSelected && (
          <ExportSetting
            label={t("labels.onlySelected")}
            name="exportOnlySelected"
          >
            <Switch
              name="exportOnlySelected"
              checked={exportSelected}
              onChange={(checked) => {
                setExportSelected(checked);
              }}
            />
          </ExportSetting>
        )}
        <ExportSetting
          label={t("labels.withBackground")}
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
            label="Dark Mode"
            title={t("labels.toggleExportColorScheme")}
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
          label="Embed"
          tooltip={t("labels.exportEmbedScene_details")}
          title={t("labels.exportEmbedScene")}
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
        <ExportSetting label={t("buttons.scale")}>
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
          <Button
            className="ImageExportModal__settings__buttons__button"
            title={t("buttons.exportToPng")}
            aria-label={t("buttons.exportToPng")}
            onSelect={() =>
              onExportImage(EXPORT_IMAGE_TYPES.png, exportedElements)
            }
          >
            {downloadIcon} PNG
          </Button>
          <Button
            className="ImageExportModal__settings__buttons__button"
            title={t("buttons.exportToSvg")}
            aria-label={t("buttons.exportToSvg")}
            onSelect={() =>
              onExportImage(EXPORT_IMAGE_TYPES.svg, exportedElements)
            }
          >
            {downloadIcon} SVG
          </Button>
          {(probablySupportsClipboardBlob || isFirefox) && (
            <Button
              className="ImageExportModal__settings__buttons__button"
              title={t("buttons.copyPngToClipboard")}
              aria-label={t("buttons.copyPngToClipboard")}
              onSelect={() =>
                onExportImage(EXPORT_IMAGE_TYPES.clipboard, exportedElements)
              }
            >
              {copyIcon} Copy to Clipboard
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

type ExportSettingProps = {
  label: React.ReactNode;
  children: React.ReactNode;
  tooltip?: string;
  title?: string;
  name?: string;
};

const ExportSetting = ({
  label,
  children,
  tooltip,
  title,
  name,
}: ExportSettingProps) => {
  return (
    <div className="ImageExportModal__settings__setting" title={title}>
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
  if (appState.openDialog !== "imageExport") {
    return null;
  }

  return (
    <Dialog onCloseRequest={onCloseRequest} wide>
      <ImageExportModal
        elements={elements}
        appState={appState}
        files={files}
        actionManager={actionManager}
        onExportImage={onExportImage}
      />
    </Dialog>
  );
};
