import React, { useEffect, useRef } from "react";
import { RoughCanvas } from "roughjs/bin/canvas";
import { renderStaticScene } from "../../renderer/renderScene";
import { isShallowEqual } from "../../utils";
import type { AppState, StaticCanvasAppState } from "../../types";
import type { StaticCanvasRenderConfig } from "../../scene/types";
import type { NonDeletedExcalidrawElement } from "../../element/types";

type StaticCanvasProps = {
  canvas: HTMLCanvasElement | null;
  rc: RoughCanvas | null;
  elements: readonly NonDeletedExcalidrawElement[];
  versionNonce: number | undefined;
  selectionNonce: number | undefined;
  appState: StaticCanvasAppState;
  renderConfig: StaticCanvasRenderConfig;
  handleCanvasRef: (canvas: HTMLCanvasElement) => void;
};

const StaticCanvas = (props: StaticCanvasProps) => {
  const isComponentMounted = useRef(false);

  useEffect(() => {
    if (!isComponentMounted.current) {
      isComponentMounted.current = true;
      return;
    }
    renderStaticScene(
      {
        scale: window.devicePixelRatio,
        elements: props.elements,
        canvas: props.canvas,
        rc: props.rc!,
        appState: props.appState,
        renderConfig: props.renderConfig,
      },
      window.EXCALIDRAW_THROTTLE_NEXT_RENDER &&
        window.EXCALIDRAW_THROTTLE_RENDER === true,
    );

    if (!window.EXCALIDRAW_THROTTLE_NEXT_RENDER) {
      window.EXCALIDRAW_THROTTLE_NEXT_RENDER = true;
    }
  });

  return (
    <canvas
      className="excalidraw__canvas static"
      style={{
        width: props.appState.width,
        height: props.appState.height,
        pointerEvents: "none",
      }}
      width={props.appState.width * window.devicePixelRatio}
      height={props.appState.height * window.devicePixelRatio}
      ref={props.handleCanvasRef}
    />
  );
};

const stripIrrelevantAppStateProps = (
  appState: AppState,
): Omit<
  StaticCanvasAppState,
  | "editingElement"
  | "selectedElementIds"
  | "editingGroupId"
  | "frameToHighlight"
> => ({
  zoom: appState.zoom,
  scrollX: appState.scrollX,
  scrollY: appState.scrollY,
  width: appState.width,
  height: appState.height,
  viewModeEnabled: appState.viewModeEnabled,
  offsetLeft: appState.offsetLeft,
  offsetTop: appState.offsetTop,
  theme: appState.theme,
  pendingImageElementId: appState.pendingImageElementId,
  shouldCacheIgnoreZoom: appState.shouldCacheIgnoreZoom,
  viewBackgroundColor: appState.viewBackgroundColor,
  exportScale: appState.exportScale,
  selectedElementsAreBeingDragged: appState.selectedElementsAreBeingDragged,
  gridSize: appState.gridSize,
  frameRendering: appState.frameRendering,
});

const areEqual = (
  prevProps: StaticCanvasProps,
  nextProps: StaticCanvasProps,
) => {
  if (prevProps.versionNonce !== nextProps.versionNonce) {
    return false;
  }

  return isShallowEqual(
    // asserting AppState because we're being passed the whole AppState
    // but resolve to only the InteractiveCanvas-relevant props
    stripIrrelevantAppStateProps(prevProps.appState as AppState),
    stripIrrelevantAppStateProps(nextProps.appState as AppState),
  );
};

export default React.memo(StaticCanvas, areEqual);
