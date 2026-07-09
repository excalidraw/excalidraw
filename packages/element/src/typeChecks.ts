import { ROUNDNESS, assertNever } from "@excalidraw/common";

import { pointsEqual } from "@excalidraw/math";

import type { ElementOrToolType } from "@excalidraw/excalidraw/types";

import type { MarkNonNullable } from "@excalidraw/common/utility-types";

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
  ExcalidrawLineElement,
  ExcalidrawFlowchartNodeElement,
  ExcalidrawLinearElementSubType,
} from "./types";

export const isInitializedImageElement = <T extends ExcalidrawElement>(
  element: T | null,
): element is T & InitializedExcalidrawImageElement => {
  return !!element && element.type === "image" && !!element.fileId;
};

export const isImageElement = <T extends ExcalidrawElement>(
  element: T | null,
): element is T & ExcalidrawImageElement => {
  return !!element && element.type === "image";
};

export const isEmbeddableElement = <T extends ExcalidrawElement>(
  element: T | null | undefined,
): element is T & ExcalidrawEmbeddableElement => {
  return !!element && element.type === "embeddable";
};

export const isIframeElement = <T extends ExcalidrawElement>(
  element: T | null,
): element is T & ExcalidrawIframeElement => {
  return !!element && element.type === "iframe";
};

export const isIframeLikeElement = <T extends ExcalidrawElement>(
  element: T | null,
): element is T & ExcalidrawIframeLikeElement => {
  return (
    !!element && (element.type === "iframe" || element.type === "embeddable")
  );
};

export const isTextElement = <T extends ExcalidrawElement>(
  element: T | null,
): element is T & ExcalidrawTextElement => {
  return element != null && element.type === "text";
};

export const isFrameElement = <T extends ExcalidrawElement>(
  element: T | null,
): element is T & ExcalidrawFrameElement => {
  return element != null && element.type === "frame";
};

export const isMagicFrameElement = <T extends ExcalidrawElement>(
  element: T | null,
): element is T & ExcalidrawMagicFrameElement => {
  return element != null && element.type === "magicframe";
};

export const isFrameLikeElement = <T extends ExcalidrawElement>(
  element: T | null,
): element is T & ExcalidrawFrameLikeElement => {
  return (
    element != null &&
    (element.type === "frame" || element.type === "magicframe")
  );
};

export const isFreeDrawElement = <T extends ExcalidrawElement>(
  element?: T | null,
): element is T & ExcalidrawFreeDrawElement => {
  return element != null && isFreeDrawElementType(element.type);
};

export const isFreeDrawElementType = (
  elementType: ExcalidrawElementType,
): boolean => {
  return elementType === "freedraw";
};

export const isLinearElement = <T extends ExcalidrawElement>(
  element?: T | null,
): element is T & ExcalidrawLinearElement => {
  return element != null && isLinearElementType(element.type);
};

export const isLineElement = <T extends ExcalidrawElement>(
  element?: T | null,
): element is T & ExcalidrawLineElement => {
  return element != null && element.type === "line";
};

export const isArrowElement = <T extends ExcalidrawElement>(
  element?: T | null,
): element is T & ExcalidrawArrowElement => {
  return element != null && element.type === "arrow";
};

export const isElbowArrow = <T extends ExcalidrawElement>(
  element?: T,
): element is T & ExcalidrawElbowArrowElement => {
  return isArrowElement(element) && element.elbowed;
};

/**
 * sharp or curved arrow, but not elbow
 */
export const isSimpleArrow = <T extends ExcalidrawElement>(
  element?: T,
): element is T & ExcalidrawArrowElement => {
  return isArrowElement(element) && !element.elbowed;
};

export const isSharpArrow = <T extends ExcalidrawElement>(
  element?: T,
): element is T & ExcalidrawArrowElement => {
  return isArrowElement(element) && !element.elbowed && !element.roundness;
};

export const isCurvedArrow = <T extends ExcalidrawElement>(
  element?: T,
): element is T & ExcalidrawArrowElement => {
  return (
    isArrowElement(element) && !element.elbowed && element.roundness !== null
  );
};

