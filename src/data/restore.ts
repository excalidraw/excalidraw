import {
  ExcalidrawElement,
  FontFamily,
  ExcalidrawSelectionElement,
} from "../element/types";
import { AppState } from "../types";
import { DataState } from "./types";
import { isInvisiblySmallElement, getNormalizedDimensions } from "../element";
import { calculateScrollCenter } from "../scene";
import { randomId } from "../random";
import { DEFAULT_TEXT_ALIGN, DEFAULT_FONT_FAMILY } from "../appState";
import { FONT_FAMILY } from "../constants";

const getFontFamilyByName = (fontFamilyName: string): FontFamily => {
  for (const [id, fontFamilyString] of Object.entries(FONT_FAMILY)) {
    if (fontFamilyString.includes(fontFamilyName)) {
      return parseInt(id) as FontFamily;
    }
  }
  return DEFAULT_FONT_FAMILY;
};

function migrateElementWithProperties<T extends ExcalidrawElement>(
  element: T,
  extra: Omit<T, keyof ExcalidrawElement>,
): T {
  const base: Pick<T, keyof ExcalidrawElement> = {
    type: element.type,
    // all elements must have version > 0 so getDrawingVersion() will pick up
    //  newly added elements
    version: element.version || 1,
    versionNonce: element.versionNonce ?? 0,
    isDeleted: false,
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
    groupIds: element.groupIds || [],
  };

  return {
    ...base,
    ...getNormalizedDimensions(base),
    ...extra,
  } as T;
}

const migrateElement = (
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
      return migrateElementWithProperties(element, {
        fontSize,
        fontFamily,
        text: element.text ?? "",
        baseline: element.baseline,
        textAlign: element.textAlign ?? DEFAULT_TEXT_ALIGN,
      });
    case "draw":
    case "line":
    case "arrow": {
      return migrateElementWithProperties(element, {
        points:
          // migrate old arrow model to new one
          !Array.isArray(element.points) || element.points.length < 2
            ? [
                [0, 0],
                [element.width, element.height],
              ]
            : element.points,
      });
    }
    // generic elements
    case "ellipse":
    case "rectangle":
    case "diamond":
      return migrateElementWithProperties(element, {});

    // don't use default case so as to catch a missing an element type case
    //  (we also don't want to throw, but instead return void so we
    //   filter out these unsupported elements from the restored array)
  }
};

export const restore = (
  savedElements: readonly ExcalidrawElement[],
  savedState: AppState | null,
  opts?: { scrollToContent: boolean },
): DataState => {
  const elements = savedElements.reduce((elements, element) => {
    // filtering out selection, which is legacy, no longer kept in elements,
    //  and causing issues if retained
    if (element.type !== "selection" && !isInvisiblySmallElement(element)) {
      const migratedElement = migrateElement(element);
      if (migratedElement) {
        elements.push(migratedElement);
      }
    }
    return elements;
  }, [] as ExcalidrawElement[]);

  if (opts?.scrollToContent && savedState) {
    savedState = {
      ...savedState,
      ...calculateScrollCenter(elements, savedState, null),
    };
  }

  return {
    elements: elements,
    appState: savedState,
  };
};
