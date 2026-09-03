import {
  BOUND_TEXT_PADDING,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  getFontString,
  isTestEnv,
  normalizeEOL,
} from "@excalidraw/common";

import { getRenderEnvironment } from "./renderEnvironment";

import type { RenderEnvironment } from "./renderEnvironment";

import type { FontString, ExcalidrawTextElement } from "./types";

export const measureText = (
  text: string,
  font: FontString,
  lineHeight: ExcalidrawTextElement["lineHeight"],
  env?: RenderEnvironment,
) => {
  const _text = text
    .split("\n")
    // replace empty lines with single space because leading/trailing empty
    // lines would be stripped from computation
    .map((x) => x || " ")
    .join("\n");
  const fontSize = parseFloat(font);
  const height = getTextHeight(_text, fontSize, lineHeight);
  const width = getTextWidth(_text, font, env);
  return { width, height };
};

const DUMMY_TEXT = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toLocaleUpperCase();

// FIXME rename to getApproxMinContainerWidth
export const getApproxMinLineWidth = (
  font: FontString,
  lineHeight: ExcalidrawTextElement["lineHeight"],
  env?: RenderEnvironment,
) => {
  const maxCharWidth = getMaxCharWidth(font, env);
  if (maxCharWidth === 0) {
    return (
      measureText(DUMMY_TEXT.split("").join("\n"), font, lineHeight, env)
        .width +
      BOUND_TEXT_PADDING * 2
    );
  }
  return maxCharWidth + BOUND_TEXT_PADDING * 2;
};

export const getMinTextElementWidth = (
  font: FontString,
  lineHeight: ExcalidrawTextElement["lineHeight"],
  env?: RenderEnvironment,
) => {
  return measureText("", font, lineHeight, env).width + BOUND_TEXT_PADDING * 2;
};

export const isMeasureTextSupported = () => {
  const width = getTextWidth(
    DUMMY_TEXT,
    getFontString({
      fontSize: DEFAULT_FONT_SIZE,
      fontFamily: DEFAULT_FONT_FAMILY,
    }),
  );
  return width > 0;
};

export const normalizeText = (text: string) => {
  return (
    normalizeEOL(text)
      // replace tabs with spaces so they render and measure correctly
      .replace(/\t/g, "        ")
  );
};

const splitIntoLines = (text: string) => {
  return normalizeText(text).split("\n");
};

/**
 * To get unitless line-height (if unknown) we can calculate it by dividing
 * height-per-line by fontSize.
 */
export const detectLineHeight = (textElement: ExcalidrawTextElement) => {
  const lineCount = splitIntoLines(textElement.text).length;
  return (textElement.height /
    lineCount /
    textElement.fontSize) as ExcalidrawTextElement["lineHeight"];
};

/**
 * We calculate the line height from the font size and the unitless line height,
 * aligning with the W3C spec.
 */
export const getLineHeightInPx = (
  fontSize: ExcalidrawTextElement["fontSize"],
  lineHeight: ExcalidrawTextElement["lineHeight"],
) => {
  return fontSize * lineHeight;
};

// FIXME rename to getApproxMinContainerHeight
export const getApproxMinLineHeight = (
  fontSize: ExcalidrawTextElement["fontSize"],
  lineHeight: ExcalidrawTextElement["lineHeight"],
) => {
  return getLineHeightInPx(fontSize, lineHeight) + BOUND_TEXT_PADDING * 2;
};

let customTextMetricsProvider: TextMetricsProvider | undefined;
const customTextMetricsProviders = new WeakMap<
  RenderEnvironment,
  TextMetricsProvider
>();
/**
 * The lazily-built canvas-backed default provider per environment -- each
 * environment (e.g. each editor's owner window) measures on a canvas of its
 * own. A custom provider (see `setCustomTextMetricsProvider`) is the caller's
 * and is left alone.
 */
const defaultTextMetricsProviders = new WeakMap<
  RenderEnvironment,
  TextMetricsProvider
>();

/**
 * Set a custom text metrics provider.
 *
 * Useful for overriding the width calculation algorithm where canvas API is not available / desired.
 */
export const setCustomTextMetricsProvider = (
  provider: TextMetricsProvider | undefined,
  env?: RenderEnvironment,
) => {
  if (env) {
    if (provider) {
      customTextMetricsProviders.set(env, provider);
    } else {
      customTextMetricsProviders.delete(env);
    }
    return;
  }
  customTextMetricsProvider = provider;
};

export interface TextMetricsProvider {
  getLineWidth(text: string, fontString: FontString): number;
}

class CanvasTextMetricsProvider implements TextMetricsProvider {
  private canvas: HTMLCanvasElement;

