import { trackEvent } from "../analytics";
import { load, questionCircle, saveAs } from "../components/icons";
import { ProjectName } from "../components/ProjectName";
import { ToolButton } from "../components/ToolButton";
import "../components/ToolIcon.scss";
import { Tooltip } from "../components/Tooltip";
import { DarkModeToggle } from "../components/DarkModeToggle";
import { loadFromJSON, saveAsJSON } from "../data";
import { resaveAsImageWithScene } from "../data/resave";
import { t } from "../i18n";
import { useDeviceType } from "../components/App";
import { KEYS } from "../keys";
import { register } from "./register";
import { CheckboxItem } from "../components/CheckboxItem";
import { getExportSize } from "../scene/export";
import { DEFAULT_EXPORT_PADDING, EXPORT_SCALES, THEME } from "../constants";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { getNonDeletedElements } from "../element";
import { ActiveFile } from "../components/ActiveFile";
import { isImageFileHandle } from "../data/blob";
import { nativeFileSystemSupported } from "../data/filesystem";
import { Theme } from "../element/types";

export const actionChangeProjectName = register({
  name: "changeProjectName",
  perform: (_elements, appState, value) => {
    trackEvent("change", "title");
    return { appState: { ...appState, name: value }, commitToHistory: false };
  },
  PanelComponent: ({ appState, updateData, appProps }) => (
    <ProjectName
      label={t("labels.fileTitle")}
      value={appState.name || "Unnamed"}
      onChange={(name: string) => updateData(name)}
      isNameEditable={
        typeof appProps.name === "undefined" && !appState.viewModeEnabled
      }
    />
  ),
});

export const actionChangeExportScale = register({
  name: "changeExportScale",
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportScale: value },
      commitToHistory: false,
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
            "buttons.scale",
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

export const actionChangeExportBackground = register({
  name: "changeExportBackground",
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportBackground: value },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <CheckboxItem
      checked={appState.exportBackground}
      onChange={(checked) => updateData(checked)}
    >
      {t("labels.withBackground")}
    </CheckboxItem>
  ),
});

export const actionChangeExportEmbedScene = register({
  name: "changeExportEmbedScene",
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportEmbedScene: value },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <CheckboxItem
      checked={appState.exportEmbedScene}
      onChange={(checked) => updateData(checked)}
    >
      {t("labels.exportEmbedScene")}
      <Tooltip label={t("labels.exportEmbedScene_details")} long={true}>
        <div className="excalidraw-tooltip-icon">{questionCircle}</div>
      </Tooltip>
    </CheckboxItem>
  ),
});

export const actionSaveToActiveFile = register({
  name: "saveToActiveFile",
  perform: async (elements, appState, value, app) => {
    const fileHandleExists = !!appState.fileHandle;

    try {
      const { fileHandle } = isImageFileHandle(appState.fileHandle)
        ? await resaveAsImageWithScene(elements, appState, app.files)
        : await saveAsJSON(elements, appState, app.files);

      return {
        commitToHistory: false,
        appState: {
          ...appState,
          fileHandle,
          toastMessage: fileHandleExists
            ? fileHandle?.name
              ? t("toast.fileSavedToFilename").replace(
                  "{filename}",
                  `"${fileHandle.name}"`,
                )
              : t("toast.fileSaved")
            : null,
        },
      };
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error(error);
      } else {
        console.warn(error);
      }
      return { commitToHistory: false };
    }
  },
  keyTest: (event) =>
    event.key === KEYS.S && event[KEYS.CTRL_OR_CMD] && !event.shiftKey,
  PanelComponent: ({ updateData, appState }) => (
    <ActiveFile
      onSave={() => updateData(null)}
      fileName={appState.fileHandle?.name}
    />
  ),
});

export const actionSaveFileToDisk = register({
  name: "saveFileToDisk",
  perform: async (elements, appState, value, app) => {
    try {
      const { fileHandle } = await saveAsJSON(
        elements,
        {
          ...appState,
          fileHandle: null,
        },
        app.files,
      );
      return { commitToHistory: false, appState: { ...appState, fileHandle } };
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error(error);
      } else {
        console.warn(error);
      }
      return { commitToHistory: false };
    }
  },
  keyTest: (event) =>
    event.key === KEYS.S && event.shiftKey && event[KEYS.CTRL_OR_CMD],
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={saveAs}
      title={t("buttons.saveAs")}
      aria-label={t("buttons.saveAs")}
      showAriaLabel={useDeviceType().isMobile}
      hidden={!nativeFileSystemSupported}
      onClick={() => updateData(null)}
      data-testid="save-as-button"
    />
  ),
});

export const actionLoadScene = register({
  name: "loadScene",
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
        commitToHistory: true,
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
        commitToHistory: false,
      };
    }
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.O,
  PanelComponent: ({ updateData, appState }) => (
    <ToolButton
      type="button"
      icon={load}
      title={t("buttons.load")}
      aria-label={t("buttons.load")}
      showAriaLabel={useDeviceType().isMobile}
      onClick={updateData}
      data-testid="load-button"
    />
  ),
});

export const actionExportWithDarkMode = register({
  name: "exportWithDarkMode",
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportWithDarkMode: value },
      commitToHistory: false,
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
        title={t("labels.toggleExportColorScheme")}
      />
    </div>
  ),
});
