import { RoughCanvas } from "roughjs/bin/canvas";

import { ExcalidrawElement } from "../element/types";
import {
  getElementAbsoluteX1,
  getElementAbsoluteX2,
  getElementAbsoluteY1,
  getElementAbsoluteY2,
  handlerRectangles
} from "../element";

import { roundRect } from "./roundRect";
import { SceneState } from "./types";
import { getScrollBars, SCROLLBAR_COLOR, SCROLLBAR_WIDTH } from "./scrollbars";
import { getSelectedIndices } from "./selection";

export function renderScene(
  elements: ExcalidrawElement[],
  rc: RoughCanvas,
  canvas: HTMLCanvasElement,
  sceneState: SceneState,
  // extra options, currently passed by export helper
  {
    offsetX,
    offsetY,
    renderScrollbars = true,
    renderSelection = true
  }: {
    offsetX?: number;
    offsetY?: number;
    renderScrollbars?: boolean;
    renderSelection?: boolean;
  } = {}
) {
  if (!canvas) return;
  const context = canvas.getContext("2d")!;

  const fillStyle = context.fillStyle;
  if (typeof sceneState.viewBackgroundColor === "string") {
    context.fillStyle = sceneState.viewBackgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }
  context.fillStyle = fillStyle;

  const selectedIndices = getSelectedIndices(elements);

  sceneState = {
    ...sceneState,
    scrollX: typeof offsetX === "number" ? offsetX : sceneState.scrollX,
    scrollY: typeof offsetY === "number" ? offsetY : sceneState.scrollY
  };

  elements.forEach(element => {
    element.draw(rc, context, sceneState);
    if (renderSelection && element.isSelected) {
      const margin = 4;

      const elementX1 = getElementAbsoluteX1(element);
      const elementX2 = getElementAbsoluteX2(element);
      const elementY1 = getElementAbsoluteY1(element);
      const elementY2 = getElementAbsoluteY2(element);
      const lineDash = context.getLineDash();
      context.setLineDash([8, 4]);
      context.strokeRect(
        elementX1 - margin + sceneState.scrollX,
        elementY1 - margin + sceneState.scrollY,
        elementX2 - elementX1 + margin * 2,
        elementY2 - elementY1 + margin * 2
      );
      context.setLineDash(lineDash);

      if (element.type !== "text" && selectedIndices.length === 1) {
        const handlers = handlerRectangles(element, sceneState);
        Object.values(handlers).forEach(handler => {
          context.strokeRect(handler[0], handler[1], handler[2], handler[3]);
        });
      }
    }
  });

  if (renderScrollbars) {
    const scrollBars = getScrollBars(
      elements,
      context.canvas.width / window.devicePixelRatio,
      context.canvas.height / window.devicePixelRatio,
      sceneState.scrollX,
      sceneState.scrollY
    );

    const strokeStyle = context.strokeStyle;
    context.fillStyle = SCROLLBAR_COLOR;
    context.strokeStyle = "rgba(255,255,255,0.8)";
    [scrollBars.horizontal, scrollBars.vertical].forEach(scrollBar => {
      if (scrollBar)
        roundRect(
          context,
          scrollBar.x,
          scrollBar.y,
          scrollBar.width,
          scrollBar.height,
          SCROLLBAR_WIDTH / 2
        );
    });
    context.strokeStyle = strokeStyle;
    context.fillStyle = fillStyle;
  }
}
