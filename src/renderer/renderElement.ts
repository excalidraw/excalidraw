import {
  ExcalidrawElement,
  ExcalidrawTextElement,
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
  hasBoundTextElement,
} from "../element/typeChecks";
import { getElementAbsoluteCoords } from "../element/bounds";
import type { RoughCanvas } from "roughjs/bin/canvas";
import type { Drawable } from "roughjs/bin/core";
import type { RoughSVG } from "roughjs/bin/svg";

import { StaticCanvasRenderConfig } from "../scene/types";
import { distance, getFontString, getFontFamilyString, isRTL } from "../utils";
import { getCornerRadius, isPathALoop, isRightAngle } from "../math";
import rough from "roughjs/bin/rough";
import {
  AppState,
  StaticCanvasAppState,
  BinaryFiles,
  Zoom,
  InteractiveCanvasAppState,
} from "../types";
import { getDefaultAppState } from "../appState";
import {
  BOUND_TEXT_PADDING,
  FRAME_STYLE,
  MAX_DECIMALS_FOR_SVG_EXPORT,
  MIME_TYPES,
  SVG_NS,
} from "../constants";
import { getStroke, StrokeOptions } from "perfect-freehand";
import {
  getBoundTextElement,
  getContainerCoords,
  getContainerElement,
  getLineHeightInPx,
  getBoundTextMaxHeight,
  getBoundTextMaxWidth,
} from "../element/textElement";
import { LinearElementEditor } from "../element/linearElementEditor";
import {
  createPlaceholderEmbeddableLabel,
  getEmbedLink,
} from "../element/embeddable";
import { getContainingFrame } from "../frame";
import { normalizeLink, toValidURL } from "../data/url";
import { ShapeCache } from "../scene/ShapeCache";

// using a stronger invert (100% vs our regular 93%) and saturate
// as a temp hack to make images in dark theme look closer to original
// color scheme (it's still not quite there and the colors look slightly
// desatured, alas...)
const IMAGE_INVERT_FILTER = "invert(100%) hue-rotate(180deg) saturate(1.25)";

const defaultAppState = getDefaultAppState();

const isPendingImageElement = (
  element: ExcalidrawElement,
  renderConfig: StaticCanvasRenderConfig,
) =>
  isInitializedImageElement(element) &&
  !renderConfig.imageCache.has(element.fileId);

const shouldResetImageFilter = (
  element: ExcalidrawElement,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState,
) => {
  return (
    appState.theme === "dark" &&
    isInitializedImageElement(element) &&
    !isPendingImageElement(element, renderConfig) &&
    renderConfig.imageCache.get(element.fileId)?.mimeType !== MIME_TYPES.svg
  );
};

const getCanvasPadding = (element: ExcalidrawElement) =>
  element.type === "freedraw" ? element.strokeWidth * 12 : 20;

export interface ExcalidrawElementWithCanvas {
  element: ExcalidrawElement | ExcalidrawTextElement;
  canvas: HTMLCanvasElement;
  theme: AppState["theme"];
  scale: number;
  zoomValue: AppState["zoom"]["value"];
  canvasOffsetX: number;
  canvasOffsetY: number;
  boundTextElementVersion: number | null;
  containingFrameOpacity: number;
}

const cappedElementCanvasSize = (
  element: NonDeletedExcalidrawElement,
  zoom: Zoom,
): {
  width: number;
  height: number;
  scale: number;
} => {
  // these limits are ballpark, they depend on specific browsers and device.
  // We've chosen lower limits to be safe. We might want to change these limits
  // based on browser/device type, if we get reports of low quality rendering
  // on zoom.
  //
  // ~ safari mobile canvas area limit
  const AREA_LIMIT = 16777216;
  // ~ safari width/height limit based on developer.mozilla.org.
  const WIDTH_HEIGHT_LIMIT = 32767;

  const padding = getCanvasPadding(element);

  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const elementWidth =
    isLinearElement(element) || isFreeDrawElement(element)
      ? distance(x1, x2)
      : element.width;
  const elementHeight =
    isLinearElement(element) || isFreeDrawElement(element)
      ? distance(y1, y2)
      : element.height;

  let width = elementWidth * window.devicePixelRatio + padding * 2;
  let height = elementHeight * window.devicePixelRatio + padding * 2;

  let scale: number = zoom.value;

  // rescale to ensure width and height is within limits
  if (
    width * scale > WIDTH_HEIGHT_LIMIT ||
    height * scale > WIDTH_HEIGHT_LIMIT
  ) {
    scale = Math.min(WIDTH_HEIGHT_LIMIT / width, WIDTH_HEIGHT_LIMIT / height);
  }

  // rescale to ensure canvas area is within limits
  if (width * height * scale * scale > AREA_LIMIT) {
    scale = Math.sqrt(AREA_LIMIT / (width * height));
  }

  width = Math.floor(width * scale);
  height = Math.floor(height * scale);

  return { width, height, scale };
};

