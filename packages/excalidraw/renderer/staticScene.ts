import {
  applyDarkModeFilter,
  COLOR_WHITE,
  FRAME_STYLE,
  THEME,
  throttleRAF,
} from "@excalidraw/common";
import { isElementLink } from "@excalidraw/element";
import { createPlaceholderEmbeddableLabel } from "@excalidraw/element";
import { getBoundTextElement } from "@excalidraw/element";
import {
  isEmbeddableElement,
  isIframeLikeElement,
  isTextElement,
} from "@excalidraw/element";
import {
  elementOverlapsWithFrame,
  getTargetFrame,
  shouldApplyFrameClip,
} from "@excalidraw/element";

import { renderElement } from "@excalidraw/element";

import { getRenderEnvironment } from "@excalidraw/element/renderEnvironment";

import { getElementAbsoluteCoords } from "@excalidraw/element";

import type { RenderEnvironment } from "@excalidraw/element/renderEnvironment";

import type {
  ElementsMap,
  ExcalidrawFrameLikeElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import {
  getExternalLinkImg,
  getElementLinkImg,
  getLinkHandleFromCoords,
  onLinkImgSettle,
} from "../components/hyperlink/helpers";

import { bootstrapCanvas, getNormalizedCanvasDimensions } from "./helpers";

import type {
  StaticCanvasRenderConfig,
  StaticSceneRenderConfig,
} from "../scene/types";
import type { StaticCanvasAppState, Zoom } from "../types";

/**
 * A render failure is per-element on purpose in the editor: one bad element
 * must not blank the whole canvas. On export the same tolerance is a trap --
 * the caller gets a silently blank or partial image with nothing but a
 * `console.error` as evidence, so exports fail loudly instead.
 */
const handleElementRenderError = (
  error: unknown,
  element: NonDeletedExcalidrawElement,
  isExporting: boolean,
) => {
  if (isExporting) {
    throw error;
  }
  console.error(
    error,
    element.id,
    element.x,
    element.y,
    element.width,
    element.height,
  );
};

const GridLineColor = {
  [THEME.LIGHT]: {
    bold: "#dddddd",
    regular: "#e5e5e5",
  },
  [THEME.DARK]: {
    bold: applyDarkModeFilter("#dddddd"),
    regular: applyDarkModeFilter("#e5e5e5"),
  },
} as const;

const strokeGrid = (
  context: CanvasRenderingContext2D,
  /** grid cell pixel size */
  gridSize: number,
  /** setting to 1 will disble bold lines */
  gridStep: number,
  scrollX: number,
  scrollY: number,
  zoom: Zoom,
  theme: StaticCanvasRenderConfig["theme"],
  width: number,
  height: number,
) => {
  const offsetX = (scrollX % gridSize) - gridSize;
  const offsetY = (scrollY % gridSize) - gridSize;

  const actualGridSize = gridSize * zoom.value;

  const spaceWidth = 1 / zoom.value;

  context.save();

  // Offset rendering by 0.5 to ensure that 1px wide lines are crisp.
  // We only do this when zoomed to 100% because otherwise the offset is
  // fractional, and also visibly offsets the elements.
  // We also do this per-axis, as each axis may already be offset by 0.5.
  if (zoom.value === 1) {
    context.translate(offsetX % 1 ? 0 : 0.5, offsetY % 1 ? 0 : 0.5);
  }

  // vertical lines
  for (let x = offsetX; x < offsetX + width + gridSize * 2; x += gridSize) {
    const isBold =
      gridStep > 1 && Math.round(x - scrollX) % (gridStep * gridSize) === 0;
    // don't render regular lines when zoomed out and they're barely visible
    if (!isBold && actualGridSize < 10) {
      continue;
    }

    const lineWidth = Math.min(1 / zoom.value, isBold ? 4 : 1);
    context.lineWidth = lineWidth;
    const lineDash = [lineWidth * 3, spaceWidth + (lineWidth + spaceWidth)];

    context.beginPath();
    context.setLineDash(isBold ? [] : lineDash);
    context.strokeStyle = isBold
      ? GridLineColor[theme].bold
      : GridLineColor[theme].regular;
    context.moveTo(x, offsetY - gridSize);
    context.lineTo(x, Math.ceil(offsetY + height + gridSize * 2));
    context.stroke();
  }

  for (let y = offsetY; y < offsetY + height + gridSize * 2; y += gridSize) {
    const isBold =
      gridStep > 1 && Math.round(y - scrollY) % (gridStep * gridSize) === 0;
    if (!isBold && actualGridSize < 10) {
      continue;
    }

    const lineWidth = Math.min(1 / zoom.value, isBold ? 4 : 1);
    context.lineWidth = lineWidth;
    const lineDash = [lineWidth * 3, spaceWidth + (lineWidth + spaceWidth)];

    context.beginPath();
    context.setLineDash(isBold ? [] : lineDash);
    context.strokeStyle = isBold
      ? GridLineColor[theme].bold
      : GridLineColor[theme].regular;
    context.moveTo(offsetX - gridSize, y);
    context.lineTo(Math.ceil(offsetX + width + gridSize * 2), y);
    context.stroke();
  }
  context.restore();
};

export const frameClip = (
  frame: ExcalidrawFrameLikeElement,
  context: CanvasRenderingContext2D,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState,
) => {
  context.translate(frame.x + appState.scrollX, frame.y + appState.scrollY);
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(
      0,
      0,
      frame.width,
      frame.height,
      FRAME_STYLE.radius / appState.zoom.value,
    );
  } else {
    context.rect(0, 0, frame.width, frame.height);
  }
  context.clip();
  context.translate(
    -(frame.x + appState.scrollX),
    -(frame.y + appState.scrollY),
  );
};

