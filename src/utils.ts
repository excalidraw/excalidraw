import {
  exportToCanvas as _exportToCanvas,
  exportToSvg as _exportToSvg,
} from "./scene/export";
import { getDefaultAppState } from "./appState";
import { AppState } from "./types";
import { getZoomOrigin } from "./scene";
import {
  CURSOR_TYPE,
  FONT_FAMILY,
  WINDOWS_EMOJI_FALLBACK_FONT,
} from "./constants";
import { ExcalidrawElement, FontFamily, FontString } from "./element/types";
import { getNonDeletedElements } from "./element";

export const SVG_NS = "http://www.w3.org/2000/svg";

let mockDateTime: string | null = null;

export const setDateTimeForTests = (dateTime: string) => {
  mockDateTime = dateTime;
};

export const getDateTime = () => {
  if (mockDateTime) {
    return mockDateTime;
  }

  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hr = `${date.getHours()}`.padStart(2, "0");
  const min = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}-${hr}${min}`;
};

export const capitalizeString = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1);

export const isToolIcon = (
  target: Element | EventTarget | null,
): target is HTMLElement =>
  target instanceof HTMLElement && target.className.includes("ToolIcon");

export const isInputLike = (
  target: Element | EventTarget | null,
): target is
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement
  | HTMLBRElement
  | HTMLDivElement =>
  (target instanceof HTMLElement && target.dataset.type === "wysiwyg") ||
  target instanceof HTMLBRElement || // newline in wysiwyg
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement;

export const isWritableElement = (
  target: Element | EventTarget | null,
): target is
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLBRElement
  | HTMLDivElement =>
  (target instanceof HTMLElement && target.dataset.type === "wysiwyg") ||
  target instanceof HTMLBRElement || // newline in wysiwyg
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLInputElement &&
    (target.type === "text" || target.type === "number"));

export const getFontFamilyString = ({
  fontFamily,
}: {
  fontFamily: FontFamily;
}) => {
  return `${FONT_FAMILY[fontFamily]}, ${WINDOWS_EMOJI_FALLBACK_FONT}`;
};

/** returns fontSize+fontFamily string for assignment to DOM elements */
export const getFontString = ({
  fontSize,
  fontFamily,
}: {
  fontSize: number;
  fontFamily: FontFamily;
}) => {
  return `${fontSize}px ${getFontFamilyString({ fontFamily })}` as FontString;
};

// https://github.com/grassator/canvas-text-editor/blob/master/lib/FontMetrics.js
export const measureText = (text: string, font: FontString) => {
  const line = document.createElement("div");
  const body = document.body;
  line.style.position = "absolute";
  line.style.whiteSpace = "pre";
  line.style.font = font;
  body.appendChild(line);
  line.innerText = text
    .split("\n")
    // replace empty lines with single space because leading/trailing empty
    //  lines would be stripped from computation
    .map((x) => x || " ")
    .join("\n");
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
};

export const debounce = <T extends any[]>(
  fn: (...args: T) => void,
  timeout: number,
) => {
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
};

export const selectNode = (node: Element) => {
  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }
};

export const removeSelection = () => {
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
  }
};

export const distance = (x: number, y: number) => Math.abs(x - y);

export const resetCursor = () => {
  document.documentElement.style.cursor = "";
};

export const setCursorForShape = (shape: string) => {
  if (shape === "selection") {
    resetCursor();
  } else {
    document.documentElement.style.cursor = CURSOR_TYPE.CROSSHAIR;
  }
};

export const isFullScreen = () =>
  document.fullscreenElement?.nodeName === "HTML";

export const allowFullScreen = () =>
  document.documentElement.requestFullscreen();

export const exitFullScreen = () => document.exitFullscreen();

export const getShortcutKey = (shortcut: string): string => {
  const isMac = /Mac|iPod|iPhone|iPad/.test(window.navigator.platform);
  if (isMac) {
    return `${shortcut
      .replace(/\bCtrlOrCmd\b/i, "Cmd")
      .replace(/\bAlt\b/i, "Option")
      .replace(/\bDel\b/i, "Delete")
      .replace(/\b(Enter|Return)\b/i, "Enter")}`;
  }
  return `${shortcut.replace(/\bCtrlOrCmd\b/i, "Ctrl")}`;
};
export const viewportCoordsToSceneCoords = (
  { clientX, clientY }: { clientX: number; clientY: number },
  appState: AppState,
  canvas: HTMLCanvasElement | null,
  scale: number,
) => {
  const zoomOrigin = getZoomOrigin(canvas, scale);
  const clientXWithZoom =
    zoomOrigin.x +
    (clientX - zoomOrigin.x - appState.offsetLeft) / appState.zoom;
  const clientYWithZoom =
    zoomOrigin.y +
    (clientY - zoomOrigin.y - appState.offsetTop) / appState.zoom;

  const x = clientXWithZoom - appState.scrollX;
  const y = clientYWithZoom - appState.scrollY;

  return { x, y };
};

export const sceneCoordsToViewportCoords = (
  { sceneX, sceneY }: { sceneX: number; sceneY: number },
  appState: AppState,
  canvas: HTMLCanvasElement | null,
  scale: number,
) => {
  const zoomOrigin = getZoomOrigin(canvas, scale);
  const x =
    zoomOrigin.x -
    (zoomOrigin.x - sceneX - appState.scrollX - appState.offsetLeft) *
      appState.zoom;
  const y =
    zoomOrigin.y -
    (zoomOrigin.y - sceneY - appState.scrollY - appState.offsetTop) *
      appState.zoom;

  return { x, y };
};

export const getGlobalCSSVariable = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--${name}`);

