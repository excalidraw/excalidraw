import React, { useEffect } from "react";

import { DEFAULT_UI_OPTIONS, isShallowEqual } from "@excalidraw/common";

import App from "./components/App";
import { InitializeApp } from "./components/InitializeApp";
import Footer from "./components/footer/FooterCenter";
import LiveCollaborationTrigger from "./components/live-collaboration/LiveCollaborationTrigger";
import MainMenu from "./components/main-menu/MainMenu";
import WelcomeScreen from "./components/welcome-screen/WelcomeScreen";
import { defaultLang } from "./i18n";
import { EditorJotaiProvider, editorJotaiStore } from "./editor-jotai";
import polyfill from "./polyfill";

import "./css/app.scss";
import "./css/styles.scss";
import "./fonts/fonts.css";

import type { AppProps, ExcalidrawProps } from "./types";

polyfill();

const ExcalidrawBase = (props: ExcalidrawProps) => {
  const {
    onChange,
    onIncrement,
    initialData,
    excalidrawAPI,
    isCollaborating = false,
    onPointerUpdate,
    renderTopRightUI,
    langCode = defaultLang.code,
    viewModeEnabled,
    zenModeEnabled,
    gridModeEnabled,
    initState, //zsviczian
    libraryReturnUrl,
    theme,
    name,
    renderCustomStats,
    onPaste,
    onDrop, //zsviczian
    detectScroll = true,
    handleKeyboardGlobally = false,
    onLibraryChange,
    autoFocus = false,
    onBeforeTextEdit, //zsviczian
    onBeforeTextSubmit, //zsviczian
    generateIdForFile,
    onThemeChange, //zsviczian
    onLinkOpen,
    onLinkHover, //zsviczian
    onViewModeChange, //zsviczian
    generateLinkForSelection,
    onPointerDown,
    onPointerUp,
    onScrollChange,
    onDuplicate,
    children,
    validateEmbeddable,
    renderEmbeddable,
    renderWebview, //zsviczian
    renderEmbeddableMenu, //zsviczian
    renderMermaid, //zsviczian
    onContextMenu, //zsviczian
    aiEnabled,
    showDeprecatedFonts,
    insertLinkAction, //zsviczian
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
          onChange={onChange}
          onIncrement={onIncrement}
          initialData={initialData}
          excalidrawAPI={excalidrawAPI}
          isCollaborating={isCollaborating}
          onPointerUpdate={onPointerUpdate}
          renderTopRightUI={renderTopRightUI}
          langCode={langCode}
          viewModeEnabled={viewModeEnabled}
          zenModeEnabled={zenModeEnabled}
          gridModeEnabled={gridModeEnabled}
          initState={initState} //zsviczian
          libraryReturnUrl={libraryReturnUrl}
          theme={theme}
          name={name}
          renderCustomStats={renderCustomStats}
          UIOptions={UIOptions}
          onPaste={onPaste}
          onDrop={onDrop} //zsviczian
          detectScroll={detectScroll}
          handleKeyboardGlobally={handleKeyboardGlobally}
          onLibraryChange={onLibraryChange}
          autoFocus={autoFocus}
          onBeforeTextEdit={onBeforeTextEdit} //zsviczian
          onBeforeTextSubmit={onBeforeTextSubmit} //zsviczian
          generateIdForFile={generateIdForFile}
          onThemeChange={onThemeChange} //zsviczian
          onLinkOpen={onLinkOpen}
          onLinkHover={onLinkHover} //zsviczian
          onViewModeChange={onViewModeChange} //zsviczian
          generateLinkForSelection={generateLinkForSelection}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onScrollChange={onScrollChange}
          onDuplicate={onDuplicate}
          validateEmbeddable={validateEmbeddable}
          renderEmbeddable={renderEmbeddable}
          renderWebview={renderWebview} //zsviczian
          renderEmbeddableMenu={renderEmbeddableMenu} //zsviczian
          renderMermaid={renderMermaid} //zsviczian
          onContextMenu={onContextMenu} //zsviczian
          aiEnabled={aiEnabled !== false}
          showDeprecatedFonts={showDeprecatedFonts}
          insertLinkAction={insertLinkAction} //zsviczian
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
  restore,
  restoreAppState,
  restoreElements,
  restoreLibraryItems,
} from "./data/restore";

export { reconcileElements } from "./data/reconcile";

export {
  exportToCanvas,
  exportToBlob,
  exportToSvg,
  exportToClipboard,
} from "@excalidraw/utils/export";


export { getCommonBoundingBox } from "@excalidraw/element/bounds"; //zsviczian
export { getMaximumGroups } from "@excalidraw/element/groups"; //zsviczian
export { determineFocusDistance } from "@excalidraw/element/binding"; //zsviczian
export { measureText } from "@excalidraw/element/textMeasurements"; //zsviczian
export { wrapText } from "@excalidraw/element/textWrapping"; //zsviczian
export { getLineHeight } from "@excalidraw/common"; //zsviczian
export { getFontString, getFontFamilyString } from "@excalidraw/common"; //zsviczian
export { getBoundTextMaxWidth } from "@excalidraw/element/textElement"; //zsviczian
export { mermaidToExcalidraw } from "./components/TTDDialog/MermaidToExcalidrawLib"; //zsviczian
export {
  destroyObsidianUtils,
  registerLocalFont,
  getFontMetrics,
  getFontFamilies,
  registerFontsInCSS,
  getCSSFontDefinition,
  loadSceneFonts,
  getSharedMermaidInstance,
  loadMermaid,
  intersectElementWithLine,
} from "../excalidraw/obsidianUtils"; //zsviczian

export { refreshTextDimensions } from "@excalidraw/element/newElement"; //zsviczian

export { getContainerElement } from "@excalidraw/element/textElement"; //zsviczian

export { serializeAsJSON, serializeLibraryAsJSON } from "./data/json";
export {
  loadFromBlob,
  loadSceneOrLibraryFromBlob,
  loadLibraryFromBlob,
} from "./data/blob";
export { getFreeDrawSvgPath } from "@excalidraw/element";
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
} from "@excalidraw/common";

