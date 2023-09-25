import React, { useEffect, useReducer, useRef, useState } from "react";
import clsx from "clsx";

import type { ActionManager } from "../actions/manager";
import type { AppClassProperties, BinaryFiles, UIAppState } from "../types";

import {
  actionExportWithDarkMode,
  actionChangeExportBackground,
  actionChangeExportEmbedScene,
  actionChangeExportScale,
  actionChangeProjectName,
  actionChangeFancyBackgroundImageUrl,
} from "../actions/actionExport";
import { probablySupportsClipboardBlob } from "../clipboard";
import {
  DEFAULT_EXPORT_PADDING,
  EXPORT_IMAGE_TYPES,
  isFirefox,
  EXPORT_SCALES,
  FANCY_BACKGROUND_IMAGES,
} from "../constants";

import { canvasToBlob } from "../data/blob";
import { nativeFileSystemSupported } from "../data/filesystem";
import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import { t } from "../i18n";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { exportToCanvas, getScaleToFit } from "../packages/utils";

import { copyIcon, downloadIcon, helpIcon } from "./icons";
import { Dialog } from "./Dialog";
import { RadioGroup } from "./RadioGroup";
import { Switch } from "./Switch";
import { Tooltip } from "./Tooltip";

import "./ImageExportDialog.scss";
import { useAppProps } from "./App";
import { FilledButton } from "./FilledButton";
import { getCommonBounds } from "../element";
import {
  convertToExportPadding,
  defaultExportScale,
  distance,
  isBackgroundImageKey,
} from "../utils";
import { getFancyBackgroundPadding } from "../scene/fancyBackground";
import { Select } from "./Select";
import { Bounds } from "../element/bounds";

const supportsContextFilters =
  "filter" in document.createElement("canvas").getContext("2d")!;

const fancyBackgroundImageOptions = Object.entries(FANCY_BACKGROUND_IMAGES).map(
  ([value, { label }]) => ({
    value,
    label,
  }),
);

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

type State = {
  projectName: string;
  someElementIsSelected: boolean;
  exportSelected: boolean;
  exportedElements:
    | readonly NonDeletedExcalidrawElement[]
    | ExcalidrawElement[];
  elementsBounds: Bounds;
  exportWithBackground: boolean;
  exportBackgroundImage: keyof typeof FANCY_BACKGROUND_IMAGES;
  exportDarkMode: boolean;
  embedScene: boolean;
  exportScale: number;
  exportBaseScale: number;
  isExportWithFancyBackground: boolean;
  renderError: Error | null;
};

type Action =
  | { type: "SET_PROJECT_NAME"; projectName: string }
  | {
      type: "SET_EXPORT_SELECTED";
      exportSelected: boolean;
      exportedElements: readonly NonDeletedExcalidrawElement[];
    }
  | {
      type: "SET_EXPORTED_ELEMENTS";
      exportedElements: readonly NonDeletedExcalidrawElement[];
    }
  | { type: "SET_EXPORT_WITH_BACKGROUND"; exportWithBackground: boolean }
  | {
      type: "SET_EXPORT_BACKGROUND_IMAGE";
      exportBackgroundImage: keyof typeof FANCY_BACKGROUND_IMAGES;
    }
  | { type: "SET_EXPORT_DARK_MODE"; exportDarkMode: boolean }
  | { type: "SET_EMBED_SCENE"; embedScene: boolean }
  | { type: "SET_EXPORT_SCALE"; exportScale: number }
  | { type: "SET_ALL_SCALES"; exportScale: number }
  | {
      type: "SET_IS_EXPORT_WITH_FANCY_BACKGROUND";
      isExportWithFancyBackground: boolean;
    }
  | { type: "SET_RENDER_ERROR"; renderError: Error | null };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "SET_PROJECT_NAME":
      return {
        ...state,
        projectName: action.projectName,
      };
    case "SET_EXPORT_SELECTED":
      return {
        ...state,
        exportSelected: action.exportSelected,
        exportedElements: action.exportedElements,
      };
    case "SET_EXPORTED_ELEMENTS":
      return {
        ...state,
        exportedElements: action.exportedElements,
        elementsBounds: getCommonBounds(action.exportedElements),
      };
    case "SET_EXPORT_WITH_BACKGROUND":
      return {
        ...state,
        exportWithBackground: action.exportWithBackground,
      };
    case "SET_EXPORT_BACKGROUND_IMAGE":
      return {
        ...state,
        exportBackgroundImage: action.exportBackgroundImage,
      };
    case "SET_EXPORT_DARK_MODE":
      return { ...state, exportDarkMode: action.exportDarkMode };
    case "SET_EMBED_SCENE":
      return { ...state, embedScene: action.embedScene };
    case "SET_EXPORT_SCALE":
      return { ...state, exportScale: action.exportScale };
    case "SET_IS_EXPORT_WITH_FANCY_BACKGROUND":
      return {
        ...state,
        isExportWithFancyBackground: action.isExportWithFancyBackground,
      };
    case "SET_ALL_SCALES":
      return {
        ...state,
        exportScale: action.exportScale,
        exportBaseScale: action.exportScale,
      };
    default:
      return state;
  }
};

