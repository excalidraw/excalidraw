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

  // Handle context scaling for zoom
  const contextScale = context.getTransform().a;
  function scaleContextToZoom() {
    context.setTransform(
      contextScale * sceneState.zoom,
      0,
      0,
      contextScale * sceneState.zoom,
      0,
      0,
    );
  }
  function resetContextScale() {
    context.setTransform(contextScale, 0, 0, contextScale, 0, 0);
  }

  // When drawing elements on the canvas that take full width of height we should not take into account the scale
  const normalizedCanvasWidth = canvas.width / contextScale;
  const normalizedCanvasHeight = canvas.height / contextScale;

  // Helpers for transforming coordinates based on scene state
  function getXPositionWithSceneState(x: number): number {
    return (x + sceneState.scrollX) * sceneState.zoom;
  }
  function getYPositionWithSceneState(y: number): number {
    return (y + sceneState.scrollY) * sceneState.zoom;
  }

  // Paint background
  const fillStyle = context.fillStyle;
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
  context.fillStyle = fillStyle;

  // Paint visible elements
  const visibleElements = elements.filter(element =>
    isVisibleElement(element, normalizedCanvasWidth, normalizedCanvasHeight, {
      scrollX: sceneState.scrollX,
      scrollY: sceneState.scrollY,
      zoom: sceneState.zoom,
    }),
  );
  scaleContextToZoom();
  visibleElements.forEach(element => {
    context.translate(
      element.x + sceneState.scrollX,
      element.y + sceneState.scrollY,
    );
    renderElement(element, rc, context);
    context.translate(
      -element.x - sceneState.scrollX,
      -element.y - sceneState.scrollY,
    );
  });
  resetContextScale();

  // Pain selection element
  if (selectionElement) {
    context.translate(
      selectionElement.x + sceneState.scrollX,
      selectionElement.y + sceneState.scrollY,
    );
    renderElement(selectionElement, rc, context);
    context.translate(
      -selectionElement.x - sceneState.scrollX,
      -selectionElement.y - sceneState.scrollY,
    );
  }

  // Pain selected elements
  if (renderSelection) {
    const selectedElements = elements.filter(element => element.isSelected);
    const dashledLinePadding = 4;

    selectedElements.forEach(element => {
      const [
        elementX1,
        elementY1,
        elementX2,
        elementY2,
      ] = getElementAbsoluteCoords(element);

      const elementWidth = (elementX2 - elementX1) * sceneState.zoom;
      const elementHeight = (elementY2 - elementY1) * sceneState.zoom;

      const elementX1InCanvas = getXPositionWithSceneState(elementX1);
      const elementY1InCanvas = getYPositionWithSceneState(elementY1);

      const initialLineDash = context.getLineDash();
      context.setLineDash([8, 4]);
      context.strokeRect(
        elementX1InCanvas - dashledLinePadding,
        elementY1InCanvas - dashledLinePadding,
        elementWidth + dashledLinePadding * 2,
        elementHeight + dashledLinePadding * 2,
      );
      context.setLineDash(initialLineDash);
    });

    // Paint resize handlers
    if (selectedElements.length === 1 && selectedElements[0].type !== "text") {
      const handlers = handlerRectangles(selectedElements[0], {
        scrollX: sceneState.scrollX,
        scrollY: sceneState.scrollY,
        zoom: sceneState.zoom,
      });
      Object.values(handlers)
        .filter(handler => handler !== undefined)
        .forEach(handler => {
          context.strokeRect(handler[0], handler[1], handler[2], handler[3]);
        });
    }
  }

  // Paint scrollbars
  if (renderScrollbars) {
    const scrollBars = getScrollBars(
      elements,
      normalizedCanvasWidth,
      normalizedCanvasHeight,
      {
        scrollX: sceneState.scrollX,
        scrollY: sceneState.scrollY,
        zoom: sceneState.zoom,
      },
    );

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
    context.strokeStyle = strokeStyle;
    context.fillStyle = fillStyle;
  }

  return visibleElements.length > 0;
}

function isVisibleElement(
  element: ExcalidrawElement,
  canvasWidth: number,
  canvasHeight: number,
  {
    scrollX,
    scrollY,
    zoom,
  }: {
    scrollX: SceneState["scrollX"];
    scrollY: SceneState["scrollY"];
    zoom: SceneState["zoom"];
  },
) {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  return (
    (x2 + scrollX) * zoom >= 0 &&
    (x1 + scrollX) * zoom <= canvasWidth &&
    (y2 + scrollY) * zoom >= 0 &&
    (y1 + scrollY) * zoom <= canvasHeight
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
