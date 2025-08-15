import { GlobalPoint } from "@excalidraw/math/types";
import type { MermaidToExcalidrawLibProps } from "./components/TTDDialog/common";
import { loadMermaidLib } from "./components/TTDDialog/MermaidToExcalidrawLib";
import { FONT_FAMILY, getVerticalOffset, ZOOM_STEP, MAX_ZOOM, MIN_ZOOM } from "@excalidraw/common";
import type { ElementsMap, ExcalidrawElement, ExcalidrawTextElement, NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import { Fonts } from "./fonts";
import type { FontMetadata } from "@excalidraw/common";
import { FONT_METADATA } from "@excalidraw/common";
import type { AppState } from "./types";
import { intersectElementWithLineSegment } from "@excalidraw/element/collision";
import { lineSegment } from "@excalidraw/math";
import { getLineHeightInPx } from "@excalidraw/element";

//zsviczian, my dirty little secrets. These are hacks I am not proud of...
export let hostPlugin: any = null;

export function destroyObsidianUtils() {
  hostPlugin = null;
}

export function initializeObsidianUtils() {
  //@ts-ignore
  hostPlugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
}

function getHostPlugin() {
  if (!hostPlugin) {
    initializeObsidianUtils();
  }
  return hostPlugin;
}

export function getAreaLimit() {
  return getHostPlugin().excalidrawConfig.areaLimit ?? 16777216;
}

export function getWidthHeightLimit() {
  return getHostPlugin().excalidrawConfig.widthHeightLimit ?? 32767;
}

export function allowDoubleTapEraser() {
  return getHostPlugin().settings.penModeDoubleTapEraser;
}

// Enable panning with right mouse button if host plugin setting allows
export function isPanWithRightMouseEnabled(): boolean {
  try {
    return !!getHostPlugin().settings?.panWithRightMouseButton;
  } catch (e) {
    return false;
  }
}

export function getMaxZoom(): number {
  return getHostPlugin().settings.zoomToFitMaxLevel ?? 1;
}

export function isExcaliBrainView() {
  const excalidrawView = getHostPlugin().activeExcalidrawView;
  if (!excalidrawView) {
    return false;
  }
  return (
    excalidrawView.linksAlwaysOpenInANewPane &&
    excalidrawView.allowFrameButtonsInViewMode
  );
}

export function getExcalidrawContentEl(): HTMLElement {
  const excalidrawView = getHostPlugin().activeExcalidrawView;
  if (!excalidrawView) {
    return document.body;
  }
  return excalidrawView.contentEl as HTMLElement;
}

export function hideFreedrawPenmodeCursor() {
  return !getHostPlugin().settings.penModeCrosshairVisible;
}

export function getOpenAIDefaultVisionModel() {
  return getHostPlugin().settings.openAIDefaultVisionModel;
}

export function getFontMetrics(fontFamily: ExcalidrawTextElement["fontFamily"], fontSize: number = 20): {
  unitsPerEm: number,
  ascender: number,
  descender: number,
  lineHeight: number,
  baseline: number,
  fontString: string
} {
  // Get the font metadata, fallback to Excalifont if not found
  const metadata = FONT_METADATA[fontFamily] ?? FONT_METADATA[FONT_FAMILY.Excalifont];
  const { unitsPerEm, ascender, descender, lineHeight } = metadata.metrics;

  // Calculate baseline offset using the existing utility function
  const lineHeightPx = getLineHeightInPx(fontSize, lineHeight as ExcalidrawTextElement["lineHeight"]);
  const baseline = getVerticalOffset(fontFamily, fontSize, lineHeightPx);

  // Get the font string from registered fonts or use font family name as fallback
  let fontString = "";
  const fontFaces = Fonts.registered.get(fontFamily);
  if (fontFaces && fontFaces.fontFaces.length > 0) {
    fontString = fontFaces.fontFaces[0].fontFace.family;
  } else {
    // Fallback to font family enum name
    const fontFamilyName = Object.entries(FONT_FAMILY).find(([_, value]) => value === fontFamily)?.[0];
    fontString = fontFamilyName || "Excalifont";
  }

  return {
    unitsPerEm,
    ascender,
    descender,
    lineHeight,
    baseline,
    fontString
  };
}

export function registerLocalFont(
  fontMetrics: FontMetadata & { name: string },
  uri: string,
) {
  FONT_METADATA[FONT_FAMILY["Local Font"]] = {
    metrics: fontMetrics.metrics,
  };
  Fonts.register("Local Font", fontMetrics, { uri });
}

export function getFontFamilies(): string[] {
  const fontFamilies: Set<string> = new Set();
  for (const fontFaces of Fonts.registered.values()) {
    if (fontFaces.metadata.local) {
      continue;
    }
    for (const font of fontFaces.fontFaces) {
      if (font.fontFace.family === "Local Font") {
        continue;
      }
      fontFamilies.add(font.fontFace.family);
    }
  }
  return Array.from(fontFamilies);
}

export async function registerFontsInCSS() {
  const styleId = "ExcalidrawFonts";
  let styleElement = document.getElementById(styleId) as HTMLStyleElement;

  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  } else {
    styleElement.textContent = "";
  }

  let cssContent = "";

  for (const fontFaces of Fonts.registered.values()) {
    if (fontFaces.metadata.local) {
      continue;
    }
    for (const font of fontFaces.fontFaces) {
      try {
        const content = await font.getContentLegacy();
        cssContent += `@font-face {font-family: ${font.fontFace.family}; src: url(${content});}\n`;
      } catch (e) {
        console.error(`Skipped inlining font "${font.toString()}"`, e);
      }
    }
  }
  styleElement.textContent = cssContent;
}

