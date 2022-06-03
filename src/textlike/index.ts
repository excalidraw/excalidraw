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
  TEXT_SUBTYPE_DEFAULT,
  TextActionName,
  TextMethods,
  TextOmitProps,
  TextOpts,
  TextShortcutName,
  TextSubtype,
  getTextElementSubtypes,
} from "./types";

import { Action, ActionName } from "../actions/types";
import { register } from "../actions/register";
import { hasBoundTextElement } from "../element/typeChecks";
import { getBoundTextElement } from "../element/textElement";

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

type TextMethodMap = { subtype: TextSubtype; methods: TextMethods };
const methodMaps = [] as Array<TextMethodMap>;

// Assumption: registerTextElementSubtypes() has run first or is the caller
const getMethods = (subtype: TextSubtype) => {
  const _subtype = subtype !== undefined ? subtype : TEXT_SUBTYPE_DEFAULT;
  const map = methodMaps.find((method) => method.subtype === _subtype);
  return map!.methods;
};

// For the specified subtype, this method is responsible for:
// - Ensuring textOpts has valid values.
// - Enforcing special restrictions on standard ExcalidrawTextElement attributes.
export const cleanTextElementUpdate = (
  subtype: TextSubtype,
  updates: ElementUpdate<ExcalidrawTextElement>,
): ElementUpdate<ExcalidrawTextElement> => {
  return getMethods(subtype).clean(updates);
};

export const measureTextElement = (
  element: Omit<ExcalidrawTextElement, TextOmitProps | "originalText">,
  next?: {
    fontSize?: number;
    text?: string;
    textOpts?: TextOpts;
  },
  maxWidth?: number | null,
): { width: number; height: number; baseline: number } => {
  return getMethods(element.subtype).measure(element, next, maxWidth);
};

export const renderTextElement = (
  element: NonDeleted<ExcalidrawTextElement>,
  context: CanvasRenderingContext2D,
  renderCb?: () => void,
): void => {
  getMethods(element.subtype).render(element, context, renderCb);
};

export const renderSvgTextElement = (
  svgRoot: SVGElement,
  node: SVGElement,
  element: NonDeleted<ExcalidrawTextElement>,
): void => {
  getMethods(element.subtype).renderSvg(svgRoot, node, element);
};

export const wrapTextElement = (
  element: Omit<ExcalidrawTextElement, TextOmitProps>,
  containerWidth: number,
  next?: {
    fontSize?: number;
    text?: string;
    textOpts?: TextOpts;
  },
): string => {
  return getMethods(element.subtype).wrap(element, containerWidth, next);
};

export const registerTextElementSubtypes = (
  onSubtypesLoaded?: (isTextElementSubtype: Function) => void,
) => {
  const textSubtypes = getTextElementSubtypes();
  for (let index = 0; index < textSubtypes.length; index++) {
    const subtype = textSubtypes[index];
    methodMaps.push({ subtype, methods: {} as TextMethods });
    require(`./${textSubtypes[index]}/index`).registerTextElementSubtype(
      getMethods(subtype),
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
