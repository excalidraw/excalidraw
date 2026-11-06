import {
  clamp,
  isFiniteNumber,
  isValidPoint,
  pointFrom,
} from "@excalidraw/math";

import {
  colorToHex,
  COLOR_TOP_PICKS_SLOTS,
  type CombineBrandsIfNeeded,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_STROKE_STREAMLINE,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
  FONT_FAMILY,
  FONT_METADATA,
  FONT_TOP_PICKS_SLOTS,
  ROUNDNESS,
  DEFAULT_SIDEBAR,
  DEFAULT_ELEMENT_PROPS,
  DEFAULT_GRID_SIZE,
  DEFAULT_GRID_STEP,
  randomId,
  getUpdatedTimestamp,
  updateActiveTool,
  arrayToMap,
  getSizeFromPoints,
  normalizeLink,
  getLineHeight,
  STROKE_WIDTH,
  STROKE_WIDTH_KEYS,
  type StrokeWidthKey,
  isTransparent,
  DEFAULT_ZOOM,
  TEXT_ALIGN,
  VERTICAL_ALIGN,
  isMemberOf,
  isRecord as isRecordLike,
  toFiniteNumber,
  toPositiveNumber,
} from "@excalidraw/common";
import {
  calculateFixedPointForNonElbowArrowBinding,
  getNonDeletedElements,
  normalizeArrowhead,
  isPointInElement,
  isValidPolygon,
  projectFixedPointOntoDiagonal,
  isNonDeletedElement,
} from "@excalidraw/element";
import { normalizeFixedPoint } from "@excalidraw/element";
import {
  updateElbowArrowPoints,
  validateElbowPoints,
} from "@excalidraw/element";
import { LinearElementEditor } from "@excalidraw/element";
import {
  bumpVersion,
  getStickyNoteLayout,
  isStickyNoteBoundText,
  normalizeStickyNote,
  normalizeStickyNoteBackgroundColor,
  normalizeStickyNoteFontSize,
  normalizeStickyNoteStrokeColor,
} from "@excalidraw/element";
import {
  computeBoundTextPosition,
  getBoundTextElement,
  getBoundTextElementId,
  getContainerElement,
  getContainerUpdatesToFitBoundText,
} from "@excalidraw/element";
import { isStickyNoteElement } from "@excalidraw/element";
import { detectLineHeight } from "@excalidraw/element";
import {
  isArrowBoundToElement,
  isArrowElement,
  isElbowArrow,
  isFrameLikeElement,
  isLinearElement,
  isLineElement,
  isTextBindableContainer,
  isTextElement,
  isUsingAdaptiveRadius,
} from "@excalidraw/element";

import {
  normalizeBoundElementsOrder,
  syncInvalidIndices,
  syncMovedIndices,
} from "@excalidraw/element";

import { refreshTextDimensions } from "@excalidraw/element";

import { getNormalizedDimensions } from "@excalidraw/element";

import { isInvisiblySmallElement } from "@excalidraw/element";

import type { LocalPoint, Radians } from "@excalidraw/math";

import type {
  AnyArrowhead,
  Arrowhead,
  BindMode,
  BoundElement,
  ElementsMap,
  ElementsMapOrArray,
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElbowArrowElement,
  ExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawLinearElement,
  ExcalidrawSelectionElement,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
  FileId,
  FillStyle,
  FixedPointBinding,
  FixedSegment,
  FontFamilyValues,
  ImageCrop,
  StrokeStyle,
  TextAlign,
  VerticalAlign,
  NonDeleted,
  NonDeletedSceneElementsMap,
  OrderedExcalidrawElement,
  StrokeVariability,
  StrokeRoundness,
} from "@excalidraw/element/types";

import type { MarkOptional, Mutable } from "@excalidraw/common/utility-types";

import { getDefaultAppState } from "../appState";

import {
  getNormalizedGridSize,
  getNormalizedGridStep,
  getNormalizedZoom,
} from "../scene";

import type { AppState, BinaryFiles, LibraryItem } from "../types";
import type { ImportedDataState, LegacyAppState } from "./types";

type RestoredAppState = Omit<
  AppState,
  "offsetTop" | "offsetLeft" | "width" | "height"
>;

const MAX_LINEAR_PX = 75_000;

// Last resort fix for extremely large linear elements (lines / arrows), which
// would otherwise freeze the editor while rendering — e.g. a dotted or dashed
// stroke spanning a huge distance generates an enormous dash array.
// https://github.com/excalidraw/excalidraw/issues/11497
const handleOversizedLinearElements = <T extends ExcalidrawLinearElement>(
  element: T,
): T => {
  if (element.width <= MAX_LINEAR_PX && element.height <= MAX_LINEAR_PX) {
    return element;
  }

  const label =
    element.type === "arrow"
      ? `${isElbowArrow(element) ? "elbow" : "simple"} arrow`
      : element.type;

  console.error(
    `Removing extremely large ${label} ${element.id} (width: ${element.width}, height: ${element.height}, x: ${element.x}, y: ${element.y})`,
  );

  return {
    ...element,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 100)],
    // elbow arrow state refers to the replaced points
    ...(isElbowArrow(element) && {
      fixedSegments: null,
      startIsSpecial: null,
      endIsSpecial: null,
    }),
    isDeleted: true,
  };
};

/**
 * Numeric ids are coerced to strings so that references written with the
 * same numbers (containerId, bindings…) still resolve.
 */
const restoreId = (id: unknown): string | null =>
  typeof id === "string" ? id || null : isFiniteNumber(id) ? String(id) : null;

const restoreString = (value: unknown): string | null =>
  typeof value === "string"
    ? value
    : isFiniteNumber(value) || typeof value === "boolean"
    ? String(value)
    : null;

const restoreBoolean = <T extends boolean | null>(
  value: unknown,
  defaultValue: T,
): boolean | T => (typeof value === "boolean" ? value : defaultValue);

const restoreEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  defaultValue: T,
): T =>
  typeof value === "string" && isMemberOf(allowed, value)
    ? value
    : defaultValue;

const FILL_STYLES: readonly FillStyle[] = [
  "hachure",
  "cross-hatch",
  "solid",
  "zigzag",
];
const STROKE_STYLES: readonly StrokeStyle[] = ["solid", "dashed", "dotted"];
const TEXT_ALIGNS = Object.values(TEXT_ALIGN) as TextAlign[];
const VERTICAL_ALIGNS = Object.values(VERTICAL_ALIGN) as VerticalAlign[];
const BIND_MODES: readonly BindMode[] = ["inside", "orbit", "skip"];
const IMAGE_STATUSES: readonly ExcalidrawImageElement["status"][] = [
  "pending",
  "saved",
  "error",
];

/**
 * Accepts `[x, y]` and `{ x, y }` points, the latter used by some generators.
 */
const restorePoint = (point: unknown): LocalPoint | null => {
  if (isValidPoint(point)) {
    return pointFrom<LocalPoint>(point[0], point[1]);
  }
  const [x, y] = Array.isArray(point)
    ? point
    : isRecordLike(point)
    ? [point.x, point.y]
    : [];
  const restoredX = toFiniteNumber(x);
  const restoredY = toFiniteNumber(y);
  return restoredX !== null && restoredY !== null
    ? pointFrom<LocalPoint>(restoredX, restoredY)
    : null;
};

const restorePoints = (points: unknown): LocalPoint[] =>
  Array.isArray(points)
    ? points.reduce<LocalPoint[]>((acc, point) => {
        const restoredPoint = restorePoint(point);
        if (restoredPoint) {
          acc.push(restoredPoint);
        }
        return acc;
      }, [])
    : [];

/**
 * Linear elements need at least 2 points, so missing points are rebuilt as a
 * straight segment spanning the element's size.
 */
