import React, { useEffect, forwardRef } from "react";
import { InitializeApp } from "../../components/InitializeApp";
import App from "../../components/App";

import "../../css/app.scss";
import "../../css/styles.scss";

import { AppProps, ExcalidrawAPIRefValue, ExcalidrawProps } from "../../types";
import { defaultLang } from "../../i18n";
import { DEFAULT_UI_OPTIONS } from "../../constants";
import { Provider } from "jotai";
import { jotaiScope, jotaiStore } from "../../jotai";

const ExcalidrawBase = (props: ExcalidrawProps) => {
  const {
    onChange,
    initialData,
    excalidrawRef,
    onCollabButtonClick,
    isCollaborating = false,
    onPointerUpdate,
    renderTopRightUI,
    renderFooter,
    renderSidebar,
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
  } = props;

  const canvasActions = props.UIOptions?.canvasActions;

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
    <InitializeApp langCode={langCode} theme={theme}>
      <Provider unstable_createStore={() => jotaiStore} scope={jotaiScope}>
        <App
          onChange={onChange}
          initialData={initialData}
          excalidrawRef={excalidrawRef}
          onCollabButtonClick={onCollabButtonClick}
          isCollaborating={isCollaborating}
          onPointerUpdate={onPointerUpdate}
          renderTopRightUI={renderTopRightUI}
          renderFooter={renderFooter}
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
          renderSidebar={renderSidebar}
        />
      </Provider>
    </InitializeApp>
  );
};

type PublicExcalidrawProps = Omit<ExcalidrawProps, "forwardedRef">;

const areEqual = (
  prevProps: PublicExcalidrawProps,
  nextProps: PublicExcalidrawProps,
) => {
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
      canvasOptionKeys.every((key) => {
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
    return true;
  });

  const prevKeys = Object.keys(prevProps) as (keyof typeof prev)[];
  const nextKeys = Object.keys(nextProps) as (keyof typeof next)[];
  return (
    isUIOptionsSame &&
    prevKeys.length === nextKeys.length &&
    prevKeys.every((key) => prev[key] === next[key])
  );
};

const forwardedRefComp = forwardRef<
  ExcalidrawAPIRefValue,
  PublicExcalidrawProps
>((props, ref) => <ExcalidrawBase {...props} excalidrawRef={ref} />);

export const Excalidraw = React.memo(forwardedRefComp, areEqual);
Excalidraw.displayName = "Excalidraw";

export {
  getSceneVersion,
  isInvisiblySmallElement,
  getNonDeletedElements,
} from "../../element";
export { defaultLang, languages } from "../../i18n";
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
