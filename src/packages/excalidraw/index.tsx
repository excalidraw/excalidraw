import React, { useEffect } from "react";
import { InitializeApp } from "../../components/InitializeApp";
import App from "../../components/App";
import { isShallowEqual } from "../../utils";

import "../../css/app.scss";
import "../../css/styles.scss";

import { AppProps, ExcalidrawProps } from "../../types";
import { defaultLang } from "../../i18n";
import { DEFAULT_UI_OPTIONS } from "../../constants";
import { Provider } from "jotai";
import { jotaiScope, jotaiStore } from "../../jotai";
import Footer from "../../components/footer/FooterCenter";
import MainMenu from "../../components/main-menu/MainMenu";
import WelcomeScreen from "../../components/welcome-screen/WelcomeScreen";
import LiveCollaborationTrigger from "../../components/live-collaboration/LiveCollaborationTrigger";

const ExcalidrawBase = (props: ExcalidrawProps) => {
  const {
    onChange,
    initialData,
    excalidrawAPI,
    isCollaborating = false,
    onPointerUpdate,
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
    onPointerDown,
    onScrollChange,
    children,
    validateEmbeddable,
    renderEmbeddable,
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
    <Provider unstable_createStore={() => jotaiStore} scope={jotaiScope}>
      <InitializeApp langCode={langCode} theme={theme}>
        <App
          onChange={onChange}
          initialData={initialData}
          excalidrawAPI={excalidrawAPI}
          isCollaborating={isCollaborating}
          onPointerUpdate={onPointerUpdate}
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
          onPointerDown={onPointerDown}
          onScrollChange={onScrollChange}
          validateEmbeddable={validateEmbeddable}
          renderEmbeddable={renderEmbeddable}
        >
          {children}
        </App>
      </InitializeApp>
    </Provider>
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
  isInvisiblySmallElement,
  getNonDeletedElements,
} from "../../element";
export { defaultLang, useI18n, languages } from "../../i18n";
export {
  restore,
  restoreAppState,
  restoreElements,
  restoreLibraryItems,
} from "../../data/restore";
export {
  exportToCanvas,
  exportToBlob,
  exportToSvg,
  serializeAsJSON,
  serializeLibraryAsJSON,
  loadLibraryFromBlob,
  loadFromBlob,
  loadSceneOrLibraryFromBlob,
  getFreeDrawSvgPath,
  exportToClipboard,
  mergeLibraryItems,
} from "../../packages/utils";
export { isLinearElement } from "../../element/typeChecks";

export { FONT_FAMILY, THEME, MIME_TYPES } from "../../constants";

export {
  mutateElement,
  newElementWith,
  bumpVersion,
} from "../../element/mutateElement";

export {
  parseLibraryTokensFromUrl,
  useHandleLibrary,
} from "../../data/library";

export {
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from "../../utils";

export { Sidebar } from "../../components/Sidebar/Sidebar";
export { Button } from "../../components/Button";
export { Footer };
export { MainMenu };
export { useDevice } from "../../components/App";
export { WelcomeScreen };
export { LiveCollaborationTrigger };

export { DefaultSidebar } from "../../components/DefaultSidebar";

export { normalizeLink } from "../../data/url";
export { convertToExcalidrawElements } from "../../data/transform";
export { getCommonBounds } from "../../element/bounds";

export {
  elementsOverlappingBBox,
  isElementInsideBBox,
  elementPartiallyOverlapsWithOrContainsBBox,
} from "../withinBounds";
