import {
  DEFAULT_ELEMENT_PROPS,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
  VERTICAL_ALIGN,
  randomInteger,
  randomId,
  getFontString,
  getUpdatedTimestamp,
  getLineHeight,
  BOUND_TEXT_PADDING,
} from "@excalidraw/common";

import type { Radians } from "@excalidraw/math";

import type { MarkOptional, Merge } from "@excalidraw/common/utility-types";

import {
  getElementAbsoluteCoords,
  getResizedElementAbsoluteCoords,
} from "./bounds";
import { newElementWith } from "./mutateElement";
import { getBoundTextMaxWidth, getBoundTextMaxHeight } from "./textElement";
import { normalizeText, measureText } from "./textMeasurements";
import { wrapText } from "./textWrapping";

import { isFlowchartType, isLineElement } from "./typeChecks";

import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawTextElement,
  ExcalidrawLinearElement,
  ExcalidrawGenericElement,
  NonDeleted,
  TextAlign,
  VerticalAlign,
  Arrowhead,
  ExcalidrawFreeDrawElement,
  FontFamilyValues,
  ExcalidrawTextContainer,
  ExcalidrawFrameElement,
  ExcalidrawEmbeddableElement,
  ExcalidrawMagicFrameElement,
  ExcalidrawIframeElement,
  ElementsMap,
  ExcalidrawArrowElement,
  ExcalidrawElbowArrowElement,
  ExcalidrawLineElement,
  ExcalidrawFlowchartNodeElement,
  ContainerBehavior,
} from "./types";

export type ElementConstructorOpts = MarkOptional<
  Omit<ExcalidrawGenericElement, "id" | "type" | "isDeleted" | "updated">,
  | "width"
  | "height"
  | "angle"
  | "groupIds"
  | "frameId"
  | "index"
  | "boundElements"
  | "seed"
  | "version"
  | "versionNonce"
  | "link"
  | "strokeStyle"
  | "fillStyle"
  | "strokeColor"
  | "backgroundColor"
  | "roughness"
  | "strokeWidth"
  | "roundness"
  | "locked"
  | "opacity"
  | "customData"
>;

const _newElementBase = <T extends ExcalidrawElement>(
  type: T["type"],
  {
    x,
    y,
    strokeColor = DEFAULT_ELEMENT_PROPS.strokeColor,
    backgroundColor = DEFAULT_ELEMENT_PROPS.backgroundColor,
    fillStyle = DEFAULT_ELEMENT_PROPS.fillStyle,
    strokeWidth = DEFAULT_ELEMENT_PROPS.strokeWidth,
    strokeStyle = DEFAULT_ELEMENT_PROPS.strokeStyle,
    roughness = DEFAULT_ELEMENT_PROPS.roughness,
    opacity = DEFAULT_ELEMENT_PROPS.opacity,
    width = 0,
    height = 0,
    angle = 0 as Radians,
    groupIds = [],
    frameId = null,
    index = null,
    roundness = null,
    boundElements = null,
    link = null,
    locked = DEFAULT_ELEMENT_PROPS.locked,
    ...rest
  }: ElementConstructorOpts & Omit<Partial<ExcalidrawGenericElement>, "type">,
) => {
  // NOTE (mtolmacs): This is a temporary check to detect extremely large
  // element position or sizing
  if (
    x < -1e6 ||
    x > 1e6 ||
    y < -1e6 ||
    y > 1e6 ||
    width < -1e6 ||
    width > 1e6 ||
    height < -1e6 ||
    height > 1e6
  ) {
    console.error("New element size or position is too large", {
      x,
      y,
      width,
      height,
      // @ts-ignore
      points: rest.points,
    });
  }

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
    frameId,
    index,
    roundness,
    seed: rest.seed ?? randomInteger(),
    version: rest.version || 1,
    versionNonce: rest.versionNonce ?? 0,
    isDeleted: false as false,
    boundElements,
    updated: getUpdatedTimestamp(),
    link,
    locked,
    customData: rest.customData,
  };
  return element;
};

