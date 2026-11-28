import { DEFAULT_EXPORT_PADDING } from "@excalidraw/common";
import { getCommonBounds, getRootElements } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

/** Expand the export region without scaling or cropping the drawing. */
export const getExportSizeForAspectRatio = (
  elements: readonly NonDeletedExcalidrawElement[],
  aspectRatio: number | null,
  padding = DEFAULT_EXPORT_PADDING,
) => {
  if (
    !aspectRatio ||
    !Number.isFinite(aspectRatio) ||
    aspectRatio <= 0 ||
    !elements.length
  ) {
    return {};
  }

  const [minX, minY, maxX, maxY] = getCommonBounds(getRootElements(elements));
  const paddedWidth = maxX - minX + padding * 2;
  const paddedHeight = maxY - minY + padding * 2;
  const width = Math.max(paddedWidth, paddedHeight * aspectRatio);
  const height = Math.max(paddedHeight, paddedWidth / aspectRatio);

  // With fit: none, exportScene adds padding outside this region.
  return {
    width: width - padding * 2,
    height: height - padding * 2,
    fit: "none" as const,
    position: "center" as const,
  };
};
