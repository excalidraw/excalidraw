import { getFontString, arrayToMap, isTestEnv } from "../utils";
import {
  ExcalidrawBindableElement,
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
  FontString,
  NonDeletedExcalidrawElement,
} from "./types";
import { mutateElement } from "./mutateElement";
import { BOUND_TEXT_PADDING } from "../constants";
import { MaybeTransformHandleType } from "./transformHandles";
import Scene from "../scene/Scene";
import { AppState } from "../types";

export const redrawTextBoundingBox = (
  element: ExcalidrawTextElement,
  container: ExcalidrawElement | null,
  appState: AppState,
) => {
  const maxWidth = container
    ? container.width - BOUND_TEXT_PADDING * 2
    : undefined;
  let text = element.text;

  if (container) {
    text = wrapText(
      element.originalText,
      getFontString(element),
      container.width,
    );
  }
  const metrics = measureText(
    element.originalText,
    getFontString(element),
    maxWidth,
  );

  let coordY = element.y;
  // Resize container and vertically center align the text
  if (container) {
    coordY = container.y + container.height / 2 - metrics.height / 2;
    let nextHeight = container.height;
    if (metrics.height > container.height - BOUND_TEXT_PADDING * 2) {
      nextHeight = metrics.height + BOUND_TEXT_PADDING * 2;
      coordY = container.y + nextHeight / 2 - metrics.height / 2;
    }
    mutateElement(container, { height: nextHeight });
  }

  mutateElement(element, {
    width: metrics.width,
    height: metrics.height,
    baseline: metrics.baseline,
    y: coordY,
    text,
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
    const newElementId = oldIdToDuplicatedId.get(element.id) as string;
    const boundTextElementId = getBoundTextElementId(element);

    if (boundTextElementId) {
      const newTextElementId = oldIdToDuplicatedId.get(boundTextElementId)!;
      mutateElement(
        sceneElementMap.get(newElementId) as ExcalidrawBindableElement,
        {
          boundElements: element.boundElements?.concat({
            type: "text",
            id: newTextElementId,
          }),
        },
      );
      mutateElement(
        sceneElementMap.get(newTextElementId) as ExcalidrawTextElement,
        {
          containerId: newElementId,
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
    const boundTextElementId = getBoundTextElementId(element);
    if (boundTextElementId) {
      const textElement = Scene.getScene(element)!.getElement(
        boundTextElementId,
      ) as ExcalidrawTextElement;
      if (textElement && textElement.text) {
        if (!element) {
          return;
        }
        let text = textElement.text;
        let nextHeight = textElement.height;
        let containerHeight = element.height;
        let nextBaseLine = textElement.baseline;
        if (transformHandleType !== "n" && transformHandleType !== "s") {
          if (text) {
            text = wrapText(
              textElement.originalText,
              getFontString(textElement),
              element.width,
            );
          }

          const dimensions = measureText(
            text,
            getFontString(textElement),
            element.width,
          );
          nextHeight = dimensions.height;
          nextBaseLine = dimensions.baseline;
        }
        // increase height in case text element height exceeds
        if (nextHeight > element.height - BOUND_TEXT_PADDING * 2) {
          containerHeight = nextHeight + BOUND_TEXT_PADDING * 2;
          const diff = containerHeight - element.height;
          // fix the y coord when resizing from ne/nw/n
          const updatedY =
            transformHandleType === "ne" ||
            transformHandleType === "nw" ||
            transformHandleType === "n"
              ? element.y - diff
              : element.y;
          mutateElement(element, {
            height: containerHeight,
            y: updatedY,
          });
        }

        const updatedY = element.y + containerHeight / 2 - nextHeight / 2;

        mutateElement(textElement, {
          text,
          // preserve padding and set width correctly
          width: element.width - BOUND_TEXT_PADDING * 2,
          height: nextHeight,
          x: element.x + BOUND_TEXT_PADDING,
          y: updatedY,
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
  container.style.minHeight = "1em";
  if (maxWidth) {
    const lineHeight = getApproxLineHeight(font);
    container.style.width = `${String(maxWidth)}px`;
    container.style.maxWidth = `${String(maxWidth)}px`;
    container.style.overflow = "hidden";
    container.style.wordBreak = "break-word";
    container.style.lineHeight = `${String(lineHeight)}px`;
    container.style.whiteSpace = "pre-wrap";
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
const cacheApproxLineHeight: { [key: FontString]: number } = {};

export const getApproxLineHeight = (font: FontString) => {
  if (cacheApproxLineHeight[font]) {
    return cacheApproxLineHeight[font];
  }
  cacheApproxLineHeight[font] = measureText(DUMMY_TEXT, font, null).height;
  return cacheApproxLineHeight[font];
};

let canvas: HTMLCanvasElement | undefined;
const getTextWidth = (text: string, font: FontString) => {
  if (!canvas) {
    canvas = document.createElement("canvas");
  }
  const canvas2dContext = canvas.getContext("2d")!;
  canvas2dContext.font = font;

  const metrics = canvas2dContext.measureText(text);
  // since in test env the canvas measureText algo
  // doesn't measure text and instead just returns number of
  // characters hence we assume that each letteris 10px
  if (isTestEnv()) {
    return metrics.width * 10;
  }

  return metrics.width;
};

export const wrapText = (
  text: string,
  font: FontString,
  containerWidth: number,
) => {
  const maxWidth = containerWidth - BOUND_TEXT_PADDING * 2;

  const lines: Array<string> = [];
  const originalLines = text.split("\n");
  const spaceWidth = getTextWidth(" ", font);
  originalLines.forEach((originalLine) => {
    const words = originalLine.split(" ");
    // This means its newline so push it
    if (words.length === 1 && words[0] === "") {
      lines.push(words[0]);
    } else {
      let currentLine = "";
      let currentLineWidthTillNow = 0;

      let index = 0;
      while (index < words.length) {
        const currentWordWidth = getTextWidth(words[index], font);

        // Start breaking longer words exceeding max width
        if (currentWordWidth >= maxWidth) {
          // push current line since the current word exceeds the max width
          // so will be appended in next line
          if (currentLine) {
            lines.push(currentLine);
          }
          currentLine = "";
          currentLineWidthTillNow = 0;
          while (words[index].length > 0) {
            const currentChar = words[index][0];
            const width = charWidth.calculate(currentChar, font);
            currentLineWidthTillNow += width;
            words[index] = words[index].slice(1);

            if (currentLineWidthTillNow >= maxWidth) {
              // only remove last trailing space which we have added when joining words
              if (currentLine.slice(-1) === " ") {
                currentLine = currentLine.slice(0, -1);
              }
              lines.push(currentLine);
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
          if (currentLineWidthTillNow + spaceWidth >= maxWidth) {
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

            if (currentLineWidthTillNow >= maxWidth) {
              lines.push(currentLine);
              currentLineWidthTillNow = 0;
              currentLine = "";

              break;
            }
            index++;
            currentLine += `${word} `;

            // Push the word if appending space exceeds max width
            if (currentLineWidthTillNow + spaceWidth >= maxWidth) {
              lines.push(currentLine.slice(0, -1));
              currentLine = "";
              currentLineWidthTillNow = 0;
              break;
            }
          }
          if (currentLineWidthTillNow === maxWidth) {
            currentLine = "";
            currentLineWidthTillNow = 0;
          }
        }
      }
      if (currentLine) {
        // only remove last trailing space which we have added when joining words
        if (currentLine.slice(-1) === " ") {
          currentLine = currentLine.slice(0, -1);
        }
        lines.push(currentLine);
      }
    }
  });
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

  const getCache = (font: FontString) => {
    return cachedCharWidth[font];
  };
  return {
    calculate,
    getCache,
  };
})();
export const getApproxMinLineWidth = (font: FontString) => {
  const maxCharWidth = getMaxCharWidth(font);
  if (maxCharWidth === 0) {
    return (
      measureText(DUMMY_TEXT.split("").join("\n"), font).width +
      BOUND_TEXT_PADDING * 2
    );
  }
  return maxCharWidth + BOUND_TEXT_PADDING * 2;
};

export const getApproxMinLineHeight = (font: FontString) => {
  return getApproxLineHeight(font) + BOUND_TEXT_PADDING * 2;
};

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

export const getBoundTextElementId = (container: ExcalidrawElement | null) => {
  return container?.boundElements?.filter((ele) => ele.type === "text")[0]?.id;
};

export const getBoundTextElement = (element: ExcalidrawElement | null) => {
  if (!element) {
    return null;
  }
  const boundTextElementId = getBoundTextElementId(element);
  if (boundTextElementId) {
    return (
      (Scene.getScene(element)?.getElement(
        boundTextElementId,
      ) as ExcalidrawTextElementWithContainer) || null
    );
  }
  return null;
};

export const getContainerElement = (
  element:
    | (ExcalidrawElement & { containerId: ExcalidrawElement["id"] | null })
    | null,
) => {
  if (!element) {
    return null;
  }
  if (element.containerId) {
    return Scene.getScene(element)?.getElement(element.containerId) || null;
  }
  return null;
};
