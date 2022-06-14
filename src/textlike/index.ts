import { ExcalidrawElement } from "../element/types";
import { getNonDeletedElements } from "../element";
import { getSelectedElements } from "../scene";
import { AppState } from "../types";

import {
  CustomActionName,
  CustomMethods,
  CustomShortcutName,
  CustomSubtype,
  getCustomSubtypes,
  isCustomActionName,
} from "./types";

import { Action, ActionName } from "../actions/types";
import { register } from "../actions/register";
import { hasBoundTextElement } from "../element/typeChecks";
import { getBoundTextElement } from "../element/textElement";

// One element for each ExcalidrawTextElement subtype.
// ShortcutMap arrays, then typeguards for these.
type CustomShortcutMapArray = Array<Record<string, string[]>>;
const CustomShortcutMaps: CustomShortcutMapArray = [];
type CustomShortcutNameChecks = Array<Function>;
const customShortcutNameChecks: CustomShortcutNameChecks = [];

// Register shortcutMap and typeguard for subtype
export const registerCustomShortcutNames = (
  customShortcutMap: Record<string, string[]>,
  isCustomShortcutNameCheck: Function,
): void => {
  // If either customShortcutMap or isCustomShortcutNameCheck is already registered, do nothing
  if (
    !CustomShortcutMaps.includes(customShortcutMap) &&
    !customShortcutNameChecks.includes(isCustomShortcutNameCheck)
  ) {
    CustomShortcutMaps.push(customShortcutMap);
    customShortcutNameChecks.push(isCustomShortcutNameCheck);
  }
};

// Typeguard for CustomShortcutName (including all subtypes)
export const isCustomShortcutName = (s: any): s is CustomShortcutName => {
  for (let i = 0; i < customShortcutNameChecks.length; i++) {
    if (customShortcutNameChecks[i](s)) {
      return true;
    }
  }
  return false;
};

// Return the shortcut by CustomShortcutName.
// Assume CustomShortcutMaps and CustomShortcutNameChecks are matchingly sorted.
export const getShortcutFromCustomShortcutName = (name: CustomShortcutName) => {
  let shortcuts: string[] = [];
  for (let i = 0; i < CustomShortcutMaps.length; i++) {
    if (customShortcutNameChecks[i](name)) {
      shortcuts = CustomShortcutMaps[i][name];
    }
  }
  return shortcuts;
};

type DisabledPanelComponents = {
  subtype: CustomSubtype;
  actions: (ActionName | CustomActionName)[];
};

const disabledPanelComponents = [] as DisabledPanelComponents[];

export const registerDisabledPanelComponents = (
  subtype: CustomSubtype,
  actions: (ActionName | CustomActionName)[],
) => {
  if (getCustomSubtypes().includes(subtype)) {
    disabledPanelComponents.push({
      subtype,
      actions,
    } as DisabledPanelComponents);
  }
};

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
      disabledPanelComponents
        .find((value) => value.subtype === subtype)!
        .actions.includes(action)
    ) {
      return false;
    }
  }
  return subtype || !isCustomActionName(action);
};

type MethodMap = { subtype: CustomSubtype; methods: CustomMethods };
const methodMaps = [] as Array<MethodMap>;

// Assumption: registerTextElementSubtypes() has run first or is the caller
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
      require(`./${textSubtypes[index]}/index`).registerTextElementSubtype(
        getCustomMethods(subtype),
        onSubtypesLoaded,
      );
    }
  }
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
