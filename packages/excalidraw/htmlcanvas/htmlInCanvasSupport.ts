/**
 * HTML-in-Canvas API Feature Detection & Support
 *
 * Detects browser support for the experimental HTML-in-Canvas API
 * (Chromium Origin Trial). Provides graceful fallback detection
 * so the rest of the codebase can progressively enhance.
 *
 * @see https://developer.chrome.com/blog/html-in-canvas
 */

let _supportCached: boolean | null = null;

/**
 * Checks whether the current browser supports the HTML-in-Canvas API.
 * Result is cached after the first probe.
 */
export const isHtmlInCanvasSupported = (): boolean => {
  if (_supportCached !== null) {
    return _supportCached;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");

    // The experimental API exposes `drawFormattedText` or `drawElement`
    // on CanvasRenderingContext2D when the origin trial / flag is active.
    _supportCached =
      ctx !== null &&
      (typeof (ctx as any).drawElement === "function" ||
        typeof (ctx as any).drawFormattedText === "function");
  } catch {
    _supportCached = false;
  }

  return _supportCached;
};

/**
 * Resets the cached detection result.
 * Useful for testing or when origin-trial tokens change at runtime.
 */
export const resetHtmlInCanvasDetection = (): void => {
  _supportCached = null;
};

/**
 * Guard type — narrows a CanvasRenderingContext2D to one that has
 * the experimental `drawElement` method.
 */
export interface HtmlInCanvasContext2D extends CanvasRenderingContext2D {
  drawElement(element: HTMLElement, x: number, y: number): void;
  drawFormattedText?(formattedText: any, x: number, y: number): void;
}

/**
 * Narrows a context to HtmlInCanvasContext2D if the API is present.
 */
export const asHtmlInCanvasCtx = (
  ctx: CanvasRenderingContext2D,
): HtmlInCanvasContext2D | null => {
  if (typeof (ctx as any).drawElement === "function") {
    return ctx as HtmlInCanvasContext2D;
  }
  return null;
};
