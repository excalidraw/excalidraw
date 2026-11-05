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
  ExcalidrawDBTableElement,
  ExcalidrawDBTableRow,
  FontFamilyValues,
  NonDeleted,
} from "./types";

// -----------------------------------------------------------------------------
// constants (in px at the reference font size; everything scales with
// `fontSize / DB_TABLE_REFERENCE_FONT_SIZE` so a table looks the same at any size)
// -----------------------------------------------------------------------------

export const DB_TABLE_REFERENCE_FONT_SIZE = 20;
export const DB_TABLE_DEFAULT_TITLE = "table_name";
export const DB_TABLE_DEFAULT_ROWS: readonly Omit<
  ExcalidrawDBTableRow,
  "id"
>[] = [
  { key: "PK", name: "id" },
  { key: "", name: "name" },
  { key: "FK", name: "owner_id" },
];
/** the key column's text is set smaller, as secondary information */
export const DB_TABLE_KEY_FONT_SCALE = 0.75;
export const DB_TABLE_KEY_TEXT_OPACITY = 0.7;
/** opacity of the divider between the key and the name column */
export const DB_TABLE_COLUMN_DIVIDER_OPACITY = 0.35;
/** how much white the body tint mixes into the header color */
export const DB_TABLE_BODY_TINT = 0.82;
/**
 * The examples column is washed out further than the body, so sample data
 * reads as apart from the schema while staying part of the same table.
 */
export const DB_TABLE_EXAMPLE_TINT = 0.93;
export const DB_TABLE_EXAMPLE_TEXT_OPACITY = 0.6;
/** the examples column's text is set italic, the way sample values usually are */
export const DB_TABLE_EXAMPLE_FONT_STYLE = "italic";

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
/** an empty examples column stays wide enough to type in */
const MIN_EXAMPLE_COLUMN_WIDTH = 96;

// -----------------------------------------------------------------------------
// layout
// -----------------------------------------------------------------------------

export type DBTableRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DBTableRowLayout = {
  row: ExcalidrawDBTableRow;
  /** the row's band, spanning both columns */
  rect: DBTableRect;
  key: DBTableRect;
  name: DBTableRect;
  /** the examples cell; `null` while examples are hidden */
  example: DBTableRect | null;
  /** top of the key text's line box */
  keyTextY: number;
  /** top of the name (and example) text's line box */
  nameTextY: number;
};

/**
 * Everything needed to draw, edit or hit-test a table, in the element's local
 * (unrotated) coordinates. Pure: derived from the content and font only.
 */
export type DBTableLayout = {
  width: number;
  height: number;
  /** scale factor relative to the reference font size */
  unit: number;
  fontSize: number;
  keyFontSize: number;
  lineHeight: ReturnType<typeof getLineHeight>;
  paddingX: number;
  header: DBTableRect;
  /** top of the title's line box; the title is centered horizontally */
  titleY: number;
  /** the title's line box, clear of the toggle on both sides */
  title: DBTableRect;
  /** the square the collapse toggle is drawn in */
  toggle: DBTableRect;
  /** the square the examples toggle is drawn in; `null` when collapsed */
  examplesToggle: DBTableRect | null;
  /** the body below the header; `null` when collapsed */
  body: DBTableRect | null;
  keyColumnWidth: number;
  /** left edge of the examples column (the schema part's width) */
  examplesX: number;
  /** 0 while examples are hidden */
  examplesColumnWidth: number;
  rows: DBTableRowLayout[];
};

type DBTableLayoutInput = Pick<
  ExcalidrawDBTableElement,
  | "title"
  | "rows"
  | "collapsed"
  | "showExamples"
  | "fontSize"
  | "fontFamily"
  | "customWidth"
>;

export const getDBTableKeyFontSize = (fontSize: number) =>
  fontSize * DB_TABLE_KEY_FONT_SCALE;

export const getDBTableFontString = (
  element: Pick<ExcalidrawDBTableElement, "fontSize" | "fontFamily">,
) => getFontString(element);

export const getDBTableKeyFontString = (
  element: Pick<ExcalidrawDBTableElement, "fontSize" | "fontFamily">,
) =>
  getFontString({
    fontSize: getDBTableKeyFontSize(element.fontSize),
    fontFamily: element.fontFamily,
  });

// elements are mutated in place (`mutateElement`), so entries are validated
// against the version they were computed for
const layoutCache = new WeakMap<
  ExcalidrawDBTableElement,
  { version: number; layout: DBTableLayout }
>();

