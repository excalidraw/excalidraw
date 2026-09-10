import {
  ARROW_LABEL_FONT_SIZE_TO_MIN_WIDTH_RATIO,
  ARROW_LABEL_WIDTH_FRACTION,
  BOUND_TEXT_PADDING,
  DEFAULT_FONT_SIZE,
  STICKY_NOTE_BODY_INSET_Y,
  STICKY_NOTE_PADDING,
  TEXT_ALIGN,
  VERTICAL_ALIGN,
  getFontString,
  isProdEnv,
  invariant,
} from "@excalidraw/common";

import { pointFrom, pointRotateRads, type Radians } from "@excalidraw/math";

import type { ExtractSetType } from "@excalidraw/common/utility-types";

import {
  resetOriginalContainerCache,
  updateOriginalContainerCache,
} from "./containerCache";
import { LinearElementEditor } from "./linearElementEditor";
import { getPositionAfterHeightChange } from "./sizeHelpers";

import { updateStickyNoteLayout } from "./stickyNote";
import { measureText } from "./textMeasurements";
import { wrapText } from "./textWrapping";
import {
  isBoundToContainer,
  isArrowElement,
  isStickyNoteElement,
  isTextElement,
} from "./typeChecks";

import { isNonDeletedElement } from ".";

import type { Scene } from "./Scene";

import type { MaybeTransformHandleType } from "./transformHandles";
import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawElementType,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
  NonDeleted,
} from "./types";

