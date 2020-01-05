import { RoughCanvas } from "roughjs/bin/canvas";
import { RoughSVG } from "roughjs/bin/svg";

import { ExcalidrawElement, ExcalidrawGroupElement } from "../element/types";
import { getElementAbsoluteCoords, handlerRectangles } from "../element";

import { roundRect } from "./roundRect";
import { SceneState } from "../scene/types";
import {
  getScrollBars,
  SCROLLBAR_COLOR,
  SCROLLBAR_WIDTH,
} from "../scene/scrollbars";

import { renderElement, renderElementToSvg } from "./renderElement";

function drawLine(
  x1: number,
  x2: number,
  y1: number,
  y2: number,
  sceneState: SceneState,
  context: CanvasRenderingContext2D,
) {
  const margin = 4;
  const lineDash = context.getLineDash();
  context.setLineDash([8, 4]);
  context.strokeRect(
    x1 - margin + sceneState.scrollX,
    y1 - margin + sceneState.scrollY,
    x2 - x1 + margin * 2,
    y2 - y1 + margin * 2,
  );
  context.setLineDash(lineDash);
}

export function renderScene(
  elements: readonly ExcalidrawElement[],
  selectionElement: ExcalidrawElement | null,
  groups: readonly ExcalidrawGroupElement[],
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
) {
  if (!canvas) {
    return false;
  }
  const context = canvas.getContext("2d")!;

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

  sceneState = {
    ...sceneState,
    scrollX: typeof offsetX === "number" ? offsetX : sceneState.scrollX,
    scrollY: typeof offsetY === "number" ? offsetY : sceneState.scrollY,
  };

  let atLeastOneVisibleElement = false;
  elements.forEach(element => {
    if (
      !isVisibleElement(
        element,
        sceneState.scrollX,
        sceneState.scrollY,
        // If canvas is scaled for high pixelDeviceRatio width and height
        // setted in the `style` attribute
        parseInt(canvas.style.width) || canvas.width,
        parseInt(canvas.style.height) || canvas.height,
      )
    ) {
      return;
    }
    atLeastOneVisibleElement = true;
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

  if (renderSelection) {
    const selectedElements = new Set<ExcalidrawElement>();
    const selectedGroups = new Set<ExcalidrawGroupElement>();

    elements.forEach(element => {
      if (element.isSelected) {
        const index = groups.findIndex(g => g.children.find(e => e === element.id));
        if (index !== -1) {
          selectedGroups.add(groups[index]);
        } else {
          selectedElements.add(element);
        }
      }
    });

    selectedElements.forEach(element => {
      const [
        elementX1,
        elementY1,
        elementX2,
        elementY2,
      ] = getElementAbsoluteCoords(element);
      drawLine(elementX1, elementX2, elementY1, elementY2, sceneState, context);
    });
    
    selectedGroups.forEach(group => {
      let xmin = Number.MAX_VALUE;
      let xmax = 0;
      let ymin = Number.MAX_VALUE;
      let ymax = 0;

      group.children.forEach(id => {
        const element = elements.find(e => e.id === id);
        if (!element) {
          return;
        }
 
        const [
          elementX1,
          elementY1,
          elementX2,
          elementY2,
        ] = getElementAbsoluteCoords(element);
        if (elementX1 < xmin) {
          xmin = elementX1;
        }
        if (elementX2 > xmax) {
          xmax = elementX2;
        }
        if (elementY1 < ymin) {
          ymin = elementY1;
        }
        if (elementY2 > ymax) {
          ymax = elementY2;
        }
      });
      drawLine(xmin, xmax, ymin, ymax, sceneState, context);
    });

    if (selectedElements.size === 1) {
      const element = elements.find(el => el.isSelected);
      if (element && element.type !== "text") {
        const handlers = handlerRectangles(element, sceneState);
        Object.values(handlers).forEach(handler => {
          context.strokeRect(handler[0], handler[1], handler[2], handler[3]);
        });
      }
    }
  }

  if (renderScrollbars) {
    const scrollBars = getScrollBars(
      elements,
      context.canvas.width / window.devicePixelRatio,
      context.canvas.height / window.devicePixelRatio,
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

  return atLeastOneVisibleElement;
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
