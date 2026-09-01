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
  /**
   * Creates a fillable path from an SVG path string -- freedraw elements are
   * filled through one.
   *
   * Optional, because browsers always have the global `Path2D` this falls back
   * to. A Node host MUST supply it (e.g. `@napi-rs/canvas`'s `Path2D`) or
   * install `globalThis.Path2D` itself: Node has no such global, and without
   * one every freedraw element fails to render.
   */
  createPath?: (svgPath: string) => Path2D;
};

const defaultCreateCanvas = () => document.createElement("canvas");
const defaultCreateImage = () => new Image();
const defaultCreatePath = (svgPath: string) => {
  if (typeof Path2D === "undefined") {
    throw new Error(
      "Excalidraw: rendering a freedraw element needs a `Path2D` " +
        "implementation, and this environment has no global one. Pass " +
        "`createPath` in the render environment (e.g. `@napi-rs/canvas`'s " +
        "`Path2D`) or assign `globalThis.Path2D`.",
    );
  }
  return new Path2D(svgPath);
};

/**
 * NOTE: deliberately does NOT carry a devicePixelRatio. The backing-store scale
 * is per-canvas, not per-process -- it is threaded through
 * `StaticCanvasRenderConfig["scale"]`, which already carries the owner window's
 * ratio (editor) or exportScale (export).
 */
let environment: RenderEnvironment = {
  createCanvas: defaultCreateCanvas,
  createImage: defaultCreateImage,
  createPath: defaultCreatePath,
};

/**
 * Overrides the default host environment process-wide. Partial overrides fall
 * back to the browser defaults, so a caller that only needs canvas and image
 * factories can supply just those. NOTE: under Node the `createPath` default
 * (the global `Path2D`) throws, so a Node caller drawing freedraw elements has
 * to supply `createPath` too -- see the field's docs.
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
    createPath: env.createPath ?? defaultCreatePath,
  };
};

/** Restores the browser defaults. */
export const resetRenderEnvironment = () => {
  environment = {
    createCanvas: defaultCreateCanvas,
    createImage: defaultCreateImage,
    createPath: defaultCreatePath,
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

/**
 * Resolves the path factory for a render. `createPath` is the one optional
 * member of the contract, so this fills in the global-`Path2D` default for
 * environments that omit it.
 */
export const getCreatePath = (
  env?: RenderEnvironment,
): ((svgPath: string) => Path2D) =>
  getRenderEnvironment(env).createPath ?? defaultCreatePath;
