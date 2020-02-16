import React from "react";
import { Action } from "./types";
import { ColorPicker } from "../components/ColorPicker";
import { getDefaultAppState } from "../appState";
import { trash, zoomIn, zoomOut } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { getNormalizedZoom } from "../scene";
import { KEYS } from "../keys";

export const actionChangeViewBackgroundColor: Action = {
  name: "changeViewBackgroundColor",
  perform: (_, appState, value) => {
    return { appState: { ...appState, viewBackgroundColor: value } };
  },
  PanelComponent: ({ appState, updateData }) => {
    return (
      <div style={{ position: "relative" }}>
        <ColorPicker
          label={t("labels.canvasBackground")}
          type="canvasBackground"
          color={appState.viewBackgroundColor}
          onChange={color => updateData(color)}
        />
      </div>
    );
  },
  commitToHistory: () => true,
};

export const actionClearCanvas: Action = {
  name: "clearCanvas",
  commitToHistory: () => true,
  perform: () => {
    return {
      elements: [],
      appState: getDefaultAppState(),
    };
  },
  PanelComponent: ({ updateData }) => (
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

const ZOOM_STEP = 0.1;

const KEY_CODES = {
  MINUS: 189,
  EQUALS: 187,
  ZERO: 48,
  NUM_SUBTRACT: 109,
  NUM_ADD: 107,
  NUM_ZERO: 96,
};

export const actionZoomIn: Action = {
  name: "zoomIn",
  perform: (elements, appState) => {
    return {
      appState: {
        ...appState,
        zoom: getNormalizedZoom(appState.zoom + ZOOM_STEP),
      },
    };
  },
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={zoomIn}
      title={t("buttons.zoomIn")}
      aria-label={t("buttons.zoomIn")}
      onClick={() => {
        updateData(null);
      }}
    />
  ),
  keyTest: event =>
    (event.keyCode === KEY_CODES.EQUALS ||
      event.keyCode === KEY_CODES.NUM_ADD) &&
    (event[KEYS.META] || event.shiftKey),
};

export const actionZoomOut: Action = {
  name: "zoomOut",
  perform: (elements, appState) => {
    return {
      appState: {
        ...appState,
        zoom: getNormalizedZoom(appState.zoom - ZOOM_STEP),
      },
    };
  },
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={zoomOut}
      title={t("buttons.zoomOut")}
      aria-label={t("buttons.zoomOut")}
      onClick={() => {
        updateData(null);
      }}
    />
  ),
  keyTest: event =>
    (event.keyCode === KEY_CODES.MINUS ||
      event.keyCode === KEY_CODES.NUM_SUBTRACT) &&
    (event[KEYS.META] || event.shiftKey),
};

export const actionResetZoom: Action = {
  name: "resetZoom",
  perform: (elements, appState) => {
    return {
      appState: {
        ...appState,
        zoom: 1,
      },
    };
  },
  keyTest: event =>
    (event.keyCode === KEY_CODES.ZERO ||
      event.keyCode === KEY_CODES.NUM_ZERO) &&
    (event[KEYS.META] || event.shiftKey),
};