const restoreLinearElementPoints = (
  points: unknown,
  width: unknown,
  height: unknown,
): LocalPoint[] => {
  const restoredPoints = restorePoints(points);

  if (restoredPoints.length >= 2) {
    return restoredPoints;
  }

  const [point] = restoredPoints;
  // a lone point other than the origin is the end of the segment
  return point && (point[0] !== 0 || point[1] !== 0)
    ? [pointFrom<LocalPoint>(0, 0), point]
    : [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(
          toFiniteNumber(width) ?? 0,
          toFiniteNumber(height) ?? 0,
        ),
      ];
};

const restoreFreedrawPoints = (
  points: unknown,
  pressures: unknown,
): {
  points: LocalPoint[];
  pressures: number[];
} => {
  if (!Array.isArray(points)) {
    return {
      points: [],
      pressures: [],
    };
  }

  const pressureValues: readonly unknown[] = Array.isArray(pressures)
    ? pressures
    : [];
  const restoredPoints: LocalPoint[] = [];
  const restoredPressures: number[] = [];

  points.forEach((point, index) => {
    const restoredPoint = restorePoint(point);
    if (restoredPoint) {
      restoredPoints.push(restoredPoint);
      // keep pressures aligned with the points, defaulting the missing or
      // malformed ones, so that a slightly off count doesn't lose them all
      if (pressureValues.length) {
        restoredPressures.push(toFiniteNumber(pressureValues[index]) ?? 0.5);
      }
    }
  });

  return {
    points: restoredPoints,
    pressures: restoredPressures,
  };
};

export const AllowedExcalidrawActiveTools: Record<
  AppState["activeTool"]["type"],
  boolean
> = {
  selection: true,
  lasso: true,
  text: true,
  rectangle: true,
  diamond: true,
  ellipse: true,
  line: true,
  image: true,
  arrow: true,
  freedraw: true,
  stickynote: true,
  eraser: false,
  custom: true,
  frame: true,
  embeddable: true,
  hand: true,
  laser: false,
  autoshape: false,
  magicframe: false,
  bucketfill: true,
};

export type RestoredDataState = {
  elements: OrderedExcalidrawElement[];
  appState: RestoredAppState;
  files: BinaryFiles;
};

const ALLOWED_STROKE_VARIABILITIES = new Set<StrokeVariability>([
  "constant",
  "variable",
]);

const restoreStrokeVariability = (
  variability: unknown,
  defaultValue: StrokeVariability,
): StrokeVariability => {
  return typeof variability === "string" &&
    ALLOWED_STROKE_VARIABILITIES.has(variability as StrokeVariability)
    ? (variability as StrokeVariability)
    : defaultValue;
};

const getStrokeWidthKey = (strokeWidth: unknown): StrokeWidthKey | null => {
  return isFiniteNumber(strokeWidth)
    ? STROKE_WIDTH_KEYS.find((key) => STROKE_WIDTH[key] === strokeWidth) ?? null
    : null;
};

const restoreFreedrawStrokeOptions = (
  strokeOptions: unknown,
): { variability: StrokeVariability; streamline: number } => {
  const options = isRecordLike(strokeOptions) ? strokeOptions : null;

  return {
    variability: restoreStrokeVariability(options?.variability, "variable"),
    streamline: isFiniteNumber(options?.streamline)
      ? options?.streamline
      : DEFAULT_STROKE_STREAMLINE,
  };
};

const getFontFamilyByName = (fontFamilyName: string): FontFamilyValues => {
  if (Object.keys(FONT_FAMILY).includes(fontFamilyName)) {
    return FONT_FAMILY[
      fontFamilyName as keyof typeof FONT_FAMILY
    ] as FontFamilyValues;
  }
  return DEFAULT_FONT_FAMILY;
};

/**
 * Line-height might not be specified either when creating elements
 * programmatically, or when importing old diagrams. For the latter we want to
 * detect the original line height, which will likely differ from our per-font
 * fixed line height we now use, to maintain backward compatibility.
 *
 * Takes the element with the font properties already migrated: a diagram old
 * enough to carry the legacy `font` prop has neither `fontSize` nor
 * `fontFamily`, so detecting off the raw element divides by `undefined`.
 */
const restoreLineHeight = (
  element: ExcalidrawTextElement,
): ExcalidrawTextElement["lineHeight"] => {
  const detected = element.height ? detectLineHeight(element) : null;

  return isFiniteNumber(detected) && detected > 0
    ? detected
    : getLineHeight(element.fontFamily);
};

const repairBinding = <T extends ExcalidrawArrowElement>(
  element: T,
  binding: FixedPointBinding | null,
  targetElementsMap: Readonly<ElementsMap>,
  /** used for context (arrow bindings) */
  existingElementsMap: Readonly<ElementsMap> | null | undefined,
  startOrEnd: "start" | "end",
): FixedPointBinding | null => {
  try {
    if (!binding) {
      return null;
    }

    // ---------------------------------------------------------------------------
    // elbow arrows
    // ---------------------------------------------------------------------------

    if (isElbowArrow(element)) {
      const fixedPointBinding:
        | ExcalidrawElbowArrowElement["startBinding"]
        | ExcalidrawElbowArrowElement["endBinding"] = {
        ...binding,
        fixedPoint: normalizeFixedPoint(binding.fixedPoint),
        mode: binding.mode || "orbit",
      };

      return fixedPointBinding;
    }

    // ---------------------------------------------------------------------------
    // simple arrows
    // ---------------------------------------------------------------------------

    // binding schema v2
    // ---------------------------------------------------------------------------

    if (binding.mode) {
      // if latest binding schema, don't check if binding.elementId exists
      // (it's done in a separate pass)
      if (binding.elementId) {
        return {
          elementId: binding.elementId,
          mode: binding.mode,
          fixedPoint: normalizeFixedPoint(binding.fixedPoint),
        } as FixedPointBinding | null;
      }
      return null;
    }

    // binding schema v1 (legacy) -> attempt to migrate to v2
    // ---------------------------------------------------------------------------

    const targetBoundElement = targetElementsMap.get(binding.elementId) as
      | ExcalidrawBindableElement
      | undefined;
    const boundElement =
      targetBoundElement ||
      (existingElementsMap?.get(binding.elementId) as
        | ExcalidrawBindableElement
        | undefined);
    const elementsMap = targetBoundElement
      ? targetElementsMap
      : existingElementsMap;

    // migrating legacy focus point bindings
    if (boundElement && elementsMap) {
      const p = LinearElementEditor.getPointAtIndexGlobalCoordinates(
        element,
        startOrEnd === "start" ? 0 : element.points.length - 1,
        elementsMap,
      );
      const mode = isPointInElement(p, boundElement, elementsMap)
        ? "inside"
        : "orbit";

      if (!isNonDeletedElement(element)) {
        console.error("[NONDELETED][INVARIANT] Restoring a deleted element");
      }

      const safeElement = {
        ...element,
        startBinding: element.startBinding?.elementId
          ? {
              ...element.startBinding,
              mode,
              fixedPoint: normalizeFixedPoint(element.startBinding.fixedPoint),
            }
          : null,
        endBinding: element.endBinding?.elementId
          ? {
              ...element.endBinding,
              mode,
              fixedPoint: normalizeFixedPoint(element.endBinding.fixedPoint),
            }
          : null,
      };
      const focusPoint =
        mode === "inside"
          ? p
          : projectFixedPointOntoDiagonal(
              safeElement,
              p,
              boundElement,
              startOrEnd,
              elementsMap,
              DEFAULT_ZOOM,
            ) || p;
      const { fixedPoint } = calculateFixedPointForNonElbowArrowBinding(
        safeElement as NonDeleted<ExcalidrawArrowElement>,
        boundElement as NonDeleted<ExcalidrawBindableElement>,
        startOrEnd,
        elementsMap,
        focusPoint,
      );

      return {
        mode,
        elementId: binding.elementId,
        fixedPoint: normalizeFixedPoint(fixedPoint),
      };
    }

    console.error(
      `Could not repair binding for element "${boundElement?.id}" out of (${elementsMap?.size}) elements`,
    );
  } catch (error) {
    console.error("Error repairing binding:", error);
  }

  return null;
};

const BOUND_ELEMENT_TYPES: ReadonlySet<string> = new Set<BoundElement["type"]>([
  "arrow",
  "text",
]);

