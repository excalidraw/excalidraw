import React from "react";
import { Action } from "./types";
import { ColorPicker } from "../components/ColorPicker";
import { getDefaultAppState } from "../appState";
import { trash } from "../components/icons";
import { ToolButton } from "../components/ToolButton";

export const actionChangeViewBackgroundColor: Action = {
  name: "changeViewBackgroundColor",
  perform: (elements, appState, value) => {
    return { appState: { ...appState, viewBackgroundColor: value } };
  },
  PanelComponent: ({ appState, updateData }) => {
    return (
      <div style={{ position: "relative" }}>
        <ColorPicker
          label="Canvas Background"
          type="canvasBackground"
          color={appState.viewBackgroundColor}
          onChange={color => updateData(color)}
        />
      </div>
    );
  },
};

export const actionClearCanvas: Action = {
  name: "clearCanvas",
  perform: () => {
    return {
      elements: [],
      appState: getDefaultAppState(),
    };
  },
  PanelComponent: ({ updateData, t }) => (
    <ToolButton
      type="button"
      icon={trash}
      title={t("buttons.clearReset")}
      aria-label={t("buttons.clearReset")}
      onClick={() => {
        if (window.confirm(t("alerts.clearReset"))) {
          // TODO: Defined globally, since file handles aren't yet serializable.
          // Once `FileSystemFileHandle` can be serialized, make this
          // part of `AppState`.
          (window as any).handle = null;
          updateData(null);
        }
      }}
    />
  ),
};
