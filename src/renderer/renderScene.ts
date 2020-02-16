import { RoughCanvas } from "roughjs/bin/canvas";
import { RoughSVG } from "roughjs/bin/svg";

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
  selectionElement: ExcalidrawElement | null,
  rc: RoughCanvas,
  canvas: HTMLCanvasElement,
  sceneState: SceneState,
  // extra options, currently passed by export helper
  {
    offsetX,
    offsetY,
    renderScrollbars = true,
    renderSelection = true,
  }: {
    offsetX?: number;
    offsetY?: number;
    renderScrollbars?: boolean;
    renderSelection?: boolean;
  } = {},
): boolean {
  if (!canvas) {
    return false;
  }

  // Use offsets insteads of scrolls if available
  sceneState = {
    ...sceneState,
    scrollX: typeof offsetX === "number" ? offsetX : sceneState.scrollX,
    scrollY: typeof offsetY === "number" ? offsetY : sceneState.scrollY,
  };

  const context = canvas.getContext("2d")!;

  // Get initial scale transform as reference for later usage
  const initialContextTransform = context.getTransform();

  // When doing calculations based on canvas width we should used normalized one
  const normalizedCanvasWidth =
    canvas.width / getContextTransformScaleX(initialContextTransform);
  const normalizedCanvasHeight =
    canvas.height / getContextTransformScaleY(initialContextTransform);

  // Handle zoom scaling
  function scaleContextToZoom() {
    context.setTransform(
      getContextTransformScaleX(initialContextTransform) * sceneState.zoom,
      0,
      0,
      getContextTransformScaleY(initialContextTransform) * sceneState.zoom,
      getContextTransformTranslateX(context.getTransform()),
      getContextTransformTranslateY(context.getTransform()),
    );
  }

  // Handle zoom translation
  const zoomTranslation = getZoomTranslation(canvas, sceneState.zoom);
  function translateContextToZoom() {
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

  context.save();
  scaleContextToZoom();
  translateContextToZoom();
  context.translate(sceneState.scrollX, sceneState.scrollY);
  visibleElements.forEach(element => {
    context.save();
    context.translate(element.x, element.y);
    renderElement(element, rc, context);
    context.restore();
  });
  context.restore();

  // Pain selection element
  if (selectionElement) {
    context.save();
    scaleContextToZoom();
    translateContextToZoom();
    context.translate(sceneState.scrollX, sceneState.scrollY);
    context.translate(selectionElement.x, selectionElement.y);
    renderElement(selectionElement, rc, context);
    context.restore();
  }

  // Pain selected elements
  if (renderSelection) {
    const selectedElements = getSelectedElements(elements);
    const dashledLinePadding = 4 / sceneState.zoom;

    context.save();
    scaleContextToZoom();
    translateContextToZoom();
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
    context.restore();

    // Paint resize handlers
    if (selectedElements.length === 1 && selectedElements[0].type !== "text") {
      context.save();
      scaleContextToZoom();
      translateContextToZoom();
      context.translate(sceneState.scrollX, sceneState.scrollY);
      const handlers = handlerRectangles(selectedElements[0], sceneState.zoom);
      Object.values(handlers)
        .filter(handler => handler !== undefined)
        .forEach(handler => {
          context.strokeRect(handler[0], handler[1], handler[2], handler[3]);
        });
      context.restore();
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
  }

  return visibleElements.length > 0;
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
    scrollX: number;
    scrollY: number;
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