/**
 * Entries with a missing or unknown type are dropped rather than guessed, as
 * that could e.g. turn a free text into a container's label. The legacy
 * `boundElementIds` only held arrows, so its bare ids are restored as such.
 */
const restoreBoundElements = (
  boundElements: unknown,
  boundElementIds: unknown,
): BoundElement[] => {
  const isLegacy = boundElementIds != null;
  const value = isLegacy ? boundElementIds : boundElements;
  const entries = Array.isArray(value) ? value : value != null ? [value] : [];

  return entries.reduce<BoundElement[]>((acc, entry) => {
    if (isLegacy) {
      const id = restoreId(entry);
      if (id) {
        acc.push({ id, type: "arrow" });
      }
      return acc;
    }
    if (!isRecordLike(entry)) {
      return acc;
    }
    const id = restoreId(entry.id);
    const type =
      typeof entry.type === "string" ? entry.type.trim().toLowerCase() : "";
    if (id && BOUND_ELEMENT_TYPES.has(type)) {
      acc.push({ id, type: type as BoundElement["type"] });
    }
    return acc;
  }, []);
};

/**
 * Accepts a bare bound element id, which is then migrated like a legacy
 * binding (see `repairBinding`).
 */
const restorePointBinding = (binding: unknown): FixedPointBinding | null => {
  if (!isRecordLike(binding)) {
    const elementId = restoreId(binding);
    return elementId ? ({ elementId } as FixedPointBinding) : null;
  }

  const elementId = restoreId(binding.elementId);
  if (!elementId) {
    return null;
  }

  return {
    ...binding,
    elementId,
    // legacy bindings don't have a mode, so only repair a malformed one
    ...(binding.mode != null && {
      mode: restoreEnum(binding.mode, BIND_MODES, "inside"),
    }),
  } as FixedPointBinding;
};

// a record so that new arrowheads can't be missed
const ARROWHEADS_RECORD: Record<Arrowhead, true> = {
  arrow: true,
  bar: true,
  circle: true,
  circle_outline: true,
  triangle: true,
  triangle_outline: true,
  diamond: true,
  diamond_outline: true,
  cardinality_one: true,
  cardinality_many: true,
  cardinality_one_or_many: true,
  cardinality_exactly_one: true,
  cardinality_zero_or_one: true,
  cardinality_zero_or_many: true,
};
const ARROWHEADS = Object.keys(ARROWHEADS_RECORD) as Arrowhead[];

/** Empty and unknown arrowheads would be drawn as a generic one, so drop them. */
const restoreArrowhead = (arrowhead: unknown): Arrowhead | null => {
  const normalized =
    typeof arrowhead === "string"
      ? normalizeArrowhead(arrowhead as AnyArrowhead)
      : null;
  return normalized && ARROWHEADS.includes(normalized) ? normalized : null;
};

/**
 * A segment spans the arrow's points at `index - 1` and `index`, so it is
 * rebuilt from them rather than from its (possibly malformed) `start` and
 * `end`. The elbow arrow code also expects the segments to be unique, in
 * ascending order, and exactly horizontal or vertical, so a segment is kept
 * only where the arrow itself is.
 */
const restoreFixedSegments = (
  fixedSegments: unknown,
  points: readonly LocalPoint[],
): FixedSegment[] | null => {
  // the first and last segments can't be fixed
  if (!Array.isArray(fixedSegments) || points.length < 4) {
    return null;
  }

  const segments = new Map<number, FixedSegment>();
  for (const segment of fixedSegments) {
    const index = isRecordLike(segment) ? toFiniteNumber(segment.index) : null;
    if (
      index === null ||
      !Number.isInteger(index) ||
      index < 2 ||
      index >= points.length - 1 ||
      segments.has(index)
    ) {
      continue;
    }
    const start = points[index - 1];
    const end = points[index];
    // with the same tolerance the points are validated with, but snapped as
    // the elbow arrow code expects fixed segments to be exactly axis-aligned
    if (validateElbowPoints([start, end])) {
      const isVertical =
        Math.abs(end[0] - start[0]) <= Math.abs(end[1] - start[1]);
      segments.set(index, {
        start: pointFrom<LocalPoint>(start[0], start[1]),
        end: pointFrom<LocalPoint>(
          isVertical ? start[0] : end[0],
          isVertical ? end[1] : start[1],
        ),
        index,
      } as FixedSegment);
    }
  }

  return segments.size
    ? [...segments.values()].sort((a, b) => a.index - b.index)
    : null;
};

const restoreRoundness = (
  roundness: unknown,
  /** @deprecated */
  strokeSharpness: unknown,
  type: ExcalidrawElement["type"],
): ExcalidrawElement["roundness"] => {
  // any numeric type is kept, as newer versions may add algorithms
  const roundnessType = isRecordLike(roundness)
    ? toFiniteNumber(roundness.type)
    : toFiniteNumber(roundness);

  if (roundnessType !== null) {
    const value = isRecordLike(roundness)
      ? toFiniteNumber(roundness.value)
      : null;
    return {
      type: roundnessType,
      ...(value !== null && { value }),
    } as ExcalidrawElement["roundness"];
  }

  return strokeSharpness === "round"
    ? {
        // for old elements that would now use adaptive radius algo,
        // use legacy algo instead
        type: isUsingAdaptiveRadius(type)
          ? ROUNDNESS.LEGACY
          : ROUNDNESS.PROPORTIONAL_RADIUS,
      }
    : null;
};

const restoreImageScale = (scale: unknown): ExcalidrawImageElement["scale"] => {
  const [x, y] = Array.isArray(scale) ? scale.map(toFiniteNumber) : [];
  return x && y ? [x, y] : [1, 1];
};

const restoreImageCrop = (crop: unknown): ImageCrop | null => {
  if (!isRecordLike(crop)) {
    return null;
  }

  const x = toFiniteNumber(crop.x);
  const y = toFiniteNumber(crop.y);
  const width = toPositiveNumber(crop.width);
  const height = toPositiveNumber(crop.height);
  const naturalWidth = toPositiveNumber(crop.naturalWidth);
  const naturalHeight = toPositiveNumber(crop.naturalHeight);

  return x !== null &&
    y !== null &&
    width &&
    height &&
    naturalWidth &&
    naturalHeight
    ? { x, y, width, height, naturalWidth, naturalHeight }
    : null;
};

const restoreElementWithProperties = <
  T extends Required<Omit<ExcalidrawElement, "customData">> & {
    customData?: ExcalidrawElement["customData"];
    /** @deprecated */
    boundElementIds?: readonly ExcalidrawElement["id"][];
    /** @deprecated */
    strokeSharpness?: StrokeRoundness;
    /** @deprecated `movePoints()` option wrongly persisted on linear elements */
    moveMidPointsWithElement?: boolean | null;
  },
  K extends Pick<T, keyof Omit<Required<T>, keyof ExcalidrawElement>>,
