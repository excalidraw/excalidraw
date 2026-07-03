import {
  DEFAULT_CANVAS_BACKGROUND_PICKS,
  CURSOR_TYPE,
  MAX_ZOOM,
  MIN_ZOOM,
  THEME,
  ZOOM_STEP,
  updateActiveTool,
  CODES,
  KEYS,
} from "@excalidraw/common";

import { getNonDeletedElements } from "@excalidraw/element";
import { newElementWith } from "@excalidraw/element";
import { getCommonBounds } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import {
  getDefaultAppState,
  isEraserActive,
  isHandToolActive,
} from "../appState";
import { ColorPicker } from "../components/ColorPicker/ColorPicker";
import { ToolButton } from "../components/ToolButton";
import { Tooltip } from "../components/Tooltip";
import {
  handIcon,
  LassoIcon,
  MoonIcon,
  SunIcon,
  TrashIcon,
  zoomAreaIcon,
  ZoomInIcon,
  ZoomOutIcon,
  ZoomResetIcon,
} from "../components/icons";
import { setCursor } from "../cursor";

import { t } from "../i18n";
import { getNormalizedZoom } from "../scene";
import { getStateForZoom } from "../scene/zoom";
import { constrainScrollState, zoomToFitBounds } from "../viewport";
import { getShortcutKey } from "../shortcut";

import { register } from "./register";

import type { AppState } from "../types";

