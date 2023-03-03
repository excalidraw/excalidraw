import { getFontString, arrayToMap, isTestEnv } from "../utils";
import {
  ExcalidrawElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
  FontString,
  NonDeletedExcalidrawElement,
} from "./types";
import { mutateElement } from "./mutateElement";
import { BOUND_TEXT_PADDING, TEXT_ALIGN, VERTICAL_ALIGN } from "../constants";
import { MaybeTransformHandleType } from "./transformHandles";
import Scene from "../scene/Scene";
import { isTextElement } from ".";
import {
  isBoundToContainer,
  isImageElement,
  isArrowElement,
} from "./typeChecks";
import { LinearElementEditor } from "./linearElementEditor";
import { AppState } from "../types";
import { isTextBindableContainer } from "./typeChecks";
import { getElementAbsoluteCoords } from "../element";
import { getSelectedElements } from "../scene";
import { isHittingElementNotConsideringBoundingBox } from "./collision";
import {
  resetOriginalContainerCache,
  updateOriginalContainerCache,
} from "./textWysiwyg";

export const normalizeText = (text: string) => {
  return (
    text
      // replace tabs with spaces so they render and measure correctly
      .replace(/\t/g, "        ")
      // normalize newlines
      .replace(/\r?\n|\r/g, "\n")
  );
};

export const redrawTextBoundingBox = (
  textElement: ExcalidrawTextElement,
  container: ExcalidrawElement | null,
) => {
  let maxWidth = undefined;

  const boundTextUpdates = {
    x: textElement.x,
    y: textElement.y,
    text: textElement.text,
    width: textElement.width,
    height: textElement.height,
  };

  boundTextUpdates.text = textElement.text;

  if (container) {
    maxWidth = getMaxContainerWidth(container);
    boundTextUpdates.text = wrapText(
      textElement.originalText,
      getFontString(textElement),
      maxWidth,
    );
  }
  const metrics = measureText(
    boundTextUpdates.text,
    getFontString(textElement),
  );

  boundTextUpdates.width = metrics.width;
  boundTextUpdates.height = metrics.height;

  if (container) {
    if (isArrowElement(container)) {
      const centerX = textElement.x + textElement.width / 2;
      const centerY = textElement.y + textElement.height / 2;
      const diffWidth = metrics.width - textElement.width;
      const diffHeight = metrics.height - textElement.height;
      boundTextUpdates.x = centerY - (textElement.height + diffHeight) / 2;
      boundTextUpdates.y = centerX - (textElement.width + diffWidth) / 2;
    } else {
      const containerDims = getContainerDims(container);
      let maxContainerHeight = getMaxContainerHeight(container);

      let nextHeight = containerDims.height;
      if (metrics.height > maxContainerHeight) {
        nextHeight = computeContainerHeightForBoundText(
          container,
          metrics.height,
        );
        mutateElement(container, { height: nextHeight });
        maxContainerHeight = getMaxContainerHeight(container);
        updateOriginalContainerCache(container.id, nextHeight);
      }
      const updatedTextElement = {
        ...textElement,
        ...boundTextUpdates,
      } as ExcalidrawTextElementWithContainer;
      const { x, y } = computeBoundTextPosition(container, updatedTextElement);
      boundTextUpdates.x = x;
      boundTextUpdates.y = y;
    }
  }

  mutateElement(textElement, boundTextUpdates);
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
      const newTextElementId = oldIdToDuplicatedId.get(boundTextElementId);
      if (newTextElementId) {
        const newContainer = sceneElementMap.get(newElementId);
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
        const newTextElement = sceneElementMap.get(newTextElementId);
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
  transformHandleType: MaybeTransformHandleType,
) => {
  const boundTextElementId = getBoundTextElementId(container);
  if (!boundTextElementId) {
    return;
  }
  resetOriginalContainerCache(container.id);
  let textElement = Scene.getScene(container)!.getElement(
    boundTextElementId,
  ) as ExcalidrawTextElement;
  if (textElement && textElement.text) {
    if (!container) {
      return;
    }

    textElement = Scene.getScene(container)!.getElement(
      boundTextElementId,
    ) as ExcalidrawTextElement;
    let text = textElement.text;
    let nextHeight = textElement.height;
    let nextWidth = textElement.width;
    const containerDims = getContainerDims(container);
    const maxWidth = getMaxContainerWidth(container);
    const maxHeight = getMaxContainerHeight(container);
    let containerHeight = containerDims.height;
    if (transformHandleType !== "n" && transformHandleType !== "s") {
      if (text) {
        text = wrapText(
          textElement.originalText,
          getFontString(textElement),
          maxWidth,
        );
      }
      const dimensions = measureText(text, getFontString(textElement));
      nextHeight = dimensions.height;
      nextWidth = dimensions.width;
    }
    // increase height in case text element height exceeds
    if (nextHeight > maxHeight) {
      containerHeight = computeContainerHeightForBoundText(
        container,
        nextHeight,
      );

      const diff = containerHeight - containerDims.height;
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
        computeBoundTextPosition(
          container,
          textElement as ExcalidrawTextElementWithContainer,
        ),
      );
    }
  }
};

