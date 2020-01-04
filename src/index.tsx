import React from "react";
import ReactDOM from "react-dom";
import rough from "roughjs/bin/wrappers/rough";
import { RoughCanvas } from "roughjs/bin/canvas";

import "./styles.css";

type ExcalidrawElement = ReturnType<typeof newElement>;
type ExcalidrawTextElement = ExcalidrawElement & {
  type: "text";
  font: string;
  text: string;
  actualBoundingBoxAscent: number;
};

const LOCAL_STORAGE_KEY = "excalidraw";
const LOCAL_STORAGE_KEY_STATE = "excalidraw-state";

let elements = Array.of<ExcalidrawElement>();

// https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript/47593316#47593316
const LCG = (seed: number) => () =>
  ((2 ** 31 - 1) & (seed = Math.imul(48271, seed))) / 2 ** 31;

function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

// Unfortunately, roughjs doesn't support a seed attribute (https://github.com/pshihn/rough/issues/27).
// We can achieve the same result by overriding the Math.random function with a
// pseudo random generator that supports a random seed and swapping it back after.
function withCustomMathRandom<T>(seed: number, cb: () => T): T {
  const random = Math.random;
  Math.random = LCG(seed);
  const result = cb();
  Math.random = random;
  return result;
}

// https://stackoverflow.com/a/6853926/232122
function distanceBetweenPointAndSegment(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSquare = C * C + D * D;
  let param = -1;
  if (lenSquare !== 0) {
    // in case of 0 length line
    param = dot / lenSquare;
  }

  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.hypot(dx, dy);
}

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

