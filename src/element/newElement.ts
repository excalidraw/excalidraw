import {
  ExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawTextElement,
  ExcalidrawLinearElement,
  ExcalidrawGenericElement,
  NonDeleted,
  TextAlign,
  GroupId,
  VerticalAlign,
  Arrowhead,
  ExcalidrawFreeDrawElement,
  FontFamilyValues,
  ExcalidrawTextContainer,
} from "../element/types";
import { getFontString, getUpdatedTimestamp, isTestEnv } from "../utils";
import { randomInteger, randomId } from "../random";
import { mutateElement, newElementWith } from "./mutateElement";
import { getNewGroupIdsForDuplication } from "../groups";
import { AppState } from "../types";
import { getElementAbsoluteCoords } from ".";
import { adjustXYWithRotation } from "../math";
import { getResizedElementAbsoluteCoords } from "./bounds";
import {
  getBoundTextElement,
  getBoundTextElementOffset,
  getContainerDims,
  getContainerElement,
  measureText,
  normalizeText,
  wrapText,
} from "./textElement";
import { BOUND_TEXT_PADDING, VERTICAL_ALIGN } from "../constants";
import { isArrowElement } from "./typeChecks";

type ElementConstructorOpts = MarkOptional<
  Omit<ExcalidrawGenericElement, "id" | "type" | "isDeleted" | "updated">,
  | "width"
  | "height"
  | "angle"
  | "groupIds"
  | "boundElements"
  | "seed"
  | "version"
  | "versionNonce"
  | "link"
>;

const _newElementBase = <T extends ExcalidrawElement>(
  type: T["type"],
  {
    x,
    y,
    strokeColor,
    backgroundColor,
    fillStyle,
    strokeWidth,
    strokeStyle,
    roughness,
    opacity,
    width = 0,
    height = 0,
    angle = 0,
    groupIds = [],
    roundness = null,
    boundElements = null,
    link = null,
    locked,
    ...rest
  }: ElementConstructorOpts & Omit<Partial<ExcalidrawGenericElement>, "type">,
) => {
  // assign type to guard against excess properties
  const element: Merge<ExcalidrawGenericElement, { type: T["type"] }> = {
    id: rest.id || randomId(),
    type,
    x,
    y,
    width,
    height,
    angle,
    strokeColor,
    backgroundColor,
    fillStyle,
    strokeWidth,
    strokeStyle,
    roughness,
    opacity,
    groupIds,
    roundness,
    seed: rest.seed ?? randomInteger(),
    version: rest.version || 1,
    versionNonce: rest.versionNonce ?? 0,
    isDeleted: false as false,
    boundElements,
    updated: getUpdatedTimestamp(),
    link,
    locked,
  };
  return element;
};

