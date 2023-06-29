import { ColorPicker } from "../components/ColorPicker/ColorPicker";
import { ZoomInIcon, ZoomOutIcon } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { CURSOR_TYPE, MIN_ZOOM, THEME, ZOOM_STEP } from "../constants";
import { getCommonBounds, getNonDeletedElements } from "../element";
import { ExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { CODES, KEYS } from "../keys";
import { getNormalizedZoom, getSelectedElements } from "../scene";
import { centerScrollOn } from "../scene/scroll";
import { getStateForZoom } from "../scene/zoom";
import { AppState, NormalizedZoomValue } from "../types";
import { getShortcutKey, setCursor, updateActiveTool } from "../utils";
import { register } from "./register";
import { Tooltip } from "../components/Tooltip";
import { newElementWith } from "../element/mutateElement";
import {
  getDefaultAppState,
  isEraserActive,
  isHandToolActive,
} from "../appState";
import { DEFAULT_CANVAS_BACKGROUND_PICKS } from "../colors";
import { Bounds } from "../element/bounds";

export const actionChangeViewBackgroundColor = register({
  name: "changeViewBackgroundColor",
  trackEvent: false,
  predicate: (elements, appState, props, app) => {
    return (
      !!app.props.UIOptions.canvasActions.changeViewBackgroundColor &&
      !appState.viewModeEnabled
    );
  },
  perform: (_, appState, value) => {
    return {
      appState: { ...appState, ...value },
      commitToHistory: !!value.viewBackgroundColor,
    };
  },
  PanelComponent: ({ elements, appState, updateData, appProps }) => {
    // FIXME move me to src/components/mainMenu/DefaultItems.tsx
    return (
      <ColorPicker
        palette={null}
        topPicks={DEFAULT_CANVAS_BACKGROUND_PICKS}
        label={t("labels.canvasBackground")}
        type="canvasBackground"
        color={appState.viewBackgroundColor}
        onChange={(color) => updateData({ viewBackgroundColor: color })}
        data-testid="canvas-background-picker"
        elements={elements}
        appState={appState}
        updateData={updateData}
      />
    );
  },
});

export const actionClearCanvas = register({
  name: "clearCanvas",
  trackEvent: { category: "canvas" },
  predicate: (elements, appState, props, app) => {
    return (
      !!app.props.UIOptions.canvasActions.clearCanvas &&
      !appState.viewModeEnabled
    );
  },
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
  bounds: Bounds,
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

export const zoomToFit = ({
  targetElements,
  appState,
  fitToViewport = false,
  viewportZoomFactor = 0.7,
}: {
  targetElements: readonly ExcalidrawElement[];
  appState: Readonly<AppState>;
  /** whether to fit content to viewport (beyond >100%) */
  fitToViewport: boolean;
  /** zoom content to cover X of the viewport, when fitToViewport=true */
  viewportZoomFactor?: number;
}) => {
  const commonBounds = getCommonBounds(getNonDeletedElements(targetElements));

  const [x1, y1, x2, y2] = commonBounds;
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;

  let newZoomValue;
  let scrollX;
  let scrollY;

  if (fitToViewport) {
    const commonBoundsWidth = x2 - x1;
    const commonBoundsHeight = y2 - y1;

    newZoomValue =
      Math.min(
        appState.width / commonBoundsWidth,
        appState.height / commonBoundsHeight,
      ) * Math.min(1, Math.max(viewportZoomFactor, 0.1));

    // Apply clamping to newZoomValue to be between 10% and 3000%
    newZoomValue = Math.min(
      Math.max(newZoomValue, 0.1),
      30.0,
    ) as NormalizedZoomValue;

    scrollX = (appState.width / 2) * (1 / newZoomValue) - centerX;
    scrollY = (appState.height / 2) * (1 / newZoomValue) - centerY;
  } else {
    newZoomValue = zoomValueToFitBoundsOnViewport(commonBounds, {
      width: appState.width,
      height: appState.height,
    });

    const centerScroll = centerScrollOn({
      scenePoint: { x: centerX, y: centerY },
      viewportDimensions: {
        width: appState.width,
        height: appState.height,
      },
      zoom: { value: newZoomValue },
    });

    scrollX = centerScroll.scrollX;
    scrollY = centerScroll.scrollY;
  }

  return {
    appState: {
      ...appState,
      scrollX,
      scrollY,
      zoom: { value: newZoomValue },
    },
    commitToHistory: false,
  };
};

// Note, this action differs from actionZoomToFitSelection in that it doesn't
// zoom beyond 100%. In other words, if the content is smaller than viewport
// size, it won't be zoomed in.
export const actionZoomToFitSelectionInViewport = register({
  name: "zoomToFitSelectionInViewport",
  trackEvent: { category: "canvas" },
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );
    return zoomToFit({
      targetElements: selectedElements.length ? selectedElements : elements,
      appState,
      fitToViewport: false,
    });
  },
  // NOTE shift-2 should have been assigned actionZoomToFitSelection.
  // TBD on how proceed
  keyTest: (event) =>
    event.code === CODES.TWO &&
    event.shiftKey &&
    !event.altKey &&
    !event[KEYS.CTRL_OR_CMD],
});

export const actionZoomToFitSelection = register({
  name: "zoomToFitSelection",
  trackEvent: { category: "canvas" },
  perform: (elements, appState) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );
    return zoomToFit({
      targetElements: selectedElements.length ? selectedElements : elements,
      appState,
      fitToViewport: true,
    });
  },
  // NOTE this action should use shift-2 per figma, alas
  keyTest: (event) =>
    event.code === CODES.THREE &&
    event.shiftKey &&
    !event.altKey &&
    !event[KEYS.CTRL_OR_CMD],
});

export const actionZoomToFit = register({
  name: "zoomToFit",
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform: (elements, appState) =>
    zoomToFit({ targetElements: elements, appState, fitToViewport: false }),
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
  keyTest: (event) => event.altKey && event.shiftKey && event.code === CODES.D,
  predicate: (elements, appState, props, app) => {
    return !!app.props.UIOptions.canvasActions.toggleTheme;
  },
});

export const actionToggleEraserTool = register({
  name: "toggleEraserTool",
  trackEvent: { category: "toolbar" },
  perform: (elements, appState) => {
    let activeTool: AppState["activeTool"];

    if (isEraserActive(appState)) {
      activeTool = updateActiveTool(appState, {
        ...(appState.activeTool.lastActiveTool || {
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
});

export const actionToggleHandTool = register({
  name: "toggleHandTool",
  trackEvent: { category: "toolbar" },
  perform: (elements, appState, _, app) => {
    let activeTool: AppState["activeTool"];

    if (isHandToolActive(appState)) {
      activeTool = updateActiveTool(appState, {
        ...(appState.activeTool.lastActiveTool || {
          type: "selection",
        }),
        lastActiveToolBeforeEraser: null,
      });
    } else {
      activeTool = updateActiveTool(appState, {
        type: "hand",
        lastActiveToolBeforeEraser: appState.activeTool,
      });
      setCursor(app.canvas, CURSOR_TYPE.GRAB);
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
  keyTest: (event) => event.key === KEYS.H,
});
