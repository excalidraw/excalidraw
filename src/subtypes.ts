import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "./element/types";
import { getNonDeletedElements } from "./element";
import { getSelectedElements } from "./scene";
import { AppState } from "./types";
import { registerAuxLangData } from "./i18n";

import { Action, ActionName } from "./actions/types";
import { register } from "./actions/register";
import { hasBoundTextElement } from "./element/typeChecks";
import { getBoundTextElement } from "./element/textElement";

// Use "let" instead of "const" so we can dynamically add subtypes
let customSubtypes: readonly CustomSubtype[] = [];
let customParents: SubtypeTypes["parents"] = [];
let customProps: SubtypeTypes["customProps"] = [];
let customActions: SubtypeTypes["customActions"] = [];
let disabledActions: SubtypeTypes["disabledActions"] = [];
let customShortcutNames: SubtypeTypes["customShortcutNames"] = [];
let customShortcutMap: SubtypeTypes["customShortcutMap"] = {};

export type SubtypeTypes = Readonly<{
  subtype: CustomSubtype;
  parents: readonly {
    subtype: CustomSubtype;
    parentType: ExcalidrawElement["type"];
  }[];
  customProps: readonly CustomProps[];
  customActions: readonly {
    subtype: CustomSubtype;
    actions: CustomActionName[];
  }[];
  disabledActions: readonly {
    subtype: CustomSubtype;
    actions: DisabledActionName[];
  }[];
  customShortcutNames: readonly CustomShortcutName[];
  customShortcutMap: Record<CustomShortcutName, string[]>;
}>;

// Custom Subtypes
export type CustomSubtype = string;
export const getCustomSubtypes = (): readonly CustomSubtype[] => {
  return customSubtypes;
};
export const isValidSubtype = (s: any, t: any): s is CustomSubtype =>
  customParents.find(
    (val) => val.subtype === (s as string) && val.parentType === (t as string),
  ) !== undefined;
const isSubtype = (s: any): s is CustomSubtype => customSubtypes.includes(s);

// Custom Properties
export type CustomProps = any;

// Custom Actions
export type CustomActionName = string;

const isCustomActionName = (s: any): s is CustomActionName =>
  customActions.some((val) => val.actions.includes(s));

const customActionMap: Action[] = [];
export const getCustomActions = (): readonly Action[] => {
  return customActionMap;
};

const addCustomAction = (action: Action) => {
  if (isCustomActionName(action.name)) {
    if (customActionMap.every((value) => value.name !== action.name)) {
      customActionMap.push(action);
      register(action);
    }
  }
};

// Standard actions disabled by subtypes
type DisabledActionName = ActionName;

const isDisabledActionName = (s: any): s is DisabledActionName =>
  disabledActions.some((val) => val.actions.includes(s));

// Is the `actionName` one of the custom actions for `subtype`
// (if `isAdded` is true) or one of the standard actions disabled
// by `subtype` (if `isAdded` is false)?
const isForSubtype = (
  subtype: ExcalidrawElement["subtype"],
  actionName: ActionName | CustomActionName,
  isAdded: boolean,
) => {
  const actions = isAdded ? customActions : disabledActions;
  const map = actions.find((value) => value.subtype === subtype);
  if (map) {
    return map.actions.includes(actionName);
  }
  return false;
};

export const isActionEnabled = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  actionName: ActionName | CustomActionName,
) => {
  // We always enable subtype actions.  Also let through standard actions
  // which no subtypes might have disabled.
  if (
    isSubtype(actionName) ||
    (!isCustomActionName(actionName) && !isDisabledActionName(actionName))
  ) {
    return true;
  }
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );
  const chosen = appState.editingElement
    ? [appState.editingElement, ...selectedElements]
    : selectedElements;
  // Now handle custom actions added by subtypes
  if (isCustomActionName(actionName)) {
    // Has any ExcalidrawElement enabled this actionName through having
    // its subtype?
    return (
      chosen.some((el) => {
        const e = hasBoundTextElement(el) ? getBoundTextElement(el)! : el;
        return isForSubtype(e.subtype, actionName, true);
      }) ||
      // Or has any active subtype enabled this actionName?
      appState.activeSubtypes?.some((subtype) => {
        if (!isValidSubtype(subtype, appState.activeTool.type)) {
          return false;
        }
        return isForSubtype(subtype, actionName, true);
      })
    );
  }
  // Now handle standard actions disabled by subtypes
  if (isDisabledActionName(actionName)) {
    return (
      // Has every ExcalidrawElement not disabled this actionName?
      (chosen.every((el) => {
        const e = hasBoundTextElement(el) ? getBoundTextElement(el)! : el;
        return !isForSubtype(e.subtype, actionName, false);
      }) &&
        // And has every active subtype not disabled this actionName?
        (appState.activeSubtypes === undefined ||
          appState.activeSubtypes?.every((subtype) => {
            if (!isValidSubtype(subtype, appState.activeTool.type)) {
              return true;
            }
            return !isForSubtype(subtype, actionName, false);
          }))) ||
      // Or is there an ExcalidrawElement without a subtype which would
      // disable this action if it had a subtype?
      chosen.some((el) => {
        const e = hasBoundTextElement(el) ? getBoundTextElement(el)! : el;
        return customParents.some(
          (value) =>
            value.parentType === e.type &&
            e.subtype === undefined &&
            disabledActions
              .find((val) => val.subtype === value.subtype)!
              .actions.includes(actionName),
        );
      })
    );
  }
  // Shouldn't happen
  return true;
};

