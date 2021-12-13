import { getFontString, arrayToMap } from "../utils";
import {
  ExcalidrawElementWithBindText,
  ExcalidrawElement,
  ExcalidrawTextElement,
  FontString,
  NonDeletedExcalidrawElement,
} from "./types";
import { mutateElement } from "./mutateElement";
import {
  hasBoundTextElement,
  isExcalidrawElementWithBindText,
} from "./typeChecks";
import { PADDING } from "../constants";
import { MaybeTransformHandleType } from "./transformHandles";
import Scene from "../scene/Scene";

export const redrawTextBoundingBox = (element: ExcalidrawTextElement) => {
  let maxWidth;
  if (element.textContainerId) {
    maxWidth = element.width;
  }
  const metrics = measureText(element.text, getFontString(element), maxWidth);

  mutateElement(element, {
    width: metrics.width,
    height: metrics.height,
    baseline: metrics.baseline,
  });
};

export const bindTextToShapeAfterDuplication = (
  sceneElements: ExcalidrawElement[],
  oldElements: ExcalidrawElement[],
  oldIdToDuplicatedId: Map<ExcalidrawElement["id"], ExcalidrawElement["id"]>,
): void => {
  const sceneElementMap = arrayToMap(sceneElements) as Map<
    ExcalidrawElement["id"],
    ExcalidrawElement
  >;
  oldElements.forEach((element) => {
    if (
      isExcalidrawElementWithBindText(element) &&
      element.boundTextElementId
    ) {
      const newElementId = oldIdToDuplicatedId.get(element.id) as string;
      const newTextElementId = oldIdToDuplicatedId.get(
        element.boundTextElementId,
      ) as string;
      mutateElement(
        sceneElementMap.get(newElementId) as ExcalidrawElementWithBindText,
        {
          boundTextElementId: newTextElementId,
        },
      );
      mutateElement(
        sceneElementMap.get(newTextElementId) as ExcalidrawTextElement,
        {
          textContainerId: newElementId,
        },
      );
    }
  });
};

export const handleBindTextResize = (
  elements: readonly NonDeletedExcalidrawElement[],
  transformHandleType: MaybeTransformHandleType,
) => {
  elements.forEach((element) => {
    if (hasBoundTextElement(element)) {
      const textElement = Scene.getScene(element)!.getElement(
        element.boundTextElementId,
      ) as ExcalidrawTextElement;
      if (textElement && textElement.text) {
        if (!element) {
          return;
        }
        let text = textElement.text;
        let nextWidth = textElement.width;
        let nextHeight = textElement.height;
        let containerHeight = element.height;
        let nextBaseLine = textElement.baseline;
        if (transformHandleType !== "n" && transformHandleType !== "s") {
          console.info("attempt to call wrap text");
          let minCharWidthTillNow = 0;
          if (text) {
            minCharWidthTillNow = getMinCharWidth(getFontString(textElement));
            // check if the diff has exceeded min char width needed
            const diff = Math.abs(
              element.width - textElement.width + PADDING * 2,
            );
            if (diff >= minCharWidthTillNow) {
              text = wrapText(
                textElement.originalText,
                getFontString(textElement),
                element.width,
              );
              console.info("called wrap text");
            }
          }

          const dimensions = measureText(text, getFontString(textElement));
          nextWidth = dimensions.width;
          nextHeight = dimensions.height;
          nextBaseLine = dimensions.baseline;
        }
        // increase height in case text element height exceeds
        if (nextHeight > element.height - PADDING * 2) {
          containerHeight = nextHeight + PADDING * 2;
          mutateElement(element, { height: containerHeight });
        }

        const updatedY = element!.y + containerHeight / 2 - nextHeight / 2;

        const updatedX = element!.x + element!.width / 2 - nextWidth / 2;
        mutateElement(textElement, {
          text,
          width: nextWidth,
          height: nextHeight,
          y: updatedY,
          x: updatedX,
          baseline: nextBaseLine,
        });
      }
    }
  });
};

// https://github.com/grassator/canvas-text-editor/blob/master/lib/FontMetrics.js
export const measureText = (
  text: string,
  font: FontString,
  maxWidth?: number | null,
) => {
  text = text
    .split("\n")
    // replace empty lines with single space because leading/trailing empty
    // lines would be stripped from computation
    .map((x) => x || " ")
    .join("\n");
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.whiteSpace = "pre";
  container.style.font = font;

  if (maxWidth) {
    const lineHeight = getApproxLineHeight(font);
    container.style.width = `${String(maxWidth)}px`;
    container.style.maxWidth = `${String(maxWidth)}px`;
    container.style.overflow = "hidden";
    container.style.wordBreak = "break-word";
    container.style.lineHeight = `${String(lineHeight)}px`;
    container.style.whiteSpace = "normal";
  }
  document.body.appendChild(container);
  container.innerText = text;

  const span = document.createElement("span");
  span.style.display = "inline-block";
  span.style.overflow = "hidden";
  span.style.width = "1px";
  span.style.height = "1px";
  container.appendChild(span);
  // Baseline is important for positioning text on canvas
  const baseline = span.offsetTop + span.offsetHeight;
  const width = container.offsetWidth;

  const height = container.offsetHeight;
  document.body.removeChild(container);

  return { width, height, baseline };
};

