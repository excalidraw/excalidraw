import {
  MIN_FONT_SIZE,
  STICKY_NOTE_FONT_STEP,
  STICKY_NOTE_MIN_BASE_HEIGHT,
  STICKY_NOTE_MIN_BASE_WIDTH,
  STICKY_NOTE_MIN_FONT_SIZE,
  STICKY_NOTE_PADDING,
  getFontString,
} from "@excalidraw/common";

import type { Radians } from "@excalidraw/math";

import { measureText } from "./textMeasurements";
import { wrapText } from "./textWrapping";

import type {
  ExcalidrawStickyNoteElement,
  ExcalidrawTextElement,
} from "./types";

export type StickyNoteRenderPoint = {
  x: number;
  y: number;
};

export type StickyNoteTextLayout = {
  text: string;
  fontSize: number;
  width: number;
  height: number;
  container: {
    x: number;
    y: number;
    width: number;
    height: number;
    baseHeight: number;
  };
};

const STICKY_NOTE_RENDER_ROUGHNESS = [0, 1.5, 8] as const;

const seededRandom = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

const jitter = (random: () => number, amount: number) =>
  (random() * 2 - 1) * amount;

export const getStickyNoteRenderPoints = (
  element: ExcalidrawStickyNoteElement,
  {
    offsetX = 0,
    offsetY = 0,
    seedOffset = 0,
  }: {
    offsetX?: number;
    offsetY?: number;
    seedOffset?: number;
  } = {},
): StickyNoteRenderPoint[] => {
  const roughness = Math.max(0, Math.min(2, Math.round(element.roughness)));
  const amount = Math.min(
    STICKY_NOTE_RENDER_ROUGHNESS[roughness],
    Math.min(element.width, element.height) * 0.012,
  );

  if (!amount) {
    return [
      { x: offsetX, y: offsetY },
      { x: offsetX + element.width, y: offsetY },
      { x: offsetX + element.width, y: offsetY + element.height },
      { x: offsetX, y: offsetY + element.height },
    ];
  }

  const random = seededRandom(element.seed + seedOffset);

  return [
    {
      x: offsetX + jitter(random, amount),
      y: offsetY + jitter(random, amount),
    },
    {
      x: offsetX + element.width + jitter(random, amount),
      y: offsetY + jitter(random, amount),
    },
    {
      x: offsetX + element.width + jitter(random, amount),
      y: offsetY + element.height + jitter(random, amount),
    },
    {
      x: offsetX + jitter(random, amount),
      y: offsetY + element.height + jitter(random, amount),
    },
  ];
};

export const getStickyNoteEdgePolygons = (
  points: StickyNoteRenderPoint[],
  edgeWidth: number,
) => {
  const center = points.reduce(
    (acc, point) => ({
      x: acc.x + point.x / points.length,
      y: acc.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
  const innerPoints = points.map((point) => {
    const dx = center.x - point.x;
    const dy = center.y - point.y;
    const distance = Math.hypot(dx, dy);

    if (!distance) {
      return point;
    }

    const ratio = Math.min(edgeWidth / distance, 1);
    return {
      x: point.x + dx * ratio,
      y: point.y + dy * ratio,
    };
  });

  return points.map((point, index) => {
    const nextIndex = (index + 1) % points.length;
    return [
      point,
      points[nextIndex],
      innerPoints[nextIndex],
      innerPoints[index],
    ];
  });
};

export const normalizeStickyNoteFontSize = (fontSize: number) => {
  return Math.max(MIN_FONT_SIZE, fontSize);
};

const getStickyNoteFontMax = (textElement: ExcalidrawTextElement) => {
  return normalizeStickyNoteFontSize(
    textElement.fontSizeMax ?? textElement.fontSize,
  );
};

const getStickyNoteBaseWidth = (container: ExcalidrawStickyNoteElement) => {
  return Math.max(container.width, STICKY_NOTE_MIN_BASE_WIDTH);
};

const getStickyNoteBaseHeight = (container: ExcalidrawStickyNoteElement) => {
  return Math.max(
    container.baseHeight || container.height,
    STICKY_NOTE_MIN_BASE_HEIGHT,
  );
};

export const getStickyNoteAutoResizePosition = (
  container: ExcalidrawStickyNoteElement,
  nextHeight: number,
) => {
  const prevHeight = container.height;
  const delta = (prevHeight - nextHeight) / 2;
  const sin = Math.sin(container.angle as Radians);
  const cos = Math.cos(container.angle as Radians);

  return {
    x: container.x + delta * sin,
    y: container.y + delta * (1 - cos),
  };
};

export const computeStickyNoteTextLayout = (
  container: ExcalidrawStickyNoteElement,
  textElement: ExcalidrawTextElement,
  originalText = textElement.originalText,
): StickyNoteTextLayout => {
  const baseWidth = getStickyNoteBaseWidth(container);
  const baseHeight = getStickyNoteBaseHeight(container);
  const maxWidth = Math.max(baseWidth - STICKY_NOTE_PADDING * 2, 1);
  const maxHeight = Math.max(baseHeight - STICKY_NOTE_PADDING * 2, 0);
  const fontSizeMax = getStickyNoteFontMax(textElement);
  const fontSizeMin = Math.min(STICKY_NOTE_MIN_FONT_SIZE, fontSizeMax);

  const fit = (fontSize: number) => {
    const text = wrapText(
      originalText,
      getFontString({
        fontFamily: textElement.fontFamily,
        fontSize,
      }),
      maxWidth,
    );
    const metrics = measureText(
      text,
      getFontString({
        fontFamily: textElement.fontFamily,
        fontSize,
      }),
      textElement.lineHeight,
    );

    return { text, ...metrics };
  };

  if (!originalText.trim()) {
    const emptyMetrics = measureText(
      "",
      getFontString({
        fontFamily: textElement.fontFamily,
        fontSize: fontSizeMax,
      }),
      textElement.lineHeight,
    );
    const position = getStickyNoteAutoResizePosition(container, baseHeight);

    return {
      text: "",
      fontSize: fontSizeMax,
      width: emptyMetrics.width,
      height: emptyMetrics.height,
      container: {
        ...position,
        width: baseWidth,
        baseHeight,
        height: baseHeight,
      },
    };
  }

  let fontSize = fontSizeMax;
  let result = fit(fontSize);

  if (fontSizeMin !== fontSizeMax) {
    while (
      fontSize > fontSizeMin &&
      (result.width > maxWidth || result.height > maxHeight)
    ) {
      fontSize = Math.max(fontSizeMin, fontSize - STICKY_NOTE_FONT_STEP);
      result = fit(fontSize);
    }
  }

  const height = Math.max(baseHeight, result.height + STICKY_NOTE_PADDING * 2);
  const position = getStickyNoteAutoResizePosition(container, height);

  return {
    text: result.text,
    fontSize,
    width: result.width,
    height: result.height,
    container: {
      ...position,
      width: baseWidth,
      baseHeight,
      height,
    },
  };
};
