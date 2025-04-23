import {
  getSizeFromPoints,
  randomInteger,
  getUpdatedTimestamp,
  toBrandedType,
  isDevEnv,
  ROUNDNESS,
} from "@excalidraw/common";

// TODO: remove direct dependency on the scene, should be passed in or injected instead
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import Scene from "@excalidraw/excalidraw/scene/Scene";

import type { AppClassProperties } from "@excalidraw/excalidraw/types";

import type { Radians } from "@excalidraw/math";

import type { Mutable } from "@excalidraw/common/utility-types";

import { ShapeCache } from "./ShapeCache";

import { updateElbowArrowPoints } from "./elbowArrow";
import {
  isCurvedArrow,
  isElbowArrow,
  isSharpArrow,
  isUsingAdaptiveRadius,
} from "./typeChecks";

import type {
  ConvertibleGenericTypes,
  ConvertibleLinearTypes,
  ExcalidrawArrowElement,
  ExcalidrawDiamondElement,
  ExcalidrawElbowArrowElement,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawLinearElement,
  ExcalidrawRectangleElement,
  ExcalidrawSelectionElement,
  NonDeletedSceneElementsMap,
} from "./types";

export type ElementUpdate<TElement extends ExcalidrawElement> = Omit<
  Partial<TElement>,
  "id" | "version" | "versionNonce" | "updated"
>;

// This function tracks updates of text elements for the purposes for collaboration.
// The version is used to compare updates when more than one user is working in
// the same drawing. Note: this will trigger the component to update. Make sure you
// are calling it either from a React event handler or within unstable_batchedUpdates().
export const mutateElement = <TElement extends Mutable<ExcalidrawElement>>(
  element: TElement,
  updates: ElementUpdate<TElement>,
  informMutation = true,
  options?: {
    // Currently only for elbow arrows.
    // If true, the elbow arrow tries to bind to the nearest element. If false
    // it tries to keep the same bound element, if any.
    isDragging?: boolean;
    propertiesToDrop?: string[];
  },
): TElement => {
  let didChange = false;

  // casting to any because can't use `in` operator
  // (see https://github.com/microsoft/TypeScript/issues/21732)
  const { points, fixedSegments, fileId, startBinding, endBinding } =
    updates as any;

  if (
    isElbowArrow(element) &&
    (Object.keys(updates).length === 0 || // normalization case
      typeof points !== "undefined" || // repositioning
      typeof fixedSegments !== "undefined" || // segment fixing
      typeof startBinding !== "undefined" ||
      typeof endBinding !== "undefined") // manual binding to element
  ) {
    const elementsMap = toBrandedType<NonDeletedSceneElementsMap>(
      Scene.getScene(element)?.getNonDeletedElementsMap() ?? new Map(),
    );

    updates = {
      ...updates,
      angle: 0 as Radians,
      ...updateElbowArrowPoints(
        {
          ...element,
          x: updates.x || element.x,
          y: updates.y || element.y,
        },
        elementsMap,
        {
          fixedSegments,
          points,
          startBinding,
          endBinding,
        },
        {
          isDragging: options?.isDragging,
        },
      ),
    };
  } else if (typeof points !== "undefined") {
    updates = { ...getSizeFromPoints(points), ...updates };
  }

  for (const key in updates) {
    const value = (updates as any)[key];
    if (typeof value !== "undefined") {
      if (
        (element as any)[key] === value &&
        // if object, always update because its attrs could have changed
        // (except for specific keys we handle below)
        (typeof value !== "object" ||
          value === null ||
          key === "groupIds" ||
          key === "scale")
      ) {
        continue;
      }

      if (key === "scale") {
        const prevScale = (element as any)[key];
        const nextScale = value;
        if (prevScale[0] === nextScale[0] && prevScale[1] === nextScale[1]) {
          continue;
        }
      } else if (key === "points") {
        const prevPoints = (element as any)[key];
        const nextPoints = value;
        if (prevPoints.length === nextPoints.length) {
          let didChangePoints = false;
          let index = prevPoints.length;
          while (--index) {
            const prevPoint = prevPoints[index];
            const nextPoint = nextPoints[index];
            if (
              prevPoint[0] !== nextPoint[0] ||
              prevPoint[1] !== nextPoint[1]
            ) {
              didChangePoints = true;
              break;
            }
          }
          if (!didChangePoints) {
            continue;
          }
        }
      }

      if (options?.propertiesToDrop?.includes(key)) {
        delete (element as any)[key];
        didChange = true;
        continue;
      }

      (element as any)[key] = value;
      didChange = true;
    }
  }

  if (!didChange) {
    return element;
  }

  if (
    typeof updates.height !== "undefined" ||
    typeof updates.width !== "undefined" ||
    typeof fileId != "undefined" ||
    typeof points !== "undefined"
  ) {
    ShapeCache.delete(element);
  }

  element.version++;
  element.versionNonce = randomInteger();
  element.updated = getUpdatedTimestamp();

  if (informMutation) {
    Scene.getScene(element)?.triggerUpdate();
  }

  return element;
};

