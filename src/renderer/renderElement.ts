import {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  Arrowhead,
  NonDeletedExcalidrawElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawImageElement,
  ExcalidrawTextElementWithContainer,
} from "../element/types";
import {
  isTextElement,
  isLinearElement,
  isFreeDrawElement,
  isInitializedImageElement,
  isArrowElement,
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
import { distance, getFontString, getFontFamilyString, isRTL } from "../utils";
import { getCornerRadius, isPathALoop } from "../math";
import rough from "roughjs/bin/rough";
import { AppState, BinaryFiles, Zoom } from "../types";
import { getDefaultAppState } from "../appState";
import {
  BOUND_TEXT_PADDING,
  MAX_DECIMALS_FOR_SVG_EXPORT,
  MIME_TYPES,
  SVG_NS,
  VERTICAL_ALIGN,
} from "../constants";
import { getStroke, StrokeOptions } from "perfect-freehand";
import {
  getApproxLineHeight,
  getBoundTextElement,
  getBoundTextElementOffset,
  getContainerElement,
} from "../element/textElement";
import { LinearElementEditor } from "../element/linearElementEditor";

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
  boundTextElementVersion: number | null;
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
    boundTextElementVersion: getBoundTextElement(element)?.version || null,
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
      rc.draw(getShapeForElement(element)!);
      break;
    }
    case "arrow":
    case "line": {
      context.lineJoin = "round";
      context.lineCap = "round";

      getShapeForElement(element)!.forEach((shape) => {
        rc.draw(shape);
      });
      break;
    }
    case "freedraw": {
      // Draw directly to canvas
      context.save();
      context.fillStyle = element.strokeColor;

      const path = getFreeDrawPath2D(element) as Path2D;
      const fillShape = getShapeForElement(element);

      if (fillShape) {
        rc.draw(fillShape);
      }

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
        context.canvas.setAttribute("dir", rtl ? "rtl" : "ltr");
        context.save();
        context.font = getFontString(element);
        context.fillStyle = element.strokeColor;
        context.textAlign = element.textAlign as CanvasTextAlign;

        // Canvas does not support multiline text by default
        const lines = element.text.replace(/\r\n?/g, "\n").split("\n");
        const lineHeight = element.containerId
          ? getApproxLineHeight(getFontString(element))
          : element.height / lines.length;
        let verticalOffset = element.height - element.baseline;
        if (element.verticalAlign === VERTICAL_ALIGN.BOTTOM) {
          verticalOffset = getBoundTextElementOffset(element);
        }

        const horizontalOffset =
          element.textAlign === "center"
            ? element.width / 2
            : element.textAlign === "right"
            ? element.width
            : 0;
        for (let index = 0; index < lines.length; index++) {
          context.fillText(
            lines[index],
            horizontalOffset,
            (index + 1) * lineHeight - verticalOffset,
          );
        }
        context.restore();
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

const shapeCache = new WeakMap<ExcalidrawElement, ElementShape>();

type ElementShape = Drawable | Drawable[] | null;

type ElementShapes = {
  freedraw: Drawable | null;
  arrow: Drawable[];
  line: Drawable[];
  text: null;
  image: null;
};

export const getShapeForElement = <T extends ExcalidrawElement>(element: T) =>
  shapeCache.get(element) as T["type"] extends keyof ElementShapes
    ? ElementShapes[T["type"]] | undefined
    : Drawable | null | undefined;

export const setShapeForElement = <T extends ExcalidrawElement>(
  element: T,
  shape: T["type"] extends keyof ElementShapes
    ? ElementShapes[T["type"]]
    : Drawable,
) => shapeCache.set(element, shape);

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
    case "line":
    case "freedraw": {
      if (isPathALoop(element.points)) {
        options.fillStyle = element.fillStyle;
        options.fill =
          element.backgroundColor === "transparent"
            ? undefined
            : element.backgroundColor;
      }
      return options;
    }
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
  let shape = shapeCache.get(element);

  // `null` indicates no rc shape applicable for this element type
  // (= do not generate anything)
  if (shape === undefined) {
    elementWithCanvasCache.delete(element);

    switch (element.type) {
      case "rectangle":
        if (element.roundness) {
          const w = element.width;
          const h = element.height;
          const r = getCornerRadius(Math.min(w, h), element);
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
        setShapeForElement(element, shape);

        break;
      case "diamond": {
        const [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY] =
          getDiamondPoints(element);
        if (element.roundness) {
          const verticalRadius = getCornerRadius(
            Math.abs(topX - leftX),
            element,
          );

          const horizontalRadius = getCornerRadius(
            Math.abs(rightY - topY),
            element,
          );

          shape = generator.path(
            `M ${topX + verticalRadius} ${topY + horizontalRadius} L ${
              rightX - verticalRadius
            } ${rightY - horizontalRadius}
            C ${rightX} ${rightY}, ${rightX} ${rightY}, ${
              rightX - verticalRadius
            } ${rightY + horizontalRadius}
            L ${bottomX + verticalRadius} ${bottomY - horizontalRadius}
            C ${bottomX} ${bottomY}, ${bottomX} ${bottomY}, ${
              bottomX - verticalRadius
            } ${bottomY - horizontalRadius}
            L ${leftX + verticalRadius} ${leftY + horizontalRadius}
            C ${leftX} ${leftY}, ${leftX} ${leftY}, ${leftX + verticalRadius} ${
              leftY - horizontalRadius
            }
            L ${topX - verticalRadius} ${topY + horizontalRadius}
            C ${topX} ${topY}, ${topX} ${topY}, ${topX + verticalRadius} ${
              topY + horizontalRadius
            }`,
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
        setShapeForElement(element, shape);

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
        setShapeForElement(element, shape);

        break;
      case "line":
      case "arrow": {
        const options = generateRoughOptions(element);

        // points array can be empty in the beginning, so it is important to add
        // initial position to it
        const points = element.points.length ? element.points : [[0, 0]];

        // curve is always the first element
        // this simplifies finding the curve for an element
        if (!element.roundness) {
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

        setShapeForElement(element, shape);

        break;
      }
      case "freedraw": {
        generateFreeDrawShape(element);

        if (isPathALoop(element.points)) {
          // generate rough polygon to fill freedraw shape
          shape = generator.polygon(element.points as [number, number][], {
            ...generateRoughOptions(element),
            stroke: "none",
          });
        } else {
          shape = null;
        }
        setShapeForElement(element, shape);
        break;
      }
      case "text":
      case "image": {
        // just to ensure we don't regenerate element.canvas on rerenders
        setShapeForElement(element, null);
        break;
      }
    }
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
  const boundTextElementVersion = getBoundTextElement(element)?.version || null;

  if (
    !prevElementWithCanvas ||
    shouldRegenerateBecauseZoom ||
    prevElementWithCanvas.theme !== renderConfig.theme ||
    prevElementWithCanvas.boundTextElementVersion !== boundTextElementVersion
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
  const zoom = elementWithCanvas.canvasZoom;
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
  const boundTextElement = getBoundTextElement(element);

  if (isArrowElement(element) && boundTextElement) {
    const tempCanvas = document.createElement("canvas");
    const tempCanvasContext = tempCanvas.getContext("2d")!;

    // Take max dimensions of arrow canvas so that when canvas is rotated
    // the arrow doesn't get clipped
    const maxDim = Math.max(distance(x1, x2), distance(y1, y2));
    tempCanvas.width =
      maxDim * window.devicePixelRatio * zoom +
      padding * elementWithCanvas.canvasZoom * 10;
    tempCanvas.height =
      maxDim * window.devicePixelRatio * zoom +
      padding * elementWithCanvas.canvasZoom * 10;
    const offsetX = (tempCanvas.width - elementWithCanvas.canvas!.width) / 2;
    const offsetY = (tempCanvas.height - elementWithCanvas.canvas!.height) / 2;

    tempCanvasContext.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCanvasContext.rotate(element.angle);

    tempCanvasContext.drawImage(
      elementWithCanvas.canvas!,
      -elementWithCanvas.canvas.width / 2,
      -elementWithCanvas.canvas.height / 2,
      elementWithCanvas.canvas.width,
      elementWithCanvas.canvas.height,
    );

    const [, , , , boundTextCx, boundTextCy] =
      getElementAbsoluteCoords(boundTextElement);

    tempCanvasContext.rotate(-element.angle);

    // Shift the canvas to the center of the bound text element
    const shiftX =
      tempCanvas.width / 2 -
      (boundTextCx - x1) * window.devicePixelRatio * zoom -
      offsetX -
      padding * zoom;

    const shiftY =
      tempCanvas.height / 2 -
      (boundTextCy - y1) * window.devicePixelRatio * zoom -
      offsetY -
      padding * zoom;
    tempCanvasContext.translate(-shiftX, -shiftY);

    // Clear the bound text area
    tempCanvasContext.clearRect(
      -(boundTextElement.width / 2 + BOUND_TEXT_PADDING) *
        window.devicePixelRatio *
        zoom,
      -(boundTextElement.height / 2 + BOUND_TEXT_PADDING) *
        window.devicePixelRatio *
        zoom,
      (boundTextElement.width + BOUND_TEXT_PADDING * 2) *
        window.devicePixelRatio *
        zoom,
      (boundTextElement.height + BOUND_TEXT_PADDING * 2) *
        window.devicePixelRatio *
        zoom,
    );

    context.translate(cx * scaleXFactor, cy * scaleYFactor);
    context.drawImage(
      tempCanvas,
      (-(x2 - x1) / 2) * window.devicePixelRatio - offsetX / zoom - padding,
      (-(y2 - y1) / 2) * window.devicePixelRatio - offsetY / zoom - padding,
      tempCanvas.width / zoom,
      tempCanvas.height / zoom,
    );
  } else {
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
  }
  context.restore();

  // Clear the nested element we appended to the DOM
};

export const renderElement = (
  element: NonDeletedExcalidrawElement,
  rc: RoughCanvas,
  context: CanvasRenderingContext2D,
  renderConfig: RenderConfig,
  appState: AppState,
) => {
  const generator = rc.generator;
  switch (element.type) {
    case "selection": {
      context.save();
      context.translate(
        element.x + renderConfig.scrollX,
        element.y + renderConfig.scrollY,
      );
      context.fillStyle = "rgba(0, 0, 200, 0.04)";

      // render from 0.5px offset  to get 1px wide line
      // https://stackoverflow.com/questions/7530593/html5-canvas-and-line-width/7531540#7531540
      // TODO can be be improved by offseting to the negative when user selects
      // from right to left
      const offset = 0.5 / renderConfig.zoom.value;

      context.fillRect(offset, offset, element.width, element.height);
      context.lineWidth = 1 / renderConfig.zoom.value;
      context.strokeStyle = "rgb(105, 101, 219)";
      context.strokeRect(offset, offset, element.width, element.height);

      context.restore();
      break;
    }
    case "freedraw": {
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
        drawElementOnCanvas(element, rc, context, renderConfig);
        context.restore();
      } else {
        const elementWithCanvas = generateElementWithCanvas(
          element,
          renderConfig,
        );
        drawElementFromCanvas(elementWithCanvas, rc, context, renderConfig);
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
        let shiftX = (x2 - x1) / 2 - (element.x - x1);
        let shiftY = (y2 - y1) / 2 - (element.y - y1);
        if (isTextElement(element)) {
          const container = getContainerElement(element);
          if (isArrowElement(container)) {
            const boundTextCoords =
              LinearElementEditor.getBoundTextElementPosition(
                container,
                element as ExcalidrawTextElementWithContainer,
              );
            shiftX = (x2 - x1) / 2 - (boundTextCoords.x - x1);
            shiftY = (y2 - y1) / 2 - (boundTextCoords.y - y1);
          }
        }
        context.save();
        context.translate(cx, cy);
        if (element.type === "image") {
          context.scale(element.scale[0], element.scale[1]);
        }

        if (shouldResetImageFilter(element, renderConfig)) {
          context.filter = "none";
        }
        const boundTextElement = getBoundTextElement(element);

        if (isArrowElement(element) && boundTextElement) {
          const tempCanvas = document.createElement("canvas");

          const tempCanvasContext = tempCanvas.getContext("2d")!;

          // Take max dimensions of arrow canvas so that when canvas is rotated
          // the arrow doesn't get clipped
          const maxDim = Math.max(distance(x1, x2), distance(y1, y2));
          const padding = getCanvasPadding(element);
          tempCanvas.width =
            maxDim * appState.exportScale + padding * 10 * appState.exportScale;
          tempCanvas.height =
            maxDim * appState.exportScale + padding * 10 * appState.exportScale;

          tempCanvasContext.translate(
            tempCanvas.width / 2,
            tempCanvas.height / 2,
          );
          tempCanvasContext.scale(appState.exportScale, appState.exportScale);

          // Shift the canvas to left most point of the arrow
          shiftX = element.width / 2 - (element.x - x1);
          shiftY = element.height / 2 - (element.y - y1);

          tempCanvasContext.rotate(element.angle);
          const tempRc = rough.canvas(tempCanvas);

          tempCanvasContext.translate(-shiftX, -shiftY);

          drawElementOnCanvas(element, tempRc, tempCanvasContext, renderConfig);

          tempCanvasContext.translate(shiftX, shiftY);

          tempCanvasContext.rotate(-element.angle);

          // Shift the canvas to center of bound text
          const [, , , , boundTextCx, boundTextCy] =
            getElementAbsoluteCoords(boundTextElement);
          const boundTextShiftX = (x1 + x2) / 2 - boundTextCx;
          const boundTextShiftY = (y1 + y2) / 2 - boundTextCy;
          tempCanvasContext.translate(-boundTextShiftX, -boundTextShiftY);

          // Clear the bound text area
          tempCanvasContext.clearRect(
            -boundTextElement.width / 2,
            -boundTextElement.height / 2,
            boundTextElement.width,
            boundTextElement.height,
          );
          context.scale(1 / appState.exportScale, 1 / appState.exportScale);
          context.drawImage(
            tempCanvas,
            -tempCanvas.width / 2,
            -tempCanvas.height / 2,
            tempCanvas.width,
            tempCanvas.height,
          );
        } else {
          context.rotate(element.angle);
          context.translate(-shiftX, -shiftY);
          drawElementOnCanvas(element, rc, context, renderConfig);
        }

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
  offsetX: number,
  offsetY: number,
  exportWithDarkMode?: boolean,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  let cx = (x2 - x1) / 2 - (element.x - x1);
  let cy = (y2 - y1) / 2 - (element.y - y1);
  if (isTextElement(element)) {
    const container = getContainerElement(element);
    if (isArrowElement(container)) {
      const [x1, y1, x2, y2] = getElementAbsoluteCoords(container);

      const boundTextCoords = LinearElementEditor.getBoundTextElementPosition(
        container,
        element as ExcalidrawTextElementWithContainer,
      );
      cx = (x2 - x1) / 2 - (boundTextCoords.x - x1);
      cy = (y2 - y1) / 2 - (boundTextCoords.y - y1);
      offsetX = offsetX + boundTextCoords.x - element.x;
      offsetY = offsetY + boundTextCoords.y - element.y;
    }
  }
  const degree = (180 * element.angle) / Math.PI;
  const generator = rsvg.generator;

  // element to append node to, most of the time svgRoot
  let root = svgRoot;

  // if the element has a link, create an anchor tag and make that the new root
  if (element.link) {
    const anchorTag = svgRoot.ownerDocument!.createElementNS(SVG_NS, "a");
    anchorTag.setAttribute("href", element.link);
    root.appendChild(anchorTag);
    root = anchorTag;
  }

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
        getShapeForElement(element)!,
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
      root.appendChild(node);
      break;
    }
    case "line":
    case "arrow": {
      const boundText = getBoundTextElement(element);
      const maskPath = svgRoot.ownerDocument!.createElementNS(SVG_NS, "mask");
      if (boundText) {
        maskPath.setAttribute("id", `mask-${element.id}`);
        const maskRectVisible = svgRoot.ownerDocument!.createElementNS(
          SVG_NS,
          "rect",
        );
        offsetX = offsetX || 0;
        offsetY = offsetY || 0;
        maskRectVisible.setAttribute("x", "0");
        maskRectVisible.setAttribute("y", "0");
        maskRectVisible.setAttribute("fill", "#fff");
        maskRectVisible.setAttribute(
          "width",
          `${element.width + 100 + offsetX}`,
        );
        maskRectVisible.setAttribute(
          "height",
          `${element.height + 100 + offsetY}`,
        );

        maskPath.appendChild(maskRectVisible);
        const maskRectInvisible = svgRoot.ownerDocument!.createElementNS(
          SVG_NS,
          "rect",
        );
        const boundTextCoords = LinearElementEditor.getBoundTextElementPosition(
          element,
          boundText,
        );

        const maskX = offsetX + boundTextCoords.x - element.x;
        const maskY = offsetY + boundTextCoords.y - element.y;

        maskRectInvisible.setAttribute("x", maskX.toString());
        maskRectInvisible.setAttribute("y", maskY.toString());
        maskRectInvisible.setAttribute("fill", "#000");
        maskRectInvisible.setAttribute("width", `${boundText.width}`);
        maskRectInvisible.setAttribute("height", `${boundText.height}`);
        maskRectInvisible.setAttribute("opacity", "1");
        maskPath.appendChild(maskRectInvisible);
      }
      generateElementShape(element, generator);
      const group = svgRoot.ownerDocument!.createElementNS(SVG_NS, "g");
      if (boundText) {
        group.setAttribute("mask", `url(#mask-${element.id})`);
      }
      const opacity = element.opacity / 100;
      group.setAttribute("stroke-linecap", "round");

      getShapeForElement(element)!.forEach((shape) => {
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
      root.appendChild(group);
      root.append(maskPath);
      break;
    }
    case "freedraw": {
      generateElementShape(element, generator);
      generateFreeDrawShape(element);
      const opacity = element.opacity / 100;
      const shape = getShapeForElement(element);
      const node = shape
        ? roughSVGDrawWithPrecision(rsvg, shape, MAX_DECIMALS_FOR_SVG_EXPORT)
        : svgRoot.ownerDocument!.createElementNS(SVG_NS, "g");
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
      node.setAttribute("stroke", "none");
      const path = svgRoot.ownerDocument!.createElementNS(SVG_NS, "path");
      path.setAttribute("fill", element.strokeColor);
      path.setAttribute("d", getFreeDrawSvgPath(element));
      node.appendChild(path);
      root.appendChild(node);
      break;
    }
    case "image": {
      const width = Math.round(element.width);
      const height = Math.round(element.height);
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

          root.prepend(symbol);
        }

        const use = svgRoot.ownerDocument!.createElementNS(SVG_NS, "use");
        use.setAttribute("href", `#${symbolId}`);

        // in dark theme, revert the image color filter
        if (exportWithDarkMode && fileData.mimeType !== MIME_TYPES.svg) {
          use.setAttribute("filter", IMAGE_INVERT_FILTER);
        }

        use.setAttribute("width", `${width}`);
        use.setAttribute("height", `${height}`);

        // We first apply `scale` transforms (horizontal/vertical mirroring)
        // on the <use> element, then apply translation and rotation
        // on the <g> element which wraps the <use>.
        // Doing this separately is a quick hack to to work around compositing
        // the transformations correctly (the transform-origin was not being
        // applied correctly).
        if (element.scale[0] !== 1 || element.scale[1] !== 1) {
          const translateX = element.scale[0] !== 1 ? -width : 0;
          const translateY = element.scale[1] !== 1 ? -height : 0;
          use.setAttribute(
            "transform",
            `scale(${element.scale[0]}, ${element.scale[1]}) translate(${translateX} ${translateY})`,
          );
        }

        const g = svgRoot.ownerDocument!.createElementNS(SVG_NS, "g");
        g.appendChild(use);
        g.setAttribute(
          "transform",
          `translate(${offsetX || 0} ${
            offsetY || 0
          }) rotate(${degree} ${cx} ${cy})`,
        );

        root.appendChild(g);
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
        const lines = element.text.replace(/\r\n?/g, "\n").split("\n");
        const lineHeight = element.height / lines.length;
        const verticalOffset = element.height - element.baseline;
        const horizontalOffset =
          element.textAlign === "center"
            ? element.width / 2
            : element.textAlign === "right"
            ? element.width
            : 0;
        const direction = isRTL(element.text) ? "rtl" : "ltr";
        const textAnchor =
          element.textAlign === "center"
            ? "middle"
            : element.textAlign === "right" || direction === "rtl"
            ? "end"
            : "start";
        for (let i = 0; i < lines.length; i++) {
          const text = svgRoot.ownerDocument!.createElementNS(SVG_NS, "text");
          text.textContent = lines[i];
          text.setAttribute("x", `${horizontalOffset}`);
          text.setAttribute("y", `${(i + 1) * lineHeight - verticalOffset}`);
          text.setAttribute("font-family", getFontFamilyString(element));
          text.setAttribute("font-size", `${element.fontSize}px`);
          text.setAttribute("fill", element.strokeColor);
          text.setAttribute("text-anchor", textAnchor);
          text.setAttribute("style", "white-space: pre;");
          text.setAttribute("direction", direction);
          node.appendChild(text);
        }
        root.appendChild(node);
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
