import {
  BOUND_TEXT_PADDING,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_FAMILY,
} from "../constants";
import { getFontString, isTestEnv } from "../utils";
import { normalizeText } from "./textElement";
import { ExcalidrawTextElement, FontFamilyValues, FontString } from "./types";

const DUMMY_TEXT = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toLocaleUpperCase();
const cacheLineHeight: { [key: FontString]: number } = {};

export const getLineHeight = (font: FontString) => {
  if (cacheLineHeight[font]) {
    return cacheLineHeight[font];
  }
  const fontSize = parseInt(font);

  // Calculate line height relative to font size
  cacheLineHeight[font] = fontSize * 1.2;
  return cacheLineHeight[font];
};

let canvas: HTMLCanvasElement | undefined;

// since in test env the canvas measureText algo
// doesn't measure text and instead just returns number of
// characters hence we assume that each letter is 10px
const DUMMY_CHAR_WIDTH = 10;

const getLineWidth = (text: string, font: FontString) => {
  if (!canvas) {
    canvas = document.createElement("canvas");
  }
  const canvas2dContext = canvas.getContext("2d")!;
  canvas2dContext.font = font;
  const width = canvas2dContext.measureText(text).width;

  if (isTestEnv()) {
    return width * DUMMY_CHAR_WIDTH;
  }
  return width;
};