export const newElementWith = <TElement extends ExcalidrawElement>(
  element: TElement,
  updates: ElementUpdate<TElement>,
  /** pass `true` to always regenerate */
  force = false,
): TElement => {
  let didChange = false;
  for (const key in updates) {
    const value = (updates as any)[key];
    if (typeof value !== "undefined") {
      if (
        (element as any)[key] === value &&
        // if object, always update because its attrs could have changed
        (typeof value !== "object" || value === null)
      ) {
        continue;
      }
      didChange = true;
    }
  }

  if (!didChange && !force) {
    return element;
  }

  return {
    ...element,
    ...updates,
    updated: getUpdatedTimestamp(),
    version: element.version + 1,
    versionNonce: randomInteger(),
  };
};

/**
 * Mutates element, bumping `version`, `versionNonce`, and `updated`.
 *
 * NOTE: does not trigger re-render.
 */
export const bumpVersion = <T extends Mutable<ExcalidrawElement>>(
  element: T,
  version?: ExcalidrawElement["version"],
) => {
  element.version = (version ?? element.version) + 1;
  element.versionNonce = randomInteger();
  element.updated = getUpdatedTimestamp();
  return element;
};

// Declare the constant array with a read-only type so that its values can only be one of the valid union.
export const CONVERTIBLE_GENERIC_TYPES: readonly ConvertibleGenericTypes[] = [
  "rectangle",
  "diamond",
  "ellipse",
];

const ELBOW_ARROW_SPECIFIC_PROPERTIES: Array<
  keyof ExcalidrawElbowArrowElement
> = ["elbowed", "fixedSegments", "startIsSpecial", "endIsSpecial"];

const ARROW_TO_LINE_CLEAR_PROPERTIES: Array<keyof ExcalidrawArrowElement> = [
  "startArrowhead",
  "endArrowhead",
  "startBinding",
  "endBinding",
];

export const CONVERTIBLE_LINEAR_TYPES: readonly ConvertibleLinearTypes[] = [
  "line",
  "sharpArrow",
  "curvedArrow",
  "elbowArrow",
];

type NewElementType = ConvertibleGenericTypes | ConvertibleLinearTypes;

export const isConvertibleGenericType = (
  elementType: string,
): elementType is ConvertibleGenericTypes =>
  CONVERTIBLE_GENERIC_TYPES.includes(elementType as ConvertibleGenericTypes);

export const isConvertibleLinearType = (
  elementType: string,
): elementType is ConvertibleLinearTypes =>
  elementType === "arrow" ||
  CONVERTIBLE_LINEAR_TYPES.includes(elementType as ConvertibleLinearTypes);

/**
 * Converts an element to a new type, adding or removing properties as needed
 * so that the element object is always valid.
 *
 * Valid conversions at this point:
 * - switching between generic elements
 *   e.g. rectangle -> diamond
 * - switching between linear elements
 *   e.g. elbow arrow -> line
 */
export const convertElementType = <
  TElement extends Mutable<
    Exclude<ExcalidrawElement, ExcalidrawSelectionElement>
  >,
