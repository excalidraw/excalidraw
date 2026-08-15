import {
  getObsidianCommonHost,
  type ObsidianDeviceType,
} from "./commonObsidianHost";

import type { EditorInterface, StylesPanelMode } from "./editorInterface";

export type { ObsidianDeviceType } from "./commonObsidianHost";

const normalizeStylesPanelMode = (mode: unknown): StylesPanelMode =>
  typeof mode === "string" &&
  ["tray", "full", "compact", "mobile"].includes(mode)
    ? (mode as StylesPanelMode)
    : "tray";

//zsviczian, my dirty little secrets. These are hacks I am not proud of...
let ObsidianDevice: ObsidianDeviceType | null = null;

//zsviczian, my dirty little secrets. These are hacks I am not proud of...
export let hostPlugin: any = null;

export function destroyObsidianUtils() {
  hostPlugin = null;
}

export function initializeObsidianUtils() {
  //@ts-ignore
  hostPlugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
}

export function getHostPlugin() {
  if (!hostPlugin) {
    initializeObsidianUtils();
  }
  return hostPlugin;
}

export const getObsidianDeviceInfo = () => {
  const host = getObsidianCommonHost();
  if (host) {
    return host.getDeviceInfo();
  }

  if (ObsidianDevice) {
    return ObsidianDevice;
  }
  //@ts-ignore
  const obsidianPlugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
  if (!obsidianPlugin) {
    return null;
  }
  return (ObsidianDevice = {
    ...(obsidianPlugin.getObsidianDevice() as ObsidianDeviceType),
  });
};

export const getDesktopUIMode = () => {
  const host = getObsidianCommonHost();
  if (host) {
    return normalizeStylesPanelMode(host.getDesktopUIMode());
  }

  //@ts-ignore
  const obsidianPlugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
  if (!obsidianPlugin) {
    return "tray";
  }

  return normalizeStylesPanelMode(obsidianPlugin.getPreferredUIMode());
};

export const getPreferredUIMode = (
  formFactor: EditorInterface["formFactor"],
): StylesPanelMode => {
  const host = getObsidianCommonHost();
  if (host) {
    return host.getPreferredUIMode(formFactor);
  }

  if (formFactor === "phone") {
    return getHostPlugin().settings.phoneUIMode;
  }

  if (formFactor === "tablet") {
    return getHostPlugin().settings.tabletUIMode;
  }

  return getHostPlugin().settings.desktopUIMode;
};

export function getAreaLimit() {
  return (
    getObsidianCommonHost()?.getCanvasLimits().areaLimit ??
    getHostPlugin().excalidrawConfig.areaLimit ??
    16777216
  );
}

export function getWidthHeightLimit() {
  return (
    getObsidianCommonHost()?.getCanvasLimits().widthHeightLimit ??
    getHostPlugin().excalidrawConfig.widthHeightLimit ??
    32767
  );
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

  return (
    getHostPlugin().getHighlightColor(sceneBgColor, opacity) ?? fallbackColor
  );
}
