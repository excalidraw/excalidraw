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
import { AppState } from "../types";
import { ExcalidrawElement } from "../element/types";
import { getElementBounds } from "../element";

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

type ExceedCoords = {
  exceedX1: number;
  exceedX2: number;
  exceedY1: number;
  exceedY2: number;
};

function getOutsideElements(
  elements: readonly ExcalidrawElement[],
): ExceedCoords[] {
  const outsideElements: ExceedCoords[] = [];
  const { innerWidth, innerHeight } = window;

  elements.forEach((element) => {
    const [x1, y1, x2, y2] = getElementBounds(element);
    if (x2 > innerWidth || y2 > innerHeight) {
      outsideElements.push({
        exceedX1: 0,
        exceedX2: x2 > innerWidth ? x2 - innerWidth : 0,
        exceedY1: 0,
        exceedY2: y2 > innerHeight ? y2 - innerHeight : 0,
      });
    } else if (x1 < 0 || y1 < 0) {
      outsideElements.push({
        exceedX1: x1 < 0 ? Math.abs(x1) : 0,
        exceedX2: 0,
        exceedY1: y1 < 0 ? Math.abs(y1) : 0,
        exceedY2: 0,
      });
    }
  });

  return outsideElements;
}

function getZoomValue(greatestExcess: {
  type: string;
  excess: number;
}): number {
  const { innerWidth, innerHeight } = window;
  const { excess, type } = greatestExcess;
  let zoom = 1;

  if (type === "x") {
    zoom = innerWidth / (excess + innerWidth);
  } else if (type === "y") {
    zoom = innerHeight / (excess + innerHeight);
  }

  if (zoom <= 0.1) {
    zoom = 0.1;
  } else if (zoom >= 1) {
    zoom = 1;
  }

  return zoom;
}

export const actionZoomCenter = register({
  name: "zoomCenter",
  perform: (_elements, appState) => {
    let greatestExcess = { type: "", excess: 0 };

    getOutsideElements(_elements).forEach(
      ({ exceedX1, exceedY1, exceedX2, exceedY2 }: ExceedCoords) => {
        if (exceedX1 > greatestExcess.excess) {
          greatestExcess = { type: "x", excess: exceedX1 };
        }
        if (exceedX2 > greatestExcess.excess) {
          greatestExcess = { type: "x", excess: exceedX2 };
        }
        if (exceedY1 > greatestExcess.excess) {
          greatestExcess = { type: "y", excess: exceedY1 };
        }
        if (exceedY2 > greatestExcess.excess) {
          greatestExcess = { type: "y", excess: exceedY2 };
        }
      },
    );

    return {
      appState: {
        ...appState,
        zoom: getZoomValue(greatestExcess),
        ...calculateScrollCenter(_elements),
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
