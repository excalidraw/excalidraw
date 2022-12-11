import { ColorPicker } from "../components/ColorPicker";
import {
  eraser,
  MoonIcon,
  SunIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { MIN_ZOOM, THEME, ZOOM_STEP } from "../constants";
import { getCommonBounds, getNonDeletedElements } from "../element";
import { ExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { CODES, KEYS } from "../keys";
import { getNormalizedZoom, getSelectedElements } from "../scene";
import { centerScrollOn } from "../scene/scroll";
import { getStateForZoom } from "../scene/zoom";
import { AppState, NormalizedZoomValue } from "../types";
import { getShortcutKey, updateActiveTool } from "../utils";
import { register } from "./register";
import { Tooltip } from "../components/Tooltip";
import { newElementWith } from "../element/mutateElement";
import { getDefaultAppState, isEraserActive } from "../appState";
import ClearCanvas from "../components/ClearCanvas";
import clsx from "clsx";
import MenuItem from "../components/MenuItem";
import { getShortcutFromShortcutName } from "./shortcuts";

export const actionChangeViewBackgroundColor = register({
  name: "changeViewBackgroundColor",
  trackEvent: false,
  perform: (_, appState, value) => {
    return {
      appState: { ...appState, ...value },
      commitToHistory: !!value.viewBackgroundColor,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => {
    return (
      <div style={{ position: "relative" }}>
        <ColorPicker
          label={t("labels.canvasBackground")}
          type="canvasBackground"
          color={appState.viewBackgroundColor}
          onChange={(color) => updateData({ viewBackgroundColor: color })}
          isActive={appState.openPopup === "canvasColorPicker"}
          setActive={(active) =>
            updateData({ openPopup: active ? "canvasColorPicker" : null })
          }
          data-testid="canvas-background-picker"
          elements={elements}
          appState={appState}
        />
      </div>
    );
  },
});

export const actionClearCanvas = register({
  name: "clearCanvas",
  trackEvent: { category: "canvas" },
  perform: (elements, appState, _, app) => {
    app.imageCache.clear();
    return {
      elements: elements.map((element) =>
        newElementWith(element, { isDeleted: true }),
      ),
      appState: {
        ...getDefaultAppState(),
        files: {},
        theme: appState.theme,
        penMode: appState.penMode,
        penDetected: appState.penDetected,
        exportBackground: appState.exportBackground,
        exportEmbedScene: appState.exportEmbedScene,
        gridSize: appState.gridSize,
        showStats: appState.showStats,
        pasteDialog: appState.pasteDialog,
        activeTool:
          appState.activeTool.type === "image"
            ? { ...appState.activeTool, type: "selection" }
            : appState.activeTool,
      },
      commitToHistory: true,
    };
  },

  PanelComponent: ({ updateData }) => <ClearCanvas onConfirm={updateData} />,
});

export const actionZoomIn = register({
  name: "zoomIn",
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform: (_elements, appState, _, app) => {
    return {
      appState: {
        ...appState,
        ...getStateForZoom(
          {
            viewportX: appState.width / 2 + appState.offsetLeft,
            viewportY: appState.height / 2 + appState.offsetTop,
            nextZoom: getNormalizedZoom(appState.zoom.value + ZOOM_STEP),
          },
          appState,
        ),
      },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      className="zoom-in-button zoom-button"
      icon={ZoomInIcon}
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
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform: (_elements, appState, _, app) => {
    return {
      appState: {
        ...appState,
        ...getStateForZoom(
          {
            viewportX: appState.width / 2 + appState.offsetLeft,
            viewportY: appState.height / 2 + appState.offsetTop,
            nextZoom: getNormalizedZoom(appState.zoom.value - ZOOM_STEP),
          },
          appState,
        ),
      },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      className="zoom-out-button zoom-button"
      icon={ZoomOutIcon}
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
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform: (_elements, appState, _, app) => {
    return {
      appState: {
        ...appState,
        ...getStateForZoom(
          {
            viewportX: appState.width / 2 + appState.offsetLeft,
            viewportY: appState.height / 2 + appState.offsetTop,
            nextZoom: getNormalizedZoom(1),
          },
          appState,
        ),
      },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ updateData, appState }) => (
    <Tooltip label={t("buttons.resetZoom")} style={{ height: "100%" }}>
      <ToolButton
        type="button"
        className="reset-zoom-button zoom-button"
        title={t("buttons.resetZoom")}
        aria-label={t("buttons.resetZoom")}
        onClick={() => {
          updateData(null);
        }}
      >
        {(appState.zoom.value * 100).toFixed(0)}%
      </ToolButton>
    </Tooltip>
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
    Math.max(zoomAdjustedToSteps, MIN_ZOOM),
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

  const newZoom = {
    value: zoomValueToFitBoundsOnViewport(commonBounds, {
      width: appState.width,
      height: appState.height,
    }),
  };

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
  trackEvent: { category: "canvas" },
  perform: (elements, appState) => zoomToFitElements(elements, appState, true),
  keyTest: (event) =>
    event.code === CODES.TWO &&
    event.shiftKey &&
    !event.altKey &&
    !event[KEYS.CTRL_OR_CMD],
});

export const actionZoomToFit = register({
  name: "zoomToFit",
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform: (elements, appState) => zoomToFitElements(elements, appState, false),
  keyTest: (event) =>
    event.code === CODES.ONE &&
    event.shiftKey &&
    !event.altKey &&
    !event[KEYS.CTRL_OR_CMD],
});

export const actionToggleTheme = register({
  name: "toggleTheme",
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform: (_, appState, value) => {
    return {
      appState: {
        ...appState,
        theme:
          value || (appState.theme === THEME.LIGHT ? THEME.DARK : THEME.LIGHT),
      },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <MenuItem
      label={
        appState.theme === "dark"
          ? t("buttons.lightMode")
          : t("buttons.darkMode")
      }
      onClick={() => {
        updateData(appState.theme === THEME.LIGHT ? THEME.DARK : THEME.LIGHT);
      }}
      icon={appState.theme === "dark" ? SunIcon : MoonIcon}
      dataTestId="toggle-dark-mode"
      shortcut={getShortcutFromShortcutName("toggleTheme")}
    />
  ),
  keyTest: (event) => event.altKey && event.shiftKey && event.code === CODES.D,
});

export const actionErase = register({
  name: "eraser",
  trackEvent: { category: "toolbar" },
  perform: (elements, appState) => {
    let activeTool: AppState["activeTool"];

    if (isEraserActive(appState)) {
      activeTool = updateActiveTool(appState, {
        ...(appState.activeTool.lastActiveToolBeforeEraser || {
          type: "selection",
        }),
        lastActiveToolBeforeEraser: null,
      });
    } else {
      activeTool = updateActiveTool(appState, {
        type: "eraser",
        lastActiveToolBeforeEraser: appState.activeTool,
      });
    }

    return {
      appState: {
        ...appState,
        selectedElementIds: {},
        selectedGroupIds: {},
        activeTool,
      },
      commitToHistory: true,
    };
  },
  keyTest: (event) => event.key === KEYS.E,
  PanelComponent: ({ elements, appState, updateData, data }) => (
    <ToolButton
      type="button"
      icon={eraser}
      className={clsx("eraser", { active: isEraserActive(appState) })}
      title={`${t("toolBar.eraser")}-${getShortcutKey("E")}`}
      aria-label={t("toolBar.eraser")}
      onClick={() => {
        updateData(null);
      }}
      size={data?.size || "medium"}
    ></ToolButton>
  ),
});
