import React, { useEffect, forwardRef } from "react";

import { InitializeApp } from "../../components/InitializeApp";
import App, { ExcalidrawImperativeAPI } from "../../components/App";

import "../../css/app.scss";
import "../../css/styles.scss";

import { ExcalidrawProps } from "../../types";
import { IsMobileProvider } from "../../is-mobile";
import { noop } from "../../utils";

const Excalidraw = (props: ExcalidrawProps) => {
  const {
    width,
    height,
    offsetLeft,
    offsetTop,
    onChangeEmitter,
    initialData,
    user,
    forwardedRef,
    onCollabButtonClick = noop,
    isCollaborating,
    onPointerUpdate,
    collaborators,
    initializeScene,
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
    <InitializeApp>
      <IsMobileProvider>
        <App
          width={width}
          height={height}
          offsetLeft={offsetLeft}
          offsetTop={offsetTop}
          onChangeEmitter={onChangeEmitter}
          initialData={initialData}
          user={user}
          forwardedRef={forwardedRef}
          onCollabButtonClick={onCollabButtonClick}
          isCollaborating={isCollaborating}
          onPointerUpdate={onPointerUpdate}
          collaborators={collaborators}
          initializeScene={initializeScene}
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
  const { initialData: prevInitialData, user: prevUser, ...prev } = prevProps;
  const { initialData: nextInitialData, user: nextUser, ...next } = nextProps;

  const prevKeys = Object.keys(prevProps) as (keyof typeof prev)[];
  const nextKeys = Object.keys(nextProps) as (keyof typeof next)[];

  return (
    prevUser?.name === nextUser?.name &&
    prevKeys.length === nextKeys.length &&
    prevKeys.every((key) => prev[key] === next[key])
  );
};

const forwardedRefComp = forwardRef<
  ExcalidrawImperativeAPI,
  PublicExcalidrawProps
>((props, ref) => <Excalidraw {...props} forwardedRef={ref} />);
export default React.memo(forwardedRefComp, areEqual);
export {
  getSceneVersion,
  getSyncableElements,
  getElementMap,
} from "../../element";
