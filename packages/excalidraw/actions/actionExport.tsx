import {
  KEYS,
  DEFAULT_EXPORT_PADDING,
  EXPORT_SCALES,
  THEME,
} from "@excalidraw/common";

import { getNonDeletedElements } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElement, Theme } from "@excalidraw/element/types";

import { useEditorInterface } from "../components/App";
import { CheckboxItem } from "../components/CheckboxItem";
import { DarkModeToggle } from "../components/DarkModeToggle";
import { ProjectName } from "../components/ProjectName";
import { Toast } from "../components/Toast";
import { ToolButton } from "../components/ToolButton";
import { Tooltip } from "../components/Tooltip";
import { ExportIcon, questionCircle, saveAs } from "../components/icons";
import { loadFromJSON, saveAsJSON } from "../data";
import { isImageFileHandle } from "../data/blob";
import { nativeFileSystemSupported } from "../data/filesystem";

import { resaveAsImageWithScene } from "../data/resave";

import { t } from "../i18n";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { getExportSize } from "../scene/export";

import "../components/ToolIcon.scss";

import { register } from "./register";

import type { JSONExportData } from "../data/json";

import type {
  AppClassProperties,
  AppState,
  BinaryFiles,
  ExcalidrawProps,
  OnExportProgress,
} from "../types";

export const actionChangeProjectName = register<AppState["name"]>({
  name: "changeProjectName",
  label: "labels.fileTitle",
  trackEvent: false,
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, name: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ appState, updateData, appProps, data, app }) => (
    <ProjectName
      label={t("labels.fileTitle")}
      value={app.getName()}
      onChange={(name: string) => updateData(name)}
      ignoreFocus={data?.ignoreFocus ?? false}
    />
  ),
});

export const actionChangeExportScale = register<AppState["exportScale"]>({
  name: "changeExportScale",
  label: "imageExportDialog.scale",
  trackEvent: { category: "export", action: "scale" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportScale: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ elements: allElements, appState, updateData }) => {
    const elements = getNonDeletedElements(allElements);
    const exportSelected = isSomeElementSelected(elements, appState);
    const exportedElements = exportSelected
      ? getSelectedElements(elements, appState)
      : elements;

    return (
      <>
        {EXPORT_SCALES.map((s) => {
          const [width, height] = getExportSize(
            exportedElements,
            DEFAULT_EXPORT_PADDING,
            s,
          );

          const scaleButtonTitle = `${t(
            "imageExportDialog.label.scale",
          )} ${s}x (${width}x${height})`;

          return (
            <ToolButton
              key={s}
              size="small"
              type="radio"
              icon={`${s}x`}
              name="export-canvas-scale"
              title={scaleButtonTitle}
              aria-label={scaleButtonTitle}
              id="export-canvas-scale"
              checked={s === appState.exportScale}
              onChange={() => updateData(s)}
            />
          );
        })}
      </>
    );
  },
});

export const actionChangeExportBackground = register<
  AppState["exportBackground"]
>({
  name: "changeExportBackground",
  label: "imageExportDialog.label.withBackground",
  trackEvent: { category: "export", action: "toggleBackground" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportBackground: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <CheckboxItem
      checked={appState.exportBackground}
      onChange={(checked) => updateData(checked)}
    >
      {t("imageExportDialog.label.withBackground")}
    </CheckboxItem>
  ),
});

export const actionChangeExportEmbedScene = register<
  AppState["exportEmbedScene"]
>({
  name: "changeExportEmbedScene",
  label: "imageExportDialog.tooltip.embedScene",
  trackEvent: { category: "export", action: "embedScene" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportEmbedScene: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <CheckboxItem
      checked={appState.exportEmbedScene}
      onChange={(checked) => updateData(checked)}
    >
      {t("imageExportDialog.label.embedScene")}
      <Tooltip label={t("imageExportDialog.tooltip.embedScene")} long={true}>
        <div className="excalidraw-tooltip-icon">{questionCircle}</div>
      </Tooltip>
    </CheckboxItem>
  ),
});

