import { isBoundToContainer } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

/**
 * Deterministic reading order over the 2D scene (WCAG 1.3.2), following the
 * row-band linearization used by tldraw/Miro: elements are clustered into
 * horizontal bands by vertical overlap, bands read top-to-bottom, elements
 * within a band left-to-right.
 *
 * Bound text elements are skipped — they are read as part of their
 * container's accessible name.
 */
export const getSceneReadingOrder = <T extends ExcalidrawElement>(
  elements: readonly T[],
): T[] => {
  const candidates = elements
    .filter(
      (element) =>
        !element.isDeleted &&
        element.type !== "selection" &&
        !isBoundToContainer(element),
    )
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));

  const bands: T[][] = [];
  let bandBottom = -Infinity;

  for (const element of candidates) {
    if (!bands.length || element.y >= bandBottom) {
      bands.push([element]);
      bandBottom = element.y + element.height;
    } else {
      bands[bands.length - 1].push(element);
      bandBottom = Math.max(bandBottom, element.y + element.height);
    }
  }

  return bands.flatMap((band) =>
    band.sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id)),
  );
};
