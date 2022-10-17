import { getFontString, arrayToMap, isTestEnv } from "../utils";
import {
  ExcalidrawElement,
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
import { isLinearElement } from "./typeChecks";
import { LinearElementEditor } from "./linearElementEditor";
import { AppState } from "../types";

export const redrawTextBoundingBox = (
  textElement: ExcalidrawTextElement,
  container: ExcalidrawElement | null,
) => {
  let maxWidth = undefined;
  let text = textElement.text;

  if (container) {
    maxWidth = getMaxContainerWidth(container);
    text = wrapText(
      textElement.originalText,
      getFontString(textElement),
      getMaxContainerWidth(container),
    );
  }
  const metrics = measureText(
    textElement.originalText,
    getFontString(textElement),
    maxWidth,
  );
  let coordY = textElement.y;
  let coordX = textElement.x;
  // Resize container and vertically center align the text
  if (container) {
    if (!isLinearElement(container)) {
      const containerDims = getContainerDims(container);
      let nextHeight = containerDims.height;
      if (textElement.verticalAlign === VERTICAL_ALIGN.TOP) {
        coordY = container.y + BOUND_TEXT_PADDING;
      } else if (textElement.verticalAlign === VERTICAL_ALIGN.BOTTOM) {
        coordY =
          container.y +
          containerDims.height -
          metrics.height -
          BOUND_TEXT_PADDING;
      } else {
        coordY = container.y + containerDims.height / 2 - metrics.height / 2;
        if (metrics.height > getMaxContainerHeight(container)) {
          nextHeight = metrics.height + BOUND_TEXT_PADDING * 2;
          coordY = container.y + nextHeight / 2 - metrics.height / 2;
        }
      }
      if (textElement.textAlign === TEXT_ALIGN.LEFT) {
        coordX = container.x + BOUND_TEXT_PADDING;
      } else if (textElement.textAlign === TEXT_ALIGN.RIGHT) {
        coordX =
          container.x +
          containerDims.width -
          metrics.width -
          BOUND_TEXT_PADDING;
      } else {
        coordX = container.x + containerDims.width / 2 - metrics.width / 2;
      }

      mutateElement(container, { height: nextHeight });
    } else {
      const centerX = textElement.x + textElement.width / 2;
      const centerY = textElement.y + textElement.height / 2;
      const diffWidth = metrics.width - textElement.width;
      const diffHeight = metrics.height - textElement.height;
      coordY = centerY - (textElement.height + diffHeight) / 2;
      coordX = centerX - (textElement.width + diffWidth) / 2;
    }
  }
  mutateElement(textElement, {
    width: metrics.width,
    height: metrics.height,
    baseline: metrics.baseline,
    y: coordY,
    x: coordX,
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
      const newTextElementId = oldIdToDuplicatedId.get(boundTextElementId);
      if (newTextElementId) {
        const newContainer = sceneElementMap.get(newElementId);
        if (newContainer) {
          mutateElement(newContainer, {
            boundElements: element.boundElements?.concat({
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
    let containerHeight = containerDims.height;
    let nextBaseLine = textElement.baseline;
    if (transformHandleType !== "n" && transformHandleType !== "s") {
      if (text) {
        text = wrapText(
          textElement.originalText,
          getFontString(textElement),
          getMaxContainerWidth(container),
        );
      }
      const dimensions = measureText(
        text,
        getFontString(textElement),
        containerDims.width,
      );
      nextHeight = dimensions.height;
      nextWidth = dimensions.width;
      nextBaseLine = dimensions.baseline;
    }
    // increase height in case text element height exceeds
    if (nextHeight > containerDims.height - BOUND_TEXT_PADDING * 2) {
      containerHeight = nextHeight + BOUND_TEXT_PADDING * 2;
      const diff = containerHeight - containerDims.height;
      // fix the y coord when resizing from ne/nw/n
      const updatedY =
        transformHandleType === "ne" ||
        transformHandleType === "nw" ||
        transformHandleType === "n"
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
    updateBoundTextPosition(
      container,
      textElement as ExcalidrawTextElementWithContainer,
    );
  }
};

const updateBoundTextPosition = (
  container: ExcalidrawElement,
  boundTextElement: ExcalidrawTextElementWithContainer,
) => {
  if (isLinearElement(container)) {
    LinearElementEditor.updateBoundTextPosition(
      container,
      boundTextElement,
      "update",
    );
    return;
  }
  const containerDims = getContainerDims(container);
  let y;
  if (boundTextElement.verticalAlign === VERTICAL_ALIGN.TOP) {
    y = container.y + BOUND_TEXT_PADDING;
  } else if (boundTextElement.verticalAlign === VERTICAL_ALIGN.BOTTOM) {
    y =
      container.y +
      containerDims.height -
      boundTextElement.height -
      BOUND_TEXT_PADDING;
  } else {
    y = container.y + containerDims.height / 2 - boundTextElement.height / 2;
  }
  const x =
    boundTextElement.textAlign === TEXT_ALIGN.LEFT
      ? container.x + BOUND_TEXT_PADDING
      : boundTextElement.textAlign === TEXT_ALIGN.RIGHT
      ? container.x +
        containerDims.width -
        boundTextElement.width -
        BOUND_TEXT_PADDING
      : container.x + containerDims.width / 2 - boundTextElement.width / 2;

  mutateElement(boundTextElement, { x, y });
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
  // Since span adds 1px extra width to the container
  const width = container.offsetWidth + 1;

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

export const wrapText = (text: string, font: FontString, maxWidth: number) => {
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

export const getContainerDims = (element: ExcalidrawElement) => {
  if (isLinearElement(element)) {
    const width = Math.max(element.width, element.height);
    const height = Math.min(element.width, element.height);
    return { width, height };
  }
  return { width: element.width, height: element.height };
};

export const getContainerCenter = (
  container: ExcalidrawElement,
  appState: AppState,
) => {
  if (!isLinearElement(container)) {
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

export const getTextElementAngle = (textElement: ExcalidrawTextElement) => {
  const container = getContainerElement(textElement);
  if (!container || isLinearElement(container)) {
    return textElement.angle;
  }
  return container.angle;
};
