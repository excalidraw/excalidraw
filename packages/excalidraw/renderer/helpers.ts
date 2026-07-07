import { COLOR_WHITE, THEME, applyDarkModeFilter } from "@excalidraw/common";

import type { StaticCanvasRenderConfig } from "../scene/types";
import type { AppState, StaticCanvasAppState } from "../types";

export const fillCircle = (
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  stroke: boolean,
  fill = true,
) => {
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  if (fill) {
    context.fill();
  }
  if (stroke) {
    context.stroke();
  }
};

export const getNormalizedCanvasDimensions = (
  canvas: HTMLCanvasElement,
  scale: number,
): [number, number] => {
  // When doing calculations based on canvas width we should used normalized one
  return [canvas.width / scale, canvas.height / scale];
};

export const bootstrapCanvas = ({
  canvas,
  scale,
  normalizedWidth,
  normalizedHeight,
  theme,
  isExporting,
  viewBackgroundColor,
}: {
  canvas: HTMLCanvasElement;
  scale: number;
  normalizedWidth: number;
  normalizedHeight: number;
  theme?: AppState["theme"];
  isExporting?: StaticCanvasRenderConfig["isExporting"];
  viewBackgroundColor?: StaticCanvasAppState["viewBackgroundColor"];
}): CanvasRenderingContext2D => {
  const context = canvas.getContext("2d")!;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.scale(scale, scale);

  // Paint background
  if (typeof viewBackgroundColor === "string") {
    // An opaque fill repaints every pixel, so clearRect would be redundant.
    // For anything else — transparency, or a value we can't be certain about
    // (e.g. corrupted persisted state like "0000") — clear first so the
    // previous frame can't bleed through.
    //
    // We skip opaque #RRGGBB and #RGB hex colors as a quick optimization.
    const isOpaque = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(viewBackgroundColor);

    if (!isOpaque) {
      context.clearRect(0, 0, normalizedWidth, normalizedHeight);
    }

    if (viewBackgroundColor !== "transparent") {
      context.save();
      // The canvas silently ignores an invalid fillStyle, which would leave a
      // stale color from a previous draw. Seed a sane default so corrupted
      // values fall back to white instead of painting garbage.
      context.fillStyle = COLOR_WHITE;
      context.fillStyle = applyDarkModeFilter(
        viewBackgroundColor,
        theme === THEME.DARK,
      );
      context.fillRect(0, 0, normalizedWidth, normalizedHeight);
      context.restore();
    }
  } else {
    context.clearRect(0, 0, normalizedWidth, normalizedHeight);
  }

  return context;
};

export const strokeRectWithRotation_simple = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  cx: number,
  cy: number,
  angle: number,
  fill: boolean = false,
  /** should account for zoom */
  radius: number = 0,
) => {
  context.save();
  context.translate(cx, cy);
  context.rotate(angle);
  if (fill) {
    context.fillRect(x - cx, y - cy, width, height);
  }
  if (radius && context.roundRect) {
    context.beginPath();
    context.roundRect(x - cx, y - cy, width, height, radius);
    context.stroke();
    context.closePath();
  } else {
    context.strokeRect(x - cx, y - cy, width, height);
  }
  context.restore();
};
