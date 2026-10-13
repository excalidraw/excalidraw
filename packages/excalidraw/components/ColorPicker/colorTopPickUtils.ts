import { colorToHex } from "@excalidraw/common";

import type { AppState, ColorTopPick, SavedPenPreset } from "../../types";

export const getTopPickColor = (pick: ColorTopPick) =>
  typeof pick === "string" ? pick : pick.color;

const normalizedColor = (color: string) =>
  colorToHex(color) ?? color.toLowerCase();

export const isSameTopPick = (a: ColorTopPick, b: ColorTopPick) => {
  if (
    normalizedColor(getTopPickColor(a)) !== normalizedColor(getTopPickColor(b))
  ) {
    return false;
  }
  if (typeof a === "string" || typeof b === "string") {
    return typeof a === "string" && typeof b === "string";
  }
  return (
    a.strokeWidthKey === b.strokeWidthKey &&
    a.strokeStyle === b.strokeStyle &&
    a.roughness === b.roughness &&
    a.opacity === b.opacity &&
    a.fillStyle === b.fillStyle &&
    a.strokeVariability === b.strokeVariability
  );
};

export const createSavedPenPreset = (
  color: string,
  appState: Pick<
    AppState,
    | "currentItemStrokeWidthKey"
    | "currentItemStrokeStyle"
    | "currentItemRoughness"
    | "currentItemOpacity"
    | "currentItemFillStyle"
    | "currentItemStrokeVariability"
  >,
): SavedPenPreset => ({
  color,
  strokeWidthKey: appState.currentItemStrokeWidthKey,
  strokeStyle: appState.currentItemStrokeStyle,
  roughness: appState.currentItemRoughness,
  opacity: appState.currentItemOpacity,
  fillStyle: appState.currentItemFillStyle,
  strokeVariability: appState.currentItemStrokeVariability,
});

export const getPresetAppStateUpdates = (
  preset: SavedPenPreset,
): Partial<AppState> => ({
  currentItemStrokeWidthKey: preset.strokeWidthKey,
  currentItemStrokeStyle: preset.strokeStyle,
  currentItemRoughness: preset.roughness,
  currentItemOpacity: preset.opacity,
  currentItemFillStyle: preset.fillStyle,
  currentItemStrokeVariability: preset.strokeVariability,
});