function newElement(
  type: string,
  x: number,
  y: number,
  strokeColor: string,
  backgroundColor: string,
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
const SCROLLBAR_MARGIN = 4;
const SCROLLBAR_COLOR = "rgba(0,0,0,0.3)";

function getScrollbars(
  canvasWidth: number,
  canvasHeight: number,
  scrollX: number,
  scrollY: number
) {
  // horizontal scrollbar
  const sceneWidth = canvasWidth + Math.abs(scrollX);
  const scrollBarWidth = (canvasWidth * canvasWidth) / sceneWidth;
  const scrollBarX = scrollX > 0 ? 0 : canvasWidth - scrollBarWidth;
  const horizontalScrollBar = {
    x: scrollBarX + SCROLLBAR_MARGIN,
    y: canvasHeight - SCROLLBAR_WIDTH - SCROLLBAR_MARGIN,
    width: scrollBarWidth - SCROLLBAR_MARGIN * 2,
    height: SCROLLBAR_WIDTH
  };

  // vertical scrollbar
  const sceneHeight = canvasHeight + Math.abs(scrollY);
  const scrollBarHeight = (canvasHeight * canvasHeight) / sceneHeight;
  const scrollBarY = scrollY > 0 ? 0 : canvasHeight - scrollBarHeight;
  const verticalScrollBar = {
    x: canvasWidth - SCROLLBAR_WIDTH - SCROLLBAR_MARGIN,
    y: scrollBarY + SCROLLBAR_MARGIN,
    width: SCROLLBAR_WIDTH,
    height: scrollBarHeight - SCROLLBAR_WIDTH * 2
  };

  return {
    horizontal: horizontalScrollBar,
    vertical: verticalScrollBar
  };
}

function renderScene(
  rc: RoughCanvas,
  context: CanvasRenderingContext2D,
  sceneState: SceneState
) {
  if (!context) return;

  const fillStyle = context.fillStyle;
  if (typeof sceneState.viewBackgroundColor === "string") {
    context.fillStyle = sceneState.viewBackgroundColor;
    context.fillRect(-0.5, -0.5, canvas.width, canvas.height);
  } else {
    context.clearRect(-0.5, -0.5, canvas.width, canvas.height);
  }
  context.fillStyle = fillStyle;

  elements.forEach(element => {
    element.draw(rc, context, sceneState);
    if (element.isSelected) {
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
    }
  });

  const scrollBars = getScrollbars(
    context.canvas.width,
    context.canvas.height,
    sceneState.scrollX,
    sceneState.scrollY
  );

  context.fillStyle = SCROLLBAR_COLOR;
  context.fillRect(
    scrollBars.horizontal.x,
    scrollBars.horizontal.y,
    scrollBars.horizontal.width,
    scrollBars.horizontal.height
  );
  context.fillRect(
    scrollBars.vertical.x,
    scrollBars.vertical.y,
    scrollBars.vertical.width,
    scrollBars.vertical.height
  );
  context.fillStyle = fillStyle;
}

function exportAsPNG({
  exportBackground,
  exportVisibleOnly,
  exportPadding = 10,
  viewBackgroundColor
}: {
  exportBackground: boolean;
  exportVisibleOnly: boolean;
  exportPadding?: number;
  viewBackgroundColor: string;
}) {
  if (!elements.length) return window.alert("Cannot export empty canvas.");

  // deselect & rerender

  clearSelection();
  ReactDOM.render(<App />, rootElement, () => {
    // calculate visible-area coords

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

    // create temporary canvas from which we'll export

    const tempCanvas = document.createElement("canvas");
    const tempCanvasCtx = tempCanvas.getContext("2d")!;
    tempCanvas.style.display = "none";
    document.body.appendChild(tempCanvas);
    tempCanvas.width = exportVisibleOnly
      ? subCanvasX2 - subCanvasX1 + exportPadding * 2
      : canvas.width;
    tempCanvas.height = exportVisibleOnly
      ? subCanvasY2 - subCanvasY1 + exportPadding * 2
      : canvas.height;

    // if we're exporting without bg, we need to rerender the scene without it
    //  (it's reset again, below)
    if (!exportBackground) {
      renderScene(rc, context, {
        viewBackgroundColor: null,
        scrollX: 0,
        scrollY: 0
      });
    }

    // copy our original canvas onto the temp canvas
    tempCanvasCtx.drawImage(
      canvas, // source
      exportVisibleOnly // sx
        ? subCanvasX1 - exportPadding
        : 0,
      exportVisibleOnly // sy
        ? subCanvasY1 - exportPadding
        : 0,
      exportVisibleOnly // sWidth
        ? subCanvasX2 - subCanvasX1 + exportPadding * 2
        : canvas.width,
      exportVisibleOnly // sHeight
        ? subCanvasY2 - subCanvasY1 + exportPadding * 2
        : canvas.height,
      0, // dx
      0, // dy
      exportVisibleOnly ? tempCanvas.width : canvas.width, // dWidth
      exportVisibleOnly ? tempCanvas.height : canvas.height // dHeight
    );

    // reset transparent bg back to original
    if (!exportBackground) {
      renderScene(rc, context, { viewBackgroundColor, scrollX: 0, scrollY: 0 });
    }

    // create a temporary <a> elem which we'll use to download the image
    const link = document.createElement("a");
    link.setAttribute("download", "excalidraw.png");
    link.setAttribute("href", tempCanvas.toDataURL("image/png"));
    link.click();

    // clean up the DOM
    link.remove();
    if (tempCanvas !== canvas) tempCanvas.remove();
  });
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

// Casting second argument (DrawingSurface) to any,
// because it is requred by TS definitions and not required at runtime
const generator = rough.generator(null, null as any);

function isTextElement(
  element: ExcalidrawElement
): element is ExcalidrawTextElement {
  return element.type === "text";
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
        fill: element.backgroundColor
      });
    });
    element.draw = (rc, context, { scrollX, scrollY }) => {
      context.translate(element.x + scrollX, element.y + scrollY);
      rc.draw(shape);
      context.translate(-element.x - scrollX, -element.y - scrollY);
    };
  } else if (element.type === "ellipse") {
    const shape = withCustomMathRandom(element.seed, () =>
      generator.ellipse(
        element.width / 2,
        element.height / 2,
        element.width,
        element.height,
        { stroke: element.strokeColor, fill: element.backgroundColor }
      )
    );
    element.draw = (rc, context, { scrollX, scrollY }) => {
      context.translate(element.x + scrollX, element.y + scrollY);
      rc.draw(shape);
      context.translate(-element.x - scrollX, -element.y - scrollY);
    };
  } else if (element.type === "arrow") {
    const [x1, y1, x2, y2, x3, y3, x4, y4] = getArrowPoints(element);
    const shapes = withCustomMathRandom(element.seed, () => [
      //    \
      generator.line(x3, y3, x2, y2, { stroke: element.strokeColor }),
      // -----
      generator.line(x1, y1, x2, y2, { stroke: element.strokeColor }),
      //    /
      generator.line(x4, y4, x2, y2, { stroke: element.strokeColor })
    ]);

    element.draw = (rc, context, { scrollX, scrollY }) => {
      context.translate(element.x + scrollX, element.y + scrollY);
      shapes.forEach(shape => rc.draw(shape));
      context.translate(-element.x - scrollX, -element.y - scrollY);
    };
    return;
  } else if (isTextElement(element)) {
    element.draw = (rc, context, { scrollX, scrollY }) => {
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

function restore() {
  try {
    const savedElements = localStorage.getItem(LOCAL_STORAGE_KEY);
    const savedState = localStorage.getItem(LOCAL_STORAGE_KEY_STATE);

    if (savedElements) {
      elements = JSON.parse(savedElements);
      elements.forEach((element: ExcalidrawElement) => generateDraw(element));
    }

    return savedState ? JSON.parse(savedState) : null;
  } catch (e) {
    elements = [];
    return null;
  }
}

type AppState = {
  draggingElement: ExcalidrawElement | null;
  elementType: string;
  exportBackground: boolean;
  exportVisibleOnly: boolean;
  exportPadding: number;
  currentItemStrokeColor: string;
  currentItemBackgroundColor: string;
  viewBackgroundColor: string;
  scrollX: number;
  scrollY: number;
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

const SHAPES = [
  {
    label: "Rectange",
    value: "rectangle"
  },
  {
    label: "Ellipse",
    value: "ellipse"
  },
  {
    label: "Arrow",
    value: "arrow"
  },
  {
    label: "Text",
    value: "text"
  },
  {
    label: "Selection",
    value: "selection"
  }
];

const shapesShortcutKeys = SHAPES.map(shape => shape.label[0].toLowerCase());

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

const ELEMENT_SHIFT_TRANSLATE_AMOUNT = 5;
const ELEMENT_TRANSLATE_AMOUNT = 1;

class App extends React.Component<{}, AppState> {
  public componentDidMount() {
    document.addEventListener("keydown", this.onKeyDown, false);

    const savedState = restore();
    if (savedState) {
      this.setState(savedState);
    }
  }

  public componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyDown, false);
  }

  public state: AppState = {
    draggingElement: null,
    elementType: "selection",
    exportBackground: false,
    exportVisibleOnly: true,
    exportPadding: 10,
    currentItemStrokeColor: "#000000",
    currentItemBackgroundColor: "#ffffff",
    viewBackgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if ((event.target as HTMLElement).nodeName === "INPUT") {
      return;
    }

    if (event.key === KEYS.ESCAPE) {
      clearSelection();
      this.forceUpdate();
      event.preventDefault();
    } else if (event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE) {
      deleteSelectedElements();
      this.forceUpdate();
      event.preventDefault();
    } else if (isArrowKey(event.key)) {
      const step = event.shiftKey
        ? ELEMENT_SHIFT_TRANSLATE_AMOUNT
        : ELEMENT_TRANSLATE_AMOUNT;
      elements.forEach(element => {
        if (element.isSelected) {
          if (event.key === KEYS.ARROW_LEFT) element.x -= step;
          else if (event.key === KEYS.ARROW_RIGHT) element.x += step;
          else if (event.key === KEYS.ARROW_UP) element.y -= step;
          else if (event.key === KEYS.ARROW_DOWN) element.y += step;
        }
      });
      this.forceUpdate();
      event.preventDefault();
    } else if (event.key === "a" && event.metaKey) {
      elements.forEach(element => {
        element.isSelected = true;
      });
      this.forceUpdate();
      event.preventDefault();
    } else if (shapesShortcutKeys.includes(event.key.toLowerCase())) {
      this.setState({ elementType: findElementByKey(event.key) });
    }
  };

  public render() {
    return (
      <div
        onCut={e => {
          e.clipboardData.setData(
            "text/plain",
            JSON.stringify(elements.filter(element => element.isSelected))
          );
          deleteSelectedElements();
          this.forceUpdate();
          e.preventDefault();
        }}
        onCopy={e => {
          e.clipboardData.setData(
            "text/plain",
            JSON.stringify(elements.filter(element => element.isSelected))
          );
          e.preventDefault();
        }}
        onPaste={e => {
          const paste = e.clipboardData.getData("text");
          let parsedElements;
          try {
            parsedElements = JSON.parse(paste);
          } catch (e) {}
          if (
            Array.isArray(parsedElements) &&
            parsedElements.length > 0 &&
            parsedElements[0].type // need to implement a better check here...
          ) {
            clearSelection();
            parsedElements.forEach(parsedElement => {
              parsedElement.x += 10;
              parsedElement.y += 10;
              parsedElement.seed = randomSeed();
              generateDraw(parsedElement);
              elements.push(parsedElement);
            });
            this.forceUpdate();
          }
          e.preventDefault();
        }}
      >
        <fieldset>
          <legend>Shapes</legend>
          {SHAPES.map(({ value, label }) => (
            <label>
              <input
                type="radio"
                checked={this.state.elementType === value}
                onChange={() => {
                  this.setState({ elementType: value });
                  clearSelection();
                  this.forceUpdate();
                }}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        <canvas
          id="canvas"
          width={window.innerWidth}
          height={window.innerHeight - 210}
          onWheel={e => {
            e.preventDefault();
            const { deltaX, deltaY } = e;
            this.setState(state => ({
              scrollX: state.scrollX - deltaX,
              scrollY: state.scrollY - deltaY
            }));
          }}
          onMouseDown={e => {
            const x =
              e.clientX -
              (e.target as HTMLElement).offsetLeft -
              this.state.scrollX;
            const y =
              e.clientY -
              (e.target as HTMLElement).offsetTop -
              this.state.scrollY;
            const element = newElement(
              this.state.elementType,
              x,
              y,
              this.state.currentItemStrokeColor,
              this.state.currentItemBackgroundColor
            );
            let isDraggingElements = false;
            const cursorStyle = document.documentElement.style.cursor;
            if (this.state.elementType === "selection") {
              const hitElement = elements.find(element => {
                return hitTest(element, x, y);
              });

              // If we click on something
              if (hitElement) {
                if (hitElement.isSelected) {
                  // If that element is not already selected, do nothing,
                  // we're likely going to drag it
                } else {
                  // We unselect every other elements unless shift is pressed
                  if (!e.shiftKey) {
                    clearSelection();
                  }
                  // No matter what, we select it
                  hitElement.isSelected = true;
                }
              } else {
                // If we don't click on anything, let's remove all the selected elements
                clearSelection();
              }

              isDraggingElements = elements.some(element => element.isSelected);

              if (isDraggingElements) {
                document.documentElement.style.cursor = "move";
              }
            }

            if (isTextElement(element)) {
              const text = prompt("What text do you want?");
              if (text === null) {
                return;
              }
              element.text = text;
              element.font = "20px Virgil";
              const font = context.font;
              context.font = element.font;
              const {
                actualBoundingBoxAscent,
                actualBoundingBoxDescent,
                width
              } = context.measureText(element.text);
              element.actualBoundingBoxAscent = actualBoundingBoxAscent;
              context.font = font;
              const height = actualBoundingBoxAscent + actualBoundingBoxDescent;
              // Center the text
              element.x -= width / 2;
              element.y -= actualBoundingBoxAscent;
              element.width = width;
              element.height = height;
            }

            generateDraw(element);
            elements.push(element);
            if (this.state.elementType === "text") {
              this.setState({
                draggingElement: null,
                elementType: "selection"
              });
              element.isSelected = true;
            } else {
              this.setState({ draggingElement: element });
            }

            let lastX = x;
            let lastY = y;

            const onMouseMove = (e: MouseEvent) => {
              const target = e.target;
              if (!(target instanceof HTMLElement)) {
                return;
              }

              if (isDraggingElements) {
                const selectedElements = elements.filter(el => el.isSelected);
                if (selectedElements.length) {
                  const x = e.clientX - target.offsetLeft - this.state.scrollX;
                  const y = e.clientY - target.offsetTop - this.state.scrollY;
                  selectedElements.forEach(element => {
                    element.x += x - lastX;
                    element.y += y - lastY;
                  });
                  lastX = x;
                  lastY = y;
                  this.forceUpdate();
                  return;
                }
              }

              // It is very important to read this.state within each move event,
              // otherwise we would read a stale one!
              const draggingElement = this.state.draggingElement;
              if (!draggingElement) return;
              let width =
                e.clientX -
                target.offsetLeft -
                draggingElement.x -
                this.state.scrollX;
              let height =
                e.clientY -
                target.offsetTop -
                draggingElement.y -
                this.state.scrollY;
              draggingElement.width = width;
              // Make a perfect square or circle when shift is enabled
              draggingElement.height = e.shiftKey ? width : height;

              generateDraw(draggingElement);

              if (this.state.elementType === "selection") {
                setSelection(draggingElement);
              }
              this.forceUpdate();
            };

            const onMouseUp = (e: MouseEvent) => {
              const { draggingElement, elementType } = this.state;

              window.removeEventListener("mousemove", onMouseMove);
              window.removeEventListener("mouseup", onMouseUp);

              document.documentElement.style.cursor = cursorStyle;

              // if no element is clicked, clear the selection and redraw
              if (draggingElement === null) {
                clearSelection();
                this.forceUpdate();
                return;
              }

              if (elementType === "selection") {
                if (isDraggingElements) {
                  isDraggingElements = false;
                }
                elements.pop();
              } else {
                draggingElement.isSelected = true;
              }

              this.setState({
                draggingElement: null,
                elementType: "selection"
              });
              this.forceUpdate();
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);

            this.forceUpdate();
          }}
        />
        <fieldset>
          <legend>Colors</legend>
          <label>
            <input
              type="color"
              value={this.state.viewBackgroundColor}
              onChange={e => {
                this.setState({ viewBackgroundColor: e.target.value });
              }}
            />
            Background
          </label>
          <label>
            <input
              type="color"
              value={this.state.currentItemStrokeColor}
              onChange={e => {
                this.setState({ currentItemStrokeColor: e.target.value });
              }}
            />
            Shape Stroke
          </label>
          <label>
            <input
              type="color"
              value={this.state.currentItemBackgroundColor}
              onChange={e => {
                this.setState({ currentItemBackgroundColor: e.target.value });
              }}
            />
            Shape Background
          </label>
        </fieldset>
        <fieldset>
          <legend>Export</legend>
          <button
            onClick={() => {
              exportAsPNG({
                exportBackground: this.state.exportBackground,
                exportVisibleOnly: this.state.exportVisibleOnly,
                exportPadding: this.state.exportPadding,
                viewBackgroundColor: this.state.viewBackgroundColor
              });
            }}
          >
            Export to png
          </button>
          <label>
            <input
              type="checkbox"
              checked={this.state.exportBackground}
              onChange={e => {
                this.setState({ exportBackground: e.target.checked });
              }}
            />
            background
          </label>
          <label>
            <input
              type="checkbox"
              checked={this.state.exportVisibleOnly}
              onChange={e => {
                this.setState({ exportVisibleOnly: e.target.checked });
              }}
            />
            visible area only
          </label>
          (padding:
          <input
            type="number"
            value={this.state.exportPadding}
            onChange={e => {
              this.setState({ exportPadding: Number(e.target.value) });
            }}
            disabled={!this.state.exportVisibleOnly}
          />
          px)
        </fieldset>
      </div>
    );
  }

  componentDidUpdate() {
    renderScene(rc, context, {
      scrollX: this.state.scrollX,
      scrollY: this.state.scrollY,
      viewBackgroundColor: this.state.viewBackgroundColor
    });
    save(this.state);
  }
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const rc = rough.canvas(canvas);
const context = canvas.getContext("2d")!;

// Big hack to ensure that all the 1px lines are drawn at 1px instead of 2px
// https://stackoverflow.com/questions/13879322/drawing-a-1px-thick-line-in-canvas-creates-a-2px-thick-line/13879402#comment90766599_13879402
context.translate(0.5, 0.5);

ReactDOM.render(<App />, rootElement);
