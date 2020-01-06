import React from "react";
import ReactDOM from "react-dom";
import rough from "roughjs/bin/wrappers/rough";
import { RoughCanvas } from "roughjs/bin/canvas";
import { TwitterPicker } from "react-color";

import { moveOneLeft, moveAllLeft, moveOneRight, moveAllRight } from "./zindex";
import { LCG, randomSeed, withCustomMathRandom } from "./random";
import { distanceBetweenPointAndSegment } from "./math";
import { roundRect } from "./roundRect";

import EditableText from "./components/EditableText";

import "./styles.scss";

type ExcalidrawElement = ReturnType<typeof newElement>;
type ExcalidrawTextElement = ExcalidrawElement & {
  type: "text";
  font: string;
  text: string;
  actualBoundingBoxAscent: number;
};

const LOCAL_STORAGE_KEY = "excalidraw";
const LOCAL_STORAGE_KEY_STATE = "excalidraw-state";

const elements = Array.of<ExcalidrawElement>();

const DEFAULT_PROJECT_NAME = `excalidraw-${getDateTime()}`;

function hitTest(element: ExcalidrawElement, x: number, y: number): boolean {
  // For shapes that are composed of lines, we only enable point-selection when the distance
  // of the click is less than x pixels of any of the lines that the shape is composed of
  const lineThreshold = 10;

  if (element.type === "ellipse") {
    // https://stackoverflow.com/a/46007540/232122
    const px = Math.abs(x - element.x - element.width / 2);
    const py = Math.abs(y - element.y - element.height / 2);

    let tx = 0.707;
    let ty = 0.707;

    const a = element.width / 2;
    const b = element.height / 2;

    [0, 1, 2, 3].forEach(x => {
      const xx = a * tx;
      const yy = b * ty;

      const ex = ((a * a - b * b) * tx ** 3) / a;
      const ey = ((b * b - a * a) * ty ** 3) / b;

      const rx = xx - ex;
      const ry = yy - ey;

      const qx = px - ex;
      const qy = py - ey;

      const r = Math.hypot(ry, rx);
      const q = Math.hypot(qy, qx);

      tx = Math.min(1, Math.max(0, ((qx * r) / q + ex) / a));
      ty = Math.min(1, Math.max(0, ((qy * r) / q + ey) / b));
      const t = Math.hypot(ty, tx);
      tx /= t;
      ty /= t;
    });

    return Math.hypot(a * tx - px, b * ty - py) < lineThreshold;
  } else if (element.type === "rectangle") {
    const x1 = getElementAbsoluteX1(element);
    const x2 = getElementAbsoluteX2(element);
    const y1 = getElementAbsoluteY1(element);
    const y2 = getElementAbsoluteY2(element);

    // (x1, y1) --A-- (x2, y1)
    //    |D             |B
    // (x1, y2) --C-- (x2, y2)
    return (
      distanceBetweenPointAndSegment(x, y, x1, y1, x2, y1) < lineThreshold || // A
      distanceBetweenPointAndSegment(x, y, x2, y1, x2, y2) < lineThreshold || // B
      distanceBetweenPointAndSegment(x, y, x2, y2, x1, y2) < lineThreshold || // C
      distanceBetweenPointAndSegment(x, y, x1, y2, x1, y1) < lineThreshold // D
    );
  } else if (element.type === "diamond") {
    x -= element.x;
    y -= element.y;

    const [
      topX,
      topY,
      rightX,
      rightY,
      bottomX,
      bottomY,
      leftX,
      leftY
    ] = getDiamondPoints(element);

    return (
      distanceBetweenPointAndSegment(x, y, topX, topY, rightX, rightY) <
        lineThreshold ||
      distanceBetweenPointAndSegment(x, y, rightX, rightY, bottomX, bottomY) <
        lineThreshold ||
      distanceBetweenPointAndSegment(x, y, bottomX, bottomY, leftX, leftY) <
        lineThreshold ||
      distanceBetweenPointAndSegment(x, y, leftX, leftY, topX, topY) <
        lineThreshold
    );
  } else if (element.type === "arrow") {
    let [x1, y1, x2, y2, x3, y3, x4, y4] = getArrowPoints(element);
    // The computation is done at the origin, we need to add a translation
    x -= element.x;
    y -= element.y;

    return (
      //    \
      distanceBetweenPointAndSegment(x, y, x3, y3, x2, y2) < lineThreshold ||
      // -----
      distanceBetweenPointAndSegment(x, y, x1, y1, x2, y2) < lineThreshold ||
      //    /
      distanceBetweenPointAndSegment(x, y, x4, y4, x2, y2) < lineThreshold
    );
  } else if (element.type === "text") {
    const x1 = getElementAbsoluteX1(element);
    const x2 = getElementAbsoluteX2(element);
    const y1 = getElementAbsoluteY1(element);
    const y2 = getElementAbsoluteY2(element);

    return x >= x1 && x <= x2 && y >= y1 && y <= y2;
  } else if (element.type === "selection") {
    console.warn("This should not happen, we need to investigate why it does.");
    return false;
  } else {
    throw new Error("Unimplemented type " + element.type);
  }
}

