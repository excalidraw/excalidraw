import type { Bounds } from "@excalidraw/common";

import type {
  ElementsMap,
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "./types";

/** scene-space size of a grid cell */
const CELL_SIZE = 1024;

/**
 * Elements spanning more cells than this live in a list that every query
 * scans instead, which keeps the per-element indexing cost bounded.
 */
const MAX_CELLS_PER_ELEMENT = 64;

/**
 * Cell coordinates are packed into a single number key. Elements whose cells
 * fall outside [-CELL_COORD_LIMIT, CELL_COORD_LIMIT) (about ±1e9 scene units)
 * are treated as oversized.
 */
const CELL_COORD_LIMIT = 2 ** 20;
const CELL_KEY_STRIDE = 2 ** 21;

const toCellKey = (col: number, row: number) =>
  (col + CELL_COORD_LIMIT) * CELL_KEY_STRIDE + (row + CELL_COORD_LIMIT);

const fromCellKey = (key: number): [col: number, row: number] => [
  Math.floor(key / CELL_KEY_STRIDE) - CELL_COORD_LIMIT,
  (key % CELL_KEY_STRIDE) - CELL_COORD_LIMIT,
];

const toCell = (coord: number) => Math.floor(coord / CELL_SIZE);

/** above this candidates/elements ratio, restore z-order by a linear pass */
const LINEAR_ORDER_RATIO = 1 / 16;

type Entry = {
  element: NonDeletedExcalidrawElement;
  /** the element version the bounds were computed at */
  version: ExcalidrawElement["version"];
  /** position in the synced (z-ordered) elements array */
  order: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  location: "none" | "grid" | "oversized";
  /** inclusive cell range, valid when `location === "grid"` */
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
  syncStamp: number;
  queryStamp: number;
};

/** indices of live scenes, notified of in-place element mutations */
const liveIndices = new Set<SpatialIndex>();

/**
 * Uniform-grid spatial index over a scene's non-deleted elements, answering
 * "which elements' bounds intersect this rectangle" in time proportional to
 * the query area and result size rather than the scene size.
 *
 * Freshness doesn't depend on callers remembering to update it:
 *
 * - in-place mutations reach it through `SpatialIndex.onElementMutated`,
 *   which `mutateElement` and `bumpVersion` call on every version bump,
 *   regardless of whether the scene is informed (`informMutation: false`);
 * - every new elements array (i.e. `scene.replaceAllElements`) is reconciled
 *   by element identity and version before the next query, which also
 *   catches anything that bypassed the mutation helpers but bumped the
 *   version;
 * - bounds dependencies between elements (an arrow's bounds include its
 *   label, an arrow label's position derives from the arrow) are followed one
 *   hop when either side changes.
 */
export class SpatialIndex {
  private entries = new Map<ExcalidrawElement["id"], Entry>();
  private grid = new Map<number, Set<Entry>>();
  private oversized = new Set<Entry>();
  private dirty = new Set<ExcalidrawElement["id"]>();
  private syncedElements: readonly NonDeletedExcalidrawElement[] | null = null;
  private syncStamp = 0;
  private queryStamp = 0;

  /** called on every element version bump, see class docs */
  static onElementMutated(element: ExcalidrawElement) {
    for (const index of liveIndices) {
      index.markMutated(element);
    }
  }

  constructor(
    private readonly getBounds: (
      element: ExcalidrawElement,
      elementsMap: ElementsMap,
    ) => Bounds,
  ) {
    liveIndices.add(this);
  }

  /**
   * Returns the elements whose bounds intersect `bounds` (edges inclusive),
   * in the order of `elements`.
   *
   * @param elements the scene's z-ordered non-deleted elements. Pass the same
   *  array instance while the scene is unchanged; a new instance triggers an
   *  O(N) reconciliation.
   * @param elementsMap used to compute element bounds
   */
  query(
    bounds: Bounds,
    elements: readonly NonDeletedExcalidrawElement[],
    elementsMap: ElementsMap,
  ): NonDeletedExcalidrawElement[] {
    this.sync(elements);
    this.flushDirty(elementsMap);

    const [qx1, qy1, qx2, qy2] = bounds;
    const stamp = ++this.queryStamp;
    const hits: Entry[] = [];

    const visit = (entry: Entry) => {
      if (entry.queryStamp === stamp) {
        return;
      }
      entry.queryStamp = stamp;
      if (
        qx1 <= entry.x2 &&
        qy1 <= entry.y2 &&
        qx2 >= entry.x1 &&
        qy2 >= entry.y1
      ) {
        hits.push(entry);
      }
    };

    for (const entry of this.oversized) {
      visit(entry);
    }

    const minCol = Math.max(-CELL_COORD_LIMIT, toCell(qx1));
    const maxCol = Math.min(CELL_COORD_LIMIT - 1, toCell(qx2));
    const minRow = Math.max(-CELL_COORD_LIMIT, toCell(qy1));
    const maxRow = Math.min(CELL_COORD_LIMIT - 1, toCell(qy2));

    // NaN query bounds fail these comparisons and visit no cells, matching
    // the (always false) intersection test
    if (minCol <= maxCol && minRow <= maxRow) {
      const queryCells = (maxCol - minCol + 1) * (maxRow - minRow + 1);
      if (queryCells <= this.grid.size) {
        for (let col = minCol; col <= maxCol; col++) {
          for (let row = minRow; row <= maxRow; row++) {
            const bucket = this.grid.get(toCellKey(col, row));
            if (bucket) {
              for (const entry of bucket) {
                visit(entry);
              }
            }
          }
        }
      } else {
        // query covers more cells than are occupied (e.g. zoomed far out),
        // so walk the occupied cells instead
        for (const [key, bucket] of this.grid) {
          const [col, row] = fromCellKey(key);
          if (
            col >= minCol &&
            col <= maxCol &&
            row >= minRow &&
            row <= maxRow
          ) {
            for (const entry of bucket) {
              visit(entry);
            }
          }
        }
      }
    }

    return this.toZOrder(hits, elements);
  }

  destroy() {
    liveIndices.delete(this);
    this.entries.clear();
    this.grid.clear();
    this.oversized.clear();
    this.dirty.clear();
    this.syncedElements = null;
  }

  private toZOrder(
    hits: Entry[],
    elements: readonly NonDeletedExcalidrawElement[],
  ) {
    if (hits.length < elements.length * LINEAR_ORDER_RATIO) {
      hits.sort((a, b) => a.order - b.order);
      return hits.map((entry) => entry.element);
    }

    const isHit = new Uint8Array(elements.length);
    for (const entry of hits) {
      isHit[entry.order] = 1;
    }
    const result: NonDeletedExcalidrawElement[] = [];
    for (let i = 0; i < elements.length; i++) {
      if (isHit[i]) {
        result.push(elements[i]);
      }
    }
    return result;
  }

  private markMutated(element: ExcalidrawElement) {
    const entry = this.entries.get(element.id);
    // a copy of an indexed element (or an element of another scene) changed
    if (!entry || entry.element !== element) {
      return;
    }
    this.markDirty(element);
  }

  private markDirty(element: ExcalidrawElement) {
    this.dirty.add(element.id);
    // an arrow label's position derives from the arrow
    if (element.boundElements) {
      for (const bound of element.boundElements) {
        if (bound.type === "text") {
          this.dirty.add(bound.id);
        }
      }
    }
    // a linear element's bounds include its label
    if ("containerId" in element && element.containerId) {
      this.dirty.add(element.containerId);
    }
  }

  private sync(elements: readonly NonDeletedExcalidrawElement[]) {
    if (this.syncedElements === elements) {
      return;
    }

    const stamp = ++this.syncStamp;

    for (let order = 0; order < elements.length; order++) {
      const element = elements[order];
      let entry = this.entries.get(element.id);
      if (!entry) {
        entry = {
          element,
          version: element.version,
          order,
          x1: NaN,
          y1: NaN,
          x2: NaN,
          y2: NaN,
          location: "none",
          minCol: 0,
          maxCol: -1,
          minRow: 0,
          maxRow: -1,
          syncStamp: stamp,
          queryStamp: 0,
        };
        this.entries.set(element.id, entry);
        this.markDirty(element);
      } else if (
        entry.element !== element ||
        entry.version !== element.version
      ) {
        entry.element = element;
        this.markDirty(element);
      }
      entry.order = order;
      entry.syncStamp = stamp;
    }

    for (const [id, entry] of this.entries) {
      if (entry.syncStamp !== stamp) {
        this.unbucket(entry);
        this.entries.delete(id);
        // its container's bounds may have included it
        this.markDirty(entry.element);
      }
    }

    this.syncedElements = elements;
  }

  private flushDirty(elementsMap: ElementsMap) {
    for (const id of this.dirty) {
      const entry = this.entries.get(id);
      if (entry) {
        this.unbucket(entry);
        entry.version = entry.element.version;
        const [x1, y1, x2, y2] = this.getBounds(entry.element, elementsMap);
        entry.x1 = x1;
        entry.y1 = y1;
        entry.x2 = x2;
        entry.y2 = y2;
        this.bucket(entry);
      }
    }
    this.dirty.clear();
  }

  private bucket(entry: Entry) {
    const { x1, y1, x2, y2 } = entry;
    const minCol = toCell(x1);
    const maxCol = toCell(x2);
    const minRow = toCell(y1);
    const maxRow = toCell(y2);

    // the negated comparisons also route NaN and inverted bounds here
    if (
      !(minCol >= -CELL_COORD_LIMIT && maxCol < CELL_COORD_LIMIT) ||
      !(minRow >= -CELL_COORD_LIMIT && maxRow < CELL_COORD_LIMIT) ||
      !(minCol <= maxCol && minRow <= maxRow) ||
      (maxCol - minCol + 1) * (maxRow - minRow + 1) > MAX_CELLS_PER_ELEMENT
    ) {
      entry.location = "oversized";
      this.oversized.add(entry);
      return;
    }

    entry.location = "grid";
    entry.minCol = minCol;
    entry.maxCol = maxCol;
    entry.minRow = minRow;
    entry.maxRow = maxRow;
    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const key = toCellKey(col, row);
        let bucket = this.grid.get(key);
        if (!bucket) {
          bucket = new Set();
          this.grid.set(key, bucket);
        }
        bucket.add(entry);
      }
    }
  }

  private unbucket(entry: Entry) {
    if (entry.location === "oversized") {
      this.oversized.delete(entry);
    } else if (entry.location === "grid") {
      for (let col = entry.minCol; col <= entry.maxCol; col++) {
        for (let row = entry.minRow; row <= entry.maxRow; row++) {
          const key = toCellKey(col, row);
          const bucket = this.grid.get(key);
          if (bucket) {
            bucket.delete(entry);
            if (!bucket.size) {
              this.grid.delete(key);
            }
          }
        }
      }
    }
    entry.location = "none";
  }
}