export async function getCSSFontDefinition(
  fontFamily: number,
): Promise<string> {
  const fontFaces = Fonts.registered.get(fontFamily)?.fontFaces;
  if (!fontFaces) {
    return "";
  }
  const fontFace = fontFaces[0];
  if (!fontFace) {
    return "";
  }
  const content = await fontFace.getContentLegacy();
  return `@font-face {font-family: ${fontFaces[0].fontFace.family}; src: url(${content});}`;
}

export async function loadSceneFonts(
  elements: NonDeletedExcalidrawElement[],
): Promise<FontFace[]> {
  return await Fonts.loadElementsFonts(elements);
}

export async function fetchFontFromVault(
  url: string | URL,
): Promise<ArrayBuffer | undefined> {
  url = typeof url === "string" ? url : url.toString();
  if (
    typeof url === "string" &&
    !url.startsWith("data") &&
    url.endsWith(".woff2")
  ) {
    const filename = decodeURIComponent(
      url.substring(url.lastIndexOf("/") + 1),
    );
    const arrayBuffer = await getHostPlugin().loadFontFromFile(filename);
    if (arrayBuffer) {
      return arrayBuffer;
    }
  }
}

//zsviczian (single finger panning in pen mode)
export function isTouchInPenMode(
  appState: AppState,
  event: React.PointerEvent<HTMLElement> | MouseEvent,
) {
  if (!getHostPlugin().settings.penModeSingleFingerPanning) {
    return false;
  }
  //isReactPointerEvent typecheck is here only to please typescript, else event.pointerType === "touch" should be enough
  const isReactPointerEvent = "nativeEvent" in event;
  return (
    appState.penMode &&
    (!isReactPointerEvent || event.pointerType === "touch") &&
    !["text"].includes(appState.activeTool.type)
  );
}

export async function getSharedMermaidInstance(): Promise<MermaidToExcalidrawLibProps> {
  return await getHostPlugin().getMermaid();
}

export async function loadMermaid(): Promise<MermaidToExcalidrawLibProps> {
  return await loadMermaidLib();
}


//moved here as part of https://github.com/zsviczian/excalidraw/pull/286
export const intersectElementWithLine = (
  element: ExcalidrawElement,
  // Point on the line, in absolute coordinates
  a: GlobalPoint,
  // Another point on the line, in absolute coordinates
  b: GlobalPoint,
  // If given, the element is inflated by this value
  gap: number = 0,
  elementsMap: ElementsMap,
): GlobalPoint[] | undefined => {
  return intersectElementWithLineSegment(element, elementsMap, lineSegment(a, b), gap);
};

//disable double click
export const disableDoubleClickTextEditing = () => {
  return getHostPlugin().settings.disableDoubleClickTextEditing ?? false;
}

// zoomStep: number;        // % increment per zoom action (e.g. mouse wheel)
//  zoomMin: number;         // minimum zoom percentage
//  zoomMax: number;         // maximum zoom percentage
export const getZoomStep = () => getHostPlugin().settings.zoomStep ?? ZOOM_STEP;
export const getZoomMin = () => getHostPlugin().settings.zoomMin ?? MIN_ZOOM;
export const getZoomMax = () => getHostPlugin().settings.zoomMax ?? MAX_ZOOM;
