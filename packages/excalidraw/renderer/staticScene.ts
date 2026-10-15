import {
  applyDarkModeFilter,
  COLOR_WHITE,
  FRAME_STYLE,
  isShallowEqual,
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

import {
  getRenderElementWithPositionOverride,
  resolveElementRenderState,
  renderElement,
  regenerateDeferredZoomBitmaps,
  startZoomRegenBudget,
} from "@excalidraw/element";

import {
  getElementAbsoluteCoords,
  getElementBounds,
  getElementRenderPadding,
} from "@excalidraw/element";

import type { ElementRenderState } from "@excalidraw/element";

import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import {
  EXTERNAL_LINK_IMG,
  ELEMENT_LINK_IMG,
  getLinkHandleFromCoords,
} from "../components/hyperlink/helpers";

import {
  bootstrapCanvas,
  getNormalizedCanvasDimensions,
  snapScrollToDevicePixels,
} from "./helpers";

import type {
  StaticCanvasRenderConfig,
  StaticSceneRenderConfig,
} from "../scene/types";
import type { StaticCanvasAppState, Zoom } from "../types";

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
  scale: number,
) => {
  const offsetX = (scrollX % gridSize) - gridSize;
  const offsetY = (scrollY % gridSize) - gridSize;

  const actualGridSize = gridSize * zoom.value;

  const spaceWidth = 1 / zoom.value;

  // scene units → device pixels
  const devicePixels = zoom.value * scale;

  // A line at least a device pixel wide is drawn a whole number of device
  // pixels wide and centered to cover them exactly — on the half pixel when
  // the count is odd. Straddling a pixel boundary renders it as two lighter
  // pixels, which is how the grid looked at every zoom but 100%. Thinner
  // lines (zoomed far out) keep their sub-pixel width: their lightness is
  // the point.
  const snap = (position: number, maxWidthInCssPixels: number) => {
    // a line is `min(1 / zoom, max)` scene units wide; computed straight in
    // device pixels, so `(1 / zoom) × zoom` never lands just under 1
    const widthInDevicePixels = Math.min(
      scale,
      maxWidthInCssPixels * devicePixels,
    );
    if (widthInDevicePixels < 1) {
      return { position, lineWidth: widthInDevicePixels / devicePixels };
    }
    const wholeWidth = Math.round(widthInDevicePixels);
    const center = wholeWidth % 2 ? 0.5 : 0;
    return {
      position:
        (Math.round(position * devicePixels - center) + center) / devicePixels,
      lineWidth: wholeWidth / devicePixels,
    };
  };

  context.save();

  // vertical lines
  for (let x = offsetX; x < offsetX + width + gridSize * 2; x += gridSize) {
    const isBold =
      gridStep > 1 && Math.round(x - scrollX) % (gridStep * gridSize) === 0;
    // don't render regular lines when zoomed out and they're barely visible
    if (!isBold && actualGridSize < 10) {
      continue;
    }

    const { position, lineWidth } = snap(x, isBold ? 4 : 1);
    context.lineWidth = lineWidth;
    const lineDash = [lineWidth * 3, spaceWidth + (lineWidth + spaceWidth)];

    context.beginPath();
    context.setLineDash(isBold ? [] : lineDash);
    context.strokeStyle = isBold
      ? GridLineColor[theme].bold
      : GridLineColor[theme].regular;
    context.moveTo(position, offsetY - gridSize);
    context.lineTo(position, Math.ceil(offsetY + height + gridSize * 2));
    context.stroke();
  }

  for (let y = offsetY; y < offsetY + height + gridSize * 2; y += gridSize) {
    const isBold =
      gridStep > 1 && Math.round(y - scrollY) % (gridStep * gridSize) === 0;
    if (!isBold && actualGridSize < 10) {
      continue;
    }

    const { position, lineWidth } = snap(y, isBold ? 4 : 1);
    context.lineWidth = lineWidth;
    const lineDash = [lineWidth * 3, spaceWidth + (lineWidth + spaceWidth)];

    context.beginPath();
    context.setLineDash(isBold ? [] : lineDash);
    context.strokeStyle = isBold
      ? GridLineColor[theme].bold
      : GridLineColor[theme].regular;
    context.moveTo(offsetX - gridSize, position);
    context.lineTo(Math.ceil(offsetX + width + gridSize * 2), position);
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

type LinkIconCanvas = HTMLCanvasElement & { zoom: number };

const linkIconCanvasCache: {
  regularLink: LinkIconCanvas | null;
  elementLink: LinkIconCanvas | null;
} = {
  regularLink: null,
  elementLink: null,
};

const renderLinkIcon = (
  element: NonDeletedExcalidrawElement,
  context: CanvasRenderingContext2D,
  appState: StaticCanvasAppState,
  elementsMap: ElementsMap,
  renderState: ElementRenderState,
) => {
  if (element.link && !appState.selectedElementIds[element.id]) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    const [x, y, width, height] = getLinkHandleFromCoords(
      [
        x1 + renderState.offset.x,
        y1 + renderState.offset.y,
        x2 + renderState.offset.x,
        y2 + renderState.offset.y,
      ],
      element.angle,
      appState,
    );
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    context.save();
    context.translate(appState.scrollX + centerX, appState.scrollY + centerY);
    context.rotate(element.angle);

    const canvasKey = isElementLink(element.link)
      ? "elementLink"
      : "regularLink";

    let linkCanvas = linkIconCanvasCache[canvasKey];

    if (!linkCanvas || linkCanvas.zoom !== appState.zoom.value) {
      linkCanvas = Object.assign(document.createElement("canvas"), {
        zoom: appState.zoom.value,
      });
      linkCanvas.width = width * window.devicePixelRatio * appState.zoom.value;
      linkCanvas.height =
        height * window.devicePixelRatio * appState.zoom.value;
      linkIconCanvasCache[canvasKey] = linkCanvas;

      const linkCanvasCacheContext = linkCanvas.getContext("2d")!;
      linkCanvasCacheContext.scale(
        window.devicePixelRatio * appState.zoom.value,
        window.devicePixelRatio * appState.zoom.value,
      );

      // Seed a sane default so a corrupted color (silently rejected by the
      // canvas) falls back to white instead of a stale fillStyle.
      linkCanvasCacheContext.fillStyle = COLOR_WHITE;
      linkCanvasCacheContext.fillStyle =
        appState.viewBackgroundColor || COLOR_WHITE;

      linkCanvasCacheContext.fillRect(0, 0, width, height);

      if (canvasKey === "elementLink") {
        linkCanvasCacheContext.drawImage(ELEMENT_LINK_IMG, 0, 0, width, height);
      } else {
        linkCanvasCacheContext.drawImage(
          EXTERNAL_LINK_IMG,
          0,
          0,
          width,
          height,
        );
      }

      linkCanvasCacheContext.restore();
    }
    context.globalAlpha = renderState.opacity;
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
  appState: unsnappedAppState,
  renderConfig,
}: StaticSceneRenderConfig) => {
  if (canvas === null) {
    return;
  }

  const { renderGrid = true, isExporting } = renderConfig;
  // export draws vectors, not cached bitmaps — nothing to keep on the grid
  const appState = isExporting
    ? unsnappedAppState
    : snapScrollToDevicePixels(unsnappedAppState, scale);

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
      scale,
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

  const getRenderState = (element: ExcalidrawElement) =>
    resolveElementRenderState(
      element,
      elementsMap,
      renderConfig,
      allElementsMap,
    );

  const clipElementToFrame = (
    element: NonDeletedExcalidrawElement,
    renderState: ElementRenderState,
  ) => {
    if (
      !(element.frameId || appState.frameToHighlight?.id) ||
      !appState.frameRendering.enabled ||
      !appState.frameRendering.clip
    ) {
      return;
    }
    const targetFrame = getTargetFrame(element, elementsMap, appState);
    if (!targetFrame) {
      return;
    }
    const frameState = getRenderState(targetFrame);
    const frame = getRenderElementWithPositionOverride(
      targetFrame,
      frameState.offset,
    );
    const isTranslated = (state: ElementRenderState) =>
      state.offset.x !== 0 || state.offset.y !== 0;
    if (
      (element.frameId === frame.id &&
        (isTranslated(renderState) || isTranslated(frameState))) ||
      shouldApplyFrameClip(
        getRenderElementWithPositionOverride(element, renderState.offset),
        frame,
        appState,
        elementsMap,
        inFrameGroupsMap,
      )
    ) {
      frameClip(frame, context, renderConfig, appState);
    }
  };

  // Paint visible elements
  visibleElements
    .filter((el) => !isIframeLikeElement(el))
    .forEach((element) => {
      try {
        if (
          isTextElement(element) &&
          element.containerId &&
          elementsMap.has(element.containerId)
        ) {
          // will be rendered with the container
          return;
        }

        context.save();
        const boundTextElement = getBoundTextElement(element, elementsMap);

        const renderState = getRenderState(element);
        clipElementToFrame(element, renderState);
        renderElement(
          element,
          elementsMap,
          allElementsMap,
          rc,
          context,
          renderConfig,
          appState,
          renderState,
        );

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
          renderLinkIcon(element, context, appState, elementsMap, renderState);
        }
      } catch (error: any) {
        console.error(
          error,
          element.id,
          element.x,
          element.y,
          element.width,
          element.height,
        );
      }
    });

  // render embeddables on top
  visibleElements
    .filter((el) => isIframeLikeElement(el))
    .forEach((element) => {
      try {
        const renderState = getRenderState(element);
        context.save();
        clipElementToFrame(element, renderState);
        renderElement(
          element,
          elementsMap,
          allElementsMap,
          rc,
          context,
          renderConfig,
          appState,
          renderState,
        );

        if (
          isIframeLikeElement(element) &&
          (isExporting ||
            (isEmbeddableElement(element) &&
              renderConfig.embedsValidationStatus.get(element.id) !== true)) &&
          element.width &&
          element.height
        ) {
          const label = {
            ...createPlaceholderEmbeddableLabel(element),
            // Synthetic visual: resolve overrides and frame opacity through
            // its owner, without creating another animation target.
            id: element.id,
            frameId: element.frameId,
          };
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
          renderLinkIcon(element, context, appState, elementsMap, renderState);
        }
        context.restore();
      } catch (error: any) {
        console.error(error);
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
      console.error(error);
    }
  });
};

