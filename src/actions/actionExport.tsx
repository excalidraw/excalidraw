import React from "react";
import { Action } from "./types";
import { EditableText } from "../components/EditableText";
import { saveAsJSON, loadFromJSON } from "../scene";
import { load, save } from "../components/icons";
import { ToolButton } from "../components/ToolButton";

export const actionChangeProjectName: Action = {
  name: "changeProjectName",
  perform: (elements, appState, value) => {
    return { appState: { ...appState, name: value } };
  },
  PanelComponent: ({ appState, updateData, t }) => (
    <EditableText
      label={t("labels.fileTitle")}
      value={appState.name || "Unnamed"}
      onChange={(name: string) => updateData(name)}
    />
  ),
};

export const actionChangeExportBackground: Action = {
  name: "changeExportBackground",
  perform: (elements, appState, value) => {
    return { appState: { ...appState, exportBackground: value } };
  },
  PanelComponent: ({ appState, updateData, t }) => (
    <label>
      <input
        type="checkbox"
        checked={appState.exportBackground}
        onChange={e => {
          updateData(e.target.checked);
        }}
      />{" "}
      {t("labels.withBackground")}
    </label>
  ),
};

export const actionSaveScene: Action = {
  name: "saveScene",
  perform: (elements, appState, value) => {
    saveAsJSON(elements, appState).catch(err => console.error(err));
    return {};
  },
  PanelComponent: ({ updateData, t }) => (
    <ToolButton
      type="button"
      icon={save}
      title={t("buttons.save")}
      aria-label={t("buttons.save")}
      onClick={() => updateData(null)}
    />
  ),
};

export const actionLoadScene: Action = {
  name: "loadScene",
  perform: (
    elements,
    appState,
    { elements: loadedElements, appState: loadedAppState },
  ) => {
    return { elements: loadedElements, appState: loadedAppState };
  },
  PanelComponent: ({ updateData, t }) => (
    <ToolButton
      type="button"
      icon={load}
      title={t("buttons.load")}
      aria-label={t("buttons.load")}
      onClick={() => {
        loadFromJSON()
          .then(({ elements, appState }) => {
            updateData({ elements: elements, appState: appState });
          })
          .catch(err => console.error(err));
      }}
    />
  ),
};