// ---------------------------------------------------------------------------
// onExport interception helpers
// ---------------------------------------------------------------------------

let onExportInProgress = false;

/** awaits host app's onExport result, and renders progress to the UI */
async function handleOnExportResult(
  onExportResult: ReturnType<NonNullable<ExcalidrawProps["onExport"]>>,
  opts: {
    signal: AbortSignal;
    app: AppClassProperties;
  },
): Promise<void> {
  const onProgress = (progress: {
    message?: OnExportProgress["message"];
    progress?: number | null;
  }) => {
    const message = progress.message ?? t("progressDialog.defaultMessage");
    opts.app.setAppState({
      toast: {
        message:
          progress.progress != null ? (
            <>
              {message}
              <Toast.ProgressBar progress={progress.progress} />
            </>
          ) : (
            message
          ),
        duration: Infinity,
      },
    });
  };

  if (
    onExportResult != null &&
    typeof onExportResult === "object" &&
    Symbol.asyncIterator in onExportResult
  ) {
    onProgress({ progress: null });

    for await (const value of onExportResult) {
      if (opts.signal.aborted) {
        onExportResult.return();
        return;
      }
      if (value.type === "progress") {
        onProgress({
          message: value.message,
          progress: value.progress ?? null,
        });
      } else if (value.type === "done") {
        return;
      }
    }

    // Generator completed without explicit "done" message
    return;
  }

  if (onExportResult instanceof Promise) {
    onProgress({ progress: null });
    await onExportResult;
  }
}

function prepareDataForJSONExport(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
  app: AppClassProperties,
): { abortController: AbortController; data: Promise<JSONExportData> } {
  const abortController = new AbortController();
  const signal = abortController.signal;

  const dataPromise = new Promise<JSONExportData>(async (resolve) => {
    try {
      if (app.props.onExport) {
        await handleOnExportResult(
          app.props.onExport(
            "json",
            {
              elements,
              appState,
              files,
            },
            {
              signal,
            },
          ),
          {
            app,
            signal,
          },
        );
      }
    } catch (error: any) {
      if (error?.name === "AbortError") {
        // if abort error, assume it's a reaction on the signal being aborted
        console.warn(
          `onExport() aborted by host app (signal aborted: ${signal.aborted})`,
        );
      } else {
        // non-abort error
        //
        console.error("Error during props.onExport() handling", error);
      }

      // either way, we currently don't allow host apps to cancel save actions
      // so we resolve to orig data
    }

    resolve({
      elements,
      appState,
      // return latest files in case they finished loading during onExport
      files: app.files,
    });
  });

  return {
    abortController,
    data: dataPromise,
  };
}

// ---------------------------------------------------------------------------
// Save actions
// ---------------------------------------------------------------------------

export const actionSaveToActiveFile = register({
  name: "saveToActiveFile",
  label: "buttons.save",
  icon: ExportIcon,
  trackEvent: { category: "export" },
  predicate: (elements, appState, props, app) => {
    return (
      !!app.props.UIOptions.canvasActions.saveToActiveFile &&
      !!appState.fileHandle &&
      !appState.viewModeEnabled
    );
  },
  perform: async (elements, appState, value, app) => {
    if (onExportInProgress) {
      return false;
    }
    onExportInProgress = true;

    const previousFileHandle = appState.fileHandle;
    const filename = app.getName();

    const { abortController, data: exportedDataPromise } =
      prepareDataForJSONExport(elements, appState, app.files, app);

    try {
      const { fileHandle } = isImageFileHandle(previousFileHandle)
        ? await resaveAsImageWithScene(
            exportedDataPromise,
            previousFileHandle,
            filename,
          )
        : await saveAsJSON({
            data: exportedDataPromise,
            filename,
            fileHandle: previousFileHandle,
          });

      return {
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          fileHandle,
          toast: {
            message:
              previousFileHandle && fileHandle?.name
                ? t("toast.fileSavedToFilename").replace(
                    "{filename}",
                    `"${fileHandle.name}"`,
                  )
                : t("toast.fileSaved"),
            duration: 1500,
          },
        },
      };
    } catch (error: any) {
      abortController.abort();

      if (error?.name !== "AbortError") {
        console.error(error);
      } else {
        console.warn(error);
      }
      return {
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          toast: null,
        },
      };
    } finally {
      onExportInProgress = false;
    }
  },
  keyTest: (event) =>
    event.key === KEYS.S && event[KEYS.CTRL_OR_CMD] && !event.shiftKey,
});

