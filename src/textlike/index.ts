import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "../element/types";
import { ElementUpdate } from "../element/mutateElement";
import { getNonDeletedElements, isTextElement } from "../element";
import { getSelectedElements } from "../scene";
import { AppState } from "../types";

import {
  getTextElementSubtypes,
  TextActionName,
  TextOpts,
  TextShortcutName,
  TextSubtype,
} from "./types";

import { Action, ActionName } from "../actions/types";
import { register } from "../actions/register";
import { hasBoundTextElement } from "../element/typeChecks";
import { getBoundTextElement } from "../element/textElement";

type TextLikeMethodName =
  | "clean"
  | "measure"
  | "render"
  | "renderSvg"
  | "restore"
  | "wrap";

type TextLikeMethod = {
  subtype: TextSubtype;
  method: Function;
  default?: boolean;
};

type TextLikeMethods = Array<TextLikeMethod>;

const cleanMethodsA = [] as TextLikeMethods;
const measureMethodsA = [] as TextLikeMethods;
const renderMethodsA = [] as TextLikeMethods;
const renderSvgMethodsA = [] as TextLikeMethods;
const restoreMethodsA = [] as TextLikeMethods;
const wrapMethodsA = [] as TextLikeMethods;

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
    case "wrap":
      methodsA = wrapMethodsA;
      break;
  }
  if (!methodsA.includes(textLikeMethod)) {
    methodsA.push(textLikeMethod);
  }
};

const textLikeSubtypes = Array<string>();

export const registerTextLikeSubtypeName = (subtype: TextSubtype) => {
  // Only register a subtype name once
  if (!textLikeSubtypes.includes(subtype)) {
    textLikeSubtypes.push(subtype);
  }
};

type DisabledPanelComponents = {
  subtype: TextSubtype;
  actions: (ActionName | TextActionName)[];
};

const textLikeDisabledPanelComponents = [] as DisabledPanelComponents[];

export const registerTextLikeDisabledPanelComponents = (
  subtype: TextSubtype,
  actions: (ActionName | TextActionName)[],
) => {
  if (textLikeSubtypes.includes(subtype)) {
    textLikeDisabledPanelComponents.push({
      subtype,
      actions,
    } as DisabledPanelComponents);
  }
};

export const isPanelComponentDisabled = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  actionName: ActionName | TextActionName,
) => {
  let disabled = false;
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );
  selectedElements.forEach((element) => {
    if (isTextElement(element)) {
      if (isPanelComponentDisabledForSubtype(element.subtype, actionName)) {
        disabled = true;
      }
    }
    if (hasBoundTextElement(element)) {
      if (
        isPanelComponentDisabledForSubtype(
          getBoundTextElement(element)!.subtype,
          actionName,
        )
      ) {
        disabled = true;
      }
    }
  });
  if (
    selectedElements.length === 0 &&
    isPanelComponentDisabledForSubtype(
      appState.textElementSubtype,
      actionName,
    ) &&
    !(appState.editingElement && isTextElement(appState.editingElement))
  ) {
    disabled = true;
  }
  if (
    appState.editingElement &&
    isTextElement(appState.editingElement) &&
    isPanelComponentDisabledForSubtype(
      appState.editingElement.subtype,
      actionName,
    )
  ) {
    disabled = true;
  }
  return !disabled;
};

const isPanelComponentDisabledForSubtype = (
  subtype: TextSubtype,
  action: ActionName | TextActionName,
) => {
  if (textLikeSubtypes.includes(subtype)) {
    if (
      textLikeDisabledPanelComponents
        .find((value) => value.subtype === subtype)!
        .actions.includes(action)
    ) {
      return true;
    }
  }
  return false;
};

// For the specified subtype, this method is responsible for:
// - Ensuring textOpts has valid values.
// - Enforcing special restrictions on standard ExcalidrawTextElement attributes.
export const cleanTextElementUpdate = (
  subtype: TextSubtype,
  updates: ElementUpdate<ExcalidrawTextElement>,
): ElementUpdate<ExcalidrawTextElement> => {
  return cleanMethodsA
    .find((method) => method.subtype === subtype)!
    .method(updates);
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
    | "boundElements"
    | "containerId"
    | "originalText"
    | "updated"
    | "link"
  >,
  next?: {
    fontSize?: number;
    text?: string;
    textOpts?: TextOpts;
  },
  maxWidth?: number | null,
): { width: number; height: number; baseline: number } => {
  return measureMethodsA
    .find((method) => method.subtype === element.subtype)!
    .method(element, next, maxWidth);
};

export const renderTextElement = (
  element: NonDeleted<ExcalidrawTextElement>,
  context: CanvasRenderingContext2D,
  renderCb?: () => void,
): void => {
  renderMethodsA
    .find((method) => method.subtype === element.subtype)!
    .method(element, context, renderCb);
};

export const renderSvgTextElement = (
  svgRoot: SVGElement,
  node: SVGElement,
  element: NonDeleted<ExcalidrawTextElement>,
): void => {
  renderSvgMethodsA
    .find((method) => method.subtype === element.subtype)!
    .method(svgRoot, node, element);
};

export const restoreTextElement = (
  element: ExcalidrawTextElement,
  elementRestored: ExcalidrawTextElement,
): ExcalidrawTextElement => {
  return restoreMethodsA
    .find((method) => method.subtype === element.subtype)!
    .method(element, elementRestored);
};

export const wrapTextElement = (
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
    | "boundElements"
    | "containerId"
    | "updated"
    | "link"
  >,
  containerWidth: number,
  next?: {
    fontSize?: number;
    text?: string;
    textOpts?: TextOpts;
  },
): string => {
  return wrapMethodsA
    .find((method) => method.subtype === element.subtype)!
    .method(element, containerWidth, next);
};

export const registerTextElementSubtypes = (
  onSubtypesLoaded?: (isTextElementSubtype: Function) => void,
) => {
  const textSubtypes = getTextElementSubtypes();
  for (let index = 0; index < textSubtypes.length; index++) {
    require(`./${textSubtypes[index]}/index`).registerTextElementSubtype(
      onSubtypesLoaded,
    );
  }
};

const textLikeActions: Action[] = [];

export const addTextLikeActions = (actions: Action[]) => {
  actions.forEach((action) => {
    if (textLikeActions.every((value) => value.name !== action.name)) {
      textLikeActions.push(action);
      register(action);
    }
  });
};

export const getTextLikeActions = (): readonly Action[] => {
  return textLikeActions;
};
