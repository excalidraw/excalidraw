import { ExcalidrawTextElement, NonDeleted } from "../element/types";
import { ElementUpdate, mutateElement } from "../element/mutateElement";

import {
  TextActionNameMath,
  TextOptsMath,
  TextShortcutNameMath,
  registerTextElementSubtypeMath,
} from "./math";

import {
  TextActionNameText,
  TextOptsText,
  TextShortcutNameText,
  registerTextElementSubtypeText,
} from "./text";

import { Action } from "../actions/types";
import { register } from "../actions/register";

export const TEXT_SUBTYPE_DEFAULT = "none";

type TextLikeMethodName =
  | "apply"
  | "clean"
  | "measure"
  | "render"
  | "renderSvg"
  | "restore";

type TextLikeMethod = {
  subtype: string;
  method: Function;
  default?: boolean;
};

type TextLikeMethods = Array<TextLikeMethod>;

const applyMethodsA = [] as TextLikeMethods;
const cleanMethodsA = [] as TextLikeMethods;
const measureMethodsA = [] as TextLikeMethods;
const renderMethodsA = [] as TextLikeMethods;
const renderSvgMethodsA = [] as TextLikeMethods;
const restoreMethodsA = [] as TextLikeMethods;

// Types to export, union over all ExcalidrawTextElement subtypes
export type TextOpts = TextOptsText | TextOptsMath;
export type TextActionName = TextActionNameText | TextActionNameMath;
export type TextShortcutName = TextShortcutNameText | TextShortcutNameMath;

// One element for each ExcalidrawTextElement subtype.
// ShortcutMap arrays, then typeguards for these.
type TextShortcutMapArray = Array<Record<string, string[]>>;
const textShortcutMaps: TextShortcutMapArray = [];
type TextShortcutNameChecks = Array<Function>;
const textShortcutNameChecks: TextShortcutNameChecks = [];

// Register shortcutMap and typeguard for subtype
export const registerTextLikeShortcutNames = (
  textShortcutMap: Record<string, string[]>,
  isTextShortcutNameCheck: Function,
): void => {
  // If either textShortcutMap or isTextShortcutNameCheck is already registered, do nothing
  if (
    !textShortcutMaps.includes(textShortcutMap) &&
    !textShortcutNameChecks.includes(isTextShortcutNameCheck)
  ) {
    textShortcutMaps.push(textShortcutMap);
    textShortcutNameChecks.push(isTextShortcutNameCheck);
  }
};

// Typeguard for TextShortcutName (including all subtypes)
export const isTextShortcutName = (s: any): s is TextShortcutName => {
  for (let i = 0; i < textShortcutNameChecks.length; i++) {
    if (textShortcutNameChecks[i](s)) {
      return true;
    }
  }
  return false;
};

// Return the shortcut by TextShortcutName.
// Assume textShortcutMaps and textShortcutNameChecks are matchingly sorted.
export const getShortcutFromTextShortcutName = (name: TextShortcutName) => {
  let shortcuts: string[] = [];
  for (let i = 0; i < textShortcutMaps.length; i++) {
    if (textShortcutNameChecks[i](name)) {
      shortcuts = textShortcutMaps[i][name];
    }
  }
  return shortcuts;
};

export const registerTextLikeMethod = (
  name: TextLikeMethodName,
  textLikeMethod: TextLikeMethod,
): void => {
  let methodsA: TextLikeMethods;
  switch (name) {
    case "apply":
      methodsA = applyMethodsA;
      break;
    case "clean":
      methodsA = cleanMethodsA;
      break;
    case "measure":
      methodsA = measureMethodsA;
      break;
    case "render":
      methodsA = renderMethodsA;
      break;
    case "restore":
      methodsA = restoreMethodsA;
      break;
    case "renderSvg":
      methodsA = renderSvgMethodsA;
      break;
  }
  if (!methodsA.includes(textLikeMethod)) {
    methodsA.push(textLikeMethod);
  }
};

const textLikeSubtypes = Array<string>();

export const getTextElementSubtypes = (): string[] => {
  return textLikeSubtypes;
};

export const registerTextLikeSubtypeName = (subtypeName: string) => {
  // Only register a subtype name once
  if (!textLikeSubtypes.includes(subtypeName)) {
    textLikeSubtypes.push(subtypeName);
  }
};

