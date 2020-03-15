import { RoughCanvas } from "roughjs/bin/canvas";
import { RoughSVG } from "roughjs/bin/svg";

import { FlooredNumber, AppState } from "../types";
import { ExcalidrawElement } from "../element/types";
import { getElementAbsoluteCoords, handlerRectangles } from "../element";

import { roundRect } from "./roundRect";
import { SceneState } from "../scene/types";
import {
  getScrollBars,
  SCROLLBAR_COLOR,
  SCROLLBAR_WIDTH,
} from "../scene/scrollbars";
import { getSelectedElements } from "../scene/selection";

import { renderElement, renderElementToSvg } from "./renderElement";
import colors from "../colors";

function colorForClientId(clientId: string) {
  // Naive way of getting an integer out of the clientId
  const sum = clientId.split("").reduce((a, str) => a + str.charCodeAt(0), 0);
  return colors.elementBackground[sum % colors.elementBackground.length];
}

export function renderScene(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  selectionElement: ExcalidrawElement | null,
  scale: number,
  rc: RoughCanvas,
  canvas: HTMLCanvasElement,
  sceneState: SceneState,
  // extra options, currently passed by export helper
  {
    renderScrollbars = true,
    renderSelection = true,
    // Whether to employ render optimizations to improve performance.
    // Should not be turned on for export operations and similar, because it
    //  doesn't guarantee pixel-perfect output.
    renderOptimizations = false,
  }: {
    renderScrollbars?: boolean;
    renderSelection?: boolean;
    renderOptimizations?: boolean;
  } = {},
) {
  if (!canvas) {
    return { atLeastOneVisibleElement: false };
  }

  const context = canvas.getContext("2d")!;

  // When doing calculations based on canvas width we should used normalized one
  const normalizedCanvasWidth = canvas.width / scale;
  const normalizedCanvasHeight = canvas.height / scale;

  // Paint background
  if (typeof sceneState.viewBackgroundColor === "string") {
    const hasTransparence =
      sceneState.viewBackgroundColor === "transparent" ||
      sceneState.viewBackgroundColor.length === 5 ||
      sceneState.viewBackgroundColor.length === 9;
    if (hasTransparence) {
      context.clearRect(0, 0, normalizedCanvasWidth, normalizedCanvasHeight);
    }
    const fillStyle = context.fillStyle;
    context.fillStyle = sceneState.viewBackgroundColor;
    context.fillRect(0, 0, normalizedCanvasWidth, normalizedCanvasHeight);
    context.fillStyle = fillStyle;
  } else {
    context.clearRect(0, 0, normalizedCanvasWidth, normalizedCanvasHeight);
  }

  // Apply zoom
  const zoomTranslationX = (-normalizedCanvasWidth * (sceneState.zoom - 1)) / 2;
  const zoomTranslationY =
    (-normalizedCanvasHeight * (sceneState.zoom - 1)) / 2;
  context.translate(zoomTranslationX, zoomTranslationY);
  context.scale(sceneState.zoom, sceneState.zoom);

  // Paint visible elements
  const visibleElements = elements.filter(element =>
    isVisibleElement(
      element,
      normalizedCanvasWidth,
      normalizedCanvasHeight,
      sceneState,
    ),
  );

  visibleElements.forEach(element => {
    renderElement(element, rc, context, renderOptimizations, sceneState);
  });

  // Pain selection element
  if (selectionElement) {
    renderElement(
      selectionElement,
      rc,
      context,
      renderOptimizations,
      sceneState,
    );
  }

  // Pain selected elements
  if (renderSelection) {
    const selectedElements = getSelectedElements(elements, appState);
    const dashledLinePadding = 4 / sceneState.zoom;

    context.translate(sceneState.scrollX, sceneState.scrollY);
    selectedElements.forEach(element => {
      const [
        elementX1,
        elementY1,
        elementX2,
        elementY2,
      ] = getElementAbsoluteCoords(element);

      const elementWidth = elementX2 - elementX1;
      const elementHeight = elementY2 - elementY1;

      const initialLineDash = context.getLineDash();
      context.setLineDash([8 / sceneState.zoom, 4 / sceneState.zoom]);
      const lineWidth = context.lineWidth;
      context.lineWidth = 1 / sceneState.zoom;
      context.strokeRect(
        elementX1 - dashledLinePadding,
        elementY1 - dashledLinePadding,
        elementWidth + dashledLinePadding * 2,
        elementHeight + dashledLinePadding * 2,
      );
      context.lineWidth = lineWidth;
      context.setLineDash(initialLineDash);
    });
    context.translate(-sceneState.scrollX, -sceneState.scrollY);

    // Paint resize handlers
    if (selectedElements.length === 1 && selectedElements[0].type !== "text") {
      context.translate(sceneState.scrollX, sceneState.scrollY);
      context.fillStyle = "#fff";
      const handlers = handlerRectangles(selectedElements[0], sceneState.zoom);
      Object.values(handlers)
        .filter(handler => handler !== undefined)
        .forEach(handler => {
          const lineWidth = context.lineWidth;
          context.lineWidth = 1 / sceneState.zoom;
          context.fillRect(handler[0], handler[1], handler[2], handler[3]);
          context.strokeRect(handler[0], handler[1], handler[2], handler[3]);
          context.lineWidth = lineWidth;
        });
      context.translate(-sceneState.scrollX, -sceneState.scrollY);
    }
  }

  // Reset zoom
  context.scale(1 / sceneState.zoom, 1 / sceneState.zoom);
  context.translate(-zoomTranslationX, -zoomTranslationY);

  // Paint remote pointers
  for (const clientId in sceneState.remotePointerViewportCoords) {
    let { x, y } = sceneState.remotePointerViewportCoords[clientId];

    const width = 9;
    const height = 14;

    const isOutOfBounds =
      x < 0 ||
      x > normalizedCanvasWidth - width ||
      y < 0 ||
      y > normalizedCanvasHeight - height;

    x = Math.max(x, 0);
    x = Math.min(x, normalizedCanvasWidth - width);
    y = Math.max(y, 0);
    y = Math.min(y, normalizedCanvasHeight - height);

    const color = colorForClientId(clientId);

    const strokeStyle = context.strokeStyle;
    const fillStyle = context.fillStyle;
    const globalAlpha = context.globalAlpha;
    context.strokeStyle = color;
    context.fillStyle = color;
    if (isOutOfBounds) {
      context.globalAlpha = 0.2;
    }
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 1, y + 14);
    context.lineTo(x + 4, y + 9);
    context.lineTo(x + 9, y + 10);
    context.lineTo(x, y);
    context.fill();
    context.stroke();
    context.strokeStyle = strokeStyle;
    context.fillStyle = fillStyle;
    context.globalAlpha = globalAlpha;
  }

  // Paint scrollbars
  if (renderScrollbars) {
    const scrollBars = getScrollBars(
      elements,
      normalizedCanvasWidth,
      normalizedCanvasHeight,
      sceneState,
    );

    const fillStyle = context.fillStyle;
    const strokeStyle = context.strokeStyle;
    context.fillStyle = SCROLLBAR_COLOR;
    context.strokeStyle = "rgba(255,255,255,0.8)";
    [scrollBars.horizontal, scrollBars.vertical].forEach(scrollBar => {
      if (scrollBar) {
        roundRect(
          context,
          scrollBar.x,
          scrollBar.y,
          scrollBar.width,
          scrollBar.height,
          SCROLLBAR_WIDTH / 2,
        );
      }
    });
    context.fillStyle = fillStyle;
    context.strokeStyle = strokeStyle;
    return { atLeastOneVisibleElement: visibleElements.length > 0, scrollBars };
  }

  return { atLeastOneVisibleElement: visibleElements.length > 0 };
}

