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
  const maxCharWidth = getMaxCharWidth(font);
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
export const setCustomTextMetricsProvider = (provider: TextMetricsProvider) => {
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
  const provider =
    customTextMetricsProvider ?? getDefaultTextMetricsProvider(env);
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
  // per-env: two realms can measure the same font string differently
  // (each measures with its own document's font set)
  const cachedCharWidth: {
    [font: FontString]: Map<RenderEnvironment, Array<number>>;
  } = {};

  const calculate = (
    char: string,
    font: FontString,
    env?: RenderEnvironment,
  ) => {
    const unicode = char.charCodeAt(0);
    const resolvedEnv = getRenderEnvironment(env);
    let perEnv = cachedCharWidth[font];
    if (!perEnv) {
      perEnv = new Map();
      cachedCharWidth[font] = perEnv;
    }
    let widths = perEnv.get(resolvedEnv);
    if (!widths) {
      widths = [];
      perEnv.set(resolvedEnv, widths);
    }
    if (widths[unicode] === undefined) {
      widths[unicode] = getLineWidth(char, font, env);
    }
    return widths[unicode];
  };

  const getCache = (font: FontString, env?: RenderEnvironment) => {
    return cachedCharWidth[font]?.get(getRenderEnvironment(env));
  };

  const clearCache = (font: FontString) => {
    // clears every env: a font load invalidates metrics in all realms
    delete cachedCharWidth[font];
  };

  return {
    calculate,
    getCache,
    clearCache,
  };
})();

export const getMinCharWidth = (font: FontString) => {
  const cache = charWidth.getCache(font);
  if (!cache) {
    return 0;
  }
  const cacheWithOutEmpty = cache.filter((val) => val !== undefined);

  return Math.min(...cacheWithOutEmpty);
};

export const getMaxCharWidth = (font: FontString) => {
  const cache = charWidth.getCache(font);
  if (!cache) {
    return 0;
  }
  const cacheWithOutEmpty = cache.filter((val) => val !== undefined);
  return Math.max(...cacheWithOutEmpty);
};
