import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "./element/types";
import { getNonDeletedElements } from "./element";
import { getSelectedElements } from "./scene";
import { AppState } from "./types";
import { registerAuxLangData } from "./i18n";

import { Action, ActionName, DisableFn, EnableFn } from "./actions/types";
import {
  CustomShortcutName,
  registerCustomShortcuts,
} from "./actions/shortcuts";
import { register } from "./actions/register";
import { registerDisableFn, registerEnableFn } from "./actions/guards";
import { hasBoundTextElement } from "./element/typeChecks";
import { getBoundTextElement } from "./element/textElement";

// Use "let" instead of "const" so we can dynamically add subtypes
let subtypeNames: readonly Subtype[] = [];
let parentTypeMap: readonly {
  subtype: Subtype;
  parentType: ExcalidrawElement["type"];
}[] = [];
let subtypeActionMap: readonly {
  subtype: Subtype;
  actions: readonly SubtypeActionName[];
}[] = [];
let disabledActionMap: readonly {
  subtype: Subtype;
  actions: readonly DisabledActionName[];
}[] = [];
let alwaysEnabledMap: readonly {
  subtype: Subtype;
  actions: readonly SubtypeActionName[];
}[] = [];

export type SubtypeRecord = Readonly<{
  subtype: Subtype;
  parents: readonly ExcalidrawElement["type"][];
  actionNames: readonly SubtypeActionName[];
  disabledNames: readonly DisabledActionName[];
  shortcutMap: Record<CustomShortcutName, string[]>;
  alwaysEnabledNames?: readonly SubtypeActionName[];
}>;

// Subtype Names
export type Subtype = string;
export const getSubtypeNames = (): readonly Subtype[] => {
  return subtypeNames;
};
export const isValidSubtype = (s: any, t: any): s is Subtype =>
  parentTypeMap.find(
    (val) => val.subtype === (s as string) && val.parentType === (t as string),
  ) !== undefined;
const isSubtypeName = (s: any): s is Subtype => subtypeNames.includes(s);

// Subtype Actions

// Used for context menus in the shape chooser
export const hasAlwaysEnabledActions = (s: any): boolean => {
  if (!isSubtypeName(s)) {
    return false;
  }
  return alwaysEnabledMap.some((value) => value.subtype === s);
};

type SubtypeActionName = string;

const isSubtypeActionName = (s: any): s is SubtypeActionName =>
  subtypeActionMap.some((val) => val.actions.includes(s));

const addSubtypeAction = (action: Action) => {
  if (isSubtypeActionName(action.name) || isSubtypeName(action.name)) {
    register(action);
  }
};

// Standard actions disabled by subtypes
type DisabledActionName = ActionName;

const isDisabledActionName = (s: any): s is DisabledActionName =>
  disabledActionMap.some((val) => val.actions.includes(s));

// Is the `actionName` one of the subtype actions for `subtype`
// (if `isAdded` is true) or one of the standard actions disabled
// by `subtype` (if `isAdded` is false)?
const isForSubtype = (
  subtype: ExcalidrawElement["subtype"],
  actionName: ActionName | SubtypeActionName,
  isAdded: boolean,
) => {
  const actions = isAdded ? subtypeActionMap : disabledActionMap;
  const map = actions.find((value) => value.subtype === subtype);
  if (map) {
    return map.actions.includes(actionName);
  }
  return false;
};

const isActionDisabled: DisableFn = function (elements, appState, actionName) {
  return !isActionEnabled(elements, appState, actionName);
};

