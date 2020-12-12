import {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  Arrowhead,
  NonDeletedExcalidrawElement,
} from "../element/types";
import { isTextElement, isLinearElement } from "../element/typeChecks";
import {
  getDiamondPoints,
  getElementAbsoluteCoords,
  getArrowheadPoints,
} from "../element/bounds";
import { RoughCanvas } from "roughjs/bin/canvas";
import { Drawable, Options } from "roughjs/bin/core";
import { RoughSVG } from "roughjs/bin/svg";
import { RoughGenerator } from "roughjs/bin/generator";
import { SceneState } from "../scene/types";
import {
  SVG_NS,
  distance,
  getFontString,
  getFontFamilyString,
  isRTL,
} from "../utils";
import { isPathALoop } from "../math";
import rough from "roughjs/bin/rough";
import { Zoom } from "../types";
import { getDefaultAppState } from "../appState";

const defaultAppState = getDefaultAppState();

const CANVAS_PADDING = 20;

const DASHARRAY_DASHED = [12, 8];
const DASHARRAY_DOTTED = [3, 6];

export interface ExcalidrawElementWithCanvas {
  element: ExcalidrawElement | ExcalidrawTextElement;
  canvas: HTMLCanvasElement;
  canvasZoom: Zoom["value"];
  canvasOffsetX: number;
  canvasOffsetY: number;
}

const generateElementCanvas = (
  element: NonDeletedExcalidrawElement,
  zoom: Zoom,
): ExcalidrawElementWithCanvas => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;

  let canvasOffsetX = 0;
  let canvasOffsetY = 0;

  if (isLinearElement(element)) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
    canvas.width =
      distance(x1, x2) * window.devicePixelRatio * zoom.value +
      CANVAS_PADDING * zoom.value * 2;
    canvas.height =
      distance(y1, y2) * window.devicePixelRatio * zoom.value +
      CANVAS_PADDING * zoom.value * 2;

    canvasOffsetX =
      element.x > x1
        ? Math.floor(distance(element.x, x1)) *
          window.devicePixelRatio *
          zoom.value
        : 0;

    canvasOffsetY =
      element.y > y1
        ? Math.floor(distance(element.y, y1)) *
          window.devicePixelRatio *
          zoom.value
        : 0;

    context.translate(canvasOffsetX, canvasOffsetY);
  } else {
    canvas.width =
      element.width * window.devicePixelRatio * zoom.value +
      CANVAS_PADDING * zoom.value * 2;
    canvas.height =
      element.height * window.devicePixelRatio * zoom.value +
      CANVAS_PADDING * zoom.value * 2;
  }

  context.translate(CANVAS_PADDING * zoom.value, CANVAS_PADDING * zoom.value);

  context.scale(
    window.devicePixelRatio * zoom.value,
    window.devicePixelRatio * zoom.value,
  );

  const rc = rough.canvas(canvas);
  drawElementOnCanvas(element, rc, context);
  context.translate(
    -(CANVAS_PADDING * zoom.value),
    -(CANVAS_PADDING * zoom.value),
  );
  context.scale(
    1 / (window.devicePixelRatio * zoom.value),
    1 / (window.devicePixelRatio * zoom.value),
  );
  return {
    element,
    canvas,
    canvasZoom: zoom.value,
    canvasOffsetX,
    canvasOffsetY,
  };
};

