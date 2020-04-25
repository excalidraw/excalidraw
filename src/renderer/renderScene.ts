import { RoughCanvas } from "roughjs/bin/canvas";
import { RoughSVG } from "roughjs/bin/svg";
import oc from "open-color";

import { FlooredNumber, AppState } from "../types";
import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import {
  getElementAbsoluteCoords,
  OMIT_SIDES_FOR_MULTIPLE_ELEMENTS,
  handlerRectanglesFromCoords,
  handlerRectangles,
  getCommonBounds,
  canResizeMutlipleElements,
} from "../element";

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

type HandlerRectanglesRet = keyof ReturnType<typeof handlerRectangles>;

function colorsForClientId(clientId: string) {
  // Naive way of getting an integer out of the clientId
  const sum = clientId.split("").reduce((a, str) => a + str.charCodeAt(0), 0);

  // Skip transparent background.
  const backgrounds = colors.elementBackground.slice(1);
  const strokes = colors.elementStroke.slice(1);
  return {
    background: backgrounds[sum % backgrounds.length],
    stroke: strokes[sum % strokes.length],
  };
}

function strokeRectWithRotation(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  cx: number,
  cy: number,
  angle: number,
  fill?: boolean,
) {
  context.translate(cx, cy);
  context.rotate(angle);
  if (fill) {
    context.fillRect(x - cx, y - cy, width, height);
  }
  context.strokeRect(x - cx, y - cy, width, height);
  context.rotate(-angle);
  context.translate(-cx, -cy);
}

function strokeCircle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.beginPath();
  context.arc(x + width / 2, y + height / 2, width / 2, 0, Math.PI * 2);
  context.fill();
  context.stroke();
}

