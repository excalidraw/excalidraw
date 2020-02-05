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
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    context.fillStyle = sceneState.viewBackgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }
  context.fillStyle = fillStyle;

  // Paint visible elements
  const visibleElements = elements.filter(element =>
    isVisibleElement(
      element,
      sceneState.scrollX,
      sceneState.scrollY,
      canvas.width,
      canvas.height,
    ),
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
      canvas.width / contextScale,
      canvas.height / contextScale,
      sceneState.scrollX,
      sceneState.scrollY,
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
  scrollX: number,
  scrollY: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  let [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  if (element.type !== "arrow") {
    x1 += scrollX;
    y1 += scrollY;
    x2 += scrollX;
    y2 += scrollY;
    return x2 >= 0 && x1 <= canvasWidth && y2 >= 0 && y1 <= canvasHeight;
  }
  return (
    x2 + scrollX >= 0 &&
    x1 + scrollX <= canvasWidth &&
    y2 + scrollY >= 0 &&
    y1 + scrollY <= canvasHeight
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
