import { getFontString, arrayToMap, isTestEnv, normalizeEOL } from "../utils";
import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawElementType,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
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
import type { ExtractSetType } from "../utility-types";

const CJK_CHAR =
  /\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}/u;

// should cover most emojis, including skin tone, gender variations, pictographic chars and etc.
const EMOJI_CHAR = /\p{Emoji_Presentation}\p{Extended_Pictographic}/u;

// matches common full width punctuation marks as some expressions are not meant to be broken down, i.e.: "た。"
const CJK_NON_BREAKING_POINTS = /。，、．：；？！/u;

// matches full width characters as parantheses are not part of the `CJK` check above, thus need to be broken individually
const CJK_LOOKAHEAD_BREAKING_POINTS = /（［｛〈《「『【〖〔〘〚〝〃ー/u;
const CJK_LOOKBEHIND_BREAKING_POINTS = /）］｝〉》」』】〗〕〙〛〞〟〃・/u;

// Hello た。
//        ↑ DON'T BREAK → ["Hello た。"]
const NON_BREAKING_POINTS = new RegExp(
  `(?![${CJK_NON_BREAKING_POINTS.source}])`,
  "u",
);

// Hello World
//      ↑ BREAK BEFORE " " → ["Hello", " World"]
// HelloたWorld
//      ↑ BREAK BEFORE "た" → ["Hello", "たWorld"]
// Hello「World」
//      ↑ BREAK BEFORE "「" → ["Hello", "「World」"]
const LOOK_AHEAD_BREAKING_POINTS = new RegExp(
  `(?=[\\s${CJK_CHAR.source}${CJK_LOOKAHEAD_BREAKING_POINTS.source}${EMOJI_CHAR.source}])`,
  "u",
);

// Hello World
//       ↑ BREAK AFTER " " → ["Hello ", "World"]
// Hello-World
//       ↑ BREAK AFTER "-" → ["Hello-", "World"]
// HelloたWorld
//       ↑ BREAK AFTER "た" → ["Helloた", "World"]
//「Hello」World
//       ↑ BREAK AFTER "」" → ["「Hello」", "World"]
const LOOK_BEHIND_BREAKING_POINTS = new RegExp(
  `(?<=[-\\s${CJK_CHAR.source}${CJK_LOOKBEHIND_BREAKING_POINTS.source}${EMOJI_CHAR.source}])`,
  "u",
);

// combines all breaking points above
const LINE_BREAKING_POINTS = new RegExp(
  `${NON_BREAKING_POINTS.source}(${LOOK_AHEAD_BREAKING_POINTS.source}|${LOOK_BEHIND_BREAKING_POINTS.source})`,
  "u",
);

/**
 * Break a line based on the whitespaces, CJK / emoji chars and language specific breaking points,
 * like hyphen for Latin and various full-width codepoints for CJK - especially Japanese, e.g.:
 *
 *  "Hello 世界。🌎🗺" → ["Hello", " ", "世", "界。", "🌎", "🗺"]
 *  "Hello-world" → ["Hello-", "world"]
 *  "「Hello World」" → ["「Hello", " ", "World」"]
 *
 * // TODO_CJK: keeps all the whitespaces => should improve wrapping => test
 *
 * Browser support as of 10/2024:
 * - 91% Lookbehind assertion https://caniuse.com/mdn-javascript_regular_expressions_lookbehind_assertion
 * - 94% Unicode character class escape https://caniuse.com/mdn-javascript_regular_expressions_unicode_character_class_escape
 */
const parseTokens = (line: string) => {
  // filtering due to multi-codepoint chars like 🗺
  return line.split(LINE_BREAKING_POINTS).filter(Boolean);
};

export const containsCJK = (text: string) => {
  return CJK_CHAR.test(text);
};

