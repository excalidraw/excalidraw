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
