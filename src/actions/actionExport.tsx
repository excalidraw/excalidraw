import React from "react";
import { ProjectName } from "../components/ProjectName";
import { saveAsJSON, loadFromJSON } from "../data";
import { load, save } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import useIsMobile from "../is-mobile";
import { register } from "./register";
import { KEYS } from "../keys";

export const actionChangeProjectName = register({
  name: "changeProjectName",
  perform: (_elements, appState, value) => {
    return { appState: { ...appState, name: value }, commitToHistory: false };
  },
  PanelComponent: ({ appState, updateData }) => (
    <ProjectName
      label={t("labels.fileTitle")}
      value={appState.name || "Unnamed"}
      onChange={(name: string) => updateData(name)}
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
    <label>
      <input
        type="checkbox"
        checked={appState.exportBackground}
        onChange={(event) => updateData(event.target.checked)}
      />{" "}
      {t("labels.withBackground")}
    </label>
  ),
});

export const actionChangeShouldAddWatermark = register({
  name: "changeShouldAddWatermark",
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, shouldAddWatermark: value },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <label>
      <input
        type="checkbox"
        checked={appState.shouldAddWatermark}
        onChange={(event) => updateData(event.target.checked)}
      />{" "}
      {t("labels.addWatermark")}
    </label>
  ),
});

export const actionSaveScene = register({
  name: "saveScene",
  perform: (elements, appState, value) => {
    saveAsJSON(elements, appState).catch((error) => console.error(error));
    return { commitToHistory: false };
  },
  keyTest: (event) => {
    return event.key === "s" && event[KEYS.CTRL_OR_CMD];
  },
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={save}
      title={t("buttons.save")}
      aria-label={t("buttons.save")}
      showAriaLabel={useIsMobile()}
      onClick={() => updateData(null)}
    />
  ),
});

export const actionLoadScene = register({
  name: "loadScene",
  perform: (
    elements,
    appState,
    { elements: loadedElements, appState: loadedAppState, error },
  ) => {
    return {
      elements: loadedElements,
      appState: {
        ...loadedAppState,
        errorMessage: error,
      },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={load}
      title={t("buttons.load")}
      aria-label={t("buttons.load")}
      showAriaLabel={useIsMobile()}
      onClick={() => {
        loadFromJSON()
          .then(({ elements, appState }) => {
            updateData({ elements: elements, appState: appState });
          })
          .catch((error) => {
            // if user cancels, ignore the error
            if (error.name === "AbortError") {
              return;
            }
            updateData({ error: error.message });
          });
      }}
    />
  ),
});
