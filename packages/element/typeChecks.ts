import { ROUNDNESS } from "../constants";
import { assertNever } from "../utils";

import type { ElementOrToolType } from "../types";
import type { MarkNonNullable } from "../utility-types";
import type { Bounds } from "./bounds";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawEmbeddableElement,
  ExcalidrawLinearElement,
  ExcalidrawBindableElement,
  ExcalidrawFreeDrawElement,
  InitializedExcalidrawImageElement,
  ExcalidrawImageElement,
  ExcalidrawTextElementWithContainer,
  ExcalidrawTextContainer,
  ExcalidrawFrameElement,
  RoundnessType,
  ExcalidrawFrameLikeElement,
  ExcalidrawElementType,
  ExcalidrawIframeElement,
  ExcalidrawIframeLikeElement,
  ExcalidrawMagicFrameElement,
  ExcalidrawArrowElement,
  ExcalidrawElbowArrowElement,
  PointBinding,
  FixedPointBinding,
  ExcalidrawFlowchartNodeElement,
} from "./types";

export const isInitializedImageElement = (
  element: ExcalidrawElement | null,
): element is InitializedExcalidrawImageElement => {
  return !!element && element.type === "image" && !!element.fileId;
};

export const isImageElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawImageElement => {
  return !!element && element.type === "image";
};

export const isEmbeddableElement = (
  element: ExcalidrawElement | null | undefined,
): element is ExcalidrawEmbeddableElement => {
  return !!element && element.type === "embeddable";
};

export const isIframeElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawIframeElement => {
  return !!element && element.type === "iframe";
};

export const isIframeLikeElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawIframeLikeElement => {
  return (
    !!element && (element.type === "iframe" || element.type === "embeddable")
  );
};

export const isTextElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawTextElement => {
  return element != null && element.type === "text";
};

export const isFrameElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawFrameElement => {
  return element != null && element.type === "frame";
};

export const isMagicFrameElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawMagicFrameElement => {
  return element != null && element.type === "magicframe";
};

export const isFrameLikeElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawFrameLikeElement => {
  return (
    element != null &&
    (element.type === "frame" || element.type === "magicframe")
  );
};

export const isFreeDrawElement = (
  element?: ExcalidrawElement | null,
): element is ExcalidrawFreeDrawElement => {
  return element != null && isFreeDrawElementType(element.type);
};

export const isFreeDrawElementType = (
  elementType: ExcalidrawElementType,
): boolean => {
  return elementType === "freedraw";
};

export const isLinearElement = (
  element?: ExcalidrawElement | null,
): element is ExcalidrawLinearElement => {
  return element != null && isLinearElementType(element.type);
};

export const isArrowElement = (
  element?: ExcalidrawElement | null,
): element is ExcalidrawArrowElement => {
  return element != null && element.type === "arrow";
};

export const isElbowArrow = (
  element?: ExcalidrawElement,
): element is ExcalidrawElbowArrowElement => {
  return isArrowElement(element) && element.elbowed;
};

export const isLinearElementType = (
  elementType: ElementOrToolType,
): boolean => {
  return (
    elementType === "arrow" || elementType === "line" // || elementType === "freedraw"
  );
};

export const isBindingElement = (
  element?: ExcalidrawElement | null,
  includeLocked = true,
): element is ExcalidrawLinearElement => {
  return (
    element != null &&
    (!element.locked || includeLocked === true) &&
    isBindingElementType(element.type)
  );
};

export const isBindingElementType = (
  elementType: ElementOrToolType,
): boolean => {
  return elementType === "arrow";
};

export const isBindableElement = (
  element: ExcalidrawElement | null | undefined,
  includeLocked = true,
): element is ExcalidrawBindableElement => {
  return (
    element != null &&
    (!element.locked || includeLocked === true) &&
    (element.type === "rectangle" ||
      element.type === "diamond" ||
      element.type === "ellipse" ||
      element.type === "image" ||
      element.type === "iframe" ||
      element.type === "embeddable" ||
      element.type === "frame" ||
      element.type === "magicframe" ||
      (element.type === "text" && !element.containerId))
  );
};

export const isRectanguloidElement = (
  element?: ExcalidrawElement | null,
): element is ExcalidrawBindableElement => {
  return (
    element != null &&
    (element.type === "rectangle" ||
      element.type === "diamond" ||
      element.type === "image" ||
      element.type === "iframe" ||
      element.type === "embeddable" ||
      element.type === "frame" ||
      element.type === "magicframe" ||
      (element.type === "text" && !element.containerId))
  );
};

