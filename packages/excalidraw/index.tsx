import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { DEFAULT_UI_OPTIONS, isShallowEqual } from "@excalidraw/common";

import App, {
  ExcalidrawAPIContext,
  ExcalidrawAPISetContext,
} from "./components/App";
import { InitializeApp } from "./components/InitializeApp";
import Footer from "./components/footer/FooterCenter";
import LiveCollaborationTrigger from "./components/live-collaboration/LiveCollaborationTrigger";
import MainMenu from "./components/main-menu/MainMenu";
import WelcomeScreen from "./components/welcome-screen/WelcomeScreen";
import { defaultLang } from "./i18n";
import {
  useAppStateValue as _useAppStateValue,
  useOnAppStateChange as _useOnAppStateChange,
} from "./hooks/useAppStateValue";
import { EditorJotaiProvider, editorJotaiStore } from "./editor-jotai";
import polyfill from "./polyfill";

import "./css/app.scss";
import "./css/styles.scss";
import "./fonts/fonts.css";

import type {
  AppProps,
  AppState,
  ExcalidrawImperativeAPI,
  ExcalidrawProps,
} from "./types";

polyfill();

/**
 * Stateless provider that allows `useExcalidrawAPI()` (and hooks built
 * on it, such as `useAppStateValue()` and `useOnAppStateChange()`) to work
 * outside the <Excalidraw> component tree.
 */
export const ExcalidrawAPIProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  return (
    <ExcalidrawAPIContext.Provider value={api}>
      <ExcalidrawAPISetContext.Provider value={setApi}>
        {children}
      </ExcalidrawAPISetContext.Provider>
    </ExcalidrawAPIContext.Provider>
  );
};

