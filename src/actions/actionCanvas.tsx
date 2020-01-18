import React from "react";
import { Action } from "./types";
import { ColorPicker } from "../components/ColorPicker";
import { getDefaultAppState } from "../appState";
import { trash } from "../components/icons";
import { ToolIcon } from "../components/ToolIcon";

export const actionChangeViewBackgroundColor: Action = {
  name: "changeViewBackgroundColor",
  perform: (elements, appState, value) => {
    return { appState: { ...appState, viewBackgroundColor: value } };
  },
  PanelComponent: ({ appState, updateData }) => {
    return (
      <div style={{ position: "relative" }}>
        <ColorPicker
          type="canvasBackground"
          color={appState.viewBackgroundColor}
          onChange={color => updateData(color)}
        />
      </div>
    );
  }
};

export const actionClearCanvas: Action = {
  name: "clearCanvas",
  perform: () => {
    return {
      elements: [],
      appState: getDefaultAppState()
    };
  },
  PanelComponent: ({ updateData }) => (
    <ToolIcon
      type="button"
      icon={trash}
      title="Clear the canvas & reset background color"
      aria-label="Clear the canvas & reset background color"
      onClick={() => {
        if (window.confirm("This will clear the whole canvas. Are you sure?")) {
          // TODO: Defined globally, since file handles aren't yet serializable.
          // Once `FileSystemFileHandle` can be serialized, make this
          // part of `AppState`.
          (window as any).handle = null;
          updateData(null);
        }
      }}
    />
  )
};