>(
  element: T,
  extra: Pick<
    T,
    // This extra Pick<T, keyof K> ensure no excess properties are passed.
    // @ts-ignore TS complains here but type checks the call sites fine.
    keyof K
  > &
    Partial<Pick<ExcalidrawElement, "type" | "x" | "y" | "customData">>,
): T => {
  const base: Pick<T, keyof ExcalidrawElement> = {
    type: extra.type || element.type,
    // all elements must have version > 0 so getSceneVersion() will pick up
    // newly added elements
    version: Math.max(1, Math.round(toPositiveNumber(element.version) ?? 1)),
    versionNonce: toFiniteNumber(element.versionNonce) ?? 0,
    // invalid indices are regenerated by `syncInvalidIndices`
    index: typeof element.index === "string" ? element.index : null,
    isDeleted: restoreBoolean(element.isDeleted, false),
    id: restoreId(element.id) || randomId(),
    fillStyle: restoreEnum(
      element.fillStyle,
      FILL_STYLES,
      DEFAULT_ELEMENT_PROPS.fillStyle,
    ),
    strokeWidth:
      toPositiveNumber(element.strokeWidth) ??
      DEFAULT_ELEMENT_PROPS.strokeWidth,
    strokeStyle: restoreEnum(
      element.strokeStyle,
      STROKE_STYLES,
      DEFAULT_ELEMENT_PROPS.strokeStyle,
    ),
    roughness:
      toFiniteNumber(element.roughness) ?? DEFAULT_ELEMENT_PROPS.roughness,
    opacity: clamp(
      toFiniteNumber(element.opacity) ?? DEFAULT_ELEMENT_PROPS.opacity,
      0,
      100,
    ),
    angle: (toFiniteNumber(element.angle) ?? 0) as Radians,
    x: extra.x ?? toFiniteNumber(element.x) ?? 0,
    y: extra.y ?? toFiniteNumber(element.y) ?? 0,
    strokeColor:
      (typeof element.strokeColor === "string" && element.strokeColor) ||
      DEFAULT_ELEMENT_PROPS.strokeColor,
    backgroundColor:
      (typeof element.backgroundColor === "string" &&
        element.backgroundColor) ||
      DEFAULT_ELEMENT_PROPS.backgroundColor,
    width: toFiniteNumber(element.width) ?? 0,
    height: toFiniteNumber(element.height) ?? 0,
    seed: toFiniteNumber(element.seed) ?? 1,
    groupIds: Array.isArray(element.groupIds)
      ? element.groupIds.map(restoreId).filter((id) => id !== null)
      : [],
    frameId: restoreId(element.frameId),
    roundness: restoreRoundness(
      element.roundness,
      element.strokeSharpness,
      element.type,
    ),
    boundElements: restoreBoundElements(
      element.boundElements,
      element.boundElementIds,
    ),
    updated: toFiniteNumber(element.updated) ?? getUpdatedTimestamp(),
    created: toFiniteNumber(element.created),
    link:
      typeof element.link === "string" && element.link
        ? normalizeLink(element.link)
        : null,
    locked: restoreBoolean(element.locked, false),
  };

  if ("customData" in element || "customData" in extra) {
    base.customData =
      "customData" in extra ? extra.customData : element.customData;
  }

  const ret = {
    // spread the original element properties to not lose unknown ones
    // for forward-compatibility
    ...element,
    // normalized properties
    ...base,
    ...getNormalizedDimensions(base),
    ...extra,
  } as unknown as T;

  // strip legacy props (migrated in previous steps)
  delete ret.strokeSharpness;
  delete ret.boundElementIds;
  // not an element prop, but used to leak onto linear elements
  delete ret.moveMidPointsWithElement;

  return ret;
};

export const restoreElement = (
  /** element to be restored */
  element: Exclude<ExcalidrawElement, ExcalidrawSelectionElement>,
  /** all elements to be restored */
  targetElementsMap: Readonly<ElementsMap>,
  /** used for additional context */
  existingElementsMap: Readonly<ElementsMap> | null | undefined,
  opts?: {
    deleteInvisibleElements?: boolean;
  },
): typeof element | null => {
  element = { ...element };

  switch (element.type) {
    case "text":
      // temp fix: cleanup legacy obsidian-excalidraw attribute else it'll
      // conflict when porting between the apps
      delete (element as any).rawText;

      let fontSize: unknown = element.fontSize;
      let fontFamily: unknown = element.fontFamily;
      const legacyFont: unknown = (element as { font?: unknown }).font;
      if (typeof legacyFont === "string") {
        const [fontPx, _fontFamily = ""] = legacyFont.split(" ");
        fontSize = parseFloat(fontPx);
        fontFamily = getFontFamilyByName(_fontFamily);
      }
      const restoredFontSize = toPositiveNumber(fontSize) ?? DEFAULT_FONT_SIZE;
      const restoredFontFamily = (toFiniteNumber(fontFamily) ??
        (typeof fontFamily === "string"
          ? getFontFamilyByName(fontFamily)
          : DEFAULT_FONT_FAMILY)) as FontFamilyValues;
      // a label without `text` can still be recovered from its unwrapped
      // `originalText` (rewrapped when refreshing dimensions)
      const wrappedText = restoreString(element.text);
      const text = wrappedText || restoreString(element.originalText) || "";

      const lineHeight = (toPositiveNumber(element.lineHeight) ??
        restoreLineHeight({
          ...element,
          fontSize: restoredFontSize,
          fontFamily: restoredFontFamily,
          text,
          // the height spans the lines of `text` as it was wrapped, so it says
          // nothing about the line height of the unwrapped `originalText`
          height: wrappedText ? toFiniteNumber(element.height) ?? 0 : 0,
        })) as ExcalidrawTextElement["lineHeight"];
      element = restoreElementWithProperties(element, {
        fontSize: restoredFontSize,
        fontFamily: restoredFontFamily,
        text,
        textAlign: restoreEnum(
          element.textAlign,
          TEXT_ALIGNS,
          DEFAULT_TEXT_ALIGN,
        ),
        verticalAlign: restoreEnum(
          element.verticalAlign,
          VERTICAL_ALIGNS,
          DEFAULT_VERTICAL_ALIGN,
        ),
        containerId: restoreId(element.containerId),
        originalText: restoreString(element.originalText) || text,
        autoResize: restoreBoolean(element.autoResize, true),
        lineHeight,
        labelPosition: isFiniteNumber(element.labelPosition)
          ? clamp(element.labelPosition, 0, 1)
          : null,
        // only meaningful for sticky note labels; reconciled against the
        // container in `restoreStickyNotes` once bindings are repaired
        baseFontSize: isFiniteNumber(element.baseFontSize)
          ? normalizeStickyNoteFontSize(element.baseFontSize)
          : null,
      });

      // if empty text, mark as deleted. We keep in array
      // for data integrity purposes (collab etc.)
      if (opts?.deleteInvisibleElements && !text && !element.isDeleted) {
        // TODO: we should not do this since it breaks sync / versioning when we exchange / apply just deltas and restore the elements (deletion isn't recorded)
        element = { ...element, originalText: text, isDeleted: true };
        element = bumpVersion(element);
      }

      return element;
    case "freedraw": {
      const { points, pressures } = restoreFreedrawPoints(
        element.points,
        element.pressures,
      );

      // pressures are only usable with one per point, otherwise simulate them
      const hasPressures =
        points.length > 0 && pressures.length === points.length;

      return restoreElementWithProperties(element, {
        points,
        simulatePressure: hasPressures
          ? restoreBoolean(element.simulatePressure, false)
          : true,
        strokeOptions: restoreFreedrawStrokeOptions(element.strokeOptions),
        pressures: hasPressures ? pressures : [],
      });
    }
    case "image":
      return restoreElementWithProperties(element, {
        status: restoreEnum(element.status, IMAGE_STATUSES, "pending"),
        fileId: restoreId(element.fileId) as FileId | null,
        scale: restoreImageScale(element.scale),
        crop: restoreImageCrop(element.crop),
      });
    case "line":
    // @ts-ignore LEGACY type
    // eslint-disable-next-line no-fallthrough
    case "draw":
      const startArrowhead = restoreArrowhead(element.startArrowhead);
      const endArrowhead = restoreArrowhead(element.endArrowhead);
      let x = toFiniteNumber(element.x) ?? 0;
      let y = toFiniteNumber(element.y) ?? 0;
      let points = restoreLinearElementPoints(
        element.points,
        element.width,
        element.height,
      );

      if (points[0][0] !== 0 || points[0][1] !== 0) {
        ({ points, x, y } =
          LinearElementEditor.getNormalizeElementPointsAndCoords({
            ...element,
            points,
            x,
            y,
          } as ExcalidrawLinearElement));
      }

      const restoredLine = restoreElementWithProperties(element, {
        type: "line",
        startBinding: null,
        endBinding: null,
        startArrowhead,
        endArrowhead,
        points,
        x,
        y,
        ...(isLineElement(element)
          ? {
              polygon: isValidPolygon(points)
                ? restoreBoolean(element.polygon, false)
                : false,
            }
          : {}),
        ...getSizeFromPoints(points),
      });

      return handleOversizedLinearElements(restoredLine);
    case "arrow": {
      const startArrowhead = restoreArrowhead(element.startArrowhead);
      const endArrowhead =
        element.endArrowhead === undefined
          ? "arrow"
          : restoreArrowhead(element.endArrowhead);
      const x = toFiniteNumber(element.x) ?? 0;
      const y = toFiniteNumber(element.y) ?? 0;
      const elbowed = (element as ExcalidrawArrowElement).elbowed === true;
      const points = restoreLinearElementPoints(
        element.points,
        element.width,
        element.height,
      );
      const startBinding = restorePointBinding(element.startBinding);
      const endBinding = restorePointBinding(element.endBinding);

      const base = {
        type: element.type,
        startBinding,
        endBinding,
        startArrowhead,
        endArrowhead,
        points,
        x,
        y,
        elbowed,
        ...getSizeFromPoints(points),
      };

      // TODO: Separate arrow from linear element
      const restoredElement = elbowed
        ? restoreElementWithProperties(element as ExcalidrawElbowArrowElement, {
            ...base,
            elbowed: true,
            // rebuilt from the normalized points below
            fixedSegments: null,
            startIsSpecial: restoreBoolean(
              (element as ExcalidrawElbowArrowElement).startIsSpecial,
              null,
            ),
            endIsSpecial: restoreBoolean(
              (element as ExcalidrawElbowArrowElement).endIsSpecial,
              null,
            ),
          })
        : restoreElementWithProperties(element as ExcalidrawArrowElement, base);

      // legacy bindings are migrated from the arrow's geometry, so do it on
      // the restored arrow rather than on its (possibly malformed) input
      const arrowWithBindings = {
        ...restoredElement,
        startBinding: repairBinding(
          restoredElement,
          startBinding,
          targetElementsMap,
          existingElementsMap,
          "start",
        ),
        endBinding: repairBinding(
          restoredElement,
          endBinding,
          targetElementsMap,
          existingElementsMap,
          "end",
        ),
      };

      const normalizedArrow = {
        ...arrowWithBindings,
        ...LinearElementEditor.getNormalizeElementPointsAndCoords(
          arrowWithBindings,
        ),
      };

      return handleOversizedLinearElements(
        isElbowArrow(normalizedArrow)
          ? {
              ...normalizedArrow,
              fixedSegments: restoreFixedSegments(
                (element as ExcalidrawElbowArrowElement).fixedSegments,
                normalizedArrow.points,
              ),
            }
          : normalizedArrow,
      );
    }

    // generic elements
    case "ellipse":
    case "rectangle":
    case "diamond":
    case "iframe":
    case "embeddable":
      return restoreElementWithProperties(element, {});
    case "stickynote":
      return normalizeStickyNote(
        restoreElementWithProperties(element, {
          baseHeight:
            toPositiveNumber(element.baseHeight) ??
            toPositiveNumber(
              (element as typeof element & { maxHeight?: unknown }).maxHeight,
            ) ??
            toFiniteNumber(element.height) ??
            0,
        }),
      );
    case "magicframe":
    case "frame":
      return restoreElementWithProperties(element, {
        name: restoreString(element.name),
      });

    // Don't use default case so as to catch a missing an element type case.
    // We also don't want to throw, but instead return void so we filter
    // out these unsupported elements from the restored array.
  }
  return null;
};

