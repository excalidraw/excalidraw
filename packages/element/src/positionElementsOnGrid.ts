import { getCommonBounds } from "./bounds";
import { type ElementUpdate, newElementWith } from "./mutateElement";

import type { ExcalidrawElement } from "./types";

// TODO rewrite (mostly vibe-coded)
export const positionElementsOnGrid = <TElement extends ExcalidrawElement>(
  elements: TElement[] | TElement[][],
  centerX: number,
  centerY: number,
  padding = 50,
): TElement[] => {
  // Ensure there are elements to position
  if (!elements || elements.length === 0) {
    return [];
  }

  const res: TElement[] = [];
  // Normalize input to work with atomic units (groups of elements)
  // If elements is a flat array, treat each element as its own atomic unit
  const atomicUnits: TElement[][] = Array.isArray(elements[0])
    ? (elements as TElement[][])
    : (elements as TElement[]).map((element) => [element]);

  // Determine the number of columns for atomic units
  // A common approach for a "grid-like" layout without specific column constraints
  // is to aim for a roughly square arrangement.
  const numUnits = atomicUnits.length;
  const numColumns = Math.max(1, Math.ceil(Math.sqrt(numUnits)));

  // Group atomic units into rows based on the calculated number of columns
  const rows: TElement[][][] = [];
  for (let i = 0; i < numUnits; i += numColumns) {
    rows.push(atomicUnits.slice(i, i + numColumns));
  }

  // Calculate properties for each row (total width, max height)
  // and the total actual height of all row content.
  let totalGridActualHeight = 0; // Sum of max heights of rows, without inter-row padding
  const rowProperties = rows.map((rowUnits) => {
    let rowWidth = 0;
    let maxUnitHeightInRow = 0;

    const unitBounds = rowUnits.map((unit) => {
      const [minX, minY, maxX, maxY] = getCommonBounds(unit);
      return {
        elements: unit,
        bounds: [minX, minY, maxX, maxY] as const,
        width: maxX - minX,
        height: maxY - minY,
      };
    });

    unitBounds.forEach((unitBound, index) => {
      rowWidth += unitBound.width;
      // Add padding between units in the same row, but not after the last one
      if (index < unitBounds.length - 1) {
        rowWidth += padding;
      }
      if (unitBound.height > maxUnitHeightInRow) {
        maxUnitHeightInRow = unitBound.height;
      }
    });

    totalGridActualHeight += maxUnitHeightInRow;
    return {
      unitBounds,
      width: rowWidth,
      maxHeight: maxUnitHeightInRow,
    };
  });

  // Calculate the total height of the grid including padding between rows
  const totalGridHeightWithPadding =
    totalGridActualHeight + Math.max(0, rows.length - 1) * padding;

  // Calculate the starting Y position to center the entire grid vertically around centerY
  let currentY = centerY - totalGridHeightWithPadding / 2;

  // Position atomic units row by row
  rowProperties.forEach((rowProp) => {
    const { unitBounds, width: rowWidth, maxHeight: rowMaxHeight } = rowProp;

    // Calculate the starting X for the current row to center it horizontally around centerX
    let currentX = centerX - rowWidth / 2;

    unitBounds.forEach((unitBound) => {
      // Calculate the offset needed to position this atomic unit
      const [originalMinX, originalMinY] = unitBound.bounds;
      const offsetX = currentX - originalMinX;
      const offsetY = currentY - originalMinY;

      // Apply the offset to all elements in this atomic unit
      unitBound.elements.forEach((element) => {
        res.push(
          newElementWith(element, {
            x: element.x + offsetX,
            y: element.y + offsetY,
          } as ElementUpdate<TElement>),
        );
      });

      // Move X for the next unit in the row
      currentX += unitBound.width + padding;
    });

    // Move Y to the starting position for the next row
    // This accounts for the tallest unit in the current row and the inter-row padding
    currentY += rowMaxHeight + padding;
  });
  return res;
};
