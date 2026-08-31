/**
 * Host environment used by the renderer and export pipeline.
 *
 * Defaults to browser globals. Override it to run the export pipeline where
 * `document`/`window` don't exist (Node with `node-canvas` / `@napi-rs/canvas`),
 * mirroring the escape hatch `setCustomTextMetricsProvider` already provides
 * for text measurement.
 *
 * SCOPE: canvas export only (`exportToCanvas`, `exportToBlob`). `exportToSvg`
 * builds its output through `document.createElementNS` / `createTextNode` /
 * `createComment` and stays browser-only -- this abstraction does not make it
 * importable-and-runnable under Node.
 */
export type RenderEnvironment = {
  /** Creates a blank canvas. Callers set `width`/`height` themselves. */
  createCanvas: () => HTMLCanvasElement;
  /**
   * Creates an image to be decoded from a data URL and later used as a
   * `drawImage` source.
   *
   * NOTE: typed as `HTMLImageElement` because the renderer is typed against
   * the DOM lib throughout. Non-DOM implementations (node-canvas et al) need
   * to cast; they must support `src`, `onload`, `onerror`, `naturalWidth`,
   * `naturalHeight` and be accepted by their canvas' `drawImage`.
   */
  createImage: () => HTMLImageElement;
};

let overrides: Partial<RenderEnvironment> = {};

/**
 * Resolved lazily on every access so that importing this module never touches
 * `document`/`window`.
 *
 * NOTE: deliberately does NOT carry a devicePixelRatio. The backing-store scale
 * is per-canvas, not per-process -- it is threaded through
 * `StaticCanvasRenderConfig["scale"]`, which already carries the owner window's
 * ratio (editor) or exportScale (export).
 */
const environment: RenderEnvironment = {
  createCanvas: () =>
    (overrides.createCanvas ?? (() => document.createElement("canvas")))(),
  createImage: () => (overrides.createImage ?? (() => new Image()))(),
};

/**
 * Overrides the host environment process-wide. Partial overrides fall back to
 * the browser defaults, so a Node caller that only needs canvas and image
 * factories can supply just those.
 */
export const setRenderEnvironment = (env: Partial<RenderEnvironment>) => {
  overrides = { ...env };
  invalidateCaches();
};

/** Restores the browser defaults. */
export const resetRenderEnvironment = () => {
  overrides = {};
  invalidateCaches();
};

/**
 * Modules that lazily build and cache host objects (canvases, images) register
 * a clearer here, so that swapping the environment doesn't silently leave
 * objects from the previous one in place.
 */
const cacheInvalidators = new Set<() => void>();

export const onRenderEnvironmentChange = (invalidate: () => void) => {
  cacheInvalidators.add(invalidate);
  return () => cacheInvalidators.delete(invalidate);
};

const invalidateCaches = () => {
  cacheInvalidators.forEach((invalidate) => invalidate());
};

export const getRenderEnvironment = (): RenderEnvironment => environment;
