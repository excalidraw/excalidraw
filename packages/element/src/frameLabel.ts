import { FONT_FAMILY, FRAME_STYLE } from "@excalidraw/common";

import { getFrameLikeTitle } from "./frame";
import { getTextHeight, normalizeText } from "./textMeasurements";

import type {
  ExcalidrawFrameLikeElement,
  ExcalidrawTextElement,
} from "./types";

/**
 * A frame's name as drawn on export. While editing, the name is a DOM overlay
 * (`text-overflow: ellipsis` at the frame's width -- see `App.renderFrameNames`);
 * on export each renderer draws it from this spec.
 *
 * Everything here is arithmetic: no text is measured, so a renderer can draw
 * labels without a canvas (the SVG exporter does). There is deliberately no
 * `width`: the label is left-aligned at the frame's left edge and never wider
 * than the frame, so its width can't affect layout. A renderer that needs it
 * (canvas, for the ellipsis) measures it itself.
 */
export type FrameLabel = {
  /** left edge (the frame's) */
  x: number;
  /** top edge: `FRAME_STYLE.nameOffsetY` above the frame, less the label's height */
  y: number;
  /** the label must not overflow this (the frame's width) */
  maxWidth: number;
  height: number;
  text: string;
  fontFamily: ExcalidrawTextElement["fontFamily"];
  fontSize: number;
  lineHeight: ExcalidrawTextElement["lineHeight"];
  /** unfiltered -- renderers apply the dark-mode filter as for any text */
  color: string;
};

export const getFrameLabel = (
  frame: ExcalidrawFrameLikeElement,
  { exportWithDarkMode }: { exportWithDarkMode: boolean },
): FrameLabel => {
  const text = normalizeText(getFrameLikeTitle(frame));
  const fontSize = FRAME_STYLE.nameFontSize;
  const lineHeight =
    FRAME_STYLE.nameLineHeight as ExcalidrawTextElement["lineHeight"];
  const height = getTextHeight(text, fontSize, lineHeight);

  return {
    x: frame.x,
    y: frame.y - FRAME_STYLE.nameOffsetY - height,
    maxWidth: frame.width,
    height,
    text,
    fontFamily: FONT_FAMILY.Helvetica,
    fontSize,
    lineHeight,
    color: exportWithDarkMode
      ? FRAME_STYLE.nameColorDarkTheme
      : FRAME_STYLE.nameColorLightTheme,
  };
};
