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

import { Fonts } from "./fonts";
import { loadMermaidLib } from "./components/TTDDialog/MermaidToExcalidrawLib";
import { getObsidianExcalidrawHost } from "./obsidianExcalidrawHost";

import type { ObsidianKeyBlocker } from "./obsidianExcalidrawHost";
import type { MermaidToExcalidrawLibProps } from "./components/TTDDialog/types";

import type { AppClassProperties, AppState } from "./types";

export function allowDoubleTapEraser() {
  return getObsidianExcalidrawHost()?.isDoubleTapEraserEnabled() ?? false;
}

//mfuria #329. Enable panning with right mouse button if host plugin setting allows
export function isPanWithRightMouseEnabled(): boolean {
  try {
    return !!getObsidianExcalidrawHost()?.isRightClickPanEnabled();
  } catch (e) {
    return false;
  }
}

export function getMaxZoom(): number {
  return getObsidianExcalidrawHost()?.getZoomToFitMaxLevel() ?? 1;
}

export function hideFreedrawPenmodeCursor() {
  return !(getObsidianExcalidrawHost()?.isPenModeCrosshairVisible() ?? true);
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
    const arrayBuffer = await getObsidianExcalidrawHost()?.loadFontFromFile(
      filename,
    );
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
  const isSingleFingerPanningEnabled =
    getObsidianExcalidrawHost()?.isSingleFingerPanningEnabled() ?? false;
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
  const host = getObsidianExcalidrawHost();
  if (!host) {
    throw new Error("Obsidian Excalidraw host is not configured");
  }
  return await host.getMermaid();
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
  return (
    getObsidianExcalidrawHost()?.isDoubleClickTextEditingDisabled() ?? false
  );
};

// zoomStep: number;        // % increment per zoom action (e.g. mouse wheel)
//  zoomMin: number;         // minimum zoom percentage
//  zoomMax: number;         // maximum zoom percentage
export const getZoomStep = () => {
  return getObsidianExcalidrawHost()?.getZoomStep() ?? ZOOM_STEP;
};
export const getZoomMin = () => {
  return getObsidianExcalidrawHost()?.getZoomMin() ?? MIN_ZOOM;
};
export const getZoomMax = () => {
  return getObsidianExcalidrawHost()?.getZoomMax() ?? MAX_ZOOM;
};

export const runAction = (action: "anyFile" | "LaTeX" | "card"): void => {
  getObsidianExcalidrawHost()?.runAction(action);
};

export const t2 = (key: string): string => {
  return getObsidianExcalidrawHost()?.getLabel(key) ?? key;
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
  return getObsidianExcalidrawHost()?.isContextMenuDisabled() ?? false;
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
        !!startBindingElement &&
        startBindingElement?.id === endBindingElement?.id,
    });

    ShapeCache.delete(el);
    didMutate = true;
  }

  if (didMutate) {
    store.scheduleCapture();
    scene.triggerUpdate();
  }
};

/**
 * Attaches an inline link suggester to the specified input element.
 * @param inputEl The HTML input element to attach the suggester to.
 * @param widthWrapper Optional HTML element to wrap the width of suggester element.
 * @param container Optional container element used as collision boundary.
 * @param surpessPlaceholder Whether to suppress the placeholder text. Defaults to true.
 * @returns A keyboard-blocking lifecycle for managing keyboard input.
 */
export const attachInlineLinkSuggester = (
  inputEl: HTMLInputElement | HTMLTextAreaElement,
  widthWrapper?: HTMLElement,
  container: HTMLDivElement | null = null,
  surpessPlaceholder: boolean = true,
): ObsidianKeyBlocker => {
  const host = getObsidianExcalidrawHost();
  if (!host) {
    throw new Error("Obsidian Excalidraw host is not configured");
  }
  return host.attachInlineLinkSuggester(
    inputEl,
    widthWrapper,
    container,
    surpessPlaceholder,
  );
};

export const syncElementLinkWithText = (): boolean => {
  return getObsidianExcalidrawHost()?.shouldSyncElementLinkWithText() ?? true;
};