// Backing-store scale is per static scene instance (e.g. per-window DPR),
// so key on it with zoom; a shared single-slot cache would serve one
// instance's canvas to another at the wrong resolution.
type LinkIconCanvasCacheType = "regularLink" | "elementLink";

const linkIconCanvasCache = new WeakMap<
  RenderEnvironment,
  Map<string, HTMLCanvasElement>
>();
const LINK_ICON_CACHE_MAX_ENTRIES = 8;

const getLinkIconCacheKey = (
  type: LinkIconCanvasCacheType,
  zoom: number,
  scale: number,
) => `${type}:${zoom}:${scale}`;

// One live-config pointer per environment, so a settle in one environment
// only re-renders its own scene. A single shared pointer would re-render the
// last-rendered scene on any settle, leaving other environments with blank
// cached icons (e.g. main editor + popout).
const lastSceneConfigs = new WeakMap<
  RenderEnvironment,
  StaticSceneRenderConfig
>();

// Icons bake into the cache in the same task the images start decoding, so
// the first bake is blank. Drop that environment's cache and repaint its own
// scene once one of its images settles.
onLinkImgSettle((renderEnvironment) => {
  const lastSceneConfig = lastSceneConfigs.get(renderEnvironment);
  if (lastSceneConfig) {
    linkIconCanvasCache.delete(renderEnvironment);
    renderStaticScene(lastSceneConfig);
  }
});

