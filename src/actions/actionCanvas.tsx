import React from "react";
import { Action } from "./types";
import { ColorPicker } from "../components/ColorPicker";
import { getDefaultAppState } from "../appState";
import { trash, zoomIn, zoomOut, resetZoom } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { getNormalizedZoom } from "../scene";
import { KEYS } from "../keys";
import useIsMobile from "../is-mobile";

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
      showAriaLabel={useIsMobile()}
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
  MINUS: "Minus",
  EQUAL: "Equal",
  ZERO: "Digit0",
  NUM_SUBTRACT: "NumpadSubtract",
  NUM_ADD: "NumpadAdd",
  NUM_ZERO: "Numpad0",
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
    (event.code === KEY_CODES.EQUAL || event.code === KEY_CODES.NUM_ADD) &&
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
    (event.code === KEY_CODES.MINUS || event.code === KEY_CODES.NUM_SUBTRACT) &&
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
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={resetZoom}
      title={t("buttons.resetZoom")}
      aria-label={t("buttons.resetZoom")}
      onClick={() => {
        updateData(null);
      }}
    />
  ),
  keyTest: event =>
    (event.code === KEY_CODES.ZERO || event.code === KEY_CODES.NUM_ZERO) &&
    (event[KEYS.META] || event.shiftKey),
};
