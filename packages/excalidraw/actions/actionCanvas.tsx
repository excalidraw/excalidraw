import {
  DEFAULT_CANVAS_BACKGROUND_PICKS,
  MAX_ZOOM,
  MIN_ZOOM,
  THEME,
  ZOOM_STEP,
  CODES,
  KEYS,
  DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE,
} from "@excalidraw/common";

import { getNonDeletedElements } from "@excalidraw/element";
import { newElementWith } from "@excalidraw/element";
import { getCommonBounds } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { Bounds } from "@excalidraw/common";

import { getDefaultAppState } from "../appState";
import { ColorPicker } from "../components/ColorPicker/ColorPicker";
import { IconButton } from "../components/IconButton";
import { Tooltip } from "../components/Tooltip";
import {
  MoonIcon,
  SunIcon,
  TrashIcon,
  zoomAreaIcon,
  ZoomInIcon,
  ZoomOutIcon,
  ZoomResetIcon,
} from "../components/icons";
import { useAppStateValue } from "../hooks/useAppStateValue";

import { t } from "../i18n";
import { getNormalizedZoom } from "../scene";
import {
  constrainScrollState,
  getViewportForZoomWithScrollConstraints,
  zoomToFitBounds,
} from "../viewport";
import { getShortcutKey } from "../shortcut";

import { register } from "./register";

import type { AppClassProperties, AppState } from "../types";
import { getMaxZoom, getZoomMax, getZoomMin, getZoomStep } from "../obsidianUtils";
import { excludeElementsInFramesFromSelection } from "@excalidraw/element/selection";
import { ExcalidrawElement } from "@excalidraw/element/types";

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
        topPicks={
          //zsviczian
          appState.colorPalette?.topPicks?.canvasBackground ??
          DEFAULT_CANVAS_BACKGROUND_PICKS
        }
        palette={
          //zsviczian
          appState.colorPalette?.canvasBackground ??
          DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE
        }
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
        colorPalette: appState.colorPalette, //zsviczian
        allowPinchZoom: appState.allowPinchZoom, //zsviczian
        allowWheelZoom: appState.allowWheelZoom, //zsviczian
        disableContextMenu: appState.disableContextMenu, //zsviczian
        pinnedScripts: appState.pinnedScripts, //zsviczian
        customPens: appState.customPens, //zsviczian
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionZoomIn = register({
  name: "zoomIn",
  label: "buttons.zoomIn",
  viewMode: true,
  navigation: true,
  icon: ZoomInIcon,
  trackEvent: { category: "canvas" },
  predicate: (elements, appState, appProps, app) => app.isNavigationEnabled(),
  perform: (_elements, appState, _, app) => {
    app.requestUnfollow();
    const nextState = {
      ...appState,
      ...getViewportForZoomWithScrollConstraints(
        {
          viewportX: appState.width / 2 + appState.offsetLeft,
          viewportY: appState.height / 2 + appState.offsetTop,
          nextZoom: getNormalizedZoom(appState.zoom.value + getZoomStep()), //zsviczian
        },
        appState,
      ),
    };
    return {
      appState: nextState,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ updateData }) => {
    const zoomValue = useAppStateValue((appState) => appState.zoom.value);
    return (
      <IconButton
        type="button"
        className="zoom-in-button zoom-button"
        icon={ZoomInIcon}
        title={`${t("buttons.zoomIn")} — ${getShortcutKey("CtrlOrCmd++")}`}
        aria-label={t("buttons.zoomIn")}
        disabled={zoomValue >= getZoomMax()} //zsviczian
        onClick={() => {
          updateData(null);
        }}
      />
    );
  },
  keyTest: (event) =>
    (event.code === CODES.EQUAL || event.code === CODES.NUM_ADD) &&
    (event[KEYS.CTRL_OR_CMD] || event.shiftKey),
});

