import {
  DEFAULT_ELEMENT_PROPS,
  DEFAULT_STICKY_NOTE_BG,
  MIN_FONT_SIZE,
  arrayToMap,
  STICKY_NOTE_BODY_INSET_Y,
  STICKY_NOTE_FALLBACK_FONT_SIZE,
  STICKY_NOTE_FOOTER,
  STICKY_NOTE_FONT_STEP,
  STICKY_NOTE_MAX_FONT_SIZE,
  STICKY_NOTE_MIN_SIZE,
  STICKY_NOTE_MIN_FONT_SIZE,
  STICKY_NOTE_PADDING,
  STICKY_NOTE_SHADOW_OFFSET,
  getFontString,
  getLineHeight,
  isTransparent,
  seededRandom,
} from "@excalidraw/common";

import { clamp } from "@excalidraw/math";

import { updateBoundElements } from "./binding";
import { newElementWith } from "./mutateElement";
import { getPositionAfterHeightChange } from "./sizeHelpers";
import { computeBoundTextPosition, getBoundTextElement } from "./textElement";
import { measureText } from "./textMeasurements";
import { wrapText } from "./textWrapping";
import { isStickyNoteElement, isTextElement } from "./typeChecks";

import type { Scene } from "./Scene";
import type { VerticalResizeAnchor } from "./sizeHelpers";
import type { TransformHandleDirection } from "./transformHandles";
import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawStickyNoteElement,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
  NonDeletedExcalidrawElement,
} from "./types";

export type StickyNoteRenderPoint = {
  x: number;
  y: number;
};

export type StickyNotePathCommand =
  | {
      type: "move";
      point: StickyNoteRenderPoint;
    }
  | {
      type: "line";
      point: StickyNoteRenderPoint;
    }
  | {
      type: "quadratic";
      control: StickyNoteRenderPoint;
      point: StickyNoteRenderPoint;
    };

const STICKY_NOTE_RENDER_ROUGHNESS = [0, 1.5, 8] as const;
const STICKY_NOTE_CORNER_RADIUS_RATIO = 0.04;
const STICKY_NOTE_MAX_CORNER_RADIUS = 16;

export const normalizeStickyNoteStrokeColor = (
  strokeColor: string | null | undefined,
) => {
  return !strokeColor || isTransparent(strokeColor)
    ? DEFAULT_ELEMENT_PROPS.strokeColor
    : strokeColor;
};

export const normalizeStickyNoteBackgroundColor = (
  backgroundColor: string | null | undefined,
) => {
  return !backgroundColor || isTransparent(backgroundColor)
    ? DEFAULT_STICKY_NOTE_BG
    : backgroundColor;
};

/**
 * The update that applies a picked color to an element under the sticky
 * note policy: a note is always filled and its label — the visible text,
 * which the note's own `strokeColor` seeds — never goes transparent. Every
 * color surface (actions, both eyedroppers, paste styles, bind) routes
 * through this instead of re-deriving the rule.
 */
/**
 * The element a color pick on `element` lands on. A note's label has no fill
 * of its own, so a background pick on the label — the styles panel while
 * editing it — goes to the note; everything else colors itself.
 */
export const getColorTargetElement = (
  element: ExcalidrawElement,
  property: "strokeColor" | "backgroundColor",
  elementsMap: ElementsMap,
): ExcalidrawElement => {
  if (
    property === "backgroundColor" &&
    isTextElement(element) &&
    isStickyNoteBoundText(element, elementsMap)
  ) {
    return elementsMap.get(element.containerId!) ?? element;
  }
  return element;
};

export const getColorUpdate = (
  element: ExcalidrawElement,
  property: "strokeColor" | "backgroundColor",
  color: string,
  elementsMap: ElementsMap,
): { strokeColor: string } | { backgroundColor: string } => {
  if (isStickyNoteElement(element)) {
    return property === "backgroundColor"
      ? { backgroundColor: normalizeStickyNoteBackgroundColor(color) }
      : { strokeColor: normalizeStickyNoteStrokeColor(color) };
  }
  if (
    property === "strokeColor" &&
    isTextElement(element) &&
    isStickyNoteBoundText(element, elementsMap)
  ) {
    const container = elementsMap.get(element.containerId!);
    return {
      strokeColor: isTransparent(color)
        ? normalizeStickyNoteStrokeColor(container?.strokeColor)
        : color,
    };
  }
  return property === "backgroundColor"
    ? { backgroundColor: color }
    : { strokeColor: color };
};