function resizeTest(
  element: ExcalidrawElement,
  x: number,
  y: number,
  sceneState: SceneState
): string | false {
  if (element.type === "text") return false;

  const handlers = handlerRectangles(element, sceneState);

  const filter = Object.keys(handlers).filter(key => {
    const handler = handlers[key];

    return (
      x + sceneState.scrollX >= handler[0] &&
      x + sceneState.scrollX <= handler[0] + handler[2] &&
      y + sceneState.scrollY >= handler[1] &&
      y + sceneState.scrollY <= handler[1] + handler[3]
    );
  });

  if (filter.length > 0) {
    return filter[0];
  }

  return false;
}

function newElement(
  type: string,
  x: number,
  y: number,
  strokeColor: string,
  backgroundColor: string,
  fillStyle: string,
  strokeWidth: number,
  roughness: number,
  opacity: number,
  width = 0,
  height = 0
) {
  const element = {
    type: type,
    x: x,
    y: y,
    width: width,
    height: height,
    isSelected: false,
    strokeColor: strokeColor,
    backgroundColor: backgroundColor,
    fillStyle: fillStyle,
    strokeWidth: strokeWidth,
    roughness: roughness,
    opacity: opacity,
    seed: randomSeed(),
    draw(
      rc: RoughCanvas,
      context: CanvasRenderingContext2D,
      sceneState: SceneState
    ) {}
  };
  return element;
}

type SceneState = {
  scrollX: number;
  scrollY: number;
  // null indicates transparent bg
  viewBackgroundColor: string | null;
};

const SCROLLBAR_WIDTH = 6;
const SCROLLBAR_MIN_SIZE = 15;
const SCROLLBAR_MARGIN = 4;
const SCROLLBAR_COLOR = "rgba(0,0,0,0.3)";
const CANVAS_WINDOW_OFFSET_LEFT = 250;
const CANVAS_WINDOW_OFFSET_TOP = 0;

function getScrollBars(
  canvasWidth: number,
  canvasHeight: number,
  scrollX: number,
  scrollY: number
) {
  let minX = Infinity;
  let maxX = 0;
  let minY = Infinity;
  let maxY = 0;

  elements.forEach(element => {
    minX = Math.min(minX, getElementAbsoluteX1(element));
    maxX = Math.max(maxX, getElementAbsoluteX2(element));
    minY = Math.min(minY, getElementAbsoluteY1(element));
    maxY = Math.max(maxY, getElementAbsoluteY2(element));
  });

  minX += scrollX;
  maxX += scrollX;
  minY += scrollY;
  maxY += scrollY;
  const leftOverflow = Math.max(-minX, 0);
  const rightOverflow = Math.max(-(canvasWidth - maxX), 0);
  const topOverflow = Math.max(-minY, 0);
  const bottomOverflow = Math.max(-(canvasHeight - maxY), 0);

  // horizontal scrollbar
  let horizontalScrollBar = null;
  if (leftOverflow || rightOverflow) {
    horizontalScrollBar = {
      x: Math.min(
        leftOverflow + SCROLLBAR_MARGIN,
        canvasWidth - SCROLLBAR_MIN_SIZE - SCROLLBAR_MARGIN
      ),
      y: canvasHeight - SCROLLBAR_WIDTH - SCROLLBAR_MARGIN,
      width: Math.max(
        canvasWidth - rightOverflow - leftOverflow - SCROLLBAR_MARGIN * 2,
        SCROLLBAR_MIN_SIZE
      ),
      height: SCROLLBAR_WIDTH
    };
  }

  // vertical scrollbar
  let verticalScrollBar = null;
  if (topOverflow || bottomOverflow) {
    verticalScrollBar = {
      x: canvasWidth - SCROLLBAR_WIDTH - SCROLLBAR_MARGIN,
      y: Math.min(
        topOverflow + SCROLLBAR_MARGIN,
        canvasHeight - SCROLLBAR_MIN_SIZE - SCROLLBAR_MARGIN
      ),
      width: SCROLLBAR_WIDTH,
      height: Math.max(
        canvasHeight - bottomOverflow - topOverflow - SCROLLBAR_WIDTH * 2,
        SCROLLBAR_MIN_SIZE
      )
    };
  }

  return {
    horizontal: horizontalScrollBar,
    vertical: verticalScrollBar
  };
}

