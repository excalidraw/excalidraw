/**
 * Host environment used by the renderer and export pipeline.
 *
 * The default is the browser's. An explicit environment (see
 * `StaticCanvasRenderConfig["renderEnvironment"]`) scopes canvas and image
 * creation to one render target -- e.g. the editor's owner window, so that
 * one process can host editors in multiple realms (popouts, multi-tenant
 * embeds). `setRenderEnvironment` overrides the default process-wide, for
 * the export pipeline running where `document`/`window` don't exist (Node
 * with `node-canvas` / `@napi-rs/canvas`).
 *
 * `exportToSvg` builds its output through `document.createElementNS` /
 * `createTextNode` / `createComment` and stays browser-only -- this
 * abstraction does not make it importable-and-runnable under Node.
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

const defaultCreateCanvas = () => document.createElement("canvas");
const defaultCreateImage = () => new Image();

/**
 * NOTE: deliberately does NOT carry a devicePixelRatio. The backing-store scale
 * is per-canvas, not per-process -- it is threaded through
 * `StaticCanvasRenderConfig["scale"]`, which already carries the owner window's
 * ratio (editor) or exportScale (export).
 */
let environment: RenderEnvironment = {
  createCanvas: defaultCreateCanvas,
  createImage: defaultCreateImage,
};

/**
 * Overrides the default host environment process-wide. Partial overrides fall
 * back to the browser defaults, so a Node caller that only needs canvas and
 * image factories can supply just those.
 *
 * Per-instance environments are passed explicitly via
 * `StaticCanvasRenderConfig["renderEnvironment"]` or the `env` argument of
 * `getRenderEnvironment`; this override only affects code paths that don't
 * have an instance to scope to (headless export).
 *
 * Each call installs a fresh environment object. Caches of host objects are
 * keyed by environment identity (see e.g. `elementWithCanvasCache` in
 * `renderElement.ts`), so the fresh identity invalidates them without any
 * invalidator registry: a lookup under the new default never hits an entry
 * built under the old one, and the orphaned entries are GC-eligible.
 */
export const setRenderEnvironment = (env: Partial<RenderEnvironment>) => {
  environment = {
    createCanvas: env.createCanvas ?? defaultCreateCanvas,
    createImage: env.createImage ?? defaultCreateImage,
  };
};

/** Restores the browser defaults. */
export const resetRenderEnvironment = () => {
  environment = {
    createCanvas: defaultCreateCanvas,
    createImage: defaultCreateImage,
  };
};

/**
 * Resolves the host environment for a render. An explicitly scoped
 * environment (e.g. the editor's owner window) takes precedence over the
 * process-wide default.
 */
export const getRenderEnvironment = (
  env?: RenderEnvironment,
): RenderEnvironment => env ?? environment;