export const newElement = (
  opts: {
    type: ExcalidrawGenericElement["type"];
    containerBehavior?: ContainerBehavior;
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawGenericElement> => {
  if (isFlowchartType(opts.type)) {
    return {
      ..._newElementBase<ExcalidrawFlowchartNodeElement>(
        opts.type as ExcalidrawFlowchartNodeElement["type"],
        opts,
      ),
      containerBehavior: {
        textFlow: opts.containerBehavior?.textFlow ?? "growing",
        margin: opts.containerBehavior?.margin ?? BOUND_TEXT_PADDING,
      },
    } as NonDeleted<ExcalidrawFlowchartNodeElement>;
  }
  return _newElementBase<ExcalidrawGenericElement>(
    opts.type,
    opts,
  ) as NonDeleted<ExcalidrawGenericElement>;
};

export const newEmbeddableElement = (
  opts: {
    type: "embeddable";
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawEmbeddableElement> => {
  return _newElementBase<ExcalidrawEmbeddableElement>("embeddable", opts);
};

export const newIframeElement = (
  opts: {
    type: "iframe";
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawIframeElement> => {
  return {
    ..._newElementBase<ExcalidrawIframeElement>("iframe", opts),
  };
};

export const newFrameElement = (
  opts: {
    name?: string;
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawFrameElement> => {
  const frameElement = newElementWith(
    {
      ..._newElementBase<ExcalidrawFrameElement>("frame", opts),
      type: "frame",
      name: opts?.name || null,
    },
    {},
  );

  return frameElement;
};

export const newMagicFrameElement = (
  opts: {
    name?: string;
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawMagicFrameElement> => {
  const frameElement = newElementWith(
    {
      ..._newElementBase<ExcalidrawMagicFrameElement>("magicframe", opts),
      type: "magicframe",
      name: opts?.name || null,
    },
    {},
  );

  return frameElement;
};

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
    originalText?: string;
    fontSize?: number;
    fontFamily?: FontFamilyValues;
    textAlign?: TextAlign;
    verticalAlign?: VerticalAlign;
    containerId?: ExcalidrawTextContainer["id"] | null;
    lineHeight?: ExcalidrawTextElement["lineHeight"];
    autoResize?: ExcalidrawTextElement["autoResize"];
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawTextElement> => {
  const fontFamily = opts.fontFamily || DEFAULT_FONT_FAMILY;
  const fontSize = opts.fontSize || DEFAULT_FONT_SIZE;
  const lineHeight = opts.lineHeight || getLineHeight(fontFamily);
  const text = normalizeText(opts.text);
  const metrics = measureText(
    text,
    getFontString({ fontFamily, fontSize }),
    lineHeight,
  );
  const textAlign = opts.textAlign || DEFAULT_TEXT_ALIGN;
  const verticalAlign = opts.verticalAlign || DEFAULT_VERTICAL_ALIGN;
  const offsets = getTextElementPositionOffsets(
    { textAlign, verticalAlign },
    metrics,
  );

  const textElementProps: ExcalidrawTextElement = {
    ..._newElementBase<ExcalidrawTextElement>("text", opts),
    text,
    fontSize,
    fontFamily,
    textAlign,
    verticalAlign,
    x: opts.x - offsets.x,
    y: opts.y - offsets.y,
    width: metrics.width,
    height: metrics.height,
    containerId: opts.containerId || null,
    originalText: opts.originalText ?? text,
    autoResize: opts.autoResize ?? true,
    lineHeight,
  };

  const textElement: ExcalidrawTextElement = newElementWith(
    textElementProps,
    {},
  );

  return textElement;
};

const getAdjustedDimensions = (
  element: ExcalidrawTextElement,
  elementsMap: ElementsMap,
  nextText: string,
): {
  x: number;
  y: number;
  width: number;
  height: number;
} => {
  let { width: nextWidth, height: nextHeight } = measureText(
    nextText,
    getFontString(element),
    element.lineHeight,
  );

  // wrapped text
  if (!element.autoResize) {
    nextWidth = element.width;
  }

  const { textAlign, verticalAlign } = element;
  let x: number;
  let y: number;
  if (
    textAlign === "center" &&
    verticalAlign === VERTICAL_ALIGN.MIDDLE &&
    !element.containerId &&
    element.autoResize
  ) {
    const prevMetrics = measureText(
      element.text,
      getFontString(element),
      element.lineHeight,
    );
    const offsets = getTextElementPositionOffsets(element, {
      width: nextWidth - prevMetrics.width,
      height: nextHeight - prevMetrics.height,
    });

    x = element.x - offsets.x;
    y = element.y - offsets.y;
  } else {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);

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

  return {
    width: nextWidth,
    height: nextHeight,
    x: Number.isFinite(x) ? x : element.x,
    y: Number.isFinite(y) ? y : element.y,
  };
};

const adjustXYWithRotation = (
  sides: {
    n?: boolean;
    e?: boolean;
    s?: boolean;
    w?: boolean;
  },
  x: number,
  y: number,
  angle: number,
  deltaX1: number,
  deltaY1: number,
  deltaX2: number,
  deltaY2: number,
): [number, number] => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  if (sides.e && sides.w) {
    x += deltaX1 + deltaX2;
  } else if (sides.e) {
    x += deltaX1 * (1 + cos);
    y += deltaX1 * sin;
    x += deltaX2 * (1 - cos);
    y += deltaX2 * -sin;
  } else if (sides.w) {
    x += deltaX1 * (1 - cos);
    y += deltaX1 * -sin;
    x += deltaX2 * (1 + cos);
    y += deltaX2 * sin;
  }

  if (sides.n && sides.s) {
    y += deltaY1 + deltaY2;
  } else if (sides.n) {
    x += deltaY1 * sin;
    y += deltaY1 * (1 - cos);
    x += deltaY2 * -sin;
    y += deltaY2 * (1 + cos);
  } else if (sides.s) {
    x += deltaY1 * -sin;
    y += deltaY1 * (1 + cos);
    x += deltaY2 * sin;
    y += deltaY2 * (1 - cos);
  }
  return [x, y];
};

// Sticky note font sizing constants
export const STICKY_NOTE_FONT_STEP = 2;
export const STICKY_NOTE_MIN_FONT_SIZE = 8;
export const STICKY_NOTE_MAX_FONT_SIZE = 72;

export interface StickyNoteFontComputationResult {
  fontSize: number;
  width: number;
  height: number;
  wrappedText: string;
}

/**
 * Computes the appropriate font size (snapped to step) so that the text fits
 * inside the sticky note container without resizing the container.
 * It first tries to shrink if overflowing, otherwise opportunistically enlarges
 * (still snapped) while it fits. Width is constrained by wrap at container width.
 */
export const computeStickyNoteFontSize = (
  text: string,
  element: ExcalidrawTextElement,
  container: ExcalidrawTextContainer,
  maxGrowFontSize?: number,
): StickyNoteFontComputationResult => {
  const step = STICKY_NOTE_FONT_STEP;
  const maxH = getBoundTextMaxHeight(container, element as any);
  const maxW = getBoundTextMaxWidth(container, element);

  const snap = (size: number) =>
    Math.max(
      STICKY_NOTE_MIN_FONT_SIZE,
      Math.max(step, Math.floor(size / step) * step),
    );

  let size = snap(element.fontSize);
  const growthCap = snap(
    maxGrowFontSize != null ? maxGrowFontSize : STICKY_NOTE_MAX_FONT_SIZE,
  );

  const lineHeight = element.lineHeight;
  const fontFamily = element.fontFamily;

  const measure = (fontSize: number) => {
    const font = getFontString({ fontFamily, fontSize });
    const wrappedText = wrapText(text, font, maxW);
    const metrics = measureText(wrappedText, font, lineHeight);
    return {
      wrappedText,
      width: Math.min(metrics.width, maxW),
      height: metrics.height,
    };
  };

  let { wrappedText, width, height } = measure(size);

  if (height > maxH) {
    // shrink until fits or min
    while (size > STICKY_NOTE_MIN_FONT_SIZE) {
      const next = snap(size - step);
      if (next === size) {
        break;
      }
      size = next;
      ({ wrappedText, width, height } = measure(size));
      if (height <= maxH) {
        break;
      }
    }
  } else {
    // grow back only up to growthCap (initial session font size)
    while (size < growthCap) {
      const next = snap(Math.min(size + step, growthCap));
      if (next === size) {
        break;
      }
      const m = measure(next);
      if (m.height <= maxH) {
        size = next;
        wrappedText = m.wrappedText;
        width = m.width;
        height = m.height;
      } else {
        break;
      }
    }
  }

  return { fontSize: size, width, height, wrappedText };
};

export const refreshTextDimensions = (
  textElement: ExcalidrawTextElement,
  container: ExcalidrawTextContainer | null,
  elementsMap: ElementsMap,
  text = textElement.text,
) => {
  if (textElement.isDeleted) {
    return;
  }
  if (container || !textElement.autoResize) {
    text = wrapText(
      text,
      getFontString(textElement),
      container
        ? getBoundTextMaxWidth(container, textElement)
        : textElement.width,
    );
  }
  const dimensions = getAdjustedDimensions(textElement, elementsMap, text);
  return { text, ...dimensions };
};

export const newFreeDrawElement = (
  opts: {
    type: "freedraw";
    points?: ExcalidrawFreeDrawElement["points"];
    simulatePressure: boolean;
    pressures?: ExcalidrawFreeDrawElement["pressures"];
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawFreeDrawElement> => {
  return {
    ..._newElementBase<ExcalidrawFreeDrawElement>(opts.type, opts),
    points: opts.points || [],
    pressures: opts.pressures || [],
    simulatePressure: opts.simulatePressure,
  };
};

export const newLinearElement = (
  opts: {
    type: ExcalidrawLinearElement["type"];
    points?: ExcalidrawLinearElement["points"];
    polygon?: ExcalidrawLineElement["polygon"];
  } & ElementConstructorOpts,
): NonDeleted<ExcalidrawLinearElement> => {
  const element = {
    ..._newElementBase<ExcalidrawLinearElement>(opts.type, opts),
    points: opts.points || [],

    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
  };

  if (isLineElement(element)) {
    const lineElement: NonDeleted<ExcalidrawLineElement> = {
      ...element,
      polygon: opts.polygon ?? false,
    };

    return lineElement;
  }

  return element;
};

export const newArrowElement = <T extends boolean>(
  opts: {
    type: ExcalidrawArrowElement["type"];
    startArrowhead?: Arrowhead | null;
    endArrowhead?: Arrowhead | null;
    points?: ExcalidrawArrowElement["points"];
    elbowed?: T;
    fixedSegments?: ExcalidrawElbowArrowElement["fixedSegments"] | null;
  } & ElementConstructorOpts,
): T extends true
  ? NonDeleted<ExcalidrawElbowArrowElement>
  : NonDeleted<ExcalidrawArrowElement> => {
  if (opts.elbowed) {
    return {
      ..._newElementBase<ExcalidrawElbowArrowElement>(opts.type, opts),
      points: opts.points || [],
      startBinding: null,
      endBinding: null,
      startArrowhead: opts.startArrowhead || null,
      endArrowhead: opts.endArrowhead || null,
      elbowed: true,
      fixedSegments: opts.fixedSegments || [],
      startIsSpecial: false,
      endIsSpecial: false,
    } as NonDeleted<ExcalidrawElbowArrowElement>;
  }

  return {
    ..._newElementBase<ExcalidrawArrowElement>(opts.type, opts),
    points: opts.points || [],
    startBinding: null,
    endBinding: null,
    startArrowhead: opts.startArrowhead || null,
    endArrowhead: opts.endArrowhead || null,
    elbowed: false,
  } as T extends true
    ? NonDeleted<ExcalidrawElbowArrowElement>
    : NonDeleted<ExcalidrawArrowElement>;
};

export const newImageElement = (
  opts: {
    type: ExcalidrawImageElement["type"];
    status?: ExcalidrawImageElement["status"];
    fileId?: ExcalidrawImageElement["fileId"];
    scale?: ExcalidrawImageElement["scale"];
    crop?: ExcalidrawImageElement["crop"];
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
    crop: opts.crop ?? null,
  };
};