export const actionChangeViewBackgroundColor = register<Partial<AppState>>({
  name: "changeViewBackgroundColor",
  label: "labels.canvasBackground",
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
      captureUpdate: !!value?.viewBackgroundColor
        ? CaptureUpdateAction.IMMEDIATELY
        : CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, appProps, data }) => {
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
  label: "labels.clearCanvas",
  icon: TrashIcon,
  trackEvent: { category: "canvas" },
  predicate: (elements, appState, props, app) => {
    return (
      !!app.props.UIOptions.canvasActions.clearCanvas &&
      !appState.viewModeEnabled &&
      appState.openDialog?.name !== "elementLinkSelector"
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
        gridStep: appState.gridStep,
        gridModeEnabled: appState.gridModeEnabled,
        stats: appState.stats,
        activeTool:
          appState.activeTool.type === "image"
            ? {
                ...appState.activeTool,
                type: app.state.preferredSelectionTool.type,
              }
            : appState.activeTool,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionZoomIn = register({
  name: "zoomIn",
  label: "buttons.zoomIn",
  viewMode: true,
  icon: ZoomInIcon,
  trackEvent: { category: "canvas" },
  perform: (_elements, appState, _, app) => {
    const nextState = {
      ...appState,
      ...getStateForZoom(
        {
          viewportX: appState.width / 2 + appState.offsetLeft,
          viewportY: appState.height / 2 + appState.offsetTop,
          nextZoom: getNormalizedZoom(appState.zoom.value + ZOOM_STEP),
        },
        appState,
      ),
      userToFollow: null,
    };
    return {
      appState: { ...nextState, ...constrainScrollState(nextState) },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ updateData, appState }) => (
    <ToolButton
      type="button"
      className="zoom-in-button zoom-button"
      icon={ZoomInIcon}
      title={`${t("buttons.zoomIn")} — ${getShortcutKey("CtrlOrCmd++")}`}
      aria-label={t("buttons.zoomIn")}
      disabled={appState.zoom.value >= MAX_ZOOM}
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
  label: "buttons.zoomOut",
  icon: ZoomOutIcon,
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform: (_elements, appState, _, app) => {
    const nextState = {
      ...appState,
      ...getStateForZoom(
        {
          viewportX: appState.width / 2 + appState.offsetLeft,
          viewportY: appState.height / 2 + appState.offsetTop,
          nextZoom: getNormalizedZoom(appState.zoom.value - ZOOM_STEP),
        },
        appState,
      ),
      userToFollow: null,
    };
    return {
      appState: { ...nextState, ...constrainScrollState(nextState) },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ updateData, appState }) => (
    <ToolButton
      type="button"
      className="zoom-out-button zoom-button"
      icon={ZoomOutIcon}
      title={`${t("buttons.zoomOut")} — ${getShortcutKey("CtrlOrCmd+-")}`}
      aria-label={t("buttons.zoomOut")}
      disabled={appState.zoom.value <= MIN_ZOOM}
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
  label: "buttons.resetZoom",
  icon: ZoomResetIcon,
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform: (_elements, appState, _, app) => {
    // reset to 100%, unless a zoom lock floors the zoom higher — then reset to
    // the locked minimum zoom (the lock's resting zoom level)
    const nextZoom = appState.scrollConstraints?.lockZoom
      ? appState.scrollConstraints.zoom
      : 1;
    const nextState = {
      ...appState,
      ...getStateForZoom(
        {
          viewportX: appState.width / 2 + appState.offsetLeft,
          viewportY: appState.height / 2 + appState.offsetTop,
          nextZoom: getNormalizedZoom(nextZoom),
        },
        appState,
      ),
      userToFollow: null,
    };
    return {
      // re-clamp so the reset can't escape an active scroll/zoom lock
      appState: { ...nextState, ...constrainScrollState(nextState) },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
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

// Note, this action differs from actionZoomToFitSelection in that it doesn't
// zoom beyond 100%. In other words, if the content is smaller than viewport
// size, it won't be zoomed in.
export const actionZoomToFitSelectionInViewport = register({
  name: "zoomToFitSelectionInViewport",
  label: "labels.zoomToFitViewport",
  icon: zoomAreaIcon,
  trackEvent: { category: "canvas" },
  predicate: (elements, appState) => !appState.scrollConstraints,
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    return zoomToFitBounds({
      bounds: getCommonBounds(
        getNonDeletedElements(
          selectedElements.length ? selectedElements : elements,
        ),
      ),
      appState: {
        ...appState,
        userToFollow: null,
      },
      fit: "scale-down",
      canvasOffsets: app.getViewportOffsets(),
    });
  },
  // NOTE shift-2 should have been assigned actionZoomToFitSelection.
  // TBD on how proceed
  keyTest: (event, appState) =>
    !appState.scrollConstraints &&
    event.code === CODES.TWO &&
    event.shiftKey &&
    !event.altKey &&
    !event[KEYS.CTRL_OR_CMD],
});

export const actionZoomToFitSelection = register({
  name: "zoomToFitSelection",
  label: "helpDialog.zoomToSelection",
  icon: zoomAreaIcon,
  trackEvent: { category: "canvas" },
  predicate: (elements, appState) => !appState.scrollConstraints,
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    return zoomToFitBounds({
      bounds: getCommonBounds(
        getNonDeletedElements(
          selectedElements.length ? selectedElements : elements,
        ),
      ),
      appState: {
        ...appState,
        userToFollow: null,
      },
      fit: "contain",
      canvasOffsets: app.getViewportOffsets(),
    });
  },
  // NOTE this action should use shift-2 per figma, alas
  keyTest: (event, appState) =>
    !appState.scrollConstraints &&
    event.code === CODES.THREE &&
    event.shiftKey &&
    !event.altKey &&
    !event[KEYS.CTRL_OR_CMD],
});

export const actionZoomToFit = register({
  name: "zoomToFit",
  label: "helpDialog.zoomToFit",
  icon: zoomAreaIcon,
  viewMode: true,
  trackEvent: { category: "canvas" },
  predicate: (elements, appState) => !appState.scrollConstraints,
  perform: (elements, appState, _, app) =>
    zoomToFitBounds({
      bounds: getCommonBounds(getNonDeletedElements(elements)),
      appState: {
        ...appState,
        userToFollow: null,
      },
      fit: "scale-down",
      canvasOffsets: app.getViewportOffsets(),
    }),
  keyTest: (event, appState) =>
    !appState.scrollConstraints &&
    event.code === CODES.ONE &&
    event.shiftKey &&
    !event.altKey &&
    !event[KEYS.CTRL_OR_CMD],
});

export const actionToggleTheme = register<AppState["theme"]>({
  name: "toggleTheme",
  label: (_, appState) => {
    return appState.theme === THEME.DARK
      ? "buttons.lightMode"
      : "buttons.darkMode";
  },
  keywords: ["toggle", "dark", "light", "mode", "theme"],
  icon: (appState, elements) =>
    appState.theme === THEME.LIGHT ? MoonIcon : SunIcon,
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform: (_, appState, value, app) => {
    const nextTheme =
      value || (appState.theme === THEME.LIGHT ? THEME.DARK : THEME.LIGHT);

    if (app.props.onThemeChange) {
      app.props.onThemeChange(nextTheme);
      return false;
    }

    return {
      appState: {
        ...appState,
        theme: nextTheme,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] &&
    event.altKey &&
    event.shiftKey &&
    event.code === CODES.D,
  predicate: (elements, appState, props, app) => {
    return !!app.props.UIOptions.canvasActions.toggleTheme;
  },
});

export const actionToggleEraserTool = register({
  name: "toggleEraserTool",
  label: "toolBar.eraser",
  trackEvent: { category: "toolbar" },
  perform: (elements, appState, _, app) => {
    let activeTool: AppState["activeTool"];

    if (isEraserActive(appState)) {
      activeTool = updateActiveTool(appState, {
        ...(appState.activeTool.lastActiveTool || {
          type: app.state.preferredSelectionTool.type,
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
        activeEmbeddable: null,
        activeTool,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event, appState) =>
    event.key === KEYS.E &&
    !appState.newElement &&
    !appState.selectedLinearElement?.isEditing &&
    !appState.selectedLinearElement?.isDragging,
});

export const actionToggleLassoTool = register({
  name: "toggleLassoTool",
  label: "toolBar.lasso",
  icon: LassoIcon,
  trackEvent: { category: "toolbar" },
  predicate: (elements, appState, props, app) => {
    return app.state.preferredSelectionTool.type !== "lasso";
  },
  perform: (elements, appState, _, app) => {
    let activeTool: AppState["activeTool"];

    if (appState.activeTool.type !== "lasso") {
      activeTool = updateActiveTool(appState, {
        type: "lasso",
        fromSelection: false,
      });
      setCursor(app.interactiveCanvas, CURSOR_TYPE.CROSSHAIR);
    } else {
      activeTool = updateActiveTool(appState, {
        type: "selection",
      });
    }

    return {
      appState: {
        ...appState,
        selectedElementIds: {},
        selectedGroupIds: {},
        activeEmbeddable: null,
        activeTool,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});

export const actionToggleHandTool = register({
  name: "toggleHandTool",
  label: "toolBar.hand",
  trackEvent: { category: "toolbar" },
  icon: handIcon,
  viewMode: false,
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
      setCursor(app.interactiveCanvas, CURSOR_TYPE.GRAB);
    }

    return {
      appState: {
        ...appState,
        selectedElementIds: {},
        selectedGroupIds: {},
        activeEmbeddable: null,
        activeTool,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    !event.altKey && !event[KEYS.CTRL_OR_CMD] && event.key === KEYS.H,
});
