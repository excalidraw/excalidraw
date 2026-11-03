import React, { useEffect, useRef } from "react";

import { isLinearElement } from "@excalidraw/element";
import { restoreLinearElementAnimation } from "@excalidraw/element/linearElementAnimation";

import { isShallowEqual } from "@excalidraw/common";

import type {
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { isRenderThrottlingEnabled } from "../../reactUtils";
import { renderStaticScene } from "../../renderer/staticScene";

import { LinearAnimationOverlay } from "./LinearAnimationOverlay";

import type {
  RenderableElementsMap,
  StaticCanvasRenderConfig,
} from "../../scene/types";
import type { AppState, StaticCanvasAppState } from "../../types";
import type { RoughCanvas } from "roughjs/bin/canvas";

type StaticCanvasProps = {
  canvas: HTMLCanvasElement;
  rc: RoughCanvas;
  elementsMap: RenderableElementsMap;
  allElementsMap: NonDeletedSceneElementsMap;
  visibleElements: readonly NonDeletedExcalidrawElement[];
  canvasNonce: string;
  selectionNonce: number | undefined;
  scale: number;
  appState: StaticCanvasAppState;
  renderConfig: StaticCanvasRenderConfig;
};

const StaticCanvas = (props: StaticCanvasProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isComponentMounted = useRef(false);
  const gapTime = useRef(0);

  useEffect(() => {
    props.canvas.style.width = `${props.appState.width}px`;
    props.canvas.style.height = `${props.appState.height}px`;
    props.canvas.width = props.appState.width * props.scale;
    props.canvas.height = props.appState.height * props.scale;
  }, [props.appState.height, props.appState.width, props.canvas, props.scale]);

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

    renderStaticScene(
      {
        canvas,
        rc: props.rc,
        scale: props.scale,
        elementsMap: props.elementsMap,
        allElementsMap: props.allElementsMap,
        visibleElements: props.visibleElements,
        appState: props.appState,
        renderConfig: props.renderConfig,
      },
      isRenderThrottlingEnabled(),
    );
  });

  // A traveling gap must remove the shaft itself, so render it in the canvas
  // instead of painting a background-colored patch over unrelated objects.
  useEffect(() => {
    const gaps = props.visibleElements.filter(
      (element) =>
        isLinearElement(element) &&
        restoreLinearElementAnimation(element.animation)?.type === "gap",
    );
    if (!gaps.length) {
      return;
    }
    const document = props.canvas.ownerDocument;
    const ownerWindow = document.defaultView;
    if (!ownerWindow) {
      return;
    }
    const reducedMotion = ownerWindow.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const moving = gaps.some(
      (element) =>
        isLinearElement(element) && (element.animation?.speed ?? 0) > 0,
    );
    let frame: number | undefined;
    let previousTime: number | undefined;
    let lastPaint = 0;
    const paint = (motion: boolean) =>
      renderStaticScene(
        {
          canvas: props.canvas,
          rc: props.rc,
          scale: props.scale,
          elementsMap: props.elementsMap,
          allElementsMap: props.allElementsMap,
          visibleElements: props.visibleElements,
          appState: props.appState,
          renderConfig: {
            ...props.renderConfig,
            linearAnimationTime: motion ? gapTime.current : undefined,
          },
        },
        false,
      );
    const tick = (time: number) => {
      gapTime.current += previousTime === undefined ? 0 : time - previousTime;
      previousTime = time;
      if (time - lastPaint >= 1000 / 30) {
        paint(true);
        lastPaint = time;
      }
      frame = ownerWindow.requestAnimationFrame(tick);
    };
    const update = () => {
      if (frame !== undefined) {
        ownerWindow.cancelAnimationFrame(frame);
        frame = undefined;
      }
      previousTime = undefined;
      const enabled = !document.hidden && !reducedMotion.matches;
      paint(enabled);
      if (enabled && moving) {
        frame = ownerWindow.requestAnimationFrame(tick);
      }
    };
    update();
    document.addEventListener("visibilitychange", update);
    reducedMotion.addEventListener("change", update);
    return () => {
      if (frame !== undefined) {
        ownerWindow.cancelAnimationFrame(frame);
      }
      document.removeEventListener("visibilitychange", update);
      reducedMotion.removeEventListener("change", update);
    };
  });

  return (
    <>
      <div className="excalidraw__canvas-wrapper" ref={wrapperRef} />
      <LinearAnimationOverlay
        elements={props.visibleElements}
        allElementsMap={props.allElementsMap}
        appState={props.appState}
      />
    </>
  );
};

const getRelevantAppStateProps = (appState: AppState): StaticCanvasAppState => {
  const relevantAppStateProps = {
    zoom: appState.zoom,
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    width: appState.width,
    height: appState.height,
    viewModeEnabled: appState.viewModeEnabled,
    openDialog: appState.openDialog,
    hoveredElementIds: appState.hoveredElementIds,
    offsetLeft: appState.offsetLeft,
    offsetTop: appState.offsetTop,
    theme: appState.theme,
    shouldCacheIgnoreZoom: appState.shouldCacheIgnoreZoom,
    viewBackgroundColor: appState.viewBackgroundColor,
    exportScale: appState.exportScale,
    selectedElementsAreBeingDragged: appState.selectedElementsAreBeingDragged,
    gridSize: appState.gridSize,
    gridStep: appState.gridStep,
    frameRendering: appState.frameRendering,
    selectedElementIds: appState.selectedElementIds,
    frameToHighlight: appState.frameToHighlight,
    editingGroupId: appState.editingGroupId,
    currentHoveredFontFamily: appState.currentHoveredFontFamily,
    croppingElementId: appState.croppingElementId,
    suggestedBinding: appState.suggestedBinding,
  };

  return relevantAppStateProps;
};

const areEqual = (
  prevProps: StaticCanvasProps,
  nextProps: StaticCanvasProps,
) => {
  if (
    prevProps.canvasNonce !== nextProps.canvasNonce ||
    prevProps.scale !== nextProps.scale ||
    // we need to memoize on elementsMap because they may have renewed
    // even if canvasNonce didn't change (e.g. we filter elements out based
    // on appState)
    prevProps.elementsMap !== nextProps.elementsMap ||
    prevProps.visibleElements !== nextProps.visibleElements
  ) {
    return false;
  }

  return (
    isShallowEqual(
      // asserting AppState because we're being passed the whole AppState
      // but resolve to only the StaticCanvas-relevant props
      getRelevantAppStateProps(prevProps.appState as AppState),
      getRelevantAppStateProps(nextProps.appState as AppState),
    ) && isShallowEqual(prevProps.renderConfig, nextProps.renderConfig)
  );
};

export default React.memo(StaticCanvas, areEqual);