export const isLinearElementType = (
  elementType: ElementOrToolType,
): boolean => {
  return (
    elementType === "arrow" || elementType === "line" // || elementType === "freedraw"
  );
};

export const isBindingElement = <T extends ExcalidrawElement>(
  element?: T | null,
  includeLocked = true,
): element is T & ExcalidrawArrowElement => {
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

export const isBindableElement = <T extends ExcalidrawElement>(
  element: T | null | undefined,
  includeLocked = true,
): element is T & ExcalidrawBindableElement => {
  return (
    element != null &&
    (!element.locked || includeLocked === true) &&
    (element.type === "rectangle" ||
      element.type === "diamond" ||
      element.type === "ellipse" ||
      element.type === "cloud" ||
      element.type === "image" ||
      element.type === "iframe" ||
      element.type === "embeddable" ||
      element.type === "frame" ||
      element.type === "magicframe" ||
      (element.type === "text" && !element.containerId))
  );
};

export const isRectanguloidElement = <T extends ExcalidrawElement>(
  element?: T | null,
): element is T & ExcalidrawBindableElement => {
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
export const isRectangularElement = <T extends ExcalidrawElement>(
  element?: T | null,
): element is T & ExcalidrawBindableElement => {
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

export const isTextBindableContainer = <T extends ExcalidrawElement>(
  element: T | null,
  includeLocked = true,
): element is T & ExcalidrawTextContainer => {
  return (
    element != null &&
    (!element.locked || includeLocked === true) &&
    (element.type === "rectangle" ||
      element.type === "diamond" ||
      element.type === "ellipse" ||
      element.type === "cloud" ||
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
    case "cloud":
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

export const isFlowchartNodeElement = <T extends ExcalidrawElement>(
  element: T,
): element is T & ExcalidrawFlowchartNodeElement => {
  return (
    element.type === "rectangle" ||
    element.type === "ellipse" ||
    element.type === "diamond" ||
    element.type === "cloud"
  );
};

export const hasBoundTextElement = <T extends ExcalidrawElement>(
  element: T | null,
): element is T &
  MarkNonNullable<ExcalidrawBindableElement, "boundElements"> => {
  return (
    isTextBindableContainer(element) &&
    !!element.boundElements?.some(({ type }) => type === "text")
  );
};

export const isBoundToContainer = <T extends ExcalidrawElement>(
  element: T | null,
): element is T & ExcalidrawTextElementWithContainer => {
  return (
    element !== null &&
    "containerId" in element &&
    element.containerId !== null &&
    isTextElement(element)
  );
};

export const isArrowBoundToElement = (element: ExcalidrawArrowElement) => {
  return !!element.startBinding || !!element.endBinding;
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

export const getLinearElementSubType = (
  element: ExcalidrawLinearElement,
): ExcalidrawLinearElementSubType => {
  if (isSharpArrow(element)) {
    return "sharpArrow";
  }
  if (isCurvedArrow(element)) {
    return "curvedArrow";
  }
  if (isElbowArrow(element)) {
    return "elbowArrow";
  }
  return "line";
};

/**
 * Checks if current element points meet all the conditions for polygon=true
 * (this isn't a element type check, for that use isLineElement).
 *
 * If you want to check if points *can* be turned into a polygon, use
 *  canBecomePolygon(points).
 */
export const isValidPolygon = (
  points: ExcalidrawLineElement["points"],
): boolean => {
  return points.length > 3 && pointsEqual(points[0], points[points.length - 1]);
};

export const canBecomePolygon = (
  points: ExcalidrawLineElement["points"],
): boolean => {
  return (
    points.length > 3 ||
    // 3-point polygons can't have all points in a single line
    (points.length === 3 && !pointsEqual(points[0], points[points.length - 1]))
  );
};

export const isEligibleFrameChildType = (type: ElementOrToolType) => {
  switch (type) {
    case "rectangle":
    case "diamond":
    case "ellipse":
    case "arrow":
    case "line":
    case "freedraw":
    case "text":
    case "image":
    case "frame":
    case "embeddable": {
      return true;
    }
    default: {
      return false;
    }
  }
};
