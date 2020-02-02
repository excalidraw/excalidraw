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

  if (renderSelection) {
    const selectedElements = elements.filter(el => el.isSelected);

    selectedElements.forEach(element => {
      const margin = 4;

      const [
        elementX1,
        elementY1,
        elementX2,
        elementY2,
      ] = getElementAbsoluteCoords(element);
      const lineDash = context.getLineDash();
      context.setLineDash([8, 4]);
      context.strokeRect(
        elementX1 - margin + sceneState.scrollX,
        elementY1 - margin + sceneState.scrollY,
        elementX2 - elementX1 + margin * 2,
        elementY2 - elementY1 + margin * 2,
      );
      context.setLineDash(lineDash);
    });

    if (selectedElements.length === 1 && selectedElements[0].type !== "text") {
      const handlers = handlerRectangles(selectedElements[0], sceneState);
      Object.values(handlers)
        .filter(handler => handler !== undefined)
        .forEach(handler => {
          context.strokeRect(handler[0], handler[1], handler[2], handler[3]);
        });
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