export const getDBTableLayout = (
  element: DBTableLayoutInput,
  renderEnvironment?: RenderEnvironment,
): DBTableLayout => {
  const cached = layoutCache.get(element as ExcalidrawDBTableElement);
  if (
    cached &&
    cached.version === (element as ExcalidrawDBTableElement).version
  ) {
    return cached.layout;
  }

  const { fontSize, fontFamily } = element;
  const unit = fontSize / DB_TABLE_REFERENCE_FONT_SIZE;
  const lineHeight = getLineHeight(fontFamily);
  const keyFontSize = getDBTableKeyFontSize(fontSize);

  const font = getDBTableFontString(element);
  const keyFont = getDBTableKeyFontString(element);

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

  // the examples column hugs its content at the right, added on top of the
  // schema part so showing it widens the table and hiding it restores it.
  // It is measured upright: the italic is a slant that keeps the advances.
  let examplesColumnWidth = 0;
  if (element.showExamples) {
    let maxExampleWidth = 0;
    for (const row of element.rows) {
      if (row.example) {
        maxExampleWidth = Math.max(
          maxExampleWidth,
          getLineWidth(row.example, font, renderEnvironment),
        );
      }
    }
    examplesColumnWidth = Math.ceil(
      Math.max(MIN_EXAMPLE_COLUMN_WIDTH * unit, maxExampleWidth + paddingX * 2),
    );
  }

  const schemaWidth = Math.ceil(
    Math.max(
      MIN_WIDTH * unit,
      // the header spans the examples column too, so the title may use it
      titleWidth + titleSideInset * 2 - examplesColumnWidth,
      keyColumnWidth + minNameColumnWidth,
      element.customWidth ?? 0,
    ),
  );
  const width = schemaWidth + examplesColumnWidth;
  // the name column absorbs any extra width
  const nameColumnWidth = schemaWidth - keyColumnWidth;

  // --- rows -------------------------------------------------------------------
  const rowHeight = textLineHeight + ROW_PADDING_Y * 2 * unit;
  const bodyPaddingY = BODY_PADDING_Y * unit;
  const rows: DBTableRowLayout[] = element.rows.map((row, index) => {
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
      example: examplesColumnWidth
        ? {
            x: schemaWidth,
            y,
            width: examplesColumnWidth,
            height: rowHeight,
          }
        : null,
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

  const layout: DBTableLayout = {
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
    // mirrors the collapse toggle, in the space the title keeps clear of
    examplesToggle: element.collapsed
      ? null
      : {
          x: width - TOGGLE_INSET * unit - toggleSize,
          y: (headerHeight - toggleSize) / 2,
          width: toggleSize,
          height: toggleSize,
        },
    body: element.collapsed
      ? null
      : { x: 0, y: headerHeight, width, height: height - headerHeight },
    keyColumnWidth,
    examplesX: schemaWidth,
    examplesColumnWidth,
    rows: element.collapsed ? [] : rows,
  };

  if ("version" in element && typeof element.version === "number") {
    layoutCache.set(element as ExcalidrawDBTableElement, {
      version: element.version,
      layout,
    });
  }

  return layout;
};

/** the baseline offset of a line box, for canvas `alphabetic` text */
export const getDBTableTextBaselineOffset = (
  fontFamily: FontFamilyValues,
  fontSize: number,
  lineHeight: number,
) => getVerticalOffset(fontFamily, fontSize, fontSize * lineHeight);

// -----------------------------------------------------------------------------
// element helpers
// -----------------------------------------------------------------------------

export const newDBTableRow = (
  row: Partial<Omit<ExcalidrawDBTableRow, "id">> = {},
): ExcalidrawDBTableRow => ({
  id: randomId(),
  key: row.key ?? "",
  name: row.name ?? "",
  ...(row.example ? { example: row.example } : {}),
});

/** keeps `width`/`height` in sync with the content (identity-preserving) */
export const normalizeDBTable = <T extends ExcalidrawDBTableElement>(
  element: T,
  renderEnvironment?: RenderEnvironment,
): T => {
  const { width, height } = getDBTableLayout(element, renderEnvironment);
  if (element.width === width && element.height === height) {
    return element;
  }
  return newElementWith(element, { width, height } as any) as T;
};

export type DBTableContentUpdate = Partial<DBTableLayoutInput>;

/**
 * Applies a content change to a table in the scene, re-derives its size, and
 * moves the arrows bound to it so they stay attached to its outline.
 */
export const updateDBTableContent = (
  element: ExcalidrawDBTableElement,
  updates: DBTableContentUpdate,
  scene: Scene,
  renderEnvironment?: RenderEnvironment,
) => {
  const next = { ...element, ...updates };
  const { width, height } = getDBTableLayout(next, renderEnvironment);
  scene.mutateElement(element, { ...updates, width, height });
  syncDBTableRowBindings(element, scene);
  updateBoundElements(element as NonDeleted<ExcalidrawDBTableElement>, scene, {
    renderEnvironment,
  });
};

/** re-derives the size of tables whose measurements went stale (font load) */
export const relayoutDBTable = (
  element: ExcalidrawDBTableElement,
  scene: Scene,
  renderEnvironment?: RenderEnvironment,
) => {
  layoutCache.delete(element);
  const { width, height } = getDBTableLayout(element, renderEnvironment);
  if (
    Math.abs(element.width - width) < 0.5 &&
    Math.abs(element.height - height) < 0.5
  ) {
    return false;
  }
  scene.mutateElement(element, { width, height });
  syncDBTableRowBindings(element, scene);
  updateBoundElements(element as NonDeleted<ExcalidrawDBTableElement>, scene, {
    renderEnvironment,
  });
  return true;
};

// -----------------------------------------------------------------------------
// row bindings
//
// Arrows connect rows, not the table as a whole: a binding to a table carries
// the `rowId` it was dropped on, and its end sits on the table's left or right
// edge at that row's center line. While the table is collapsed (or for
// arrows dropped on the header) the end sits at the header's center line.
// -----------------------------------------------------------------------------

export type DBTableSide = "left" | "right";

/** the row whose band is at `scenePoint`'s height (`null` on the header) */
export const getDBTableRowIdAtPoint = (
  element: ExcalidrawDBTableElement,
  scenePoint: { x: number; y: number },
): ExcalidrawDBTableRow["id"] | null => {
  const layout = getDBTableLayout(element);
  const { y } = getDBTableLocalPoint(element, scenePoint);
  if (!layout.rows.length || y < layout.header.height) {
    return null;
  }
  // the body's padding (and anything below) belongs to the nearest row
  let closest = layout.rows[0];
  for (const row of layout.rows) {
    if (y >= row.rect.y) {
      closest = row;
    }
  }
  return closest.row.id;
};

/** the local y of the line a binding to `rowId` attaches at */
export const getDBTableRowAnchorY = (
  element: ExcalidrawDBTableElement,
  rowId: ExcalidrawDBTableRow["id"] | null | undefined,
) => {
  const layout = getDBTableLayout(element);
  const row = rowId && layout.rows.find((row) => row.row.id === rowId);
  return row ? row.rect.y + row.rect.height / 2 : layout.header.height / 2;
};

/** the side of the table facing `scenePoint` */
export const getDBTableSideFacing = (
  element: ExcalidrawDBTableElement,
  scenePoint: { x: number; y: number },
): DBTableSide =>
  getDBTableLocalPoint(element, scenePoint).x < element.width / 2
    ? "left"
    : "right";

/**
 * The fixed point (box ratio, see `FixedPointBinding`) of a row anchor. It is
 * nudged off the exact center like `normalizeFixedPoint` does.
 */
export const getDBTableRowFixedPoint = (
  element: ExcalidrawDBTableElement,
  rowId: ExcalidrawDBTableRow["id"] | null | undefined,
  side: DBTableSide,
): [number, number] => {
  const ratioY = getDBTableRowAnchorY(element, rowId) / element.height;
  return [
    side === "left" ? 0 : 1,
    Math.abs(ratioY - 0.5) < 0.0001 ? 0.5001 : ratioY,
  ];
};

/** the scene point a row binding puts the arrow's end at, `gap` off the edge */
export const getDBTableRowAnchorPoint = (
  element: ExcalidrawDBTableElement,
  rowId: ExcalidrawDBTableRow["id"] | null | undefined,
  side: DBTableSide,
  gap: number,
): GlobalPoint => {
  const local = {
    x: side === "left" ? -gap : element.width + gap,
    y: getDBTableRowAnchorY(element, rowId),
  };
  return pointRotateRads(
    pointFrom<GlobalPoint>(element.x + local.x, element.y + local.y),
    pointFrom<GlobalPoint>(
      element.x + element.width / 2,
      element.y + element.height / 2,
    ),
    element.angle as Radians,
  );
};

/**
 * The side a connection should leave the table from, towards `target` (the
 * other end): the facing side when the target is beside the table, and the
 * right side when it is above or below it, so stacked tables connect with a
 * tidy bracket rather than crossing over.
 */
export const getDBTableConnectionSide = (
  element: ExcalidrawDBTableElement,
  target: { x: number; y: number },
): DBTableSide => {
  const { x } = getDBTableLocalPoint(element, target);
  return x < 0 ? "left" : "right";
};

/**
 * Re-pins the bindings of arrows connected to the table's rows after its
 * layout changed (rows added, removed, reordered or resized, the table
 * collapsed or expanded), keeping each on its side. Bindings to rows that no
 * longer exist keep their last position.
 */
export const syncDBTableRowBindings = (
  element: ExcalidrawDBTableElement,
  scene: Scene,
) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const rowIds = new Set(element.rows.map((row) => row.id));
  for (const { id, type } of element.boundElements ?? []) {
    if (type !== "arrow") {
      continue;
    }
    const arrow = elementsMap.get(id);
    if (!arrow || arrow.type !== "arrow") {
      continue;
    }
    for (const prop of ["startBinding", "endBinding"] as const) {
      const binding = arrow[prop];
      if (binding?.elementId !== element.id) {
        continue;
      }
      const rowId =
        binding.rowId && (rowIds.has(binding.rowId) || element.collapsed)
          ? binding.rowId
          : binding.rowId
          ? undefined // the row is gone: keep the last position
          : null;
      if (rowId === undefined) {
        continue;
      }
      const fixedPoint = getDBTableRowFixedPoint(
        element,
        element.collapsed ? null : rowId,
        binding.fixedPoint[0] < 0.5 ? "left" : "right",
      );
      if (
        fixedPoint[0] !== binding.fixedPoint[0] ||
        fixedPoint[1] !== binding.fixedPoint[1]
      ) {
        scene.mutateElement(arrow, {
          [prop]: { ...binding, fixedPoint },
        });
      }
    }
  }
};

// -----------------------------------------------------------------------------
// hit testing
// -----------------------------------------------------------------------------

/** scene point → the table's local (unrotated, origin at top-left) frame */
export const getDBTableLocalPoint = (
  element: ExcalidrawDBTableElement,
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

const isInRect = (
  point: { x: number; y: number },
  rect: DBTableRect,
  slop = 0,
) =>
  point.x >= rect.x - slop &&
  point.x <= rect.x + rect.width + slop &&
  point.y >= rect.y - slop &&
  point.y <= rect.y + rect.height + slop;

export type DBTableToggle = "collapse" | "examples";

/** the header toggle at `scenePoint`, if any */
export const getDBTableToggleAtPoint = (
  element: ExcalidrawDBTableElement,
  scenePoint: { x: number; y: number },
  zoom = 1,
): DBTableToggle | null => {
  const layout = getDBTableLayout(element);
  const local = getDBTableLocalPoint(element, scenePoint);
  // keep the targets comfortably clickable when zoomed out
  const slop = Math.max(TOGGLE_HIT_SLOP * layout.unit, TOGGLE_HIT_SLOP / zoom);
  if (isInRect(local, layout.toggle, slop)) {
    return "collapse";
  }
  if (layout.examplesToggle && isInRect(local, layout.examplesToggle, slop)) {
    return "examples";
  }
  return null;
};

export const isPointOnDBTableToggle = (
  element: ExcalidrawDBTableElement,
  scenePoint: { x: number; y: number },
  zoom = 1,
) => getDBTableToggleAtPoint(element, scenePoint, zoom) !== null;

export type DBTableColumn = "key" | "name" | "example";

export type DBTableCell =
  | { type: "title" }
  | { type: DBTableColumn; rowId: ExcalidrawDBTableRow["id"] };

export const getDBTableCellAtPoint = (
  element: ExcalidrawDBTableElement,
  scenePoint: { x: number; y: number },
): DBTableCell | null => {
  const layout = getDBTableLayout(element);
  const local = getDBTableLocalPoint(element, scenePoint);
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
    if (row.example && isInRect(local, row.example)) {
      return { type: "example", rowId: row.row.id };
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
export const getDBTableBodyColor = (headerColor: string) => {
  const rgb = parseHexColor(headerColor);
  if (!rgb) {
    return "#ffffff";
  }
  return toHex(
    rgb.map((channel) => channel + (255 - channel) * DB_TABLE_BODY_TINT),
  );
};

/** the examples column fill: a lighter wash than the body (white fallback) */
export const getDBTableExampleColumnColor = (headerColor: string) => {
  const rgb = parseHexColor(headerColor);
  if (!rgb) {
    return "#ffffff";
  }
  return toHex(
    rgb.map((channel) => channel + (255 - channel) * DB_TABLE_EXAMPLE_TINT),
  );
};

export const getDBTableExampleFontString = (
  element: Pick<ExcalidrawDBTableElement, "fontSize" | "fontFamily">,
) => `${DB_TABLE_EXAMPLE_FONT_STYLE} ${getFontString(element)}`;

/** `color` at `opacity`, for hex colors (others are returned unchanged) */
export const getDBTableColorWithOpacity = (color: string, opacity: number) => {
  const rgb = parseHexColor(color);
  if (!rgb) {
    return color;
  }
  return `rgba(${rgb.join(", ")}, ${opacity})`;
};
