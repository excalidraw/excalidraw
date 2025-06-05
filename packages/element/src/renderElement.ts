import rough from "roughjs/bin/rough";
import { getStroke } from "perfect-freehand";

import { isRightAngleRads } from "@excalidraw/math";

import { isRabbitElement, isRabbitSearchBoxElement, isRabbitImageElement, isRabbitImageTabsElement, isRabbitColorPaletteElement } from "./rabbitElement";

import {
  BOUND_TEXT_PADDING,
  DEFAULT_REDUCED_GLOBAL_ALPHA,
  ELEMENT_READY_TO_ERASE_OPACITY,
  FRAME_STYLE,
  MIME_TYPES,
  THEME,
  distance,
  getFontString,
  isRTL,
  getVerticalOffset,
} from "@excalidraw/common";

import type {
  AppState,
  StaticCanvasAppState,
  Zoom,
  InteractiveCanvasAppState,
  ElementsPendingErasure,
  PendingExcalidrawElements,
  NormalizedZoomValue,
} from "@excalidraw/excalidraw/types";

import type {
  StaticCanvasRenderConfig,
  RenderableElementsMap,
  InteractiveCanvasRenderConfig,
} from "@excalidraw/excalidraw/scene/types";

import { getElementAbsoluteCoords } from "./bounds";
import { getUncroppedImageElement } from "./cropElement";
import { LinearElementEditor } from "./linearElementEditor";
import {
  getBoundTextElement,
  getContainerCoords,
  getContainerElement,
  getBoundTextMaxHeight,
  getBoundTextMaxWidth,
} from "./textElement";
import { getLineHeightInPx } from "./textMeasurements";
import {
  isTextElement,
  isLinearElement,
  isFreeDrawElement,
  isInitializedImageElement,
  isArrowElement,
  hasBoundTextElement,
  isMagicFrameElement,
  isImageElement,
} from "./typeChecks";
import { getContainingFrame } from "./frame";
import { getCornerRadius } from "./shapes";

import { ShapeCache } from "./ShapeCache";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawImageElement,
  ExcalidrawTextElementWithContainer,
  ExcalidrawFrameLikeElement,
  NonDeletedSceneElementsMap,
  ElementsMap,
} from "./types";

import type {
  RabbitElement
} from "./rabbitElement";

import type { StrokeOptions } from "perfect-freehand";
import type { RoughCanvas } from "roughjs/bin/canvas";


const rabbitImageCache: Record<string, HTMLImageElement> = {};

function getCachedRabbitImage(url: string): HTMLImageElement {
  let img = rabbitImageCache[url];
  if (!img) {
    img = new Image();
    img.src = url;
    // no-op onload; we'll rely on the next Excalidraw redraw
    rabbitImageCache[url] = img;
  }
  return img;
}


// using a stronger invert (100% vs our regular 93%) and saturate
// as a temp hack to make images in dark theme look closer to original
// color scheme (it's still not quite there and the colors look slightly
// desatured, alas...)
export const IMAGE_INVERT_FILTER =
  "invert(100%) hue-rotate(180deg) saturate(1.25)";

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
    appState.theme === THEME.DARK &&
    isInitializedImageElement(element) &&
    !isPendingImageElement(element, renderConfig) &&
    renderConfig.imageCache.get(element.fileId)?.mimeType !== MIME_TYPES.svg
  );
};

const getCanvasPadding = (element: ExcalidrawElement) => {
  switch (element.type) {
    case "freedraw":
      return element.strokeWidth * 12;
    case "text":
      return element.fontSize / 2;
    default:
      return 20;
  }
};

export const getRenderOpacity = (
  element: ExcalidrawElement,
  containingFrame: ExcalidrawFrameLikeElement | null,
  elementsPendingErasure: ElementsPendingErasure,
  pendingNodes: Readonly<PendingExcalidrawElements> | null,
  globalAlpha: number = 1,
) => {
  // multiplying frame opacity with element opacity to combine them
  // (e.g. frame 50% and element 50% opacity should result in 25% opacity)
  let opacity =
    (((containingFrame?.opacity ?? 100) * element.opacity) / 10000) *
    globalAlpha;

  // if pending erasure, multiply again to combine further
  // (so that erasing always results in lower opacity than original)
  if (
    elementsPendingErasure.has(element.id) ||
    (pendingNodes && pendingNodes.some((node) => node.id === element.id)) ||
    (containingFrame && elementsPendingErasure.has(containingFrame.id))
  ) {
    opacity *= ELEMENT_READY_TO_ERASE_OPACITY / 100;
  }

  return opacity;
};