const generateElementCanvas = (
  element: NonDeletedExcalidrawElement,
  zoom: Zoom,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState,
): ExcalidrawElementWithCanvas => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const padding = getCanvasPadding(element);

  const { width, height, scale } = cappedElementCanvasSize(element, zoom);

  canvas.width = width;
  canvas.height = height;

  let canvasOffsetX = 0;
  let canvasOffsetY = 0;

  if (isLinearElement(element) || isFreeDrawElement(element)) {
    const [x1, y1] = getElementAbsoluteCoords(element);

    canvasOffsetX =
      element.x > x1
        ? distance(element.x, x1) * window.devicePixelRatio * scale
        : 0;

    canvasOffsetY =
      element.y > y1
        ? distance(element.y, y1) * window.devicePixelRatio * scale
        : 0;

    context.translate(canvasOffsetX, canvasOffsetY);
  }

  context.save();
  context.translate(padding * scale, padding * scale);
  context.scale(
    window.devicePixelRatio * scale,
    window.devicePixelRatio * scale,
  );

  const rc = rough.canvas(canvas);

  // in dark theme, revert the image color filter
  if (shouldResetImageFilter(element, renderConfig, appState)) {
    context.filter = IMAGE_INVERT_FILTER;
  }

  drawElementOnCanvas(element, rc, context, renderConfig, appState);
  context.restore();

  return {
    element,
    canvas,
    theme: appState.theme,
    scale,
    zoomValue: zoom.value,
    canvasOffsetX,
    canvasOffsetY,
    boundTextElementVersion: getBoundTextElement(element)?.version || null,
    containingFrameOpacity: getContainingFrame(element)?.opacity || 100,
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
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState,
) => {
  context.globalAlpha =
    ((getContainingFrame(element)?.opacity ?? 100) * element.opacity) / 10000;
  switch (element.type) {
    case "rectangle":
    case "embeddable":
    case "diamond":
    case "ellipse": {
      context.lineJoin = "round";
      context.lineCap = "round";
      rc.draw(ShapeCache.get(element)!);
      break;
    }
    case "arrow":
    case "line": {
      context.lineJoin = "round";
      context.lineCap = "round";

      ShapeCache.get(element)!.forEach((shape) => {
        rc.draw(shape);
      });
      break;
    }
    case "freedraw": {
      // Draw directly to canvas
      context.save();
      context.fillStyle = element.strokeColor;

      const path = getFreeDrawPath2D(element) as Path2D;
      const fillShape = ShapeCache.get(element);

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
        drawImagePlaceholder(element, context, appState.zoom.value);
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

        const horizontalOffset =
          element.textAlign === "center"
            ? element.width / 2
            : element.textAlign === "right"
            ? element.width
            : 0;
        const lineHeightPx = getLineHeightInPx(
          element.fontSize,
          element.lineHeight,
        );
        const verticalOffset = element.height - element.baseline;
        for (let index = 0; index < lines.length; index++) {
          context.fillText(
            lines[index],
            horizontalOffset,
            (index + 1) * lineHeightPx - verticalOffset,
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

export const elementWithCanvasCache = new WeakMap<
  ExcalidrawElement,
  ExcalidrawElementWithCanvas
>();

const generateElementWithCanvas = (
  element: NonDeletedExcalidrawElement,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState,
) => {
  const zoom: Zoom = renderConfig ? appState.zoom : defaultAppState.zoom;
  const prevElementWithCanvas = elementWithCanvasCache.get(element);
  const shouldRegenerateBecauseZoom =
    prevElementWithCanvas &&
    prevElementWithCanvas.zoomValue !== zoom.value &&
    !appState?.shouldCacheIgnoreZoom;
  const boundTextElementVersion = getBoundTextElement(element)?.version || null;
  const containingFrameOpacity = getContainingFrame(element)?.opacity || 100;

  if (
    !prevElementWithCanvas ||
    shouldRegenerateBecauseZoom ||
    prevElementWithCanvas.theme !== appState.theme ||
    prevElementWithCanvas.boundTextElementVersion !== boundTextElementVersion ||
    prevElementWithCanvas.containingFrameOpacity !== containingFrameOpacity
  ) {
    const elementWithCanvas = generateElementCanvas(
      element,
      zoom,
      renderConfig,
      appState,
    );

    elementWithCanvasCache.set(element, elementWithCanvas);

    return elementWithCanvas;
  }
  return prevElementWithCanvas;
};

const drawElementFromCanvas = (
  elementWithCanvas: ExcalidrawElementWithCanvas,
  context: CanvasRenderingContext2D,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState,
) => {
  const element = elementWithCanvas.element;
  const padding = getCanvasPadding(element);
  const zoom = elementWithCanvas.scale;
  let [x1, y1, x2, y2] = getElementAbsoluteCoords(element);

  // Free draw elements will otherwise "shuffle" as the min x and y change
  if (isFreeDrawElement(element)) {
    x1 = Math.floor(x1);
    x2 = Math.ceil(x2);
    y1 = Math.floor(y1);
    y2 = Math.ceil(y2);
  }

  const cx = ((x1 + x2) / 2 + appState.scrollX) * window.devicePixelRatio;
  const cy = ((y1 + y2) / 2 + appState.scrollY) * window.devicePixelRatio;

  context.save();
  context.scale(1 / window.devicePixelRatio, 1 / window.devicePixelRatio);
  const boundTextElement = getBoundTextElement(element);

  if (isArrowElement(element) && boundTextElement) {
    const tempCanvas = document.createElement("canvas");
    const tempCanvasContext = tempCanvas.getContext("2d")!;

    // Take max dimensions of arrow canvas so that when canvas is rotated
    // the arrow doesn't get clipped
    const maxDim = Math.max(distance(x1, x2), distance(y1, y2));
    tempCanvas.width =
      maxDim * window.devicePixelRatio * zoom +
      padding * elementWithCanvas.scale * 10;
    tempCanvas.height =
      maxDim * window.devicePixelRatio * zoom +
      padding * elementWithCanvas.scale * 10;
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

    context.translate(cx, cy);
    context.drawImage(
      tempCanvas,
      (-(x2 - x1) / 2) * window.devicePixelRatio - offsetX / zoom - padding,
      (-(y2 - y1) / 2) * window.devicePixelRatio - offsetY / zoom - padding,
      tempCanvas.width / zoom,
      tempCanvas.height / zoom,
    );
  } else {
    // we translate context to element center so that rotation and scale
    // originates from the element center
    context.translate(cx, cy);

    context.rotate(element.angle);

    if (
      "scale" in elementWithCanvas.element &&
      !isPendingImageElement(element, renderConfig)
    ) {
      context.scale(
        elementWithCanvas.element.scale[0],
        elementWithCanvas.element.scale[1],
      );
    }

    // revert afterwards we don't have account for it during drawing
    context.translate(-cx, -cy);

    context.drawImage(
      elementWithCanvas.canvas!,
      (x1 + appState.scrollX) * window.devicePixelRatio -
        (padding * elementWithCanvas.scale) / elementWithCanvas.scale,
      (y1 + appState.scrollY) * window.devicePixelRatio -
        (padding * elementWithCanvas.scale) / elementWithCanvas.scale,
      elementWithCanvas.canvas!.width / elementWithCanvas.scale,
      elementWithCanvas.canvas!.height / elementWithCanvas.scale,
    );

    if (
      import.meta.env.VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX ===
        "true" &&
      hasBoundTextElement(element)
    ) {
      const textElement = getBoundTextElement(
        element,
      ) as ExcalidrawTextElementWithContainer;
      const coords = getContainerCoords(element);
      context.strokeStyle = "#c92a2a";
      context.lineWidth = 3;
      context.strokeRect(
        (coords.x + appState.scrollX) * window.devicePixelRatio,
        (coords.y + appState.scrollY) * window.devicePixelRatio,
        getBoundTextMaxWidth(element) * window.devicePixelRatio,
        getBoundTextMaxHeight(element, textElement) * window.devicePixelRatio,
      );
    }
  }
  context.restore();

  // Clear the nested element we appended to the DOM
};

export const renderSelectionElement = (
  element: NonDeletedExcalidrawElement,
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
) => {
  context.save();
  context.translate(element.x + appState.scrollX, element.y + appState.scrollY);
  context.fillStyle = "rgba(0, 0, 200, 0.04)";

  // render from 0.5px offset  to get 1px wide line
  // https://stackoverflow.com/questions/7530593/html5-canvas-and-line-width/7531540#7531540
  // TODO can be be improved by offseting to the negative when user selects
  // from right to left
  const offset = 0.5 / appState.zoom.value;

  context.fillRect(offset, offset, element.width, element.height);
  context.lineWidth = 1 / appState.zoom.value;
  context.strokeStyle = " rgb(105, 101, 219)";
  context.strokeRect(offset, offset, element.width, element.height);

  context.restore();
};

export const renderElement = (
  element: NonDeletedExcalidrawElement,
  rc: RoughCanvas,
  context: CanvasRenderingContext2D,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState,
) => {
  switch (element.type) {
    case "frame": {
      if (
        !renderConfig.isExporting &&
        appState.frameRendering.enabled &&
        appState.frameRendering.outline
      ) {
        context.save();
        context.translate(
          element.x + appState.scrollX,
          element.y + appState.scrollY,
        );
        context.fillStyle = "rgba(0, 0, 200, 0.04)";

        context.lineWidth = 2 / appState.zoom.value;
        context.strokeStyle = FRAME_STYLE.strokeColor;

        if (FRAME_STYLE.radius && context.roundRect) {
          context.beginPath();
          context.roundRect(
            0,
            0,
            element.width,
            element.height,
            FRAME_STYLE.radius / appState.zoom.value,
          );
          context.stroke();
          context.closePath();
        } else {
          context.strokeRect(0, 0, element.width, element.height);
        }

        context.restore();
      }
      break;
    }
    case "freedraw": {
      // TODO investigate if we can do this in situ. Right now we need to call
      // beforehand because math helpers (such as getElementAbsoluteCoords)
      // rely on existing shapes
      ShapeCache.generateElementShape(element);

      if (renderConfig.isExporting) {
        const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
        const cx = (x1 + x2) / 2 + appState.scrollX;
        const cy = (y1 + y2) / 2 + appState.scrollY;
        const shiftX = (x2 - x1) / 2 - (element.x - x1);
        const shiftY = (y2 - y1) / 2 - (element.y - y1);
        context.save();
        context.translate(cx, cy);
        context.rotate(element.angle);
        context.translate(-shiftX, -shiftY);
        drawElementOnCanvas(element, rc, context, renderConfig, appState);
        context.restore();
      } else {
        const elementWithCanvas = generateElementWithCanvas(
          element,
          renderConfig,
          appState,
        );
        drawElementFromCanvas(
          elementWithCanvas,
          context,
          renderConfig,
          appState,
        );
      }

      break;
    }
    case "rectangle":
    case "diamond":
    case "ellipse":
    case "line":
    case "arrow":
    case "image":
    case "text":
    case "embeddable": {
      // TODO investigate if we can do this in situ. Right now we need to call
      // beforehand because math helpers (such as getElementAbsoluteCoords)
      // rely on existing shapes
      ShapeCache.generateElementShape(element, renderConfig.isExporting);
      if (renderConfig.isExporting) {
        const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
        const cx = (x1 + x2) / 2 + appState.scrollX;
        const cy = (y1 + y2) / 2 + appState.scrollY;
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

        if (shouldResetImageFilter(element, renderConfig, appState)) {
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

          drawElementOnCanvas(
            element,
            tempRc,
            tempCanvasContext,
            renderConfig,
            appState,
          );

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

          if (element.type === "image") {
            // note: scale must be applied *after* rotating
            context.scale(element.scale[0], element.scale[1]);
          }

          context.translate(-shiftX, -shiftY);
          drawElementOnCanvas(element, rc, context, renderConfig, appState);
        }

        context.restore();
        // not exporting → optimized rendering (cache & render from element
        // canvases)
      } else {
        const elementWithCanvas = generateElementWithCanvas(
          element,
          renderConfig,
          appState,
        );

        const currentImageSmoothingStatus = context.imageSmoothingEnabled;

        if (
          // do not disable smoothing during zoom as blurry shapes look better
          // on low resolution (while still zooming in) than sharp ones
          !appState?.shouldCacheIgnoreZoom &&
          // angle is 0 -> always disable smoothing
          (!element.angle ||
            // or check if angle is a right angle in which case we can still
            // disable smoothing without adversely affecting the result
            isRightAngle(element.angle))
        ) {
          // Disabling smoothing makes output much sharper, especially for
          // text. Unless for non-right angles, where the aliasing is really
          // terrible on Chromium.
          //
          // Note that `context.imageSmoothingQuality="high"` has almost
          // zero effect.
          //
          context.imageSmoothingEnabled = false;
        }

        drawElementFromCanvas(
          elementWithCanvas,
          context,
          renderConfig,
          appState,
        );

        // reset
        context.imageSmoothingEnabled = currentImageSmoothingStatus;
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

const maybeWrapNodesInFrameClipPath = (
  element: NonDeletedExcalidrawElement,
  root: SVGElement,
  nodes: SVGElement[],
  exportedFrameId?: string | null,
) => {
  const frame = getContainingFrame(element);
  if (frame && frame.id === exportedFrameId) {
    const g = root.ownerDocument!.createElementNS(SVG_NS, "g");
    g.setAttributeNS(SVG_NS, "clip-path", `url(#${frame.id})`);
    nodes.forEach((node) => g.appendChild(node));
    return g;
  }

  return null;
};

export const renderElementToSvg = (
  element: NonDeletedExcalidrawElement,
  rsvg: RoughSVG,
  svgRoot: SVGElement,
  files: BinaryFiles,
  offsetX: number,
  offsetY: number,
  exportWithDarkMode?: boolean,
  exportingFrameId?: string | null,
  renderEmbeddables?: boolean,
) => {
  const offset = { x: offsetX, y: offsetY };
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

  // element to append node to, most of the time svgRoot
  let root = svgRoot;

  // if the element has a link, create an anchor tag and make that the new root
  if (element.link) {
    const anchorTag = svgRoot.ownerDocument!.createElementNS(SVG_NS, "a");
    anchorTag.setAttribute("href", normalizeLink(element.link));
    root.appendChild(anchorTag);
    root = anchorTag;
  }

  const opacity =
    ((getContainingFrame(element)?.opacity ?? 100) * element.opacity) / 10000;

  switch (element.type) {
    case "selection": {
      // Since this is used only during editing experience, which is canvas based,
      // this should not happen
      throw new Error("Selection rendering is not supported for SVG");
    }
    case "rectangle":
    case "diamond":
    case "ellipse": {
      const shape = ShapeCache.generateElementShape(element);
      const node = roughSVGDrawWithPrecision(
        rsvg,
        shape,
        MAX_DECIMALS_FOR_SVG_EXPORT,
      );
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

      const g = maybeWrapNodesInFrameClipPath(
        element,
        root,
        [node],
        exportingFrameId,
      );

      g ? root.appendChild(g) : root.appendChild(node);
      break;
    }
    case "embeddable": {
      // render placeholder rectangle
      const shape = ShapeCache.generateElementShape(element, true);
      const node = roughSVGDrawWithPrecision(
        rsvg,
        shape,
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

      const label: ExcalidrawElement =
        createPlaceholderEmbeddableLabel(element);
      renderElementToSvg(
        label,
        rsvg,
        root,
        files,
        label.x + offset.x - element.x,
        label.y + offset.y - element.y,
        exportWithDarkMode,
        exportingFrameId,
        renderEmbeddables,
      );

      // render embeddable element + iframe
      const embeddableNode = roughSVGDrawWithPrecision(
        rsvg,
        shape,
        MAX_DECIMALS_FOR_SVG_EXPORT,
      );
      embeddableNode.setAttribute("stroke-linecap", "round");
      embeddableNode.setAttribute(
        "transform",
        `translate(${offsetX || 0} ${
          offsetY || 0
        }) rotate(${degree} ${cx} ${cy})`,
      );
      while (embeddableNode.firstChild) {
        embeddableNode.removeChild(embeddableNode.firstChild);
      }
      const radius = getCornerRadius(
        Math.min(element.width, element.height),
        element,
      );

      const embedLink = getEmbedLink(toValidURL(element.link || ""));

      // if rendering embeddables explicitly disabled or
      // embedding documents via srcdoc (which doesn't seem to work for SVGs)
      // replace with a link instead
      if (renderEmbeddables === false || embedLink?.type === "document") {
        const anchorTag = svgRoot.ownerDocument!.createElementNS(SVG_NS, "a");
        anchorTag.setAttribute("href", normalizeLink(element.link || ""));
        anchorTag.setAttribute("target", "_blank");
        anchorTag.setAttribute("rel", "noopener noreferrer");
        anchorTag.style.borderRadius = `${radius}px`;

        embeddableNode.appendChild(anchorTag);
      } else {
        const foreignObject = svgRoot.ownerDocument!.createElementNS(
          SVG_NS,
          "foreignObject",
        );
        foreignObject.style.width = `${element.width}px`;
        foreignObject.style.height = `${element.height}px`;
        foreignObject.style.border = "none";
        const div = foreignObject.ownerDocument!.createElementNS(SVG_NS, "div");
        div.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
        div.style.width = "100%";
        div.style.height = "100%";
        const iframe = div.ownerDocument!.createElement("iframe");
        iframe.src = embedLink?.link ?? "";
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.style.borderRadius = `${radius}px`;
        iframe.style.top = "0";
        iframe.style.left = "0";
        iframe.allowFullscreen = true;
        div.appendChild(iframe);
        foreignObject.appendChild(div);

        embeddableNode.appendChild(foreignObject);
      }

      root.appendChild(embeddableNode);
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
      const group = svgRoot.ownerDocument!.createElementNS(SVG_NS, "g");
      if (boundText) {
        group.setAttribute("mask", `url(#mask-${element.id})`);
      }
      group.setAttribute("stroke-linecap", "round");

      const shapes = ShapeCache.generateElementShape(element);
      shapes.forEach((shape) => {
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

      const g = maybeWrapNodesInFrameClipPath(
        element,
        root,
        [group, maskPath],
        exportingFrameId,
      );
      if (g) {
        root.appendChild(g);
      } else {
        root.appendChild(group);
        root.append(maskPath);
      }
      break;
    }
    case "freedraw": {
      const backgroundFillShape = ShapeCache.generateElementShape(element);
      const node = backgroundFillShape
        ? roughSVGDrawWithPrecision(
            rsvg,
            backgroundFillShape,
            MAX_DECIMALS_FOR_SVG_EXPORT,
          )
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

      const g = maybeWrapNodesInFrameClipPath(
        element,
        root,
        [node],
        exportingFrameId,
      );

      g ? root.appendChild(g) : root.appendChild(node);
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
        use.setAttribute("opacity", `${opacity}`);

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

        const clipG = maybeWrapNodesInFrameClipPath(
          element,
          root,
          [g],
          exportingFrameId,
        );
        clipG ? root.appendChild(clipG) : root.appendChild(g);
      }
      break;
    }
    // frames are not rendered and only acts as a container
    case "frame": {
      break;
    }
    default: {
      if (isTextElement(element)) {
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
        const lineHeightPx = getLineHeightInPx(
          element.fontSize,
          element.lineHeight,
        );
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
          text.setAttribute("y", `${i * lineHeightPx}`);
          text.setAttribute("font-family", getFontFamilyString(element));
          text.setAttribute("font-size", `${element.fontSize}px`);
          text.setAttribute("fill", element.strokeColor);
          text.setAttribute("text-anchor", textAnchor);
          text.setAttribute("style", "white-space: pre;");
          text.setAttribute("direction", direction);
          text.setAttribute("dominant-baseline", "text-before-edge");
          node.appendChild(text);
        }

        const g = maybeWrapNodesInFrameClipPath(
          element,
          root,
          [node],
          exportingFrameId,
        );

        g ? root.appendChild(g) : root.appendChild(node);
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
