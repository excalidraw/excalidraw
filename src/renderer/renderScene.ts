import { RoughCanvas } from "roughjs/bin/canvas";
import { RoughSVG } from "roughjs/bin/svg";

import { FlooredNumber } from "../types";
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

let canvasBelow: HTMLCanvasElement | null = null;
let canvasAbove: HTMLCanvasElement | null = null;

const prevRender: {
  selectedIds: string;
  sceneState: SceneState | null;
  selectionStart: number | null;
  selectionEnd: number | null;
} = {
  selectedIds: "",
  sceneState: null,
  selectionStart: null,
  selectionEnd: null,
};

function duplicateCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d")!;

  const _canvas = document.createElement("canvas");
  const _context = _canvas.getContext("2d")!;
  _canvas.width = canvas.width;
  _canvas.height = canvas.height;
  _context.setTransform(context.getTransform());

  return _canvas;
}

function findSelectionEnd(elements: readonly ExcalidrawElement[]): number {
  let i = elements.length;
  while (--i > -1) {
    if (elements[i].isSelected) {
      return i;
    }
  }
  return -1;
}

function findSelectionStart(elements: readonly ExcalidrawElement[]): number {
  const len = elements.length;
  let i = -1;
  while (++i < len) {
    if (elements[i].isSelected) {
      return i;
    }
  }
  return -1;
}

export function renderScene(
  elements: readonly ExcalidrawElement[],
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
): boolean {
  if (!canvas) {
    return false;
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

  const selectionStart = findSelectionStart(visibleElements);
  const selectionEnd = findSelectionEnd(visibleElements);

  const middleElements = visibleElements.slice(
    selectionStart,
    selectionEnd + 1,
  );
  // console.log(selectionStart, selectionEnd, middleElements);

  const selectedIds = middleElements.map(e => e.id).join();

  if (selectedIds) {
    if (
      !prevRender.sceneState ||
      !sceneState ||
      sceneState.zoom !== prevRender.sceneState.zoom ||
      sceneState.scrollX !== prevRender.sceneState.scrollX ||
      sceneState.scrollY !== prevRender.sceneState.scrollY ||
      selectedIds !== prevRender.selectedIds ||
      !canvasBelow ||
      !canvasAbove ||
      selectionStart !== prevRender.selectionStart ||
      selectionEnd !== prevRender.selectionEnd
    ) {
      if (!canvasBelow) {
        canvasBelow = duplicateCanvas(canvas);
      }
      if (!canvasAbove) {
        canvasAbove = duplicateCanvas(canvas);
      }
      const elementBelow = visibleElements.slice(0, selectionStart);
      const elementAbove = visibleElements.slice(selectionEnd + 1);
      const contextBelow = canvasBelow!.getContext("2d")!;
      const contextAbove = canvasAbove!.getContext("2d")!;

      contextBelow.clearRect(0, 0, canvasBelow!.width, canvasBelow!.height);
      contextAbove.clearRect(0, 0, canvasAbove!.width, canvasAbove!.height);

      applyZoom(contextBelow);
      elementBelow.forEach(element => {
        renderElement(
          element,
          rc,
          contextBelow,
          renderOptimizations,
          sceneState,
        );
      });
      resetZoom(contextBelow);
      applyZoom(contextAbove);
      elementAbove.forEach(element => {
        renderElement(
          element,
          rc,
          contextAbove,
          renderOptimizations,
          sceneState,
        );
      });
      resetZoom(contextAbove);
    }
    prevRender.selectedIds = selectedIds;
    prevRender.sceneState = sceneState;
    prevRender.selectionStart = selectionStart;
    prevRender.selectionEnd = selectionEnd;

    context.drawImage(canvasBelow!, 0, 0);
    applyZoom(context);
    middleElements.forEach(element => {
      renderElement(element, rc, context, renderOptimizations, sceneState);
    });
    resetZoom(context);
    context.drawImage(canvasAbove!, 0, 0);
  } else {
    canvasBelow = null;
    canvasAbove = null;
    applyZoom(context);
    visibleElements.forEach(element => {
      renderElement(element, rc, context, renderOptimizations, sceneState);
    });
    resetZoom(context);
  }

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
    const selectedElements = getSelectedElements(visibleElements);
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