function isOverScrollBars(
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
  scrollX: number,
  scrollY: number
) {
  const scrollBars = getScrollBars(canvasWidth, canvasHeight, scrollX, scrollY);

  const [isOverHorizontalScrollBar, isOverVerticalScrollBar] = [
    scrollBars.horizontal,
    scrollBars.vertical
  ].map(
    scrollBar =>
      scrollBar &&
      scrollBar.x <= x &&
      x <= scrollBar.x + scrollBar.width &&
      scrollBar.y <= y &&
      y <= scrollBar.y + scrollBar.height
  );

  return {
    isOverHorizontalScrollBar,
    isOverVerticalScrollBar
  };
}

function handlerRectangles(element: ExcalidrawElement, sceneState: SceneState) {
  const elementX1 = element.x;
  const elementX2 = element.x + element.width;
  const elementY1 = element.y;
  const elementY2 = element.y + element.height;

  const margin = 4;
  const minimumSize = 40;
  const handlers: { [handler: string]: number[] } = {};

  const marginX = element.width < 0 ? 8 : -8;
  const marginY = element.height < 0 ? 8 : -8;

  if (Math.abs(elementX2 - elementX1) > minimumSize) {
    handlers["n"] = [
      elementX1 + (elementX2 - elementX1) / 2 + sceneState.scrollX - 4,
      elementY1 - margin + sceneState.scrollY + marginY,
      8,
      8
    ];

    handlers["s"] = [
      elementX1 + (elementX2 - elementX1) / 2 + sceneState.scrollX - 4,
      elementY2 - margin + sceneState.scrollY - marginY,
      8,
      8
    ];
  }

  if (Math.abs(elementY2 - elementY1) > minimumSize) {
    handlers["w"] = [
      elementX1 - margin + sceneState.scrollX + marginX,
      elementY1 + (elementY2 - elementY1) / 2 + sceneState.scrollY - 4,
      8,
      8
    ];

    handlers["e"] = [
      elementX2 - margin + sceneState.scrollX - marginX,
      elementY1 + (elementY2 - elementY1) / 2 + sceneState.scrollY - 4,
      8,
      8
    ];
  }

  handlers["nw"] = [
    elementX1 - margin + sceneState.scrollX + marginX,
    elementY1 - margin + sceneState.scrollY + marginY,
    8,
    8
  ]; // nw
  handlers["ne"] = [
    elementX2 - margin + sceneState.scrollX - marginX,
    elementY1 - margin + sceneState.scrollY + marginY,
    8,
    8
  ]; // ne
  handlers["sw"] = [
    elementX1 - margin + sceneState.scrollX + marginX,
    elementY2 - margin + sceneState.scrollY - marginY,
    8,
    8
  ]; // sw
  handlers["se"] = [
    elementX2 - margin + sceneState.scrollX - marginX,
    elementY2 - margin + sceneState.scrollY - marginY,
    8,
    8
  ]; // se

  if (element.type === "arrow") {
    return {
      nw: handlers.nw,
      se: handlers.se
    };
  }

  return handlers;
}