const drawElementOnCanvas = (
  element: NonDeletedExcalidrawElement,
  rc: RoughCanvas,
  context: CanvasRenderingContext2D,
) => {
  context.globalAlpha = element.opacity / 100;
  switch (element.type) {
    case "rectangle":
    case "diamond":
    case "ellipse": {
      rc.draw(getShapeForElement(element) as Drawable);
      break;
    }
    case "arrow":
    case "draw":
    case "line": {
      (getShapeForElement(element) as Drawable[]).forEach((shape) => {
        rc.draw(shape);
      });
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
        const font = context.font;
        context.font = getFontString(element);
        const fillStyle = context.fillStyle;
        context.fillStyle = element.strokeColor;
        const textAlign = context.textAlign;
        context.textAlign = element.textAlign as CanvasTextAlign;

        // Canvas does not support multiline text by default
        const lines = element.text.replace(/\r\n?/g, "\n").split("\n");
        const lineHeight = element.height / lines.length;
        const verticalOffset = element.height - element.baseline;
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
        context.fillStyle = fillStyle;
        context.font = font;
        context.textAlign = textAlign;
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

export const generateRoughOptions = (element: ExcalidrawElement): Options => {
  const options: Options = {
    seed: element.seed,
    strokeLineDash:
      element.strokeStyle === "dashed"
        ? DASHARRAY_DASHED
        : element.strokeStyle === "dotted"
        ? DASHARRAY_DOTTED
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
    case "draw": {
      // If shape is a line and is a closed shape,
      // fill the shape if a color is set.
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
            generateRoughOptions(element),
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
        const [
          topX,
          topY,
          rightX,
          rightY,
          bottomX,
          bottomY,
          leftX,
          leftY,
        ] = getDiamondPoints(element);
        shape = generator.polygon(
          [
            [topX, topY],
            [rightX, rightY],
            [bottomX, bottomY],
            [leftX, leftY],
          ],
          generateRoughOptions(element),
        );
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
      case "draw":
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

          function getArrowheadShapes(
            element: ExcalidrawLinearElement,
            shape: Drawable[],
            position: "start" | "end",
            arrowhead: Arrowhead,
          ) {
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
                }),
              ];
            }

            // Arrow arrowheads
            const [x2, y2, x3, y3, x4, y4] = arrowheadPoints;
            if (element.strokeStyle === "dotted") {
              // for dotted arrows caps, reduce gap to make it more legible
              options.strokeLineDash = [3, 4];
            } else {
              // for solid/dashed, keep solid arrow cap
              delete options.strokeLineDash;
            }
            return [
              generator.line(x3, y3, x2, y2, options),
              generator.line(x4, y4, x2, y2, options),
            ];
          }

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
      case "text": {
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
  sceneState?: SceneState,
) => {
  const zoom: Zoom = sceneState ? sceneState.zoom : defaultAppState.zoom;
  const prevElementWithCanvas = elementWithCanvasCache.get(element);
  const shouldRegenerateBecauseZoom =
    prevElementWithCanvas &&
    prevElementWithCanvas.canvasZoom !== zoom.value &&
    !sceneState?.shouldCacheIgnoreZoom;
  if (!prevElementWithCanvas || shouldRegenerateBecauseZoom) {
    const elementWithCanvas = generateElementCanvas(element, zoom);
    elementWithCanvasCache.set(element, elementWithCanvas);
    return elementWithCanvas;
  }
  return prevElementWithCanvas;
};

const drawElementFromCanvas = (
  elementWithCanvas: ExcalidrawElementWithCanvas,
  rc: RoughCanvas,
  context: CanvasRenderingContext2D,
  sceneState: SceneState,
) => {
  const element = elementWithCanvas.element;
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const cx = ((x1 + x2) / 2 + sceneState.scrollX) * window.devicePixelRatio;
  const cy = ((y1 + y2) / 2 + sceneState.scrollY) * window.devicePixelRatio;
  context.scale(1 / window.devicePixelRatio, 1 / window.devicePixelRatio);
  context.translate(cx, cy);
  context.rotate(element.angle);
  context.drawImage(
    elementWithCanvas.canvas!,
    (-(x2 - x1) / 2) * window.devicePixelRatio -
      (CANVAS_PADDING * elementWithCanvas.canvasZoom) /
        elementWithCanvas.canvasZoom,
    (-(y2 - y1) / 2) * window.devicePixelRatio -
      (CANVAS_PADDING * elementWithCanvas.canvasZoom) /
        elementWithCanvas.canvasZoom,
    elementWithCanvas.canvas!.width / elementWithCanvas.canvasZoom,
    elementWithCanvas.canvas!.height / elementWithCanvas.canvasZoom,
  );
  context.rotate(-element.angle);
  context.translate(-cx, -cy);
  context.scale(window.devicePixelRatio, window.devicePixelRatio);

  // Clear the nested element we appended to the DOM
};

export const renderElement = (
  element: NonDeletedExcalidrawElement,
  rc: RoughCanvas,
  context: CanvasRenderingContext2D,
  renderOptimizations: boolean,
  sceneState: SceneState,
) => {
  const generator = rc.generator;
  switch (element.type) {
    case "selection": {
      context.translate(
        element.x + sceneState.scrollX,
        element.y + sceneState.scrollY,
      );
      const fillStyle = context.fillStyle;
      context.fillStyle = "rgba(0, 0, 255, 0.10)";
      context.fillRect(0, 0, element.width, element.height);
      context.fillStyle = fillStyle;
      context.translate(
        -element.x - sceneState.scrollX,
        -element.y - sceneState.scrollY,
      );
      break;
    }
    case "rectangle":
    case "diamond":
    case "ellipse":
    case "line":
    case "draw":
    case "arrow":
    case "text": {
      generateElementShape(element, generator);
      if (renderOptimizations) {
        const elementWithCanvas = generateElementWithCanvas(
          element,
          sceneState,
        );
        drawElementFromCanvas(elementWithCanvas, rc, context, sceneState);
      } else {
        const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
        const cx = (x1 + x2) / 2 + sceneState.scrollX;
        const cy = (y1 + y2) / 2 + sceneState.scrollY;
        const shiftX = (x2 - x1) / 2 - (element.x - x1);
        const shiftY = (y2 - y1) / 2 - (element.y - y1);
        context.translate(cx, cy);
        context.rotate(element.angle);
        context.translate(-shiftX, -shiftY);
        drawElementOnCanvas(element, rc, context);
        context.translate(shiftX, shiftY);
        context.rotate(-element.angle);
        context.translate(-cx, -cy);
      }
      break;
    }
    default: {
      // @ts-ignore
      throw new Error(`Unimplemented type ${element.type}`);
    }
  }
};

export const renderElementToSvg = (
  element: NonDeletedExcalidrawElement,
  rsvg: RoughSVG,
  svgRoot: SVGElement,
  offsetX?: number,
  offsetY?: number,
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
      const node = rsvg.draw(getShapeForElement(element) as Drawable);
      const opacity = element.opacity / 100;
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
      svgRoot.appendChild(node);
      break;
    }
    case "line":
    case "draw":
    case "arrow": {
      generateElementShape(element, generator);
      const group = svgRoot.ownerDocument!.createElementNS(SVG_NS, "g");
      const opacity = element.opacity / 100;
      (getShapeForElement(element) as Drawable[]).forEach((shape) => {
        const node = rsvg.draw(shape);
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
          (element.type === "line" || element.type === "draw") &&
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
        svgRoot.appendChild(node);
      } else {
        // @ts-ignore
        throw new Error(`Unimplemented type ${element.type}`);
      }
    }
  }
};