export function renderScene(
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
  selectionElement: NonDeletedExcalidrawElement | null,
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
  context.scale(scale, scale);

  // When doing calculations based on canvas width we should used normalized one
  const normalizedCanvasWidth = canvas.width / scale;
  const normalizedCanvasHeight = canvas.height / scale;

  // Paint background
  if (typeof sceneState.viewBackgroundColor === "string") {
    const hasTransparence =
      sceneState.viewBackgroundColor === "transparent" ||
      sceneState.viewBackgroundColor.length === 5 || // #RGBA
      sceneState.viewBackgroundColor.length === 9 || // #RRGGBBA
      /(hsla|rgba)\(/.test(sceneState.viewBackgroundColor);
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
  const visibleElements = elements.filter((element) =>
    isVisibleElement(
      element,
      normalizedCanvasWidth,
      normalizedCanvasHeight,
      sceneState,
    ),
  );

  visibleElements.forEach((element) => {
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

  // Paint selected elements
  if (renderSelection) {
    context.translate(sceneState.scrollX, sceneState.scrollY);

    const selections = elements.reduce((acc, element) => {
      const selectionColors = [];
      // local user
      if (appState.selectedElementIds[element.id]) {
        selectionColors.push(oc.black);
      }
      // remote users
      if (sceneState.remoteSelectedElementIds[element.id]) {
        selectionColors.push(
          ...sceneState.remoteSelectedElementIds[element.id].map((socketId) => {
            const { background } = colorsForClientId(socketId);
            return background;
          }),
        );
      }
      if (selectionColors.length) {
        acc.push({ element, selectionColors });
      }
      return acc;
    }, [] as { element: ExcalidrawElement; selectionColors: string[] }[]);

    selections.forEach(({ element, selectionColors }) => {
      const [
        elementX1,
        elementY1,
        elementX2,
        elementY2,
      ] = getElementAbsoluteCoords(element);

      const elementWidth = elementX2 - elementX1;
      const elementHeight = elementY2 - elementY1;

      const initialLineDash = context.getLineDash();
      const lineWidth = context.lineWidth;
      const lineDashOffset = context.lineDashOffset;
      const strokeStyle = context.strokeStyle;

      const dashedLinePadding = 4 / sceneState.zoom;
      const dashWidth = 8 / sceneState.zoom;
      const spaceWidth = 4 / sceneState.zoom;

      context.lineWidth = 1 / sceneState.zoom;

      const count = selectionColors.length;
      for (var i = 0; i < count; ++i) {
        context.strokeStyle = selectionColors[i];
        context.setLineDash([
          dashWidth,
          spaceWidth + (dashWidth + spaceWidth) * (count - 1),
        ]);
        context.lineDashOffset = (dashWidth + spaceWidth) * i;
        strokeRectWithRotation(
          context,
          elementX1 - dashedLinePadding,
          elementY1 - dashedLinePadding,
          elementWidth + dashedLinePadding * 2,
          elementHeight + dashedLinePadding * 2,
          elementX1 + elementWidth / 2,
          elementY1 + elementHeight / 2,
          element.angle,
        );
      }
      context.lineDashOffset = lineDashOffset;
      context.strokeStyle = strokeStyle;
      context.lineWidth = lineWidth;
      context.setLineDash(initialLineDash);
    });
    context.translate(-sceneState.scrollX, -sceneState.scrollY);

    const locallySelectedElements = getSelectedElements(elements, appState);

    // Paint resize handlers
    if (locallySelectedElements.length === 1) {
      context.translate(sceneState.scrollX, sceneState.scrollY);
      context.fillStyle = oc.white;
      const handlers = handlerRectangles(
        locallySelectedElements[0],
        sceneState.zoom,
      );
      Object.keys(handlers).forEach((key) => {
        const handler = handlers[key as HandlerRectanglesRet];
        if (handler !== undefined) {
          const lineWidth = context.lineWidth;
          context.lineWidth = 1 / sceneState.zoom;
          if (key === "rotation") {
            strokeCircle(
              context,
              handler[0],
              handler[1],
              handler[2],
              handler[3],
            );
          } else if (locallySelectedElements[0].type !== "text") {
            strokeRectWithRotation(
              context,
              handler[0],
              handler[1],
              handler[2],
              handler[3],
              handler[0] + handler[2] / 2,
              handler[1] + handler[3] / 2,
              locallySelectedElements[0].angle,
              true, // fill before stroke
            );
          }
          context.lineWidth = lineWidth;
        }
      });
      context.translate(-sceneState.scrollX, -sceneState.scrollY);
    } else if (locallySelectedElements.length > 1) {
      if (canResizeMutlipleElements(locallySelectedElements)) {
        const dashedLinePadding = 4 / sceneState.zoom;
        context.translate(sceneState.scrollX, sceneState.scrollY);
        context.fillStyle = oc.white;
        const [x1, y1, x2, y2] = getCommonBounds(locallySelectedElements);
        const initialLineDash = context.getLineDash();
        context.setLineDash([2 / sceneState.zoom]);
        const lineWidth = context.lineWidth;
        context.lineWidth = 1 / sceneState.zoom;
        strokeRectWithRotation(
          context,
          x1 - dashedLinePadding,
          y1 - dashedLinePadding,
          x2 - x1 + dashedLinePadding * 2,
          y2 - y1 + dashedLinePadding * 2,
          (x1 + x2) / 2,
          (y1 + y2) / 2,
          0,
        );
        context.lineWidth = lineWidth;
        context.setLineDash(initialLineDash);
        const handlers = handlerRectanglesFromCoords(
          [x1, y1, x2, y2],
          0,
          sceneState.zoom,
          undefined,
          OMIT_SIDES_FOR_MULTIPLE_ELEMENTS,
        );
        Object.keys(handlers).forEach((key) => {
          const handler = handlers[key as HandlerRectanglesRet];
          if (handler !== undefined) {
            const lineWidth = context.lineWidth;
            context.lineWidth = 1 / sceneState.zoom;
            strokeRectWithRotation(
              context,
              handler[0],
              handler[1],
              handler[2],
              handler[3],
              handler[0] + handler[2] / 2,
              handler[1] + handler[3] / 2,
              0,
              true, // fill before stroke
            );
            context.lineWidth = lineWidth;
          }
        });
        context.translate(-sceneState.scrollX, -sceneState.scrollY);
      }
    }
  }

  // Reset zoom
  context.scale(1 / sceneState.zoom, 1 / sceneState.zoom);
  context.translate(-zoomTranslationX, -zoomTranslationY);

  // Paint remote pointers
  for (const clientId in sceneState.remotePointerViewportCoords) {
    let { x, y } = sceneState.remotePointerViewportCoords[clientId];
    const username = sceneState.remotePointerUsernames[clientId];

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

    const { background, stroke } = colorsForClientId(clientId);

    const strokeStyle = context.strokeStyle;
    const fillStyle = context.fillStyle;
    const globalAlpha = context.globalAlpha;
    context.strokeStyle = stroke;
    context.fillStyle = background;
    if (isOutOfBounds) {
      context.globalAlpha = 0.2;
    }

    if (
      sceneState.remotePointerButton &&
      sceneState.remotePointerButton[clientId] === "down"
    ) {
      context.beginPath();
      context.arc(x, y, 15, 0, 2 * Math.PI, false);
      context.lineWidth = 3;
      context.strokeStyle = "#ffffff88";
      context.stroke();
      context.closePath();

      context.beginPath();
      context.arc(x, y, 15, 0, 2 * Math.PI, false);
      context.lineWidth = 1;
      context.strokeStyle = stroke;
      context.stroke();
      context.closePath();
    }

    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 1, y + 14);
    context.lineTo(x + 4, y + 9);
    context.lineTo(x + 9, y + 10);
    context.lineTo(x, y);
    context.fill();
    context.stroke();

    if (!isOutOfBounds && username) {
      const offsetX = x + width;
      const offsetY = y + height;
      const paddingHorizontal = 4;
      const paddingVertical = 4;
      const measure = context.measureText(username);
      const measureHeight =
        measure.actualBoundingBoxDescent + measure.actualBoundingBoxAscent;

      // Border
      context.fillStyle = stroke;
      context.globalAlpha = globalAlpha;
      context.fillRect(
        offsetX - 1,
        offsetY - 1,
        measure.width + 2 * paddingHorizontal + 2,
        measureHeight + 2 * paddingVertical + 2,
      );
      // Background
      context.fillStyle = background;
      context.fillRect(
        offsetX,
        offsetY,
        measure.width + 2 * paddingHorizontal,
        measureHeight + 2 * paddingVertical,
      );
      context.fillStyle = oc.white;
      context.fillText(
        username,
        offsetX + paddingHorizontal,
        offsetY + paddingVertical + measure.actualBoundingBoxAscent,
      );
    }

    context.strokeStyle = strokeStyle;
    context.fillStyle = fillStyle;
    context.globalAlpha = globalAlpha;
    context.closePath();
  }

  // Paint scrollbars
  let scrollBars;
  if (renderScrollbars) {
    scrollBars = getScrollBars(
      elements,
      normalizedCanvasWidth,
      normalizedCanvasHeight,
      sceneState,
    );

    const fillStyle = context.fillStyle;
    const strokeStyle = context.strokeStyle;
    context.fillStyle = SCROLLBAR_COLOR;
    context.strokeStyle = "rgba(255,255,255,0.8)";
    [scrollBars.horizontal, scrollBars.vertical].forEach((scrollBar) => {
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
  }

  context.scale(1 / scale, 1 / scale);

  return { atLeastOneVisibleElement: visibleElements.length > 0, scrollBars };
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
  elements: readonly NonDeletedExcalidrawElement[],
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
  elements.forEach((element) => {
    if (!element.isDeleted) {
      renderElementToSvg(
        element,
        rsvg,
        svgRoot,
        element.x + offsetX,
        element.y + offsetY,
      );
    }
  });
}