function renderScene(
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

  const selectedIndices = getSelectedIndices();

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

function saveAsJSON(name: string) {
  const serialized = JSON.stringify({
    version: 1,
    source: window.location.origin,
    elements
  });

  saveFile(
    `${name}.json`,
    "data:text/plain;charset=utf-8," + encodeURIComponent(serialized)
  );
}

function loadFromJSON() {
  const input = document.createElement("input");
  const reader = new FileReader();
  input.type = "file";
  input.accept = ".json";

  input.onchange = () => {
    if (!input.files!.length) {
      alert("A file was not selected.");
      return;
    }

    reader.readAsText(input.files![0], "utf8");
  };

  input.click();

  return new Promise(resolve => {
    reader.onloadend = () => {
      if (reader.readyState === FileReader.DONE) {
        const data = JSON.parse(reader.result as string);
        restore(data.elements, null);
        resolve();
      }
    };
  });
}

function exportAsPNG({
  exportBackground,
  exportPadding = 10,
  viewBackgroundColor,
  name
}: {
  exportBackground: boolean;
  exportPadding?: number;
  viewBackgroundColor: string;
  scrollX: number;
  scrollY: number;
  name: string;
}) {
  if (!elements.length) return window.alert("Cannot export empty canvas.");
  // calculate smallest area to fit the contents in

  let subCanvasX1 = Infinity;
  let subCanvasX2 = 0;
  let subCanvasY1 = Infinity;
  let subCanvasY2 = 0;

  elements.forEach(element => {
    subCanvasX1 = Math.min(subCanvasX1, getElementAbsoluteX1(element));
    subCanvasX2 = Math.max(subCanvasX2, getElementAbsoluteX2(element));
    subCanvasY1 = Math.min(subCanvasY1, getElementAbsoluteY1(element));
    subCanvasY2 = Math.max(subCanvasY2, getElementAbsoluteY2(element));
  });

  function distance(x: number, y: number) {
    return Math.abs(x > y ? x - y : y - x);
  }

  const tempCanvas = document.createElement("canvas");
  tempCanvas.style.display = "none";
  document.body.appendChild(tempCanvas);
  tempCanvas.width = distance(subCanvasX1, subCanvasX2) + exportPadding * 2;
  tempCanvas.height = distance(subCanvasY1, subCanvasY2) + exportPadding * 2;

  renderScene(
    rough.canvas(tempCanvas),
    tempCanvas,
    {
      viewBackgroundColor: exportBackground ? viewBackgroundColor : null,
      scrollX: 0,
      scrollY: 0
    },
    {
      offsetX: -subCanvasX1 + exportPadding,
      offsetY: -subCanvasY1 + exportPadding,
      renderScrollbars: false,
      renderSelection: false
    }
  );

  saveFile(`${name}.png`, tempCanvas.toDataURL("image/png"));

  // clean up the DOM
  if (tempCanvas !== canvas) tempCanvas.remove();
}

function saveFile(name: string, data: string) {
  // create a temporary <a> elem which we'll use to download the image
  const link = document.createElement("a");
  link.setAttribute("download", name);
  link.setAttribute("href", data);
  link.click();

  // clean up
  link.remove();
}

function rotate(x1: number, y1: number, x2: number, y2: number, angle: number) {
  // 𝑎′𝑥=(𝑎𝑥−𝑐𝑥)cos𝜃−(𝑎𝑦−𝑐𝑦)sin𝜃+𝑐𝑥
  // 𝑎′𝑦=(𝑎𝑥−𝑐𝑥)sin𝜃+(𝑎𝑦−𝑐𝑦)cos𝜃+𝑐𝑦.
  // https://math.stackexchange.com/questions/2204520/how-do-i-rotate-a-line-segment-in-a-specific-point-on-the-line
  return [
    (x1 - x2) * Math.cos(angle) - (y1 - y2) * Math.sin(angle) + x2,
    (x1 - x2) * Math.sin(angle) + (y1 - y2) * Math.cos(angle) + y2
  ];
}

function getDateTime() {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hr = date.getHours();
  const min = date.getMinutes();
  const secs = date.getSeconds();

  return `${year}${month}${day}${hr}${min}${secs}`;
}

// Casting second argument (DrawingSurface) to any,
// because it is requred by TS definitions and not required at runtime
const generator = rough.generator(null, null as any);

function isTextElement(
  element: ExcalidrawElement
): element is ExcalidrawTextElement {
  return element.type === "text";
}

function isInputLike(
  target: Element | EventTarget | null
): target is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function getArrowPoints(element: ExcalidrawElement) {
  const x1 = 0;
  const y1 = 0;
  const x2 = element.width;
  const y2 = element.height;

  const size = 30; // pixels
  const distance = Math.hypot(x2 - x1, y2 - y1);
  // Scale down the arrow until we hit a certain size so that it doesn't look weird
  const minSize = Math.min(size, distance / 2);
  const xs = x2 - ((x2 - x1) / distance) * minSize;
  const ys = y2 - ((y2 - y1) / distance) * minSize;

  const angle = 20; // degrees
  const [x3, y3] = rotate(xs, ys, x2, y2, (-angle * Math.PI) / 180);
  const [x4, y4] = rotate(xs, ys, x2, y2, (angle * Math.PI) / 180);

  return [x1, y1, x2, y2, x3, y3, x4, y4];
}

function getDiamondPoints(element: ExcalidrawElement) {
  const topX = Math.PI + element.width / 2;
  const topY = element.height - element.height;
  const rightX = element.width;
  const rightY = Math.PI + element.height / 2;
  const bottomX = topX;
  const bottomY = element.height;
  const leftX = topY;
  const leftY = rightY;

  return [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY];
}

function generateDraw(element: ExcalidrawElement) {
  if (element.type === "selection") {
    element.draw = (rc, context, { scrollX, scrollY }) => {
      const fillStyle = context.fillStyle;
      context.fillStyle = "rgba(0, 0, 255, 0.10)";
      context.fillRect(
        element.x + scrollX,
        element.y + scrollY,
        element.width,
        element.height
      );
      context.fillStyle = fillStyle;
    };
  } else if (element.type === "rectangle") {
    const shape = withCustomMathRandom(element.seed, () => {
      return generator.rectangle(0, 0, element.width, element.height, {
        stroke: element.strokeColor,
        fill: element.backgroundColor,
        fillStyle: element.fillStyle,
        strokeWidth: element.strokeWidth,
        roughness: element.roughness
      });
    });
    element.draw = (rc, context, { scrollX, scrollY }) => {
      context.globalAlpha = element.opacity / 100;
      context.translate(element.x + scrollX, element.y + scrollY);
      rc.draw(shape);
      context.translate(-element.x - scrollX, -element.y - scrollY);
      context.globalAlpha = 1;
    };
  } else if (element.type === "diamond") {
    const shape = withCustomMathRandom(element.seed, () => {
      const [
        topX,
        topY,
        rightX,
        rightY,
        bottomX,
        bottomY,
        leftX,
        leftY
      ] = getDiamondPoints(element);
      return generator.polygon(
        [
          [topX, topY],
          [rightX, rightY],
          [bottomX, bottomY],
          [leftX, leftY]
        ],
        {
          stroke: element.strokeColor,
          fill: element.backgroundColor,
          fillStyle: element.fillStyle,
          strokeWidth: element.strokeWidth,
          roughness: element.roughness
        }
      );
    });
    element.draw = (rc, context, { scrollX, scrollY }) => {
      context.globalAlpha = element.opacity / 100;
      context.translate(element.x + scrollX, element.y + scrollY);
      rc.draw(shape);
      context.translate(-element.x - scrollX, -element.y - scrollY);
      context.globalAlpha = 1;
    };
  } else if (element.type === "ellipse") {
    const shape = withCustomMathRandom(element.seed, () =>
      generator.ellipse(
        element.width / 2,
        element.height / 2,
        element.width,
        element.height,
        {
          stroke: element.strokeColor,
          fill: element.backgroundColor,
          fillStyle: element.fillStyle,
          strokeWidth: element.strokeWidth,
          roughness: element.roughness
        }
      )
    );
    element.draw = (rc, context, { scrollX, scrollY }) => {
      context.globalAlpha = element.opacity / 100;
      context.translate(element.x + scrollX, element.y + scrollY);
      rc.draw(shape);
      context.translate(-element.x - scrollX, -element.y - scrollY);
      context.globalAlpha = 1;
    };
  } else if (element.type === "arrow") {
    const [x1, y1, x2, y2, x3, y3, x4, y4] = getArrowPoints(element);
    const options = {
      stroke: element.strokeColor,
      strokeWidth: element.strokeWidth,
      roughness: element.roughness
    };

    const shapes = withCustomMathRandom(element.seed, () => [
      //    \
      generator.line(x3, y3, x2, y2, options),
      // -----
      generator.line(x1, y1, x2, y2, options),
      //    /
      generator.line(x4, y4, x2, y2, options)
    ]);

    element.draw = (rc, context, { scrollX, scrollY }) => {
      context.globalAlpha = element.opacity / 100;
      context.translate(element.x + scrollX, element.y + scrollY);
      shapes.forEach(shape => rc.draw(shape));
      context.translate(-element.x - scrollX, -element.y - scrollY);
      context.globalAlpha = 1;
    };
    return;
  } else if (isTextElement(element)) {
    element.draw = (rc, context, { scrollX, scrollY }) => {
      context.globalAlpha = element.opacity / 100;
      const font = context.font;
      context.font = element.font;
      const fillStyle = context.fillStyle;
      context.fillStyle = element.strokeColor;
      context.fillText(
        element.text,
        element.x + scrollX,
        element.y + element.actualBoundingBoxAscent + scrollY
      );
      context.fillStyle = fillStyle;
      context.font = font;
      context.globalAlpha = 1;
    };
  } else {
    throw new Error("Unimplemented type " + element.type);
  }
}

// If the element is created from right to left, the width is going to be negative
// This set of functions retrieves the absolute position of the 4 points.
// We can't just always normalize it since we need to remember the fact that an arrow
// is pointing left or right.
function getElementAbsoluteX1(element: ExcalidrawElement) {
  return element.width >= 0 ? element.x : element.x + element.width;
}
function getElementAbsoluteX2(element: ExcalidrawElement) {
  return element.width >= 0 ? element.x + element.width : element.x;
}
function getElementAbsoluteY1(element: ExcalidrawElement) {
  return element.height >= 0 ? element.y : element.y + element.height;
}
function getElementAbsoluteY2(element: ExcalidrawElement) {
  return element.height >= 0 ? element.y + element.height : element.y;
}

function setSelection(selection: ExcalidrawElement) {
  const selectionX1 = getElementAbsoluteX1(selection);
  const selectionX2 = getElementAbsoluteX2(selection);
  const selectionY1 = getElementAbsoluteY1(selection);
  const selectionY2 = getElementAbsoluteY2(selection);
  elements.forEach(element => {
    const elementX1 = getElementAbsoluteX1(element);
    const elementX2 = getElementAbsoluteX2(element);
    const elementY1 = getElementAbsoluteY1(element);
    const elementY2 = getElementAbsoluteY2(element);
    element.isSelected =
      element.type !== "selection" &&
      selectionX1 <= elementX1 &&
      selectionY1 <= elementY1 &&
      selectionX2 >= elementX2 &&
      selectionY2 >= elementY2;
  });
}

function clearSelection() {
  elements.forEach(element => {
    element.isSelected = false;
  });
}

function resetCursor() {
  document.documentElement.style.cursor = "";
}

function deleteSelectedElements() {
  for (let i = elements.length - 1; i >= 0; --i) {
    if (elements[i].isSelected) {
      elements.splice(i, 1);
    }
  }
}

function save(state: AppState) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(elements));
  localStorage.setItem(LOCAL_STORAGE_KEY_STATE, JSON.stringify(state));
}