// Are any of the parent types of `subtype` shared by any subtype
// in the array?
export const subtypeCollides = (
  subtype: CustomSubtype,
  subtypeArray: CustomSubtype[],
) => {
  const subtypeParents = customParents
    .filter((value) => value.subtype === subtype)
    .map((value) => value.parentType);
  const subtypeArrayParents = subtypeArray.flatMap((s) =>
    customParents
      .filter((value) => value.subtype === s)
      .map((value) => value.parentType),
  );
  return subtypeParents.some((t) => subtypeArrayParents.includes(t));
};

// Custom Shortcuts (for custom actions)
export type CustomShortcutName = string;
export const isCustomShortcutName = (s: any): s is CustomShortcutName =>
  customShortcutNames.includes(s);

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

type MethodMap = { subtype: CustomSubtype; methods: Partial<CustomMethods> };
const methodMaps = [] as Array<MethodMap>;

// Use `getCustomMethods` to call subtype-specialized methods, like `render`.
export const getCustomMethods = (subtype: CustomSubtype | undefined) => {
  const map = methodMaps.find((method) => method.subtype === subtype);
  return map?.methods;
};

export const addCustomMethods = (
  subtype: CustomSubtype,
  methods: Partial<CustomMethods>,
) => {
  if (!methodMaps.find((method) => method.subtype === subtype)) {
    methodMaps.push({ subtype, methods });
  }
};

// For a given `ExcalidrawElement` type, return the active subtype
// and associated customProps (if any) from the AppState.  Assume
// only one subtype is active for a given `ExcalidrawElement` type
// at any given time.
export const selectSubtype = (
  appState: {
    activeSubtypes?: AppState["activeSubtypes"];
    customProps?: AppState["customProps"];
  },
  type: ExcalidrawElement["type"],
): {
  subtype?: ExcalidrawElement["subtype"];
  customProps?: ExcalidrawElement["customProps"];
} => {
  if (appState.activeSubtypes === undefined) {
    return {};
  }
  const subtype = appState.activeSubtypes.find((subtype) =>
    isValidSubtype(subtype, type),
  );
  if (subtype === undefined) {
    return {};
  }
  if (
    appState.customProps === undefined ||
    !(subtype in appState.customProps)
  ) {
    return { subtype };
  }
  const customProps = appState.customProps?.subtype;
  return { subtype, customProps };
};

// Functions to prepare subtypes for use
export type SubtypePrepFn = (
  addCustomAction: (action: Action) => void,
  addLangData: (
    fallbackLangData: Object,
    setLanguageAux: (langCode: string) => Promise<Object | undefined>,
  ) => void,
  onSubtypeLoaded?: (
    hasSubtype: (element: ExcalidrawElement) => boolean,
  ) => void,
) => {
  actions: Action[];
  methods: Partial<CustomMethods>;
};

// This is the main method to set up the subtype.  The optional
// `onSubtypeLoaded` callback may be used to re-render subtyped
// `ExcalidrawElement`s after the subtype has finished async loading.
// See the MathJax plugin in `@excalidraw/plugins` for example.
export const prepareSubtype = (
  types: SubtypeTypes,
  subtypePrepFn: SubtypePrepFn,
  onSubtypeLoaded?: (
    hasSubtype: (element: ExcalidrawElement) => boolean,
  ) => void,
): { actions: Action[] | null; methods: Partial<CustomMethods> } => {
  const map = getCustomMethods(types.subtype);
  if (map) {
    return { actions: null, methods: map };
  }

  // Register the types
  customSubtypes = [...customSubtypes, types.subtype];
  customParents = [...customParents, ...types.parents];
  customProps = [...customProps, ...types.customProps];
  customActions = [...customActions, ...types.customActions];
  disabledActions = [...disabledActions, ...types.disabledActions];
  customShortcutNames = [...customShortcutNames, ...types.customShortcutNames];
  customShortcutMap = { ...customShortcutMap, ...types.customShortcutMap };

  // Prepare the subtype
  const { actions, methods } = subtypePrepFn(
    addCustomAction,
    registerAuxLangData,
    onSubtypeLoaded,
  );
  addCustomMethods(types.subtype, methods);
  return { actions, methods };
};

// Ensure all subtypes are loaded before continuing, eg to
// render SVG previews of new charts.  Chart-relevant subtypes
// include math equations in titles or non hand-drawn line styles.
export const ensureSubtypesLoadedForElements = async (
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
  await ensureSubtypesLoaded(subtypesUsed, callback);
};

export const ensureSubtypesLoaded = async (
  subtypes: CustomSubtype[],
  callback?: () => void,
) => {
  // Use a for loop so we can do `await map.ensureLoaded()`
  for (let i = 0; i < subtypes.length; i++) {
    const subtype = subtypes[i];
    // Should be defined if prepareSubtype() has run
    const map = getCustomMethods(subtype);
    if (map?.ensureLoaded) {
      await map.ensureLoaded();
    }
  }
  if (callback) {
    callback();
  }
};