/**
 * A note's ink is one color: the container's `strokeColor` — the seed for a
 * new label and what the creation-date footer paints with — and its label's.
 * Run after a property write to copy the side that changed onto the other;
 * when both changed, or neither (data that drifted), the label wins: it is
 * the text the user styled. A transparent label always takes the note's
 * color. Returns the same array when nothing needs to change.
 */
export const syncStickyNoteInk = <T extends ExcalidrawElement>(
  elements: readonly T[],
  prevElementsMap: ElementsMap,
): readonly T[] => {
  const elementsMap = arrayToMap(elements);
  const inkById = new Map<string, string>();
  for (const container of elements) {
    if (!isStickyNoteElement(container) || container.isDeleted) {
      continue;
    }
    const label = getBoundTextElement(container, elementsMap);
    if (!label || label.strokeColor === container.strokeColor) {
      continue;
    }
    const containerChanged =
      prevElementsMap.get(container.id)?.strokeColor !== container.strokeColor;
    const labelChanged =
      prevElementsMap.get(label.id)?.strokeColor !== label.strokeColor;
    if (
      isTransparent(label.strokeColor) ||
      (containerChanged && !labelChanged)
    ) {
      inkById.set(
        label.id,
        normalizeStickyNoteStrokeColor(container.strokeColor),
      );
    } else {
      inkById.set(
        container.id,
        normalizeStickyNoteStrokeColor(label.strokeColor),
      );
    }
  }
  if (!inkById.size) {
    return elements;
  }
  return elements.map((element) => {
    const strokeColor = inkById.get(element.id);
    return strokeColor === undefined
      ? element
      : (newElementWith(element as ExcalidrawElement, { strokeColor }) as T);
  });
};

const jitter = (random: () => number, amount: number) =>
  (random() * 2 - 1) * amount;

const pointAtDistance = (
  from: StickyNoteRenderPoint,
  to: StickyNoteRenderPoint,
  distance: number,
) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);

  if (!length) {
    return from;
  }

  const ratio = Math.min(distance / length, 1);
  return {
    x: from.x + dx * ratio,
    y: from.y + dy * ratio,
  };
};

export const getStickyNoteCornerRadius = (
  element: ExcalidrawStickyNoteElement,
) => {
  if (!element.roundness) {
    return 0;
  }

  return Math.min(
    Math.min(element.width, element.height) * STICKY_NOTE_CORNER_RADIUS_RATIO,
    STICKY_NOTE_MAX_CORNER_RADIUS,
  );
};

export const getStickyNoteRenderPoints = (
  element: ExcalidrawStickyNoteElement,
  {
    offsetX = 0,
    offsetY = 0,
    seedOffset = 0,
  }: {
    offsetX?: number;
    offsetY?: number;
    seedOffset?: number;
  } = {},
): StickyNoteRenderPoint[] => {
  const roughness = Math.max(0, Math.min(2, Math.round(element.roughness)));
  const amount = Math.min(
    STICKY_NOTE_RENDER_ROUGHNESS[roughness],
    Math.min(element.width, element.height) * 0.012,
  );

  if (!amount) {
    return [
      { x: offsetX, y: offsetY },
      { x: offsetX + element.width, y: offsetY },
      { x: offsetX + element.width, y: offsetY + element.height },
      { x: offsetX, y: offsetY + element.height },
    ];
  }

  const random = seededRandom(element.seed + seedOffset);

  return [
    {
      x: offsetX + jitter(random, amount),
      y: offsetY + jitter(random, amount),
    },
    {
      x: offsetX + element.width + jitter(random, amount),
      y: offsetY + jitter(random, amount),
    },
    {
      x: offsetX + element.width + jitter(random, amount),
      y: offsetY + element.height + jitter(random, amount),
    },
    {
      x: offsetX + jitter(random, amount),
      y: offsetY + element.height + jitter(random, amount),
    },
  ];
};