function restoreFromLocalStorage() {
  const savedElements = localStorage.getItem(LOCAL_STORAGE_KEY);
  const savedState = localStorage.getItem(LOCAL_STORAGE_KEY_STATE);

  return restore(savedElements, savedState);
}

function restore(
  savedElements: string | ExcalidrawElement[] | null,
  savedState: string | null
) {
  try {
    if (savedElements) {
      elements.splice(
        0,
        elements.length,
        ...(typeof savedElements === "string"
          ? JSON.parse(savedElements)
          : savedElements)
      );
      elements.forEach((element: ExcalidrawElement) => {
        element.fillStyle = element.fillStyle || "hachure";
        element.strokeWidth = element.strokeWidth || 1;
        element.roughness = element.roughness || 1;
        element.opacity =
          element.opacity === null || element.opacity === undefined
            ? 100
            : element.opacity;

        generateDraw(element);
      });
    }

    return savedState ? JSON.parse(savedState) : null;
  } catch (e) {
    elements.splice(0, elements.length);
    return null;
  }
}

type AppState = {
  draggingElement: ExcalidrawElement | null;
  resizingElement: ExcalidrawElement | null;
  elementType: string;
  exportBackground: boolean;
  currentItemStrokeColor: string;
  currentItemBackgroundColor: string;
  viewBackgroundColor: string;
  scrollX: number;
  scrollY: number;
  name: string;
};

