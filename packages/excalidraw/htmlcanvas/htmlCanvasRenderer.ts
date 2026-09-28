/**
 * HTML-in-Canvas Renderer
 *
 * Provides utilities to render DOM elements directly into a
 * CanvasRenderingContext2D using the experimental HTML-in-Canvas API.
 * Every public function gracefully falls back to a no-op / false
 * when the API is unavailable.
 */

import {
  isHtmlInCanvasSupported,
  asHtmlInCanvasCtx,
  type HtmlInCanvasContext2D,
} from "./htmlInCanvasSupport";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DrawElementOptions {
  /** Canvas X coordinate (already accounting for scroll + zoom). */
  readonly x: number;
  /** Canvas Y coordinate. */
  readonly y: number;
  /** Optional rotation in radians applied around the element centre. */
  readonly angle?: number;
  /** Scale factor (zoom × devicePixelRatio). */
  readonly scale?: number;
  /** Opacity 0..1 */
  readonly opacity?: number;
  /** Optional clip rect in canvas-space. */
  readonly clip?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

// ---------------------------------------------------------------------------
// Core draw helpers
// ---------------------------------------------------------------------------

/**
 * Draws an arbitrary HTMLElement directly into a canvas context using the
 * experimental `drawElement` API.
 *
 * @returns `true` if the element was drawn natively, `false` if fallback
 *          should be used.
 */
export const drawHtmlElement = (
  ctx: CanvasRenderingContext2D,
  element: HTMLElement,
  opts: DrawElementOptions,
): boolean => {
  if (!isHtmlInCanvasSupported()) {
    return false;
  }

  const hicCtx = asHtmlInCanvasCtx(ctx);
  if (!hicCtx) {
    return false;
  }

  ctx.save();

  // Opacity
  if (opts.opacity !== undefined && opts.opacity < 1) {
    ctx.globalAlpha *= opts.opacity;
  }

  // Clipping
  if (opts.clip) {
    ctx.beginPath();
    ctx.rect(opts.clip.x, opts.clip.y, opts.clip.width, opts.clip.height);
    ctx.clip();
  }

  // Position + scale + rotate
  const scale = opts.scale ?? 1;
  ctx.translate(opts.x, opts.y);

  if (scale !== 1) {
    ctx.scale(scale, scale);
  }

  if (opts.angle) {
    const w = element.offsetWidth;
    const h = element.offsetHeight;
    ctx.translate(w / 2, h / 2);
    ctx.rotate(opts.angle);
    ctx.translate(-w / 2, -h / 2);
  }

  try {
    hicCtx.drawElement(element, 0, 0);
  } catch (err) {
    // Swallow — browser may revoke the origin trial token at any time.
    console.warn("[HTML-in-Canvas] drawElement failed, falling back", err);
    ctx.restore();
    return false;
  }

  ctx.restore();
  return true;
};

// ---------------------------------------------------------------------------
// Rich-text / HTML content rendering
// ---------------------------------------------------------------------------

/**
 * Creates a self-contained DOM node from an HTML string, suitable for
 * being drawn via `drawElement`. The node is **not** attached to the
 * document — the API paints it off-screen.
 */
export const createHtmlContentNode = (
  html: string,
  width: number,
  height: number,
): HTMLDivElement => {
  const container = document.createElement("div");
  container.style.cssText = `
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    box-sizing: border-box;
    font-family: system-ui, sans-serif;
    pointer-events: none;
  `;
  container.innerHTML = html;
  return container;
};

// ---------------------------------------------------------------------------
// Text-editor integration helper
// ---------------------------------------------------------------------------

/**
 * Attempts to render a `<textarea>` (or any editable element) directly
 * into the canvas, preserving native focus, selection and accessibility.
 *
 * When the API is supported, the textarea no longer needs an
 * absolute-positioned overlay — it lives *inside* the canvas paint.
 *
 * @returns `true` if the textarea was drawn natively.
 */
export const drawTextEditorInCanvas = (
  ctx: CanvasRenderingContext2D,
  textarea: HTMLTextAreaElement,
  opts: DrawElementOptions,
): boolean => {
  return drawHtmlElement(ctx, textarea, opts);
};

// ---------------------------------------------------------------------------
// Layer-effect helpers
// ---------------------------------------------------------------------------

/**
 * Draws an HTMLElement with composite / blend-mode effects that are normally
 * impossible when the DOM sits on top of a canvas (z-index overlay).
 */
export const drawHtmlElementWithEffects = (
  ctx: CanvasRenderingContext2D,
  element: HTMLElement,
  opts: DrawElementOptions & {
    readonly compositeOperation?: GlobalCompositeOperation;
    readonly filter?: string;
  },
): boolean => {
  if (!isHtmlInCanvasSupported()) {
    return false;
  }

  ctx.save();

  if (opts.compositeOperation) {
    ctx.globalCompositeOperation = opts.compositeOperation;
  }
  if (opts.filter) {
    ctx.filter = opts.filter;
  }

  const result = drawHtmlElement(ctx, element, opts);

  ctx.restore();
  return result;
};