/** `null` if the element can't be bound to another one */
const getBoundElementType = (
  boundElement: ExcalidrawElement | undefined,
): BoundElement["type"] | null =>
  isTextElement(boundElement ?? null)
    ? "text"
    : isArrowElement(boundElement)
    ? "arrow"
    : null;

/**
 * Repairs container element's boundElements array by removing duplicates and
 * fixing containerId of bound elements if not present. Also removes any
 * bound elements that do not exist in the elements array, or whose type
 * doesn't match the binding's (a label's binding is re-added from its
 * `containerId` in `repairBoundElement`).
 *
 * NOTE mutates elements.
 */
const repairContainerElement = (
  container: Mutable<ExcalidrawElement>,
  elementsMap: Map<string, Mutable<ExcalidrawElement>>,
) => {
  if (container.boundElements) {
    // copy because we're not cloning on restore, and we don't want to mutate upstream
    const boundElements = container.boundElements.slice();

    // dedupe bindings & fix boundElement.containerId if not set already
    const boundIds = new Set<ExcalidrawElement["id"]>();
    container.boundElements = boundElements.reduce(
      (
        acc: Mutable<NonNullable<ExcalidrawElement["boundElements"]>>,
        binding,
      ) => {
        const boundElement = elementsMap.get(binding.id);
        if (
          boundElement &&
          !boundIds.has(binding.id) &&
          getBoundElementType(boundElement) === binding.type
        ) {
          boundIds.add(binding.id);

          if (
            boundElement.isDeleted ||
            (binding.type === "text" && !isTextBindableContainer(container))
          ) {
            return acc;
          }

          acc.push(binding);

          if (
            isTextElement(boundElement) &&
            // being slightly conservative here, preserving existing containerId
            // if defined, lest boundElements is stale
            !boundElement.containerId
          ) {
            Object.assign(boundElement, {
              containerId: container.id,
              angle: isArrowElement(container) ? 0 : container.angle,
            });
          }
        }
        return acc;
      },
      [],
    );
  }
};

/**
 * Repairs target bound element's container's boundElements array,
 * or removes contaienrId if container does not exist.
 *
 * NOTE mutates elements.
 */
const repairBoundElement = (
  boundElement: Mutable<ExcalidrawTextElement>,
  elementsMap: Map<string, Mutable<ExcalidrawElement>>,
) => {
  const containerCandidate = boundElement.containerId
    ? elementsMap.get(boundElement.containerId)
    : null;
  // e.g. a label pointing to a freedraw or another text element
  const container = isTextBindableContainer(containerCandidate ?? null)
    ? containerCandidate
    : null;

  (boundElement as Mutable<typeof boundElement>).angle = (
    isArrowElement(container) ? 0 : container?.angle ?? 0
  ) as Radians;

  if (!container) {
    boundElement.containerId = null;
    return;
  }

  if (boundElement.isDeleted) {
    return;
  }

  if (
    container.boundElements &&
    // a binding of the wrong type is dropped in `repairContainerElement`
    !container.boundElements.find(
      (binding) => binding.id === boundElement.id && binding.type === "text",
    )
  ) {
    // copy because we're not cloning on restore, and we don't want to mutate upstream
    const boundElements = (
      container.boundElements || (container.boundElements = [])
    ).slice();
    boundElements.push({ type: "text", id: boundElement.id });
    container.boundElements = boundElements;
  }
};

/**
 * Places bound text directly after its container while preserving the
 * container's fractional index.
 *
 * NOTE mutates indices of reordered bound text elements.
 */
const repairBoundTextElementOrder = (
  elements: readonly ExcalidrawElement[],
) => {
  const originalPositions = new Map(
    elements.map((element, index) => [element.id, index]),
  );
  const normalizedElements = normalizeBoundElementsOrder(elements);
  const reorderedBoundTextElements = normalizedElements.filter(
    (element, index) =>
      isTextElement(element) &&
      element.containerId &&
      originalPositions.get(element.id) !== index,
  );

  return reorderedBoundTextElements.length
    ? syncMovedIndices(
        normalizedElements,
        arrayToMap(reorderedBoundTextElements),
      )
    : normalizedElements;
};

/** e.g. text created programmatically, whose size follows from its content */
const isUnsizedText = (element: ExcalidrawElement | null) =>
  isTextElement(element) &&
  !!element.text &&
  (!element.width || !element.height);

/**
 * Sizes text elements restored without a size (or recovered from
 * `originalText`) from their content, and all of them with
 * `refreshDimensions`. Labels are wrapped to and positioned in
 * their container, and sticky notes are refitted together with their label.
 *
 * Runs once bindings are repaired, as the layout follows from them.
 *
 * NOTE mutates elements.
 */