export const containsEmoji = (text: string) => {
  return EMOJI_CHAR.test(text);
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
  forceAdvanceWidth?: true,
) => {
  const _text = text
    .split("\n")
    // replace empty lines with single space because leading/trailing empty
    // lines would be stripped from computation
    .map((x) => x || " ")
    .join("\n");
  const fontSize = parseFloat(font);
  const height = getTextHeight(_text, fontSize, lineHeight);
  const width = getTextWidth(_text, font, forceAdvanceWidth);
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

// FIXME rename to getApproxMinContainerHeight
export const getApproxMinLineHeight = (
  fontSize: ExcalidrawTextElement["fontSize"],
  lineHeight: ExcalidrawTextElement["lineHeight"],
) => {
  return getLineHeightInPx(fontSize, lineHeight) + BOUND_TEXT_PADDING * 2;
};

let canvas: HTMLCanvasElement | undefined;

/**
 * @param forceAdvanceWidth use to force retrieve the "advance width" ~ `metrics.width`, instead of the actual boundind box width.
 *
 * > The advance width is the distance between the glyph's initial pen position and the next glyph's initial pen position.
 *
 * We need to use the advance width as that's the closest thing to the browser wrapping algo, hence using it for:
 * - text wrapping
 * - wysiwyg editor (+padding)
 *
 * Everything else should be based on the actual bounding box width.
 *
 * `Math.ceil` of the final width adds additional buffer which stabilizes slight wrapping incosistencies.
 */
const getLineWidth = (
  text: string,
  font: FontString,
  forceAdvanceWidth?: true,
) => {
  if (!canvas) {
    canvas = document.createElement("canvas");
  }
  const canvas2dContext = canvas.getContext("2d")!;
  canvas2dContext.font = font;
  const metrics = canvas2dContext.measureText(text);

  const advanceWidth = metrics.width;

  // retrieve the actual bounding box width if these metrics are available (as of now > 95% coverage)
  if (
    !forceAdvanceWidth &&
    window.TextMetrics &&
    "actualBoundingBoxLeft" in window.TextMetrics.prototype &&
    "actualBoundingBoxRight" in window.TextMetrics.prototype
  ) {
    // could be negative, therefore getting the absolute value
    const actualWidth =
      Math.abs(metrics.actualBoundingBoxLeft) +
      Math.abs(metrics.actualBoundingBoxRight);

    // fallback to advance width if the actual width is zero, i.e. on text editing start
    // or when actual width does not respect whitespace chars, i.e. spaces
    // otherwise actual width should always be bigger
    return Math.max(actualWidth, advanceWidth);
  }

  // since in test env the canvas measureText algo
  // doesn't measure text and instead just returns number of
  // characters hence we assume that each letteris 10px
  if (isTestEnv()) {
    return advanceWidth * 10;
  }

  return advanceWidth;
};

export const getTextWidth = (
  text: string,
  font: FontString,
  forceAdvanceWidth?: true,
) => {
  const lines = splitIntoLines(text);
  let width = 0;
  lines.forEach((line) => {
    width = Math.max(width, getLineWidth(line, font, forceAdvanceWidth));
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

const wrapWord = (
  word: string,
  font: FontString,
  maxWidth: number,
): Array<string> => {
  const lines: Array<string> = [];
  const chars = Array.from(word);

  let currentLine = "";
  let currentLineWidth = 0;

  for (const char of chars) {
    const _charWidth = charWidth.calculate(char, font);
    const testLineWidth = currentLineWidth + _charWidth;

    if (testLineWidth <= maxWidth) {
      currentLine = currentLine + char;
      currentLineWidth = testLineWidth;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = char;
    currentLineWidth = _charWidth;
  }

  // TODO_CJK: expects no whitespaces => consider adding invariant
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const wrapLine = (
  line: string,
  font: FontString,
  maxWidth: number,
): string[] => {
  const lines: Array<string> = [];
  const tokens = parseTokens(line);
  const tokenIterator = tokens[Symbol.iterator]();

  let currentLine = "";
  let iterator = tokenIterator.next();

  while (!iterator.done) {
    const token = iterator.value;
    const testLine = currentLine + token;

    // build up the current line (skip expensive `getLineWidth` for whitespaces alone)
    if (/\s/.test(token) || getLineWidth(testLine, font, true) <= maxWidth) {
      currentLine = testLine;
      iterator = tokenIterator.next();
      continue;
    }

    // TODO_CJK: we can do this simple check due to custom iteration => test
    // current line is empty => just the token (word) is longer than `maxWidth` and needs to be wrapped
    if (!currentLine) {
      const wrappedWord = wrapWord(token, font, maxWidth);
      lines.push(...wrappedWord.slice(0, -1));

      // last line of the wrapped word might still be joined with next token/s => TODO_CJK: test
      currentLine = wrappedWord[wrappedWord.length - 1] ?? "";
      iterator = tokenIterator.next();
    } else {
      lines.push(currentLine.trimEnd());
      // reset current line, but don't iterate on the next token, as we didn't use it yet!
      currentLine = "";
    }
  }

  // iterator done, push the trailing line if exists
  if (currentLine) {
    lines.push(currentLine.trimEnd());
  }

  return lines;
};

export const wrapText = (
  text: string,
  font: FontString,
  maxWidth: number,
): string => {
  // if maxWidth is not finite or NaN which can happen in case of bugs in
  // computation, we need to make sure we don't continue as we'll end up
  // in an infinite loop
  if (!Number.isFinite(maxWidth) || maxWidth < 0) {
    return text;
  }

  const lines: Array<string> = [];
  const originalLines = text.split("\n");

  for (const originalLine of originalLines) {
    const currentLineWidth = getLineWidth(originalLine, font, true);

    if (currentLineWidth <= maxWidth) {
      lines.push(originalLine);
      continue;
    }

    const wrappedLine = wrapLine(originalLine, font, maxWidth);
    lines.push(...wrappedLine);
  }

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
      const width = getLineWidth(char, font, true);
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

export const getBoundTextElementId = (container: ExcalidrawElement | null) => {
  return container?.boundElements?.length
    ? container?.boundElements?.find((ele) => ele.type === "text")?.id || null
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

export const getMinTextElementWidth = (
  font: FontString,
  lineHeight: ExcalidrawTextElement["lineHeight"],
) => {
  return measureText("", font, lineHeight).width + BOUND_TEXT_PADDING * 2;
};

/** retrieves text from text elements and concatenates to a single string */
export const getTextFromElements = (
  elements: readonly ExcalidrawElement[],
  separator = "\n\n",
) => {
  const text = elements
    .reduce((acc: string[], element) => {
      if (isTextElement(element)) {
        acc.push(element.text);
      }
      return acc;
    }, [])
    .join(separator);
  return text;
};