export const actionZoomOut = register({
  name: "zoomOut",
  label: "buttons.zoomOut",
  icon: ZoomOutIcon,
  viewMode: true,
  navigation: true,
  trackEvent: { category: "canvas" },
  predicate: (elements, appState, appProps, app) => app.isNavigationEnabled(),
  perform: (_elements, appState, _, app) => {
    app.requestUnfollow();
    const nextState = {
      ...appState,
      ...getViewportForZoomWithScrollConstraints(
        {
          viewportX: appState.width / 2 + appState.offsetLeft,
          viewportY: appState.height / 2 + appState.offsetTop,
          nextZoom: getNormalizedZoom(appState.zoom.value - getZoomStep()),
        },
        appState,
      ),
    };
    return {
      appState: nextState,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ updateData }) => {
    const zoomValue = useAppStateValue((appState) => appState.zoom.value);
    return (
      <IconButton
        type="button"
        className="zoom-out-button zoom-button"
        icon={ZoomOutIcon}
        title={`${t("buttons.zoomOut")} — ${getShortcutKey("CtrlOrCmd+-")}`}
        aria-label={t("buttons.zoomOut")}
        disabled={zoomValue <= getZoomMin()} //zsviczian
        onClick={() => {
          updateData(null);
        }}
      />
    );
  },
  keyTest: (event) =>
    (event.code === CODES.MINUS || event.code === CODES.NUM_SUBTRACT) &&
    (event[KEYS.CTRL_OR_CMD] || event.shiftKey),
});

export const actionResetZoom = register({
  name: "resetZoom",
  label: "buttons.resetZoom",
  icon: ZoomResetIcon,
  viewMode: true,
  navigation: true,
  trackEvent: { category: "canvas" },
  predicate: (elements, appState, appProps, app) => app.isNavigationEnabled(),
  perform: (_elements, appState, _, app) => {
    app.requestUnfollow();
    // reset to 100%, unless a zoom lock floors the zoom higher — then reset to
    // the locked minimum zoom (the lock's resting zoom level)
    const nextZoom = appState.scrollConstraints?.lockZoom
      ? appState.scrollConstraints.zoom
      : 1;
    const nextState = {
      ...appState,
      ...getViewportForZoomWithScrollConstraints(
        {
          viewportX: appState.width / 2 + appState.offsetLeft,
          viewportY: appState.height / 2 + appState.offsetTop,
          nextZoom: getNormalizedZoom(nextZoom),
        },
        appState,
      ),
    };
    return {
      appState: nextState,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ updateData }) => {
    const zoomValue = useAppStateValue((appState) => appState.zoom.value);
    return (
      //zsviczian <Tooltip label={t("buttons.resetZoom")} style={{ height: "100%" }}>
        <IconButton
          type="button"
          className="reset-zoom-button zoom-button"
          title={t("buttons.resetZoom")}
          aria-label={t("buttons.resetZoom")}
          onClick={() => {
            updateData(null);
          }}
        >
          {(zoomValue * 100).toFixed(0)}%
        </IconButton>
      //zsviczian </Tooltip>
    );
  },
  keyTest: (event) =>
    (event.code === CODES.ZERO || event.code === CODES.NUM_ZERO) &&
    (event[KEYS.CTRL_OR_CMD] || event.shiftKey),
});

// under a viewport lock, zoom-to-fit targets the locked box rather than the
// scene elements
const getScrollConstraintsBounds = (
  scrollConstraints: NonNullable<AppState["scrollConstraints"]>,
) => {
  return [
    scrollConstraints.x,
    scrollConstraints.y,
    scrollConstraints.x + scrollConstraints.width,
    scrollConstraints.y + scrollConstraints.height,
  ] as Bounds;
};

