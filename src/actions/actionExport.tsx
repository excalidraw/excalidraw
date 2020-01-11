import React from "react";
import { Action } from "./types";
import { EditableText } from "../components/EditableText";
import { saveAsJSON, loadFromJSON } from "../scene";

export const actionChangeProjectName: Action = {
  name: "changeProjectName",
  perform: (elements, appState, value) => {
    return { appState: { ...appState, name: value } };
  },
  PanelComponent: ({ appState, updateData }) => (
    <>
      <h5>Name</h5>
      {appState.name && (
        <EditableText
          value={appState.name}
          onChange={(name: string) => updateData(name)}
        />
      )}
    </>
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
    <button onClick={() => updateData(null)}>Save as...</button>
  )
};

export const actionLoadScene: Action = {
  name: "loadScene",
  perform: (elements, appState, loadedElements) => {
    return { elements: loadedElements };
  },
  PanelComponent: ({ updateData }) => (
    <button
      onClick={() => {
        loadFromJSON().then(({ elements }) => {
          updateData(elements);
        });
      }}
    >
      Load file...
    </button>
  )
};