const KEYS = {
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  ARROW_DOWN: "ArrowDown",
  ARROW_UP: "ArrowUp",
  ESCAPE: "Escape",
  DELETE: "Delete",
  BACKSPACE: "Backspace"
};

// We inline font-awesome icons in order to save on js size rather than including the font awesome react library
const SHAPES = [
  {
    icon: (
      // fa-mouse-pointer
      <svg viewBox="0 0 320 512">
        <path d="M302.189 329.126H196.105l55.831 135.993c3.889 9.428-.555 19.999-9.444 23.999l-49.165 21.427c-9.165 4-19.443-.571-23.332-9.714l-53.053-129.136-86.664 89.138C18.729 472.71 0 463.554 0 447.977V18.299C0 1.899 19.921-6.096 30.277 5.443l284.412 292.542c11.472 11.179 3.007 31.141-12.5 31.141z" />
      </svg>
    ),
    value: "selection"
  },
  {
    icon: (
      // fa-square
      <svg viewBox="0 0 448 512">
        <path d="M400 32H48C21.5 32 0 53.5 0 80v352c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V80c0-26.5-21.5-48-48-48z" />
      </svg>
    ),
    value: "rectangle"
  },
  {
    icon: (
      // custom
      <svg viewBox="0 0 223.646 223.646">
        <path d="M111.823 0L16.622 111.823 111.823 223.646 207.025 111.823z" />
      </svg>
    ),
    value: "diamond"
  },
  {
    icon: (
      // fa-circle
      <svg viewBox="0 0 512 512">
        <path d="M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8z" />
      </svg>
    ),
    value: "ellipse"
  },
  {
    icon: (
      // fa-long-arrow-alt-right
      <svg viewBox="0 0 448 512">
        <path d="M313.941 216H12c-6.627 0-12 5.373-12 12v56c0 6.627 5.373 12 12 12h301.941v46.059c0 21.382 25.851 32.09 40.971 16.971l86.059-86.059c9.373-9.373 9.373-24.569 0-33.941l-86.059-86.059c-15.119-15.119-40.971-4.411-40.971 16.971V216z" />
      </svg>
    ),
    value: "arrow"
  },
  {
    icon: (
      // fa-font
      <svg viewBox="0 0 448 512">
        <path d="M432 416h-23.41L277.88 53.69A32 32 0 0 0 247.58 32h-47.16a32 32 0 0 0-30.3 21.69L39.41 416H16a16 16 0 0 0-16 16v32a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16v-32a16 16 0 0 0-16-16h-19.58l23.3-64h152.56l23.3 64H304a16 16 0 0 0-16 16v32a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16v-32a16 16 0 0 0-16-16zM176.85 272L224 142.51 271.15 272z" />
      </svg>
    ),
    value: "text"
  }
];

