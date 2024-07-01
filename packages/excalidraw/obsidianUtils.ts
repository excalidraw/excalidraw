
//zsviczian, my dirty little secrets. These are hacks I am not proud of...
export let hostPlugin: any = null;

export const initializeObsidianUtils = (obsidianPlugin: any) => {
  hostPlugin = obsidianPlugin;
}

export const destroyObsidianUtils = () => {
  hostPlugin = null;
}

const getExcalidrawConfig = () => hostPlugin.excalidrawConfig;

export const getAreaLimit = () => {
  return getExcalidrawConfig().areaLimit ?? 16777216;
}

export const getWidthHeightLimit = () => {
  return getExcalidrawConfig().widthHeightLimit ?? 32767;
}

export const isExcaliBrainView = () => {
  const excalidrawView = hostPlugin.activeExcalidrawView;
  if(!excalidrawView) return false;
  return excalidrawView.linksAlwaysOpenInANewPane && excalidrawView.allowFrameButtonsInViewMode;
}

export const getExcalidrawContentEl = ():HTMLElement => {
  const excalidrawView = hostPlugin.activeExcalidrawView;
  if(!excalidrawView) return document.body;
  return excalidrawView.contentEl as HTMLElement;
}

export const hideFreedrawPenmodeCursor = () => {
  return !hostPlugin.settings.penModeCrosshairVisible;
}