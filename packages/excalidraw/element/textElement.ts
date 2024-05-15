import { getFontString, arrayToMap, isTestEnv, normalizeEOL } from "../utils";
import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawElementType,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
  FontFamilyValues,
  FontString,
  NonDeletedExcalidrawElement,
} from "./types";
import { mutateElement } from "./mutateElement";
import {
  ARROW_LABEL_FONT_SIZE_TO_MIN_WIDTH_RATIO,
  ARROW_LABEL_WIDTH_FRACTION,
  BOUND_TEXT_PADDING,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_FAMILY,
  TEXT_ALIGN,
  VERTICAL_ALIGN,
} from "../constants";
import type { MaybeTransformHandleType } from "./transformHandles";
import { isTextElement } from ".";
import { isBoundToContainer, isArrowElement } from "./typeChecks";
import { LinearElementEditor } from "./linearElementEditor";
import type { AppState } from "../types";
import {
  resetOriginalContainerCache,
  updateOriginalContainerCache,
} from "./containerCache";
import type { ExtractSetType, MakeBrand } from "../utility-types";

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

export const redrawTextBoundingBox = (
  textElement: ExcalidrawTextElement,
  container: ExcalidrawElement | null,
  elementsMap: ElementsMap,
  informMutation = true,
) => {
  let maxWidth = undefined;
  const boundTextUpdates = {
    x: textElement.x,
    y: textElement.y,
    text: textElement.text,
    width: textElement.width,
    height: textElement.height,
    angle: container?.angle ?? textElement.angle,
  };

  boundTextUpdates.text = textElement.text;

  if (container || !textElement.autoResize) {
    maxWidth = container
      ? getBoundTextMaxWidth(container, textElement)
      : textElement.width;
    boundTextUpdates.text = wrapText(
      textElement.originalText,
      getFontString(textElement),
      maxWidth,
    );
  }

  const metrics = measureText(
    boundTextUpdates.text,
    getFontString(textElement),
    textElement.lineHeight,
  );

  // Note: only update width for unwrapped text and bound texts (which always have autoResize set to true)
  if (textElement.autoResize) {
    boundTextUpdates.width = metrics.width;
  }
  boundTextUpdates.height = metrics.height;

  if (container) {
    const maxContainerHeight = getBoundTextMaxHeight(
      container,
      textElement as ExcalidrawTextElementWithContainer,
    );
    const maxContainerWidth = getBoundTextMaxWidth(container, textElement);

    if (!isArrowElement(container) && metrics.height > maxContainerHeight) {
      const nextHeight = computeContainerDimensionForBoundText(
        metrics.height,
        container.type,
      );
      mutateElement(container, { height: nextHeight }, informMutation);
      updateOriginalContainerCache(container.id, nextHeight);
    }
    if (metrics.width > maxContainerWidth) {
      const nextWidth = computeContainerDimensionForBoundText(
        metrics.width,
        container.type,
      );
      mutateElement(container, { width: nextWidth }, informMutation);
    }
    const updatedTextElement = {
      ...textElement,
      ...boundTextUpdates,
    } as ExcalidrawTextElementWithContainer;
    const { x, y } = computeBoundTextPosition(
      container,
      updatedTextElement,
      elementsMap,
    );
    boundTextUpdates.x = x;
    boundTextUpdates.y = y;
  }

  mutateElement(textElement, boundTextUpdates, informMutation);
};

export const bindTextToShapeAfterDuplication = (
  newElements: ExcalidrawElement[],
  oldElements: ExcalidrawElement[],
  oldIdToDuplicatedId: Map<ExcalidrawElement["id"], ExcalidrawElement["id"]>,
): void => {
  const newElementsMap = arrayToMap(newElements) as Map<
    ExcalidrawElement["id"],
    ExcalidrawElement
  >;
  oldElements.forEach((element) => {
    const newElementId = oldIdToDuplicatedId.get(element.id) as string;
    const boundTextElementId = getBoundTextElementId(element);

    if (boundTextElementId) {
      const newTextElementId = oldIdToDuplicatedId.get(boundTextElementId);
      if (newTextElementId) {
        const newContainer = newElementsMap.get(newElementId);
        if (newContainer) {
          mutateElement(newContainer, {
            boundElements: (element.boundElements || [])
              .filter(
                (boundElement) =>
                  boundElement.id !== newTextElementId &&
                  boundElement.id !== boundTextElementId,
              )
              .concat({
                type: "text",
                id: newTextElementId,
              }),
          });
        }
        const newTextElement = newElementsMap.get(newTextElementId);
        if (newTextElement && isTextElement(newTextElement)) {
          mutateElement(newTextElement, {
            containerId: newContainer ? newElementId : null,
          });
        }
      }
    }
  });
};