export const getStickyNotePathCommands = (
  element: ExcalidrawStickyNoteElement,
  { shadow = false }: { shadow?: boolean } = {},
): StickyNotePathCommand[] => {
  const points = getStickyNoteRenderPoints(
    element,
    shadow
      ? {
          offsetX: STICKY_NOTE_SHADOW_OFFSET,
          offsetY: STICKY_NOTE_SHADOW_OFFSET,
          seedOffset: 1,
        }
      : undefined,
  );
  const radius = getStickyNoteCornerRadius(element);
  // The note's seed keeps the same corner for the paper and shadow through
  // redraws and resizes.
  const liftedCorner =
    element.roughness === 2
      ? Math.floor(seededRandom(element.seed)() * points.length)
      : -1;

  if (!radius && liftedCorner === -1) {
    return [
      { type: "move", point: points[0] },
      ...points.slice(1).map(
        (point): StickyNotePathCommand => ({
          type: "line",
          point,
        }),
      ),
    ];
  }

  const corners = points.map((point, index): StickyNotePathCommand[] => {
    const prev = points[(index + points.length - 1) % points.length];
    const next = points[(index + 1) % points.length];
    const cornerRadius = Math.min(
      radius,
      Math.hypot(point.x - prev.x, point.y - prev.y) / 2,
      Math.hypot(point.x - next.x, point.y - next.y) / 2,
    );

    if (index === liftedCorner) {
      const size = Math.min(element.width, element.height);
      const reach = Math.min(size * 0.18, 40);
      // The shadow follows the paper inward at half the bend, keeping its
      // usual down-right offset from the light at the top left.
      const lift = Math.min(size * 0.02, 5) * (shadow ? 0.5 : 1);
      // The bend joins the straight edges before the corner, keeping it local.
      const tip = {
        x: point.x + (index === 1 || index === 2 ? -lift : lift),
        y: point.y + (index >= 2 ? -lift : lift),
      };
      const start = pointAtDistance(point, prev, reach);
      const end = pointAtDistance(point, next, reach);
      return [
        { type: "line", point: start },
        {
          type: "quadratic",
          control: pointAtDistance(point, prev, reach / 2),
          point: pointAtDistance(tip, start, cornerRadius),
        },
        {
          type: "quadratic",
          control: tip,
          point: pointAtDistance(tip, end, cornerRadius),
        },
        {
          type: "quadratic",
          control: pointAtDistance(point, next, reach / 2),
          point: end,
        },
      ];
    }

    return [
      { type: "line", point: pointAtDistance(point, prev, cornerRadius) },
      {
        type: "quadratic",
        control: point,
        point: pointAtDistance(point, next, cornerRadius),
      },
    ];
  });

  const commands: StickyNotePathCommand[] = [
    { type: "move", point: corners[0][corners[0].length - 1].point },
  ];

  for (let index = 1; index <= corners.length; index++) {
    commands.push(...corners[index % corners.length]);
  }

  return commands;
};

// -----------------------------------------------------------------------------
// font size — `baseFontSize` is the size the user picked, `fontSize` the fitted one
// -----------------------------------------------------------------------------

// clamping the ceiling: the fit steps down from it in `STICKY_NOTE_FONT_STEP`
// increments, and for values >= ~2^56 (1e20 - 2 === 1e20) that would never
// progress and hang the editor
export const normalizeStickyNoteFontSize = (fontSize: number) => {
  if (!Number.isFinite(fontSize)) {
    return STICKY_NOTE_FALLBACK_FONT_SIZE;
  }
  return Math.min(STICKY_NOTE_MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSize));
};

/** whether the text element is the label of a sticky note */
export const isStickyNoteBoundText = (
  textElement: ExcalidrawTextElement,
  elementsMap: ElementsMap,
) => {
  return (
    !!textElement.containerId &&
    isStickyNoteElement(elementsMap.get(textElement.containerId))
  );
};

/**
 * The font size the user picked: the ceiling the auto-fit shrinks from for a
 * sticky note label, plain `fontSize` for any other text.
 *
 * Container-aware on purpose — generic binding repair (duplication, history)
 * rewrites `containerId` without touching the ceiling, so a numeric
 * `baseFontSize` alone does not prove the text is still sticky-bound.
 */
export const getBaseFontSize = (
  textElement: ExcalidrawTextElement,
  elementsMap: ElementsMap,
) => {
  return isStickyNoteBoundText(textElement, elementsMap)
    ? textElement.baseFontSize ?? textElement.fontSize
    : textElement.fontSize;
};

