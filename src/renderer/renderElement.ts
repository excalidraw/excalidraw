import {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  Arrowhead,
  NonDeletedExcalidrawElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawImageElement,
} from "../element/types";
import {
  isTextElement,
  isLinearElement,
  isFreeDrawElement,
  isInitializedImageElement,
} from "../element/typeChecks";
import {
  getDiamondPoints,
  getElementAbsoluteCoords,
  getArrowheadPoints,
} from "../element/bounds";
import { RoughCanvas } from "roughjs/bin/canvas";
import { Drawable, Options } from "roughjs/bin/core";
import { RoughSVG } from "roughjs/bin/svg";
import { RoughGenerator } from "roughjs/bin/generator";

import { RenderConfig } from "../scene/types";
import { distance, isRTL } from "../utils";
import { isPathALoop } from "../math";
import rough from "roughjs/bin/rough";
import { AppState, BinaryFiles, Zoom } from "../types";
import { getDefaultAppState } from "../appState";
import { renderTextElement, renderSvgTextElement } from "../textlike";
import { MAX_DECIMALS_FOR_SVG_EXPORT, MIME_TYPES, SVG_NS } from "../constants";
import { getStroke, StrokeOptions } from "perfect-freehand";

// using a stronger invert (100% vs our regular 93%) and saturate
// as a temp hack to make images in dark theme look closer to original
// color scheme (it's still not quite there and the colors look slightly
// desatured, alas...)
const IMAGE_INVERT_FILTER = "invert(100%) hue-rotate(180deg) saturate(1.25)";

const defaultAppState = getDefaultAppState();

const isPendingImageElement = (
  element: ExcalidrawElement,
  renderConfig: RenderConfig,
) =>
  isInitializedImageElement(element) &&
  !renderConfig.imageCache.has(element.fileId);

const shouldResetImageFilter = (
  element: ExcalidrawElement,
  renderConfig: RenderConfig,
) => {
  return (
    renderConfig.theme === "dark" &&
    isInitializedImageElement(element) &&
    !isPendingImageElement(element, renderConfig) &&
    renderConfig.imageCache.get(element.fileId)?.mimeType !== MIME_TYPES.svg
  );
};

const getDashArrayDashed = (strokeWidth: number) => [8, 8 + strokeWidth];

const getDashArrayDotted = (strokeWidth: number) => [1.5, 6 + strokeWidth];

const getCanvasPadding = (element: ExcalidrawElement) =>
  element.type === "freedraw" ? element.strokeWidth * 12 : 20;

export interface ExcalidrawElementWithCanvas {
  element: ExcalidrawElement | ExcalidrawTextElement;
  canvas: HTMLCanvasElement;
  theme: RenderConfig["theme"];
  canvasZoom: Zoom["value"];
  canvasOffsetX: number;
  canvasOffsetY: number;
}

const generateElementCanvas = (
  element: NonDeletedExcalidrawElement,
  zoom: Zoom,
  renderConfig: RenderConfig,
): ExcalidrawElementWithCanvas => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const padding = getCanvasPadding(element);

  let canvasOffsetX = 0;
  let canvasOffsetY = 0;

  if (isLinearElement(element) || isFreeDrawElement(element)) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);

    canvas.width =
      distance(x1, x2) * window.devicePixelRatio * zoom.value +
      padding * zoom.value * 2;
    canvas.height =
      distance(y1, y2) * window.devicePixelRatio * zoom.value +
      padding * zoom.value * 2;

    canvasOffsetX =
      element.x > x1
        ? distance(element.x, x1) * window.devicePixelRatio * zoom.value
        : 0;

    canvasOffsetY =
      element.y > y1
        ? distance(element.y, y1) * window.devicePixelRatio * zoom.value
        : 0;

    context.translate(canvasOffsetX, canvasOffsetY);
  } else {
    canvas.width =
      element.width * window.devicePixelRatio * zoom.value +
      padding * zoom.value * 2;
    canvas.height =
      element.height * window.devicePixelRatio * zoom.value +
      padding * zoom.value * 2;
  }

  context.save();
  context.translate(padding * zoom.value, padding * zoom.value);
  context.scale(
    window.devicePixelRatio * zoom.value,
    window.devicePixelRatio * zoom.value,
  );

  const rc = rough.canvas(canvas);

  // in dark theme, revert the image color filter
  if (shouldResetImageFilter(element, renderConfig)) {
    context.filter = IMAGE_INVERT_FILTER;
  }

  drawElementOnCanvas(element, rc, context, renderConfig);
  context.restore();

  return {
    element,
    canvas,
    theme: renderConfig.theme,
    canvasZoom: zoom.value,
    canvasOffsetX,
    canvasOffsetY,
  };
};

