import React from "react";
import { Action } from "./types";
import { EditableText } from "../components/EditableText";
import { saveAsJSON, loadFromJSON } from "../scene";
import { load, save } from "../components/icons";

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
    <label className="tool" title="Save">
      <button aria-label="save" onClick={() => updateData(null)}>
        <div className="toolIcon">{save}</div>
      </button>
    </label>
  )
};

export const actionLoadScene: Action = {
  name: "loadScene",
  perform: (elements, appState, loadedElements) => {
    return { elements: loadedElements };
  },
  PanelComponent: ({ updateData }) => (
    <label className="tool" title="Load">
      <button
        aria-label="load"
        onClick={() => {
          loadFromJSON().then(({ elements }) => {
            updateData(elements);
          });
        }}
      >
        <div className="toolIcon">{load}</div>
      </button>
    </label>
  )
};
