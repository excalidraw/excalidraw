import { Emitter, MIME_TYPES, getFontString } from "@excalidraw/common";

import { measureText } from "./textMeasurements";
import { isTextElement } from "./typeChecks";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  FontFamilyValues,
} from "./types";

/**
 * "Math mode" for text elements.
 *
 * A text element whose source (`originalText`) is wrapped in `$…$` (inline) or
 * `$$…$$` (display) is laid out and rendered as a typeset equation instead of
 * plain text. Nothing is persisted — the LaTeX source stays in
 * `text`/`originalText`, so files remain fully compatible with clients that
 * don't know about math mode (they simply show the raw source).
 *
 * The actual TeX → SVG conversion is delegated to an injectable
 * {@link MathTextProvider} (registered by the editor package, see
 * `packages/excalidraw/mathjax`), following the same pattern as
 * `setCustomTextMetricsProvider`. This module never imports the engine.
 *
 * Invariants:
 * - layout decisions (`measureTextContent`, `getRenderableMathText`) and
 *   rendering (`getMathTextImage`, `getMathTextSvg`) always agree: text is
 *   math only once the provider has produced a valid render for it. While
 *   the provider is still loading, text is laid out as plain text and
 *   re-laid-out once the `loaded` event fires.
 * - a math element is never wrapped: after layout `text === originalText`.
 *   Rendering keys off `text` (the laid-out text) so a box can never show a
 *   typeset equation it wasn't measured for.
 */

export type MathTextSource = {
  /** the LaTeX source, without the delimiters */
  source: string;
  /** true for `$$…$$` (display style), false for `$…$` */
  display: boolean;
};

export type MathTextRenderResult = {
  /**
   * standalone `<svg>` markup (xmlns set, `viewBox` present, glyphs drawn with
   * `currentColor`)
   */
  svg: string;
  /** viewBox width, in 1/1000 em */
  viewBoxWidth: number;
  /** viewBox height, in 1/1000 em */
  viewBoxHeight: number;
};

export interface MathTextProvider {
  isLoaded(): boolean;
  /** resolves once `render` can be used synchronously (called at most once per registration) */
  load(): Promise<void>;
  /**
   * Synchronous TeX → SVG conversion. Must return `null` when not loaded yet
   * and throw on invalid TeX (the element then falls back to plain text).
   *
   * The output must be size-independent: 1000 viewBox units === 1em.
   */
  render(source: string, display: boolean): MathTextRenderResult | null;
}

export type MathTextEvent =
  | { type: "loaded" }
  | { type: "load-error"; error: unknown }
  | { type: "image-ready" };

/** sources longer than this are never treated as math */
export const MAX_MATH_TEXT_SOURCE_LENGTH = 5000;

/**
 * em size (in px) the rasterized `<img>` is given as intrinsic size. The image
 * is always drawn scaled to the element's box, so this only affects the
 * intrinsic size of the SVG image.
 */
const CANONICAL_EM = 100;

const MAX_CACHE_ENTRIES = 500;

const DISPLAY_MATH_RE = /^\s*\$\$([\s\S]+?)\$\$\s*$/;
// no whitespace right after the opening / before the closing `$`, no `$` nor
// newline inside, so that "$5", "$5 to $10", "$ 5 $" or "$$$$" aren't
// mistaken for math
const INLINE_MATH_RE = /^\s*\$([^\s$](?:[^$\n]*[^\s$])?)\$\s*$/;

// -----------------------------------------------------------------------------
// parsing
// -----------------------------------------------------------------------------

export const getMathTextSource = (text: string): MathTextSource | null => {
  if (
    !text ||
    text.length > MAX_MATH_TEXT_SOURCE_LENGTH + 4 ||
    text.indexOf("$") === -1
  ) {
    return null;
  }

  const display = DISPLAY_MATH_RE.exec(text);
  if (display) {
    const source = display[1].trim();
    return source ? { source, display: true } : null;
  }

  const inline = INLINE_MATH_RE.exec(text);
  if (inline) {
    return { source: inline[1], display: false };
  }

  return null;
};

export const isMathText = (text: string) => getMathTextSource(text) !== null;

/**
 * Whether the element's *source* is math, i.e. whether it should be laid out
 * as math (once the provider is ready). Use this to find candidates; use
 * {@link getRenderableMathText} / {@link measureTextContent} for layout.
 */
export const isMathTextElement = (
  element: ExcalidrawElement | null | undefined,
): element is ExcalidrawTextElement =>
  !!element && isTextElement(element) && isMathText(element.originalText);

// -----------------------------------------------------------------------------
// provider registry & events
// -----------------------------------------------------------------------------

type RenderEntry = ({ ok: true } & MathTextRenderResult) | { ok: false };

