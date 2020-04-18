import React from "react";
import { ColorPicker } from "../components/ColorPicker";
import { getDefaultAppState } from "../appState";
import { trash, zoomIn, zoomOut, resetZoom } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { getNormalizedZoom, calculateScrollCenter } from "../scene";
import { KEYS } from "../keys";
import { getShortcutKey } from "../utils";
import useIsMobile from "../is-mobile";
import { register } from "./register";
import { newElementWith } from "../element/mutateElement";
import { AppState, FlooredNumber } from "../types";
import { getCommonBounds } from "../element";

export const actionChangeViewBackgroundColor = register({
  name: "changeViewBackgroundColor",
  perform: (_, appState, value) => {
    return {
      appState: { ...appState, viewBackgroundColor: value },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ appState, updateData }) => {
    return (
      <div style={{ position: "relative" }}>
        <ColorPicker
          label={t("labels.canvasBackground")}
          type="canvasBackground"
          color={appState.viewBackgroundColor}
          onChange={(color) => updateData(color)}
        />
      </div>
    );
  },
});

export const actionClearCanvas = register({
  name: "clearCanvas",
  perform: (elements, appState: AppState) => {
    return {
      elements: elements.map((element) =>
        newElementWith(element, { isDeleted: true }),
      ),
      appState: {
        ...getDefaultAppState(),
        username: appState.username,
      },
      commitToHistory: true,
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
});

const ZOOM_STEP = 0.1;

const KEY_CODES = {
  MINUS: "Minus",
  EQUAL: "Equal",
  ONE: "Digit1",
  ZERO: "Digit0",
  NUM_SUBTRACT: "NumpadSubtract",
  NUM_ADD: "NumpadAdd",
  NUM_ZERO: "Numpad0",
};

export const actionZoomIn = register({
  name: "zoomIn",
  perform: (_elements, appState) => {
    return {
      appState: {
        ...appState,
        zoom: getNormalizedZoom(appState.zoom + ZOOM_STEP),
      },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={zoomIn}
      title={`${t("buttons.zoomIn")} — ${getShortcutKey("CtrlOrCmd++")}`}
      aria-label={t("buttons.zoomIn")}
      onClick={() => {
        updateData(null);
      }}
    />
  ),
  keyTest: (event) =>
    (event.code === KEY_CODES.EQUAL || event.code === KEY_CODES.NUM_ADD) &&
    (event[KEYS.CTRL_OR_CMD] || event.shiftKey),
});

export const actionZoomOut = register({
  name: "zoomOut",
  perform: (_elements, appState) => {
    return {
      appState: {
        ...appState,
        zoom: getNormalizedZoom(appState.zoom - ZOOM_STEP),
      },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={zoomOut}
      title={`${t("buttons.zoomOut")} — ${getShortcutKey("CtrlOrCmd+-")}`}
      aria-label={t("buttons.zoomOut")}
      onClick={() => {
        updateData(null);
      }}
    />
  ),
  keyTest: (event) =>
    (event.code === KEY_CODES.MINUS || event.code === KEY_CODES.NUM_SUBTRACT) &&
    (event[KEYS.CTRL_OR_CMD] || event.shiftKey),
});

export const actionResetZoom = register({
  name: "resetZoom",
  perform: (_elements, appState) => {
    return {
      appState: {
        ...appState,
        zoom: 1,
      },
      commitToHistory: false,
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
  keyTest: (event) =>
    (event.code === KEY_CODES.ZERO || event.code === KEY_CODES.NUM_ZERO) &&
    (event[KEYS.CTRL_OR_CMD] || event.shiftKey),
});

const calculateZoom = (
  commonBounds: number[],
  currentZoom: number,
  {
    scrollX,
    scrollY,
  }: {
    scrollX: FlooredNumber;
    scrollY: FlooredNumber;
  },
): number => {
  const { innerWidth, innerHeight } = window;
  const [x, y] = commonBounds;
  const zoomX = -innerWidth / (2 * scrollX + 2 * x - innerWidth);
  const zoomY = -innerHeight / (2 * scrollY + 2 * y - innerHeight);
  const margin = 0.01;
  let newZoom;

  if (zoomX < zoomY) {
    newZoom = zoomX - margin;
  } else if (zoomY <= zoomX) {
    newZoom = zoomY - margin;
  } else {
    newZoom = currentZoom;
  }

  if (newZoom <= 0.1) {
    return 0.1;
  }
  if (newZoom >= 1) {
    return 1;
  }

  return newZoom;
};

export const actionZoomToFit = register({
  name: "zoomToFit",
  perform: (elements, appState) => {
    const nonDeletedElements = elements.filter((element) => !element.isDeleted);
    const scrollCenter = calculateScrollCenter(nonDeletedElements);
    const commonBounds = getCommonBounds(nonDeletedElements);
    const zoom = calculateZoom(commonBounds, appState.zoom, scrollCenter);

    return {
      appState: {
        ...appState,
        scrollX: scrollCenter.scrollX,
        scrollY: scrollCenter.scrollY,
        zoom,
      },
      commitToHistory: false,
    };
  },
  keyTest: (event) =>
    event.code === KEY_CODES.ONE &&
    event.shiftKey &&
    !event.altKey &&
    !event[KEYS.CTRL_OR_CMD],
});