export const DEFAULT_LINK_SIZE = 14;

const IMAGE_PLACEHOLDER_IMG = document.createElement("img");
IMAGE_PLACEHOLDER_IMG.src = `data:${MIME_TYPES.svg},${encodeURIComponent(
  `<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="image" class="svg-inline--fa fa-image fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#888" d="M464 448H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h416c26.51 0 48 21.49 48 48v288c0 26.51-21.49 48-48 48zM112 120c-30.928 0-56 25.072-56 56s25.072 56 56 56 56-25.072 56-56-25.072-56-56-56zM64 384h384V272l-87.515-87.515c-4.686-4.686-12.284-4.686-16.971 0L208 320l-55.515-55.515c-4.686-4.686-12.284-4.686-16.971 0L64 336v48z"></path></svg>`,
)}`;

const IMAGE_ERROR_PLACEHOLDER_IMG = document.createElement("img");
IMAGE_ERROR_PLACEHOLDER_IMG.src = `data:${MIME_TYPES.svg},${encodeURIComponent(
  `<svg viewBox="0 0 668 668" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2"><path d="M464 448H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h416c26.51 0 48 21.49 48 48v288c0 26.51-21.49 48-48 48ZM112 120c-30.928 0-56 25.072-56 56s25.072 56 56 56 56-25.072 56-56-25.072-56-56-56ZM64 384h384V272l-87.515-87.515c-4.686-4.686-12.284-4.686-16.971 0L208 320l-55.515-55.515c-4.686-4.686-12.284-4.686-16.971 0L64 336v48Z" style="fill:#888;fill-rule:nonzero" transform="matrix(.81709 0 0 .81709 124.825 145.825)"/><path d="M256 8C119.034 8 8 119.033 8 256c0 136.967 111.034 248 248 248s248-111.034 248-248S392.967 8 256 8Zm130.108 117.892c65.448 65.448 70 165.481 20.677 235.637L150.47 105.216c70.204-49.356 170.226-44.735 235.638 20.676ZM125.892 386.108c-65.448-65.448-70-165.481-20.677-235.637L361.53 406.784c-70.203 49.356-170.226 44.736-235.638-20.676Z" style="fill:#888;fill-rule:nonzero" transform="matrix(.30366 0 0 .30366 506.822 60.065)"/></svg>`,
)}`;

const drawImagePlaceholder = (
  element: ExcalidrawImageElement,
  context: CanvasRenderingContext2D,
  zoomValue: AppState["zoom"]["value"],
) => {
  context.fillStyle = "#E7E7E7";
  context.fillRect(0, 0, element.width, element.height);

  const imageMinWidthOrHeight = Math.min(element.width, element.height);

  const size = Math.min(
    imageMinWidthOrHeight,
    Math.min(imageMinWidthOrHeight * 0.4, 100),
  );

  context.drawImage(
    element.status === "error"
      ? IMAGE_ERROR_PLACEHOLDER_IMG
      : IMAGE_PLACEHOLDER_IMG,
    element.width / 2 - size / 2,
    element.height / 2 - size / 2,
    size,
    size,
  );
};

const drawElementOnCanvas = (
  element: NonDeletedExcalidrawElement,
  rc: RoughCanvas,
  context: CanvasRenderingContext2D,
  renderConfig: RenderConfig,
) => {
  context.globalAlpha = element.opacity / 100;
  switch (element.type) {
    case "rectangle":
    case "diamond":
    case "ellipse": {
      context.lineJoin = "round";
      context.lineCap = "round";
      rc.draw(getShapeForElement(element) as Drawable);
      break;
    }
    case "arrow":
    case "line": {
      context.lineJoin = "round";
      context.lineCap = "round";

      (getShapeForElement(element) as Drawable[]).forEach((shape) => {
        rc.draw(shape);
      });
      break;
    }
    case "freedraw": {
      // Draw directly to canvas
      context.save();
      context.fillStyle = element.strokeColor;

      const path = getFreeDrawPath2D(element) as Path2D;

      context.fillStyle = element.strokeColor;
      context.fill(path);

      context.restore();
      break;
    }
    case "image": {
      const img = isInitializedImageElement(element)
        ? renderConfig.imageCache.get(element.fileId)?.image
        : undefined;
      if (img != null && !(img instanceof Promise)) {
        context.drawImage(
          img,
          0 /* hardcoded for the selection box*/,
          0,
          element.width,
          element.height,
        );
      } else {
        drawImagePlaceholder(element, context, renderConfig.zoom.value);
      }
      break;
    }
    default: {
      if (isTextElement(element)) {
        const rtl = isRTL(element.text);
        const shouldTemporarilyAttach = rtl && !context.canvas.isConnected;
        if (shouldTemporarilyAttach) {
          // to correctly render RTL text mixed with LTR, we have to append it
          // to the DOM
          document.body.appendChild(context.canvas);
        }
        renderTextElement(element, context, renderConfig.renderCb);
        if (shouldTemporarilyAttach) {
          context.canvas.remove();
        }
      } else {
        throw new Error(`Unimplemented type ${element.type}`);
      }
    }
  }
  context.globalAlpha = 1;
};

const elementWithCanvasCache = new WeakMap<
  ExcalidrawElement,
  ExcalidrawElementWithCanvas
>();

const shapeCache = new WeakMap<
  ExcalidrawElement,
  Drawable | Drawable[] | null
>();

export const getShapeForElement = (element: ExcalidrawElement) =>
  shapeCache.get(element);

export const invalidateShapeForElement = (element: ExcalidrawElement) =>
  shapeCache.delete(element);

export const generateRoughOptions = (
  element: ExcalidrawElement,
  continuousPath = false,
): Options => {
  const options: Options = {
    seed: element.seed,
    strokeLineDash:
      element.strokeStyle === "dashed"
        ? getDashArrayDashed(element.strokeWidth)
        : element.strokeStyle === "dotted"
        ? getDashArrayDotted(element.strokeWidth)
        : undefined,
    // for non-solid strokes, disable multiStroke because it tends to make
    // dashes/dots overlay each other
    disableMultiStroke: element.strokeStyle !== "solid",
    // for non-solid strokes, increase the width a bit to make it visually
    // similar to solid strokes, because we're also disabling multiStroke
    strokeWidth:
      element.strokeStyle !== "solid"
        ? element.strokeWidth + 0.5
        : element.strokeWidth,
    // when increasing strokeWidth, we must explicitly set fillWeight and
    // hachureGap because if not specified, roughjs uses strokeWidth to
    // calculate them (and we don't want the fills to be modified)
    fillWeight: element.strokeWidth / 2,
    hachureGap: element.strokeWidth * 4,
    roughness: element.roughness,
    stroke: element.strokeColor,
    preserveVertices: continuousPath,
  };

  switch (element.type) {
    case "rectangle":
    case "diamond":
    case "ellipse": {
      options.fillStyle = element.fillStyle;
      options.fill =
        element.backgroundColor === "transparent"
          ? undefined
          : element.backgroundColor;
      if (element.type === "ellipse") {
        options.curveFitting = 1;
      }
      return options;
    }
    case "line": {
      if (isPathALoop(element.points)) {
        options.fillStyle = element.fillStyle;
        options.fill =
          element.backgroundColor === "transparent"
            ? undefined
            : element.backgroundColor;
      }
      return options;
    }
    case "freedraw":
    case "arrow":
      return options;
    default: {
      throw new Error(`Unimplemented type ${element.type}`);
    }
  }
};

/**
 * Generates the element's shape and puts it into the cache.
 * @param element
 * @param generator
 */
const generateElementShape = (
  element: NonDeletedExcalidrawElement,
  generator: RoughGenerator,
) => {
  let shape = shapeCache.get(element) || null;

  if (!shape) {
    elementWithCanvasCache.delete(element);

    switch (element.type) {
      case "rectangle":
        if (element.strokeSharpness === "round") {
          const w = element.width;
          const h = element.height;
          const r = Math.min(w, h) * 0.25;
          shape = generator.path(
            `M ${r} 0 L ${w - r} 0 Q ${w} 0, ${w} ${r} L ${w} ${
              h - r
            } Q ${w} ${h}, ${w - r} ${h} L ${r} ${h} Q 0 ${h}, 0 ${
              h - r
            } L 0 ${r} Q 0 0, ${r} 0`,
            generateRoughOptions(element, true),
          );
        } else {
          shape = generator.rectangle(
            0,
            0,
            element.width,
            element.height,
            generateRoughOptions(element),
          );
        }
        break;
      case "diamond": {
        const [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY] =
          getDiamondPoints(element);
        if (element.strokeSharpness === "round") {
          shape = generator.path(
            `M ${topX + (rightX - topX) * 0.25} ${
              topY + (rightY - topY) * 0.25
            } L ${rightX - (rightX - topX) * 0.25} ${
              rightY - (rightY - topY) * 0.25
            }
            C ${rightX} ${rightY}, ${rightX} ${rightY}, ${
              rightX - (rightX - bottomX) * 0.25
            } ${rightY + (bottomY - rightY) * 0.25}
            L ${bottomX + (rightX - bottomX) * 0.25} ${
              bottomY - (bottomY - rightY) * 0.25
            }
            C ${bottomX} ${bottomY}, ${bottomX} ${bottomY}, ${
              bottomX - (bottomX - leftX) * 0.25
            } ${bottomY - (bottomY - leftY) * 0.25}
            L ${leftX + (bottomX - leftX) * 0.25} ${
              leftY + (bottomY - leftY) * 0.25
            }
            C ${leftX} ${leftY}, ${leftX} ${leftY}, ${
              leftX + (topX - leftX) * 0.25
            } ${leftY - (leftY - topY) * 0.25}
            L ${topX - (topX - leftX) * 0.25} ${topY + (leftY - topY) * 0.25}
            C ${topX} ${topY}, ${topX} ${topY}, ${
              topX + (rightX - topX) * 0.25
            } ${topY + (rightY - topY) * 0.25}`,
            generateRoughOptions(element, true),
          );
        } else {
          shape = generator.polygon(
            [
              [topX, topY],
              [rightX, rightY],
              [bottomX, bottomY],
              [leftX, leftY],
            ],
            generateRoughOptions(element),
          );
        }
        break;
      }
      case "ellipse":
        shape = generator.ellipse(
          element.width / 2,
          element.height / 2,
          element.width,
          element.height,
          generateRoughOptions(element),
        );
        break;
      case "line":
      case "arrow": {
        const options = generateRoughOptions(element);

        // points array can be empty in the beginning, so it is important to add
        // initial position to it
        const points = element.points.length ? element.points : [[0, 0]];

        // curve is always the first element
        // this simplifies finding the curve for an element
        if (element.strokeSharpness === "sharp") {
          if (options.fill) {
            shape = [generator.polygon(points as [number, number][], options)];
          } else {
            shape = [
              generator.linearPath(points as [number, number][], options),
            ];
          }
        } else {
          shape = [generator.curve(points as [number, number][], options)];
        }

        // add lines only in arrow
        if (element.type === "arrow") {
          const { startArrowhead = null, endArrowhead = "arrow" } = element;

          const getArrowheadShapes = (
            element: ExcalidrawLinearElement,
            shape: Drawable[],
            position: "start" | "end",
            arrowhead: Arrowhead,
          ) => {
            const arrowheadPoints = getArrowheadPoints(
              element,
              shape,
              position,
              arrowhead,
            );

            if (arrowheadPoints === null) {
              return [];
            }

            // Other arrowheads here...
            if (arrowhead === "dot") {
              const [x, y, r] = arrowheadPoints;

              return [
                generator.circle(x, y, r, {
                  ...options,
                  fill: element.strokeColor,
                  fillStyle: "solid",
                  stroke: "none",
                }),
              ];
            }

            if (arrowhead === "triangle") {
              const [x, y, x2, y2, x3, y3] = arrowheadPoints;

              // always use solid stroke for triangle arrowhead
              delete options.strokeLineDash;

              return [
                generator.polygon(
                  [
                    [x, y],
                    [x2, y2],
                    [x3, y3],
                    [x, y],
                  ],
                  {
                    ...options,
                    fill: element.strokeColor,
                    fillStyle: "solid",
                  },
                ),
              ];
            }

            // Arrow arrowheads
            const [x2, y2, x3, y3, x4, y4] = arrowheadPoints;

            if (element.strokeStyle === "dotted") {
              // for dotted arrows caps, reduce gap to make it more legible
              const dash = getDashArrayDotted(element.strokeWidth - 1);
              options.strokeLineDash = [dash[0], dash[1] - 1];
            } else {
              // for solid/dashed, keep solid arrow cap
              delete options.strokeLineDash;
            }
            return [
              generator.line(x3, y3, x2, y2, options),
              generator.line(x4, y4, x2, y2, options),
            ];
          };

          if (startArrowhead !== null) {
            const shapes = getArrowheadShapes(
              element,
              shape,
              "start",
              startArrowhead,
            );
            shape.push(...shapes);
          }

          if (endArrowhead !== null) {
            if (endArrowhead === undefined) {
              // Hey, we have an old arrow here!
            }

            const shapes = getArrowheadShapes(
              element,
              shape,
              "end",
              endArrowhead,
            );
            shape.push(...shapes);
          }
        }

        break;
      }
      case "freedraw": {
        generateFreeDrawShape(element);
        shape = [];
        break;
      }
      case "text":
      case "image": {
        // just to ensure we don't regenerate element.canvas on rerenders
        shape = [];
        break;
      }
    }
    shapeCache.set(element, shape);
  }
};

const generateElementWithCanvas = (
  element: NonDeletedExcalidrawElement,
  renderConfig: RenderConfig,
) => {
  const zoom: Zoom = renderConfig ? renderConfig.zoom : defaultAppState.zoom;
  const prevElementWithCanvas = elementWithCanvasCache.get(element);
  const shouldRegenerateBecauseZoom =
    prevElementWithCanvas &&
    prevElementWithCanvas.canvasZoom !== zoom.value &&
    !renderConfig?.shouldCacheIgnoreZoom;

  if (
    !prevElementWithCanvas ||
    shouldRegenerateBecauseZoom ||
    prevElementWithCanvas.theme !== renderConfig.theme
  ) {
    const elementWithCanvas = generateElementCanvas(
      element,
      zoom,
      renderConfig,
    );

    elementWithCanvasCache.set(element, elementWithCanvas);

    return elementWithCanvas;
  }
  return prevElementWithCanvas;
};

const drawElementFromCanvas = (
  elementWithCanvas: ExcalidrawElementWithCanvas,
  rc: RoughCanvas,
  context: CanvasRenderingContext2D,
  renderConfig: RenderConfig,
) => {
  const element = elementWithCanvas.element;
  const padding = getCanvasPadding(element);
  let [x1, y1, x2, y2] = getElementAbsoluteCoords(element);

  // Free draw elements will otherwise "shuffle" as the min x and y change
  if (isFreeDrawElement(element)) {
    x1 = Math.floor(x1);
    x2 = Math.ceil(x2);
    y1 = Math.floor(y1);
    y2 = Math.ceil(y2);
  }

  const cx = ((x1 + x2) / 2 + renderConfig.scrollX) * window.devicePixelRatio;
  const cy = ((y1 + y2) / 2 + renderConfig.scrollY) * window.devicePixelRatio;

  const _isPendingImageElement = isPendingImageElement(element, renderConfig);

  const scaleXFactor =
    "scale" in elementWithCanvas.element && !_isPendingImageElement
      ? elementWithCanvas.element.scale[0]
      : 1;
  const scaleYFactor =
    "scale" in elementWithCanvas.element && !_isPendingImageElement
      ? elementWithCanvas.element.scale[1]
      : 1;

  context.save();
  context.scale(
    (1 / window.devicePixelRatio) * scaleXFactor,
    (1 / window.devicePixelRatio) * scaleYFactor,
  );
  context.translate(cx * scaleXFactor, cy * scaleYFactor);
  context.rotate(element.angle * scaleXFactor * scaleYFactor);

  context.drawImage(
    elementWithCanvas.canvas!,
    (-(x2 - x1) / 2) * window.devicePixelRatio -
      (padding * elementWithCanvas.canvasZoom) / elementWithCanvas.canvasZoom,
    (-(y2 - y1) / 2) * window.devicePixelRatio -
      (padding * elementWithCanvas.canvasZoom) / elementWithCanvas.canvasZoom,
    elementWithCanvas.canvas!.width / elementWithCanvas.canvasZoom,
    elementWithCanvas.canvas!.height / elementWithCanvas.canvasZoom,
  );
  context.restore();

  // Clear the nested element we appended to the DOM
};

export const renderElement = (
  element: NonDeletedExcalidrawElement,
  rc: RoughCanvas,
  context: CanvasRenderingContext2D,
  renderConfig: RenderConfig,
) => {
  const generator = rc.generator;
  switch (element.type) {
    case "selection": {
      context.save();
      context.translate(
        element.x + renderConfig.scrollX,
        element.y + renderConfig.scrollY,
      );
      context.fillStyle = "rgba(0, 0, 255, 0.10)";
      context.fillRect(0, 0, element.width, element.height);
      context.restore();
      break;
    }
    case "freedraw": {
      generateElementShape(element, generator);

      if (renderConfig.isExporting) {
        const elementWithCanvas = generateElementWithCanvas(
          element,
          renderConfig,
        );
        drawElementFromCanvas(elementWithCanvas, rc, context, renderConfig);
      } else {
        const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
        const cx = (x1 + x2) / 2 + renderConfig.scrollX;
        const cy = (y1 + y2) / 2 + renderConfig.scrollY;
        const shiftX = (x2 - x1) / 2 - (element.x - x1);
        const shiftY = (y2 - y1) / 2 - (element.y - y1);
        context.save();
        context.translate(cx, cy);
        context.rotate(element.angle);
        context.translate(-shiftX, -shiftY);
        drawElementOnCanvas(element, rc, context, renderConfig);
        context.restore();
      }

      break;
    }
    case "rectangle":
    case "diamond":
    case "ellipse":
    case "line":
    case "arrow":
    case "image":
    case "text": {
      generateElementShape(element, generator);
      if (renderConfig.isExporting) {
        const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
        const cx = (x1 + x2) / 2 + renderConfig.scrollX;
        const cy = (y1 + y2) / 2 + renderConfig.scrollY;
        const shiftX = (x2 - x1) / 2 - (element.x - x1);
        const shiftY = (y2 - y1) / 2 - (element.y - y1);
        context.save();
        context.translate(cx, cy);
        context.rotate(element.angle);
        context.translate(-shiftX, -shiftY);

        if (shouldResetImageFilter(element, renderConfig)) {
          context.filter = "none";
        }

        drawElementOnCanvas(element, rc, context, renderConfig);
        context.restore();
        // not exporting → optimized rendering (cache & render from element
        // canvases)
      } else {
        const elementWithCanvas = generateElementWithCanvas(
          element,
          renderConfig,
        );
        drawElementFromCanvas(elementWithCanvas, rc, context, renderConfig);
      }
      break;
    }
    default: {
      // @ts-ignore
      throw new Error(`Unimplemented type ${element.type}`);
    }
  }
};

const roughSVGDrawWithPrecision = (
  rsvg: RoughSVG,
  drawable: Drawable,
  precision?: number,
) => {
  if (typeof precision === "undefined") {
    return rsvg.draw(drawable);
  }
  const pshape: Drawable = {
    sets: drawable.sets,
    shape: drawable.shape,
    options: { ...drawable.options, fixedDecimalPlaceDigits: precision },
  };
  return rsvg.draw(pshape);
};

export const renderElementToSvg = (
  element: NonDeletedExcalidrawElement,
  rsvg: RoughSVG,
  svgRoot: SVGElement,
  files: BinaryFiles,
  offsetX?: number,
  offsetY?: number,
  exportWithDarkMode?: boolean,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const cx = (x2 - x1) / 2 - (element.x - x1);
  const cy = (y2 - y1) / 2 - (element.y - y1);
  const degree = (180 * element.angle) / Math.PI;
  const generator = rsvg.generator;
  switch (element.type) {
    case "selection": {
      // Since this is used only during editing experience, which is canvas based,
      // this should not happen
      throw new Error("Selection rendering is not supported for SVG");
    }
    case "rectangle":
    case "diamond":
    case "ellipse": {
      generateElementShape(element, generator);
      const node = roughSVGDrawWithPrecision(
        rsvg,
        getShapeForElement(element) as Drawable,
        MAX_DECIMALS_FOR_SVG_EXPORT,
      );
      const opacity = element.opacity / 100;
      if (opacity !== 1) {
        node.setAttribute("stroke-opacity", `${opacity}`);
        node.setAttribute("fill-opacity", `${opacity}`);
      }
      node.setAttribute("stroke-linecap", "round");
      node.setAttribute(
        "transform",
        `translate(${offsetX || 0} ${
          offsetY || 0
        }) rotate(${degree} ${cx} ${cy})`,
      );
      svgRoot.appendChild(node);
      break;
    }
    case "line":
    case "arrow": {
      generateElementShape(element, generator);
      const group = svgRoot.ownerDocument!.createElementNS(SVG_NS, "g");
      const opacity = element.opacity / 100;
      group.setAttribute("stroke-linecap", "round");

      (getShapeForElement(element) as Drawable[]).forEach((shape) => {
        const node = roughSVGDrawWithPrecision(
          rsvg,
          shape,
          MAX_DECIMALS_FOR_SVG_EXPORT,
        );
        if (opacity !== 1) {
          node.setAttribute("stroke-opacity", `${opacity}`);
          node.setAttribute("fill-opacity", `${opacity}`);
        }
        node.setAttribute(
          "transform",
          `translate(${offsetX || 0} ${
            offsetY || 0
          }) rotate(${degree} ${cx} ${cy})`,
        );
        if (
          element.type === "line" &&
          isPathALoop(element.points) &&
          element.backgroundColor !== "transparent"
        ) {
          node.setAttribute("fill-rule", "evenodd");
        }
        group.appendChild(node);
      });
      svgRoot.appendChild(group);
      break;
    }
    case "freedraw": {
      generateFreeDrawShape(element);
      const opacity = element.opacity / 100;
      const node = svgRoot.ownerDocument!.createElementNS(SVG_NS, "g");
      if (opacity !== 1) {
        node.setAttribute("stroke-opacity", `${opacity}`);
        node.setAttribute("fill-opacity", `${opacity}`);
      }
      node.setAttribute(
        "transform",
        `translate(${offsetX || 0} ${
          offsetY || 0
        }) rotate(${degree} ${cx} ${cy})`,
      );
      const path = svgRoot.ownerDocument!.createElementNS(SVG_NS, "path");
      node.setAttribute("stroke", "none");
      node.setAttribute("fill", element.strokeColor);
      path.setAttribute("d", getFreeDrawSvgPath(element));
      node.appendChild(path);
      svgRoot.appendChild(node);
      break;
    }
    case "image": {
      const fileData =
        isInitializedImageElement(element) && files[element.fileId];
      if (fileData) {
        const symbolId = `image-${fileData.id}`;
        let symbol = svgRoot.querySelector(`#${symbolId}`);
        if (!symbol) {
          symbol = svgRoot.ownerDocument!.createElementNS(SVG_NS, "symbol");
          symbol.id = symbolId;

          const image = svgRoot.ownerDocument!.createElementNS(SVG_NS, "image");

          image.setAttribute("width", "100%");
          image.setAttribute("height", "100%");
          image.setAttribute("href", fileData.dataURL);

          symbol.appendChild(image);

          svgRoot.prepend(symbol);
        }

        const use = svgRoot.ownerDocument!.createElementNS(SVG_NS, "use");
        use.setAttribute("href", `#${symbolId}`);

        // in dark theme, revert the image color filter
        if (exportWithDarkMode && fileData.mimeType !== MIME_TYPES.svg) {
          use.setAttribute("filter", IMAGE_INVERT_FILTER);
        }

        use.setAttribute("width", `${Math.round(element.width)}`);
        use.setAttribute("height", `${Math.round(element.height)}`);

        use.setAttribute(
          "transform",
          `translate(${offsetX || 0} ${
            offsetY || 0
          }) rotate(${degree} ${cx} ${cy})`,
        );

        svgRoot.appendChild(use);
      }
      break;
    }
    default: {
      if (isTextElement(element)) {
        const opacity = element.opacity / 100;
        const node = svgRoot.ownerDocument!.createElementNS(SVG_NS, "g");
        if (opacity !== 1) {
          node.setAttribute("stroke-opacity", `${opacity}`);
          node.setAttribute("fill-opacity", `${opacity}`);
        }
        node.setAttribute(
          "transform",
          `translate(${offsetX || 0} ${
            offsetY || 0
          }) rotate(${degree} ${cx} ${cy})`,
        );
        renderSvgTextElement(svgRoot, node, element);
        svgRoot.appendChild(node);
      } else {
        // @ts-ignore
        throw new Error(`Unimplemented type ${element.type}`);
      }
    }
  }
};