// TODO: Remove this when proper distance calculation is introduced
// @see binding.ts:distanceToBindableElement()
export const isRectangularElement = (
  element?: ExcalidrawElement | null,
): element is ExcalidrawBindableElement => {
  return (
    element != null &&
    (element.type === "rectangle" ||
      element.type === "image" ||
      element.type === "text" ||
      element.type === "iframe" ||
      element.type === "embeddable" ||
      element.type === "frame" ||
      element.type === "magicframe" ||
      element.type === "freedraw")
  );
};

export const isTextBindableContainer = (
  element: ExcalidrawElement | null,
  includeLocked = true,
): element is ExcalidrawTextContainer => {
  return (
    element != null &&
    (!element.locked || includeLocked === true) &&
    (element.type === "rectangle" ||
      element.type === "diamond" ||
      element.type === "ellipse" ||
      isArrowElement(element))
  );
};

export const isExcalidrawElement = (
  element: any,
): element is ExcalidrawElement => {
  const type: ExcalidrawElementType | undefined = element?.type;
  if (!type) {
    return false;
  }
  switch (type) {
    case "text":
    case "diamond":
    case "rectangle":
    case "iframe":
    case "embeddable":
    case "ellipse":
    case "arrow":
    case "freedraw":
    case "line":
    case "frame":
    case "magicframe":
    case "image":
    case "selection": {
      return true;
    }
    default: {
      assertNever(type, null);
      return false;
    }
  }
};

export const isFlowchartNodeElement = (
  element: ExcalidrawElement,
): element is ExcalidrawFlowchartNodeElement => {
  return (
    element.type === "rectangle" ||
    element.type === "ellipse" ||
    element.type === "diamond"
  );
};

export const hasBoundTextElement = (
  element: ExcalidrawElement | null,
): element is MarkNonNullable<ExcalidrawBindableElement, "boundElements"> => {
  return (
    isTextBindableContainer(element) &&
    !!element.boundElements?.some(({ type }) => type === "text")
  );
};

export const isBoundToContainer = (
  element: ExcalidrawElement | null,
): element is ExcalidrawTextElementWithContainer => {
  return (
    element !== null &&
    "containerId" in element &&
    element.containerId !== null &&
    isTextElement(element)
  );
};

export const isUsingAdaptiveRadius = (type: string) =>
  type === "rectangle" ||
  type === "embeddable" ||
  type === "iframe" ||
  type === "image";

export const isUsingProportionalRadius = (type: string) =>
  type === "line" || type === "arrow" || type === "diamond";

export const canApplyRoundnessTypeToElement = (
  roundnessType: RoundnessType,
  element: ExcalidrawElement,
) => {
  if (
    (roundnessType === ROUNDNESS.ADAPTIVE_RADIUS ||
      // if legacy roundness, it can be applied to elements that currently
      // use adaptive radius
      roundnessType === ROUNDNESS.LEGACY) &&
    isUsingAdaptiveRadius(element.type)
  ) {
    return true;
  }
  if (
    roundnessType === ROUNDNESS.PROPORTIONAL_RADIUS &&
    isUsingProportionalRadius(element.type)
  ) {
    return true;
  }

  return false;
};

export const getDefaultRoundnessTypeForElement = (
  element: ExcalidrawElement,
) => {
  if (isUsingProportionalRadius(element.type)) {
    return {
      type: ROUNDNESS.PROPORTIONAL_RADIUS,
    };
  }

  if (isUsingAdaptiveRadius(element.type)) {
    return {
      type: ROUNDNESS.ADAPTIVE_RADIUS,
    };
  }

  return null;
};

export const isFixedPointBinding = (
  binding: PointBinding | FixedPointBinding,
): binding is FixedPointBinding => {
  return (
    Object.hasOwn(binding, "fixedPoint") &&
    (binding as FixedPointBinding).fixedPoint != null
  );
};

// TODO: Move this to @excalidraw/math
export const isBounds = (box: unknown): box is Bounds =>
  Array.isArray(box) &&
  box.length === 4 &&
  typeof box[0] === "number" &&
  typeof box[1] === "number" &&
  typeof box[2] === "number" &&
  typeof box[3] === "number";
