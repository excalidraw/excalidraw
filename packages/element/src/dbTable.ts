import {
  getFontString,
  getLineHeight,
  getVerticalOffset,
  randomId,
} from "@excalidraw/common";
import { pointFrom, pointRotateRads } from "@excalidraw/math";

import type { GlobalPoint, Radians } from "@excalidraw/math";

import { updateBoundElements } from "./binding";
import { newElementWith } from "./mutateElement";
import { getLineWidth } from "./textMeasurements";

import type { RenderEnvironment } from "./renderEnvironment";
import type { Scene } from "./Scene";
import type {
  ExcalidrawTableElement,
  ExcalidrawTableRow,
  FontFamilyValues,
  NonDeleted,
} from "./types";

// -----------------------------------------------------------------------------
// constants (in px at the reference font size; everything scales with
// `fontSize / TABLE_REFERENCE_FONT_SIZE` so a table looks the same at any size)
// -----------------------------------------------------------------------------

export const TABLE_REFERENCE_FONT_SIZE = 20;
export const TABLE_DEFAULT_TITLE = "table_name";
export const TABLE_DEFAULT_ROWS: readonly Omit<ExcalidrawTableRow, "id">[] = [
  { key: "PK", name: "id" },
  { key: "", name: "name" },
  { key: "FK", name: "owner_id" },
];
/** the key column's text is set smaller, as secondary information */
export const TABLE_KEY_FONT_SCALE = 0.75;
export const TABLE_KEY_TEXT_OPACITY = 0.7;
/** opacity of the divider between the key and the name column */
export const TABLE_COLUMN_DIVIDER_OPACITY = 0.35;
/** how much white the body tint mixes into the header color */
export const TABLE_BODY_TINT = 0.82;

const PADDING_X = 12;
const HEADER_PADDING_Y = 10;
const ROW_PADDING_Y = 5;
const BODY_PADDING_Y = 6;
const MIN_WIDTH = 160;
const MIN_KEY_COLUMN_TEXT = "PK";
const TOGGLE_SIZE = 12;
const TOGGLE_INSET = 10;
const TOGGLE_GAP = 8;
/** the toggle's hit area extends this far past its drawn square */
const TOGGLE_HIT_SLOP = 5;

// -----------------------------------------------------------------------------
// layout
// -----------------------------------------------------------------------------

export type TableRect = { x: number; y: number; width: number; height: number };

export type TableRowLayout = {
  row: ExcalidrawTableRow;
  /** the row's band, spanning both columns */
  rect: TableRect;
  key: TableRect;
  name: TableRect;
  /** top of the key text's line box */
  keyTextY: number;
  /** top of the name text's line box */
  nameTextY: number;
};

/**
 * Everything needed to draw, edit or hit-test a table, in the element's local
 * (unrotated) coordinates. Pure: derived from the content and font only.
 */
export type TableLayout = {
  width: number;
  height: number;
  /** scale factor relative to the reference font size */
  unit: number;
  fontSize: number;
  keyFontSize: number;
  lineHeight: ReturnType<typeof getLineHeight>;
  paddingX: number;
  header: TableRect;
  /** top of the title's line box; the title is centered horizontally */
  titleY: number;
  /** the title's line box, clear of the toggle on both sides */
  title: TableRect;
  /** the square the collapse toggle is drawn in */
  toggle: TableRect;
  /** the body below the header; `null` when collapsed */
  body: TableRect | null;
  keyColumnWidth: number;
  rows: TableRowLayout[];
};

export const getTableKeyFontSize = (fontSize: number) =>
  fontSize * TABLE_KEY_FONT_SCALE;

export const getTableFontString = (
  element: Pick<ExcalidrawTableElement, "fontSize" | "fontFamily">,
) => getFontString(element);

export const getTableKeyFontString = (
  element: Pick<ExcalidrawTableElement, "fontSize" | "fontFamily">,
) =>
  getFontString({
    fontSize: getTableKeyFontSize(element.fontSize),
    fontFamily: element.fontFamily,
  });

// elements are mutated in place (`mutateElement`), so entries are validated
// against the version they were computed for
const layoutCache = new WeakMap<
  ExcalidrawTableElement,
  { version: number; layout: TableLayout }
>();

