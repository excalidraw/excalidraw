import React from "react";
import { ColorPicker } from "../components/ColorPicker";
import { getDefaultAppState } from "../appState";
import { trash, zoomIn, zoomOut, resetZoom } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import { getNormalizedZoom } from "../scene";
import { CODES, KEYS } from "../keys";
import { getShortcutKey } from "../utils";
import useIsMobile from "../is-mobile";
import { register } from "./register";
import { newElementWith } from "../element/mutateElement";
import { AppState, NormalizedZoomValue } from "../types";
import { getCommonBounds } from "../element";
import { getNewZoom } from "../scene/zoom";
import { centerScrollOn } from "../scene/scroll";
import { EVENT_ACTION, EVENT_CHANGE, trackEvent } from "../analytics";
import colors from "../colors";

export const actionChangeViewBackgroundColor = register({
  name: "changeViewBackgroundColor",
  perform: (_, appState, value) => {
    if (value !== appState.viewBackgroundColor) {
      trackEvent(
        EVENT_CHANGE,
        "canvas color",
        colors.canvasBackground.includes(value)
          ? `${value} (picker ${colors.canvasBackground.indexOf(value)})`
          : value,
      );
    }
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
    trackEvent(EVENT_ACTION, "clear canvas");
    return {
      elements: elements.map((element) =>
        newElementWith(element, { isDeleted: true }),
      ),
      appState: {
        ...getDefaultAppState(),
        appearance: appState.appearance,
        elementLocked: appState.elementLocked,
        exportBackground: appState.exportBackground,
        exportEmbedScene: appState.exportEmbedScene,
        gridSize: appState.gridSize,
        shouldAddWatermark: appState.shouldAddWatermark,
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
          updateData(null);
        }
      }}
    />
  ),
});

const ZOOM_STEP = 0.1;

export const actionZoomIn = register({
  name: "zoomIn",
  perform: (_elements, appState) => {
    const zoom = getNewZoom(
      getNormalizedZoom(appState.zoom.value + ZOOM_STEP),
      appState.zoom,
      { x: appState.width / 2, y: appState.height / 2 },
    );
    trackEvent(EVENT_ACTION, "zoom", "in", zoom.value * 100);
    return {
      appState: {
        ...appState,
        zoom,
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
    (event.code === CODES.EQUAL || event.code === CODES.NUM_ADD) &&
    (event[KEYS.CTRL_OR_CMD] || event.shiftKey),
});

export const actionZoomOut = register({
  name: "zoomOut",
  perform: (_elements, appState) => {
    const zoom = getNewZoom(
      getNormalizedZoom(appState.zoom.value - ZOOM_STEP),
      appState.zoom,
      { x: appState.width / 2, y: appState.height / 2 },
    );

    trackEvent(EVENT_ACTION, "zoom", "out", zoom.value * 100);
    return {
      appState: {
        ...appState,
        zoom,
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
    (event.code === CODES.MINUS || event.code === CODES.NUM_SUBTRACT) &&
    (event[KEYS.CTRL_OR_CMD] || event.shiftKey),
});

export const actionResetZoom = register({
  name: "resetZoom",
  perform: (_elements, appState) => {
    trackEvent(EVENT_ACTION, "zoom", "reset", 100);
    return {
      appState: {
        ...appState,
        zoom: getNewZoom(1 as NormalizedZoomValue, appState.zoom, {
          x: appState.width / 2,
          y: appState.height / 2,
        }),
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
    (event.code === CODES.ZERO || event.code === CODES.NUM_ZERO) &&
    (event[KEYS.CTRL_OR_CMD] || event.shiftKey),
});

const zoomValueToFitBoundsOnViewport = (
  bounds: [number, number, number, number],
  viewportDimensions: { width: number; height: number },
) => {
  const [x1, y1, x2, y2] = bounds;
  const commonBoundsWidth = x2 - x1;
  const zoomValueForWidth = viewportDimensions.width / commonBoundsWidth;
  const commonBoundsHeight = y2 - y1;
  const zoomValueForHeight = viewportDimensions.height / commonBoundsHeight;
  const smallestZoomValue = Math.min(zoomValueForWidth, zoomValueForHeight);
  const zoomAdjustedToSteps =
    Math.floor(smallestZoomValue / ZOOM_STEP) * ZOOM_STEP;
  const clampedZoomValueToFitElements = Math.min(
    Math.max(zoomAdjustedToSteps, ZOOM_STEP),
    1,
  );
  return clampedZoomValueToFitElements as NormalizedZoomValue;
};

export const actionZoomToFit = register({
  name: "zoomToFit",
  perform: (elements, appState) => {
    const nonDeletedElements = elements.filter((element) => !element.isDeleted);
    const commonBounds = getCommonBounds(nonDeletedElements);

    const zoomValue = zoomValueToFitBoundsOnViewport(commonBounds, {
      width: appState.width,
      height: appState.height,
    });
    const newZoom = getNewZoom(zoomValue, appState.zoom);

    const [x1, y1, x2, y2] = commonBounds;
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    trackEvent(EVENT_ACTION, "zoom", "fit", newZoom.value * 100);
    return {
      appState: {
        ...appState,
        ...centerScrollOn({
          scenePoint: { x: centerX, y: centerY },
          viewportDimensions: {
            width: appState.width,
            height: appState.height,
          },
          zoom: newZoom,
        }),
        zoom: newZoom,
      },
      commitToHistory: false,
    };
  },
  keyTest: (event) =>
    event.code === CODES.ONE &&
    event.shiftKey &&
    !event.altKey &&
    !event[KEYS.CTRL_OR_CMD],
});