/** the update that applies a user-picked font size (see `getBaseFontSize`) */
export const getBaseFontSizeUpdate = (
  textElement: ExcalidrawTextElement,
  fontSize: number,
  elementsMap: ElementsMap,
): { fontSize: number } | { baseFontSize: number } => {
  return isStickyNoteBoundText(textElement, elementsMap)
    ? { baseFontSize: normalizeStickyNoteFontSize(fontSize) }
    : { fontSize };
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * The creation-date label: absolute, so painting needs no clock and exports
 * don't go stale, and short ("7 Sep") while the year is the current one.
 * `null` when the note has no usable timestamp (files restored without one).
 * Fixed English in the viewer's local time zone — the element package has no
 * locale, and the footer is chosen by width bucket rather than measured.
 */
export const getStickyNoteDateLabel = (
  created: ExcalidrawStickyNoteElement["created"],
  { short = false, now = Date.now() }: { short?: boolean; now?: number } = {},
): string | null => {
  if (created === null || !Number.isFinite(created)) {
    return null;
  }
  const date = new Date(created);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const label = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  const year = date.getFullYear();
  return short || year === new Date(now).getFullYear()
    ? label
    : `${label} ${year}`;
};

/**
 * What the footer paints and where, in note-local coordinates — shared by the
 * canvas and SVG renderers, which take the font and opacity from
 * `STICKY_NOTE_FOOTER`. `null` for the 0×0 creation draft and anything under
 * the data floor, where the band would overlap the top padding.
 */
export const getStickyNoteFooter = (
  element: Pick<ExcalidrawStickyNoteElement, "created" | "width" | "height">,
  now = Date.now(),
) => {
  if (
    element.width < STICKY_NOTE_MIN_SIZE ||
    element.height < STICKY_NOTE_MIN_SIZE
  ) {
    return null;
  }
  const text = getStickyNoteDateLabel(element.created, {
    short:
      element.width - STICKY_NOTE_PADDING * 2 <
      STICKY_NOTE_FOOTER.minBodyWidthForYear,
    now,
  });
  if (!text) {
    return null;
  }
  return {
    text,
    x: element.width - STICKY_NOTE_PADDING,
    y: element.height - STICKY_NOTE_FOOTER.baselineFromBottom,
  };
};

/**
 * The smallest note the UI lets a user create or resize to: one line at the
 * label's font ceiling plus padding (and, vertically, the footer), never below
 * `STICKY_NOTE_MIN_SIZE`. Without the font term a fresh note would grow on
 * the very first keystroke. Data-level passes (restore, action post-passes)
 * only enforce the constant floor — the layout grows a note as needed.
 */
export const getStickyNoteMinSize = ({
  fontSize,
  fontFamily,
}: Pick<ExcalidrawTextElement, "fontSize" | "fontFamily">) => {
  const lineHeightPx = Math.ceil(
    normalizeStickyNoteFontSize(fontSize) * getLineHeight(fontFamily),
  );
  return {
    width: Math.max(
      STICKY_NOTE_MIN_SIZE,
      lineHeightPx + STICKY_NOTE_PADDING * 2,
    ),
    height: Math.max(
      STICKY_NOTE_MIN_SIZE,
      lineHeightPx + STICKY_NOTE_BODY_INSET_Y,
    ),
  };
};

// -----------------------------------------------------------------------------
// layout — one pure calculation, two ways of applying it
// -----------------------------------------------------------------------------

export type StickyNoteLayoutAnchor = VerticalResizeAnchor;

export type StickyNoteLayoutOpts = {
  /** unwrapped text to lay out; defaults to the label's `originalText` */
  originalText?: string;
  /**
   * absolute base-height intent — the gesture-start value to preserve, or the
   * height a resize asked for. Omitted = keep the note's live `baseHeight`
   * (typing, style changes, restore).
   */
  baseHeight?: number;
  /**
   * absolute font-ceiling intent (a proportional resize passes
   * `gesture-start ceiling × scale`). Omitted = keep the label's live ceiling.
   * Never a multiplier on the live value — that compounds across pointer-moves.
   */
  baseFontSize?: number;
  /** the edge that stays put when the content correction changes the height */
  anchor?: StickyNoteLayoutAnchor;
};

export type StickyNoteLayout = {
  container: Pick<
    ExcalidrawStickyNoteElement,
    "x" | "y" | "width" | "height" | "baseHeight"
  >;
  text: Pick<
    ExcalidrawTextElement,
    | "text"
    | "fontSize"
    | "baseFontSize"
    | "width"
    | "height"
    | "x"
    | "y"
    | "angle"
  > | null;
};

type FontFit = {
  text: string;
  fontSize: number;
  width: number;
  height: number;
};

// `computeBoundTextPosition` only consults the map for arrow containers
const NO_ELEMENTS: ElementsMap = new Map();

const getStickyNoteBaseWidth = (container: ExcalidrawStickyNoteElement) => {
  return Math.max(container.width, STICKY_NOTE_MIN_SIZE);
};

/**
 * Largest font size on the grid `{ceiling − k·STEP} ∪ {min}` whose wrapped
 * text fits the note; `min` when nothing fits (the note then grows). The grid
 * is anchored at the ceiling so the result never depends on earlier edits.
 * Warm-started from the previously fitted size: the common keystroke costs one
 * or two wrap+measure passes, a cold search at most log2(steps) + 2.
 */
const fitStickyNoteFont = (
  fit: (fontSize: number) => FontFit,
  {
    baseFontSize,
    fontSizeMin,
    maxWidth,
    maxHeight,
    warmStart,
  }: {
    baseFontSize: number;
    fontSizeMin: number;
    maxWidth: number;
    maxHeight: number;
    warmStart: number;
  },
): FontFit => {
  const steps = Math.max(
    0,
    Math.ceil((baseFontSize - fontSizeMin) / STICKY_NOTE_FONT_STEP),
  );
  const sizeAt = (index: number) =>
    index >= steps ? fontSizeMin : baseFontSize - index * STICKY_NOTE_FONT_STEP;

  const fits = new Map<number, FontFit>();
  const at = (index: number) => {
    let result = fits.get(index);
    if (!result) {
      result = fit(sizeAt(index));
      fits.set(index, result);
    }
    return result;
  };
  const doesFit = (index: number) => {
    const result = at(index);
    return result.width <= maxWidth && result.height <= maxHeight;
  };

  if (steps === 0) {
    return at(0);
  }

  // the previous fitted size, snapped onto the grid and clamped into the
  // current interval (a lowered ceiling must not keep the old larger size)
  const warm = clamp(
    Math.round((baseFontSize - warmStart) / STICKY_NOTE_FONT_STEP),
    0,
    steps,
  );

  // binary search for the smallest index (largest font) that fits
  let lo: number;
  let hi: number;
  if (doesFit(warm)) {
    if (warm === 0 || !doesFit(warm - 1)) {
      return at(warm);
    }
    lo = 0;
    hi = warm - 1;
  } else {
    if (warm === steps) {
      return at(steps);
    }
    lo = warm + 1;
    hi = steps;
  }
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (doesFit(mid)) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return at(lo);
};

/**
 * The single source of truth for a sticky note's geometry: wraps the label at
 * the note's width, fits the font under the ceiling, grows the note past
 * `baseHeight` only when the text still overflows at the minimum size, and
 * positions the label inside. Pure — returns the updates for both elements.
 */
export const getStickyNoteLayout = (
  container: ExcalidrawStickyNoteElement,
  textElement: ExcalidrawTextElement | null,
  opts: StickyNoteLayoutOpts = {},
): StickyNoteLayout => {
  const baseWidth = getStickyNoteBaseWidth(container);
  const baseHeight = Math.max(
    opts.baseHeight ?? (container.baseHeight || container.height),
    STICKY_NOTE_MIN_SIZE,
  );
  const anchor = opts.anchor ?? "top";

  if (!textElement) {
    // an empty note sits at its base height
    return {
      container: {
        ...getPositionAfterHeightChange(container, baseHeight, anchor),
        width: baseWidth,
        height: baseHeight,
        baseHeight,
      },
      text: null,
    };
  }

  const originalText = opts.originalText ?? textElement.originalText;
  const baseFontSize = normalizeStickyNoteFontSize(
    opts.baseFontSize ?? textElement.baseFontSize ?? textElement.fontSize,
  );
  const fontSizeMin = Math.min(STICKY_NOTE_MIN_FONT_SIZE, baseFontSize);
  const maxWidth = Math.max(baseWidth - STICKY_NOTE_PADDING * 2, 1);
  const maxHeight = Math.max(baseHeight - STICKY_NOTE_BODY_INSET_Y, 0);
  const { fontFamily, lineHeight } = textElement;

  const fit = (fontSize: number): FontFit => {
    const font = getFontString({ fontFamily, fontSize });
    const text = wrapText(originalText, font, maxWidth);
    return { text, fontSize, ...measureText(text, font, lineHeight) };
  };

  const isBlank = !originalText.trim();
  const fitted: FontFit = isBlank
    ? {
        text: "",
        fontSize: baseFontSize,
        ...measureText(
          "",
          getFontString({ fontFamily, fontSize: baseFontSize }),
          lineHeight,
        ),
      }
    : fitStickyNoteFont(fit, {
        baseFontSize,
        fontSizeMin,
        maxWidth,
        maxHeight,
        warmStart: textElement.fontSize,
      });

  const height = isBlank
    ? baseHeight
    : Math.max(baseHeight, fitted.height + STICKY_NOTE_BODY_INSET_Y);
  const nextContainer = {
    ...getPositionAfterHeightChange(container, height, anchor),
    width: baseWidth,
    height,
    baseHeight,
  };
  const { x, y } = computeBoundTextPosition(
    { ...container, ...nextContainer },
    {
      ...textElement,
      text: fitted.text,
      fontSize: fitted.fontSize,
      width: fitted.width,
      height: fitted.height,
    } as ExcalidrawTextElementWithContainer,
    NO_ELEMENTS,
  );

  return {
    container: nextContainer,
    text: {
      text: fitted.text,
      fontSize: fitted.fontSize,
      baseFontSize,
      width: fitted.width,
      height: fitted.height,
      x,
      y,
      angle: container.angle,
    },
  };
};

/**
 * Resize intents for a sticky note — the §3.3 matrix of the plan. Every value
 * is absolute and derived from the gesture-start snapshot on each pointer-move,
 * so releasing Shift (or Alt) mid-gesture restores the original base height
 * and ceiling instead of keeping values a previous move scaled.
 *
 * - width-only gestures (free E/W, Stats W) preserve the base height
 * - height-changing gestures use the requested height as the new base
 * - proportional gestures (Shift on any handle, aspect-locked multi-select,
 *   Stats group) additionally scale the font ceiling with the note
 * - flips preserve everything
 * - the content correction anchors at the edge the gesture holds still
 */
export const getStickyNoteResizeIntent = (
  /** the note with the requested geometry already applied */
  container: ExcalidrawStickyNoteElement,
  originalElementsMap: ElementsMap,
  handleDirection: TransformHandleDirection,
  {
    proportional,
    fromCenter,
    flip = false,
  }: { proportional: boolean; fromCenter: boolean; flip?: boolean },
): Pick<StickyNoteLayoutOpts, "baseHeight" | "baseFontSize" | "anchor"> => {
  const origContainer = originalElementsMap.get(container.id);
  const origSticky = isStickyNoteElement(origContainer)
    ? origContainer
    : container;
  const origText = getBoundTextElement(origSticky, originalElementsMap);
  const ceiling = origText
    ? origText.baseFontSize ?? origText.fontSize
    : undefined;

  if (flip) {
    return { baseHeight: origSticky.baseHeight, baseFontSize: ceiling };
  }

  const changesHeight =
    proportional ||
    handleDirection.includes("n") ||
    handleDirection.includes("s");
  const scale =
    proportional && origSticky.width ? container.width / origSticky.width : 1;
  const isSideHandle = handleDirection.length === 1;

  return {
    baseHeight: changesHeight ? container.height : origSticky.baseHeight,
    baseFontSize: ceiling === undefined ? undefined : ceiling * scale,
    anchor: fromCenter
      ? "center"
      : handleDirection.includes("n")
      ? "bottom"
      : proportional &&
        isSideHandle &&
        (handleDirection === "e" || handleDirection === "w")
      ? // Shift+E/W holds the opposite side's midpoint, i.e. the vertical center
        "center"
      : "top",
  };
};

/**
 * Applies `getStickyNoteLayout` to a live scene, then runs the bound-arrow
 * pass unless the caller already owns one (`bindings: false`) or needs to
 * forward its context (`bindings: { simultaneouslyUpdated }` — arrows resized
 * in the same gesture must not be moved by the pass, `updateBoundElements`
 * skips them only when told).
 */
export const updateStickyNoteLayout = (
  container: ExcalidrawStickyNoteElement,
  scene: Scene,
  {
    text,
    bindings,
    ...layoutOpts
  }: StickyNoteLayoutOpts & {
    /** the label to lay out when it is an uncommitted clone (font actions clone before install) */
    text?: ExcalidrawTextElement | null;
    bindings?:
      | { simultaneouslyUpdated?: readonly NonDeletedExcalidrawElement[] }
      | false;
  } = {},
): StickyNoteLayout => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const textElement =
    text === undefined ? getBoundTextElement(container, elementsMap) : text;
  const layout = getStickyNoteLayout(container, textElement, layoutOpts);

  scene.mutateElement(container, layout.container);
  if (textElement && layout.text) {
    scene.mutateElement(textElement, layout.text);
  }
  if (bindings !== false && !container.isDeleted) {
    updateBoundElements(
      container as NonDeletedExcalidrawElement,
      scene,
      bindings || undefined,
    );
  }

  return layout;
};