const restoreTextDimensions = (
  elements: readonly ExcalidrawElement[],
  elementsMap: ElementsMap,
  opts: {
    refreshDimensions: boolean;
    /** text recovered from `originalText`, which isn't wrapped nor measured */
    recoveredTexts: ReadonlySet<ExcalidrawElement>;
  },
) => {
  const needsSizing = (element: ExcalidrawElement | null) =>
    isUnsizedText(element) || (!!element && opts.recoveredTexts.has(element));

  for (const element of elements) {
    if (element.isDeleted) {
      continue;
    }
    try {
      if (isStickyNoteElement(element)) {
        const textElement = getBoundTextElement(element, elementsMap);
        if (opts.refreshDimensions || needsSizing(textElement)) {
          const layout = getStickyNoteLayout(element, textElement);
          Object.assign(element, layout.container);
          if (textElement && layout.text) {
            Object.assign(textElement, layout.text);
          }
        }
      } else if (
        isTextElement(element) &&
        // refitted together with their note above
        !isStickyNoteBoundText(element, elementsMap)
      ) {
        const containerCandidate = getContainerElement(element, elementsMap);
        // bindings may not have been repaired
        const container = isTextBindableContainer(containerCandidate)
          ? containerCandidate
          : null;
        if (needsSizing(element)) {
          // without a width there's nothing to wrap free text to, so it grows
          // with its content instead
          if (!element.width) {
            Object.assign(element, { autoResize: true });
          }
          Object.assign(
            element,
            refreshTextDimensions(
              element,
              container,
              elementsMap,
              element.originalText,
            ),
          );
          if (container) {
            const label = element as ExcalidrawTextElementWithContainer;
            // grow the container to fit, as when editing the label. Only for
            // its own label, lest a stale `containerId` resizes another shape
            if (getBoundTextElementId(container) === label.id) {
              Object.assign(
                container,
                getContainerUpdatesToFitBoundText(container, label, label),
              );
            }
            Object.assign(
              element,
              computeBoundTextPosition(container, label, elementsMap),
            );
          }
        } else if (opts.refreshDimensions) {
          Object.assign(
            element,
            refreshTextDimensions(element, container, elementsMap),
          );
        }
      }
    } catch (error) {
      // e.g. no canvas to measure with. The restored dimensions are still
      // usable, so keep the element
      console.error("Error refreshing text dimensions:", error);
    }
  }
};

/**
 * Remove an element's frameId if its containing frame is non-existent, or
 * not a frame
 *
 * NOTE mutates elements.
 */
const repairFrameMembership = (
  element: Mutable<ExcalidrawElement>,
  elementsMap: Map<string, Mutable<ExcalidrawElement>>,
) => {
  if (element.frameId) {
    const containingFrame = elementsMap.get(element.frameId);

    if (!containingFrame || !isFrameLikeElement(containingFrame)) {
      element.frameId = null;
    }
  }
};

/**
 * Sticky note invariants that need both halves of the pair present, so they
 * run after binding repair. Mutates elements (like the repair helpers).
 * - a label's `baseFontSize` is meaningful only while bound to a sticky note:
 *   seeded from `fontSize` when missing, cleared everywhere else
 * - a sticky label's stroke is never transparent (it is the visible text)
 * - a note's stroke — its ink, which the footer paints with — equals its label's
 *
 * The note and its label are refitted in `restoreTextDimensions`.
 */
const restoreStickyNotes = (
  elements: readonly ExcalidrawElement[],
  elementsMap: ElementsMap,
) => {
  for (const element of elements) {
    if (!isTextElement(element) || element.isDeleted) {
      continue;
    }
    if (isStickyNoteBoundText(element, elementsMap)) {
      const container = elementsMap.get(element.containerId!);
      // one ink per note: a transparent label takes the note's color;
      // otherwise the label — the visible text — wins over a note that
      // drifted (edit-mode coloring on older builds)
      const strokeColor = normalizeStickyNoteStrokeColor(
        isTransparent(element.strokeColor)
          ? container?.strokeColor
          : element.strokeColor,
      );
      Object.assign(element, {
        baseFontSize: normalizeStickyNoteFontSize(
          element.baseFontSize ?? element.fontSize,
        ),
        strokeColor,
      });
      if (container && container.strokeColor !== strokeColor) {
        Object.assign(container, { strokeColor });
      }
    } else if (element.baseFontSize != null) {
      Object.assign(element, { baseFontSize: null });
    }
  }
};

const ELEMENT_TYPES: ReadonlySet<string> = new Set<
  ExcalidrawElement["type"] | "draw"
>([
  "text",
  "freedraw",
  "image",
  "line",
  // legacy
  "draw",
  "arrow",
  "ellipse",
  "rectangle",
  "diamond",
  "iframe",
  "embeddable",
  "stickynote",
  "magicframe",
  "frame",
  "selection",
]);

const ARROW_ONLY_PROPS = [
  "startArrowhead",
  "endArrowhead",
  "startBinding",
  "endBinding",
  "elbowed",
] as const;

/**
 * Restores a missing or malformed element type, inferring it from the
 * properties specific to each type where needed. Returns `null` if nothing
 * hints at what the element was.
 *
 * Unknown type names are kept (and dropped by `restoreElement`), as they may
 * come from a newer version and must not be converted to something else.
 */
const restoreElementType = (
  element: Record<string, unknown>,
): string | null => {
  const type =
    typeof element.type === "string" ? element.type.trim().toLowerCase() : "";
  if (type) {
    return ELEMENT_TYPES.has(type) ? type : (element.type as string);
  }
  if (typeof element.text === "string" || "originalText" in element) {
    return "text";
  }
  if ("fileId" in element) {
    return "image";
  }
  if (Array.isArray(element.points)) {
    if ("pressures" in element || "simulatePressure" in element) {
      return "freedraw";
    }
    return ARROW_ONLY_PROPS.some((prop) => element[prop] != null)
      ? "arrow"
      : "line";
  }
  if (toFiniteNumber(element.width) || toFiniteNumber(element.height)) {
    return "rectangle";
  }
  return null;
};

const isInvisibleElement = (
  restoredElement: ExcalidrawElement,
  sourceElement: ExcalidrawElement,
) => {
  // text is sized from its content once all elements are restored (see
  // `restoreTextDimensions`)
  if (isTextElement(restoredElement) && restoredElement.text) {
    return false;
  }
  // linear elements with fewer than 2 points are rebuilt from their size
  // (see `restoreLinearElementPoints`), which leaves nothing to show when they
  // don't have a size either
  if (
    isLinearElement(restoredElement) &&
    !restoredElement.width &&
    !restoredElement.height &&
    restorePoints((sourceElement as Partial<ExcalidrawLinearElement>).points)
      .length < 2
  ) {
    return true;
  }
  return isInvisiblySmallElement(restoredElement);
};

