import { DOMElement } from "react";

//zsviczian, my dirty little secrets. These are hacks I am not proud of...
let OBSIDIAN_PLUGIN:any;
let EXCALIDRAW_CONFIG:any;
const setObsidianPlugin = () => {
  //@ts-ignore
  OBSIDIAN_PLUGIN = app?.plugins?.plugins?.["obsidian-excalidraw-plugin"];
  EXCALIDRAW_CONFIG = OBSIDIAN_PLUGIN?.excalidrawConfig;
}

export const getAreaLimit = () => {
  if(!OBSIDIAN_PLUGIN) {
    setObsidianPlugin();
  } 
  return EXCALIDRAW_CONFIG?.areaLimit ?? 16777216;
}

export const getWidthHeightLimit = () => {
  if(!OBSIDIAN_PLUGIN) {
    setObsidianPlugin();
  }
  return EXCALIDRAW_CONFIG?.widthHeightLimit ?? 32767;
}

export const isExcaliBrainView = () => {
  if(!OBSIDIAN_PLUGIN) {
    setObsidianPlugin();
  }
  const excalidrawView = OBSIDIAN_PLUGIN?.activeExcalidrawView;
  if(!excalidrawView) return false;
  return excalidrawView.linksAlwaysOpenInANewPane && excalidrawView.allowFrameButtonsInViewMode;
}

export const getExcalidrawContentEl = ():HTMLElement => {
  if(!OBSIDIAN_PLUGIN) {
    setObsidianPlugin();
  }
  const excalidrawView = OBSIDIAN_PLUGIN?.activeExcalidrawView;
  if(!excalidrawView) return document.body;
  return excalidrawView.contentEl as HTMLElement;
}

export const hideFreedrawPenmodeCursor = () => {
  if(!OBSIDIAN_PLUGIN) {
    setObsidianPlugin();
  }
  if(!OBSIDIAN_PLUGIN) return true;
  return !OBSIDIAN_PLUGIN.settings.penModeCrosshairVisible;
}