// last painted config per canvas: a pan paints incrementally on top of it,
// and the repaint after deferred zoom regeneration uses it so it renders the
// current scene, not the one on screen when regeneration was deferred
const lastConfigByCanvas = new WeakMap<
  HTMLCanvasElement,
  StaticSceneRenderConfig
>();
const canvasesWithDeferredZoomRegen = new Set<HTMLCanvasElement>();

// regenerate a budget's worth of stale bitmaps per frame without repainting
// (a repaint of thousands of elements costs more than the budget), then
// repaint once they're all sharp
const regenerateDeferredZoomBitmapsLoop = (ownerWindow: Window) => {
  if (regenerateDeferredZoomBitmaps()) {
    ownerWindow.requestAnimationFrame(() =>
      regenerateDeferredZoomBitmapsLoop(ownerWindow),
    );
    return;
  }
  const canvases = [...canvasesWithDeferredZoomRegen];
  canvasesWithDeferredZoomRegen.clear();
  for (const canvas of canvases) {
    const config = lastConfigByCanvas.get(canvas);
    if (config) {
      // bitmaps changed, so the last frame can't be reused
      renderOnScreenStaticScene(config, { isFullRender: true });
    }
  }
};

/** Whether the only change since the last paint is the scroll position. */
const isPanOnly = (
  prev: StaticSceneRenderConfig,
  next: StaticSceneRenderConfig,
) =>
  !!next.canvasNonce &&
  prev.canvasNonce === next.canvasNonce &&
  prev.scale === next.scale &&
  prev.rc === next.rc &&
  prev.allElementsMap === next.allElementsMap &&
  // both draw elements beyond their bounds, or depend on all visible ones
  !next.appState.frameToHighlight &&
  // grid dashes are anchored to scroll % gridSize, so they can't be shifted
  !next.renderConfig.renderGrid &&
  !next.renderConfig.elementRenderOverrides?.size &&
  isShallowEqual(prev.renderConfig, next.renderConfig) &&
  isShallowEqual(prev.appState, next.appState, {
    scrollX: () => true,
    scrollY: () => true,
  });

