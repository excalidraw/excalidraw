import { getObsidianCommonHost } from "./commonObsidianHost";

import type { EditorInterface, StylesPanelMode } from "./editorInterface";

export type { ObsidianDeviceType } from "./commonObsidianHost";

const normalizeStylesPanelMode = (mode: unknown): StylesPanelMode =>
  typeof mode === "string" &&
  ["tray", "full", "compact", "mobile"].includes(mode)
    ? (mode as StylesPanelMode)
    : "tray";

export const getObsidianDeviceInfo = () =>
  getObsidianCommonHost()?.getDeviceInfo() ?? null;

export const getDesktopUIMode = () => {
  return normalizeStylesPanelMode(getObsidianCommonHost()?.getDesktopUIMode());
};

export const getPreferredUIMode = (
  formFactor: EditorInterface["formFactor"],
): StylesPanelMode => {
  return (
    getObsidianCommonHost()?.getPreferredUIMode(formFactor) ??
    (formFactor === "phone" ? "mobile" : "tray")
  );
};

export function getAreaLimit() {
  return getObsidianCommonHost()?.getCanvasLimits().areaLimit ?? 16777216;
}

export function getWidthHeightLimit() {
  return getObsidianCommonHost()?.getCanvasLimits().widthHeightLimit ?? 32767;
}

export function getHighlightColor(
  sceneBgColor: string,
  opacity: number = 1,
): string {
  const fallbackColor = `rgba(0,118,255,${opacity})`;
  const host = getObsidianCommonHost();
  if (host) {
    return host.getHighlightColor(sceneBgColor, opacity) ?? fallbackColor;
  }
  return fallbackColor;
}
