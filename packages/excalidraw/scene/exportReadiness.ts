import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

export type ExportReadinessWarningType =
  | "emptyText"
  | "lowOpacity"
  | "farAwayElement";

export type ExportReadinessWarning = {
  type: ExportReadinessWarningType;
  count: number;
};

const LOW_OPACITY_THRESHOLD = 10;
const FAR_AWAY_DISTANCE_THRESHOLD = 5000;

export const getExportReadinessWarnings = (
  elements: readonly NonDeletedExcalidrawElement[],
): ExportReadinessWarning[] => {
  const warnings: ExportReadinessWarning[] = [];

  const emptyTextCount = elements.filter((element) => {
    return (
      element.type === "text" &&
      "text" in element &&
      element.text.trim().length === 0
    );
  }).length;

  const lowOpacityCount = elements.filter((element) => {
    return element.opacity <= LOW_OPACITY_THRESHOLD;
  }).length;

  if (emptyTextCount > 0) {
    warnings.push({
      type: "emptyText",
      count: emptyTextCount,
    });
  }

  if (lowOpacityCount > 0) {
    warnings.push({
      type: "lowOpacity",
      count: lowOpacityCount,
    });
  }

  if (elements.length > 1) {
    const centerX =
      elements.reduce((sum, element) => sum + element.x, 0) / elements.length;
    const centerY =
      elements.reduce((sum, element) => sum + element.y, 0) / elements.length;

    const farAwayElementCount = elements.filter((element) => {
      const distanceX = Math.abs(element.x - centerX);
      const distanceY = Math.abs(element.y - centerY);

      return (
        distanceX > FAR_AWAY_DISTANCE_THRESHOLD ||
        distanceY > FAR_AWAY_DISTANCE_THRESHOLD
      );
    }).length;

    if (farAwayElementCount > 0) {
      warnings.push({
        type: "farAwayElement",
        count: farAwayElementCount,
      });
    }
  }

  return warnings;
};
