import {
  ExcalidrawElement,
  FontFamily,
  ExcalidrawSelectionElement,
} from "../element/types";
import { AppState, NormalizedZoomValue } from "../types";
import { ImportedDataState } from "./types";
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
import { LinearElementEditor } from "../element/linearElementEditor";

type RestoredAppState = Omit<
  AppState,
  "offsetTop" | "offsetLeft" | "width" | "height"
>;

export const AllowedExcalidrawElementTypes: Record<
  ExcalidrawElement["type"],
  true
> = {
  selection: true,
  text: true,
  rectangle: true,
  diamond: true,
  ellipse: true,
  line: true,
  arrow: true,
  freedraw: true,
};

export type RestoredDataState = {
  elements: ExcalidrawElement[];
  appState: RestoredAppState;
};

const getFontFamilyByName = (fontFamilyName: string): FontFamily => {
  for (const [id, fontFamilyString] of Object.entries(FONT_FAMILY)) {
    if (fontFamilyString.includes(fontFamilyName)) {
      return parseInt(id) as FontFamily;
    }
  }
  return DEFAULT_FONT_FAMILY;
};

const restoreElementWithProperties = <
  T extends ExcalidrawElement,
  K extends keyof Omit<
    Required<T>,
    Exclude<keyof ExcalidrawElement, "type" | "x" | "y">
  >
>(
  element: Required<T>,
  extra: Pick<T, K>,
): T => {
  const base: Pick<T, keyof ExcalidrawElement> = {
    type: (extra as Partial<T>).type || element.type,
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
    x: (extra as Partial<T>).x ?? element.x ?? 0,
    y: (extra as Partial<T>).y ?? element.y ?? 0,
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
    case "freedraw": {
      return restoreElementWithProperties(element, {
        points: element.points,
        lastCommittedPoint: null,
        simulatePressure: element.simulatePressure,
        pressures: element.pressures,
      });
    }
    case "line":
    // @ts-ignore LEGACY type
    // eslint-disable-next-line no-fallthrough
    case "draw":
    case "arrow": {
      const {
        startArrowhead = null,
        endArrowhead = element.type === "arrow" ? "arrow" : null,
      } = element;

      let x = element.x;
      let y = element.y;
      let points = // migrate old arrow model to new one
        !Array.isArray(element.points) || element.points.length < 2
          ? [
              [0, 0],
              [element.width, element.height],
            ]
          : element.points;

      if (points[0][0] !== 0 || points[0][1] !== 0) {
        ({ points, x, y } = LinearElementEditor.getNormalizedPoints(element));
      }

      return restoreElementWithProperties(element, {
        type:
          (element.type as ExcalidrawElement["type"] | "draw") === "draw"
            ? "line"
            : element.type,
        startBinding: element.startBinding,
        endBinding: element.endBinding,
        lastCommittedPoint: null,
        startArrowhead,
        endArrowhead,
        points,
        x,
        y,
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

export const restoreAppState = (
  appState: ImportedDataState["appState"],
  localAppState: Partial<AppState> | null,
): RestoredAppState => {
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
    elementType: AllowedExcalidrawElementTypes[nextAppState.elementType]
      ? nextAppState.elementType
      : "selection",
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
): RestoredDataState => {
  return {
    elements: restoreElements(data?.elements),
    appState: restoreAppState(data?.appState, localAppState || null),
  };
};