function isVisibleElement(
  element: ExcalidrawElement,
  viewportWidth: number,
  viewportHeight: number,
  {
    scrollX,
    scrollY,
    zoom,
  }: {
    scrollX: FlooredNumber;
    scrollY: FlooredNumber;
    zoom: number;
  },
) {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);

  // Apply zoom
  const viewportWidthWithZoom = viewportWidth / zoom;
  const viewportHeightWithZoom = viewportHeight / zoom;

  const viewportWidthDiff = viewportWidth - viewportWidthWithZoom;
  const viewportHeightDiff = viewportHeight - viewportHeightWithZoom;

  return (
    x2 + scrollX - viewportWidthDiff / 2 >= 0 &&
    x1 + scrollX - viewportWidthDiff / 2 <= viewportWidthWithZoom &&
    y2 + scrollY - viewportHeightDiff / 2 >= 0 &&
    y1 + scrollY - viewportHeightDiff / 2 <= viewportHeightWithZoom
  );
}

// This should be only called for exporting purposes
export function renderSceneToSvg(
  elements: readonly ExcalidrawElement[],
  rsvg: RoughSVG,
  svgRoot: SVGElement,
  {
    offsetX = 0,
    offsetY = 0,
  }: {
    offsetX?: number;
    offsetY?: number;
  } = {},
) {
  if (!svgRoot) {
    return;
  }
  // render elements
  elements.forEach(element => {
    renderElementToSvg(
      element,
      rsvg,
      svgRoot,
      element.x + offsetX,
      element.y + offsetY,
    );
  });
}