const ExcalidrawBase = (props: ExcalidrawProps) => {
  const {
    onExport,
    onChange,
    onIncrement,
    initialData,
    onExcalidrawAPI,
    onMount,
    onUnmount,
    onInitialize,
    isCollaborating = false,
    onPointerUpdate,
    renderTopLeftUI,
    renderTopRightUI,
    langCode = defaultLang.code,
    viewModeEnabled,
    zenModeEnabled,
    gridModeEnabled,
    libraryReturnUrl,
    theme,
    name,
    renderCustomStats,
    onPaste,
    detectScroll = true,
    handleKeyboardGlobally = false,
    onLibraryChange,
    autoFocus = false,
    generateIdForFile,
    onLinkOpen,
    generateLinkForSelection,
    onPointerDown,
    onPointerUp,
    onScrollChange,
    onDuplicate,
    children,
    validateEmbeddable,
    renderEmbeddable,
    aiEnabled,
    showDeprecatedFonts,
    renderScrollbars,
  } = props;

  const canvasActions = props.UIOptions?.canvasActions;

  // FIXME normalize/set defaults in parent component so that the memo resolver
  // compares the same values
  const UIOptions: AppProps["UIOptions"] = {
    ...props.UIOptions,
    canvasActions: {
      ...DEFAULT_UI_OPTIONS.canvasActions,
      ...canvasActions,
    },
    tools: {
      image: props.UIOptions?.tools?.image ?? true,
    },
  };

  if (canvasActions?.export) {
    UIOptions.canvasActions.export.saveFileToDisk =
      canvasActions.export?.saveFileToDisk ??
      DEFAULT_UI_OPTIONS.canvasActions.export.saveFileToDisk;
  }

  if (
    UIOptions.canvasActions.toggleTheme === null &&
    typeof theme === "undefined"
  ) {
    UIOptions.canvasActions.toggleTheme = true;
  }

  const setExcalidrawAPI = useContext(ExcalidrawAPISetContext);

  const onExcalidrawAPIRef = useRef(onExcalidrawAPI);
  onExcalidrawAPIRef.current = onExcalidrawAPI;

  const handleExcalidrawAPI = useCallback(
    (api: ExcalidrawImperativeAPI | null) => {
      setExcalidrawAPI?.(api);
      onExcalidrawAPIRef.current?.(api);
    },
    [setExcalidrawAPI],
  );

  useEffect(() => {
    const importPolyfill = async () => {
      //@ts-ignore
      await import("canvas-roundrect-polyfill");
    };

    importPolyfill();

    // Block pinch-zooming on iOS outside of the content area
    const handleTouchMove = (event: TouchEvent) => {
      // @ts-ignore
      if (typeof event.scale === "number" && event.scale !== 1) {
        event.preventDefault();
      }
    };

    document.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return (
    <EditorJotaiProvider store={editorJotaiStore}>
      <InitializeApp langCode={langCode} theme={theme}>
        <App
          onExport={onExport}
          onChange={onChange}
          onIncrement={onIncrement}
          initialData={initialData}
          onExcalidrawAPI={handleExcalidrawAPI}
          onMount={onMount}
          onUnmount={onUnmount}
          onInitialize={onInitialize}
          isCollaborating={isCollaborating}
          onPointerUpdate={onPointerUpdate}
          renderTopLeftUI={renderTopLeftUI}
          renderTopRightUI={renderTopRightUI}
          langCode={langCode}
          viewModeEnabled={viewModeEnabled}
          zenModeEnabled={zenModeEnabled}
          gridModeEnabled={gridModeEnabled}
          libraryReturnUrl={libraryReturnUrl}
          theme={theme}
          name={name}
          renderCustomStats={renderCustomStats}
          UIOptions={UIOptions}
          onPaste={onPaste}
          detectScroll={detectScroll}
          handleKeyboardGlobally={handleKeyboardGlobally}
          onLibraryChange={onLibraryChange}
          autoFocus={autoFocus}
          generateIdForFile={generateIdForFile}
          onLinkOpen={onLinkOpen}
          generateLinkForSelection={generateLinkForSelection}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onScrollChange={onScrollChange}
          onDuplicate={onDuplicate}
          validateEmbeddable={validateEmbeddable}
          renderEmbeddable={renderEmbeddable}
          aiEnabled={aiEnabled !== false}
          showDeprecatedFonts={showDeprecatedFonts}
          renderScrollbars={renderScrollbars}
        >
          {children}
        </App>
      </InitializeApp>
    </EditorJotaiProvider>
  );
};

const areEqual = (prevProps: ExcalidrawProps, nextProps: ExcalidrawProps) => {
  // short-circuit early
  if (prevProps.children !== nextProps.children) {
    return false;
  }

  const {
    initialData: prevInitialData,
    UIOptions: prevUIOptions = {},
    ...prev
  } = prevProps;
  const {
    initialData: nextInitialData,
    UIOptions: nextUIOptions = {},
    ...next
  } = nextProps;

  // comparing UIOptions
  const prevUIOptionsKeys = Object.keys(prevUIOptions) as (keyof Partial<
    typeof DEFAULT_UI_OPTIONS
  >)[];
  const nextUIOptionsKeys = Object.keys(nextUIOptions) as (keyof Partial<
    typeof DEFAULT_UI_OPTIONS
  >)[];

  if (prevUIOptionsKeys.length !== nextUIOptionsKeys.length) {
    return false;
  }

  const isUIOptionsSame = prevUIOptionsKeys.every((key) => {
    if (key === "getFormFactor") {
      return true;
    }
    if (key === "canvasActions") {
      const canvasOptionKeys = Object.keys(
        prevUIOptions.canvasActions!,
      ) as (keyof Partial<typeof DEFAULT_UI_OPTIONS.canvasActions>)[];
      return canvasOptionKeys.every((key) => {
        if (
          key === "export" &&
          prevUIOptions?.canvasActions?.export &&
          nextUIOptions?.canvasActions?.export
        ) {
          return (
            prevUIOptions.canvasActions.export.saveFileToDisk ===
            nextUIOptions.canvasActions.export.saveFileToDisk
          );
        }
        return (
          prevUIOptions?.canvasActions?.[key] ===
          nextUIOptions?.canvasActions?.[key]
        );
      });
    }
    return prevUIOptions[key] === nextUIOptions[key];
  });

  return isUIOptionsSame && isShallowEqual(prev, next);
};

export const Excalidraw = React.memo(ExcalidrawBase, areEqual);
Excalidraw.displayName = "Excalidraw";

export {
  getSceneVersion,
  hashElementsVersion,
  hashString,
  getNonDeletedElements,
} from "@excalidraw/element";

export { getTextFromElements } from "@excalidraw/element";
export { isInvisiblySmallElement } from "@excalidraw/element";

export { defaultLang, useI18n, languages } from "./i18n";
export {
  restoreAppState,
  restoreElement,
  restoreElements,
  restoreLibraryItems,
} from "./data/restore";

export { reconcileElements } from "./data/reconcile";

export {
  exportToCanvas,
  exportToBlob,
  exportToSvg,
  exportToClipboard,
} from "./scene/export";

export type { ExportSceneData, ExportSceneConfig } from "./scene/export";

export { serializeAsJSON, serializeLibraryAsJSON } from "./data/json";
export {
  loadFromBlob,
  loadSceneOrLibraryFromBlob,
  loadLibraryFromBlob,
} from "./data/blob";
export { mergeLibraryItems, getLibraryItemsHash } from "./data/library";
export { isLinearElement } from "@excalidraw/element";

export {
  FONT_FAMILY,
  THEME,
  MIME_TYPES,
  ROUNDNESS,
  DEFAULT_LASER_COLOR,
  UserIdleState,
  normalizeLink,
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
  getFormFactor,
  throttleRAF,
} from "@excalidraw/common";

export {
  mutateElement,
  newElementWith,
  bumpVersion,
} from "@excalidraw/element";

export { CaptureUpdateAction } from "@excalidraw/element";

export { parseLibraryTokensFromUrl, useHandleLibrary } from "./data/library";

export { Sidebar } from "./components/Sidebar/Sidebar";
export { Button } from "./components/Button";
export { Footer };
export { MainMenu };
export { Ellipsify } from "./components/Ellipsify";
export {
  useEditorInterface,
  useStylesPanelMode,
  useExcalidrawAPI,
  ExcalidrawAPIContext,
} from "./components/App";

export { WelcomeScreen };
export { LiveCollaborationTrigger };
export { Stats } from "./components/Stats";

export { DefaultSidebar } from "./components/DefaultSidebar";
export { TTDDialog } from "./components/TTDDialog/TTDDialog";
export { TTDDialogTrigger } from "./components/TTDDialog/TTDDialogTrigger";
export { TTDStreamFetch } from "./components/TTDDialog/utils/TTDStreamFetch";
export type {
  TTDPersistenceAdapter,
  SavedChat,
  SavedChats,
} from "./components/TTDDialog/types";

export { zoomToFitBounds } from "./actions/actionCanvas";
export {
  getCommonBounds,
  getVisibleSceneBounds,
  convertToExcalidrawElements,
} from "@excalidraw/element";

export {
  elementsOverlappingBBox,
  isElementInsideBBox,
  elementPartiallyOverlapsWithOrContainsBBox,
} from "@excalidraw/utils/withinBounds";

export { DiagramToCodePlugin } from "./components/DiagramToCodePlugin/DiagramToCodePlugin";
export { getDataURL } from "./data/blob";
export { isElementLink } from "@excalidraw/element";

export { setCustomTextMetricsProvider } from "@excalidraw/element";

export { CommandPalette } from "./components/CommandPalette/CommandPalette";

export {
  renderSpreadsheet,
  tryParseSpreadsheet,
  isSpreadsheetValidForChartType,
} from "./charts";

// -----------------------------------------------------------------------------
// useExcalidrawStateValue() wrapper for host apps for the return type to reflect the
// the potentially `undefined` value for initial render before the excalidrawAPI
// is ready.
//
/**
 * hook that subscribes to specific appState prop(s)
 *
 * @param prop - appState prop(s) to subscribe to, or a selector function.
 * NOTE `prop/selector` is memoized and will not change after initial render
 */
export function useExcalidrawStateValue<K extends keyof AppState>(
  prop: K,
): AppState[K] | undefined;
export function useExcalidrawStateValue<T extends keyof AppState>(
  props: T[],
): AppState | undefined;
export function useExcalidrawStateValue<T>(
  selector: (appState: AppState) => T,
): T | undefined;
export function useExcalidrawStateValue(
  selector:
    | keyof AppState
    | (keyof AppState)[]
    | ((appState: AppState) => unknown),
) {
  return _useAppStateValue(selector as any, false);
}
// -----------------------------------------------------------------------------

export { _useOnAppStateChange as useOnExcalidrawStateChange };