export const actionSaveFileToDisk = register({
  name: "saveFileToDisk",
  label: "exportDialog.disk_title",
  icon: ExportIcon,
  viewMode: true,
  trackEvent: { category: "export" },
  perform: async (elements, appState, value, app) => {
    if (onExportInProgress) {
      return false;
    }
    onExportInProgress = true;

    const { abortController, data: exportedDataPromise } =
      prepareDataForJSONExport(elements, appState, app.files, app);

    try {
      const { fileHandle: savedFileHandle } = await saveAsJSON({
        data: exportedDataPromise,
        filename: app.getName(),
        fileHandle: null,
      });

      return {
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          openDialog: null,
          fileHandle: savedFileHandle,
          toast: { message: t("toast.fileSaved") },
        },
      };
    } catch (error: any) {
      abortController.abort();
      if (error?.name !== "AbortError") {
        console.error(error);
      } else {
        console.warn(error);
      }
      return {
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          toast: null,
        },
      };
    } finally {
      onExportInProgress = false;
    }
  },
  keyTest: (event) =>
    event.key.toLowerCase() === KEYS.S &&
    event.shiftKey &&
    event[KEYS.CTRL_OR_CMD],
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={saveAs}
      title={t("buttons.saveAs")}
      aria-label={t("buttons.saveAs")}
      showAriaLabel={useEditorInterface().formFactor === "phone"}
      hidden={!nativeFileSystemSupported}
      onClick={() => updateData(null)}
      data-testid="save-as-button"
    />
  ),
});

export const actionLoadScene = register({
  name: "loadScene",
  label: "buttons.load",
  trackEvent: { category: "export" },
  predicate: (elements, appState, props, app) => {
    return (
      !!app.props.UIOptions.canvasActions.loadScene && !appState.viewModeEnabled
    );
  },
  perform: async (elements, appState, _, app) => {
    try {
      const {
        elements: loadedElements,
        appState: loadedAppState,
        files,
      } = await loadFromJSON(appState, elements);
      return {
        elements: loadedElements,
        appState: loadedAppState,
        files,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    } catch (error: any) {
      if (error?.name === "AbortError") {
        console.warn(error);
        return false;
      }
      return {
        elements,
        appState: { ...appState, errorMessage: error.message },
        files: app.files,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.O,
});

export const actionExportWithDarkMode = register<
  AppState["exportWithDarkMode"]
>({
  name: "exportWithDarkMode",
  label: "imageExportDialog.label.darkMode",
  trackEvent: { category: "export", action: "toggleTheme" },
  perform: (_elements, appState, value, app) => {
    app.sessionExportThemeOverride = value ? THEME.DARK : THEME.LIGHT;
    return {
      appState: { ...appState, exportWithDarkMode: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        marginTop: "-45px",
        marginBottom: "10px",
      }}
    >
      <DarkModeToggle
        value={appState.exportWithDarkMode ? THEME.DARK : THEME.LIGHT}
        onChange={(theme: Theme) => {
          updateData(theme === THEME.DARK);
        }}
        title={t("imageExportDialog.label.darkMode")}
      />
    </div>
  ),
});
