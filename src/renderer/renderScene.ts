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
import { getZoomTranslation } from "../scene/zoom";
import { getSelectedElements } from "../scene/selection";

import { renderElement, renderElementToSvg } from "./renderElement";

export function renderScene(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  selectionElement: ExcalidrawElement | null,
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

  // Get initial scale transform as reference for later usage
  const initialContextTransform = context.getTransform();

  // When doing calculations based on canvas width we should used normalized one
  const normalizedCanvasWidth =
    canvas.width / getContextTransformScaleX(initialContextTransform);
  const normalizedCanvasHeight =
    canvas.height / getContextTransformScaleY(initialContextTransform);

  const zoomTranslation = getZoomTranslation(canvas, sceneState.zoom);
  function applyZoom(context: CanvasRenderingContext2D): void {
    context.save();

    // Handle zoom scaling
    context.setTransform(
      getContextTransformScaleX(initialContextTransform) * sceneState.zoom,
      0,
      0,
      getContextTransformScaleY(initialContextTransform) * sceneState.zoom,
      getContextTransformTranslateX(context.getTransform()),
      getContextTransformTranslateY(context.getTransform()),
    );
    // Handle zoom translation
    context.setTransform(
      getContextTransformScaleX(context.getTransform()),
      0,
      0,
      getContextTransformScaleY(context.getTransform()),
      getContextTransformTranslateX(initialContextTransform) -
        zoomTranslation.x,
      getContextTransformTranslateY(initialContextTransform) -
        zoomTranslation.y,
    );
  }
  function resetZoom(context: CanvasRenderingContext2D): void {
    context.restore();
  }

  // Paint background
  context.save();
  if (typeof sceneState.viewBackgroundColor === "string") {
    const hasTransparence =
      sceneState.viewBackgroundColor === "transparent" ||
      sceneState.viewBackgroundColor.length === 5 ||
      sceneState.viewBackgroundColor.length === 9;
    if (hasTransparence) {
      context.clearRect(0, 0, normalizedCanvasWidth, normalizedCanvasHeight);
    }
    context.fillStyle = sceneState.viewBackgroundColor;
    context.fillRect(0, 0, normalizedCanvasWidth, normalizedCanvasHeight);
  } else {
    context.clearRect(0, 0, normalizedCanvasWidth, normalizedCanvasHeight);
  }
  context.restore();

  // Paint visible elements
  const visibleElements = elements.filter(element =>
    isVisibleElement(
      element,
      normalizedCanvasWidth,
      normalizedCanvasHeight,
      sceneState,
    ),
  );

  applyZoom(context);
  visibleElements.forEach(element => {
    renderElement(element, rc, context, renderOptimizations, sceneState);
  });
  resetZoom(context);

  // Pain selection element
  if (selectionElement) {
    applyZoom(context);
    renderElement(
      selectionElement,
      rc,
      context,
      renderOptimizations,
      sceneState,
    );
    resetZoom(context);
  }

  // Pain selected elements
  if (renderSelection) {
    const selectedElements = getSelectedElements(elements, appState);
    const dashledLinePadding = 4 / sceneState.zoom;

    applyZoom(context);
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
      context.strokeRect(
        elementX1 - dashledLinePadding,
        elementY1 - dashledLinePadding,
        elementWidth + dashledLinePadding * 2,
        elementHeight + dashledLinePadding * 2,
      );
      context.setLineDash(initialLineDash);
    });
    resetZoom(context);

    // Paint resize handlers
    if (selectedElements.length === 1 && selectedElements[0].type !== "text") {
      applyZoom(context);
      context.translate(sceneState.scrollX, sceneState.scrollY);
      const handlers = handlerRectangles(selectedElements[0], sceneState.zoom);
      Object.values(handlers)
        .filter(handler => handler !== undefined)
        .forEach(handler => {
          context.strokeRect(handler[0], handler[1], handler[2], handler[3]);
        });
      resetZoom(context);
    }
  }

  // Paint scrollbars
  if (renderScrollbars) {
    const scrollBars = getScrollBars(
      elements,
      normalizedCanvasWidth,
      normalizedCanvasHeight,
      sceneState,
    );

    context.save();
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
    context.restore();
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

function getContextTransformScaleX(transform: DOMMatrix): number {
  return transform.a;
}
function getContextTransformScaleY(transform: DOMMatrix): number {
  return transform.d;
}
function getContextTransformTranslateX(transform: DOMMatrix): number {
  return transform.e;
}
function getContextTransformTranslateY(transform: DOMMatrix): number {
  return transform.f;
}
