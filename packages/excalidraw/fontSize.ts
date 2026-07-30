import { MIN_FONT_SIZE } from "@excalidraw/common";

import type { FONT_SIZES } from "@excalidraw/common";

import type { AppState, FontSizePreset } from "./types";

const VIEWPORT_FONT_SIZE_RATIOS: Record<FontSizePreset, number> = {
  sm: 0.01,
  md: 0.02,
  lg: 0.04,
  xl: 0.06,
};

export const getViewportBasedFontSizes = (
  viewportHeight: number,
  zoom: AppState["zoom"]["value"],
): Record<FontSizePreset, number> => {
  const getFontSize = (ratio: number) =>
    Math.max(MIN_FONT_SIZE, (viewportHeight * ratio) / zoom);

  return {
    sm: getFontSize(VIEWPORT_FONT_SIZE_RATIOS.sm),
    md: getFontSize(VIEWPORT_FONT_SIZE_RATIOS.md),
    lg: getFontSize(VIEWPORT_FONT_SIZE_RATIOS.lg),
    xl: getFontSize(VIEWPORT_FONT_SIZE_RATIOS.xl),
  };
};

export const getCurrentItemFontSize = (
  appState: Pick<
    AppState,
    | "currentItemFontSize"
    | "currentItemFontSizePreset"
    | "viewportBasedFontSizingEnabled"
    | "height"
    | "zoom"
  >,
) => {
  if (
    appState.viewportBasedFontSizingEnabled &&
    appState.currentItemFontSizePreset
  ) {
    return getViewportBasedFontSizes(appState.height, appState.zoom.value)[
      appState.currentItemFontSizePreset
    ];
  }

  return appState.currentItemFontSize;
};

export const getFontSizePreset = (
  fontSize: number | null,
  fontSizes: typeof FONT_SIZES | Record<FontSizePreset, number>,
): FontSizePreset | null => {
  if (fontSize === null) {
    return null;
  }

  return (
    (Object.keys(fontSizes) as FontSizePreset[]).find(
      (preset) => fontSizes[preset] === fontSize,
    ) ?? null
  );
};