const computeBoundTextPosition = (
  container: ExcalidrawElement,
  boundTextElement: ExcalidrawTextElementWithContainer,
) => {
  const containerCoords = getContainerCoords(container);
  const maxContainerHeight = getMaxContainerHeight(container);
  const maxContainerWidth = getMaxContainerWidth(container);

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

// https://github.com/grassator/canvas-text-editor/blob/master/lib/FontMetrics.js

export const measureText = (text: string, font: FontString) => {
  text = text
    .split("\n")
    // replace empty lines with single space because leading/trailing empty
    // lines would be stripped from computation
    .map((x) => x || " ")
    .join("\n");

  const height = getTextHeight(text, font);
  const width = getTextWidth(text, font);

  return { width, height };
};

const DUMMY_TEXT = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toLocaleUpperCase();
const cacheApproxLineHeight: { [key: FontString]: number } = {};

export const getApproxLineHeight = (font: FontString) => {
  if (cacheApproxLineHeight[font]) {
    return cacheApproxLineHeight[font];
  }
  const fontSize = parseInt(font);

  // Calculate line height relative to font size
  cacheApproxLineHeight[font] = fontSize * 1.2;
  return cacheApproxLineHeight[font];
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
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let width = 0;
  lines.forEach((line) => {
    width = Math.max(width, getLineWidth(line, font));
  });
  return width;
};

export const getTextHeight = (text: string, font: FontString) => {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const lineHeight = getApproxLineHeight(font);
  return lineHeight * lines.length;
};

export const wrapText = (text: string, font: FontString, maxWidth: number) => {
  return text
    .split("\n")
    .reduce((array: Array<string>, line: string) => {
      if (getLineWidth(line, font) <= maxWidth) {
        array.push(line);
      } else {
        array.push(...breakLine(line, font, maxWidth));
      }
      return array;
    }, [])
    .join("\n");
};

const splitLineInWords = (line: string): Array<string> => {
  return line.match(/\S+ *| +/g)!;
};

const breakLine = (line: string, font: FontString, maxWidth: number) => {
  const words = splitLineInWords(line).reduce(
    // flatMap is so slow
    (array: Array<string>, word: string) => {
      if (
        getLineWidth(word.trim(), font) <= maxWidth ||
        Array.from(word.trim()).length === 1
      ) {
        array.push(word);
      } else {
        array.push(...breakWord(word, font, maxWidth));
      }
      return array;
    },
    [],
  );
  const lines: Array<string> = [];
  let lastLineWidth = 0;
  const spaceWidth = getLineWidth(" ", font);
  // create lines
  words.forEach((word) => {
    const wordWithoutTrailingSpaces = word.trimEnd();
    const wordWidthWithoutTrailingSpaces = getLineWidth(
      wordWithoutTrailingSpaces,
      font,
    );
    const wordWidth =
      wordWidthWithoutTrailingSpaces +
      (word.length - wordWithoutTrailingSpaces.length) * spaceWidth;
    // fits in previous line
    if (
      lines.length > 0 &&
      lastLineWidth + wordWidthWithoutTrailingSpaces <= maxWidth
    ) {
      lastLineWidth += wordWidth;
      lines[lines.length - 1] += word;

      return; // next word
    }

    if (lastLineWidth > maxWidth) {
      // if the method that draw the text is refactored, this code must be removed
      // remove trailing spaces
      const spacesToRemove = Math.ceil((lastLineWidth - maxWidth) / spaceWidth);
      lines[lines.length - 1] = lines[lines.length - 1].slice(
        0,
        -spacesToRemove,
      );
    }
    // remove previous line if only has spaces
    if (lines.length > 0 && lines[lines.length - 1].trim().length === 0) {
      // if the method that draw the text is refactored, this code must be removed
      lines.splice(-1);
    }

    lastLineWidth = wordWidth;
    lines.push(word);
  });
  return lines;
};

const breakWord = (word: string, font: FontString, maxWidth: number) => {
  const trimmedWord = word.trimEnd();
  const symbols = Array.from(trimmedWord);
  const wordSections: Array<string> = [];
  symbols.forEach((symbol) => {
    if (wordSections.length === 0) {
      wordSections.push(symbol);
      return;
    }
    const widthWithLastLine = getLineWidth(
      wordSections[wordSections.length - 1] + symbol.trimEnd(),
      font,
    );

    // fits in wordSection above
    if (
      widthWithLastLine <= maxWidth ||
      widthWithLastLine <=
        getLineWidth(wordSections[wordSections.length - 1], font)
    ) {
      wordSections[wordSections.length - 1] += symbol;
      return; // next word
    }
    wordSections.push(symbol);
  });
  wordSections[wordSections.length - 1] += " ".repeat(
    word.length - trimmedWord.length,
  );
  return wordSections;
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
    | (ExcalidrawElement & {
        containerId: ExcalidrawElement["id"] | null;
      })
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

export const getContainerDims = (element: ExcalidrawElement) => {
  const MIN_WIDTH = 300;
  if (isArrowElement(element)) {
    const width = Math.max(element.width, MIN_WIDTH);
    const height = element.height;
    return { width, height };
  }
  return { width: element.width, height: element.height };
};

export const getContainerCenter = (
  container: ExcalidrawElement,
  appState: AppState,
) => {
  if (!isArrowElement(container)) {
    return {
      x: container.x + container.width / 2,
      y: container.y + container.height / 2,
    };
  }
  const points = LinearElementEditor.getPointsGlobalCoordinates(container);
  if (points.length % 2 === 1) {
    const index = Math.floor(container.points.length / 2);
    const midPoint = LinearElementEditor.getPointGlobalCoordinates(
      container,
      container.points[index],
    );
    return { x: midPoint[0], y: midPoint[1] };
  }
  const index = container.points.length / 2 - 1;
  let midSegmentMidpoint = LinearElementEditor.getEditorMidPoints(
    container,
    appState,
  )[index];
  if (!midSegmentMidpoint) {
    midSegmentMidpoint = LinearElementEditor.getSegmentMidPoint(
      container,
      points[index],
      points[index + 1],
      index + 1,
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

export const getTextElementAngle = (textElement: ExcalidrawTextElement) => {
  const container = getContainerElement(textElement);
  if (!container || isArrowElement(container)) {
    return textElement.angle;
  }
  return container.angle;
};

export const getBoundTextElementOffset = (
  boundTextElement: ExcalidrawTextElement | null,
) => {
  const container = getContainerElement(boundTextElement);
  if (!container || !boundTextElement) {
    return 0;
  }
  if (isArrowElement(container)) {
    return BOUND_TEXT_PADDING * 8;
  }

  return BOUND_TEXT_PADDING;
};

export const getBoundTextElementPosition = (
  container: ExcalidrawElement,
  boundTextElement: ExcalidrawTextElementWithContainer,
) => {
  if (isArrowElement(container)) {
    return LinearElementEditor.getBoundTextElementPosition(
      container,
      boundTextElement,
    );
  }
};

export const shouldAllowVerticalAlign = (
  selectedElements: NonDeletedExcalidrawElement[],
) => {
  return selectedElements.some((element) => {
    const hasBoundContainer = isBoundToContainer(element);
    if (hasBoundContainer) {
      const container = getContainerElement(element);
      if (isTextElement(element) && isArrowElement(container)) {
        return false;
      }
      return true;
    }
    const boundTextElement = getBoundTextElement(element);
    if (boundTextElement) {
      if (isArrowElement(element)) {
        return false;
      }
      return true;
    }
    return false;
  });
};

export const getTextBindableContainerAtPosition = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  x: number,
  y: number,
): ExcalidrawTextContainer | null => {
  const selectedElements = getSelectedElements(elements, appState);
  if (selectedElements.length === 1) {
    return isTextBindableContainer(selectedElements[0], false)
      ? selectedElements[0]
      : null;
  }
  let hitElement = null;
  // We need to to hit testing from front (end of the array) to back (beginning of the array)
  for (let index = elements.length - 1; index >= 0; --index) {
    if (elements[index].isDeleted) {
      continue;
    }
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(elements[index]);
    if (
      isArrowElement(elements[index]) &&
      isHittingElementNotConsideringBoundingBox(elements[index], appState, [
        x,
        y,
      ])
    ) {
      hitElement = elements[index];
      break;
    } else if (x1 < x && x < x2 && y1 < y && y < y2) {
      hitElement = elements[index];
      break;
    }
  }

  return isTextBindableContainer(hitElement, false) ? hitElement : null;
};

export const isValidTextContainer = (element: ExcalidrawElement) => {
  return (
    element.type === "rectangle" ||
    element.type === "ellipse" ||
    element.type === "diamond" ||
    isImageElement(element) ||
    isArrowElement(element)
  );
};

export const computeContainerHeightForBoundText = (
  container: NonDeletedExcalidrawElement,
  boundTextElementHeight: number,
) => {
  if (container.type === "ellipse") {
    return Math.round(
      ((boundTextElementHeight + BOUND_TEXT_PADDING * 2) / Math.sqrt(2)) * 2,
    );
  }
  if (isArrowElement(container)) {
    return boundTextElementHeight + BOUND_TEXT_PADDING * 8 * 2;
  }
  if (container.type === "diamond") {
    return 2 * (boundTextElementHeight + BOUND_TEXT_PADDING * 2);
  }
  return boundTextElementHeight + BOUND_TEXT_PADDING * 2;
};

export const getMaxContainerWidth = (container: ExcalidrawElement) => {
  const width = getContainerDims(container).width;
  if (isArrowElement(container)) {
    const containerWidth = width - BOUND_TEXT_PADDING * 8 * 2;
    if (containerWidth <= 0) {
      const boundText = getBoundTextElement(container);
      if (boundText) {
        return boundText.width;
      }
      return BOUND_TEXT_PADDING * 8 * 2;
    }
    return containerWidth;
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

export const getMaxContainerHeight = (container: ExcalidrawElement) => {
  const height = getContainerDims(container).height;
  if (isArrowElement(container)) {
    const containerHeight = height - BOUND_TEXT_PADDING * 8 * 2;
    if (containerHeight <= 0) {
      const boundText = getBoundTextElement(container);
      if (boundText) {
        return boundText.height;
      }
      return BOUND_TEXT_PADDING * 8 * 2;
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
