//zsviczian, my dirty little secrets. These are hacks I am not proud of...
export let hostPlugin: any = null;

export function destroyObsidianUtils() {
  hostPlugin = null;
}

export function initializeObsidianUtils (obsidianPlugin: any) {
  hostPlugin = obsidianPlugin;
}

export function getAreaLimit() {
  return hostPlugin.excalidrawConfig.areaLimit ?? 16777216;
}

export function getWidthHeightLimit() {
  return hostPlugin.excalidrawConfig.widthHeightLimit ?? 32767;
}

export function isExcaliBrainView() {
  const excalidrawView = hostPlugin.activeExcalidrawView;
  if(!excalidrawView) return false;
  return excalidrawView.linksAlwaysOpenInANewPane && excalidrawView.allowFrameButtonsInViewMode;
}

export function getExcalidrawContentEl():HTMLElement {
  const excalidrawView = hostPlugin.activeExcalidrawView;
  if(!excalidrawView) return document.body;
  return excalidrawView.contentEl as HTMLElement;
}

export function hideFreedrawPenmodeCursor() {
  return !hostPlugin.settings.penModeCrosshairVisible;
}
