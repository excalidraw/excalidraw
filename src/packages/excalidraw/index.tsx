import React, { useEffect, forwardRef } from "react";
import "./publicPath";

import { InitializeApp } from "../../components/InitializeApp";
import App from "../../components/App";

import "../../css/app.scss";
import "../../css/styles.scss";

import { ExcalidrawAPIRefValue, ExcalidrawProps } from "../../types";
import { IsMobileProvider } from "../../is-mobile";
import { defaultLang } from "../../i18n";

const Excalidraw = (props: ExcalidrawProps) => {
  const {
    width,
    height,
    offsetLeft,
    offsetTop,
    onChange,
    initialData,
    excalidrawRef,
    onCollabButtonClick,
    isCollaborating,
    onPointerUpdate,
    onExportToBackend,
    renderFooter,
    langCode = defaultLang.code,
    viewModeEnabled,
    zenModeEnabled,
    gridModeEnabled,
  } = props;

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
    <InitializeApp langCode={langCode}>
      <IsMobileProvider>
        <App
          width={width}
          height={height}
          offsetLeft={offsetLeft}
          offsetTop={offsetTop}
          onChange={onChange}
          initialData={initialData}
          excalidrawRef={excalidrawRef}
          onCollabButtonClick={onCollabButtonClick}
          isCollaborating={isCollaborating}
          onPointerUpdate={onPointerUpdate}
          onExportToBackend={onExportToBackend}
          renderFooter={renderFooter}
          langCode={langCode}
          viewModeEnabled={viewModeEnabled}
          zenModeEnabled={zenModeEnabled}
          gridModeEnabled={gridModeEnabled}
        />
      </IsMobileProvider>
    </InitializeApp>
  );
};

type PublicExcalidrawProps = Omit<ExcalidrawProps, "forwardedRef">;

const areEqual = (
  prevProps: PublicExcalidrawProps,
  nextProps: PublicExcalidrawProps,
) => {
  const { initialData: prevInitialData, ...prev } = prevProps;
  const { initialData: nextInitialData, ...next } = nextProps;

  const prevKeys = Object.keys(prevProps) as (keyof typeof prev)[];
  const nextKeys = Object.keys(nextProps) as (keyof typeof next)[];
  return (
    prevKeys.length === nextKeys.length &&
    prevKeys.every((key) => prev[key] === next[key])
  );
};

Excalidraw.defaultProps = {
  lanCode: defaultLang.code,
};

const forwardedRefComp = forwardRef<
  ExcalidrawAPIRefValue,
  PublicExcalidrawProps
>((props, ref) => <Excalidraw {...props} excalidrawRef={ref} />);
export default React.memo(forwardedRefComp, areEqual);
export {
  getSceneVersion,
  getSyncableElements,
  getElementMap,
} from "../../element";
export { defaultLang, languages } from "../../i18n";
export { restore, restoreAppState, restoreElements } from "../../data/restore";
