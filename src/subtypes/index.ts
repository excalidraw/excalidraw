import { ExcalidrawElement } from "../element/types";
import { getNonDeletedElements } from "../element";
import { getSelectedElements } from "../scene";
import { AppState } from "../types";

import { Action, ActionName } from "../actions/types";
import { register } from "../actions/register";
import { hasBoundTextElement } from "../element/typeChecks";
import { getBoundTextElement } from "../element/textElement";

import {
  mathActionName,
  mathDisabledActions,
  mathProps,
  mathShortcutMap,
  mathShortcutName,
  SUBTYPE_MATH,
  SUBTYPE_MATH_ICON,
} from "./math/types";

// Types to export, union over all ExcalidrawElement subtypes

// Custom Icons
export const CUSTOM_SUBTYPE_ICONS = [
  { icon: SUBTYPE_MATH_ICON, value: SUBTYPE_MATH },
] as const;

// Custom Subtypes
const customSubtype = [SUBTYPE_MATH] as const;
export type CustomSubtype = typeof customSubtype[number];

export const getCustomSubtypes = (): readonly CustomSubtype[] => {
  return customSubtype;
};

// Custom Properties
const customProps = [...mathProps] as const;
export type CustomProps = typeof customProps[number];

// Custom Shortcuts
const customShortcutName = [...mathShortcutName] as const;
export type CustomShortcutName = typeof customShortcutName[number];

export const isCustomShortcutName = (s: any): s is CustomShortcutName =>
  customShortcutName.includes(s);

export const customShortcutMap: Record<CustomShortcutName, string[]> = {
  ...mathShortcutMap,
};

// Custom Actions
const customActionName = [...mathActionName] as const;
export type CustomActionName = typeof customActionName[number];

export const isCustomActionName = (name: any): name is CustomActionName => {
  return (
    customActionName.includes(name as CustomActionName) &&
    !customSubtype.includes(name as CustomSubtype)
  );
};

// Return the shortcut by CustomShortcutName.
export const getCustomShortcutKey = (name: CustomShortcutName) => {
  let shortcuts: string[] = [];
  if (isCustomShortcutName(name)) {
    shortcuts = customShortcutMap[name];
  }
  return shortcuts;
};

// Custom methods
export type CustomMethods = {
  clean: Function;
  measureText: Function;
  render: Function;
  renderSvg: Function;
  wrap: Function;
};

type DisabledActions = {
  subtype: CustomSubtype;
  actions: ActionName[];
};

const disabledActions = [...mathDisabledActions] as DisabledActions[];

export const isActionEnabled = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  actionName: ActionName | CustomActionName,
) => {
  let enabled = false;
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );
  selectedElements.forEach((element) => {
    const subtype = hasBoundTextElement(element)
      ? getBoundTextElement(element)!.subtype
      : element.subtype;
    if (isActionEnabledForSubtype(subtype, actionName)) {
      enabled = true;
    }
  });
  if (selectedElements.length === 0) {
    const subtype = appState.editingElement
      ? appState.editingElement?.subtype
      : appState.customSubtype;
    if (isActionEnabledForSubtype(subtype, actionName)) {
      enabled = true;
    }
  }
  return enabled;
};

const isActionEnabledForSubtype = (
  subtype: CustomSubtype | undefined,
  action: ActionName | CustomActionName,
) => {
  if (subtype && getCustomSubtypes().includes(subtype)) {
    if (
      !isCustomActionName(action) &&
      disabledActions
        .find((value) => value.subtype === subtype)!
        .actions.includes(action)
    ) {
      return false;
    }
  }
  return subtype || !isCustomActionName(action);
};

const customActions: Action[] = [];

export const addCustomActions = (actions: Action[]) => {
  actions.forEach((action) => {
    if (customActions.every((value) => value.name !== action.name)) {
      customActions.push(action);
      register(action);
    }
  });
};

export const getCustomActions = (): readonly Action[] => {
  return customActions;
};

type MethodMap = { subtype: CustomSubtype; methods: CustomMethods };
const methodMaps = [] as Array<MethodMap>;

// Assumption: registerCustomSubtypes() has run first or is the caller
export const getCustomMethods = (subtype: CustomSubtype | undefined) => {
  const map = methodMaps.find((method) => method.subtype === subtype);
  return map?.methods;
};

export const registerCustomSubtypes = (
  onSubtypesLoaded?: (isCustomSubtype: Function) => void,
) => {
  const textSubtypes = getCustomSubtypes();
  for (let index = 0; index < textSubtypes.length; index++) {
    const subtype = textSubtypes[index];
    if (!methodMaps.find((method) => method.subtype === subtype)) {
      methodMaps.push({ subtype, methods: {} as CustomMethods });
      require(`./${textSubtypes[index]}/index`).registerCustomSubtype(
        getCustomMethods(subtype),
        onSubtypesLoaded,
      );
    }
  }
};
