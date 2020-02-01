import { RoughCanvas } from "roughjs/bin/canvas";
import { RoughSVG } from "roughjs/bin/svg";

import { ExcalidrawElement } from "../element/types";
import {
  getElementAbsoluteCoords,
  handlerRectangles,
  isTextElement,
} from "../element";

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

  // Use offsets insteads of scrolls if available
  sceneState = {
    ...sceneState,
    scrollX: typeof offsetX === "number" ? offsetX : sceneState.scrollX,
    scrollY: typeof offsetY === "number" ? offsetY : sceneState.scrollY,
  };

  const context = canvas.getContext("2d")!;

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

  // Fake zoom by scaling elements
  const scaledElements = elements.map(element =>
    getScaledElement(element, sceneState.zoom),
  );

  // Paint visible elements
  const visibleElements = scaledElements.filter(element =>
    isVisibleElement(
      element,
      sceneState.scrollX,
      sceneState.scrollY,
      canvas.width,
      canvas.height,
    ),
  );
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

  // Paint selection
  if (renderSelection) {
    const selectedElements = scaledElements.filter(
      element => element.isSelected,
    );
    const margin = 4;

    selectedElements.forEach(element => {
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

    // Paint resize handlers
    if (selectedElements.length === 1 && selectedElements[0].type !== "text") {
      const handlers = handlerRectangles(selectedElements[0], sceneState);
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
      scaledElements,
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

function getScaledElement(
  element: ExcalidrawElement,
  scale: number,
): ExcalidrawElement {
  switch (element.type) {
    case "selection": {
      const scaledElement = { ...element };
      scaledElement.x *= scale;
      scaledElement.y *= scale;
      scaledElement.width *= scale;
      scaledElement.height *= scale;
      scaledElement.strokeWidth *= scale;
      return scaledElement;
    }
    case "rectangle":
    case "diamond":
    case "ellipse":
    case "line": {
      const scaledElement = { ...element };
      scaledElement.x *= scale;
      scaledElement.y *= scale;
      scaledElement.width *= scale;
      scaledElement.height *= scale;
      scaledElement.strokeWidth *= scale;
      return scaledElement;
    }
    case "arrow": {
      const scaledElement = { ...element };
      scaledElement.x *= scale;
      scaledElement.y *= scale;
      scaledElement.width *= scale;
      scaledElement.height *= scale;
      scaledElement.strokeWidth *= scale;
      scaledElement.points = scaledElement.points.map(([x, y]) => [
        x * scale,
        y * scale,
      ]);
      return scaledElement;
    }
    default: {
      if (isTextElement(element)) {
        const scaledElement = { ...element };
        scaledElement.x *= scale;
        scaledElement.y *= scale;
        const fontSize = parseFloat(scaledElement.font);
        scaledElement.font = `${fontSize * scale}px ${
          scaledElement.font.split("px ")[1]
        }`;
        return scaledElement;
      }
      throw new Error("Unimplemented type " + element.type);
    }
  }
}