export interface ExcalidrawElementWithCanvas {
  element: ExcalidrawElement | ExcalidrawTextElement;
  canvas: HTMLCanvasElement;
  theme: AppState["theme"];
  scale: number;
  angle: number;
  zoomValue: AppState["zoom"]["value"];
  canvasOffsetX: number;
  canvasOffsetY: number;
  boundTextElementVersion: number | null;
  imageCrop: ExcalidrawImageElement["crop"] | null;
  containingFrameOpacity: number;
  boundTextCanvas: HTMLCanvasElement;
}

const cappedElementCanvasSize = (
  element: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
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

  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
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
  elementsMap: NonDeletedSceneElementsMap,
  zoom: Zoom,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState,
): ExcalidrawElementWithCanvas | null => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const padding = getCanvasPadding(element);

  const { width, height, scale } = cappedElementCanvasSize(
    element,
    elementsMap,
    zoom,
  );

  if (!width || !height) {
    return null;
  }

  canvas.width = width;
  canvas.height = height;

  let canvasOffsetX = -100;
  let canvasOffsetY = 0;

  if (isLinearElement(element) || isFreeDrawElement(element)) {
    const [x1, y1] = getElementAbsoluteCoords(element, elementsMap);

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

  const boundTextElement = getBoundTextElement(element, elementsMap);
  const boundTextCanvas = document.createElement("canvas");
  const boundTextCanvasContext = boundTextCanvas.getContext("2d")!;

  if (isArrowElement(element) && boundTextElement) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    // Take max dimensions of arrow canvas so that when canvas is rotated
    // the arrow doesn't get clipped
    const maxDim = Math.max(distance(x1, x2), distance(y1, y2));
    boundTextCanvas.width =
      maxDim * window.devicePixelRatio * scale + padding * scale * 10;
    boundTextCanvas.height =
      maxDim * window.devicePixelRatio * scale + padding * scale * 10;
    boundTextCanvasContext.translate(
      boundTextCanvas.width / 2,
      boundTextCanvas.height / 2,
    );
    boundTextCanvasContext.rotate(element.angle);
    boundTextCanvasContext.drawImage(
      canvas!,
      -canvas.width / 2,
      -canvas.height / 2,
      canvas.width,
      canvas.height,
    );

    const [, , , , boundTextCx, boundTextCy] = getElementAbsoluteCoords(
      boundTextElement,
      elementsMap,
    );

    boundTextCanvasContext.rotate(-element.angle);
    const offsetX = (boundTextCanvas.width - canvas!.width) / 2;
    const offsetY = (boundTextCanvas.height - canvas!.height) / 2;
    const shiftX =
      boundTextCanvas.width / 2 -
      (boundTextCx - x1) * window.devicePixelRatio * scale -
      offsetX -
      padding * scale;

    const shiftY =
      boundTextCanvas.height / 2 -
      (boundTextCy - y1) * window.devicePixelRatio * scale -
      offsetY -
      padding * scale;
    boundTextCanvasContext.translate(-shiftX, -shiftY);
    // Clear the bound text area
    boundTextCanvasContext.clearRect(
      -(boundTextElement.width / 2 + BOUND_TEXT_PADDING) *
      window.devicePixelRatio *
      scale,
      -(boundTextElement.height / 2 + BOUND_TEXT_PADDING) *
      window.devicePixelRatio *
      scale,
      (boundTextElement.width + BOUND_TEXT_PADDING * 2) *
      window.devicePixelRatio *
      scale,
      (boundTextElement.height + BOUND_TEXT_PADDING * 2) *
      window.devicePixelRatio *
      scale,
    );
  }

  return {
    element,
    canvas,
    theme: appState.theme,
    scale,
    zoomValue: zoom.value,
    canvasOffsetX,
    canvasOffsetY,
    boundTextElementVersion:
      getBoundTextElement(element, elementsMap)?.version || null,
    containingFrameOpacity:
      getContainingFrame(element, elementsMap)?.opacity || 100,
    boundTextCanvas,
    angle: element.angle,
    imageCrop: isImageElement(element) ? element.crop : null,
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
  switch (element.type) {
    case "rectangle":
    case "iframe":
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
        if (element.roundness && context.roundRect) {
          context.beginPath();
          context.roundRect(
            0,
            0,
            element.width,
            element.height,
            getCornerRadius(Math.min(element.width, element.height), element),
          );
          context.clip();
        }

        const { x, y, width, height } = element.crop
          ? element.crop
          : {
            x: 0,
            y: 0,
            width: img.naturalWidth,
            height: img.naturalHeight,
          };

        context.drawImage(
          img,
          x,
          y,
          width,
          height,
          0 /* hardcoded for the selection box*/,
          0,
          element.width,
          element.height,
        );
      } else {
        drawImagePlaceholder(element, context);
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

        const verticalOffset = getVerticalOffset(
          element.fontFamily,
          element.fontSize,
          lineHeightPx,
        );
        for (let index = 0; index < lines.length; index++) {
          context.fillText(
            lines[index],
            horizontalOffset,
            index * lineHeightPx + verticalOffset,
          );
        }
        const maxLineWidth = Math.max(
          ...lines.map((line) => context.measureText(line).width),
        );
        const boxWidth = maxLineWidth + 2 * BOUND_TEXT_PADDING;
        const boxHeight = lines.length * lineHeightPx + 2 * BOUND_TEXT_PADDING;

        const boxX =
          horizontalOffset -
          (element.textAlign === "center"
            ? boxWidth / 2
            : element.textAlign === "right"
              ? boxWidth
              : 0);
        const boxY = -BOUND_TEXT_PADDING;

        context.save();
        context.strokeStyle = "rgba(0,0,0,0.5)";
        context.lineWidth = 3;
        const radius = 6;
        context.beginPath();
        context.moveTo(boxX + radius, boxY);
        context.lineTo(boxX + boxWidth - radius, boxY);
        context.quadraticCurveTo(
          boxX + boxWidth,
          boxY,
          boxX + boxWidth,
          boxY + radius,
        );
        context.lineTo(boxX + boxWidth, boxY + boxHeight - radius);
        context.quadraticCurveTo(
          boxX + boxWidth,
          boxY + boxHeight,
          boxX + boxWidth - radius,
          boxY + boxHeight,
        );
        context.lineTo(boxX + radius, boxY + boxHeight);
        context.quadraticCurveTo(
          boxX,
          boxY + boxHeight,
          boxX,
          boxY + boxHeight - radius,
        );
        context.lineTo(boxX, boxY + radius);
        context.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
        context.closePath();
        context.stroke(); context.restore();
        if (shouldTemporarilyAttach) {
          context.canvas.remove();
        }
      } else {
        throw new Error(`Unimplemented type ${element.type}`);
      }
    }
  }
};