type ImageEntry = {
  image: HTMLImageElement;
  ready: boolean;
  error: boolean;
  /** resolves once the image is loaded or errored */
  promise: Promise<void>;
};

let provider: MathTextProvider | null = null;
let loadPromise: Promise<void> | null = null;
let loadFailed = false;
let editingElementId: ExcalidrawElement["id"] | null = null;

const renderCache = new Map<string, RenderEntry>();
const imageCache = new Map<string, ImageEntry>();
const emitter = new Emitter<[MathTextEvent]>();

/** LRU-ish bounded cache helpers (Map insertion order = recency) */
const getCached = <T>(cache: Map<string, T>, key: string): T | undefined => {
  const value = cache.get(key);
  if (value !== undefined) {
    cache.delete(key);
    cache.set(key, value);
  }
  return value;
};

const setCached = <T>(cache: Map<string, T>, key: string, value: T) => {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
  cache.set(key, value);
};

const emit = (event: MathTextEvent) => {
  for (const listener of emitter.subscribers) {
    try {
      listener(event);
    } catch (error) {
      console.error(error);
    }
  }
};

/**
 * Registers (or unregisters, with `null`) the TeX → SVG provider. Resets all
 * caches.
 */
export const setMathTextProvider = (nextProvider: MathTextProvider | null) => {
  provider = nextProvider;
  loadPromise = null;
  loadFailed = false;
  renderCache.clear();
  imageCache.clear();
};

export const getMathTextProvider = () => provider;

/**
 * Subscribe to math rendering lifecycle events (provider loaded, rasterized
 * image ready). Returns an unsubscribe function.
 */
export const onMathTextUpdate = (listener: (event: MathTextEvent) => void) =>
  emitter.on(listener);

/**
 * Kicks off (once) the provider loading. Never rejects — a failed load keeps
 * math text rendered as plain text.
 */
export const ensureMathTextProviderLoaded = (): Promise<void> => {
  if (!provider || provider.isLoaded() || loadFailed) {
    return Promise.resolve();
  }
  if (!loadPromise) {
    loadPromise = provider.load().then(
      () => {
        emit({ type: "loaded" });
      },
      (error) => {
        loadFailed = true;
        console.error("Failed to load the math text provider", error);
        emit({ type: "load-error", error });
      },
    );
  }
  return loadPromise;
};

/**
 * While a text element is being edited in the wysiwyg, it's laid out as plain
 * text (the textarea shows the LaTeX source). Math dimensions are applied once
 * the editor is closed.
 */
export const setMathTextEditingElementId = (
  id: ExcalidrawElement["id"] | null,
) => {
  editingElementId = id;
};

// -----------------------------------------------------------------------------
// rendering
// -----------------------------------------------------------------------------

const getRenderEntry = (math: MathTextSource): RenderEntry | null => {
  const key = `${math.display ? "D" : "I"}|${math.source}`;
  const cached = getCached(renderCache, key);
  if (cached) {
    return cached;
  }
  if (!provider) {
    return null;
  }
  if (!provider.isLoaded()) {
    ensureMathTextProviderLoaded();
    return null;
  }

  let entry: RenderEntry;
  try {
    const result = provider.render(math.source, math.display);
    if (!result) {
      return null;
    }
    const { viewBoxWidth, viewBoxHeight } = result;
    const svg = typeof result.svg === "string" ? result.svg.trim() : "";
    entry =
      svg.startsWith("<svg") &&
      Number.isFinite(viewBoxWidth) &&
      Number.isFinite(viewBoxHeight) &&
      viewBoxWidth > 0 &&
      viewBoxHeight > 0
        ? { ok: true, svg, viewBoxWidth, viewBoxHeight }
        : { ok: false };
  } catch (error) {
    // invalid TeX → render as plain text
    entry = { ok: false };
  }

  setCached(renderCache, key, entry);
  return entry;
};

/**
 * Resolves `text` to a ready-to-use math render, or `null` when the text must
 * be treated as plain text: not math, no provider, provider not loaded yet
 * (loading is kicked off), load failed, invalid TeX, or the element is
 * currently being edited.
 */
const resolveMathText = (
  text: string,
  element?: { id?: ExcalidrawElement["id"] } | null,
): {
  math: MathTextSource;
  entry: { ok: true } & MathTextRenderResult;
} | null => {
  const math = getMathTextSource(text);
  if (!math || !provider || loadFailed) {
    return null;
  }
  if (element?.id && element.id === editingElementId) {
    return null;
  }
  const entry = getRenderEntry(math);
  return entry?.ok ? { math, entry } : null;
};

/**
 * Returns the math source if `text` is currently laid out & rendered as math
 * for the given element, `null` otherwise (see {@link resolveMathText}).
 * Consistent with `measureTextContent(...).isMath`.
 */