export const pathsCache = new WeakMap<ExcalidrawFreeDrawElement, Path2D>([]);

export function generateFreeDrawShape(element: ExcalidrawFreeDrawElement) {
  const svgPathData = getFreeDrawSvgPath(element);
  const path = new Path2D(svgPathData);
  pathsCache.set(element, path);
  return path;
}

export function getFreeDrawPath2D(element: ExcalidrawFreeDrawElement) {
  return pathsCache.get(element);
}

export function getFreeDrawSvgPath(element: ExcalidrawFreeDrawElement) {
  // If input points are empty (should they ever be?) return a dot
  const inputPoints = element.simulatePressure
    ? element.points
    : element.points.length
    ? element.points.map(([x, y], i) => [x, y, element.pressures[i]])
    : [[0, 0, 0.5]];

  // Consider changing the options for simulated pressure vs real pressure
  const options: StrokeOptions = {
    simulatePressure: element.simulatePressure,
    size: element.strokeWidth * 4.25,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    easing: (t) => Math.sin((t * Math.PI) / 2), // https://easings.net/#easeOutSine
    last: !!element.lastCommittedPoint, // LastCommittedPoint is added on pointerup
  };

  return getSvgPathFromStroke(getStroke(inputPoints as number[][], options));
}

function med(A: number[], B: number[]) {
  return [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
}

// Trim SVG path data so number are each two decimal points. This
// improves SVG exports, and prevents rendering errors on points
// with long decimals.
const TO_FIXED_PRECISION = /(\s?[A-Z]?,?-?[0-9]*\.[0-9]{0,2})(([0-9]|e|-)*)/g;

function getSvgPathFromStroke(points: number[][]): string {
  if (!points.length) {
    return "";
  }

  const max = points.length - 1;

  return points
    .reduce(
      (acc, point, i, arr) => {
        if (i === max) {
          acc.push(point, med(point, arr[0]), "L", arr[0], "Z");
        } else {
          acc.push(point, med(point, arr[i + 1]));
        }
        return acc;
      },
      ["M", points[0], "Q"],
    )
    .join(" ")
    .replace(TO_FIXED_PRECISION, "$1");
}
