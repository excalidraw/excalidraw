import { ExcalidrawElement } from "../element/types";
import { getNonDeletedElements } from "../element";
import { getSelectedElements } from "../scene";
import { AppState } from "../types";

import { Action, ActionName } from "../actions/types";
import { register } from "../actions/register";
import { hasBoundTextElement } from "../element/typeChecks";
import { getBoundTextElement } from "../element/textElement";

// Start adding subtype imports here

const customSubtype = [] as const;
const customProps = [] as const;
const customShortcutName = [] as const;
const disabledActions = [] as DisabledActions[];
const customActionName = [] as const;

// Custom Shortcuts
export const customShortcutMap: Record<CustomShortcutName, string[]> = {};

// Custom Icons
export const CUSTOM_SUBTYPE_ICONS = [] as const;

// End adding subtype imports here

// Types to export, union over all ExcalidrawElement subtypes

// Custom Subtypes
export type CustomSubtype = typeof customSubtype[number];
export const getCustomSubtypes = (): readonly CustomSubtype[] => {
  return customSubtype;
};

// Custom Properties
export type CustomProps = typeof customProps[number];

// Custom Shortcuts
export type CustomShortcutName = typeof customShortcutName[number];
export const isCustomShortcutName = (s: any): s is CustomShortcutName =>
  customShortcutName.includes(s as CustomShortcutName);

// Custom Actions
export type CustomActionName = typeof customActionName[number];
export const isCustomActionName = (name: any): name is CustomActionName => {
  return (
    customActionName.includes(name as CustomActionName) &&
    !customSubtype.includes(name as CustomSubtype)
  );
};

// Return the shortcut by CustomShortcutName
export const getCustomShortcutKey = (name: CustomShortcutName) => {
  let shortcuts: string[] = [];
  if (isCustomShortcutName(name)) {
    shortcuts = customShortcutMap[name];
  }
  return shortcuts;
};

// Permit subtypes to disable actions for their ExcalidrawElement type
type DisabledActions = {
  subtype: CustomSubtype;
  actions: ActionName[];
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

//Custom Actions
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

// Custom Methods
export type CustomMethods = {
  clean: Function;
  measureText: Function;
  render: Function;
  renderSvg: Function;
  wrap: Function;
};

type MethodMap = { subtype: CustomSubtype; methods: CustomMethods };
const methodMaps = [] as Array<MethodMap>;

// Assumption: registerCustomSubtypes() has run first or is the caller.
// Use `getCustomMethods` to call subtype-specialized methods, like `render`.
export const getCustomMethods = (subtype: CustomSubtype | undefined) => {
  const map = methodMaps.find((method) => method.subtype === subtype);
  return map?.methods;
};

// Register all custom subtypes.  Each subtype must provide a
// `registerCustomSubtype` method, which should call `addCustomActions`
// if necessary.
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