export const getRenderableMathText = (
  text: string,
  element?: { id?: ExcalidrawElement["id"] } | null,
): MathTextSource | null => resolveMathText(text, element)?.math ?? null;

/**
 * Measures text content, as math (when applicable) or as plain text.
 *
 * `isMath` tells whether the returned dimensions are the equation box.
 */
export const measureTextContent = (
  text: string,
  element: {
    id?: ExcalidrawElement["id"];
    fontSize: number;
    fontFamily: FontFamilyValues;
    lineHeight: ExcalidrawTextElement["lineHeight"];
  },
): { width: number; height: number; isMath: boolean } => {
  const resolved = resolveMathText(text, element);
  if (resolved) {
    return {
      width: (resolved.entry.viewBoxWidth / 1000) * element.fontSize,
      height: (resolved.entry.viewBoxHeight / 1000) * element.fontSize,
      isMath: true,
    };
  }
  const { width, height } = measureText(
    text,
    getFontString(element),
    element.lineHeight,
  );
  return { width, height, isMath: false };
};

// the color comes from element data (i.e. from untrusted files) and is
// interpolated into SVG markup that may be inlined into exported files
const escapeAttribute = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * Builds the final standalone SVG: intrinsic size at {@link CANONICAL_EM},
 * no inline style, and the text color baked in via the `color` attribute
 * (the provider draws glyphs with `currentColor`).
 */
const buildMathSvg = (entry: MathTextRenderResult, color: string) => {
  const width = (entry.viewBoxWidth / 1000) * CANONICAL_EM;
  const height = (entry.viewBoxHeight / 1000) * CANONICAL_EM;
  return entry.svg.replace(/^<svg\b[^>]*>/, (tag) => {
    const attrs = tag
      .slice("<svg".length, -1)
      .replace(/\s+(width|height|style|color)\s*=\s*"[^"]*"/g, "");
    return `<svg width="${width}" height="${height}" color="${escapeAttribute(
      color,
    )}"${attrs}>`;
  });
};

/**
 * Standalone SVG markup for the element's equation in the given color, or
 * `null` if the element isn't (renderable) math.
 */
export const getMathTextSvg = (
  element: Pick<ExcalidrawTextElement, "id" | "text">,
  color: string,
): string | null => {
  const resolved = resolveMathText(element.text, element);
  return resolved ? buildMathSvg(resolved.entry, color) : null;
};

const getImageEntry = (
  math: MathTextSource,
  entry: MathTextRenderResult,
  color: string,
): ImageEntry | null => {
  const key = `${color}|${math.display ? "D" : "I"}|${math.source}`;
  const cached = getCached(imageCache, key);
  if (cached) {
    return cached;
  }
  if (typeof Image === "undefined") {
    return null;
  }

  const image = new Image();
  const imageEntry: ImageEntry = {
    image,
    ready: false,
    error: false,
    promise: new Promise<void>((resolve) => {
      image.onload = () => {
        imageEntry.ready = true;
        resolve();
        emit({ type: "image-ready" });
      };
      image.onerror = () => {
        imageEntry.error = true;
        resolve();
      };
    }),
  };
  setCached(imageCache, key, imageEntry);
  image.src = `data:${MIME_TYPES.svg};charset=utf-8,${encodeURIComponent(
    buildMathSvg(entry, color),
  )}`;
  return imageEntry;
};

/**
 * Rasterized (well, `<img>`-wrapped SVG) equation for canvas rendering, in
 * the given (already theme-resolved) color.
 *
 * Returns `null` while the image is still loading (an `image-ready` event is
 * emitted once it is), when the element isn't renderable math, or when the
 * image failed to load.
 */
export const getMathTextImage = (
  element: Pick<ExcalidrawTextElement, "id" | "text">,
  color: string,
): HTMLImageElement | null => {
  const resolved = resolveMathText(element.text, element);
  if (!resolved) {
    return null;
  }
  const imageEntry = getImageEntry(resolved.math, resolved.entry, color);
  return imageEntry?.ready && !imageEntry.error ? imageEntry.image : null;
};

/**
 * Makes sure the equation images of all math text elements are loaded — to
 * be awaited before a synchronous canvas render (export).
 */
export const prerenderMathTextImages = async (
  elements: readonly ExcalidrawElement[],
  getColor: (element: ExcalidrawTextElement) => string,
): Promise<void> => {
  const pending: Promise<void>[] = [];
  for (const element of elements) {
    if (!isTextElement(element)) {
      continue;
    }
    const resolved = resolveMathText(element.text, element);
    if (!resolved) {
      continue;
    }
    const imageEntry = getImageEntry(
      resolved.math,
      resolved.entry,
      getColor(element),
    );
    if (imageEntry && !imageEntry.ready && !imageEntry.error) {
      pending.push(imageEntry.promise);
    }
  }
  await Promise.all(pending);
};