export const redrawTextBoundingBox = (
  textElement: ExcalidrawTextElement,
  container: ExcalidrawElement | null,
  scene: Scene,
) => {
  const elementsMap = scene.getNonDeletedElementsMap();

  if (container && isStickyNoteElement(container)) {
    // the sticky fit owns both halves (label + note geometry). `textElement`
    // may be an uncommitted clone (font actions clone before install), so it
    // is passed explicitly instead of looked up in the scene
    updateStickyNoteLayout(container, scene, { text: textElement });
    return;
  }

  let maxWidth = undefined;

  if (!isProdEnv()) {
    invariant(
      !container || !isArrowElement(container) || textElement.angle === 0,
      "text element angle must be 0 if bound to arrow container",
    );
  }

  const boundTextUpdates = {
    x: textElement.x,
    y: textElement.y,
    text: textElement.text,
    width: textElement.width,
    height: textElement.height,
    angle: (container
      ? isArrowElement(container)
        ? 0
        : container.angle
      : textElement.angle) as Radians,
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
      scene.mutateElement(container, { height: nextHeight });
      updateOriginalContainerCache(container.id, nextHeight);
    }

    if (metrics.width > maxContainerWidth) {
      const nextWidth = computeContainerDimensionForBoundText(
        metrics.width,
        container.type,
      );
      scene.mutateElement(container, { width: nextWidth });
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

  scene.mutateElement(textElement, boundTextUpdates);
};

export const handleBindTextResize = (
  container: ExcalidrawElement,
  scene: Scene,
  transformHandleType: MaybeTransformHandleType,
  shouldMaintainAspectRatio = false,
  shouldResizeFromCenter = false,
  flipByY = false,
) => {
  if (isStickyNoteElement(container)) {
    // resize callers pass their intents to `updateStickyNoteLayout` directly
    // and own the bound-arrow pass; this is the fallback for generic callers
    updateStickyNoteLayout(container, scene, { bindings: false });
    return;
  }
  const elementsMap = scene.getNonDeletedElementsMap();
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

      // Crossing the opposite edge swaps the anchor for text-driven growth.
      const shouldResizeFromTop =
        (transformHandleType === "n" ||
          transformHandleType === "ne" ||
          transformHandleType === "nw") !== flipByY;

      scene.mutateElement(container, {
        height: containerHeight,
        ...(!isArrowElement(container) &&
          getPositionAfterHeightChange(
            container,
            containerHeight,
            shouldResizeFromCenter
              ? "center"
              : shouldResizeFromTop
              ? "bottom"
              : "top",
          )),
      });
    }

    scene.mutateElement(textElement, {
      text,
      width: nextWidth,
      height: nextHeight,
    });

    if (!isArrowElement(container)) {
      scene.mutateElement(
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
  } else if (isStickyNoteElement(container)) {
    // a note's label body ends above the creation-date footer, but a label
    // centered in that body sits visibly high — center it in the whole
    // padded note while it stays clear of the footer, and only push it up
    // against the body's bottom once it would overlap
    const paddedHeight = container.height - STICKY_NOTE_PADDING * 2;
    y =
      containerCoords.y +
      Math.min(
        (paddedHeight - boundTextElement.height) / 2,
        maxContainerHeight - boundTextElement.height,
      );
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
  const angle = (container.angle ?? 0) as Radians;

  if (angle !== 0) {
    // A sticky's footer makes its body asymmetric. The body still rotates
    // about the note's center, rather than about its own (higher) center.
    const contentCenter = isStickyNoteElement(container)
      ? pointFrom(
          container.x + container.width / 2,
          container.y + container.height / 2,
        )
      : pointFrom(
          containerCoords.x + maxContainerWidth / 2,
          containerCoords.y + maxContainerHeight / 2,
        );
    const textCenter = pointFrom(
      x + boundTextElement.width / 2,
      y + boundTextElement.height / 2,
    );

    const [rx, ry] = pointRotateRads(textCenter, contentCenter, angle);

    return {
      x: rx - boundTextElement.width / 2,
      y: ry - boundTextElement.height / 2,
    };
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
): NonDeleted<ExcalidrawTextElementWithContainer> | null => {
  if (!element) {
    return null;
  }
  const boundTextElementId = getBoundTextElementId(element);

  if (boundTextElementId) {
    const boundTextElement = (elementsMap.get(boundTextElementId) ||
      null) as NonDeleted<ExcalidrawTextElementWithContainer> | null;

    // SAFETY: This should never happen, but log it just in case
    if (boundTextElement && !isNonDeletedElement(boundTextElement)) {
      console.error(
        "[NONDELETED][INVARIANT] Bound text element `isDeleted: true` which is not expected.",
      );
    }

    return boundTextElement;
  }
  return null;
};

export const getContainerElement = <
  T extends ExcalidrawTextElement,
  R extends ExcalidrawTextContainer,
>(
  element: T | null,
  elementsMap: ElementsMap,
): R | null => {
  if (!element) {
    return null;
  }
  if (element.containerId) {
    return (elementsMap.get(element.containerId) || null) as R | null;
  }
  return null;
};

/**
 * The point a text bound to this container centers on — and, for arrows, the
 * point the text tool snaps a new label to.
 */
export const getContainerCenter = (
  container: ExcalidrawElement,
  elementsMap: ElementsMap,
) => {
  if (!isArrowElement(container)) {
    return {
      x: container.x + container.width / 2,
      y: container.y + container.height / 2,
    };
  }

  const center = LinearElementEditor.getBoundTextElementCenter(
    container,
    elementsMap,
  );

  return { x: center[0], y: center[1] };
};

export const getContainerCoords = (container: ExcalidrawElement) => {
  const padding = isStickyNoteElement(container)
    ? STICKY_NOTE_PADDING
    : BOUND_TEXT_PADDING;
  let offsetX = padding;
  let offsetY = padding;

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
  if (isArrowElement(container)) {
    return 0;
  }
  if (!container) {
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
  selectedElements: readonly ExcalidrawElement[],
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
  selectedElements: readonly ExcalidrawElement[],
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
  "stickynote",
  "ellipse",
  "diamond",
  "arrow",
]);

export const isValidTextContainer = (element: {
  type: ExcalidrawElementType;
}): element is ExcalidrawTextContainer =>
  VALID_CONTAINER_TYPES.has(element.type);

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
  return (
    width -
    (isStickyNoteElement(container)
      ? STICKY_NOTE_PADDING
      : BOUND_TEXT_PADDING) *
      2
  );
};

export const getBoundTextMaxHeight = (
  container: ExcalidrawElement,
  boundTextElement: ExcalidrawTextElementWithContainer,
) => {
  const { height } = container;
  if (isStickyNoteElement(container)) {
    // the label body ends above the creation-date footer
    return Math.max(0, height - STICKY_NOTE_BODY_INSET_Y);
  }
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

export const DEFAULT_BOUND_TEXT_LABEL_POSITION = 0.5;