// Note, this action differs from actionZoomToFitSelection in that it doesn't
// zoom beyond 100%. In other words, if the content is smaller than viewport
// size, it won't be zoomed in.
export const actionZoomToFitSelectionInViewport = register({
  name: "zoomToFitSelectionInViewport",
  label: "labels.zoomToFitViewport",
  icon: zoomAreaIcon,
  // with no selection (as is always the case in view mode & when
  // non-interactive), fits all elements, or the locked viewport box when
  // a viewport lock is active
  viewMode: true,
  navigation: true,
  trackEvent: { category: "canvas" },
  predicate: (elements, appState, appProps, app) => app.isNavigationEnabled(),
  perform: (elements, appState, _, app) => {
    app.requestUnfollow();
    const selectedElements = app.scene.getSelectedElements(appState);
    const bounds = selectedElements.length
      ? getCommonBounds(getNonDeletedElements(selectedElements))
      : appState.scrollConstraints
      ? getScrollConstraintsBounds(appState.scrollConstraints)
      : getCommonBounds(getNonDeletedElements(elements));
    const result = zoomToFitBounds({
      bounds,
      appState,
      fit: "scale-down",
      canvasOffsets: app.viewport.getOffsets(),
    });
    return {
      ...result,
      // re-clamp so the fit can't escape an active scroll/zoom lock
      appState: {
        ...result.appState,
        ...constrainScrollState(result.appState),
      },
    };
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
  label: "helpDialog.zoomToSelection",
  icon: zoomAreaIcon,
  // with no selection (as is always the case in view mode & when
  // non-interactive), fits all elements, or the locked viewport box when
  // a viewport lock is active
  viewMode: true,
  navigation: true,
  trackEvent: { category: "canvas" },
  predicate: (elements, appState, appProps, app) => app.isNavigationEnabled(),
  perform: (elements, appState, _, app) => {
    app.requestUnfollow();
    const selectedElements = app.scene.getSelectedElements(appState);
    const bounds = selectedElements.length
      ? getCommonBounds(getNonDeletedElements(selectedElements))
      : appState.scrollConstraints
      ? getScrollConstraintsBounds(appState.scrollConstraints)
      : getCommonBounds(getNonDeletedElements(elements));
    const result = zoomToFitBounds({
      bounds,
      appState,
      fit: "contain",
      canvasOffsets: app.viewport.getOffsets(),
    });
    return {
      ...result,
      // re-clamp so the fit can't escape an active scroll/zoom lock
      appState: {
        ...result.appState,
        ...constrainScrollState(result.appState),
      },
    };
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
  label: "helpDialog.zoomToFit",
  icon: zoomAreaIcon,
  viewMode: true,
  navigation: true,
  trackEvent: { category: "canvas" },
  predicate: (elements, appState, appProps, app) => app.isNavigationEnabled(),
  perform: (elements, appState, _, app) => {
    app.requestUnfollow();
    // under a viewport lock, fits the locked box rather than the elements
    const bounds = appState.scrollConstraints
      ? getScrollConstraintsBounds(appState.scrollConstraints)
      : getCommonBounds(getNonDeletedElements(elements));
    const result = zoomToFitBounds({
      bounds,
      appState,
      fit: "scale-down",
      canvasOffsets: app.viewport.getOffsets(),
    });
    return {
      ...result,
      // re-clamp so the fit can't escape an active scroll/zoom lock
      appState: {
        ...result.appState,
        ...constrainScrollState(result.appState),
      },
    };
  },
  keyTest: (event) =>
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
      //return false; //zsviczian (I don't understand why the return false here)
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
//zsviczian
export const zoomToFitElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  zoomToSelection: boolean,
  app: AppClassProperties, //zsviczian
  maxZoom?: number, //zsviczian
  margin: number = 0, //zsviczian
) => {
  if (typeof maxZoom === "undefined") {
    //zsviczian
    maxZoom = getMaxZoom();
  }
  const nonDeletedElements = getNonDeletedElements(elements);
  const selectedElements = app.scene.getSelectedElements(appState);

  const commonBounds =
    zoomToSelection && selectedElements.length > 0
      ? getCommonBounds(excludeElementsInFramesFromSelection(selectedElements))
      : getCommonBounds(
          excludeElementsInFramesFromSelection(nonDeletedElements),
        );

  //zsviczian: keep Obsidian zoom customization (maxZoom + zoom step) on top of upstream viewport API
  const inset = {
    top: appState.height * margin * 0.5,
    right: appState.width * margin * 0.5,
    bottom: appState.height * margin * 0.5,
    left: appState.width * margin * 0.5,
  };

  return {
    ...zoomToFitBounds({
      bounds: commonBounds,
      appState,
      fit: "contain",
      canvasOffsets: inset,
      maxZoom, //zsviczian
      //zsviczian: preserve legacy API behavior (no viewport ZOOM_STEP snapping)
      steppedZoom: false,
    }),
    commitToHistory: false,
  };
};