const renderLinkIcon = (
  element: NonDeletedExcalidrawElement,
  context: CanvasRenderingContext2D,
  appState: StaticCanvasAppState,
  elementsMap: ElementsMap,
  /** backing-store scale, see StaticCanvasRenderConfig["scale"] */
  scale: number,
  renderEnvironment: RenderEnvironment,
) => {
  if (element.link && !appState.selectedElementIds[element.id]) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    const [x, y, width, height] = getLinkHandleFromCoords(
      [x1, y1, x2, y2],
      element.angle,
      appState,
    );
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    context.save();
    context.translate(appState.scrollX + centerX, appState.scrollY + centerY);
    context.rotate(element.angle);

    const canvasKey: LinkIconCanvasCacheType = isElementLink(element.link)
      ? "elementLink"
      : "regularLink";

    const cacheKey = getLinkIconCacheKey(canvasKey, appState.zoom.value, scale);

    let cache = linkIconCanvasCache.get(renderEnvironment);
    let linkCanvas = cache?.get(cacheKey);

    if (!linkCanvas) {
      linkCanvas = renderEnvironment.createCanvas();
      linkCanvas.width = width * scale * appState.zoom.value;
      linkCanvas.height = height * scale * appState.zoom.value;
      if (!cache) {
        cache = new Map();
        linkIconCanvasCache.set(renderEnvironment, cache);
      }
      cache.set(cacheKey, linkCanvas);
      if (cache.size > LINK_ICON_CACHE_MAX_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) {
          cache.delete(oldestKey);
        }
      }

      const linkCanvasCacheContext = linkCanvas.getContext("2d")!;
      linkCanvasCacheContext.scale(
        scale * appState.zoom.value,
        scale * appState.zoom.value,
      );

      // Seed a sane default so a corrupted color (silently rejected by the
      // canvas) falls back to white instead of a stale fillStyle.
      linkCanvasCacheContext.fillStyle = COLOR_WHITE;
      linkCanvasCacheContext.fillStyle =
        appState.viewBackgroundColor || COLOR_WHITE;

      linkCanvasCacheContext.fillRect(0, 0, width, height);

      const linkImg =
        canvasKey === "elementLink"
          ? getElementLinkImg(renderEnvironment)
          : getExternalLinkImg(renderEnvironment);
      // undecoded images are silently skipped by drawImage
      if (linkImg.drawReady) {
        linkCanvasCacheContext.drawImage(linkImg.img, 0, 0, width, height);
      }

      linkCanvasCacheContext.restore();
    }
    context.globalAlpha = element.opacity / 100;
    context.drawImage(linkCanvas, x - centerX, y - centerY, width, height);
    context.restore();
  }
};
const _renderStaticScene = ({
  canvas,
  rc,
  elementsMap,
  allElementsMap,
  visibleElements,
  scale,
  appState,
  renderConfig,
}: StaticSceneRenderConfig) => {
  if (canvas === null) {
    return;
  }

  lastSceneConfigs.set(getRenderEnvironment(renderConfig.renderEnvironment), {
    canvas,
    rc,
    elementsMap,
    allElementsMap,
    visibleElements,
    scale,
    appState,
    renderConfig,
  });

  const { renderGrid = true, isExporting } = renderConfig;

  const [normalizedWidth, normalizedHeight] = getNormalizedCanvasDimensions(
    canvas,
    scale,
  );

  const context = bootstrapCanvas({
    canvas,
    scale,
    normalizedWidth,
    normalizedHeight,
    theme: appState.theme,
    isExporting,
    viewBackgroundColor: appState.viewBackgroundColor,
  });

  // Apply zoom
  context.scale(appState.zoom.value, appState.zoom.value);

  // Grid
  if (renderGrid) {
    strokeGrid(
      context,
      appState.gridSize,
      appState.gridStep,
      appState.scrollX,
      appState.scrollY,
      appState.zoom,
      renderConfig.theme,
      normalizedWidth / appState.zoom.value,
      normalizedHeight / appState.zoom.value,
    );
  }

  const groupsToBeAddedToFrame = new Set<string>();

  visibleElements.forEach((element) => {
    if (
      element.groupIds.length > 0 &&
      appState.frameToHighlight &&
      appState.selectedElementIds[element.id] &&
      (elementOverlapsWithFrame(
        element,
        appState.frameToHighlight,
        elementsMap,
      ) ||
        element.groupIds.find((groupId) => groupsToBeAddedToFrame.has(groupId)))
    ) {
      element.groupIds.forEach((groupId) =>
        groupsToBeAddedToFrame.add(groupId),
      );
    }
  });

  const inFrameGroupsMap = new Map<string, boolean>();

  // Paint visible elements
  visibleElements
    .filter((el) => !isIframeLikeElement(el))
    .forEach((element) => {
      try {
        const frameId = element.frameId || appState.frameToHighlight?.id;

        if (
          isTextElement(element) &&
          element.containerId &&
          elementsMap.has(element.containerId)
        ) {
          // will be rendered with the container
          return;
        }

        context.save();

        if (
          frameId &&
          appState.frameRendering.enabled &&
          appState.frameRendering.clip
        ) {
          const frame = getTargetFrame(element, elementsMap, appState);
          if (
            frame &&
            shouldApplyFrameClip(
              element,
              frame,
              appState,
              elementsMap,
              inFrameGroupsMap,
            )
          ) {
            frameClip(frame, context, renderConfig, appState);
          }
          renderElement(
            element,
            elementsMap,
            allElementsMap,
            rc,
            context,
            renderConfig,
            appState,
          );
        } else {
          renderElement(
            element,
            elementsMap,
            allElementsMap,
            rc,
            context,
            renderConfig,
            appState,
          );
        }

        const boundTextElement = getBoundTextElement(element, elementsMap);
        if (boundTextElement) {
          renderElement(
            boundTextElement,
            elementsMap,
            allElementsMap,
            rc,
            context,
            renderConfig,
            appState,
          );
        }

        context.restore();

        if (!isExporting && renderConfig.renderLinks !== false) {
          renderLinkIcon(
            element,
            context,
            appState,
            elementsMap,
            scale,
            getRenderEnvironment(renderConfig.renderEnvironment),
          );
        }
      } catch (error: any) {
        handleElementRenderError(error, element, isExporting);
      }
    });

  // render embeddables on top
  visibleElements
    .filter((el) => isIframeLikeElement(el))
    .forEach((element) => {
      try {
        const render = () => {
          renderElement(
            element,
            elementsMap,
            allElementsMap,
            rc,
            context,
            renderConfig,
            appState,
          );

          if (
            isIframeLikeElement(element) &&
            (isExporting ||
              (isEmbeddableElement(element) &&
                renderConfig.embedsValidationStatus.get(element.id) !==
                  true)) &&
            element.width &&
            element.height
          ) {
            const label = createPlaceholderEmbeddableLabel(element);
            renderElement(
              label,
              elementsMap,
              allElementsMap,
              rc,
              context,
              renderConfig,
              appState,
            );
          }
          if (!isExporting && renderConfig.renderLinks !== false) {
            renderLinkIcon(
              element,
              context,
              appState,
              elementsMap,
              scale,
              getRenderEnvironment(renderConfig.renderEnvironment),
            );
          }
        };
        // - when exporting the whole canvas, we DO NOT apply clipping
        // - when we are exporting a particular frame, apply clipping
        //   if the containing frame is not selected, apply clipping
        const frameId = element.frameId || appState.frameToHighlight?.id;

        if (
          frameId &&
          appState.frameRendering.enabled &&
          appState.frameRendering.clip
        ) {
          context.save();

          const frame = getTargetFrame(element, elementsMap, appState);

          if (
            frame &&
            shouldApplyFrameClip(
              element,
              frame,
              appState,
              elementsMap,
              inFrameGroupsMap,
            )
          ) {
            frameClip(frame, context, renderConfig, appState);
          }
          render();
          context.restore();
        } else {
          render();
        }
      } catch (error: any) {
        handleElementRenderError(error, element, isExporting);
      }
    });

  // render pending nodes for flowcharts
  renderConfig.pendingFlowchartNodes?.forEach((element) => {
    try {
      renderElement(
        element,
        elementsMap,
        allElementsMap,
        rc,
        context,
        renderConfig,
        appState,
      );
    } catch (error) {
      handleElementRenderError(error, element, isExporting);
    }
  });
};

