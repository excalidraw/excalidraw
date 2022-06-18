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
  mathActionNames,
  mathActions,
  mathDisabledActionNames,
  mathDisabledActions,
  mathParent,
  mathProps,
  mathShortcutMap,
  mathShortcutNames,
  mathSubtype,
} from "./math/types";

const customSubtypes = [...[mathSubtype]] as const;
const customParents = [...mathParent] as readonly {
  subtype: CustomSubtype;
  parentType: ExcalidrawElement["type"];
}[];
const customProps = [...mathProps] as const;
const customActionNames = [...mathActionNames] as const;
const customActions = [...mathActions] as readonly {
  subtype: CustomSubtype;
  actions: CustomActionName[];
}[];
const disabledActionNames = [
  ...mathDisabledActionNames,
] as readonly ActionName[];
const disabledActions = [...mathDisabledActions] as readonly {
  subtype: CustomSubtype;
  actions: DisabledActionName[];
}[];
const customShortcutNames = [...mathShortcutNames] as const;

// Custom Shortcuts
export const customShortcutMap = { ...mathShortcutMap } as Record<
  CustomShortcutName,
  string[]
>;

// End adding subtype imports here

// Types to export, union over all ExcalidrawElement subtypes

// Custom Subtypes
export type CustomSubtype = typeof customSubtypes[number];
export const getCustomSubtypes = (): readonly CustomSubtype[] => {
  return customSubtypes;
};
export const isValidSubtype = (s: any, t: any): s is CustomSubtype =>
  customParents.find(
    (val) => val.subtype === (s as string) && val.parentType === (t as string),
  ) !== undefined;

// Custom Properties
export type CustomProps = typeof customProps[number];

// Custom Actions
export type CustomActionName = typeof customActionNames[number];

const customActionMap: Action[] = [];
export const getCustomActions = (): readonly Action[] => {
  return customActionMap;
};

const addCustomAction = (action: Action) => {
  if (customActionMap.every((value) => value.name !== action.name)) {
    const customName = action.name as CustomActionName;
    if (customActionNames.includes(customName)) {
      customActionMap.push(action);
      register(action);
    }
  }
};

// Standard actions disabled by subtypes
type DisabledActionName = typeof disabledActionNames[number];

export const isActionEnabled = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  actionName: ActionName | CustomActionName,
) => {
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );
  const chosen = appState.editingElement
    ? [appState.editingElement, ...selectedElements]
    : selectedElements;
  let enabled = chosen.some((el) =>
    customParents.some(
      (parent) =>
        el.type === parent.parentType &&
        el.subtype === undefined &&
        !customActionNames.includes(actionName as CustomActionName),
    ),
  );
  enabled =
    enabled ||
    (chosen.length === 0 &&
      (appState.customSubtype === undefined ||
        isActionForSubtype(appState.customSubtype, actionName)));
  !enabled &&
    chosen.forEach((el) => {
      const subtype = hasBoundTextElement(el)
        ? getBoundTextElement(el)!.subtype
        : el.subtype;
      if (!enabled && isActionForSubtype(subtype, actionName)) {
        enabled = true;
      }
    });
  if (customSubtypes.includes(actionName as CustomSubtype)) {
    enabled = true;
  }
  return enabled;
};

const isActionForSubtype = (
  subtype: CustomSubtype | undefined,
  action: ActionName | CustomActionName,
) => {
  const name = action as DisabledActionName;
  const customName = action as CustomActionName;
  if (subtype && customSubtypes.includes(subtype)) {
    return (
      !disabledActions // Not disabled by subtype
        .find((value) => value.subtype === subtype)!
        .actions.includes(name) ||
      customActions // Added by subtype
        .find((value) => value.subtype === subtype)!
        .actions.includes(customName)
    );
  }
  return (
    !customActionNames.includes(customName) &&
    !disabledActions.some((disabled) => disabled.actions.includes(name))
  );
};

// Custom Shortcuts (for custom actions)
export type CustomShortcutName = typeof customShortcutNames[number];
export const isCustomShortcutName = (s: any): s is CustomShortcutName =>
  customShortcutNames.includes(s as CustomShortcutName);

// Return the shortcut by CustomShortcutName
export const getCustomShortcutKey = (name: CustomShortcutName) => {
  let shortcuts: string[] = [];
  if (isCustomShortcutName(name)) {
    shortcuts = customShortcutMap[name];
  }
  return shortcuts;
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
// `registerCustomSubtype` method, which should have these params:
// - methods: CustomMethods
// - addCustomAction: (action: Action) => void
// - onSubtypeLoaded?: (isCustomSubtype: Function) => void
export const registerCustomSubtypes = (
  onSubtypeLoaded?: (isCustomSubtype: Function) => void,
) => {
  const subtypes = customSubtypes;
  for (let index = 0; index < subtypes.length; index++) {
    const subtype = subtypes[index];
    if (!methodMaps.find((method) => method.subtype === subtype)) {
      const methods = {} as CustomMethods;
      methodMaps.push({ subtype, methods });
      require(`./${subtypes[index]}/index`).registerCustomSubtype(
        methods,
        addCustomAction,
        onSubtypeLoaded,
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
    const map = getCustomMethods(subtype)!;
    await map.ensureLoaded();
  }
  if (callback) {
    callback();
  }
};
