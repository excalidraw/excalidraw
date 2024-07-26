import { FreedrawIcon } from "./components/icons";
import { FONT_FAMILY } from "./constants";
import { Fonts, register } from "./fonts";
import { FONT_METADATA, FontMetadata, LOCAL_FONT_PROTOCOL } from "./fonts/metadata";

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

export function registerLocalFont(fontMetrics: FontMetadata & {name: string}, uri: string) {
  const _register = register.bind({registered: Fonts.registered});
  FONT_METADATA[FONT_FAMILY["Local Font"]] = {metrics: fontMetrics.metrics, icon: FreedrawIcon};
  _register("Local Font", fontMetrics, {uri});
}

export function getFontFamilies(): string[] {
  const fontFamilies:string[] = [];
  for (const fontFaces of Fonts.registered.values()) {
    for (const font of fontFaces.fontFaces.filter(font => 
      font.fontFace.weight === "400" &&
      font.url.protocol !== LOCAL_FONT_PROTOCOL,
    )) {
      fontFamilies.push(font.fontFace.family);
    }
  }
  return fontFamilies;
}

export async function registerFontsInCSS() {
  const styleId = 'ExcalidrawFonts';
  let styleElement = document.getElementById(styleId) as HTMLStyleElement;

  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  } else {
    styleElement.textContent = '';
  }

  let cssContent = '';

  for (const fontFaces of Fonts.registered.values()) {
    for (const font of fontFaces.fontFaces.filter(font => 
      font.fontFace.weight === "400" &&
      font.url.protocol !== LOCAL_FONT_PROTOCOL,
    )) {
      try {
        const content = await font.getContent();
        cssContent += `@font-face {font-family: ${font.fontFace.family}; src: url(${content});}\n`;
      } catch (e) {
        console.error(
          `Skipped inlining font with URL "${font.url.toString()}"`,
          e,
        );
      }
    }
  }
  styleElement.textContent = cssContent;
}

export async function getFontDefinition(fontFamily: number): Promise<string> {
  const fontFaces = Fonts.registered.get(fontFamily)?.fontFaces;
  if (!fontFaces) return "";
  const fontFace = fontFaces.find(font => font.url.protocol !== LOCAL_FONT_PROTOCOL && font.fontFace.weight === "400") 
    ?? fontFaces.find(font => font.url.protocol !== LOCAL_FONT_PROTOCOL);
  if (!fontFace) return "";
  return await fontFace.getContent();
}