export {
  mutateElement,
  newElementWith,
  bumpVersion,
} from "@excalidraw/element";

export { CaptureUpdateAction } from "@excalidraw/element";

export { parseLibraryTokensFromUrl, useHandleLibrary } from "./data/library";

export {
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
  safelyParseJSON, //zsviczian
} from "@excalidraw/common";

export { getEmbedLink } from "@excalidraw/element/embeddable"; //zsviczian - not sure if I use it any more
export { Sidebar } from "./components/Sidebar/Sidebar";
export { Button } from "./components/Button";
export { Footer };
export { MainMenu };
export { useDevice } from "./components/App";
export { WelcomeScreen };
export { LiveCollaborationTrigger };
export { Stats } from "./components/Stats";

export { DefaultSidebar } from "./components/DefaultSidebar";
export { TTDDialog } from "./components/TTDDialog/TTDDialog";
export { TTDDialogTrigger } from "./components/TTDDialog/TTDDialogTrigger";

export { zoomToFitBounds } from "./actions/actionCanvas";
export { convertToExcalidrawElements } from "./data/transform";
export { getCommonBounds, getVisibleSceneBounds } from "@excalidraw/element";

export {
  elementsOverlappingBBox,
  isElementInsideBBox,
  elementPartiallyOverlapsWithOrContainsBBox,
} from "@excalidraw/utils/withinBounds";

export { DiagramToCodePlugin } from "./components/DiagramToCodePlugin/DiagramToCodePlugin";
export { getDataURL } from "./data/blob";
export { isElementLink } from "@excalidraw/element";

export { setCustomTextMetricsProvider } from "@excalidraw/element";