export const elementWithCanvasCache = new WeakMap<
  ExcalidrawElement,
  ExcalidrawElementWithCanvas
>();

const generateElementWithCanvas = (
  element: NonDeletedExcalidrawElement,
  elementsMap: NonDeletedSceneElementsMap,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState,
) => {
  const zoom: Zoom = renderConfig
    ? appState.zoom
    : {
      value: 1 as NormalizedZoomValue,
    };
  const prevElementWithCanvas = elementWithCanvasCache.get(element);
  const shouldRegenerateBecauseZoom =
    prevElementWithCanvas &&
    prevElementWithCanvas.zoomValue !== zoom.value &&
    !appState?.shouldCacheIgnoreZoom;
  const boundTextElement = getBoundTextElement(element, elementsMap);
  const boundTextElementVersion = boundTextElement?.version || null;
  const imageCrop = isImageElement(element) ? element.crop : null;

  const containingFrameOpacity =
    getContainingFrame(element, elementsMap)?.opacity || 100;

  if (
    !prevElementWithCanvas ||
    shouldRegenerateBecauseZoom ||
    prevElementWithCanvas.theme !== appState.theme ||
    prevElementWithCanvas.boundTextElementVersion !== boundTextElementVersion ||
    prevElementWithCanvas.imageCrop !== imageCrop ||
    prevElementWithCanvas.containingFrameOpacity !== containingFrameOpacity ||
    // since we rotate the canvas when copying from cached canvas, we don't
    // regenerate the cached canvas. But we need to in case of labels which are
    // cached alongside the arrow, and we want the labels to remain unrotated
    // with respect to the arrow.
    (isArrowElement(element) &&
      boundTextElement &&
      element.angle !== prevElementWithCanvas.angle)
  ) {
    const elementWithCanvas = generateElementCanvas(
      element,
      elementsMap,
      zoom,
      renderConfig,
      appState,
    );

    if (!elementWithCanvas) {
      return null;
    }

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
  allElementsMap: NonDeletedSceneElementsMap,
) => {
  const element = elementWithCanvas.element;
  const padding = getCanvasPadding(element);
  const zoom = elementWithCanvas.scale;
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, allElementsMap);
  const cx = ((x1 + x2) / 2 + appState.scrollX) * window.devicePixelRatio;
  const cy = ((y1 + y2) / 2 + appState.scrollY) * window.devicePixelRatio;

  context.save();
  context.scale(1 / window.devicePixelRatio, 1 / window.devicePixelRatio);

  const boundTextElement = getBoundTextElement(element, allElementsMap);

  if (isArrowElement(element) && boundTextElement) {
    const offsetX =
      (elementWithCanvas.boundTextCanvas.width -
        elementWithCanvas.canvas!.width) /
      2;
    const offsetY =
      (elementWithCanvas.boundTextCanvas.height -
        elementWithCanvas.canvas!.height) /
      2;
    context.translate(cx, cy);
    context.drawImage(
      elementWithCanvas.boundTextCanvas,
      (-(x2 - x1) / 2) * window.devicePixelRatio - offsetX / zoom - padding,
      (-(y2 - y1) / 2) * window.devicePixelRatio - offsetY / zoom - padding,
      elementWithCanvas.boundTextCanvas.width / zoom,
      elementWithCanvas.boundTextCanvas.height / zoom,
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
        allElementsMap,
      ) as ExcalidrawTextElementWithContainer;
      const coords = getContainerCoords(element);
      context.strokeStyle = "#c92a2a";
      context.lineWidth = 3;
      context.strokeRect(
        (coords.x + appState.scrollX) * window.devicePixelRatio,
        (coords.y + appState.scrollY) * window.devicePixelRatio,
        getBoundTextMaxWidth(element, textElement) * window.devicePixelRatio,
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
  selectionColor: InteractiveCanvasRenderConfig["selectionColor"],
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
  context.strokeStyle = selectionColor;
  context.strokeRect(offset, offset, element.width, element.height);

  context.restore();
};

export const renderElement = (
  element: NonDeletedExcalidrawElement,
  elementsMap: RenderableElementsMap,
  allElementsMap: NonDeletedSceneElementsMap,
  rc: RoughCanvas,
  context: CanvasRenderingContext2D,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState,
) => {
  const reduceAlphaForSelection =
    appState.openDialog?.name === "elementLinkSelector" &&
    !appState.selectedElementIds[element.id] &&
    !appState.hoveredElementIds[element.id];

  context.globalAlpha = getRenderOpacity(
    element,
    getContainingFrame(element, elementsMap),
    renderConfig.elementsPendingErasure,
    renderConfig.pendingFlowchartNodes,
    reduceAlphaForSelection ? DEFAULT_REDUCED_GLOBAL_ALPHA : 1,
  );

  // Check for RabbitElements
  if (isRabbitElement(element)) {
    renderRabbitElement(
      element,
      context,
      appState,
      renderConfig
    );
    return;
  }



  switch (element.type) {
    case "magicframe":
    case "frame": {
      if (appState.frameRendering.enabled && appState.frameRendering.outline) {
        context.save();
        context.translate(
          element.x + appState.scrollX,
          element.y + appState.scrollY,
        );
        context.fillStyle = "rgba(0, 0, 200, 0.04)";

        context.lineWidth = FRAME_STYLE.strokeWidth / appState.zoom.value;
        context.strokeStyle = FRAME_STYLE.strokeColor;

        // TODO change later to only affect AI frames
        if (isMagicFrameElement(element)) {
          context.strokeStyle =
            appState.theme === THEME.LIGHT ? "#7affd7" : "#1d8264";
        }

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
      ShapeCache.generateElementShape(element, null);

      if (renderConfig.isExporting) {
        const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
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
          allElementsMap,
          renderConfig,
          appState,
        );
        if (!elementWithCanvas) {
          return;
        }

        drawElementFromCanvas(
          elementWithCanvas,
          context,
          renderConfig,
          appState,
          allElementsMap,
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
    case "iframe":
    case "embeddable": {
      // TODO investigate if we can do this in situ. Right now we need to call
      // beforehand because math helpers (such as getElementAbsoluteCoords)
      // rely on existing shapes
      ShapeCache.generateElementShape(element, renderConfig);
      if (renderConfig.isExporting) {
        const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
        const cx = (x1 + x2) / 2 + appState.scrollX;
        const cy = (y1 + y2) / 2 + appState.scrollY;
        let shiftX = (x2 - x1) / 2 - (element.x - x1);
        let shiftY = (y2 - y1) / 2 - (element.y - y1);
        if (isTextElement(element)) {
          const container = getContainerElement(element, elementsMap);
          if (isArrowElement(container)) {
            const boundTextCoords =
              LinearElementEditor.getBoundTextElementPosition(
                container,
                element as ExcalidrawTextElementWithContainer,
                elementsMap,
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
        const boundTextElement = getBoundTextElement(element, elementsMap);

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
          const [, , , , boundTextCx, boundTextCy] = getElementAbsoluteCoords(
            boundTextElement,
            elementsMap,
          );
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
          allElementsMap,
          renderConfig,
          appState,
        );

        if (!elementWithCanvas) {
          return;
        }

        const currentImageSmoothingStatus = context.imageSmoothingEnabled;

        if (
          // do not disable smoothing during zoom as blurry shapes look better
          // on low resolution (while still zooming in) than sharp ones
          !appState?.shouldCacheIgnoreZoom &&
          // angle is 0 -> always disable smoothing
          (!element.angle ||
            // or check if angle is a right angle in which case we can still
            // disable smoothing without adversely affecting the result
            // We need less-than comparison because of FP artihmetic
            isRightAngleRads(element.angle))
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

        if (
          element.id === appState.croppingElementId &&
          isImageElement(elementWithCanvas.element) &&
          elementWithCanvas.element.crop !== null
        ) {
          context.save();
          context.globalAlpha = 0.1;

          const uncroppedElementCanvas = generateElementCanvas(
            getUncroppedImageElement(elementWithCanvas.element, elementsMap),
            allElementsMap,
            appState.zoom,
            renderConfig,
            appState,
          );

          if (uncroppedElementCanvas) {
            drawElementFromCanvas(
              uncroppedElementCanvas,
              context,
              renderConfig,
              appState,
              allElementsMap,
            );
          }

          context.restore();
        }

        drawElementFromCanvas(
          elementWithCanvas,
          context,
          renderConfig,
          appState,
          allElementsMap,
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

  context.globalAlpha = 1;
};

const getContrastColor = (hexColor: string): string => {
  // Remove # if present
  const color = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black or white based on luminance
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
};


// Add the renderRabbitElement function
const renderRabbitElement = (
  element: RabbitElement,
  context: CanvasRenderingContext2D,
  appState: StaticCanvasAppState,
  renderConfig: StaticCanvasRenderConfig,
) => {
  if (isRabbitSearchBoxElement(element)) {
     context.save();

    context.translate(
      element.x + appState.scrollX,
      element.y + appState.scrollY
    );

    // Fill with white background
    context.fillStyle = element.backgroundColor;

    // Get the corner radius from the element's roundness property
    const radius = getCornerRadius(
      Math.min(element.width, element.height),
      element
    );

    // Draw rounded rectangle
    if (context.roundRect) {
      context.beginPath();
      context.roundRect(0, 0, element.width, element.height, radius);
      context.fill();

      // Draw border
      context.strokeStyle = element.strokeColor;
      context.lineWidth = element.strokeWidth;
      context.stroke();
    } else {
      // Fallback for browsers that don't support roundRect
      context.beginPath();
      context.moveTo(radius, 0);
      context.lineTo(element.width - radius, 0);
      context.quadraticCurveTo(element.width, 0, element.width, radius);
      context.lineTo(element.width, element.height - radius);
      context.quadraticCurveTo(element.width, element.height, element.width - radius, element.height);
      context.lineTo(radius, element.height);
      context.quadraticCurveTo(0, element.height, 0, element.height - radius);
      context.lineTo(0, radius);
      context.quadraticCurveTo(0, 0, radius, 0);
      context.closePath();
      context.fill();
      context.stroke();
    }

    // Set text properties
    // context.font = getFontString(element);
    context.font = "15px Assistant"
    context.fillStyle = element.strokeColor;
    context.textAlign = "left"; // Force left alignment for searchbox behavior

    // Calculate text position
    const padding = 10;
    const iconSpace = element.hasIcon ? 30 : 0;

    const horizontalOffset = padding; // Always start text at left with padding

    const lineHeightPx = getLineHeightInPx(
      element.fontSize,
      element.lineHeight,
    );

    const verticalOffset = getVerticalOffset(
      element.fontFamily,
      element.fontSize,
      lineHeightPx,
    );

    const displayText = element.isEditing
      ? element.currentText
      : (element.currentText.trim() !== "" ? element.currentText : element.text);

    const maxTextWidth = element.width - 2 * padding - (element.hasIcon ? 30 : 0);
    const words = displayText.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    for (let word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = context.measureText(testLine).width;
      if (testWidth < maxTextWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    for (let i = 0; i < lines.length; i++) {
      context.fillText(
        lines[i],
        horizontalOffset,
        i * lineHeightPx + verticalOffset + element.height / 2 - (lines.length * lineHeightPx) / 2,
      );
    }

    const totalTextHeight = lines.length * lineHeightPx + padding * 2;

    if (element.height < totalTextHeight) {
      element.height = totalTextHeight;
    }

    // Draw search icon if enabled
if (element.hasIcon) {
  // Calculate icon position and size
  const iconX = element.width - 25;
  const iconY = element.height / 2;
  const iconSize = Math.min(24, element.height * 0.6);
  
  // Save the current context state
  context.save();
  
  // Set styles for the SVG rendering
  context.strokeStyle = element.strokeColor || "#666666";
  context.lineWidth = 1.5;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.fillStyle = "none";
  
  // Scale factor to fit the icon size (SVG is 24x24, we want iconSize)
  const scale = iconSize / 24;
  
  // Position and scale the context for the SVG
  context.translate(iconX - iconSize / 2, iconY - iconSize / 2);
  context.scale(scale, scale);
  
  // Render the magnifying glass circle (path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0")
  // This creates a circle centered at (10,10) with radius 7
  context.beginPath();
  context.arc(10, 10, 7, 0, 2 * Math.PI);
  context.stroke();
  
  // Render the search handle (path d="M21 21l-6 -6")
  // This draws a line from (21,21) to (15,15)
  context.beginPath();
  context.moveTo(21, 21);
  context.lineTo(15, 15);
  context.stroke();
  
  // Restore the context state
  context.restore();
}

  }
  else if (isRabbitImageElement(element)) {
    console.log("RENDER ENTRY: Starting to render element", element.type);
    const offsetX = element.x + appState.scrollX;
    const offsetY = element.y + appState.scrollY;
    const { width, height } = element;
    const padding = 10;
    const labelHeight = 20;
    const radius = 10;

    context.save();
    context.translate(offsetX, offsetY);

    // Set fill style before drawing background
    context.fillStyle = element.backgroundColor || "#fff";
    

    // Draw rounded rectangle
    if (context.roundRect) {
      context.beginPath();
      context.roundRect(0, 0, width, height, radius);
      context.fill();

      context.strokeStyle = element.strokeColor || "#000";
      context.lineWidth = element.strokeWidth || 1;
      context.stroke();
    } else {
      // Fallback rounded rect
      context.beginPath();
      context.moveTo(radius, 0);
      context.lineTo(width - radius, 0);
      context.quadraticCurveTo(width, 0, width, radius);
      context.lineTo(width, height - radius);
      context.quadraticCurveTo(width, height, width - radius, height);
      context.lineTo(radius, height);
      context.quadraticCurveTo(0, height, 0, height - radius);
      context.lineTo(0, radius);
      context.quadraticCurveTo(0, 0, radius, 0);
      context.closePath();
      context.fill();

      context.strokeStyle = element.strokeColor || "#000";
      context.lineWidth = element.strokeWidth || 1;
      context.stroke();
    }

    // Draw label text
    context.fillStyle = "#000";

    context.font = "16px Assistant, sans-serif"; // Replace with any loaded font
    context.textBaseline = "bottom";
    const fullLabel = element.fullTitle || element.label || "";

    const maxLabelWidth = width - (padding * 2);

    // Measure the full text width
    const textWidth = context.measureText(fullLabel).width;
    console.log("Label width check:", fullLabel, "width:", textWidth, "maxWidth:", maxLabelWidth);

    // Determine if truncation is needed
    let displayLabel = fullLabel;
    if (textWidth > maxLabelWidth) {
      // Calculate approximately how many characters will fit
      const charsPerPixel = fullLabel.length / textWidth;
      const maxChars = Math.floor(maxLabelWidth * charsPerPixel) - 3; // Space for "..."
      displayLabel = fullLabel.substring(0, Math.max(3, maxChars)) + "...";
      console.log("Truncated to:", displayLabel);
      
    }

    // Draw the truncated label
    context.font = "16px sans-serif"; 
    context.fillText(displayLabel, padding, height - 5);

    context.restore();

    // Draw image
    const img = getCachedRabbitImage(element.imageUrl);
    if (img.complete && img.naturalWidth) {
      context.save();
      context.translate(offsetX, offsetY);
      context.drawImage(
        img,
        padding,
        padding,
        width - padding * 2,
        height - labelHeight - padding * 2
      );
      context.restore();
    }

  }
  else if (isRabbitImageTabsElement(element)) {
    const offsetX = element.x + appState.scrollX;
    const offsetY = element.y + appState.scrollY;
    const { width, height } = element;
    const labelHeight = 20;
    const radius = 10;
    context.save();

    context.translate(
      element.x + appState.scrollX,
      element.y + appState.scrollY
    );

    const tabHeight = element.tabHeight;
    const tabWidth = element.width / element.images.length;

    // Draw tabs
    element.images.forEach((image, index) => {
      const tabX = index * tabWidth;
      const isActive = index === element.activeTabIndex;

      // Tab background
      context.fillStyle = isActive ? "#4f46e5" : "#e5e5e5";
      context.fillRect(tabX, 0, tabWidth, tabHeight);

      // Tab border
      context.strokeStyle = "#d1d5db";
      context.lineWidth = 1;
      context.strokeRect(tabX, 0, tabWidth, tabHeight);

      // Tab text
      context.fillStyle = isActive ? "#ffffff" : "#374151";
      context.font = "14px Arial";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        image.title,
        tabX + tabWidth / 2,
        tabHeight / 2
      );
    });

    // Draw main content area border
    context.strokeStyle = element.strokeColor;
    context.lineWidth = element.strokeWidth;
    context.strokeRect(0, tabHeight, element.width, element.height - tabHeight);

    // Fill main content area
    context.fillStyle = element.backgroundColor;
    context.fillRect(0, tabHeight, element.width, element.height - tabHeight);

    // Set up clipping region for scrollable content
    const contentArea = {
      x: 0,
      y: tabHeight,
      width: element.width,
      height: element.height - tabHeight
    };

    context.save();
    context.beginPath();
    context.rect(contentArea.x, contentArea.y, contentArea.width, contentArea.height);
    context.clip();

    // Calculate scroll offset (you'll need to add scrollOffset to your element state)
    // const scrollOffset = element.scrollOffset || 0;

    // Two-column layout configuration
    const padding = 10;
    const columnGap = 10;
    const columnWidth = (contentArea.width - padding * 2 - columnGap) / 2;
    const imageHeight = 150; // Fixed height for each image
    const imageSpacing = 10;

    // Get active tab images (assuming you want to show multiple images from active tab)
    // const activeTabImages = element.images[element.activeTabIndex]?.subImages || [element.images[element.activeTabIndex]];
    const activeTabImages = element.images[element.activeTabIndex]?.subImages || [];

    if (activeTabImages && activeTabImages.length > 0) {
      activeTabImages.forEach((imageData, index) => {
        const columnIndex = index % 2; // 0 for left column, 1 for right column
        const rowIndex = Math.floor(index / 2);

        const imageX = contentArea.x + padding + columnIndex * (columnWidth + columnGap);
        const imageY = contentArea.y + padding + rowIndex * (imageHeight + imageSpacing);

        // Only draw if image is visible in the viewport
        if (imageY + imageHeight >= contentArea.y && imageY <= contentArea.y + contentArea.height) {
          const img = getCachedRabbitImage(imageData.url);

          if (img.complete && img.naturalWidth > 0) {
            // Image is loaded, draw it
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            let drawWidth = columnWidth;
            let drawHeight = imageHeight;

            // Maintain aspect ratio
            if (aspectRatio > columnWidth / imageHeight) {
              drawHeight = drawWidth / aspectRatio;
            } else {
              drawWidth = drawHeight * aspectRatio;
            }

            // Center the image within its allocated space
            const offsetX = (columnWidth - drawWidth) / 2;
            const offsetY = (imageHeight - drawHeight) / 2;

            context.drawImage(
              img,
              imageX + offsetX,
              imageY + offsetY,
              drawWidth,
              drawHeight
            );

            // Optional: Draw image border
            context.strokeStyle = "#e5e7eb";
            context.lineWidth = 1;
            context.strokeRect(imageX, imageY, columnWidth, imageHeight);
            
            console.log("Image data title:");

            // Optional: Draw image title if available
            if (imageData.title) {
              console.log("Hey I'm here")
          context.fillStyle = "#374151";
          context.font = "12px Arial";
          context.textAlign = "center";
          context.textBaseline = "top";
          
          // Calculate available width (adjust as needed)
          const availableWidth = columnWidth - 10; // 5px padding on each side
          
          // Get the full title
          const fullTitle = imageData.title;
          
          // Measure the text width
          const textWidth = context.measureText(fullTitle).width;
          
          // Truncate if needed
          let displayTitle = fullTitle;
          if (textWidth > availableWidth) {
            // Calculate approximately how many characters will fit
            const charsPerPixel = fullTitle.length / textWidth;
            const maxChars = Math.floor(availableWidth * charsPerPixel) - 3; // Space for "..."
            displayTitle = fullTitle.substring(0, Math.max(3, maxChars)) + "...";
            console.log("Avail width", displayTitle);
            
            // Optional: Store the full title somewhere for tooltip functionality
            // imageData.fullTitle = fullTitle;
          }
          
          // Draw the truncated title
          context.fillText(
            displayTitle,
            imageX + columnWidth / 2,
            imageY + imageHeight + 5
          );
        }
          } else {
            // Image is still loading or failed to load
            if (img.complete) {
              // Image failed to load
              context.fillStyle = "#fee2e2";
              context.fillRect(imageX, imageY, columnWidth, imageHeight);
              context.fillStyle = "#dc2626";
              context.font = "12px Arial";
              context.textAlign = "center";
              context.textBaseline = "middle";
              context.fillText(
                "Failed to load",
                imageX + columnWidth / 2,
                imageY + imageHeight / 2
              );
            } else {
              // Image is still loading
              context.fillStyle = "#f9fafb";
              context.fillRect(imageX, imageY, columnWidth, imageHeight);
              context.strokeStyle = "#e5e7eb";
              context.lineWidth = 1;
              context.strokeRect(imageX, imageY, columnWidth, imageHeight);

              context.fillStyle = "#9ca3af";
              context.font = "12px Arial";
              context.textAlign = "center";
              context.textBaseline = "middle";
              context.fillText(
                "Loading...",
                imageX + columnWidth / 2,
                imageY + imageHeight / 2
              );
            }
          }
        }
      });
    }

    context.restore(); // Restore clipping
  }
  else if (isRabbitColorPaletteElement(element)) {
    const offsetX = element.x + appState.scrollX;
  const offsetY = element.y + appState.scrollY;
  const { colors, rectangleHeight, width } = element;

  context.save();
  context.translate(offsetX, offsetY);

  context.fillStyle = "rgba(255,0,0,0.1)"; // Semi-transparent red
context.fillRect(0, 0, width, colors.length * rectangleHeight);

  // Render each color rectangle
  colors.forEach((color, index) => {
    const y = index * rectangleHeight;

    // Draw rectangle background
    context.fillStyle = color;
    context.fillRect(0, y, width, rectangleHeight);

    // Draw rectangle border
    context.strokeStyle = element.strokeColor || "#000";
    context.lineWidth = element.strokeWidth || 1;
    context.strokeRect(0, y, width, rectangleHeight);

    // Draw hex code text
    context.fillStyle = getContrastColor(color);
    context.font = "14px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      color.toUpperCase(),
      width / 2,
      y + rectangleHeight / 2
    );
  });

  context.restore();
  }
}

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
