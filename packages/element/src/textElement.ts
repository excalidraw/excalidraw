import {
  ARROW_LABEL_FONT_SIZE_TO_MIN_WIDTH_RATIO,
  ARROW_LABEL_WIDTH_FRACTION,
  BOUND_TEXT_PADDING,
  DEFAULT_FONT_SIZE,
  TEXT_ALIGN,
  VERTICAL_ALIGN,
  getFontString,
} from "@excalidraw/common";

import type { AppState } from "@excalidraw/excalidraw/types";

import type { ExtractSetType } from "@excalidraw/common/utility-types";

import {
  resetOriginalContainerCache,
  updateOriginalContainerCache,
} from "./containerCache";
import { LinearElementEditor } from "./linearElementEditor";
import { mutateElement } from "./mutateElement";
import { measureText } from "./textMeasurements";
import { wrapText } from "./textWrapping";
import {
  isBoundToContainer,
  isArrowElement,
  isTextElement,
} from "./typeChecks";

import type { MaybeTransformHandleType } from "./transformHandles";
import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawElementType,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
  NonDeletedExcalidrawElement,
} from "./types";

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