export const newElement = (
  opts: {
    type: ExcalidrawGenericElement["type"];
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawGenericElement> =>
  _newElementBase<ExcalidrawGenericElement>(opts.type, opts);

/** computes element x/y offset based on textAlign/verticalAlign */
const getTextElementPositionOffsets = (
  opts: {
    textAlign: ExcalidrawTextElement["textAlign"];
    verticalAlign: ExcalidrawTextElement["verticalAlign"];
  },
  metrics: {
    width: number;
    height: number;
  },
) => {
  return {
    x:
      opts.textAlign === "center"
        ? metrics.width / 2
        : opts.textAlign === "right"
        ? metrics.width
        : 0,
    y: opts.verticalAlign === "middle" ? metrics.height / 2 : 0,
  };
};

export const newTextElement = (
  opts: {
    text: string;
    fontSize: number;
    fontFamily: FontFamilyValues;
    textAlign: TextAlign;
    verticalAlign: VerticalAlign;
    containerId?: ExcalidrawTextContainer["id"];
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawTextElement> => {
  const text = normalizeText(opts.text);
  const metrics = measureText(text, getFontString(opts));
  const offsets = getTextElementPositionOffsets(opts, metrics);
  const textElement = newElementWith(
    {
      ..._newElementBase<ExcalidrawTextElement>("text", opts),
      text,
      fontSize: opts.fontSize,
      fontFamily: opts.fontFamily,
      textAlign: opts.textAlign,
      verticalAlign: opts.verticalAlign,
      x: opts.x - offsets.x,
      y: opts.y - offsets.y,
      width: metrics.width,
      height: metrics.height,
      baseline: metrics.baseline,
      containerId: opts.containerId || null,
      originalText: text,
    },
    {},
  );
  return textElement;
};

const getAdjustedDimensions = (
  element: ExcalidrawTextElement,
  nextText: string,
): {
  x: number;
  y: number;
  width: number;
  height: number;
  baseline: number;
} => {
  let maxWidth = null;
  const container = getContainerElement(element);
  if (container) {
    maxWidth = getMaxContainerWidth(container);
  }
  const {
    width: nextWidth,
    height: nextHeight,
    baseline: nextBaseline,
  } = measureText(nextText, getFontString(element), maxWidth);
  const { textAlign, verticalAlign } = element;
  let x: number;
  let y: number;
  if (
    textAlign === "center" &&
    verticalAlign === VERTICAL_ALIGN.MIDDLE &&
    !element.containerId
  ) {
    const prevMetrics = measureText(
      element.text,
      getFontString(element),
      maxWidth,
    );
    const offsets = getTextElementPositionOffsets(element, {
      width: nextWidth - prevMetrics.width,
      height: nextHeight - prevMetrics.height,
    });

    x = element.x - offsets.x;
    y = element.y - offsets.y;
  } else {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);

    const [nextX1, nextY1, nextX2, nextY2] = getResizedElementAbsoluteCoords(
      element,
      nextWidth,
      nextHeight,
      false,
    );
    const deltaX1 = (x1 - nextX1) / 2;
    const deltaY1 = (y1 - nextY1) / 2;
    const deltaX2 = (x2 - nextX2) / 2;
    const deltaY2 = (y2 - nextY2) / 2;

    [x, y] = adjustXYWithRotation(
      {
        s: true,
        e: textAlign === "center" || textAlign === "left",
        w: textAlign === "center" || textAlign === "right",
      },
      element.x,
      element.y,
      element.angle,
      deltaX1,
      deltaY1,
      deltaX2,
      deltaY2,
    );
  }

  // make sure container dimensions are set properly when
  // text editor overflows beyond viewport dimensions
  if (container) {
    const boundTextElementPadding = getBoundTextElementOffset(element);

    const containerDims = getContainerDims(container);
    let height = containerDims.height;
    let width = containerDims.width;
    if (nextHeight > height - boundTextElementPadding * 2) {
      height = nextHeight + boundTextElementPadding * 2;
    }
    if (nextWidth > width - boundTextElementPadding * 2) {
      width = nextWidth + boundTextElementPadding * 2;
    }
    if (
      !isArrowElement(container) &&
      (height !== containerDims.height || width !== containerDims.width)
    ) {
      mutateElement(container, { height, width });
    }
  }
  return {
    width: nextWidth,
    height: nextHeight,
    x: Number.isFinite(x) ? x : element.x,
    y: Number.isFinite(y) ? y : element.y,
    baseline: nextBaseline,
  };
};

export const refreshTextDimensions = (
  textElement: ExcalidrawTextElement,
  text = textElement.text,
) => {
  const container = getContainerElement(textElement);
  if (container) {
    text = wrapText(
      text,
      getFontString(textElement),
      getMaxContainerWidth(container),
    );
  }
  const dimensions = getAdjustedDimensions(textElement, text);
  return { text, ...dimensions };
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
  return height - BOUND_TEXT_PADDING * 2;
};

export const updateTextElement = (
  textElement: ExcalidrawTextElement,
  {
    text,
    isDeleted,
    originalText,
  }: {
    text: string;
    isDeleted?: boolean;
    originalText: string;
  },
): ExcalidrawTextElement => {
  return newElementWith(textElement, {
    originalText,
    isDeleted: isDeleted ?? textElement.isDeleted,
    ...refreshTextDimensions(textElement, originalText),
  });
};

export const newFreeDrawElement = (
  opts: {
    type: "freedraw";
    points?: ExcalidrawFreeDrawElement["points"];
    simulatePressure: boolean;
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawFreeDrawElement> => {
  return {
    ..._newElementBase<ExcalidrawFreeDrawElement>(opts.type, opts),
    points: opts.points || [],
    pressures: [],
    simulatePressure: opts.simulatePressure,
    lastCommittedPoint: null,
  };
};

export const newLinearElement = (
  opts: {
    type: ExcalidrawLinearElement["type"];
    startArrowhead: Arrowhead | null;
    endArrowhead: Arrowhead | null;
    points?: ExcalidrawLinearElement["points"];
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawLinearElement> => {
  return {
    ..._newElementBase<ExcalidrawLinearElement>(opts.type, opts),
    points: opts.points || [],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: opts.startArrowhead,
    endArrowhead: opts.endArrowhead,
  };
};

export const newImageElement = (
  opts: {
    type: ExcalidrawImageElement["type"];
    status?: ExcalidrawImageElement["status"];
    fileId?: ExcalidrawImageElement["fileId"];
    scale?: ExcalidrawImageElement["scale"];
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawImageElement> => {
  return {
    ..._newElementBase<ExcalidrawImageElement>("image", opts),
    // in the future we'll support changing stroke color for some SVG elements,
    // and `transparent` will likely mean "use original colors of the image"
    strokeColor: "transparent",
    status: opts.status ?? "pending",
    fileId: opts.fileId ?? null,
    scale: opts.scale ?? [1, 1],
  };
};

// Simplified deep clone for the purpose of cloning ExcalidrawElement only
// (doesn't clone Date, RegExp, Map, Set, Typed arrays etc.)
//
// Adapted from https://github.com/lukeed/klona
export const deepCopyElement = (val: any, depth: number = 0) => {
  if (val == null || typeof val !== "object") {
    return val;
  }

  if (Object.prototype.toString.call(val) === "[object Object]") {
    const tmp =
      typeof val.constructor === "function"
        ? Object.create(Object.getPrototypeOf(val))
        : {};
    for (const key in val) {
      if (val.hasOwnProperty(key)) {
        // don't copy non-serializable objects like these caches. They'll be
        // populated when the element is rendered.
        if (depth === 0 && (key === "shape" || key === "canvas")) {
          continue;
        }
        tmp[key] = deepCopyElement(val[key], depth + 1);
      }
    }
    return tmp;
  }

  if (Array.isArray(val)) {
    let k = val.length;
    const arr = new Array(k);
    while (k--) {
      arr[k] = deepCopyElement(val[k], depth + 1);
    }
    return arr;
  }

  return val;
};

/**
 * Duplicate an element, often used in the alt-drag operation.
 * Note that this method has gotten a bit complicated since the
 * introduction of gruoping/ungrouping elements.
 * @param editingGroupId The current group being edited. The new
 *                       element will inherit this group and its
 *                       parents.
 * @param groupIdMapForOperation A Map that maps old group IDs to
 *                               duplicated ones. If you are duplicating
 *                               multiple elements at once, share this map
 *                               amongst all of them
 * @param element Element to duplicate
 * @param overrides Any element properties to override
 */
export const duplicateElement = <TElement extends Mutable<ExcalidrawElement>>(
  editingGroupId: AppState["editingGroupId"],
  groupIdMapForOperation: Map<GroupId, GroupId>,
  element: TElement,
  overrides?: Partial<TElement>,
): TElement => {
  let copy: TElement = deepCopyElement(element);

  if (isTestEnv()) {
    copy.id = `${copy.id}_copy`;
    // `window.h` may not be defined in some unit tests
    if (
      window.h?.app
        ?.getSceneElementsIncludingDeleted()
        .find((el) => el.id === copy.id)
    ) {
      copy.id += "_copy";
    }
  } else {
    copy.id = randomId();
  }
  copy.boundElements = null;
  copy.updated = getUpdatedTimestamp();
  copy.seed = randomInteger();
  copy.groupIds = getNewGroupIdsForDuplication(
    copy.groupIds,
    editingGroupId,
    (groupId) => {
      if (!groupIdMapForOperation.has(groupId)) {
        groupIdMapForOperation.set(groupId, randomId());
      }
      return groupIdMapForOperation.get(groupId)!;
    },
  );
  if (overrides) {
    copy = Object.assign(copy, overrides);
  }
  return copy;
};