>(
  element: TElement,
  newType: NewElementType,
  app: AppClassProperties,
  informMutation = true,
): ExcalidrawElement => {
  if (!isValidConversion(element.type, newType)) {
    if (isDevEnv()) {
      throw Error(`Invalid conversion from ${element.type} to ${newType}.`);
    }
    return element;
  }

  const startType = isSharpArrow(element)
    ? "sharpArrow"
    : isCurvedArrow(element)
    ? "curvedArrow"
    : isElbowArrow(element)
    ? "elbowArrow"
    : element.type;

  if (element.type === newType) {
    return element;
  }

  ShapeCache.delete(element);

  const update = () => {
    (element as any).version++;
    (element as any).versionNonce = randomInteger();
    (element as any).updated = getUpdatedTimestamp();

    if (informMutation) {
      app.scene.triggerUpdate();
    }
  };

  if (
    isConvertibleGenericType(startType) &&
    isConvertibleGenericType(newType)
  ) {
    (element as any).type = newType;

    if (newType === "diamond" && element.roundness) {
      (element as any).roundness = {
        type: isUsingAdaptiveRadius(newType)
          ? ROUNDNESS.ADAPTIVE_RADIUS
          : ROUNDNESS.PROPORTIONAL_RADIUS,
      };
    }

    update();

    switch (element.type) {
      case "rectangle":
        return element as ExcalidrawRectangleElement;
      case "diamond":
        return element as ExcalidrawDiamondElement;
      case "ellipse":
        return element as ExcalidrawEllipseElement;
    }
  }

  if (isConvertibleLinearType(element.type)) {
    if (newType === "line") {
      for (const key of ELBOW_ARROW_SPECIFIC_PROPERTIES) {
        delete (element as any)[key];
      }
      for (const key of ARROW_TO_LINE_CLEAR_PROPERTIES) {
        if (key in element) {
          (element as any)[key] = null;
        }
      }

      (element as any).type = newType;
    }

    if (newType === "sharpArrow") {
      if (startType === "elbowArrow") {
        // drop elbow arrow specific properties
        for (const key of ELBOW_ARROW_SPECIFIC_PROPERTIES) {
          delete (element as any)[key];
        }
      }

      (element as any).type = "arrow";
      (element as any).elbowed = false;
      (element as any).roundness = null;
      (element as any).startArrowhead = app.state.currentItemStartArrowhead;
      (element as any).endArrowhead = app.state.currentItemEndArrowhead;
    }

    if (newType === "curvedArrow") {
      if (startType === "elbowArrow") {
        // drop elbow arrow specific properties
        for (const key of ELBOW_ARROW_SPECIFIC_PROPERTIES) {
          delete (element as any)[key];
        }
      }
      (element as any).type = "arrow";
      (element as any).elbowed = false;
      (element as any).roundness = {
        type: ROUNDNESS.PROPORTIONAL_RADIUS,
      };
      (element as any).startArrowhead = app.state.currentItemStartArrowhead;
      (element as any).endArrowhead = app.state.currentItemEndArrowhead;
    }

    if (newType === "elbowArrow") {
      (element as any).type = "arrow";
      (element as any).elbowed = true;
      (element as any).fixedSegments = null;
      (element as any).startIsSpecial = null;
      (element as any).endIsSpecial = null;
    }

    update();

    switch (newType) {
      case "line":
        return element as ExcalidrawLinearElement;
      case "sharpArrow":
        return element as ExcalidrawArrowElement;
      case "curvedArrow":
        return element as ExcalidrawArrowElement;
      case "elbowArrow":
        return element as ExcalidrawElbowArrowElement;
    }
  }

  return element;
};

const isValidConversion = (
  startType: string,
  targetType: NewElementType,
): startType is NewElementType => {
  if (
    isConvertibleGenericType(startType) &&
    isConvertibleGenericType(targetType)
  ) {
    return true;
  }

  if (
    isConvertibleLinearType(startType) &&
    isConvertibleLinearType(targetType)
  ) {
    return true;
  }

  // NOTE: add more conversions when needed

  return false;
};
