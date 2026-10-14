import { getCommonBounds, isFreeDrawElement } from "@excalidraw/element";

import type { Bounds } from "@excalidraw/common";
import type {
  ExcalidrawElement,
  ExcalidrawFreeDrawElement,
} from "@excalidraw/element/types";

export type HandwritingLine = {
  key: string;
  elements: ExcalidrawFreeDrawElement[];
  bounds: Bounds;
};

export type HandwritingResult = HandwritingLine & { text: string };

/** TrOCR recognizes one line at a time. Join nearby strokes, not entire scenes. */
export const getHandwritingLines = (
  elements: readonly ExcalidrawElement[],
): HandwritingLine[] => {
  const strokes = elements
    .filter(
      (element): element is ExcalidrawFreeDrawElement =>
        !element.isDeleted &&
        isFreeDrawElement(element) &&
        element.points.length > 0 &&
        element.opacity > 0,
    )
    .map((element) => ({ element, bounds: getCommonBounds([element]) }))
    .sort(
      (a, b) =>
        a.bounds[0] - b.bounds[0] || a.element.id.localeCompare(b.element.id),
    );
  const lines: HandwritingLine[] = [];

  for (const { element, bounds } of strokes) {
    const height = Math.max(bounds[3] - bounds[1], element.strokeWidth);
    const line = lines.find((candidate) => {
      if (candidate.elements[0].frameId !== element.frameId) {
        return false;
      }
      const [x1, y1, x2, y2] = candidate.bounds;
      const lineHeight = Math.max(y2 - y1, element.strokeWidth);
      const overlap = Math.min(y2, bounds[3]) - Math.max(y1, bounds[1]);
      return (
        bounds[0] <= x2 + Math.max(height, lineHeight) * 1.5 &&
        bounds[2] >= x1 &&
        overlap >= -Math.max(height, lineHeight) * 0.35 &&
        Math.abs((bounds[1] + bounds[3]) / 2 - (y1 + y2) / 2) <=
          Math.max(height, lineHeight) * 0.85
      );
    });
    if (line) {
      line.elements.push(element);
      line.bounds = [
        Math.min(line.bounds[0], bounds[0]),
        Math.min(line.bounds[1], bounds[1]),
        Math.max(line.bounds[2], bounds[2]),
        Math.max(line.bounds[3], bounds[3]),
      ];
    } else {
      lines.push({ key: "", elements: [element], bounds });
    }
  }

  for (const line of lines) {
    // Versions include movement, rotation, resizing and erasure. Sorting makes
    // the cache independent of scene stacking order.
    line.key = line.elements
      .map(
        (element) => `${element.id}:${element.version}:${element.versionNonce}`,
      )
      .sort()
      .join(",");
  }
  return lines.sort((a, b) => a.bounds[1] - b.bounds[1]);
};

/** Normalize stroke colors for recognition, including white ink in dark mode. */
export const rasterizeHandwriting = (
  line: HandwritingLine,
  ownerDocument: Document,
): ImageData => {
  const [x1, y1, x2, y2] = line.bounds;
  const padding = 12;
  const scale = Math.min(
    4,
    96 / Math.max(1, y2 - y1),
    2024 / Math.max(1, x2 - x1),
  );
  const canvas = ownerDocument.createElement("canvas");
  canvas.width = Math.ceil((x2 - x1) * scale) + padding * 2;
  canvas.height = Math.ceil((y2 - y1) * scale) + padding * 2;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable");
  }
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(padding - x1 * scale, padding - y1 * scale);
  context.scale(scale, scale);
  context.strokeStyle = "black";
  context.fillStyle = "black";
  context.lineCap = "round";
  context.lineJoin = "round";

  for (const element of line.elements) {
    if (!element.points.length) {
      continue;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of element.points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const cx = element.x + (minX + maxX) / 2;
    const cy = element.y + (minY + maxY) / 2;
    context.save();
    context.translate(cx, cy);
    context.rotate(element.angle);
    context.translate(element.x - cx, element.y - cy);
    context.lineWidth = element.strokeWidth;
    context.beginPath();
    context.moveTo(element.points[0][0], element.points[0][1]);
    for (const [x, y] of element.points.slice(1)) {
      context.lineTo(x, y);
    }
    if (element.points.length === 1) {
      context.arc(
        element.points[0][0],
        element.points[0][1],
        element.strokeWidth / 2,
        0,
        Math.PI * 2,
      );
      context.fill();
    } else {
      context.stroke();
    }
    context.restore();
  }
  return context.getImageData(0, 0, canvas.width, canvas.height);
};