const RS_LTR_CHARS =
  "A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF" +
  "\u2C00-\uFB1C\uFDFE-\uFE6F\uFEFD-\uFFFF";
const RS_RTL_CHARS = "\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC";
const RE_RTL_CHECK = new RegExp(`^[^${RS_LTR_CHARS}]*[${RS_RTL_CHARS}]`);
/**
 * Checks whether first directional character is RTL. Meaning whether it starts
 *  with RTL characters, or indeterminate (numbers etc.) characters followed by
 *  RTL.
 * See https://github.com/excalidraw/excalidraw/pull/1722#discussion_r436340171
 */
export const isRTL = (text: string) => {
  return RE_RTL_CHECK.test(text);
};

export function tupleToCoors(
  xyTuple: readonly [number, number],
): { x: number; y: number } {
  const [x, y] = xyTuple;
  return { x, y };
}

/** use as a rejectionHandler to mute filesystem Abort errors */
export const muteFSAbortError = (error?: Error) => {
  if (error?.name === "AbortError") {
    return;
  }
  throw error;
};

export const findIndex = <T>(
  array: readonly T[],
  cb: (element: T, index: number, array: readonly T[]) => boolean,
  fromIndex: number = 0,
) => {
  if (fromIndex < 0) {
    fromIndex = array.length + fromIndex;
  }
  fromIndex = Math.min(array.length, Math.max(fromIndex, 0));
  let i = fromIndex - 1;
  while (++i < array.length) {
    if (cb(array[i], i, array)) {
      return i;
    }
  }
  return -1;
};

export const findLastIndex = <T>(
  array: readonly T[],
  cb: (element: T, index: number, array: readonly T[]) => boolean,
  fromIndex: number = array.length - 1,
) => {
  if (fromIndex < 0) {
    fromIndex = array.length + fromIndex;
  }
  fromIndex = Math.min(array.length - 1, Math.max(fromIndex, 0));
  let i = fromIndex + 1;
  while (--i > -1) {
    if (cb(array[i], i, array)) {
      return i;
    }
  }
  return -1;
};

// Export functions

type ExportOpts = {
  elements: readonly ExcalidrawElement[];
  appState?: Omit<AppState, "offsetTop" | "offsetLeft">;
  getDimensions: (
    width: number,
    height: number,
  ) => { width: number; height: number; scale: number };
};

const exportToCanvas = ({
  elements,
  appState = getDefaultAppState(),
  getDimensions = (width, height) => ({ width, height, scale: 1 }),
}: ExportOpts) => {
  return _exportToCanvas(
    getNonDeletedElements(elements),
    { ...appState, offsetTop: 0, offsetLeft: 0 },
    {
      exportBackground: appState.exportBackground ?? true,
      viewBackgroundColor: appState.viewBackgroundColor ?? "#FFF",
      shouldAddWatermark: appState.shouldAddWatermark ?? false,
    },
    (width, height) => {
      const canvas = document.createElement("canvas");
      const ret = getDimensions(width, height);

      canvas.width = ret.width;
      canvas.height = ret.height;

      return canvas;
    },
  );
};

export const exportToBlob = (
  opts: ExportOpts & {
    mimeType?: string;
    quality?: number;
  },
): Promise<Blob | null> => {
  const canvas = exportToCanvas(opts);

  let { mimeType = "image/png", quality } = opts;

  if (mimeType === "image/png" && typeof quality === "number") {
    console.warn(`"quality" will be ignored for "image/png" mimeType`);
  }

  if (mimeType === "image/jpg") {
    mimeType = "image/jpeg";
  }

  quality = quality ? quality : /image\/jpe?g/.test(mimeType) ? 0.92 : 0.8;

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
};

export const exportToSvg = ({
  elements,
  appState = getDefaultAppState(),
  exportPadding,
  metadata,
}: ExportOpts & {
  exportPadding?: number;
  metadata?: string;
}): SVGSVGElement => {
  return _exportToSvg(getNonDeletedElements(elements), {
    ...appState,
    exportPadding,
    metadata,
  });
};
