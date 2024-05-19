import { FRAME_STYLE } from "../constants";
import { getElementAbsoluteCoords } from "../element";

import {
  elementOverlapsWithFrame,
  getTargetFrame,
  isElementInFrame,
} from "../frame";
import {
  isEmbeddableElement,
  isIframeLikeElement,
  isTextElement,
} from "../element/typeChecks";
import { renderElement } from "../renderer/renderElement";
import { createPlaceholderEmbeddableLabel } from "../element/embeddable";
import type { StaticCanvasAppState, Zoom } from "../types";
import type {
  ElementsMap,
  ExcalidrawFrameLikeElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import type {
  StaticCanvasRenderConfig,
  StaticSceneRenderConfig,
} from "../scene/types";
import {
  EXTERNAL_LINK_IMG,
  getLinkHandleFromCoords,
} from "../components/hyperlink/helpers";
import { bootstrapCanvas, getNormalizedCanvasDimensions } from "./helpers";
import { throttleRAF } from "../utils";
import { getBoundTextElement } from "../element/textElement";

const strokeGrid = (
  context: CanvasRenderingContext2D,
  gridSize: number,
  scrollX: number,
  scrollY: number,
  zoom: Zoom,
  width: number,
  height: number,
) => {
  const BOLD_LINE_FREQUENCY = 5;

  enum GridLineColor {
    Bold = "#cccccc",
    Regular = "#e5e5e5",
  }

  const offsetX =
    -Math.round(zoom.value / gridSize) * gridSize + (scrollX % gridSize);
  const offsetY =
    -Math.round(zoom.value / gridSize) * gridSize + (scrollY % gridSize);

  const lineWidth = Math.min(1 / zoom.value, 1);

  const spaceWidth = 1 / zoom.value;
  const lineDash = [lineWidth * 3, spaceWidth + (lineWidth + spaceWidth)];

  context.save();
  context.lineWidth = lineWidth;

  for (let x = offsetX; x < offsetX + width + gridSize * 2; x += gridSize) {
    const isBold =
      Math.round(x - scrollX) % (BOLD_LINE_FREQUENCY * gridSize) === 0;
    context.beginPath();
    context.setLineDash(isBold ? [] : lineDash);
    context.strokeStyle = isBold ? GridLineColor.Bold : GridLineColor.Regular;
    context.moveTo(x, offsetY - gridSize);
    context.lineTo(x, offsetY + height + gridSize * 2);
    context.stroke();
  }
  for (let y = offsetY; y < offsetY + height + gridSize * 2; y += gridSize) {
    const isBold =
      Math.round(y - scrollY) % (BOLD_LINE_FREQUENCY * gridSize) === 0;
    context.beginPath();
    context.setLineDash(isBold ? [] : lineDash);
    context.strokeStyle = isBold ? GridLineColor.Bold : GridLineColor.Regular;
    context.moveTo(offsetX - gridSize, y);
    context.lineTo(offsetX + width + gridSize * 2, y);
    context.stroke();
  }
  context.restore();
};

const frameClip = (
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

let linkCanvasCache: any;
const renderLinkIcon = (
  element: NonDeletedExcalidrawElement,
  context: CanvasRenderingContext2D,
  appState: StaticCanvasAppState,
  elementsMap: ElementsMap,
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

    if (!linkCanvasCache || linkCanvasCache.zoom !== appState.zoom.value) {
      linkCanvasCache = document.createElement("canvas");
      linkCanvasCache.zoom = appState.zoom.value;
      linkCanvasCache.width =
        width * window.devicePixelRatio * appState.zoom.value;
      linkCanvasCache.height =
        height * window.devicePixelRatio * appState.zoom.value;
      const linkCanvasCacheContext = linkCanvasCache.getContext("2d")!;
      linkCanvasCacheContext.scale(
        window.devicePixelRatio * appState.zoom.value,
        window.devicePixelRatio * appState.zoom.value,
      );
      linkCanvasCacheContext.fillStyle = "#fff";
      linkCanvasCacheContext.fillRect(0, 0, width, height);
      linkCanvasCacheContext.drawImage(EXTERNAL_LINK_IMG, 0, 0, width, height);
      linkCanvasCacheContext.restore();
      context.drawImage(
        linkCanvasCache,
        x - centerX,
        y - centerY,
        width,
        height,
      );
    } else {
      context.drawImage(
        linkCanvasCache,
        x - centerX,
        y - centerY,
        width,
        height,
      );
    }
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
  if (renderGrid && appState.gridSize) {
    strokeGrid(
      context,
      appState.gridSize,
      appState.scrollX,
      appState.scrollY,
      appState.zoom,
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

          // TODO do we need to check isElementInFrame here?
          if (frame && isElementInFrame(element, elementsMap, appState)) {
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

        if (!isExporting) {
          renderLinkIcon(element, context, appState, elementsMap);
        }
      } catch (error: any) {
        console.error(error);
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
          if (!isExporting) {
            renderLinkIcon(element, context, appState, elementsMap);
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

          if (frame && isElementInFrame(element, elementsMap, appState)) {
            frameClip(frame, context, renderConfig, appState);
          }
          render();
          context.restore();
        } else {
          render();
        }
      } catch (error: any) {
        console.error(error);
      }
    });
};

/** throttled to animation framerate */
export const renderStaticSceneThrottled = throttleRAF(
  (config: StaticSceneRenderConfig) => {
    _renderStaticScene(config);
  },
  { trailing: true },
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

  _renderStaticScene(renderConfig);
};
