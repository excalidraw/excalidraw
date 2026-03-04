import {
  COLOR_CHARCOAL_BLACK,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  VERTICAL_ALIGN,
} from "@excalidraw/common";

import type { Radians } from "@excalidraw/math";

export const CARTESIAN_BASE_SLOT_WIDTH = 44;
export const CARTESIAN_BAR_SLOT_EXTRA_PER_SERIES = 22;
export const CARTESIAN_BAR_SLOT_EXTRA_MAX = 66;
export const CARTESIAN_LINE_SLOT_WIDTH = 48;
export const CARTESIAN_GAP = 14;
export const CARTESIAN_BAR_HEIGHT = 304;
export const CARTESIAN_LINE_HEIGHT = 320;
export const CARTESIAN_LABEL_ROTATION = 5.87 as Radians;
export const CARTESIAN_LABEL_MIN_WIDTH = 28;
export const CARTESIAN_LABEL_SLOT_PADDING = 4;
export const CARTESIAN_LABEL_AXIS_CLEARANCE = 2;
export const CARTESIAN_LABEL_MAX_WIDTH_BUFFER = 10;
export const CARTESIAN_LABEL_ROTATED_WIDTH_BUFFER = 10;
export const CARTESIAN_LABEL_OVERFLOW_PREFERENCE_BUFFER = 8;

export const BAR_GAP = 12;
export const BAR_HEIGHT = 256;
export const GRID_OPACITY = 10;

export const RADAR_GRID_LEVELS = 4;
export const RADAR_LABEL_OFFSET = BAR_GAP * 2;
export const RADAR_PADDING = BAR_GAP * 2;
export const RADAR_SINGLE_SERIES_LOG_SCALE_THRESHOLD = 100;
export const RADAR_AXIS_LABEL_MAX_WIDTH = 140;
export const RADAR_AXIS_LABEL_ALIGNMENT_THRESHOLD = 0.35;
export const RADAR_AXIS_LABEL_CLEARANCE = BAR_GAP / 2;
export const RADAR_LEGEND_SWATCH_SIZE = 20;
export const RADAR_LEGEND_ITEM_GAP = BAR_GAP * 2;
export const RADAR_LEGEND_TEXT_GAP = BAR_GAP;

// Put all common chart element properties here so properties dialog
// shows stable values when selecting chart groups.
export const commonProps = {
  fillStyle: "hachure",
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: DEFAULT_FONT_SIZE,
  opacity: 100,
  roughness: 1,
  strokeColor: COLOR_CHARCOAL_BLACK,
  roundness: null,
  strokeStyle: "solid",
  strokeWidth: 1,
  verticalAlign: VERTICAL_ALIGN.MIDDLE,
  locked: false,
} as const;

export type CartesianChartType = "bar" | "line";

export type CartesianChartLayout = {
  slotWidth: number;
  gap: number;
  chartHeight: number;
  xLabelMaxWidth: number;
};