const STICKY_NOTE_LAYOUT_INPUTS = {
  container: ["x", "y", "width", "baseHeight", "angle"],
  text: [
    "originalText",
    "baseFontSize",
    "fontFamily",
    "lineHeight",
    "textAlign",
    "verticalAlign",
  ],
} as const;

const hasStickyNoteLayoutInputChanged = (
  container: ExcalidrawStickyNoteElement,
  textElement: ExcalidrawTextElement | null,
  prevElementsMap: ElementsMap,
) => {
  const prevContainer = prevElementsMap.get(container.id);
  const prevText = textElement ? prevElementsMap.get(textElement.id) : null;
  if (
    !prevContainer ||
    (textElement && !prevText) ||
    (!textElement &&
      prevContainer.boundElements?.some(({ type }) => type === "text"))
  ) {
    return true;
  }
  return (
    STICKY_NOTE_LAYOUT_INPUTS.container.some(
      (key) => (prevContainer as any)[key] !== container[key],
    ) ||
    (!!textElement &&
      STICKY_NOTE_LAYOUT_INPUTS.text.some(
        (key) => (prevText as any)[key] !== textElement[key],
      ))
  );
};

/**
 * Applies `getStickyNoteLayout` inside an immutable elements array (property
 * actions, paste styles, restore): the notes among `affectedIds` — or the
 * notes whose labels are — get both halves merged into their clones. Elements
 * that need no change keep their identity and version; when `prevElementsMap`
 * is given, notes whose layout inputs did not change skip the fit entirely.
 * Bound arrows are the caller's job once the result is installed.
 */
