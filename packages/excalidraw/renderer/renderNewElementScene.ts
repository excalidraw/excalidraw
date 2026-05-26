import { throttleRAF } from "@excalidraw/common";

import {
  getTargetFrame,
  isInvisiblySmallElement,
  renderElement,
  shouldApplyFrameClip,
} from "@excalidraw/element";

import { bootstrapCanvas, getNormalizedCanvasDimensions } from "./helpers";

import { frameClip } from "./staticScene";

import type { NewElementSceneRenderConfig } from "../scene/types";

const _renderNewElementScene = ({
  canvas,
  rc,
  newElement,
  elementsMap,
  allElementsMap,
  scale,
  appState,
  renderConfig,
  rasterPenPreview,
  eraserPreview,
}: NewElementSceneRenderConfig) => {
  if (canvas) {
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

    if (rasterPenPreview) {
      const { points, originX, originY, strokeWidth, strokeColor, opacity } =
        rasterPenPreview;

      context.save();
      context.translate(appState.scrollX, appState.scrollY);
      context.globalAlpha = opacity;
      context.strokeStyle = strokeColor;
      context.lineWidth = strokeWidth;
      context.lineCap = "round";
      context.lineJoin = "round";

      if (points.length === 1) {
        context.beginPath();
        context.arc(
          originX + points[0].dx,
          originY + points[0].dy,
          strokeWidth / 2,
          0,
          Math.PI * 2,
        );
        context.fillStyle = strokeColor;
        context.fill();
      } else if (points.length > 1) {
        context.beginPath();
        context.moveTo(originX + points[0].dx, originY + points[0].dy);
        for (let i = 1; i < points.length; i++) {
          context.lineTo(originX + points[i].dx, originY + points[i].dy);
        }
        context.stroke();
      }

      context.restore();
    } else if (newElement && newElement.type !== "selection") {
      // e.g. when creating arrows and we're still below the arrow drag distance
      // threshold
      // (for now we skip render only with elements while we're creating to be
      // safe)
      if (isInvisiblySmallElement(newElement)) {
        return;
      }

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
    } else {
      context.clearRect(0, 0, normalizedWidth, normalizedHeight);
    }

    // Render eraser preview on top of everything (shows cutout path during pixel erase)
    if (eraserPreview && eraserPreview.points.length > 0) {
      context.save();
      context.translate(appState.scrollX, appState.scrollY);
      context.globalAlpha = 0.5;
      context.fillStyle =
        appState.viewBackgroundColor === "transparent"
          ? "#ffffff"
          : appState.viewBackgroundColor;
      for (const p of eraserPreview.points) {
        context.beginPath();
        context.arc(p.x, p.y, eraserPreview.radius / 2, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }

    context.restore();
  }
};

export const renderNewElementSceneThrottled = throttleRAF(
  (config: NewElementSceneRenderConfig) => {
    _renderNewElementScene(config);
  },
);

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