export const handleBindTextResize = (
  container: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
  transformHandleType: MaybeTransformHandleType,
  shouldMaintainAspectRatio = false,
) => {
  const boundTextElementId = getBoundTextElementId(container);
  if (!boundTextElementId) {
    return;
  }
  resetOriginalContainerCache(container.id);
  const textElement = getBoundTextElement(container, elementsMap);
  if (textElement && textElement.text) {
    if (!container) {
      return;
    }

    let text = textElement.text;
    let nextHeight = textElement.height;
    let nextWidth = textElement.width;
    const maxWidth = getBoundTextMaxWidth(container, textElement);
    const maxHeight = getBoundTextMaxHeight(container, textElement);
    let containerHeight = container.height;
    if (
      shouldMaintainAspectRatio ||
      (transformHandleType !== "n" && transformHandleType !== "s")
    ) {
      if (text) {
        text = wrapText(
          textElement.originalText,
          getFontString(textElement),
          maxWidth,
        );
      }
      const metrics = measureText(
        text,
        getFontString(textElement),
        textElement.lineHeight,
      );
      nextHeight = metrics.height;
      nextWidth = metrics.width;
    }
    // increase height in case text element height exceeds
    if (nextHeight > maxHeight) {
      containerHeight = computeContainerDimensionForBoundText(
        nextHeight,
        container.type,
      );

      const diff = containerHeight - container.height;
      // fix the y coord when resizing from ne/nw/n
      const updatedY =
        !isArrowElement(container) &&
        (transformHandleType === "ne" ||
          transformHandleType === "nw" ||
          transformHandleType === "n")
          ? container.y - diff
          : container.y;
      mutateElement(container, {
        height: containerHeight,
        y: updatedY,
      });
    }

    mutateElement(textElement, {
      text,
      width: nextWidth,
      height: nextHeight,
    });

    if (!isArrowElement(container)) {
      mutateElement(
        textElement,
        computeBoundTextPosition(container, textElement, elementsMap),
      );
    }
  }
};

