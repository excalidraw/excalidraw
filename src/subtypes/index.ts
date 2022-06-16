import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "../element/types";
import { getNonDeletedElements } from "../element";
import { getSelectedElements } from "../scene";
import { AppState } from "../types";

import { Action, ActionName } from "../actions/types";
import { register } from "../actions/register";
import { hasBoundTextElement } from "../element/typeChecks";
import { getBoundTextElement } from "../element/textElement";

// Start adding subtype imports here

import {
  mathActionName,
  mathDisabledActions,
  mathProps,
  mathShortcutMap,
  mathShortcutName,
  mathSubtype,
} from "./math/types";

const customSubtype = [mathSubtype] as const;
const customProps = [...mathProps] as const;
const disabledActions = [...mathDisabledActions] as DisabledActions[];
const customActionName = [...mathActionName] as const;
const customShortcutName = [...mathShortcutName] as const;

// Custom Shortcuts
export const customShortcutMap: Record<CustomShortcutName, string[]> = {
  ...mathShortcutMap,
};

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
  let enabled = true;
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );
  selectedElements.forEach((element) => {
    const subtype = hasBoundTextElement(element)
      ? getBoundTextElement(element)!.subtype
      : element.subtype;
    if (!isActionEnabledForSubtype(subtype, actionName)) {
      enabled = false;
    }
  });
  if (selectedElements.length === 0) {
    const subtype = appState.editingElement
      ? appState.editingElement?.subtype
      : appState.customSubtype;
    if (!isActionEnabledForSubtype(subtype, actionName)) {
      enabled = false;
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
  clean: (
    updates: Omit<
      Partial<ExcalidrawElement>,
      "id" | "version" | "versionNonce"
    >,
  ) => Omit<Partial<ExcalidrawElement>, "id" | "version" | "versionNonce">;
  measureText: (
    element: Pick<
      ExcalidrawTextElement,
      "subtype" | "customProps" | "fontSize" | "fontFamily" | "text"
    >,
    next?: {
      fontSize?: number;
      text?: string;
      customProps?: CustomProps;
    },
    maxWidth?: number | null,
  ) => { width: number; height: number; baseline: number };
  render: (
    element: NonDeleted<ExcalidrawElement>,
    context: CanvasRenderingContext2D,
    renderCb?: () => void,
  ) => void;
  renderSvg: (
    svgRoot: SVGElement,
    root: SVGElement,
    element: NonDeleted<ExcalidrawElement>,
  ) => void;
  wrapText: (
    element: Pick<
      ExcalidrawTextElement,
      "subtype" | "customProps" | "fontSize" | "fontFamily" | "originalText"
    >,
    containerWidth: number,
    next?: {
      fontSize?: number;
      text?: string;
      customProps?: CustomProps;
    },
  ) => string;
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
  const subtypes = getCustomSubtypes();
  for (let index = 0; index < subtypes.length; index++) {
    const subtype = subtypes[index];
    if (!methodMaps.find((method) => method.subtype === subtype)) {
      methodMaps.push({ subtype, methods: {} as CustomMethods });
      require(`./${subtypes[index]}/index`).registerCustomSubtype(
        getCustomMethods(subtype),
        onSubtypesLoaded,
      );
    }
  }
};
