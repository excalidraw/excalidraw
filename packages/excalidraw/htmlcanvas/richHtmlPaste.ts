/**
 * Rich HTML Paste → Canvas renderer
 *
 * When HTML-in-Canvas is supported, pasted HTML content can be rendered
 * directly onto the infinite canvas surface as a native DOM layout
 * instead of being converted to plain text or rasterised via
 * `html2canvas` / SVG foreignObject workarounds.
 */

import {
  isHtmlInCanvasSupported,
  drawHtmlElement,
  createHtmlContentNode,
} from "../htmlcanvas";

export interface RichHtmlPasteResult {
  /** Whether native rendering was used. */
  readonly native: boolean;
  /** The container node (useful if the caller wants to keep a reference). */
  readonly node: HTMLDivElement | null;
}

/**
 * Attempts to render an HTML string directly onto the canvas at the
 * given scene coordinates.
 *
 * @returns An object indicating whether native rendering succeeded.
 *          When `native` is `false`, the caller should fall back to
 *          the existing paste-as-text / rasterise path.
 */
export const pasteHtmlToCanvas = (
  ctx: CanvasRenderingContext2D,
  html: string,
  opts: {
    readonly x: number;
    readonly y: number;
    readonly maxWidth: number;
    readonly maxHeight: number;
    readonly scale: number;
    readonly angle?: number;
    readonly opacity?: number;
  },
): RichHtmlPasteResult => {
  if (!isHtmlInCanvasSupported()) {
    return { native: false, node: null };
  }

  const node = createHtmlContentNode(html, opts.maxWidth, opts.maxHeight);

  // Temporarily attach to measure layout (required by the API).
  node.style.position = "fixed";
  node.style.visibility = "hidden";
  document.body.appendChild(node);

  const drawn = drawHtmlElement(ctx, node, {
    x: opts.x,
    y: opts.y,
    scale: opts.scale,
    angle: opts.angle,
    opacity: opts.opacity,
  });

  document.body.removeChild(node);

  return { native: drawn, node: drawn ? node : null };
};
