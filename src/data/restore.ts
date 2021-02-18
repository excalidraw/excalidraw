import {
  ExcalidrawElement,
  FontFamily,
  ExcalidrawSelectionElement,
} from "../element/types";
import { AppState, NormalizedZoomValue } from "../types";
import { DataState, ImportedDataState } from "./types";
import { isInvisiblySmallElement, getNormalizedDimensions } from "../element";
import { isLinearElementType } from "../element/typeChecks";
import { randomId } from "../random";
import {
  FONT_FAMILY,
  DEFAULT_FONT_FAMILY,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
} from "../constants";
import { getDefaultAppState } from "../appState";

const getFontFamilyByName = (fontFamilyName: string): FontFamily => {
  for (const [id, fontFamilyString] of Object.entries(FONT_FAMILY)) {
    if (fontFamilyString.includes(fontFamilyName)) {
      return parseInt(id) as FontFamily;
    }
  }
  return DEFAULT_FONT_FAMILY;
};

const restoreElementWithProperties = <T extends ExcalidrawElement>(
  element: Required<T>,
  extra: Omit<Required<T>, keyof ExcalidrawElement>,
): T => {
  const base: Pick<T, keyof ExcalidrawElement> = {
    type: element.type,
    // all elements must have version > 0 so getSceneVersion() will pick up
    // newly added elements
    version: element.version || 1,
    versionNonce: element.versionNonce ?? 0,
    isDeleted: element.isDeleted ?? false,
    id: element.id || randomId(),
    fillStyle: element.fillStyle || "hachure",
    strokeWidth: element.strokeWidth || 1,
    strokeStyle: element.strokeStyle ?? "solid",
    roughness: element.roughness ?? 1,
    opacity: element.opacity == null ? 100 : element.opacity,
    angle: element.angle || 0,
    x: element.x || 0,
    y: element.y || 0,
    strokeColor: element.strokeColor,
    backgroundColor: element.backgroundColor,
    width: element.width || 0,
    height: element.height || 0,
    seed: element.seed ?? 1,
    groupIds: element.groupIds ?? [],
    strokeSharpness:
      element.strokeSharpness ??
      (isLinearElementType(element.type) ? "round" : "sharp"),
    boundElementIds: element.boundElementIds ?? [],
  };

  return ({
    ...base,
    ...getNormalizedDimensions(base),
    ...extra,
  } as unknown) as T;
};

const restoreElement = (
  element: Exclude<ExcalidrawElement, ExcalidrawSelectionElement>,
): typeof element => {
  switch (element.type) {
    case "text":
      let fontSize = element.fontSize;
      let fontFamily = element.fontFamily;
      if ("font" in element) {
        const [fontPx, _fontFamily]: [
          string,
          string,
        ] = (element as any).font.split(" ");
        fontSize = parseInt(fontPx, 10);
        fontFamily = getFontFamilyByName(_fontFamily);
      }
      return restoreElementWithProperties(element, {
        fontSize,
        fontFamily,
        text: element.text ?? "",
        baseline: element.baseline,
        textAlign: element.textAlign || DEFAULT_TEXT_ALIGN,
        verticalAlign: element.verticalAlign || DEFAULT_VERTICAL_ALIGN,
      });
    case "draw":
    case "line":
    case "arrow": {
      const {
        startArrowhead = null,
        endArrowhead = element.type === "arrow" ? "arrow" : null,
      } = element;

      return restoreElementWithProperties(element, {
        startBinding: element.startBinding,
        endBinding: element.endBinding,
        points:
          // migrate old arrow model to new one
          !Array.isArray(element.points) || element.points.length < 2
            ? [
                [0, 0],
                [element.width, element.height],
              ]
            : element.points,
        lastCommittedPoint: null,
        startArrowhead,
        endArrowhead,
      });
    }
    // generic elements
    case "ellipse":
      return restoreElementWithProperties(element, {});
    case "rectangle":
      return restoreElementWithProperties(element, {});
    case "diamond":
      return restoreElementWithProperties(element, {});

    // Don't use default case so as to catch a missing an element type case.
    // We also don't want to throw, but instead return void so we filter
    // out these unsupported elements from the restored array.
  }
};

export const restoreElements = (
  elements: ImportedDataState["elements"],
): ExcalidrawElement[] => {
  return (elements || []).reduce((elements, element) => {
    // filtering out selection, which is legacy, no longer kept in elements,
    // and causing issues if retained
    if (element.type !== "selection" && !isInvisiblySmallElement(element)) {
      const migratedElement = restoreElement(element);
      if (migratedElement) {
        elements.push(migratedElement);
      }
    }
    return elements;
  }, [] as ExcalidrawElement[]);
};

const restoreAppState = (
  appState: ImportedDataState["appState"],
  localAppState: Partial<AppState> | null,
): AppState => {
  appState = appState || {};

  const defaultAppState = getDefaultAppState();
  const nextAppState = {} as typeof defaultAppState;

  for (const [key, val] of Object.entries(defaultAppState) as [
    keyof typeof defaultAppState,
    any,
  ][]) {
    const restoredValue = appState[key];
    const localValue = localAppState ? localAppState[key] : undefined;
    (nextAppState as any)[key] =
      restoredValue !== undefined
        ? restoredValue
        : localValue !== undefined
        ? localValue
        : val;
  }

  return {
    ...nextAppState,
    offsetLeft: appState.offsetLeft || 0,
    offsetTop: appState.offsetTop || 0,
    // Migrates from previous version where appState.zoom was a number
    zoom:
      typeof appState.zoom === "number"
        ? {
            value: appState.zoom as NormalizedZoomValue,
            translation: defaultAppState.zoom.translation,
          }
        : appState.zoom || defaultAppState.zoom,
  };
};

export const restore = (
  data: ImportedDataState | null,
  /**
   * Local AppState (`this.state` or initial state from localStorage) so that we
   * don't overwrite local state with default values (when values not
   * explicitly specified).
   * Supply `null` if you can't get access to it.
   */
  localAppState: Partial<AppState> | null | undefined,
): DataState => {
  return {
    elements: restoreElements(data?.elements),
    appState: restoreAppState(data?.appState, localAppState || null),
  };
};
