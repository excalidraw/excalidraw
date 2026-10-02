import { exportToCanvas } from "@excalidraw/utils/export";
import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";

import {
  DEFAULT_EXPORT_PADDING,
  EXPORT_IMAGE_TYPES,
  isFirefox,
  EXPORT_SCALES,
  cloneJSON,
} from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  actionExportWithDarkMode,
  actionChangeExportBackground,
  actionChangeExportEmbedScene,
  actionChangeExportScale,
  actionChangeProjectName,
} from "../actions/actionExport";
import { trackEvent } from "../analytics";
import { probablySupportsClipboardBlob } from "../clipboard";
import { prepareElementsForExport } from "../data";
import {
  clearAttributionOptOutState,
  getAttributionOptOutState,
  setAttributionOptOutCompleted,
} from "../data/attributionOptOut";
import { canvasToBlob } from "../data/blob";
import { nativeFileSystemSupported } from "../data/filesystem";
import { useCopyStatus } from "../hooks/useCopiedIndicator";

import { t } from "../i18n";
import { isSomeElementSelected } from "../scene";

import {
  ATTRIBUTION_SURVEY_QUESTION_IDS,
  AttributionMarkSurvey,
  trackAttributionSurveyAnswers,
} from "./AttributionMarkSurvey";
import { copyIcon, downloadIcon, helpIcon } from "./icons";
import { Dialog } from "./Dialog";
import { RadioGroup } from "./RadioGroup";
import { Switch } from "./Switch";
import { Tooltip } from "./Tooltip";
import { FilledButton } from "./FilledButton";

import "./ImageExportDialog.scss";

import type {
  AttributionSurveyAnswer,
  AttributionSurveyAnswers,
  AttributionSurveyQuestionId,
} from "./AttributionMarkSurvey";
import type { ActionManager } from "../actions/manager";

import type { AppClassProperties, BinaryFiles, UIAppState } from "../types";

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

type ExportFormat = Exclude<keyof typeof EXPORT_IMAGE_TYPES, "clipboard">;

const EXPORT_FORMATS: ExportFormat[] = [
  EXPORT_IMAGE_TYPES.png,
  EXPORT_IMAGE_TYPES.svg,
  EXPORT_IMAGE_TYPES.webp,
  EXPORT_IMAGE_TYPES.jpg,
  EXPORT_IMAGE_TYPES.excalidraw,
];

type AspectRatio = "original" | "1:1" | "4:5" | "3:4" | "2:3";

// width / height, `undefined` keeps the drawing's own proportions
const ASPECT_RATIOS: Record<AspectRatio, number | undefined> = {
  original: undefined,
  "1:1": 1,
  "4:5": 4 / 5,
  "3:4": 3 / 4,
  "2:3": 2 / 3,
};

// only the rendered raster formats that support it can be resized
const ASPECT_RATIO_FORMATS: ExportFormat[] = [
  EXPORT_IMAGE_TYPES.png,
  EXPORT_IMAGE_TYPES.jpg,
];

type ImageExportModalProps = {
  appStateSnapshot: Readonly<UIAppState>;
  elementsSnapshot: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  actionManager: ActionManager;
  onExportImage: AppClassProperties["onExportImage"];
  name: string;
  exportWithDarkMode: boolean;
};