export const getTextWidth = (text: string, font: FontString) => {
  const lines = splitIntoLines(text);
  let width = 0;
  lines.forEach((line) => {
    width = Math.max(width, getLineWidth(line, font));
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

export const splitIntoLines = (text: string) => {
  return normalizeText(text).split("\n");
};

export const measureText = (
  text: string,
  font: FontString,
  lineHeight: ExcalidrawTextElement["lineHeight"],
) => {
  text = text
    .split("\n")
    // replace empty lines with single space because leading/trailing empty
    // lines would be stripped from computation
    .map((x) => x || " ")
    .join("\n");
  const fontSize = parseFloat(font);
  const height = getTextHeight(text, fontSize, lineHeight);
  const width = getTextWidth(text, font);

  return { width, height };
};

export const getApproxMinLineWidth = (
  font: FontString,
  lineHeight: ExcalidrawTextElement["lineHeight"],
) => {
  const maxCharWidth = getMaxCharWidth(font);
  if (maxCharWidth === 0) {
    return (
      measureText(DUMMY_TEXT.split("").join("\n"), font, lineHeight).width +
      BOUND_TEXT_PADDING * 2
    );
  }
  return maxCharWidth + BOUND_TEXT_PADDING * 2;
};

// FIXME rename to getApproxMinContainerHeight
export const getApproxMinLineHeight = (
  fontSize: ExcalidrawTextElement["fontSize"],
  lineHeight: ExcalidrawTextElement["lineHeight"],
) => {
  return getLineHeightInPx(fontSize, lineHeight) + BOUND_TEXT_PADDING * 2;
};

export const charWidth = (() => {
  const cachedCharWidth: { [key: FontString]: Array<number> } = {};

  const calculate = (char: string, font: FontString) => {
    const ascii = char.charCodeAt(0);
    if (!cachedCharWidth[font]) {
      cachedCharWidth[font] = [];
    }
    if (!cachedCharWidth[font][ascii]) {
      const width = getLineWidth(char, font);
      cachedCharWidth[font][ascii] = width;
    }

    return cachedCharWidth[font][ascii];
  };

  const getCache = (font: FontString) => {
    return cachedCharWidth[font];
  };
  return {
    calculate,
    getCache,
  };
})();

export const getMaxCharWidth = (font: FontString) => {
  const cache = charWidth.getCache(font);
  if (!cache) {
    return 0;
  }
  const cacheWithOutEmpty = cache.filter((val) => val !== undefined);
  return Math.max(...cacheWithOutEmpty);
};

/** this is not used currently but might be useful
 * in future hence keeping it
 */
/* istanbul ignore next */
export const getApproxCharsToFitInWidth = (font: FontString, width: number) => {
  // Generally lower case is used so converting to lower case
  const dummyText = DUMMY_TEXT.toLocaleLowerCase();
  const batchLength = 6;
  let index = 0;
  let widthTillNow = 0;
  let str = "";
  while (widthTillNow <= width) {
    const batch = dummyText.substr(index, index + batchLength);
    str += batch;
    widthTillNow += getLineWidth(str, font);
    if (index === dummyText.length - 1) {
      index = 0;
    }
    index = index + batchLength;
  }

  while (widthTillNow > width) {
    str = str.substr(0, str.length - 1);
    widthTillNow = getLineWidth(str, font);
  }
  return str.length;
};

export const wrapText = (text: string, font: FontString, maxWidth: number) => {
  // if maxWidth is not finite or NaN which can happen in case of bugs in
  // computation, we need to make sure we don't continue as we'll end up
  // in an infinite loop
  if (!Number.isFinite(maxWidth) || maxWidth < 0) {
    return text;
  }

  const lines: Array<string> = [];
  const originalLines = text.split("\n");
  const spaceWidth = getLineWidth(" ", font);

  let currentLine = "";
  let currentLineWidthTillNow = 0;

  const push = (str: string) => {
    if (str.trim()) {
      lines.push(str);
    }
  };

  const resetParams = () => {
    currentLine = "";
    currentLineWidthTillNow = 0;
  };

  originalLines.forEach((originalLine) => {
    const currentLineWidth = getTextWidth(originalLine, font);

    //Push the line if its <= maxWidth
    if (currentLineWidth <= maxWidth) {
      lines.push(originalLine);
      return; // continue
    }
    const words = originalLine.split(" ");

    resetParams();

    let index = 0;

    while (index < words.length) {
      const currentWordWidth = getLineWidth(words[index], font);

      // This will only happen when single word takes entire width
      if (currentWordWidth === maxWidth) {
        push(words[index]);
        index++;
      }

      // Start breaking longer words exceeding max width
      else if (currentWordWidth > maxWidth) {
        // push current line since the current word exceeds the max width
        // so will be appended in next line
        push(currentLine);

        resetParams();

        while (words[index].length > 0) {
          const currentChar = String.fromCodePoint(
            words[index].codePointAt(0)!,
          );
          const width = charWidth.calculate(currentChar, font);
          currentLineWidthTillNow += width;
          words[index] = words[index].slice(currentChar.length);

          if (currentLineWidthTillNow >= maxWidth) {
            push(currentLine);
            currentLine = currentChar;
            currentLineWidthTillNow = width;
          } else {
            currentLine += currentChar;
          }
        }

        // push current line if appending space exceeds max width
        if (currentLineWidthTillNow + spaceWidth >= maxWidth) {
          push(currentLine);
          resetParams();
        } else {
          // space needs to be appended before next word
          // as currentLine contains chars which couldn't be appended
          // to previous line
          currentLine += " ";
          currentLineWidthTillNow += spaceWidth;
        }
        index++;
      } else {
        // Start appending words in a line till max width reached
        while (currentLineWidthTillNow < maxWidth && index < words.length) {
          const word = words[index];
          currentLineWidthTillNow = getLineWidth(currentLine + word, font);

          if (currentLineWidthTillNow > maxWidth) {
            push(currentLine);
            resetParams();

            break;
          }
          index++;
          currentLine += `${word} `;

          // Push the word if appending space exceeds max width
          if (currentLineWidthTillNow + spaceWidth >= maxWidth) {
            const word = currentLine.slice(0, -1);
            push(word);
            resetParams();
            break;
          }
        }
      }
    }
    if (currentLine.slice(-1) === " ") {
      // only remove last trailing space which we have added when joining words
      currentLine = currentLine.slice(0, -1);
      push(currentLine);
    }
  });
  return lines.join("\n");
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
 * Unitless line height
 *
 * In previous versions we used `normal` line height, which browsers interpret
 * differently, and based on font-family and font-size.
 *
 * To make line heights consistent across browsers we hardcode the values for
 * each of our fonts based on most common average line-heights.
 * See https://github.com/excalidraw/excalidraw/pull/6360#issuecomment-1477635971
 * where the values come from.
 */
const DEFAULT_LINE_HEIGHT = {
  // ~1.25 is the average for Virgil in WebKit and Blink.
  // Gecko (FF) uses ~1.28.
  [FONT_FAMILY.Virgil]: 1.25 as ExcalidrawTextElement["lineHeight"],
  // ~1.15 is the average for Virgil in WebKit and Blink.
  // Gecko if all over the place.
  [FONT_FAMILY.Helvetica]: 1.15 as ExcalidrawTextElement["lineHeight"],
  // ~1.2 is the average for Virgil in WebKit and Blink, and kinda Gecko too
  [FONT_FAMILY.Cascadia]: 1.2 as ExcalidrawTextElement["lineHeight"],
};

export const getDefaultLineHeight = (fontFamily: FontFamilyValues) => {
  if (fontFamily) {
    return DEFAULT_LINE_HEIGHT[fontFamily];
  }
  return DEFAULT_LINE_HEIGHT[DEFAULT_FONT_FAMILY];
};