/** Scene-space bounds of what an element draws, label included: a label is
 *  drawn with its container and may reach well past it. */
const getElementDrawnBounds = (
  element: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
) => {
  const bounds = getElementBounds(element, elementsMap);
  const label = getBoundTextElement(element, elementsMap);
  if (!label) {
    return bounds;
  }
  const [lx1, ly1, lx2, ly2] = getElementBounds(label, elementsMap);
  return [
    Math.min(bounds[0], lx1),
    Math.min(bounds[1], ly1),
    Math.max(bounds[2], lx2),
    Math.max(bounds[3], ly2),
  ] as const;
};

/** How far an element draws past its own bounds (scene units). */
const getElementOverflow = (
  element: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
) => {
  const [x1, y1, x2, y2] = getElementBounds(element, elementsMap);
  const [dx1, dy1, dx2, dy2] = getElementDrawnBounds(element, elementsMap);
  return (
    getElementRenderPadding(element) +
    Math.max(x1 - dx1, y1 - dy1, dx2 - x2, dy2 - y2)
  );
};

/**
 * Paints a pan by moving the last frame by the scroll delta and rendering
 * only the exposed strips, so panning over thousands of visible elements
 * doesn't redraw every one of them each frame. Returns false when the pan
 * can't be painted that way.
 */