export const getTableLayout = (
  element: Pick<
    ExcalidrawTableElement,
    "title" | "rows" | "collapsed" | "fontSize" | "fontFamily"
  >,
  renderEnvironment?: RenderEnvironment,
): TableLayout => {
  const cached = layoutCache.get(element as ExcalidrawTableElement);
  if (
    cached &&
    cached.version === (element as ExcalidrawTableElement).version
  ) {
    return cached.layout;
  }

  const { fontSize, fontFamily } = element;
  const unit = fontSize / TABLE_REFERENCE_FONT_SIZE;
  const lineHeight = getLineHeight(fontFamily);
  const keyFontSize = getTableKeyFontSize(fontSize);

  const font = getTableFontString(element);
  const keyFont = getTableKeyFontString(element);

  const paddingX = PADDING_X * unit;
  const textLineHeight = fontSize * lineHeight;
  const keyLineHeight = keyFontSize * lineHeight;

  // --- header -----------------------------------------------------------------
  const headerHeight = textLineHeight + HEADER_PADDING_Y * 2 * unit;
  const toggleSize = TOGGLE_SIZE * unit;
  // reserved on both sides so the title stays centered and clear of the toggle
  const titleSideInset = (TOGGLE_INSET + TOGGLE_GAP) * unit + toggleSize;
  const titleWidth = getLineWidth(element.title, font, renderEnvironment);

  // --- columns ----------------------------------------------------------------
  let maxKeyWidth = getLineWidth(
    MIN_KEY_COLUMN_TEXT,
    keyFont,
    renderEnvironment,
  );
  let maxNameWidth = 0;
  for (const row of element.rows) {
    maxKeyWidth = Math.max(
      maxKeyWidth,
      getLineWidth(row.key, keyFont, renderEnvironment),
    );
    maxNameWidth = Math.max(
      maxNameWidth,
      getLineWidth(row.name, font, renderEnvironment),
    );
  }
  const keyColumnWidth = maxKeyWidth + paddingX * 2;
  const minNameColumnWidth = maxNameWidth + paddingX * 2;

  const width = Math.ceil(
    Math.max(
      MIN_WIDTH * unit,
      titleWidth + titleSideInset * 2,
      keyColumnWidth + minNameColumnWidth,
    ),
  );
  // the name column absorbs any extra width
  const nameColumnWidth = width - keyColumnWidth;

  // --- rows -------------------------------------------------------------------
  const rowHeight = textLineHeight + ROW_PADDING_Y * 2 * unit;
  const bodyPaddingY = BODY_PADDING_Y * unit;
  const rows: TableRowLayout[] = element.rows.map((row, index) => {
    const y = headerHeight + bodyPaddingY + index * rowHeight;
    return {
      row,
      rect: { x: 0, y, width, height: rowHeight },
      key: { x: 0, y, width: keyColumnWidth, height: rowHeight },
      name: {
        x: keyColumnWidth,
        y,
        width: nameColumnWidth,
        height: rowHeight,
      },
      keyTextY: y + (rowHeight - keyLineHeight) / 2,
      nameTextY: y + (rowHeight - textLineHeight) / 2,
    };
  });

  // an empty table keeps one row's worth of body so it doesn't look collapsed
  const bodyHeight =
    Math.max(1, element.rows.length) * rowHeight + bodyPaddingY * 2;

  const height = Math.ceil(
    element.collapsed ? headerHeight : headerHeight + bodyHeight,
  );

  const layout: TableLayout = {
    width,
    height,
    unit,
    fontSize,
    keyFontSize,
    lineHeight,
    paddingX,
    header: { x: 0, y: 0, width, height: headerHeight },
    titleY: (headerHeight - textLineHeight) / 2,
    title: {
      x: titleSideInset,
      y: (headerHeight - textLineHeight) / 2,
      width: width - titleSideInset * 2,
      height: textLineHeight,
    },
    toggle: {
      x: TOGGLE_INSET * unit,
      y: (headerHeight - toggleSize) / 2,
      width: toggleSize,
      height: toggleSize,
    },
    body: element.collapsed
      ? null
      : { x: 0, y: headerHeight, width, height: height - headerHeight },
    keyColumnWidth,
    rows: element.collapsed ? [] : rows,
  };

  if ("version" in element && typeof element.version === "number") {
    layoutCache.set(element as ExcalidrawTableElement, {
      version: element.version,
      layout,
    });
  }

  return layout;
};

/** the baseline offset of a line box, for canvas `alphabetic` text */
export const getTableTextBaselineOffset = (
  fontFamily: FontFamilyValues,
  fontSize: number,
  lineHeight: number,
) => getVerticalOffset(fontFamily, fontSize, fontSize * lineHeight);

// -----------------------------------------------------------------------------
// element helpers
// -----------------------------------------------------------------------------

export const newTableRow = (
  row: Partial<Omit<ExcalidrawTableRow, "id">> = {},
): ExcalidrawTableRow => ({
  id: randomId(),
  key: row.key ?? "",
  name: row.name ?? "",
});