export const relayoutStickyNotes = <T extends ExcalidrawElement>(
  elements: readonly T[],
  affectedIds: ReadonlySet<ExcalidrawElement["id"]>,
  opts?: { prevElementsMap?: ElementsMap },
): readonly T[] => {
  if (!affectedIds.size) {
    return elements;
  }
  const elementsMap = arrayToMap(elements);
  const containerIds = new Set<ExcalidrawElement["id"]>();
  for (const id of affectedIds) {
    const element = elementsMap.get(id);
    if (!element || element.isDeleted) {
      continue;
    }
    if (isStickyNoteElement(element)) {
      containerIds.add(element.id);
    } else if (isTextElement(element) && element.containerId) {
      const container = elementsMap.get(element.containerId);
      if (container && !container.isDeleted && isStickyNoteElement(container)) {
        containerIds.add(container.id);
      }
    }
  }
  if (!containerIds.size) {
    return elements;
  }

  const replacements = new Map<ExcalidrawElement["id"], T>();
  for (const id of containerIds) {
    const container = elementsMap.get(id) as ExcalidrawStickyNoteElement;
    const textElement = getBoundTextElement(container, elementsMap);
    if (
      opts?.prevElementsMap &&
      !hasStickyNoteLayoutInputChanged(
        container,
        textElement,
        opts.prevElementsMap,
      )
    ) {
      continue;
    }
    const layout = getStickyNoteLayout(container, textElement);
    const nextContainer = newElementWith(container, layout.container);
    if (nextContainer !== container) {
      replacements.set(id, nextContainer as unknown as T);
    }
    if (textElement && layout.text) {
      const nextText = newElementWith(textElement, layout.text);
      if (nextText !== textElement) {
        replacements.set(textElement.id, nextText as unknown as T);
      }
    }
  }
  if (!replacements.size) {
    return elements;
  }
  return elements.map((element) => replacements.get(element.id) ?? element);
};
