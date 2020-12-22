import {
  isTextElement,
  redrawTextBoundingBox,
  getNonDeletedElements,
} from "../element";
import { CODES, KEYS } from "../keys";
import { register } from "./register";
import { newElementWith } from "../element/mutateElement";
import {
  ExcalidrawElement,
  ExcalidrawElementPossibleProps,
} from "../element/types";
import { AppState } from "../types";
import {
  canChangeSharpness,
  getSelectedElements,
  hasBackground,
  hasStroke,
  hasText,
} from "../scene";
import { isLinearElement, isLinearElementType } from "../element/typeChecks";

type AppStateStyles = {
  [K in AssertSubset<
    keyof AppState,
    typeof copyableStyles[number][0]
  >]: AppState[K];
};

type ElementStyles = {
  [K in AssertSubset<
    keyof ExcalidrawElementPossibleProps,
    typeof copyableStyles[number][1]
  >]: ExcalidrawElementPossibleProps[K];
};

type ElemelementStylesByType = Record<ExcalidrawElement["type"], ElementStyles>;

// `copiedStyles` is exported only for tests.
let COPIED_STYLES: {
  appStateStyles: Partial<AppStateStyles>;
  elementStyles: Partial<ElementStyles>;
  elementStylesByType: Partial<ElemelementStylesByType>;
} | null = null;

/* [AppState prop, ExcalidrawElement prop, predicate] */
const copyableStyles = [
  ["currentItemOpacity", "opacity", () => true],
  ["currentItemStrokeColor", "strokeColor", () => true],
  ["currentItemStrokeStyle", "strokeStyle", hasStroke],
  ["currentItemStrokeWidth", "strokeWidth", hasStroke],
  ["currentItemRoughness", "roughness", hasStroke],
  ["currentItemBackgroundColor", "backgroundColor", hasBackground],
  ["currentItemFillStyle", "fillStyle", hasBackground],
  ["currentItemStrokeSharpness", "strokeSharpness", canChangeSharpness],
  ["currentItemLinearStrokeSharpness", "strokeSharpness", isLinearElementType],
  ["currentItemStartArrowhead", "startArrowhead", isLinearElementType],
  ["currentItemEndArrowhead", "endArrowhead", isLinearElementType],
  ["currentItemFontFamily", "fontFamily", hasText],
  ["currentItemFontSize", "fontSize", hasText],
  ["currentItemTextAlign", "textAlign", hasText],
] as const;

const getCommonStyleProps = (
  elements: readonly ExcalidrawElement[],
): Exclude<typeof COPIED_STYLES, null> => {
  const appStateStyles = {} as AppStateStyles;
  const elementStyles = {} as ElementStyles;

  const elementStylesByType = elements.reduce((acc, element) => {
    // only use the first element of given type
    if (!acc[element.type]) {
      acc[element.type] = {} as ElementStyles;
      copyableStyles.forEach(([appStateProp, prop, predicate]) => {
        const value = (element as any)[prop];
        if (value !== undefined && predicate(element.type)) {
          if (appStateStyles[appStateProp] === undefined) {
            (appStateStyles as any)[appStateProp] = value;
          }
          if (elementStyles[prop] === undefined) {
            (elementStyles as any)[prop] = value;
          }
          (acc as any)[element.type][prop] = value;
        }
      });
    }
    return acc;
  }, {} as ElemelementStylesByType);

  // clone in case we ever make some of the props into non-primitives
  return JSON.parse(
    JSON.stringify({ appStateStyles, elementStyles, elementStylesByType }),
  );
};

export const actionCopyStyles = register({
  name: "copyStyles",
  perform: (elements, appState) => {
    COPIED_STYLES = getCommonStyleProps(
      getSelectedElements(getNonDeletedElements(elements), appState),
    );

    return {
      appState: {
        ...appState,
        ...COPIED_STYLES.appStateStyles,
      },
      commitToHistory: false,
    };
  },
  contextItemLabel: "labels.copyStyles",
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.C,
  contextMenuOrder: 0,
});

export const actionPasteStyles = register({
  name: "pasteStyles",
  perform: (elements, appState) => {
    if (!COPIED_STYLES) {
      return { elements, commitToHistory: false };
    }
    const getStyle = <T extends ExcalidrawElement, K extends keyof T>(
      element: T,
      prop: K,
    ) => {
      return (COPIED_STYLES?.elementStylesByType[element.type]?.[
        prop as keyof ElementStyles
      ] ??
        COPIED_STYLES?.elementStyles[prop as keyof ElementStyles] ??
        element[prop]) as T[K];
    };
    return {
      elements: elements.map((element) => {
        if (appState.selectedElementIds[element.id]) {
          const commonProps = {
            backgroundColor: getStyle(element, "backgroundColor"),
            strokeWidth: getStyle(element, "strokeWidth"),
            strokeColor: getStyle(element, "strokeColor"),
            strokeStyle: getStyle(element, "strokeStyle"),
            fillStyle: getStyle(element, "fillStyle"),
            opacity: getStyle(element, "opacity"),
            roughness: getStyle(element, "roughness"),
            strokeSharpness: getStyle(element, "strokeSharpness"),
          };
          if (isTextElement(element)) {
            const newElement = newElementWith(element, {
              ...commonProps,
              fontSize: getStyle(element, "fontSize"),
              fontFamily: getStyle(element, "fontFamily"),
              textAlign: getStyle(element, "textAlign"),
            });
            redrawTextBoundingBox(newElement);
            return newElement;
          } else if (isLinearElement(element)) {
            return newElementWith(element, {
              ...commonProps,
              startArrowhead: getStyle(element, "startArrowhead"),
              endArrowhead: getStyle(element, "endArrowhead"),
            });
          }
          return newElementWith(element, commonProps);
        }
        return element;
      }),
      commitToHistory: true,
    };
  },
  contextItemLabel: "labels.pasteStyles",
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.V,
  contextMenuOrder: 1,
});
