import React from "react";
import { getDefaultAppState } from "../appState";
import { ColorPicker } from "../components/ColorPicker";
import { resetZoom, trash, zoomIn, zoomOut } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { ZOOM_STEP } from "../constants";
import { getCommonBounds, getNonDeletedElements } from "../element";
import { newElementWith } from "../element/mutateElement";
import { ExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import useIsMobile from "../is-mobile";
import { CODES, KEYS } from "../keys";
import { getNormalizedZoom, getSelectedElements } from "../scene";
import { centerScrollOn } from "../scene/scroll";
import { getNewZoom } from "../scene/zoom";
import { AppState, NormalizedZoomValue } from "../types";
import { getShortcutKey } from "../utils";
import { register } from "./register";

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
        appearance: appState.appearance,
        elementLocked: appState.elementLocked,
        exportBackground: appState.exportBackground,
        exportEmbedScene: appState.exportEmbedScene,
        gridSize: appState.gridSize,
        shouldAddWatermark: appState.shouldAddWatermark,
        showStats: appState.showStats,
        pasteDialog: appState.pasteDialog,
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

export const actionZoomIn = register({
  name: "zoomIn",
  perform: (_elements, appState) => {
    const zoom = getNewZoom(
      getNormalizedZoom(appState.zoom.value + ZOOM_STEP),
      appState.zoom,
      { left: appState.offsetLeft, top: appState.offsetTop },
      { x: appState.width / 2, y: appState.height / 2 },
    );
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
      { left: appState.offsetLeft, top: appState.offsetTop },
      { x: appState.width / 2, y: appState.height / 2 },
    );

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
    return {
      appState: {
        ...appState,
        zoom: getNewZoom(
          1 as NormalizedZoomValue,
          appState.zoom,
          { left: appState.offsetLeft, top: appState.offsetTop },
          {
            x: appState.width / 2,
            y: appState.height / 2,
          },
        ),
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

const zoomToFitElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  zoomToSelection: boolean,
) => {
  const nonDeletedElements = getNonDeletedElements(elements);
  const selectedElements = getSelectedElements(nonDeletedElements, appState);

  const commonBounds =
    zoomToSelection && selectedElements.length > 0
      ? getCommonBounds(selectedElements)
      : getCommonBounds(nonDeletedElements);

  const zoomValue = zoomValueToFitBoundsOnViewport(commonBounds, {
    width: appState.width,
    height: appState.height,
  });
  const newZoom = getNewZoom(zoomValue, appState.zoom, {
    left: appState.offsetLeft,
    top: appState.offsetTop,
  });

  const [x1, y1, x2, y2] = commonBounds;
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
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
};

export const actionZoomToSelected = register({
  name: "zoomToSelection",
  perform: (elements, appState) => zoomToFitElements(elements, appState, true),
  keyTest: (event) =>
    event.code === CODES.TWO &&
    event.shiftKey &&
    !event.altKey &&
    !event[KEYS.CTRL_OR_CMD],
});

export const actionZoomToFit = register({
  name: "zoomToFit",
  perform: (elements, appState) => zoomToFitElements(elements, appState, false),
  keyTest: (event) =>
    event.code === CODES.ONE &&
    event.shiftKey &&
    !event.altKey &&
    !event[KEYS.CTRL_OR_CMD],
});
