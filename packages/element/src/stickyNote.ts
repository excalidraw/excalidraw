import {
  DEFAULT_ELEMENT_PROPS,
  MIN_FONT_SIZE,
  STICKY_NOTE_FONT_STEP,
  STICKY_NOTE_MIN_BASE_HEIGHT,
  STICKY_NOTE_MIN_BASE_WIDTH,
  STICKY_NOTE_MIN_FONT_SIZE,
  STICKY_NOTE_PADDING,
  getFontString,
  isTransparent,
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

export type StickyNotePathCommand =
  | {
      type: "move";
      point: StickyNoteRenderPoint;
    }
  | {
      type: "line";
      point: StickyNoteRenderPoint;
    }
  | {
      type: "quadratic";
      control: StickyNoteRenderPoint;
      point: StickyNoteRenderPoint;
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
const STICKY_NOTE_CORNER_RADIUS_RATIO = 0.04;
const STICKY_NOTE_MAX_CORNER_RADIUS = 16;

export const normalizeStickyNoteStrokeColor = (
  strokeColor: string | null | undefined,
) => {
  return !strokeColor || isTransparent(strokeColor)
    ? DEFAULT_ELEMENT_PROPS.strokeColor
    : strokeColor;
};

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

const pointAtDistance = (
  from: StickyNoteRenderPoint,
  to: StickyNoteRenderPoint,
  distance: number,
) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);

  if (!length) {
    return from;
  }

  const ratio = Math.min(distance / length, 1);
  return {
    x: from.x + dx * ratio,
    y: from.y + dy * ratio,
  };
};

export const getStickyNoteCornerRadius = (
  element: ExcalidrawStickyNoteElement,
) => {
  if (!element.roundness) {
    return 0;
  }

  return Math.min(
    Math.min(element.width, element.height) * STICKY_NOTE_CORNER_RADIUS_RATIO,
    STICKY_NOTE_MAX_CORNER_RADIUS,
  );
};

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

export const getStickyNotePathCommands = (
  points: StickyNoteRenderPoint[],
  radius: number,
): StickyNotePathCommand[] => {
  if (!radius) {
    return [
      { type: "move", point: points[0] },
      ...points.slice(1).map(
        (point): StickyNotePathCommand => ({
          type: "line",
          point,
        }),
      ),
    ];
  }

  const corners = points.map((point, index) => {
    const prev = points[(index + points.length - 1) % points.length];
    const next = points[(index + 1) % points.length];
    const cornerRadius = Math.min(
      radius,
      Math.hypot(point.x - prev.x, point.y - prev.y) / 2,
      Math.hypot(point.x - next.x, point.y - next.y) / 2,
    );

    return {
      point,
      start: pointAtDistance(point, prev, cornerRadius),
      end: pointAtDistance(point, next, cornerRadius),
    };
  });

  const commands: StickyNotePathCommand[] = [
    { type: "move", point: corners[0].end },
  ];

  for (let index = 1; index < corners.length; index++) {
    commands.push(
      { type: "line", point: corners[index].start },
      {
        type: "quadratic",
        control: corners[index].point,
        point: corners[index].end,
      },
    );
  }

  commands.push(
    { type: "line", point: corners[0].start },
    {
      type: "quadratic",
      control: corners[0].point,
      point: corners[0].end,
    },
  );

  return commands;
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