const paintPan = (
  prev: StaticSceneRenderConfig,
  config: StaticSceneRenderConfig,
) => {
  const { canvas, scale } = config;
  const prevAppState = snapScrollToDevicePixels(prev.appState, scale);
  const appState = snapScrollToDevicePixels(config.appState, scale);
  const devicePixels = appState.zoom.value * scale;
  const dx = (appState.scrollX - prevAppState.scrollX) * devicePixels;
  const dy = (appState.scrollY - prevAppState.scrollY) * devicePixels;
  const shiftX = Math.round(dx);
  const shiftY = Math.round(dy);
  if (
    // the snapped scroll keeps the delta on whole device pixels; anything
    // else would resample the last frame
    Math.abs(dx - shiftX) > 1e-3 ||
    Math.abs(dy - shiftY) > 1e-3
  ) {
    return false;
  }

  // Viewport culling uses element bounds, but elements render past them (by
  // up to their render padding): a full render leaves out, near the viewport
  // edges, what elements culled just outside it would draw. Along with the
  // exposed strips, a band along every edge is repainted, as wide as that
  // padding, so what is kept of the last frame is exactly what a full render
  // would draw.
  // Elements the pan just pushed out of view left their overflow (link icons,
  // thick strokes, arrowheads) in the kept frame, so count the previous
  // frame's elements too.
  let padding = 0;
  for (const { visibleElements, elementsMap } of [prev, config]) {
    for (const element of visibleElements) {
      padding = Math.max(padding, getElementOverflow(element, elementsMap));
    }
  }
  const band = Math.ceil(padding * devicePixels);
  const { width, height } = canvas;
  if (
    Math.abs(shiftX) + band * 2 >= width ||
    Math.abs(shiftY) + band * 2 >= height
  ) {
    return false;
  }

  // regions to repaint, in device pixels: [x, y, width, height]
  const regions: [number, number, number, number][] = [
    [0, 0, band + Math.max(shiftX, 0), height],
    [width - band + Math.min(shiftX, 0), 0, band - Math.min(shiftX, 0), height],
    [0, 0, width, band + Math.max(shiftY, 0)],
    [0, height - band + Math.min(shiftY, 0), width, band - Math.min(shiftY, 0)],
  ];
  const sceneRegions = regions.map(([x, y, w, h]) => [
    x / devicePixels - appState.scrollX,
    y / devicePixels - appState.scrollY,
    (x + w) / devicePixels - appState.scrollX,
    (y + h) / devicePixels - appState.scrollY,
  ]);
  // what a full render draws into the regions: the (culled) visible elements
  // that render into them
  const visibleElements = config.visibleElements.filter((element) => {
    const [x1, y1, x2, y2] = getElementDrawnBounds(element, config.elementsMap);
    const padding = getElementRenderPadding(element);
    return sceneRegions.some(
      ([rx1, ry1, rx2, ry2]) =>
        x1 - padding <= rx2 &&
        x2 + padding >= rx1 &&
        y1 - padding <= ry2 &&
        y2 + padding >= ry1,
    );
  });

  const context = canvas.getContext("2d")!;
  context.save();
  try {
    context.setTransform(1, 0, 0, 1, 0, 0);
    // "copy" so a transparent background doesn't blend with the old frame
    context.globalCompositeOperation = "copy";
    context.drawImage(canvas, shiftX, shiftY);
    context.globalCompositeOperation = "source-over";
    context.beginPath();
    for (const region of regions) {
      context.rect(...region);
    }
    context.clip();
    _renderStaticScene({ ...config, visibleElements });
  } finally {
    context.restore();
  }
  return true;
};

/**
 * Renders the on-screen static canvas: pans paint incrementally, and
 * zoom-stale element bitmaps are regenerated within a per-frame budget, the
 * rest on the next frames.
 */
const renderOnScreenStaticScene = (
  config: StaticSceneRenderConfig,
  { isFullRender = false } = {},
) => {
  if (config.renderConfig.isExporting || !config.canvas) {
    _renderStaticScene(config);
    return;
  }
  const prev = lastConfigByCanvas.get(config.canvas);
  lastConfigByCanvas.set(config.canvas, config);
  const endZoomRegenBudget = startZoomRegenBudget();
  let hasDeferred = false;
  try {
    const panned =
      !isFullRender &&
      prev &&
      isPanOnly(prev, config) &&
      paintPan(prev, config);
    if (!panned) {
      _renderStaticScene(config);
    }
  } finally {
    hasDeferred = endZoomRegenBudget();
  }
  const ownerWindow = config.canvas.ownerDocument.defaultView;
  if (hasDeferred && ownerWindow) {
    if (!canvasesWithDeferredZoomRegen.size) {
      ownerWindow.requestAnimationFrame(() =>
        regenerateDeferredZoomBitmapsLoop(ownerWindow),
      );
    }
    canvasesWithDeferredZoomRegen.add(config.canvas);
  }
};

/** throttled to animation framerate */
export const renderStaticSceneThrottled = throttleRAF(
  (config: StaticSceneRenderConfig) => {
    renderOnScreenStaticScene(config);
  },
);

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

  renderOnScreenStaticScene(renderConfig);
};
