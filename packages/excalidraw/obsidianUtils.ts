import {
  FONT_FAMILY,
  getVerticalOffset,
  ZOOM_STEP,
  MAX_ZOOM,
  MIN_ZOOM,
  DEFAULT_ELEMENT_STROKE_COLOR_PALETTE,
  //  TOUCH_CTX_MENU_TIMEOUT,
  //  DRAGGING_THRESHOLD,
  deriveStylesPanelMode,
} from "@excalidraw/common";

import { FONT_METADATA } from "@excalidraw/common";

import { intersectElementWithLineSegment } from "@excalidraw/element/collision";
import { lineSegment } from "@excalidraw/math";


import {
  getLineHeightInPx,
  isArrowElement,
  isBindableElement,
  LinearElementEditor,
  ShapeCache,
  updateBoundPoint,
} from "@excalidraw/element";

import { getHostPlugin } from "@excalidraw/common/commonObsidianUtils";

import type { Scene, Store } from "@excalidraw/element";

import type { GlobalPoint, LocalPoint } from "@excalidraw/math";

import type { FontMetadata } from "@excalidraw/common";
import type {
  ElementsMap,
  ExcalidrawArrowElement,
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { MermaidConfig } from "@excalidraw/mermaid-to-excalidraw";

import type { MermaidToExcalidrawResult } from "@excalidraw/mermaid-to-excalidraw/dist/interfaces";

import { Fonts } from "./fonts";
import { loadMermaidLib } from "./components/TTDDialog/MermaidToExcalidrawLib";
import { getObsidianExcalidrawHost } from "./obsidianExcalidrawHost";

import type { AppClassProperties, AppState } from "./types";

interface MermaidToExcalidrawLibProps {
  loaded: boolean;
  api: Promise<{
    parseMermaidToExcalidraw: (
      definition: string,
      config?: MermaidConfig,
    ) => Promise<MermaidToExcalidrawResult>;
  }>;
}

export function allowDoubleTapEraser() {
  const host = getObsidianExcalidrawHost();
  if (host) {
    return host.isDoubleTapEraserEnabled();
  }
  return getHostPlugin().settings.penModeDoubleTapEraser;
}

//mfuria #329. Enable panning with right mouse button if host plugin setting allows
export function isPanWithRightMouseEnabled(): boolean {
  try {
    const host = getObsidianExcalidrawHost();
    if (host) {
      return !!host.isRightClickPanEnabled();
    }
    return !!getHostPlugin().settings?.panWithRightMouseButton;
  } catch (e) {
    return false;
  }
}

export function getMaxZoom(): number {
  const host = getObsidianExcalidrawHost();
  if (host) {
    return host.getZoomToFitMaxLevel() ?? 1;
  }
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
  const host = getObsidianExcalidrawHost();
  if (host) {
    return !host.isPenModeCrosshairVisible();
  }
  return !getHostPlugin().settings.penModeCrosshairVisible;
}

export function getOpenAIDefaultVisionModel() {
  return getHostPlugin().settings.openAIDefaultVisionModel;
}

export function getFontMetrics(
  fontFamily: ExcalidrawTextElement["fontFamily"],
  fontSize: number = 20,
): {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  lineHeight: number;
  baseline: number;
  fontString: string;
} {
  // Get the font metadata, fallback to Excalifont if not found
  const metadata =
    FONT_METADATA[fontFamily] ?? FONT_METADATA[FONT_FAMILY.Excalifont];
  const { unitsPerEm, ascender, descender, lineHeight } = metadata.metrics;

  // Calculate baseline offset using the existing utility function
  const lineHeightPx = getLineHeightInPx(
    fontSize,
    lineHeight as ExcalidrawTextElement["lineHeight"],
  );
  const baseline = getVerticalOffset(fontFamily, fontSize, lineHeightPx);

  // Get the font string from registered fonts or use font family name as fallback
  let fontString = "";
  const fontFaces = Fonts.registered.get(fontFamily);
  if (fontFaces && fontFaces.fontFaces.length > 0) {
    fontString = fontFaces.fontFaces[0].fontFace.family;
  } else {
    // Fallback to font family enum name
    const fontFamilyName = Object.entries(FONT_FAMILY).find(
      ([_, value]) => value === fontFamily,
    )?.[0];
    fontString = fontFamilyName || "Excalifont";
  }

  return {
    unitsPerEm,
    ascender,
    descender,
    lineHeight,
    baseline,
    fontString,
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

export const getDefaultColorPalette = (): readonly (readonly [
  string,
  string,
  string,
  string,
  string,
])[] => {
  const isColorTuple = (
    value: unknown,
  ): value is readonly [string, string, string, string, string] =>
    Array.isArray(value) &&
    value.length === 5 &&
    value.every((entry) => typeof entry === "string");

  return Object.values(DEFAULT_ELEMENT_STROKE_COLOR_PALETTE).filter(
    isColorTuple,
  ) as readonly (readonly [string, string, string, string, string])[];
};

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
  const host = getObsidianExcalidrawHost();
  const isSingleFingerPanningEnabled = host
    ? host.isSingleFingerPanningEnabled()
    : getHostPlugin().settings.penModeSingleFingerPanning;
  if (!isSingleFingerPanningEnabled) {
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
  return intersectElementWithLineSegment(
    element,
    elementsMap,
    lineSegment(a, b),
    gap,
  );
};

//disable double click
export const disableDoubleClickTextEditing = () => {
  const host = getObsidianExcalidrawHost();
  if (host) {
    return host.isDoubleClickTextEditingDisabled() ?? false;
  }
  return getHostPlugin().settings.disableDoubleClickTextEditing ?? false;
};

// zoomStep: number;        // % increment per zoom action (e.g. mouse wheel)
//  zoomMin: number;         // minimum zoom percentage
//  zoomMax: number;         // maximum zoom percentage
export const getZoomStep = () => {
  const host = getObsidianExcalidrawHost();
  return host
    ? host.getZoomStep() ?? ZOOM_STEP
    : getHostPlugin().settings.zoomStep ?? ZOOM_STEP;
};
export const getZoomMin = () => {
  const host = getObsidianExcalidrawHost();
  return host
    ? host.getZoomMin() ?? MIN_ZOOM
    : getHostPlugin().settings.zoomMin ?? MIN_ZOOM;
};
export const getZoomMax = () => {
  const host = getObsidianExcalidrawHost();
  return host
    ? host.getZoomMax() ?? MAX_ZOOM
    : getHostPlugin().settings.zoomMax ?? MAX_ZOOM;
};

export const runAction = (action: string): void => {
  getHostPlugin()?.runAction(action);
};

export const t2 = (key: string): string => {
  return getHostPlugin()?.getLabel(key) ?? key;
};

export const shouldDisableZoom = (appState: AppState): boolean => {
  if (appState.activeEmbeddable?.state !== "active") {
    return false;
  }
  if (!appState.activeEmbeddable?.element) {
    return false;
  }
  if (appState.activeEmbeddable.element.link?.match(/\.pdf(#[^\]]+)?]]/i)) {
    return true;
  }
  return false;
};

export const isFullPanelMode = (app: AppClassProperties): boolean => {
  const stylesPanelMode = deriveStylesPanelMode(app.editorInterface);
  return stylesPanelMode === "full" || stylesPanelMode === "tray";
};

export const isContextMenuDisabled = (): boolean => {
  const host = getObsidianExcalidrawHost();
  if (host) {
    return host.isContextMenuDisabled() ?? false;
  }
  return getHostPlugin().settings.disableContextMenu ?? false;
};

export const refreshAllArrows = (scene: Scene, store: Store) => {
  const elements = scene.getNonDeletedElements();
  const elementsMap = scene.getNonDeletedElementsMap();
  let didMutate = false;

  for (const el of elements) {
    if (!isArrowElement(el)) {
      continue;
    }

    const startTargetRaw =
      el.startBinding && elementsMap.get(el.startBinding.elementId);
    const endTargetRaw =
      el.endBinding && elementsMap.get(el.endBinding.elementId);

    const startTarget =
      startTargetRaw && isBindableElement(startTargetRaw)
        ? startTargetRaw
        : undefined;
    const endTarget =
      endTargetRaw && isBindableElement(endTargetRaw)
        ? endTargetRaw
        : undefined;

    if (!startTarget && !endTarget) {
      continue;
    }

    const draft = { ...el } as NonDeleted<ExcalidrawArrowElement>;
    const pointUpdates = new Map<number, { point: LocalPoint }>();

    if (draft.startBinding && startTarget) {
      const point = updateBoundPoint(
        draft,
        "startBinding",
        draft.startBinding,
        startTarget,
        elementsMap,
      );
      if (point) {
        pointUpdates.set(0, { point });
      }
    }

    if (draft.endBinding && endTarget) {
      const point = updateBoundPoint(
        draft,
        "endBinding",
        draft.endBinding,
        endTarget,
        elementsMap,
      );
      if (point) {
        pointUpdates.set(draft.points.length - 1, { point });
      }
    }

    if (!pointUpdates.size) {
      continue;
    }

    const startBindingElement = el.startBinding
      ? elementsMap.get(el.startBinding.elementId)
      : null;
    const endBindingElement = el.endBinding
      ? startBindingElement?.id === el.endBinding.elementId
        ? startBindingElement
        : elementsMap.get(el.endBinding.elementId)
      : null;

    LinearElementEditor.movePoints(el, scene, pointUpdates, {
      moveMidPointsWithElement:
        !!startBindingElement && startBindingElement?.id === endBindingElement?.id,
    });

    ShapeCache.delete(el);
    didMutate = true;
  }

  if (didMutate) {
    store.scheduleCapture();
    scene.triggerUpdate();
  }
};

interface KeyBlocker {
  isBlockingKeys(): boolean;
  close(): void;
}

/**
   * Attaches an inline link suggester to the specified input element.
   * @param inputEl The HTML input element to attach the suggester to.
   * @param widthWrapper Optional HTML element to wrap the width of suggester element.
   * @param containerEl Optional container element used as collision boundary.
   * @param surpessPlaceholder Whether to suppress the placeholder text. Defaults to true.
   * @returns A KeyBlocker instance for managing keyboard input.
   */
export const attachInlineLinkSuggester = (
  inputEl: HTMLInputElement|HTMLTextAreaElement,
  widthWrapper?: HTMLElement,
  container: HTMLDivElement | null = null,
  surpessPlaceholder: boolean = true,
): KeyBlocker =>
  getHostPlugin().attachInlineLinkSuggester(
    inputEl,
    widthWrapper,
    container,
    surpessPlaceholder,
  );

export const syncElementLinkWithText = (): boolean => {
  const host = getObsidianExcalidrawHost();
  if (host) {
    return host.shouldSyncElementLinkWithText() ?? true;
  }
  return getHostPlugin().settings.syncElementLinkWithText ?? true;
};