export const computeBoundTextPosition = (
  container: ExcalidrawElement,
  boundTextElement: ExcalidrawTextElementWithContainer,
  elementsMap: ElementsMap,
) => {
  if (isArrowElement(container)) {
    return LinearElementEditor.getBoundTextElementPosition(
      container,
      boundTextElement,
      elementsMap,
    );
  }
  const containerCoords = getContainerCoords(container);
  const maxContainerHeight = getBoundTextMaxHeight(container, boundTextElement);
  const maxContainerWidth = getBoundTextMaxWidth(container, boundTextElement);

  let x;
  let y;
  if (boundTextElement.verticalAlign === VERTICAL_ALIGN.TOP) {
    y = containerCoords.y;
  } else if (boundTextElement.verticalAlign === VERTICAL_ALIGN.BOTTOM) {
    y = containerCoords.y + (maxContainerHeight - boundTextElement.height);
  } else {
    y =
      containerCoords.y +
      (maxContainerHeight / 2 - boundTextElement.height / 2);
  }
  if (boundTextElement.textAlign === TEXT_ALIGN.LEFT) {
    x = containerCoords.x;
  } else if (boundTextElement.textAlign === TEXT_ALIGN.RIGHT) {
    x = containerCoords.x + (maxContainerWidth - boundTextElement.width);
  } else {
    x =
      containerCoords.x + (maxContainerWidth / 2 - boundTextElement.width / 2);
  }
  return { x, y };
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

/**
 * Calculates vertical offset for a text with alphabetic baseline.
 */
export const getVerticalOffset = (
  fontFamily: ExcalidrawTextElement["fontFamily"],
  fontSize: ExcalidrawTextElement["fontSize"],
  lineHeightPx: number,
) => {
  const { unitsPerEm, ascender, descender } =
    FONT_METRICS[fontFamily] || FONT_METRICS[FONT_FAMILY.Helvetica];

  const fontSizeEm = fontSize / unitsPerEm;
  const lineGap = lineHeightPx - fontSizeEm * ascender + fontSizeEm * descender;

  const verticalOffset = fontSizeEm * ascender + lineGap;
  return verticalOffset;
};

// FIXME rename to getApproxMinContainerHeight
export const getApproxMinLineHeight = (
  fontSize: ExcalidrawTextElement["fontSize"],
  lineHeight: ExcalidrawTextElement["lineHeight"],
) => {
  return getLineHeightInPx(fontSize, lineHeight) + BOUND_TEXT_PADDING * 2;
};

let canvas: HTMLCanvasElement | undefined;

const getLineWidth = (text: string, font: FontString) => {
  if (!canvas) {
    canvas = document.createElement("canvas");
  }
  const canvas2dContext = canvas.getContext("2d")!;
  canvas2dContext.font = font;
  const width = canvas2dContext.measureText(text).width;

  // since in test env the canvas measureText algo
  // doesn't measure text and instead just returns number of
  // characters hence we assume that each letteris 10px
  if (isTestEnv()) {
    return width * 10;
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

export const parseTokens = (text: string) => {
  // Splitting words containing "-" as those are treated as separate words
  // by css wrapping algorithm eg non-profit => non-, profit
  const words = text.split("-");
  if (words.length > 1) {
    // non-proft org => ['non-', 'profit org']
    words.forEach((word, index) => {
      if (index !== words.length - 1) {
        words[index] = word += "-";
      }
    });
  }
  // Joining the words with space and splitting them again with space to get the
  // final list of tokens
  // ['non-', 'profit org'] =>,'non- proft org' => ['non-','profit','org']
  return words.join(" ").split(" ");
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

    // Push the line if its <= maxWidth
    if (currentLineWidth <= maxWidth) {
      lines.push(originalLine);
      return; // continue
    }

    const words = parseTokens(originalLine);
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
          // space needs to be appended before next word
          // as currentLine contains chars which couldn't be appended
          // to previous line unless the line ends with hyphen to sync
          // with css word-wrap
        } else if (!currentLine.endsWith("-")) {
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

          // if word ends with "-" then we don't need to add space
          // to sync with css word-wrap
          const shouldAppendSpace = !word.endsWith("-");
          currentLine += word;

          if (shouldAppendSpace) {
            currentLine += " ";
          }

          // Push the word if appending space exceeds max width
          if (currentLineWidthTillNow + spaceWidth >= maxWidth) {
            if (shouldAppendSpace) {
              lines.push(currentLine.slice(0, -1));
            } else {
              lines.push(currentLine);
            }
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

const DUMMY_TEXT = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toLocaleUpperCase();

// FIXME rename to getApproxMinContainerWidth
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

export const getBoundTextElementId = (container: ExcalidrawElement | null) => {
  return container?.boundElements?.length
    ? container?.boundElements?.filter((ele) => ele.type === "text")[0]?.id ||
        null
    : null;
};

export const getBoundTextElement = (
  element: ExcalidrawElement | null,
  elementsMap: ElementsMap,
) => {
  if (!element) {
    return null;
  }
  const boundTextElementId = getBoundTextElementId(element);

  if (boundTextElementId) {
    return (elementsMap.get(boundTextElementId) ||
      null) as ExcalidrawTextElementWithContainer | null;
  }
  return null;
};

export const getContainerElement = (
  element: ExcalidrawTextElement | null,
  elementsMap: ElementsMap,
): ExcalidrawTextContainer | null => {
  if (!element) {
    return null;
  }
  if (element.containerId) {
    return (elementsMap.get(element.containerId) ||
      null) as ExcalidrawTextContainer | null;
  }
  return null;
};

export const getContainerCenter = (
  container: ExcalidrawElement,
  appState: AppState,
  elementsMap: ElementsMap,
) => {
  if (!isArrowElement(container)) {
    return {
      x: container.x + container.width / 2,
      y: container.y + container.height / 2,
    };
  }
  const points = LinearElementEditor.getPointsGlobalCoordinates(
    container,
    elementsMap,
  );
  if (points.length % 2 === 1) {
    const index = Math.floor(container.points.length / 2);
    const midPoint = LinearElementEditor.getPointGlobalCoordinates(
      container,
      container.points[index],
      elementsMap,
    );
    return { x: midPoint[0], y: midPoint[1] };
  }
  const index = container.points.length / 2 - 1;
  let midSegmentMidpoint = LinearElementEditor.getEditorMidPoints(
    container,
    elementsMap,
    appState,
  )[index];
  if (!midSegmentMidpoint) {
    midSegmentMidpoint = LinearElementEditor.getSegmentMidPoint(
      container,
      points[index],
      points[index + 1],
      index + 1,
      elementsMap,
    );
  }
  return { x: midSegmentMidpoint[0], y: midSegmentMidpoint[1] };
};

export const getContainerCoords = (container: NonDeletedExcalidrawElement) => {
  let offsetX = BOUND_TEXT_PADDING;
  let offsetY = BOUND_TEXT_PADDING;

  if (container.type === "ellipse") {
    // The derivation of coordinates is explained in https://github.com/excalidraw/excalidraw/pull/6172
    offsetX += (container.width / 2) * (1 - Math.sqrt(2) / 2);
    offsetY += (container.height / 2) * (1 - Math.sqrt(2) / 2);
  }
  // The derivation of coordinates is explained in https://github.com/excalidraw/excalidraw/pull/6265
  if (container.type === "diamond") {
    offsetX += container.width / 4;
    offsetY += container.height / 4;
  }
  return {
    x: container.x + offsetX,
    y: container.y + offsetY,
  };
};

export const getTextElementAngle = (
  textElement: ExcalidrawTextElement,
  container: ExcalidrawTextContainer | null,
) => {
  if (!container || isArrowElement(container)) {
    return textElement.angle;
  }
  return container.angle;
};

export const getBoundTextElementPosition = (
  container: ExcalidrawElement,
  boundTextElement: ExcalidrawTextElementWithContainer,
  elementsMap: ElementsMap,
) => {
  if (isArrowElement(container)) {
    return LinearElementEditor.getBoundTextElementPosition(
      container,
      boundTextElement,
      elementsMap,
    );
  }
};

export const shouldAllowVerticalAlign = (
  selectedElements: NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
) => {
  return selectedElements.some((element) => {
    if (isBoundToContainer(element)) {
      const container = getContainerElement(element, elementsMap);
      if (isArrowElement(container)) {
        return false;
      }
      return true;
    }
    return false;
  });
};

export const suppportsHorizontalAlign = (
  selectedElements: NonDeletedExcalidrawElement[],
  elementsMap: ElementsMap,
) => {
  return selectedElements.some((element) => {
    if (isBoundToContainer(element)) {
      const container = getContainerElement(element, elementsMap);
      if (isArrowElement(container)) {
        return false;
      }
      return true;
    }

    return isTextElement(element);
  });
};

const VALID_CONTAINER_TYPES = new Set([
  "rectangle",
  "ellipse",
  "diamond",
  "arrow",
]);

export const isValidTextContainer = (element: {
  type: ExcalidrawElementType;
}) => VALID_CONTAINER_TYPES.has(element.type);

export const computeContainerDimensionForBoundText = (
  dimension: number,
  containerType: ExtractSetType<typeof VALID_CONTAINER_TYPES>,
) => {
  dimension = Math.ceil(dimension);
  const padding = BOUND_TEXT_PADDING * 2;

  if (containerType === "ellipse") {
    return Math.round(((dimension + padding) / Math.sqrt(2)) * 2);
  }
  if (containerType === "arrow") {
    return dimension + padding * 8;
  }
  if (containerType === "diamond") {
    return 2 * (dimension + padding);
  }
  return dimension + padding;
};

export const getBoundTextMaxWidth = (
  container: ExcalidrawElement,
  boundTextElement: ExcalidrawTextElement | null,
) => {
  const { width } = container;
  if (isArrowElement(container)) {
    const minWidth =
      (boundTextElement?.fontSize ?? DEFAULT_FONT_SIZE) *
      ARROW_LABEL_FONT_SIZE_TO_MIN_WIDTH_RATIO;
    return Math.max(ARROW_LABEL_WIDTH_FRACTION * width, minWidth);
  }
  if (container.type === "ellipse") {
    // The width of the largest rectangle inscribed inside an ellipse is
    // Math.round((ellipse.width / 2) * Math.sqrt(2)) which is derived from
    // equation of an ellipse -https://github.com/excalidraw/excalidraw/pull/6172
    return Math.round((width / 2) * Math.sqrt(2)) - BOUND_TEXT_PADDING * 2;
  }
  if (container.type === "diamond") {
    // The width of the largest rectangle inscribed inside a rhombus is
    // Math.round(width / 2) - https://github.com/excalidraw/excalidraw/pull/6265
    return Math.round(width / 2) - BOUND_TEXT_PADDING * 2;
  }
  return width - BOUND_TEXT_PADDING * 2;
};

export const getBoundTextMaxHeight = (
  container: ExcalidrawElement,
  boundTextElement: ExcalidrawTextElementWithContainer,
) => {
  const { height } = container;
  if (isArrowElement(container)) {
    const containerHeight = height - BOUND_TEXT_PADDING * 8 * 2;
    if (containerHeight <= 0) {
      return boundTextElement.height;
    }
    return height;
  }
  if (container.type === "ellipse") {
    // The height of the largest rectangle inscribed inside an ellipse is
    // Math.round((ellipse.height / 2) * Math.sqrt(2)) which is derived from
    // equation of an ellipse - https://github.com/excalidraw/excalidraw/pull/6172
    return Math.round((height / 2) * Math.sqrt(2)) - BOUND_TEXT_PADDING * 2;
  }
  if (container.type === "diamond") {
    // The height of the largest rectangle inscribed inside a rhombus is
    // Math.round(height / 2) - https://github.com/excalidraw/excalidraw/pull/6265
    return Math.round(height / 2) - BOUND_TEXT_PADDING * 2;
  }
  return height - BOUND_TEXT_PADDING * 2;
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
  // ~1.15 is the average for Helvetica in WebKit and Blink.
  [FONT_FAMILY.Helvetica]: 1.15 as ExcalidrawTextElement["lineHeight"],
  // ~1.2 is the average for Cascadia in WebKit and Blink, and kinda Gecko too
  [FONT_FAMILY.Cascadia]: 1.2 as ExcalidrawTextElement["lineHeight"],
};

/** OS/2 sTypoAscender, https://learn.microsoft.com/en-us/typography/opentype/spec/os2#stypoascender */
type sTypoAscender = number & MakeBrand<"sTypoAscender">;

/** OS/2 sTypoDescender, https://learn.microsoft.com/en-us/typography/opentype/spec/os2#stypodescender */
type sTypoDescender = number & MakeBrand<"sTypoDescender">;

/** head.unitsPerEm, usually either 1000 or 2048 */
type unitsPerEm = number & MakeBrand<"unitsPerEm">;

/**
 * Hardcoded metrics for default fonts, read by https://opentype.js.org/font-inspector.html.
 * For custom fonts, read these metrics from OS/2 table and extend this object.
 *
 * WARN: opentype does NOT open WOFF2 correctly, make sure to convert WOFF2 to TTF first.
 */
export const FONT_METRICS: Record<
  number,
  {
    unitsPerEm: number;
    ascender: sTypoAscender;
    descender: sTypoDescender;
  }
> = {
  [FONT_FAMILY.Virgil]: {
    unitsPerEm: 1000 as unitsPerEm,
    ascender: 886 as sTypoAscender,
    descender: -374 as sTypoDescender,
  },
  [FONT_FAMILY.Helvetica]: {
    unitsPerEm: 2048 as unitsPerEm,
    ascender: 1577 as sTypoAscender,
    descender: -471 as sTypoDescender,
  },
  [FONT_FAMILY.Cascadia]: {
    unitsPerEm: 2048 as unitsPerEm,
    ascender: 1977 as sTypoAscender,
    descender: -480 as sTypoDescender,
  },
  [FONT_FAMILY.Assistant]: {
    unitsPerEm: 1000 as unitsPerEm,
    ascender: 1021 as sTypoAscender,
    descender: -287 as sTypoDescender,
  },
};

export const getDefaultLineHeight = (fontFamily: FontFamilyValues) => {
  if (fontFamily in DEFAULT_LINE_HEIGHT) {
    return DEFAULT_LINE_HEIGHT[fontFamily];
  }
  return DEFAULT_LINE_HEIGHT[DEFAULT_FONT_FAMILY];
};
