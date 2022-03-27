import { ColorPicker } from "../components/ColorPicker";
import { eraser, zoomIn, zoomOut } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { DarkModeToggle } from "../components/DarkModeToggle";
import { THEME, ZOOM_STEP } from "../constants";
import { getCommonBounds, getNonDeletedElements } from "../element";
import { ExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { CODES, KEYS } from "../keys";
import { getNormalizedZoom, getSelectedElements } from "../scene";
import { centerScrollOn } from "../scene/scroll";
import { getStateForZoom } from "../scene/zoom";
import { AppState, NormalizedZoomValue } from "../types";
import { getShortcutKey } from "../utils";
import { register } from "./register";
import { Tooltip } from "../components/Tooltip";
import { newElementWith } from "../element/mutateElement";
import { getDefaultAppState, isEraserActive } from "../appState";
import ClearCanvas from "../components/ClearCanvas";
import clsx from "clsx";

export const actionChangeViewBackgroundColor = register({
  name: "changeViewBackgroundColor",
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
        elementLocked: appState.elementLocked,
        penMode: appState.penMode,
        penDetected: appState.penDetected,
        exportBackground: appState.exportBackground,
        exportEmbedScene: appState.exportEmbedScene,
        gridSize: appState.gridSize,
        showStats: appState.showStats,
        pasteDialog: appState.pasteDialog,
        activeTool:
          appState.activeTool.type === "image"
            ? { type: "selection" }
            : appState.activeTool,
      },
      commitToHistory: true,
    };
  },

  PanelComponent: ({ updateData }) => <ClearCanvas onConfirm={updateData} />,
});

export const actionZoomIn = register({
  name: "zoomIn",
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
      icon={zoomIn}
      title={`${t("buttons.zoomIn")} — ${getShortcutKey("CtrlOrCmd++")}`}
      aria-label={t("buttons.zoomIn")}
      onClick={() => {
        updateData(null);
      }}
      size="small"
    />
  ),
  keyTest: (event) =>
    (event.code === CODES.EQUAL || event.code === CODES.NUM_ADD) &&
    (event[KEYS.CTRL_OR_CMD] || event.shiftKey),
});

export const actionZoomOut = register({
  name: "zoomOut",
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
      icon={zoomOut}
      title={`${t("buttons.zoomOut")} — ${getShortcutKey("CtrlOrCmd+-")}`}
      aria-label={t("buttons.zoomOut")}
      onClick={() => {
        updateData(null);
      }}
      size="small"
    />
  ),
  keyTest: (event) =>
    (event.code === CODES.MINUS || event.code === CODES.NUM_SUBTRACT) &&
    (event[KEYS.CTRL_OR_CMD] || event.shiftKey),
});

export const actionResetZoom = register({
  name: "resetZoom",
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
        className="reset-zoom-button"
        title={t("buttons.resetZoom")}
        aria-label={t("buttons.resetZoom")}
        onClick={() => {
          updateData(null);
        }}
        size="small"
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

export const actionToggleTheme = register({
  name: "toggleTheme",
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
    <div style={{ marginInlineStart: "0.25rem" }}>
      <DarkModeToggle
        value={appState.theme}
        onChange={(theme) => {
          updateData(theme);
        }}
      />
    </div>
  ),
  keyTest: (event) => event.altKey && event.shiftKey && event.code === CODES.D,
});

export const actionErase = register({
  name: "eraser",
  perform: (elements, appState) => {
    return {
      appState: {
        ...appState,
        selectedElementIds: {},
        selectedGroupIds: {},
        activeTool: {
          type: isEraserActive(appState)
            ? appState.activeTool.typeBeforeEraser ?? "selection"
            : "eraser",
          typeBeforeEraser: isEraserActive(appState)
            ? undefined
            : appState.activeTool.type,
        },
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