const ImageExportModal = ({
  appStateSnapshot,
  elementsSnapshot,
  files,
  actionManager,
  onExportImage,
  name,
  exportWithDarkMode,
}: ImageExportModalProps) => {
  const hasSelection = isSomeElementSelected(
    elementsSnapshot,
    appStateSnapshot,
  );

  const [projectName, setProjectName] = useState(name);
  const [exportSelectionOnly, setExportSelectionOnly] = useState(hasSelection);
  const [exportWithBackground, setExportWithBackground] = useState(
    appStateSnapshot.exportBackground,
  );
  const [embedScene, setEmbedScene] = useState(
    appStateSnapshot.exportEmbedScene,
  );
  const [exportScale, setExportScale] = useState(appStateSnapshot.exportScale);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(
    EXPORT_IMAGE_TYPES.png,
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("original");

  const supportsAspectRatio = ASPECT_RATIO_FORMATS.includes(exportFormat);
  const exportAspectRatio = supportsAspectRatio
    ? ASPECT_RATIOS[aspectRatio]
    : undefined;

  // Attribution mark: opted-out + survey-complete state, time-boxed to 30
  // days (see excalidraw-attribution-vision.md Section 9.7). Kept outside
  // appState since it's a standalone user preference, not scene data.
  const [attributionOptedOut, setAttributionOptedOut] = useState(
    () => !!getAttributionOptOutState(),
  );
  const [attributionSurveyComplete, setAttributionSurveyComplete] =
    useState(attributionOptedOut);
  const [showAttributionSurvey, setShowAttributionSurvey] = useState(false);
  const [attributionAnswers, setAttributionAnswers] =
    useState<AttributionSurveyAnswers>({});

  const showAttributionMark = !(
    attributionOptedOut && attributionSurveyComplete
  );

  useEffect(() => {
    if (
      showAttributionSurvey &&
      !attributionSurveyComplete &&
      ATTRIBUTION_SURVEY_QUESTION_IDS.every((id) => attributionAnswers[id])
    ) {
      setAttributionSurveyComplete(true);
      setAttributionOptOutCompleted();
      trackAttributionSurveyAnswers(attributionAnswers);
    }
  }, [attributionAnswers, showAttributionSurvey, attributionSurveyComplete]);

  const handleAttributionToggleChange = (checked: boolean) => {
    setAttributionOptedOut(checked);
    if (checked) {
      trackEvent("export", "attribution-opt-out", "ui");
      setShowAttributionSurvey(true);
      if (!attributionSurveyComplete) {
        setAttributionAnswers({});
      }
    } else {
      setShowAttributionSurvey(false);
      setAttributionSurveyComplete(false);
      setAttributionAnswers({});
      clearAttributionOptOutState();
    }
  };

  const handleAttributionAnswer = (
    questionId: AttributionSurveyQuestionId,
    answer: AttributionSurveyAnswer,
  ) => {
    setAttributionAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const previewRef = useRef<HTMLDivElement>(null);
  const previewRenderRequestIdRef = useRef(0);
  const [renderError, setRenderError] = useState<Error | null>(null);

  const { onCopy, copyStatus, resetCopyStatus } = useCopyStatus();

  useEffect(() => {
    // if user changes setting right after export to clipboard, reset the status
    // so they don't have to wait for the timeout to click the button again
    resetCopyStatus();
  }, [
    projectName,
    exportWithBackground,
    exportWithDarkMode,
    exportScale,
    embedScene,
    showAttributionMark,
    resetCopyStatus,
  ]);

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

    const requestId = ++previewRenderRequestIdRef.current;
    const isStaleRequest = () => {
      return requestId !== previewRenderRequestIdRef.current;
    };

    exportToCanvas({
      elements: exportedElements,
      appState: {
        ...appStateSnapshot,
        name: projectName,
        // JPEG can't be transparent, the export always gets a background
        exportBackground:
          exportWithBackground || exportFormat === EXPORT_IMAGE_TYPES.jpg,
        exportWithDarkMode,
        exportScale,
        exportEmbedScene: embedScene,
      },
      files,
      exportPadding: DEFAULT_EXPORT_PADDING,
      maxWidthOrHeight: Math.max(maxWidth, maxHeight),
      exportingFrame,
      attributionMark: { show: showAttributionMark },
      aspectRatio: exportAspectRatio,
    })
      .then(async (canvas) => {
        if (isStaleRequest()) {
          return;
        }

        // If converting to blob fails, there's some problem that will likely
        // prevent preview and export (e.g. canvas too big).
        try {
          await canvasToBlob(canvas);
        } catch (error: any) {
          if (error.name === "CANVAS_POSSIBLY_TOO_BIG") {
            throw new Error(t("canvasError.canvasTooBig"));
          }
          throw error;
        }

        if (isStaleRequest()) {
          return;
        }

        setRenderError(null);
        previewNode.replaceChildren(canvas);
      })
      .catch((error) => {
        if (isStaleRequest()) {
          return;
        }

        console.error(error);
        setRenderError(error);
      });

    return () => {
      previewRenderRequestIdRef.current += 1;
    };
  }, [
    appStateSnapshot,
    files,
    exportedElements,
    exportingFrame,
    projectName,
    exportWithBackground,
    exportFormat,
    exportWithDarkMode,
    exportScale,
    embedScene,
    showAttributionMark,
    exportAspectRatio,
  ]);

  const downloadLabel = t("imageExportDialog.button.download", {
    format: t(`imageExportDialog.format.${exportFormat}`),
  });

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
        <ExportSetting
          label={t("imageExportDialog.label.darkMode")}
          name="exportDarkModeSwitch"
        >
          <Switch
            name="exportDarkModeSwitch"
            checked={exportWithDarkMode}
            onChange={(checked) => {
              actionManager.executeAction(
                actionExportWithDarkMode,
                "ui",
                checked,
              );
            }}
          />
        </ExportSetting>
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

        <ExportSetting
          label={t("imageExportDialog.label.hideAttribution")}
          name="exportHideAttributionSwitch"
        >
          <Switch
            name="exportHideAttributionSwitch"
            checked={attributionOptedOut}
            onChange={handleAttributionToggleChange}
          />
        </ExportSetting>

        {showAttributionSurvey && (
          <AttributionMarkSurvey
            answers={attributionAnswers}
            onAnswer={handleAttributionAnswer}
          />
        )}

        {(!attributionOptedOut || attributionSurveyComplete) && (
          <div className="ImageExportModal__settings__buttons">
            <ExportPills
              options={EXPORT_FORMATS.map((format) => ({
                value: format,
                label: t(`imageExportDialog.format.${format}`),
              }))}
              value={exportFormat}
              onChange={setExportFormat}
            />
            {supportsAspectRatio && (
              <div className="ImageExportModal__aspectRatio">
                <div className="ImageExportModal__aspectRatio__label">
                  {t("imageExportDialog.aspectRatio.title")}
                </div>
                <ExportPills
                  options={(Object.keys(ASPECT_RATIOS) as AspectRatio[]).map(
                    (ratio) => ({
                      value: ratio,
                      label:
                        ratio === "original"
                          ? t("imageExportDialog.aspectRatio.original")
                          : ratio,
                    }),
                  )}
                  value={aspectRatio}
                  onChange={setAspectRatio}
                />
              </div>
            )}
            <FilledButton
              className="ImageExportModal__settings__buttons__button"
              label={downloadLabel}
              onClick={() =>
                onExportImage(exportFormat, exportedElements, {
                  exportingFrame,
                  showAttributionMark,
                  aspectRatio: exportAspectRatio,
                })
              }
              icon={downloadIcon}
            >
              {downloadLabel}
            </FilledButton>
            {(probablySupportsClipboardBlob || isFirefox) && (
              <FilledButton
                className="ImageExportModal__settings__buttons__button"
                label={t("imageExportDialog.title.copyPngToClipboard")}
                disabled={exportFormat === EXPORT_IMAGE_TYPES.excalidraw}
                status={copyStatus}
                onClick={async () => {
                  await onExportImage(
                    EXPORT_IMAGE_TYPES.clipboard,
                    exportedElements,
                    {
                      exportingFrame,
                      showAttributionMark,
                      aspectRatio: exportAspectRatio,
                    },
                  );
                  onCopy();
                }}
                icon={copyIcon}
              >
                {t("imageExportDialog.button.copyPngToClipboard")}
              </FilledButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ExportPills = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) => {
  return (
    <div className="ImageExportModal__pills">
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={clsx("ImageExportModal__pill", {
            "ImageExportModal__pill--active": option.value === value,
          })}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
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
  name,
}: {
  appState: UIAppState;
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  actionManager: ActionManager;
  onExportImage: AppClassProperties["onExportImage"];
  onCloseRequest: () => void;
  name: string;
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
        name={name}
        exportWithDarkMode={appState.exportWithDarkMode}
      />
    </Dialog>
  );
};