const shapesShortcutKeys = SHAPES.map(shape => shape.value[0]);

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function findElementByKey(key: string) {
  const defaultElement = "selection";
  return SHAPES.reduce((element, shape) => {
    if (shape.value[0] !== key) return element;

    return shape.value;
  }, defaultElement);
}

function isArrowKey(keyCode: string) {
  return (
    keyCode === KEYS.ARROW_LEFT ||
    keyCode === KEYS.ARROW_RIGHT ||
    keyCode === KEYS.ARROW_DOWN ||
    keyCode === KEYS.ARROW_UP
  );
}

function getSelectedIndices() {
  const selectedIndices: number[] = [];
  elements.forEach((element, index) => {
    if (element.isSelected) {
      selectedIndices.push(index);
    }
  });
  return selectedIndices;
}

const someElementIsSelected = () =>
  elements.some(element => element.isSelected);

const hasBackground = () =>
  elements.some(
    element =>
      element.isSelected &&
      (element.type === "rectangle" ||
        element.type === "ellipse" ||
        element.type === "diamond")
  );

const hasStroke = () =>
  elements.some(
    element =>
      element.isSelected &&
      (element.type === "rectangle" ||
        element.type === "ellipse" ||
        element.type === "diamond" ||
        element.type === "arrow")
  );

