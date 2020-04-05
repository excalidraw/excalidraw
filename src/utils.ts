import { FlooredNumber } from "./types";
import { getZoomOrigin } from "./scene";

export const SVG_NS = "http://www.w3.org/2000/svg";

let mockDateTime: string | null = null;

export function setDateTimeForTests(dateTime: string) {
  mockDateTime = dateTime;
}

export function getDateTime() {
  if (mockDateTime) {
    return mockDateTime;
  }

  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hr = date.getHours();
  const min = date.getMinutes();
  const secs = date.getSeconds();

  return `${year}${month}${day}${hr}${min}${secs}`;
}

export function capitalizeString(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function isToolIcon(
  target: Element | EventTarget | null,
): target is HTMLElement {
  return target instanceof HTMLElement && target.className.includes("ToolIcon");
}

export function isInputLike(
  target: Element | EventTarget | null,
): target is
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement
  | HTMLBRElement
  | HTMLDivElement {
  return (
    (target instanceof HTMLElement && target.dataset.type === "wysiwyg") ||
    target instanceof HTMLBRElement || // newline in wysiwyg
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function isWritableElement(
  target: Element | EventTarget | null,
): target is
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLBRElement
  | HTMLDivElement {
  return (
    (target instanceof HTMLElement && target.dataset.type === "wysiwyg") ||
    target instanceof HTMLBRElement || // newline in wysiwyg
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement &&
      (target.type === "text" || target.type === "number"))
  );
}

// https://github.com/grassator/canvas-text-editor/blob/master/lib/FontMetrics.js
export function measureText(text: string, font: string) {
  const line = document.createElement("div");
  const body = document.body;
  line.style.position = "absolute";
  line.style.whiteSpace = "pre";
  line.style.font = font;
  body.appendChild(line);
  // Now we can measure width and height of the letter
  line.innerText = text;
  const width = line.offsetWidth;
  const height = line.offsetHeight;
  // Now creating 1px sized item that will be aligned to baseline
  // to calculate baseline shift
  const span = document.createElement("span");
  span.style.display = "inline-block";
  span.style.overflow = "hidden";
  span.style.width = "1px";
  span.style.height = "1px";
  line.appendChild(span);
  // Baseline is important for positioning text on canvas
  const baseline = span.offsetTop + span.offsetHeight;
  document.body.removeChild(line);

  return { width, height, baseline };
}

export function debounce<T extends any[]>(
  fn: (...args: T) => void,
  timeout: number,
) {
  let handle = 0;
  let lastArgs: T;
  const ret = (...args: T) => {
    lastArgs = args;
    clearTimeout(handle);
    handle = window.setTimeout(() => fn(...args), timeout);
  };
  ret.flush = () => {
    clearTimeout(handle);
    fn(...lastArgs);
  };
  return ret;
}

export function selectNode(node: Element) {
  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

export function removeSelection() {
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
  }
}

export function distance(x: number, y: number) {
  return Math.abs(x - y);
}

export function distance2d(x1: number, y1: number, x2: number, y2: number) {
  const xd = x2 - x1;
  const yd = y2 - y1;
  return Math.hypot(xd, yd);
}

export function resetCursor() {
  document.documentElement.style.cursor = "";
}

export const isFullScreen = () =>
  document.fullscreenElement?.nodeName === "HTML";

export const allowFullScreen = () =>
  document.documentElement.requestFullscreen();

export const exitFullScreen = () => document.exitFullscreen();

export const getShortcutKey = (shortcut: string, prefix = " — "): string => {
  const isMac = /Mac|iPod|iPhone|iPad/.test(window.navigator.platform);
  if (isMac) {
    return `${prefix}${shortcut
      .replace("CtrlOrCmd+", "⌘")
      .replace("Alt+", "⌥")
      .replace("Ctrl+", "⌃")
      .replace("Shift+", "⇧")
      .replace("Del", "⌫")}`;
  }
  return `${prefix}${shortcut.replace("CtrlOrCmd", "Ctrl")}`;
};
export function viewportCoordsToSceneCoords(
  { clientX, clientY }: { clientX: number; clientY: number },
  {
    scrollX,
    scrollY,
    zoom,
  }: {
    scrollX: FlooredNumber;
    scrollY: FlooredNumber;
    zoom: number;
  },
  canvas: HTMLCanvasElement | null,
  scale: number,
) {
  const zoomOrigin = getZoomOrigin(canvas, scale);
  const clientXWithZoom = zoomOrigin.x + (clientX - zoomOrigin.x) / zoom;
  const clientYWithZoom = zoomOrigin.y + (clientY - zoomOrigin.y) / zoom;

  const x = clientXWithZoom - scrollX;
  const y = clientYWithZoom - scrollY;

  return { x, y };
}

export function sceneCoordsToViewportCoords(
  { sceneX, sceneY }: { sceneX: number; sceneY: number },
  {
    scrollX,
    scrollY,
    zoom,
  }: {
    scrollX: FlooredNumber;
    scrollY: FlooredNumber;
    zoom: number;
  },
  canvas: HTMLCanvasElement | null,
  scale: number,
) {
  const zoomOrigin = getZoomOrigin(canvas, scale);
  const sceneXWithZoomAndScroll =
    zoomOrigin.x - (zoomOrigin.x - sceneX - scrollX) * zoom;
  const sceneYWithZoomAndScroll =
    zoomOrigin.y - (zoomOrigin.y - sceneY - scrollY) * zoom;

  const x = sceneXWithZoomAndScroll;
  const y = sceneYWithZoomAndScroll;

  return { x, y };
}

export function getGlobalCSSVariable(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(
    `--${name}`,
  );
}