  constructor(env: RenderEnvironment) {
    this.canvas = getRenderEnvironment(env).createCanvas();
  }

  /**
   * We need to use the advance width as that's the closest thing to the browser wrapping algo, hence using it for:
   * - text wrapping
   * - wysiwyg editor (+padding)
   *
   * > The advance width is the distance between the glyph's initial pen position and the next glyph's initial pen position.
   */
  public getLineWidth(text: string, fontString: FontString): number {
    const context = this.canvas.getContext("2d")!;
    context.font = fontString;
    const metrics = context.measureText(text);
    const advanceWidth = metrics.width;

    // since in test env the canvas measureText algo
    // doesn't measure text and instead just returns number of
    // characters hence we assume that each letteris 10px
    if (isTestEnv()) {
      return advanceWidth * 10;
    }

    return advanceWidth;
  }
}

const getDefaultTextMetricsProvider = (
  env: RenderEnvironment | undefined,
): TextMetricsProvider => {
  const resolvedEnv = getRenderEnvironment(env);
  let provider = defaultTextMetricsProviders.get(resolvedEnv);
  if (!provider) {
    provider = new CanvasTextMetricsProvider(resolvedEnv);
    defaultTextMetricsProviders.set(resolvedEnv, provider);
  }
  return provider;
};

export const getLineWidth = (
  text: string,
  font: FontString,
  env?: RenderEnvironment,
) => {
  const resolvedEnv = getRenderEnvironment(env);
  const provider =
    customTextMetricsProviders.get(resolvedEnv) ??
    customTextMetricsProvider ??
    getDefaultTextMetricsProvider(resolvedEnv);
  return provider.getLineWidth(text, font);
};

export const getTextWidth = (
  text: string,
  font: FontString,
  env?: RenderEnvironment,
) => {
  const lines = splitIntoLines(text);
  let width = 0;
  lines.forEach((line) => {
    width = Math.max(width, getLineWidth(line, font, env));
  });

  return width;
};

export const getTextHeight = (
  text: string,
  fontSize: number,
  lineHeight: ExcalidrawTextElement["lineHeight"],
) => {
  const lineCount = splitIntoLines(text).length;
  return getLineHeightInPx(fontSize, lineHeight) * lineCount;
};

export const charWidth = (() => {
  // the cache holds one env's metrics at a time: two realms can measure the
  // same font string differently (each measures with its own document's font
  // set), so measuring in a different env drops the cache rather than mixing
  // the two realms' widths under one key.
  //
  // realms measuring in an interleaved fashion therefore keep re-measuring,
  // which is fine -- wrapping runs on edit/resize/restore, not per frame.
  let cachedEnv: RenderEnvironment | undefined;
  let cachedCharWidth: { [key: FontString]: Array<number> } = {};

  const selectEnv = (env: RenderEnvironment | undefined) => {
    const resolvedEnv = getRenderEnvironment(env);
    if (resolvedEnv !== cachedEnv) {
      cachedEnv = resolvedEnv;
      cachedCharWidth = {};
    }
  };

  const calculate = (
    char: string,
    font: FontString,
    env?: RenderEnvironment,
  ) => {
    selectEnv(env);
    const unicode = char.charCodeAt(0);
    if (!cachedCharWidth[font]) {
      cachedCharWidth[font] = [];
    }
    if (cachedCharWidth[font][unicode] === undefined) {
      cachedCharWidth[font][unicode] = getLineWidth(char, font, env);
    }
    return cachedCharWidth[font][unicode];
  };

  const getCache = (font: FontString, env?: RenderEnvironment) =>
    getRenderEnvironment(env) === cachedEnv ? cachedCharWidth[font] : undefined;

  // dropped rather than emptied, so that the approximation helpers fall back
  // to measuring instead of reducing over an empty array
  const clearCache = (font: FontString) => {
    delete cachedCharWidth[font];
  };

  return {
    calculate,
    getCache,
    clearCache,
  };
})();

export const getMinCharWidth = (font: FontString, env?: RenderEnvironment) => {
  const cache = charWidth.getCache(font, env);
  if (!cache) {
    return 0;
  }
  const cacheWithOutEmpty = cache.filter((val) => val !== undefined);

  return Math.min(...cacheWithOutEmpty);
};

export const getMaxCharWidth = (font: FontString, env?: RenderEnvironment) => {
  const cache = charWidth.getCache(font, env);
  if (!cache) {
    return 0;
  }
  const cacheWithOutEmpty = cache.filter((val) => val !== undefined);
  return Math.max(...cacheWithOutEmpty);
};