const isActionEnabled: EnableFn = function (elements, appState, actionName) {
  // We always enable subtype actions.  Also let through standard actions
  // which no subtypes might have disabled.
  if (
    isSubtypeName(actionName) ||
    (!isSubtypeActionName(actionName) && !isDisabledActionName(actionName))
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
  // Now handle actions added by subtypes
  if (isSubtypeActionName(actionName)) {
    // Has any ExcalidrawElement enabled this actionName through having
    // its subtype?
    return (
      chosen.some((el) => {
        const e = hasBoundTextElement(el) ? getBoundTextElement(el)! : el;
        return isForSubtype(e.subtype, actionName, true);
      }) ||
      // Or has any active subtype enabled this actionName?
      (appState.activeSubtypes !== undefined &&
        appState.activeSubtypes?.some((subtype) => {
          if (!isValidSubtype(subtype, appState.activeTool.type)) {
            return false;
          }
          return isForSubtype(subtype, actionName, true);
        })) ||
      alwaysEnabledMap.some((value) => {
        return value.actions.includes(actionName);
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
        return parentTypeMap.some(
          (value) =>
            value.parentType === e.type &&
            e.subtype === undefined &&
            disabledActionMap
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
export const subtypeCollides = (subtype: Subtype, subtypeArray: Subtype[]) => {
  const subtypeParents = parentTypeMap
    .filter((value) => value.subtype === subtype)
    .map((value) => value.parentType);
  const subtypeArrayParents = subtypeArray.flatMap((s) =>
    parentTypeMap
      .filter((value) => value.subtype === s)
      .map((value) => value.parentType),
  );
  return subtypeParents.some((t) => subtypeArrayParents.includes(t));
};

// Subtype Methods
export type SubtypeMethods = {
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
      "subtype" | "customData" | "fontSize" | "fontFamily" | "text"
    >,
    next?: {
      fontSize?: number;
      text?: string;
      customData?: ExcalidrawElement["customData"];
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
      "subtype" | "customData" | "fontSize" | "fontFamily" | "originalText"
    >,
    containerWidth: number,
    next?: {
      fontSize?: number;
      text?: string;
      customData?: ExcalidrawElement["customData"];
    },
  ) => string;
};

type MethodMap = { subtype: Subtype; methods: Partial<SubtypeMethods> };
const methodMaps = [] as Array<MethodMap>;

// Use `getSUbtypeMethods` to call subtype-specialized methods, like `render`.
export const getSubtypeMethods = (subtype: Subtype | undefined) => {
  const map = methodMaps.find((method) => method.subtype === subtype);
  return map?.methods;
};

export const addSubtypeMethods = (
  subtype: Subtype,
  methods: Partial<SubtypeMethods>,
) => {
  if (!methodMaps.find((method) => method.subtype === subtype)) {
    methodMaps.push({ subtype, methods });
  }
};

// For a given `ExcalidrawElement` type, return the active subtype
// and associated customData (if any) from the AppState.  Assume
// only one subtype is active for a given `ExcalidrawElement` type
// at any given time.
export const selectSubtype = (
  appState: {
    activeSubtypes?: AppState["activeSubtypes"];
    customData?: AppState["customData"];
  },
  type: ExcalidrawElement["type"],
): {
  subtype?: ExcalidrawElement["subtype"];
  customData?: ExcalidrawElement["customData"];
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
  if (appState.customData === undefined || !(subtype in appState.customData)) {
    return { subtype };
  }
  const customData = appState.customData?.subtype;
  return { subtype, customData };
};

// Callback to re-render subtyped `ExcalidrawElement`s after completing
// async loading of the subtype.
export type SubtypeLoadedCb = (
  hasSubtype: (element: ExcalidrawElement) => boolean,
) => void;

// Functions to prepare subtypes for use
export type SubtypePrepFn = (
  addSubtypeAction: (action: Action) => void,
  addLangData: (
    fallbackLangData: Object,
    setLanguageAux: (langCode: string) => Promise<Object | undefined>,
  ) => void,
  onSubtypeLoaded?: SubtypeLoadedCb,
) => {
  actions: Action[];
  methods: Partial<SubtypeMethods>;
};

// This is the main method to set up the subtype.  The optional
// `onSubtypeLoaded` callback may be used to re-render subtyped
// `ExcalidrawElement`s after the subtype has finished async loading.
// See the MathJax extension in `@excalidraw/extensions` for example.
export const prepareSubtype = (
  record: SubtypeRecord,
  subtypePrepFn: SubtypePrepFn,
  onSubtypeLoaded?: SubtypeLoadedCb,
): { actions: Action[] | null; methods: Partial<SubtypeMethods> } => {
  const map = getSubtypeMethods(record.subtype);
  if (map) {
    return { actions: null, methods: map };
  }

  // Check for undefined/null subtypes and parentTypes
  if (
    record.subtype === undefined ||
    record.subtype === "" ||
    record.parents === undefined ||
    record.parents.length === 0
  ) {
    return { actions: null, methods: {} };
  }

  // Register the types
  const subtype = record.subtype;
  subtypeNames = [...subtypeNames, subtype];
  record.parents.forEach((parentType) => {
    parentTypeMap = [...parentTypeMap, { subtype, parentType }];
  });
  subtypeActionMap = [
    ...subtypeActionMap,
    { subtype, actions: record.actionNames },
  ];
  disabledActionMap = [
    ...disabledActionMap,
    { subtype, actions: record.disabledNames },
  ];
  if (record.alwaysEnabledNames) {
    alwaysEnabledMap = [
      ...alwaysEnabledMap,
      { subtype, actions: record.alwaysEnabledNames },
    ];
  }
  registerCustomShortcuts(record.shortcutMap);

  // Prepare the subtype
  const { actions, methods } = subtypePrepFn(
    addSubtypeAction,
    registerAuxLangData,
    onSubtypeLoaded,
  );

  record.disabledNames.forEach((name) => {
    registerDisableFn(name, isActionDisabled);
  });
  record.actionNames.forEach((name) => {
    registerEnableFn(name, isActionEnabled);
  });
  registerEnableFn(record.subtype, isActionEnabled);
  // Register the subtype's methods
  addSubtypeMethods(record.subtype, methods);
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
  const subtypesUsed = [] as Subtype[];
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
  subtypes: Subtype[],
  callback?: () => void,
) => {
  // Use a for loop so we can do `await map.ensureLoaded()`
  for (let i = 0; i < subtypes.length; i++) {
    const subtype = subtypes[i];
    // Should be defined if prepareSubtype() has run
    const map = getSubtypeMethods(subtype);
    if (map?.ensureLoaded) {
      await map.ensureLoaded();
    }
  }
  if (callback) {
    callback();
  }
};
