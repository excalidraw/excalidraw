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

const customSubtype = [] as const;
const customParents = [
  {} as { subtype: never, parentType: never },
] as const;
const customProps = [] as const;
const disabledActions = [
  {} as { subtype: never, actions: ActionName[] },
] as const;
const subtypeActions = [
  {} as { subtype: never, actions: ActionName[] },
] as const;
const customActionName = [] as const;
const customShortcutName = [] as const;

// Custom Shortcuts
export const customShortcutMap: Record<CustomShortcutName, string[]> = {};

// End adding subtype imports here

// Types to export, union over all ExcalidrawElement subtypes

// Custom Subtypes
export type CustomSubtype = typeof customSubtype[number];
export const getCustomSubtypes = (): readonly CustomSubtype[] => {
  return customSubtype;
};
export const isValidSubtype = (s: any, t: any): s is CustomSubtype =>
  customParents.find(
    (val) => val.subtype === (s as string) && val.parentType === (t as string),
  ) !== undefined;

// Custom Properties
export type CustomProps = typeof customProps[number];

// Custom Shortcuts
export type CustomShortcutName = typeof customShortcutName[number];
export const isCustomShortcutName = (s: any): s is CustomShortcutName =>
  customShortcutName.includes(s as CustomShortcutName);

// Custom Actions
export type CustomActionName = typeof customActionName[number];

// Return the shortcut by CustomShortcutName
export const getCustomShortcutKey = (name: CustomShortcutName) => {
  let shortcuts: string[] = [];
  if (isCustomShortcutName(name)) {
    shortcuts = customShortcutMap[name];
  }
  return shortcuts;
};

// Permit subtypes to disable actions for their ExcalidrawElement type
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
  const chosen = appState.editingElement
    ? [appState.editingElement, ...selectedElements]
    : selectedElements;
  const standard =
    chosen.some((el) =>
      customParents.some(
        (parent) =>
          el.type === parent.parentType &&
          el.subtype === undefined &&
          !customActionName.includes(actionName as CustomActionName),
      ),
    ) ||
    (chosen.length === 0 &&
      (appState.customSubtype === undefined ||
        isActionForSubtype(appState.customSubtype, actionName)));
  chosen.forEach((el) => {
    const subtype = hasBoundTextElement(el)
      ? getBoundTextElement(el)!.subtype
      : el.subtype;
    if (isActionForSubtype(subtype, actionName)) {
      enabled = true;
    }
  });
  if (customSubtype.includes(actionName as CustomSubtype)) {
    enabled = true;
  }
  return enabled || standard;
};

const isActionForSubtype = (
  subtype: CustomSubtype | undefined,
  action: ActionName | CustomActionName,
) => {
  const name = action as ActionName;
  const customName = action as CustomActionName;
  if (subtype && customSubtype.includes(subtype)) {
    return (
      !disabledActions // Not disabled by subtype
        .find((value) => value.subtype === subtype)!
        .actions.includes(name) ||
      subtypeActions // Added by subtype
        .find((value) => value.subtype === subtype)!
        .actions.includes(customName)
    );
  }
  return (
    !customActionName.includes(customName) &&
    !disabledActions.some((disabled) => disabled.actions.includes(name))
  );
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
  ensureLoaded: (callback?: () => void) => Promise<void>;
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
    opt?: { offsetX?: number; offsetY?: number },
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

export const ensureSubtypesLoaded = async (
  elements: readonly ExcalidrawElement[],
  callback?: () => void,
) => {
  // Only ensure the loading of subtypes which are actually needed.
  // We don't want to be held up by eg downloading the MathJax SVG fonts
  // if we don't actually need them yet.
  const subtypesUsed = [] as CustomSubtype[];
  elements.forEach((el) => {
    if (
      "subtype" in el &&
      isValidSubtype(el.subtype, el.type) &&
      !subtypesUsed.includes(el.subtype)
    ) {
      subtypesUsed.push(el.subtype);
    }
  });
  for (let i = 0; i < subtypesUsed.length; i++) {
    const subtype = subtypesUsed[i];
    // Should be defined if registerCustomSubtypes() has run
    const map = getCustomMethods(subtype);
    await map!.ensureLoaded();
  }
  if (callback) {
    callback();
  }
};