const createInitialState = ({
  appState,
  elements,
}: Pick<ImageExportModalProps, "appState" | "elements">): State => {
  const someElementIsSelected = isSomeElementSelected(elements, appState);

  return {
    projectName: appState.name,
    someElementIsSelected: isSomeElementSelected(elements, appState),
    exportedElements: elements,
    elementsBounds: getCommonBounds(elements),
    exportSelected: someElementIsSelected,
    exportWithBackground: appState.exportBackground,
    exportBackgroundImage: appState.fancyBackgroundImageKey,
    exportDarkMode: appState.exportWithDarkMode,
    embedScene: appState.exportEmbedScene,
    exportScale: appState.exportScale,
    exportBaseScale: appState.exportScale,
    isExportWithFancyBackground:
      appState.exportBackground && appState.fancyBackgroundImageKey !== "solid",
    renderError: null,
  };
};

const ImageExportModal = ({
  appState,
  elements,
  files,
  actionManager,
  onExportImage,
}: ImageExportModalProps) => {
  const [state, dispatch] = useReducer(
    reducer,
    { appState, elements },
    createInitialState,
  );

  useEffect(() => {
    dispatch({
      type: "SET_EXPORTED_ELEMENTS",
      exportedElements: state.exportSelected
        ? getSelectedElements(elements, appState, {
            includeBoundTextElement: true,
            includeElementsInFrames: true,
          })
        : elements,
    });
  }, [elements, appState, state.exportSelected]);

  const appProps = useAppProps();

  const previewRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<Error | null>(null);

  // Upscale exported image when is smaller than preview
  useEffect(() => {
    let scale = defaultExportScale;
    if (state.exportWithBackground && state.exportBackgroundImage !== "solid") {
      const previewNode = previewRef.current;
      if (!previewNode) {
        return;
      }
      const [minX, minY, maxX, maxY] = state.elementsBounds;
      const maxWidth = previewNode.offsetWidth;
      const maxHeight = previewNode.offsetHeight;

      const padding = getFancyBackgroundPadding(
        convertToExportPadding(DEFAULT_EXPORT_PADDING),
        true,
      );

      const upscaledScale =
        Math.floor(
          (getScaleToFit(
            {
              width: distance(minX, maxX) + padding[1] + padding[3],
              height: distance(minY, maxY) + padding[0] + padding[2],
            },
            { width: maxWidth, height: maxHeight },
          ) +
            Number.EPSILON) *
            100,
        ) / 100;

      if (upscaledScale > 1) {
        scale = upscaledScale;
      }
    }

    if (scale !== state.exportBaseScale) {
      dispatch({
        type: "SET_ALL_SCALES",
        exportScale: scale > 1 ? scale : defaultExportScale,
      });
      actionManager.executeAction(actionChangeExportScale, "ui", scale);
    }
  }, [
    state.elementsBounds,
    state.exportSelected,
    state.exportWithBackground,
    state.exportBackgroundImage,
    state.exportBaseScale,
    actionManager,
  ]);

  useEffect(() => {
    const previewNode = previewRef.current;
    if (!previewNode) {
      return;
    }
    const maxWidth = previewNode.offsetWidth;
    const maxHeight = previewNode.offsetHeight;

    const maxWidthOrHeight = Math.min(maxWidth, maxHeight);

    if (!maxWidth) {
      return;
    }

    // when switching between solid/no background and image background, we clear the canvas to prevent flickering
    const isExportWithFancyBackground =
      appState.exportBackground && appState.fancyBackgroundImageKey !== "solid";

    if (state.isExportWithFancyBackground !== isExportWithFancyBackground) {
      const existingCanvas = previewNode.querySelector("canvas");
      if (existingCanvas) {
        const context = existingCanvas.getContext("2d");

        context!.clearRect(0, 0, existingCanvas.width, existingCanvas.height);
      }
      dispatch({
        type: "SET_IS_EXPORT_WITH_FANCY_BACKGROUND",
        isExportWithFancyBackground,
      });
    }

    exportToCanvas({
      elements: state.exportedElements,
      appState,
      files,
      exportPadding: DEFAULT_EXPORT_PADDING,
      maxWidthOrHeight,
    })
      .then((canvas) => {
        setRenderError(null);
        // if converting to blob fails, there's some problem that will
        // likely prevent preview and export (e.g. canvas too big)
        return canvasToBlob(canvas).then(() => {
          const existingCanvas = previewNode.querySelector("canvas");
          if (!existingCanvas) {
            previewNode.appendChild(canvas);
            return;
          }

          existingCanvas.width = canvas.width;
          existingCanvas.height = canvas.height;

          const context = existingCanvas.getContext("2d");
          context!.drawImage(canvas, 0, 0);
        });

        // Get the 2D rendering context of the existing canvas
      })
      .catch((error) => {
        console.error(error);
        setRenderError(error);
      });
  }, [
    appState,
    appState.exportBackground,
    appState.fancyBackgroundImageKey,
    files,
    state.exportedElements,
    state.isExportWithFancyBackground,
  ]);

  return (
    <div className="ImageExportModal">
      <h3>{t("imageExportDialog.header")}</h3>
      <div className="ImageExportModal__preview">
        <div
          className={clsx("ImageExportModal__preview__canvas", {
            "ImageExportModal__preview__canvas--img-bcg":
              appState.exportBackground &&
              appState.fancyBackgroundImageKey !== "solid",
          })}
          ref={previewRef}
        >
          {renderError && <ErrorCanvasPreview />}
        </div>
      </div>
      <div className="ImageExportModal__settings">
        <h3>{t("imageExportDialog.header")}</h3>
        {!nativeFileSystemSupported && (
          <div className="ImageExportModal__settings__filename">
            <input
              type="text"
              className="TextInput"
              value={state.projectName}
              disabled={
                typeof appProps.name !== "undefined" || appState.viewModeEnabled
              }
              onChange={(event) => {
                dispatch({
                  type: "SET_PROJECT_NAME",
                  projectName: event.target.value,
                });
                actionManager.executeAction(
                  actionChangeProjectName,
                  "ui",
                  event.target.value,
                );
              }}
            />
          </div>
        )}
        {state.someElementIsSelected && (
          <ExportSetting
            label={t("imageExportDialog.label.onlySelected")}
            name="exportOnlySelected"
          >
            <Switch
              name="exportOnlySelected"
              checked={state.exportSelected}
              onChange={(checked) => {
                dispatch({
                  type: "SET_EXPORT_SELECTED",
                  exportSelected: checked,
                  exportedElements: checked
                    ? getSelectedElements(elements, appState, {
                        includeBoundTextElement: true,
                        includeElementsInFrames: true,
                      })
                    : elements,
                });
              }}
            />
          </ExportSetting>
        )}
        <ExportSetting
          label={t("imageExportDialog.label.withBackground")}
          name="exportBackgroundSwitch"
          multipleInputs
        >
          {state.exportWithBackground && (
            <Select
              value={state.exportBackgroundImage}
              options={fancyBackgroundImageOptions}
              onSelect={(key) => {
                if (isBackgroundImageKey(key)) {
                  dispatch({
                    type: "SET_EXPORT_BACKGROUND_IMAGE",
                    exportBackgroundImage: key,
                  });
                  actionManager.executeAction(
                    actionChangeFancyBackgroundImageUrl,
                    "ui",
                    key,
                  );
                }
              }}
            />
          )}
          <Switch
            name="exportBackgroundSwitch"
            checked={state.exportWithBackground}
            onChange={(checked) => {
              dispatch({
                type: "SET_EXPORT_WITH_BACKGROUND",
                exportWithBackground: checked,
              });
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
              checked={state.exportDarkMode}
              onChange={(checked) => {
                dispatch({
                  type: "SET_EXPORT_DARK_MODE",
                  exportDarkMode: checked,
                });
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
            checked={state.embedScene}
            onChange={(checked) => {
              dispatch({ type: "SET_EMBED_SCENE", embedScene: checked });
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
            value={state.exportScale}
            onChange={(scale) => {
              dispatch({ type: "SET_EXPORT_SCALE", exportScale: scale });
              actionManager.executeAction(actionChangeExportScale, "ui", scale);
            }}
            choices={EXPORT_SCALES.map((scale) => ({
              value: scale * state.exportBaseScale,
              label: `${scale}\u00d7`,
            }))}
          />
        </ExportSetting>

        <div className="ImageExportModal__settings__buttons">
          <FilledButton
            className="ImageExportModal__settings__buttons__button"
            label={t("imageExportDialog.title.exportToPng")}
            onClick={() =>
              onExportImage(EXPORT_IMAGE_TYPES.png, state.exportedElements)
            }
            startIcon={downloadIcon}
          >
            {t("imageExportDialog.button.exportToPng")}
          </FilledButton>
          <FilledButton
            className="ImageExportModal__settings__buttons__button"
            label={t("imageExportDialog.title.exportToSvg")}
            onClick={() =>
              onExportImage(EXPORT_IMAGE_TYPES.svg, state.exportedElements)
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
                onExportImage(
                  EXPORT_IMAGE_TYPES.clipboard,
                  state.exportedElements,
                )
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
  multipleInputs?: boolean;
};

const ExportSetting = ({
  label,
  children,
  tooltip,
  name,
  multipleInputs,
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
      <div
        className={clsx("ImageExportModal__settings__setting__content", {
          "ImageExportModal__settings__setting__content--multipleInputs":
            multipleInputs,
        })}
      >
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
    <Dialog onCloseRequest={onCloseRequest} size="wide" title={false}>
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
