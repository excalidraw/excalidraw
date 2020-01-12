import React from "react";
import { Action } from "./types";
import { EditableText } from "../components/EditableText";
import { saveAsJSON, loadFromJSON } from "../scene";
import { load, save } from "../components/icons";
import { ToolIcon } from "../components/ToolIcon";

export const actionChangeProjectName: Action = {
  name: "changeProjectName",
  perform: (elements, appState, value) => {
    return { appState: { ...appState, name: value } };
  },
  PanelComponent: ({ appState, updateData }) => (
    <EditableText
      value={appState.name || "Unnamed"}
      onChange={(name: string) => updateData(name)}
    />
  )
};

export const actionChangeExportBackground: Action = {
  name: "changeExportBackground",
  perform: (elements, appState, value) => {
    return { appState: { ...appState, exportBackground: value } };
  },
  PanelComponent: ({ appState, updateData }) => (
    <label>
      <input
        type="checkbox"
        checked={appState.exportBackground}
        onChange={e => {
          updateData(e.target.checked);
        }}
      />
      background
    </label>
  )
};

export const actionSaveScene: Action = {
  name: "saveScene",
  perform: (elements, appState, value) => {
    saveAsJSON(elements, appState.name);
    return {};
  },
  PanelComponent: ({ updateData }) => (
    <ToolIcon
      type="button"
      icon={save}
      title="Save"
      aria-label="Save"
      onClick={() => updateData(null)}
    />
  )
};

export const actionLoadScene: Action = {
  name: "loadScene",
  perform: (elements, appState, loadedElements) => {
    return { elements: loadedElements };
  },
  PanelComponent: ({ updateData }) => (
    <ToolIcon
      type="button"
      icon={load}
      title="Load"
      aria-label="Load"
      onClick={() => {
        loadFromJSON().then(({ elements }) => {
          updateData(elements);
        });
      }}
    />
  )
};
