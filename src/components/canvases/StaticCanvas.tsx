import React, { useEffect, useRef } from "react";
import { RoughCanvas } from "roughjs/bin/canvas";
import { renderStaticScene } from "../../renderer/renderScene";
import { isRenderThrottlingEnabled, isShallowEqual } from "../../utils";
import type { AppState, StaticCanvasAppState } from "../../types";
import type { StaticCanvasRenderConfig } from "../../scene/types";
import type { NonDeletedExcalidrawElement } from "../../element/types";

type StaticCanvasProps = {
  canvas: HTMLCanvasElement;
  rc: RoughCanvas;
  elements: readonly NonDeletedExcalidrawElement[];
  visibleElements: readonly NonDeletedExcalidrawElement[];
  versionNonce: number | undefined;
  selectionNonce: number | undefined;
  scale: number;
  appState: StaticCanvasAppState;
  renderConfig: StaticCanvasRenderConfig;
};

const StaticCanvas = (props: StaticCanvasProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isComponentMounted = useRef(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    const canvas = props.canvas;

    if (!isComponentMounted.current) {
      isComponentMounted.current = true;

      wrapper.replaceChildren(canvas);
      canvas.classList.add("excalidraw__canvas", "static");
    }

    canvas.style.width = `${props.appState.width}px`;
    canvas.style.height = `${props.appState.height}px`;
    canvas.width = props.appState.width * props.scale;
    canvas.height = props.appState.height * props.scale;

    renderStaticScene(
      {
        canvas,
        rc: props.rc,
        scale: props.scale,
        elements: props.elements,
        visibleElements: props.visibleElements,
        appState: props.appState,
        renderConfig: props.renderConfig,
      },
      isRenderThrottlingEnabled(),
    );
  });

  return <div className="excalidraw__canvas-wrapper" ref={wrapperRef} />;
};

const getRelevantAppStateProps = (
  appState: AppState,
): StaticCanvasAppState => ({
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
  selectedElementIds: appState.selectedElementIds,
  frameToHighlight: appState.frameToHighlight,
  editingGroupId: appState.editingGroupId,
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