function getSelectedAttribute<T>(
  getAttribute: (element: ExcalidrawElement) => T
): T | null {
  const attributes = Array.from(
    new Set(
      elements
        .filter(element => element.isSelected)
        .map(element => getAttribute(element))
    )
  );
  return attributes.length === 1 ? attributes[0] : null;
}

function addTextElement(element: ExcalidrawTextElement) {
  resetCursor();
  const text = prompt("What text do you want?");
  if (text === null || text === "") {
    return false;
  }
  const fontSize = 20;
  element.text = text;
  element.font = `${fontSize}px Virgil`;
  const font = context.font;
  context.font = element.font;
  const textMeasure = context.measureText(element.text);
  const width = textMeasure.width;
  const actualBoundingBoxAscent =
    textMeasure.actualBoundingBoxAscent || fontSize;
  const actualBoundingBoxDescent = textMeasure.actualBoundingBoxDescent || 0;
  element.actualBoundingBoxAscent = actualBoundingBoxAscent;
  context.font = font;
  const height = actualBoundingBoxAscent + actualBoundingBoxDescent;
  // Center the text
  element.x -= width / 2;
  element.y -= actualBoundingBoxAscent;
  element.width = width;
  element.height = height;

  return true;
}

function getElementAtPosition(x: number, y: number) {
  let hitElement = null;
  // We need to to hit testing from front (end of the array) to back (beginning of the array)
  for (let i = elements.length - 1; i >= 0; --i) {
    if (hitTest(elements[i], x, y)) {
      hitElement = elements[i];
      break;
    }
  }

  return hitElement;
}

function ButtonSelect<T>({
  options,
  value,
  onChange
}: {
  options: { value: T; text: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div className="buttonList">
      {options.map(option => (
        <button
          onClick={() => onChange(option.value)}
          className={value === option.value ? "active" : ""}
        >
          {option.text}
        </button>
      ))}
    </div>
  );
}

function ColorPicker({
  color,
  onChange
}: {
  color: string | null;
  onChange: (color: string) => void;
}) {
  const [isActive, setActive] = React.useState(false);
  return (
    <div>
      <button
        className="swatch"
        style={color ? { backgroundColor: color } : undefined}
        onClick={() => setActive(!isActive)}
      />
      {isActive ? (
        <div className="popover">
          <div className="cover" onClick={() => setActive(false)} />
          <TwitterPicker
            colors={[
              "#000000",
              "#ABB8C3",
              "#FFFFFF",
              "#FF6900",
              "#FCB900",
              "#00D084",
              "#8ED1FC",
              "#0693E3",
              "#EB144C",
              "#F78DA7",
              "#9900EF"
            ]}
            width="205px"
            color={color || undefined}
            onChange={changedColor => {
              onChange(changedColor.hex);
            }}
          />
        </div>
      ) : null}
      <input
        type="text"
        className="swatch-input"
        value={color || ""}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

const ELEMENT_SHIFT_TRANSLATE_AMOUNT = 5;
const ELEMENT_TRANSLATE_AMOUNT = 1;

let lastCanvasWidth = -1;
let lastCanvasHeight = -1;

let lastMouseUp: ((e: any) => void) | null = null;
