//zsviczian, my dirty little secrets. These are hacks I am not proud of...
export type ObsidianDeviceType = {
  isDesktop: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isMobile: boolean;
  isLinux: boolean;
  isMacOS: boolean;
  isWindows: boolean;
  isIOS: boolean;
  isAndroid: boolean;
};

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
  //@ts-ignore
  const obsidianPlugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
  if (!obsidianPlugin) {
    return "tray";
  }
  const desktopUIMode = obsidianPlugin.settings.desktopUIMode;
  return ["tray", "full", "compact"].includes(desktopUIMode)
    ? desktopUIMode
    : "tray";
};

export function getAreaLimit() {
  return getHostPlugin().excalidrawConfig.areaLimit ?? 16777216;
}

export function getWidthHeightLimit() {
  return getHostPlugin().excalidrawConfig.widthHeightLimit ?? 32767;
}

export function getHighlightColor(color: string, sceneBgColor: string, opacity: number = 1): string {
  return (
    getHostPlugin().getHighlightColor(color, sceneBgColor, opacity) ??
    `rgba(0,118,255,${opacity})`
  );
}