export const applyTextOpts = (
  element: ExcalidrawTextElement,
  textOpts?: TextOpts,
): ExcalidrawTextElement => {
  mutateElement(element, cleanTextOptUpdates(element, element));
  for (let i = 0; i < applyMethodsA.length; i++) {
    if (applyMethodsA[i].subtype === element.subtype) {
      return applyMethodsA[i].method(element, textOpts);
    }
  }
  return applyMethodsA
    .find((value, index, applyMethodsA) => {
      return value.default !== undefined && value.default === true;
    })!
    .method(element, textOpts);
};

export const cleanTextOptUpdates = (
  element: ExcalidrawTextElement,
  opts: ElementUpdate<ExcalidrawTextElement>,
): ElementUpdate<ExcalidrawTextElement> => {
  for (let i = 0; i < cleanMethodsA.length; i++) {
    if (cleanMethodsA[i].subtype === element.subtype) {
      return cleanMethodsA[i].method(opts);
    }
  }
  return cleanMethodsA
    .find((value, index, cleanMethodsA) => {
      return value.default !== undefined && value.default === true;
    })!
    .method(opts);
};

export const measureTextElement = (
  element: Omit<
    ExcalidrawTextElement,
    | "id"
    | "isDeleted"
    | "type"
    | "baseline"
    | "width"
    | "height"
    | "angle"
    | "seed"
    | "version"
    | "versionNonce"
    | "groupIds"
    | "boundElementIds"
  >,
  next?: {
    fontSize?: number;
    text?: string;
  },
): { width: number; height: number; baseline: number } => {
  for (let i = 0; i < measureMethodsA.length; i++) {
    if (measureMethodsA[i].subtype === element.subtype) {
      return measureMethodsA[i].method(element, next);
    }
  }
  return measureMethodsA
    .find((value, index, measureMethodsA) => {
      return value.default !== undefined && value.default === true;
    })!
    .method(element, next);
};

export const renderTextElement = (
  element: NonDeleted<ExcalidrawTextElement>,
  context: CanvasRenderingContext2D,
  refresh?: () => void,
): void => {
  for (let i = 0; i < renderMethodsA.length; i++) {
    if (renderMethodsA[i].subtype === element.subtype) {
      renderMethodsA[i].method(element, context, refresh);
      return;
    }
  }
  renderMethodsA
    .find((value, index, renderMethodsA) => {
      return value.default !== undefined && value.default === true;
    })!
    .method(element, context, refresh);
};

export const renderSvgTextElement = (
  svgRoot: SVGElement,
  node: SVGElement,
  element: NonDeleted<ExcalidrawTextElement>,
): void => {
  for (let i = 0; i < renderSvgMethodsA.length; i++) {
    if (renderSvgMethodsA[i].subtype === element.subtype) {
      renderSvgMethodsA[i].method(svgRoot, node, element);
      return;
    }
  }
  renderSvgMethodsA
    .find((value, index, renderSvgMethodsA) => {
      return value.default !== undefined && value.default === true;
    })!
    .method(svgRoot, node, element);
};

export const restoreTextElement = (
  element: ExcalidrawTextElement,
  elementRestored: ExcalidrawTextElement,
): ExcalidrawTextElement => {
  for (let i = 0; i < restoreMethodsA.length; i++) {
    if (restoreMethodsA[i].subtype === element.subtype) {
      return restoreMethodsA[i].method(element, elementRestored);
    }
  }
  return restoreMethodsA
    .find((value, index, restoreMethodsA) => {
      return value.default !== undefined && value.default === true;
    })!
    .method(element, elementRestored);
};

export const registerTextElementSubtypes = (
  onSubtypesLoaded?: (isTextElementSubtype: Function) => void,
) => {
  registerTextElementSubtypeMath(onSubtypesLoaded);
  registerTextElementSubtypeText(onSubtypesLoaded);
};

const textLikeActions: Action[] = [];

export const addTextLikeActions = (actions: Action[]) => {
  actions.forEach((action) => {
    if (!textLikeActions.includes(action)) {
      textLikeActions.push(action);
      register(action);
    }
  });
};

export const getTextLikeActions = (): readonly Action[] => {
  return textLikeActions;
};