const DUMMY_TEXT = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toLocaleUpperCase();
export const getApproxLineHeight = (font: FontString) => {
  return measureText(DUMMY_TEXT, font, null).height;
};

let canvas: HTMLCanvasElement | undefined;
const getTextWidth = (text: string, font: FontString) => {
  if (!canvas) {
    canvas = document.createElement("canvas");
  }
  const canvas2dContext = canvas.getContext("2d") as CanvasRenderingContext2D;
  canvas2dContext.font = font;

  const metrics = canvas2dContext.measureText(text);

  return metrics.width;
};

let totalTime = 0;
let count = 0;
export const wrapText = (
  text: string,
  font: FontString,
  containerWidth: number,
) => {
  const startTime = performance.now();
  const maxWidth = containerWidth - PADDING * 2;
  console.info(
    "maxWidth",
    maxWidth,
    text.length,
    "container width",
    containerWidth,
  );

  const lines: Array<string> = [];
  const originalLines = text.split("\n");
  const spaceWidth = getTextWidth(" ", font);
  originalLines.forEach((originalLine, index) => {
    const words = originalLine.split(" ");
    // This means its newline so push it
    if (words.length === 1 && words[0] === "") {
      lines.push(words[0]);
    } else {
      let currentLine = "";
      let currentLineWidthTillNow = 0;

      let index = 0;
      while (index < words.length) {
        count++;
        const currentWordWidth = getTextWidth(words[index], font);

        // Start breaking longer words exceeding max width
        if (currentWordWidth > maxWidth) {
          // push current line since the current word exceeds the max width
          // so will be appended in next line
          if (currentLine) {
            lines.push(currentLine);
          }
          currentLine = "";
          currentLineWidthTillNow = 0;
          while (words[index].length > 0) {
            count++;
            const currentChar = words[index][0];
            const width = charWidth.calculate(currentChar, font);
            currentLineWidthTillNow += width;
            words[index] = words[index].slice(1);

            if (currentLineWidthTillNow >= maxWidth) {
              lines.push(currentLine.trim());
              currentLine = currentChar;
              currentLineWidthTillNow = width;
              if (currentLineWidthTillNow === maxWidth) {
                currentLine = "";
                currentLineWidthTillNow = 0;
              }
            } else {
              currentLine += currentChar;
            }
          }
          // push current line if appending space exceeds max width
          if (currentLineWidthTillNow + spaceWidth > maxWidth) {
            lines.push(currentLine);
            currentLine = "";
            currentLineWidthTillNow = 0;
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
            currentLineWidthTillNow = getTextWidth(currentLine + word, font);
            count++;

            if (currentLineWidthTillNow >= maxWidth) {
              lines.push(currentLine);
              currentLineWidthTillNow = 0;
              currentLine = "";

              break;
            }
            index++;
            currentLine += `${word} `;
          }

          if (currentLineWidthTillNow === maxWidth) {
            currentLine = "";
            currentLineWidthTillNow = 0;
          }
        }
      }
      if (currentLine) {
        lines.push(currentLine.trim());
      }
    }
  });
  const endTime = performance.now();
  const timeTaken = (endTime - startTime) / 1000;
  totalTime += timeTaken;
  console.info("Time taken", timeTaken);
  console.info("total Time taken,", totalTime);
  console.info("Total runs = ", count);
  console.info("cacheed char", charWidth.getCache(font));
  return lines.join("\n");
};

export const charWidth = (() => {
  const cachedCharWidth: { [key: FontString]: Array<number> } = {};

  const calculate = (char: string, font: FontString) => {
    const ascii = char.charCodeAt(0);
    if (!cachedCharWidth[font]) {
      cachedCharWidth[font] = [];
    }
    if (!cachedCharWidth[font][ascii]) {
      const width = getTextWidth(char, font);
      cachedCharWidth[font][ascii] = width;
    }
    return cachedCharWidth[font][ascii];
  };

  const updateCache = (char: string, font: FontString) => {
    const ascii = char.charCodeAt(0);

    if (!cachedCharWidth[font][ascii]) {
      cachedCharWidth[font][ascii] = calculate(char, font);
    }
  };

  const clearCacheforFont = (font: FontString) => {
    cachedCharWidth[font] = [];
  };

  const getCache = (font: FontString) => {
    return cachedCharWidth[font];
  };
  return {
    calculate,
    updateCache,
    clearCacheforFont,
    getCache,
  };
})();
export const getApproxMinLineWidth = (font: FontString) => {
  return measureText(DUMMY_TEXT.split("").join("\n"), font).width + PADDING * 2;
};

export const getApproxMinLineHeight = (font: FontString) => {
  return getApproxLineHeight(font) + PADDING * 2;
};

export const getMinCharWidth = (font: FontString) => {
  const cache = charWidth.getCache(font);
  if (!cache) {
    return 0;
  }
  const cacheWithOutEmpty = cache.filter((val) => val !== undefined);

  return Math.min(...cacheWithOutEmpty);
};

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
    widthTillNow += getTextWidth(str, font);
    if (index === dummyText.length - 1) {
      index = 0;
    }
    index = index + batchLength;
  }

  while (widthTillNow > width) {
    str = str.substr(0, str.length - 1);
    widthTillNow = getTextWidth(str, font);
  }
  return str.length;
};