export const restoreElements = <T extends ExcalidrawElement>(
  targetElements: readonly T[] | undefined | null,
  /** used for additional context (e.g. repairing arrow bindings) */
  existingElements: Readonly<ElementsMapOrArray> | null | undefined,
  opts?:
    | {
        refreshDimensions?: boolean;
        repairBindings?: boolean;
        deleteInvisibleElements?: boolean;
      }
    | undefined,
): CombineBrandsIfNeeded<T, OrderedExcalidrawElement> => {
  // entries that aren't objects carry nothing to restore an element from
  const sourceElements = (
    Array.isArray(targetElements) ? (targetElements as unknown[]) : []
  ).reduce<T[]>((acc, element) => {
    if (isRecordLike(element)) {
      const type = restoreElementType(element);
      if (type) {
        acc.push((type === element.type ? element : { ...element, type }) as T);
      }
    }
    return acc;
  }, []);

  // used to detect duplicate top-level element ids
  const existingIds = new Set<string>();
  // keyed by the restored ids so that references resolve the same way.
  // Id-less elements get a random id on restore, so nothing can reference them
  const targetElementsMap: ElementsMap = new Map();
  const existingElementsMap = existingElements
    ? arrayToMap(existingElements)
    : null;

  const migrateElement = (element: T): ExcalidrawElement | null => {
    try {
      return restoreElement(
        element as Exclude<T, ExcalidrawSelectionElement>,
        targetElementsMap,
        existingElementsMap,
        { deleteInvisibleElements: opts?.deleteInvisibleElements },
      );
    } catch (error) {
      console.error("Error restoring element:", error);
      return null;
    }
  };

  // arrows are restored last, so that legacy bindings are migrated against
  // the restored (coerced) geometry of the elements they bind to
  const migratedElements = new Map<T, ExcalidrawElement | null>();
  // the first element with an id keeps it (duplicates get a random id below),
  // so references must resolve to that one
  const claimedIds = new Set<string>();
  for (const element of sourceElements) {
    // filtering out selection, which is legacy, no longer kept in elements,
    // and causing issues if retained
    if (element.type === "selection") {
      continue;
    }
    const id = restoreId(element.id);
    if (element.type === "arrow") {
      if (id) {
        claimedIds.add(id);
      }
      continue;
    }
    const migratedElement = migrateElement(element);
    migratedElements.set(element, migratedElement);
    if (migratedElement && id && !claimedIds.has(id)) {
      claimedIds.add(id);
      targetElementsMap.set(id, migratedElement);
    }
  }

  const recoveredTexts = new Set<ExcalidrawElement>();
  const restoredElements = syncInvalidIndices(
    sourceElements.reduce((elements, element) => {
      if (element.type === "selection") {
        return elements;
      }
      let migratedElement = migratedElements.has(element)
        ? migratedElements.get(element)!
        : migrateElement(element);
      if (migratedElement) {
        const localElement = existingElementsMap?.get(migratedElement.id);

        const shouldMarkAsDeleted =
          opts?.deleteInvisibleElements &&
          isInvisibleElement(migratedElement, element);

        if (shouldMarkAsDeleted) {
          migratedElement = bumpVersion(migratedElement, localElement?.version);
        }

        if (shouldMarkAsDeleted) {
          migratedElement = { ...migratedElement, isDeleted: true };
        }

        if (existingIds.has(migratedElement.id)) {
          migratedElement = { ...migratedElement, id: randomId() };
        }
        existingIds.add(migratedElement.id);

        // recovered from `originalText`, so sized in `restoreTextDimensions`
        if (
          isTextElement(migratedElement) &&
          migratedElement.text &&
          !restoreString((element as { text?: unknown }).text)
        ) {
          recoveredTexts.add(migratedElement);
        }

        elements.push(migratedElement);
      }

      return elements;
    }, [] as ExcalidrawElement[]),
  );

  const restoredElementsMap = arrayToMap(restoredElements);

  if (!opts?.repairBindings) {
    restoreTextDimensions(restoredElements, restoredElementsMap, {
      refreshDimensions: false,
      recoveredTexts,
    });
    return restoredElements as CombineBrandsIfNeeded<
      T,
      OrderedExcalidrawElement
    >;
  }

  // repair binding. Mutates elements.
  // Labels go first, so that invalid `containerId`s are cleared before
  // containers claim their unbound labels
  for (const element of restoredElements) {
    if (isTextElement(element) && element.containerId) {
      repairBoundElement(element, restoredElementsMap);
    }
  }
  for (const element of restoredElements) {
    if (element.frameId) {
      repairFrameMembership(element, restoredElementsMap);
    }

    if (
      element.boundElements &&
      !(isTextElement(element) && element.containerId)
    ) {
      repairContainerElement(element, restoredElementsMap);
    }

    if (isLinearElement(element)) {
      if (
        element.startBinding &&
        (!restoredElementsMap.has(element.startBinding.elementId) ||
          !isArrowElement(element))
      ) {
        (element as Mutable<ExcalidrawLinearElement>).startBinding = null;
      }
      if (
        element.endBinding &&
        (!restoredElementsMap.has(element.endBinding.elementId) ||
          !isArrowElement(element))
      ) {
        (element as Mutable<ExcalidrawLinearElement>).endBinding = null;
      }
    }
  }

  restoreStickyNotes(restoredElements, restoredElementsMap);
  restoreTextDimensions(restoredElements, restoredElementsMap, {
    refreshDimensions: !!opts.refreshDimensions,
    recoveredTexts,
  });

  const repairedElements = repairBoundTextElementOrder(restoredElements);

  // NOTE (mtolmacs): Temporary fix for invalid/self-bound elbow arrows
  // Need to iterate again so we have attached text nodes in elementsMap
  return repairedElements.map((element) => {
    if (
      isElbowArrow(element) &&
      !isArrowBoundToElement(element) &&
      !validateElbowPoints(element.points)
    ) {
      return {
        ...element,
        ...updateElbowArrowPoints(
          element,
          restoredElementsMap as NonDeletedSceneElementsMap,
          {
            points: [
              pointFrom<LocalPoint>(0, 0),
              element.points[element.points.length - 1],
            ],
          },
        ),
        index: element.index,
      };
    }

    if (
      isElbowArrow(element) &&
      element.startBinding &&
      element.endBinding &&
      element.startBinding.elementId === element.endBinding.elementId &&
      element.points.length > 1 &&
      element.points.some(
        ([rx, ry]) => Math.abs(rx) > 1e6 || Math.abs(ry) > 1e6,
      )
    ) {
      console.error("Fixing self-bound elbow arrow", element.id);
      const boundElement = restoredElementsMap.get(
        element.startBinding.elementId,
      );
      if (!boundElement) {
        console.error(
          "Bound element not found",
          element.startBinding.elementId,
        );
        return element;
      }

      return {
        ...element,
        x: boundElement.x + boundElement.width / 2,
        y: boundElement.y - 5,
        width: boundElement.width,
        height: boundElement.height,
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(0, -10),
          pointFrom<LocalPoint>(boundElement.width / 2 + 5, -10),
          pointFrom<LocalPoint>(
            boundElement.width / 2 + 5,
            boundElement.height / 2 + 5,
          ),
        ],
      };
    }

    return element;
  }) as CombineBrandsIfNeeded<T, OrderedExcalidrawElement>;
};

/**
 * When replacing elements that may exist locally, this bumps their versions
 * to the local version + 1. Mainly for later reconciliation to work properly.
 *
 * See https://github.com/excalidraw/excalidraw/issues/3795
 *
 * Generally use this on editor boundaries (importing from file etc.), though
 * it does not apply universally (e.g. we don't want to do this for collab
 * updates).
 */
export const bumpElementVersions = <T extends ExcalidrawElement>(
  targetElements: readonly T[],
  localElements: Readonly<ElementsMapOrArray> | null | undefined,
) => {
  const localElementsMap = localElements ? arrayToMap(localElements) : null;

  return targetElements.map((element) => {
    const localElement = localElementsMap?.get(element.id);

    if (
      localElement &&
      (localElement.version > element.version ||
        // same versions but different versionNonce means different edits
        // (this often means the element was bumped during restore e.g. due
        // to re-indexing, and the original element was modified elsewhere
        // and supplied as localElements)
        (localElement.version === element.version &&
          localElement.versionNonce !== element.versionNonce))
    ) {
      return bumpVersion(element, localElement.version);
    }
    return element;
  });
};

const coalesceAppStateValue = <
  T extends keyof ReturnType<typeof getDefaultAppState>,
>(
  key: T,
  appState: Exclude<ImportedDataState["appState"], null | undefined>,
  defaultAppState: ReturnType<typeof getDefaultAppState>,
) => {
  const value = appState[key];
  // NOTE the value! assertion is needed in TS 4.5.5 (fixed in newer versions)
  return value !== undefined ? value! : defaultAppState[key];
};

const LegacyAppStateMigrations: {
  [K in keyof LegacyAppState]: (
    ImportedDataState: Exclude<ImportedDataState["appState"], null | undefined>,
    defaultAppState: ReturnType<typeof getDefaultAppState>,
  ) => [LegacyAppState[K][1], AppState[LegacyAppState[K][1]]];
} = {
  isSidebarDocked: (appState, defaultAppState) => {
    return [
      "defaultSidebarDockedPreference",
      appState.isSidebarDocked ??
        coalesceAppStateValue(
          "defaultSidebarDockedPreference",
          appState,
          defaultAppState,
        ),
    ];
  },
};

