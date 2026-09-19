import type { Bounds } from "@excalidraw/common";

import { aabbForElement } from "./bounds";
import { isBindableElement, isFrameLikeElement } from "./typeChecks";

import type {
  ElementsMap,
  ExcalidrawBindableElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "./types";

/**
 * Side of a bucket, in scene units. Elbow arrow routing asks for the corridor
 * between two shapes, which is usually a few hundred units across, so a cell
 * of this size keeps a typical query down to a handful of buckets while
 * leaving the bucket map small enough to rebuild cheaply.
 */
const CELL_SIZE = 512;

/**
 * An element spanning more than this many cells is kept in a separate list
 * that every query scans, rather than being written into each cell it covers.
 * Without it a single board-sized shape would dominate the build cost.
 */
const MAX_CELLS_PER_ELEMENT = 64;

/**
 * Above this many cells a query would touch, scanning every entry is cheaper
 * than walking the buckets.
 */
const MAX_CELLS_PER_QUERY = 4096;

const cellKey = (col: number, row: number) => `${col}:${row}`;

const boundsIntersect = (a: Bounds, b: Bounds) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

type Entry = {
  element: NonDeleted<ExcalidrawBindableElement>;
  bounds: Bounds;
};

/**
 * A uniform grid over the scene's bindable elements, so a router can ask
 * "what is near this corridor?" without walking the whole scene.
 *
 * Bounds are the rotation-aware AABBs, captured at build time — the index is
 * a snapshot and must be rebuilt when elements change. {@link Scene} owns the
 * only long-lived instance and rebuilds it whenever its element generation
 * moves on.
 */
export class BindableElementIndex {
  private entries: Entry[] = [];
  private cells = new Map<string, number[]>();
  private oversized: number[] = [];

  constructor(
    elements: readonly NonDeletedExcalidrawElement[],
    elementsMap: ElementsMap,
  ) {
    for (const element of elements) {
      // Frames are containers a route travels through, not around, so they
      // never belong in the index. Locked shapes DO: locking says "don't let
      // me edit this", not "pretend it isn't there".
      if (
        element.isDeleted ||
        isFrameLikeElement(element) ||
        !isBindableElement(element)
      ) {
        continue;
      }

      const bounds = aabbForElement(element, elementsMap);
      const index =
        this.entries.push({
          element: element as NonDeleted<ExcalidrawBindableElement>,
          bounds,
        }) - 1;

      const minCol = Math.floor(bounds[0] / CELL_SIZE);
      const minRow = Math.floor(bounds[1] / CELL_SIZE);
      const maxCol = Math.floor(bounds[2] / CELL_SIZE);
      const maxRow = Math.floor(bounds[3] / CELL_SIZE);

      if (
        (maxCol - minCol + 1) * (maxRow - minRow + 1) >
        MAX_CELLS_PER_ELEMENT
      ) {
        this.oversized.push(index);
        continue;
      }

      for (let col = minCol; col <= maxCol; col++) {
        for (let row = minRow; row <= maxRow; row++) {
          const key = cellKey(col, row);
          const cell = this.cells.get(key);

          if (cell) {
            cell.push(index);
          } else {
            this.cells.set(key, [index]);
          }
        }
      }
    }
  }

  /**
   * The bindable elements whose bounds overlap `bounds`, in scene order.
   *
   * Scene order matters: it is the same on every client, which is what keeps
   * a route computed from these elements deterministic across collaborators.
   */
  query(bounds: Bounds): Entry[] {
    const minCol = Math.floor(bounds[0] / CELL_SIZE);
    const minRow = Math.floor(bounds[1] / CELL_SIZE);
    const maxCol = Math.floor(bounds[2] / CELL_SIZE);
    const maxRow = Math.floor(bounds[3] / CELL_SIZE);

    const cellCount = (maxCol - minCol + 1) * (maxRow - minRow + 1);

    if (cellCount > MAX_CELLS_PER_QUERY) {
      return this.entries.filter((entry) =>
        boundsIntersect(entry.bounds, bounds),
      );
    }

    const seen = new Set<number>();

    for (const index of this.oversized) {
      seen.add(index);
    }

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const cell = this.cells.get(cellKey(col, row));

        if (cell) {
          for (const index of cell) {
            seen.add(index);
          }
        }
      }
    }

    return Array.from(seen)
      .sort((a, b) => a - b)
      .map((index) => this.entries[index])
      .filter((entry) => boundsIntersect(entry.bounds, bounds));
  }
}
