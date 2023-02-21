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
import { getMaxContainerHeight, getMaxContainerWidth } from "./newElement";
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
    baseline: textElement.baseline,
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
    maxWidth,
  );

  boundTextUpdates.width = metrics.width;
  boundTextUpdates.height = metrics.height;
  boundTextUpdates.baseline = metrics.baseline;

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
    let nextBaseLine = textElement.baseline;
    if (transformHandleType !== "n" && transformHandleType !== "s") {
      if (text) {
        text = wrapText(
          textElement.originalText,
          getFontString(textElement),
          maxWidth,
        );
      }
      const dimensions = measureText(
        text,
        getFontString(textElement),
        maxWidth,
      );
      nextHeight = dimensions.height;
      nextWidth = dimensions.width;
      nextBaseLine = dimensions.baseline;
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
      baseline: nextBaseLine,
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
  const padding = container.type === "ellipse" ? 0 : BOUND_TEXT_PADDING;

  let x;
  let y;
  if (boundTextElement.verticalAlign === VERTICAL_ALIGN.TOP) {
    y = containerCoords.y + padding;
  } else if (boundTextElement.verticalAlign === VERTICAL_ALIGN.BOTTOM) {
    y =
      containerCoords.y +
      (maxContainerHeight - boundTextElement.height + padding);
  } else {
    y =
      containerCoords.y +
      (maxContainerHeight / 2 - boundTextElement.height / 2 + padding);
  }
  if (boundTextElement.textAlign === TEXT_ALIGN.LEFT) {
    x = containerCoords.x + padding;
  } else if (boundTextElement.textAlign === TEXT_ALIGN.RIGHT) {
    x =
      containerCoords.x +
      (maxContainerWidth - boundTextElement.width + padding);
  } else {
    x =
      containerCoords.x +
      (maxContainerWidth / 2 - boundTextElement.width / 2 + padding);
  }
  return { x, y };
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
    // since we are adding a span of width 1px later
    container.style.maxWidth = `${maxWidth + 1}px`;
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
  // since we are adding a span of width 1px
  const width = container.offsetWidth + 1;
  const height = container.offsetHeight;
  document.body.removeChild(container);
  if (isTestEnv()) {
    return { width, height, baseline, container };
  }
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
const getLineWidth = (text: string, font: FontString) => {
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
  // Since measureText behaves differently in different browsers
  // OS so considering a adjustment factor of 0.2
  const adjustmentFactor = 0.2;

  return metrics.width + adjustmentFactor;
};

export const getTextWidth = (text: string, font: FontString) => {
  const lines = text.split("\n");
  let width = 0;
  lines.forEach((line) => {
    width = Math.max(width, getLineWidth(line, font));
  });
  return width;
};
export const wrapText = (text: string, font: FontString, maxWidth: number) => {
  const lines: Array<string> = [];
  const originalLines = text.split("\n");
  const spaceWidth = getLineWidth(" ", font);

  const push = (str: string) => {
    if (str.trim()) {
      lines.push(str);
    }
  };
  originalLines.forEach((originalLine) => {
    const words = originalLine.split(" ");
    // This means its newline so push it
    if (words.length === 1 && words[0] === "") {
      lines.push(words[0]);
      return; // continue
    }
    let currentLine = "";
    let currentLineWidthTillNow = 0;

    let index = 0;
    while (index < words.length) {
      const currentWordWidth = getLineWidth(words[index], font);

      // Start breaking longer words exceeding max width
      if (currentWordWidth >= maxWidth) {
        // push current line since the current word exceeds the max width
        // so will be appended in next line
        push(currentLine);
        currentLine = "";
        currentLineWidthTillNow = 0;
        while (words[index].length > 0) {
          const currentChar = String.fromCodePoint(
            words[index].codePointAt(0)!,
          );
          const width = charWidth.calculate(currentChar, font);
          currentLineWidthTillNow += width;
          words[index] = words[index].slice(currentChar.length);

          if (currentLineWidthTillNow >= maxWidth) {
            // only remove last trailing space which we have added when joining words
            if (currentLine.slice(-1) === " ") {
              currentLine = currentLine.slice(0, -1);
            }
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
          currentLineWidthTillNow = getLineWidth(currentLine + word, font);

          if (currentLineWidthTillNow >= maxWidth) {
            push(currentLine);
            currentLineWidthTillNow = 0;
            currentLine = "";

            break;
          }
          index++;
          currentLine += `${word} `;

          // Push the word if appending space exceeds max width
          if (currentLineWidthTillNow + spaceWidth >= maxWidth) {
            const word = currentLine.slice(0, -1);
            push(word);
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
  if (container.type === "ellipse") {
    // The derivation of coordinates is explained in https://github.com/excalidraw/excalidraw/pull/6172
    const offsetX =
      (container.width / 2) * (1 - Math.sqrt(2) / 2) + BOUND_TEXT_PADDING;
    const offsetY =
      (container.height / 2) * (1 - Math.sqrt(2) / 2) + BOUND_TEXT_PADDING;
    return {
      x: container.x + offsetX,
      y: container.y + offsetY,
    };
  }
  return {
    x: container.x,
    y: container.y,
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
    return Math.round((boundTextElementHeight / Math.sqrt(2)) * 2);
  }
  if (isArrowElement(container)) {
    return boundTextElementHeight + BOUND_TEXT_PADDING * 8 * 2;
  }
  return boundTextElementHeight + BOUND_TEXT_PADDING * 2;
};