const restoreColorTopPicksList = (value: unknown): readonly string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  // keyed by normalized color value so notation variants (`#fff` vs
  // `#ffffff` vs `white`) dedupe, while the value keeps the original
  // notation — normalizing the output would break e.g. `transparent`
  // (→ `#00000000`), which the picker matches by literal value
  const colors = new Map<string, string>();
  for (const color of value) {
    if (typeof color !== "string") {
      continue;
    }
    const normalized = colorToHex(color) ?? color.toLowerCase();
    if (!colors.has(normalized)) {
      colors.set(normalized, color);
    }
    // the strip layout fits exactly this many slots — longer lists (hostile
    // or hand-edited storage) would overflow the properties island
    if (colors.size >= COLOR_TOP_PICKS_SLOTS) {
      break;
    }
  }
  return colors.size ? [...colors.values()] : null;
};

const restoreFontTopPicks = (
  value: unknown,
): readonly FontFamilyValues[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const fontFamilies = new Set<FontFamilyValues>();
  for (const fontFamily of value) {
    const metadata =
      typeof fontFamily === "number" ? FONT_METADATA[fontFamily] : undefined;
    // only families the font picker lists (no internal or fallback fonts)
    if (!metadata || metadata.private || metadata.fallback) {
      continue;
    }
    fontFamilies.add(fontFamily as FontFamilyValues);
    if (fontFamilies.size >= FONT_TOP_PICKS_SLOTS) {
      break;
    }
  }
  return fontFamilies.size ? [...fontFamilies] : null;
};

export const restoreAppState = (
  appState: ImportedDataState["appState"],
  localAppState: Partial<AppState> | null | undefined,
): RestoredAppState => {
  appState = appState || {};
  const defaultAppState = getDefaultAppState();
  const nextAppState = {} as typeof defaultAppState;

  // first, migrate all legacy AppState properties to new ones. We do it
  // in one go before migrate the rest of the properties in case the new ones
  // depend on checking any other key (i.e. they are coupled)
  for (const legacyKey of Object.keys(
    LegacyAppStateMigrations,
  ) as (keyof typeof LegacyAppStateMigrations)[]) {
    if (legacyKey in appState) {
      const [nextKey, nextValue] = LegacyAppStateMigrations[legacyKey](
        appState,
        defaultAppState,
      );
      (nextAppState as any)[nextKey] = nextValue;
    }
  }

  for (const [key, defaultValue] of Object.entries(defaultAppState) as [
    keyof typeof defaultAppState,
    any,
  ][]) {
    // if AppState contains a legacy key, prefer that one and migrate its
    // value to the new one
    const suppliedValue = appState[key];

    const localValue = localAppState ? localAppState[key] : undefined;
    (nextAppState as any)[key] =
      suppliedValue !== undefined
        ? suppliedValue
        : localValue !== undefined
        ? localValue
        : defaultValue;
  }

  const boxSelectionMode =
    appState.boxSelectionMode ?? localAppState?.boxSelectionMode;
  if (boxSelectionMode !== undefined) {
    nextAppState.boxSelectionMode = boxSelectionMode;
  }

  // drop malformed persisted custom top picks (imported data is untrusted)
  nextAppState.colorTopPicks = {
    elementStroke: restoreColorTopPicksList(
      nextAppState.colorTopPicks?.elementStroke,
    ),
    elementBackground: restoreColorTopPicksList(
      nextAppState.colorTopPicks?.elementBackground,
    ),
    bucketFill: restoreColorTopPicksList(
      nextAppState.colorTopPicks?.bucketFill,
    ),
    stickyNoteStroke: restoreColorTopPicksList(
      nextAppState.colorTopPicks?.stickyNoteStroke,
    ),
    stickyNoteBackground: restoreColorTopPicksList(
      nextAppState.colorTopPicks?.stickyNoteBackground,
    ),
  };
  nextAppState.fontTopPicks = restoreFontTopPicks(nextAppState.fontTopPicks);

  // legacy
  if ((appState as any).currentItemStrokeWidth !== undefined) {
    nextAppState.currentItemStrokeWidthKey =
      getStrokeWidthKey((appState as any).currentItemStrokeWidth) ??
      defaultAppState.currentItemStrokeWidthKey;
  }

  return {
    ...nextAppState,
    cursorButton: localAppState?.cursorButton || "up",
    // reset on fresh restore so as to hide the UI button if penMode not active
    penDetected:
      localAppState?.penDetected ??
      (appState.penMode ? appState.penDetected ?? false : false),
    activeTool: {
      ...updateActiveTool(
        defaultAppState,
        nextAppState.activeTool.type &&
          AllowedExcalidrawActiveTools[nextAppState.activeTool.type]
          ? nextAppState.activeTool
          : { type: "selection" },
      ),
      lastActiveTool: null,
      locked: nextAppState.activeTool.locked ?? false,
    },
    // the viewport is untrusted input, and a non-finite value here leaves the
    // canvas unrenderable with no way for the user to recover
    scrollX: toFiniteNumber(nextAppState.scrollX) ?? defaultAppState.scrollX,
    scrollY: toFiniteNumber(nextAppState.scrollY) ?? defaultAppState.scrollY,
    // Migrates from previous version where appState.zoom was a number
    zoom: {
      // `getNormalizedZoom` clamps with Math.min/Math.max, which pass NaN
      // straight through, so the value has to be checked before it gets there
      value: getNormalizedZoom(
        toFiniteNumber(appState.zoom) ??
          toFiniteNumber(appState.zoom?.value) ??
          defaultAppState.zoom.value,
      ),
    },
    openSidebar:
      // string (legacy)
      typeof (appState.openSidebar as any as string) === "string"
        ? { name: DEFAULT_SIDEBAR.name }
        : nextAppState.openSidebar,
    gridSize: getNormalizedGridSize(
      isFiniteNumber(appState.gridSize) ? appState.gridSize : DEFAULT_GRID_SIZE,
    ),
    gridStep: getNormalizedGridStep(
      isFiniteNumber(appState.gridStep) ? appState.gridStep : DEFAULT_GRID_STEP,
    ),
    currentItemStickynoteStrokeColor: normalizeStickyNoteStrokeColor(
      nextAppState.currentItemStickynoteStrokeColor,
    ),
    currentItemStickynoteBackgroundColor: normalizeStickyNoteBackgroundColor(
      nextAppState.currentItemStickynoteBackgroundColor,
    ),
    editingFrame: null,
  };
};

const restoreLibraryItem = (libraryItem: LibraryItem): LibraryItem | null => {
  const elements = getNonDeletedElements(
    restoreElements(libraryItem.elements, null),
  );
  return elements.length ? { ...libraryItem, elements } : null;
};

export const restoreLibraryItems = (
  libraryItems: ImportedDataState["libraryItems"] = [],
  defaultStatus: LibraryItem["status"],
) => {
  const restoredItems: LibraryItem[] = [];
  for (const item of Array.isArray(libraryItems) ? libraryItems : []) {
    if (!item || typeof item !== "object") {
      continue;
    }
    // migrate older libraries
    if (Array.isArray(item)) {
      const restoredItem = restoreLibraryItem({
        status: defaultStatus,
        elements: item,
        id: randomId(),
        created: Date.now(),
      });
      if (restoredItem) {
        restoredItems.push(restoredItem);
      }
    } else {
      const _item = item as MarkOptional<
        LibraryItem,
        "id" | "status" | "created"
      >;
      const restoredItem = restoreLibraryItem({
        ..._item,
        id: _item.id || randomId(),
        status: _item.status || defaultStatus,
        created: _item.created || Date.now(),
      });
      if (restoredItem) {
        restoredItems.push(restoredItem);
      }
    }
  }
  return restoredItems;
};
