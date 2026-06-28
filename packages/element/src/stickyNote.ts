import {
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

export const normalizeStickyNoteFontSize = (fontSize: number) => {
  const stepped =
    Math.round(fontSize / STICKY_NOTE_FONT_STEP) * STICKY_NOTE_FONT_STEP;
  return Math.max(STICKY_NOTE_MIN_FONT_SIZE, stepped);
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