/** keeps `width`/`height` in sync with the content (identity-preserving) */
export const normalizeTable = <T extends ExcalidrawTableElement>(
  element: T,
  renderEnvironment?: RenderEnvironment,
): T => {
  const { width, height } = getTableLayout(element, renderEnvironment);
  if (element.width === width && element.height === height) {
    return element;
  }
  return newElementWith(element, { width, height } as any) as T;
};

export type TableContentUpdate = Partial<
  Pick<
    ExcalidrawTableElement,
    "title" | "rows" | "collapsed" | "fontSize" | "fontFamily"
  >
>;

/**
 * Applies a content change to a table in the scene, re-derives its size, and
 * moves the arrows bound to it so they stay attached to its outline.
 */
export const updateTableContent = (
  element: ExcalidrawTableElement,
  updates: TableContentUpdate,
  scene: Scene,
  renderEnvironment?: RenderEnvironment,
) => {
  const next = { ...element, ...updates };
  const { width, height } = getTableLayout(next, renderEnvironment);
  scene.mutateElement(element, { ...updates, width, height });
  updateBoundElements(element as NonDeleted<ExcalidrawTableElement>, scene, {
    renderEnvironment,
  });
};

/** re-derives the size of tables whose measurements went stale (font load) */
export const relayoutTable = (
  element: ExcalidrawTableElement,
  scene: Scene,
  renderEnvironment?: RenderEnvironment,
) => {
  layoutCache.delete(element);
  const { width, height } = getTableLayout(element, renderEnvironment);
  if (
    Math.abs(element.width - width) < 0.5 &&
    Math.abs(element.height - height) < 0.5
  ) {
    return false;
  }
  scene.mutateElement(element, { width, height });
  updateBoundElements(element as NonDeleted<ExcalidrawTableElement>, scene, {
    renderEnvironment,
  });
  return true;
};

// -----------------------------------------------------------------------------
// hit testing
// -----------------------------------------------------------------------------

/** scene point → the table's local (unrotated, origin at top-left) frame */
export const getTableLocalPoint = (
  element: ExcalidrawTableElement,
  point: { x: number; y: number },
) => {
  const center = pointFrom<GlobalPoint>(
    element.x + element.width / 2,
    element.y + element.height / 2,
  );
  const [x, y] = pointRotateRads(
    pointFrom<GlobalPoint>(point.x, point.y),
    center,
    -element.angle as Radians,
  );
  return { x: x - element.x, y: y - element.y };
};

const isInRect = (point: { x: number; y: number }, rect: TableRect, slop = 0) =>
  point.x >= rect.x - slop &&
  point.x <= rect.x + rect.width + slop &&
  point.y >= rect.y - slop &&
  point.y <= rect.y + rect.height + slop;

export const isPointOnTableToggle = (
  element: ExcalidrawTableElement,
  scenePoint: { x: number; y: number },
  zoom = 1,
) => {
  const layout = getTableLayout(element);
  return isInRect(
    getTableLocalPoint(element, scenePoint),
    layout.toggle,
    // keep the target comfortably clickable when zoomed out
    Math.max(TOGGLE_HIT_SLOP * layout.unit, TOGGLE_HIT_SLOP / zoom),
  );
};

export type TableCell =
  | { type: "title" }
  | { type: "key" | "name"; rowId: ExcalidrawTableRow["id"] };

export const getTableCellAtPoint = (
  element: ExcalidrawTableElement,
  scenePoint: { x: number; y: number },
): TableCell | null => {
  const layout = getTableLayout(element);
  const local = getTableLocalPoint(element, scenePoint);
  if (isInRect(local, layout.header)) {
    return { type: "title" };
  }
  for (const row of layout.rows) {
    if (isInRect(local, row.key)) {
      return { type: "key", rowId: row.row.id };
    }
    if (isInRect(local, row.name)) {
      return { type: "name", rowId: row.row.id };
    }
  }
  return null;
};

// -----------------------------------------------------------------------------
// colors
// -----------------------------------------------------------------------------

const parseHexColor = (color: string) => {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) {
    return null;
  }
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
};

const toHex = (channels: number[]) =>
  `#${channels
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

/**
 * The body fill: the header color washed out towards white, so the body reads
 * as part of the same table while keeping text contrast. Non-hex colors fall
 * back to white.
 */
export const getTableBodyColor = (headerColor: string) => {
  const rgb = parseHexColor(headerColor);
  if (!rgb) {
    return "#ffffff";
  }
  return toHex(
    rgb.map((channel) => channel + (255 - channel) * TABLE_BODY_TINT),
  );
};

/** `color` at `opacity`, for hex colors (others are returned unchanged) */
export const getTableColorWithOpacity = (color: string, opacity: number) => {
  const rgb = parseHexColor(color);
  if (!rgb) {
    return color;
  }
  return `rgba(${rgb.join(", ")}, ${opacity})`;
};
