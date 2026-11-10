import { throttleRAF } from "@excalidraw/common";

import {
  getTargetFrame,
  isInvisiblySmallElement,
  renderElement,
  shouldApplyFrameClip,
} from "@excalidraw/element";

import {
  bootstrapCanvas,
  getNormalizedCanvasDimensions,
  snapScrollToDevicePixels,
} from "./helpers";

import { frameClip, renderSceneElements } from "./staticScene";

import type { NewElementSceneRenderConfig } from "../scene/types";

const _renderNewElementScene = ({
  canvas,
  rc,
  newElement,
  coveringElements,
  elementsMap,
  allElementsMap,
  scale,
  appState: unsnappedAppState,
  renderConfig,
}: NewElementSceneRenderConfig) => {
  if (canvas) {
    // the same whole-device-pixel scroll the static scene draws at
    const appState = snapScrollToDevicePixels(unsnappedAppState, scale);
    const [normalizedWidth, normalizedHeight] = getNormalizedCanvasDimensions(
      canvas,
      scale,
    );

    const context = bootstrapCanvas({
      canvas,
      scale,
      normalizedWidth,
      normalizedHeight,
    });

    context.save();

    // Apply zoom
    context.scale(appState.zoom.value, appState.zoom.value);

    if (
      newElement &&
      newElement.type !== "selection" &&
      // e.g. when creating arrows and we're still below the arrow drag
      // distance threshold
      // (for now we skip render only with elements while we're creating to be
      // safe)
      !isInvisiblySmallElement(newElement)
    ) {
      context.save();

      const frameId = newElement.frameId || appState.frameToHighlight?.id;

      if (
        frameId &&
        appState.frameRendering.enabled &&
        appState.frameRendering.clip
      ) {
        const frame = getTargetFrame(newElement, elementsMap, appState);

        if (
          frame &&
          shouldApplyFrameClip(newElement, frame, appState, elementsMap)
        ) {
          frameClip(frame, context, renderConfig, appState);
        }
      }

      renderElement(
        newElement,
        elementsMap,
        allElementsMap,
        rc,
        context,
        renderConfig,
        appState,
      );

      context.restore();
    }

    // the elements above a framed new element, moved off the static canvas
    // (see Renderer.getNewElementLayers). Drawn even while the new element
    // isn't, as the static canvas no longer draws them.
    if (coveringElements?.length) {
      renderSceneElements({
        context,
        rc,
        elements: coveringElements,
        elementsMap,
        allElementsMap,
        appState,
        renderConfig,
        scale,
      });
    }

    context.restore();
  }
};

type NewElementSceneThrottle = ReturnType<typeof throttleRAF>;

const newElementSceneThrottles = new WeakMap<
  HTMLCanvasElement,
  { throttle: NewElementSceneThrottle; ownerWindow: Window }
>();

// mirrors getStaticSceneThrottle (see staticScene.ts): the new element canvas
// must be scheduled on the same window's rAF as the static canvas underneath
// it, or the two layers can be painted in different frames
const getNewElementSceneThrottle = (canvas: HTMLCanvasElement) => {
  const ownerWindow = canvas.ownerDocument.defaultView ?? window;
  let entry = newElementSceneThrottles.get(canvas);
  if (entry && entry.ownerWindow !== ownerWindow) {
    entry.throttle.cancel();
    entry = undefined;
  }
  if (!entry) {
    entry = {
      throttle: throttleRAF((config: NewElementSceneRenderConfig) => {
        _renderNewElementScene(config);
      }, ownerWindow),
      ownerWindow,
    };
    newElementSceneThrottles.set(canvas, entry);
  }
  return entry.throttle;
};

/**
 * Throttled to animation framerate, one throttle per canvas, scheduled on the
 * canvas' owner window (same as the static scene).
 */
export const renderNewElementSceneThrottled = (
  config: NewElementSceneRenderConfig,
) => {
  if (!config.canvas) {
    return;
  }
  getNewElementSceneThrottle(config.canvas)(config);
};

/** Drops the canvas' pending frame; the throttle itself is dropped with the
 * canvas. */
export const cancelNewElementSceneThrottle = (canvas: HTMLCanvasElement) => {
  newElementSceneThrottles.get(canvas)?.throttle.cancel();
};

export const renderNewElementScene = (
  renderConfig: NewElementSceneRenderConfig,
  throttle?: boolean,
) => {
  if (throttle) {
    renderNewElementSceneThrottled(renderConfig);
    return;
  }

  _renderNewElementScene(renderConfig);
};
