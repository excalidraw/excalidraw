import React from "react";
import { trackEvent } from "../analytics";
import { load, questionCircle, save, saveAs } from "../components/icons";
import { ProjectName } from "../components/ProjectName";
import { ToolButton } from "../components/ToolButton";
import "../components/ToolIcon.scss";
import { Tooltip } from "../components/Tooltip";
import { DarkModeToggle, Appearence } from "../components/DarkModeToggle";
import { loadFromJSON, saveAsJSON } from "../data";
import { t } from "../i18n";
import { useIsMobile } from "../components/App";
import { KEYS } from "../keys";
import { register } from "./register";
import { supported as fsSupported } from "browser-fs-access";
import { CheckboxItem } from "../components/CheckboxItem";

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
        <div className="Tooltip-icon">{questionCircle}</div>
      </Tooltip>
    </CheckboxItem>
  ),
});

export const actionSaveToActiveFile = register({
  name: "saveToActiveFile",
  perform: async (elements, appState, value) => {
    const fileHandleExists = !!appState.fileHandle;
    try {
      const { fileHandle } = await saveAsJSON(elements, appState);
      return {
        commitToHistory: false,
        appState: {
          ...appState,
          fileHandle,
          toastMessage: fileHandleExists
            ? fileHandle.name
              ? t("toast.fileSavedToFilename").replace(
                  "{filename}",
                  `"${fileHandle.name}"`,
                )
              : t("toast.fileSaved")
            : null,
        },
      };
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error);
      }
      return { commitToHistory: false };
    }
  },
  keyTest: (event) =>
    event.key === KEYS.S && event[KEYS.CTRL_OR_CMD] && !event.shiftKey,
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="icon"
      icon={save}
      title={t("buttons.save")}
      aria-label={t("buttons.save")}
      onClick={() => updateData(null)}
      data-testid="save-button"
    />
  ),
});

export const actionSaveAsScene = register({
  name: "saveAsScene",
  perform: async (elements, appState, value) => {
    try {
      const { fileHandle } = await saveAsJSON(elements, {
        ...appState,
        fileHandle: null,
      });
      return { commitToHistory: false, appState: { ...appState, fileHandle } };
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error(error);
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
      showAriaLabel={useIsMobile()}
      hidden={!fsSupported}
      onClick={() => updateData(null)}
      data-testid="save-as-button"
    />
  ),
});

export const actionLoadScene = register({
  name: "loadScene",
  perform: async (elements, appState) => {
    try {
      const {
        elements: loadedElements,
        appState: loadedAppState,
      } = await loadFromJSON(appState);
      return {
        elements: loadedElements,
        appState: loadedAppState,
        commitToHistory: true,
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        return false;
      }
      return {
        elements,
        appState: { ...appState, errorMessage: error.message },
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
      showAriaLabel={useIsMobile()}
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
        value={appState.exportWithDarkMode ? "dark" : "light"}
        onChange={(theme: Appearence) => {
          updateData(theme === "dark");
        }}
        title={t("labels.toggleExportColorScheme")}
      />
    </div>
  ),
});