type StaticSceneThrottle = ReturnType<typeof throttleRAF>;

const staticSceneThrottles = new WeakMap<
  HTMLCanvasElement,
  { throttle: StaticSceneThrottle; ownerWindow: Window }
>();

const getStaticSceneThrottle = (canvas: HTMLCanvasElement) => {
  const ownerWindow = canvas.ownerDocument.defaultView ?? window;
  let entry = staticSceneThrottles.get(canvas);
  // the owner window is captured when the throttle is built, so a canvas
  // adopted into another document (moved rather than remounted) would keep
  // scheduling on the old window's rAF -- which never fires once that window
  // is closed. rebuild whenever the owner window no longer matches.
  if (entry && entry.ownerWindow !== ownerWindow) {
    entry.throttle.cancel();
    entry = undefined;
  }
  if (!entry) {
    entry = {
      throttle: throttleRAF((config: StaticSceneRenderConfig) => {
        _renderStaticScene(config);
      }, ownerWindow),
      ownerWindow,
    };
    staticSceneThrottles.set(canvas, entry);
  }
  return entry.throttle;
};

/**
 * Throttled to animation framerate, one throttle per canvas. A shared
 * throttle drops all but the last caller's pending frame when multiple
 * editors render in the same frame, and a module-realm scheduler would run
 * popout renders on the main window's rAF, which freezes while that window
 * is hidden.
 */
export const renderStaticSceneThrottled = (config: StaticSceneRenderConfig) => {
  getStaticSceneThrottle(config.canvas)(config);
};

/** Drops the canvas' pending frame; the throttle itself is dropped with the
 * canvas. */
export const cancelStaticSceneThrottle = (canvas: HTMLCanvasElement) => {
  staticSceneThrottles.get(canvas)?.throttle.cancel();
};

/**
 * Static scene is the non-ui canvas where we render elements.
 */
export const renderStaticScene = (
  renderConfig: StaticSceneRenderConfig,
  throttle?: boolean,
) => {
  if (throttle) {
    renderStaticSceneThrottled(renderConfig);
    return;
  }

  _renderStaticScene(renderConfig);
};
