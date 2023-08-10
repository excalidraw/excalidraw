import React, { useEffect, useRef } from "react";
import { RoughCanvas } from "roughjs/bin/canvas";
import { renderStaticScene } from "../../renderer/renderScene";
import { isRenderThrottlingEnabled, isShallowEqual } from "../../utils";
import type { AppState, StaticCanvasAppState } from "../../types";
import type { StaticCanvasRenderConfig } from "../../scene/types";
import type { NonDeletedExcalidrawElement } from "../../element/types";

type StaticCanvasProps = {
  canvas: HTMLCanvasElement | null;
  rc: RoughCanvas | null;
  elements: readonly NonDeletedExcalidrawElement[];
  visibleElements: readonly NonDeletedExcalidrawElement[];
  versionNonce: number | undefined;
  selectionNonce: number | undefined;
  scale: number;
  appState: StaticCanvasAppState;
  renderConfig: StaticCanvasRenderConfig;
  handleCanvasRef: (canvas: HTMLCanvasElement | null) => void;
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
        canvas: props.canvas,
        rc: props.rc!,
        scale: props.scale,
        elements: props.elements,
        visibleElements: props.visibleElements,
        appState: props.appState,
        renderConfig: props.renderConfig,
      },
      isRenderThrottlingEnabled(),
    );
  });

  return (
    <canvas
      className="excalidraw__canvas static"
      style={{
        width: props.appState.width,
        height: props.appState.height,
        pointerEvents: "none",
      }}
      width={props.appState.width * props.scale}
      height={props.appState.height * props.scale}
      ref={props.handleCanvasRef}
    />
  );
};

const getRelevantAppStateProps = (
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
  if (
    prevProps.versionNonce !== nextProps.versionNonce ||
    prevProps.scale !== nextProps.scale ||
    // we need to memoize on element arrays because they may have renewed
    // even if versionNonce didn't change (e.g. we filter elements out based
    // on appState)
    prevProps.elements !== nextProps.elements ||
    prevProps.visibleElements !== nextProps.visibleElements
  ) {
    return false;
  }

  return isShallowEqual(
    // asserting AppState because we're being passed the whole AppState
    // but resolve to only the StaticCanvas-relevant props
    getRelevantAppStateProps(prevProps.appState as AppState),
    getRelevantAppStateProps(nextProps.appState as AppState),
  );
};

export default React.memo(StaticCanvas, areEqual);
