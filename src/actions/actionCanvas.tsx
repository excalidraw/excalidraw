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
import { ExcalidrawElement } from "../element/types";
import { getElementAbsoluteCoords } from "../element";

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

const getPartiallyVisibleElements = (
  elements: readonly ExcalidrawElement[],
  zoom: number,
  {
    scrollX,
    scrollY,
  }: {
    scrollX: FlooredNumber;
    scrollY: FlooredNumber;
  },
) => {
  return elements
    .map((element) => {
      const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
      const { innerHeight, innerWidth } = window;
      const viewportWidthWithZoom = innerWidth / zoom;
      const viewportHeightWithZoom = innerHeight / zoom;
      const viewportWidthDiff = innerWidth - viewportWidthWithZoom;
      const viewportHeightDiff = innerHeight - viewportHeightWithZoom;

      return (
        x2 + scrollX - viewportWidthDiff / 2 >= element.width &&
        x1 + scrollX - viewportWidthDiff / 2 <=
          viewportWidthWithZoom - element.width &&
        y2 + scrollY - viewportHeightDiff / 2 >= element.height &&
        y1 + scrollY - viewportHeightDiff / 2 <=
          viewportHeightWithZoom - element.height
      );
    })
    .filter((element) => !element);
};

export const actionZoomCenter = register({
  name: "zoomCenter",
  perform: (elements, appState) => {
    const nonDeletedElements = elements.filter((element) => !element.isDeleted);
    const scrollCenter = calculateScrollCenter(nonDeletedElements);
    const { zoom } = appState;
    let newZoom = zoom;
    let partiallyVisibleElements = getPartiallyVisibleElements(
      nonDeletedElements,
      zoom,
      scrollCenter,
    );

    while (partiallyVisibleElements.length !== 0) {
      partiallyVisibleElements = getPartiallyVisibleElements(
        nonDeletedElements,
        newZoom,
        scrollCenter,
      );
      newZoom -= 0.01;
    }

    if (newZoom >= 1) {
      newZoom = 1;
    } else if (newZoom <= 0.1) {
      newZoom = 0.1;
    }

    return {
      appState: {
        ...appState,
        zoom: newZoom,
        ...scrollCenter,
      },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={"x"}
      title={""}
      aria-label={""}
      onClick={() => {
        updateData(null);
      }}
    />
  ),
});
