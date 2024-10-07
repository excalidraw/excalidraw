import { useEffect } from "react";
import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "../types";
import { getNonDeletedElements } from "../";
import { getSelectedElements } from "../../scene";
import type { AppState, ExcalidrawImperativeAPI, ToolType } from "../../types";
import type { LangLdr } from "../../i18n";
import { registerCustomLangData } from "../../i18n";

import type {
  Action,
  ActionName,
  ActionPredicateFn,
  CustomActionName,
} from "../../actions/types";
import { makeCustomActionName } from "../../actions/types";
import { registerCustomShortcuts } from "../../actions/shortcuts";
import { register } from "../../actions/register";
import { hasBoundTextElement, isTextElement } from "../typeChecks";
import {
  getBoundTextElement,
  getContainerElement,
  redrawTextBoundingBox,
} from "../textElement";
import { ShapeCache } from "../../scene/ShapeCache";
import Scene from "../../scene/Scene";

// Use "let" instead of "const" so we can dynamically add subtypes
let subtypeNames: readonly Subtype[] = [];
let parentTypeMap: readonly {
  subtype: Subtype;
  parentType: ExcalidrawElement["type"];
}[] = [];
let subtypeActionMap: readonly {
  subtype: Subtype;
  actions: readonly ActionName[];
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
  parents: readonly (ExcalidrawElement["type"] & ToolType)[];
  actionNames?: readonly SubtypeActionName[];
  disabledNames?: readonly DisabledActionName[];
  shortcutMap?: Record<string, string[]>;
  alwaysEnabledNames?: readonly SubtypeActionName[];
}>;

// Subtype Names
export type Subtype = Required<ExcalidrawElement>["subtype"];
export const getSubtypeNames = (): readonly Subtype[] => {
  return subtypeNames;
};
export const isValidSubtype = (s: any, t: any): s is Subtype =>
  parentTypeMap.find(
    (val) => (val.subtype as any) === s && (val.parentType as any) === t,
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
  actionName: ActionName,
  isAdded: boolean,
) => {
  const actions = isAdded ? subtypeActionMap : disabledActionMap;
  const map = actions.find((value) => value.subtype === subtype);
  if (map) {
    return map.actions.includes(actionName);
  }
  return false;
};

export const isSubtypeAction: ActionPredicateFn = function (action) {
  return isSubtypeActionName(action.name) && !isSubtypeName(action.name);
};

export const subtypeActionPredicate: ActionPredicateFn = function (
  action,
  elements,
  appState,
  app,
) {
  // We always enable subtype actions.  Also let through standard actions
  // which no subtypes might have disabled.
  if (
    isSubtypeName(action.name) ||
    (!isSubtypeActionName(action.name) && !isDisabledActionName(action.name))
  ) {
    return true;
  }
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );
  const chosen = appState.editingTextElement
    ? [appState.editingTextElement, ...selectedElements]
    : selectedElements;
  // Now handle actions added by subtypes
  if (isSubtypeActionName(action.name)) {
    // Has any ExcalidrawElement enabled this actionName through having
    // its subtype?
    return (
      chosen.some((el) => {
        const e = hasBoundTextElement(el)
          ? getBoundTextElement(el, app.scene.getElementsMapIncludingDeleted())!
          : el;
        return isForSubtype(e.subtype, action.name, true);
      }) ||
      // Or has any active subtype enabled this actionName?
      (appState.activeSubtypes !== undefined &&
        appState.activeSubtypes?.some((subtype) => {
          if (!isValidSubtype(subtype, appState.activeTool.type)) {
            return false;
          }
          return isForSubtype(subtype, action.name, true);
        })) ||
      alwaysEnabledMap.some((value) => {
        return value.actions.includes(action.name);
      })
    );
  }
  // Now handle standard actions disabled by subtypes
  if (isDisabledActionName(action.name)) {
    return (
      // Has every ExcalidrawElement not disabled this actionName?
      (chosen.every((el) => {
        const e = hasBoundTextElement(el)
          ? getBoundTextElement(el, app.scene.getElementsMapIncludingDeleted())!
          : el;
        return !isForSubtype(e.subtype, action.name, false);
      }) &&
        // And has every active subtype not disabled this actionName?
        (appState.activeSubtypes === undefined ||
          appState.activeSubtypes?.every((subtype) => {
            if (!isValidSubtype(subtype, appState.activeTool.type)) {
              return true;
            }
            return !isForSubtype(subtype, action.name, false);
          }))) ||
      // Or can we find an ExcalidrawElement without a valid subtype
      // which would disable this action if it had a valid subtype?
      chosen.some((el) => {
        const e = hasBoundTextElement(el)
          ? getBoundTextElement(el, app.scene.getElementsMapIncludingDeleted())!
          : el;
        return parentTypeMap.some(
          (value) =>
            value.parentType === e.type &&
            !isValidSubtype(e.subtype, e.type) &&
            isForSubtype(value.subtype, action.name, false),
        );
      }) ||
      chosen.some((el) => {
        const e = hasBoundTextElement(el)
          ? getBoundTextElement(el, app.scene.getElementsMapIncludingDeleted())!
          : el;
        return (
          // Would the subtype of e by inself disable this action?
          isForSubtype(e.subtype, action.name, false) &&
          // Can we find an ExcalidrawElement which could have the same subtype
          // as e but whose subtype does not disable this action?
          chosen.some((el) => {
            const e2 = hasBoundTextElement(el)
              ? getBoundTextElement(
                  el,
                  app.scene.getElementsMapIncludingDeleted(),
                )!
              : el;
            return (
              // Does e have a valid subtype whose parent types include the
              // type of e2, and does the subtype of e2 not disable this action?
              parentTypeMap
                .filter((val) => val.subtype === e.subtype)
                .some((val) => val.parentType === e2.type) &&
              !isForSubtype(e2.subtype, action.name, false)
            );
          })
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
  getEditorStyle: (element: ExcalidrawTextElement) => Record<string, any>;
  ensureLoaded: (callback?: () => void) => Promise<void>;
  measureText: (
    element: Pick<
      ExcalidrawTextElement,
      | "subtype"
      | "customData"
      | "fontSize"
      | "fontFamily"
      | "text"
      | "lineHeight"
    >,
    next?: {
      fontSize?: number;
      text?: string;
      customData?: ExcalidrawElement["customData"];
    },
  ) => { width: number; height: number };
  render: (
    element: NonDeleted<ExcalidrawElement>,
    elementsMap: ElementsMap,
    context: CanvasRenderingContext2D,
  ) => void;
  renderSvg: (
    svgRoot: SVGElement,
    addToRoot: (node: SVGElement, element: ExcalidrawElement) => void,
    element: NonDeleted<ExcalidrawElement>,
    elementsMap: ElementsMap,
    opt?: { offsetX?: number; offsetY?: number },
  ) => void;
  wrapText: (
    element: Pick<
      ExcalidrawTextElement,
      | "subtype"
      | "customData"
      | "fontSize"
      | "fontFamily"
      | "originalText"
      | "lineHeight"
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

// Use `getSubtypeMethods` to call subtype-specialized methods, like `render`.
export const getSubtypeMethods = (
  subtype: Subtype | undefined,
): Partial<SubtypeMethods> | undefined => {
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
  const customData = appState.customData[subtype];
  return { subtype, customData };
};

// Callback to re-render subtyped `ExcalidrawElement`s after completing
// async loading of the subtype.
export type SubtypeLoadedCb = (hasSubtype: SubtypeCheckFn) => void;
export type SubtypeCheckFn = (element: ExcalidrawElement) => boolean;

// Functions to prepare subtypes for use
export type SubtypePrepFn = (
  addSubtypeAction: (action: Action) => void,
  addLangData: (fallbackLangData: {}, setLanguageAux: LangLdr) => void,
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
): { actions: readonly Action[] | null; methods: Partial<SubtypeMethods> } => {
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
  if (record.actionNames) {
    subtypeActionMap = [
      ...subtypeActionMap,
      {
        subtype,
        actions: record.actionNames.map((actionName) =>
          makeCustomActionName(actionName),
        ),
      },
    ];
  }
  if (record.disabledNames) {
    disabledActionMap = [
      ...disabledActionMap,
      { subtype, actions: record.disabledNames },
    ];
  }
  if (record.alwaysEnabledNames) {
    alwaysEnabledMap = [
      ...alwaysEnabledMap,
      {
        subtype,
        actions: record.alwaysEnabledNames.map((actionName) =>
          makeCustomActionName(actionName),
        ),
      },
    ];
  }
  const customShortcutMap = record.shortcutMap;
  if (customShortcutMap) {
    const shortcutMap: Record<CustomActionName, string[]> = {};
    for (const key in customShortcutMap) {
      shortcutMap[makeCustomActionName(key)] = customShortcutMap[key];
    }
    registerCustomShortcuts(shortcutMap);
  }

  // Prepare the subtype
  const { actions, methods } = subtypePrepFn(
    addSubtypeAction,
    registerCustomLangData,
    onSubtypeLoaded,
  );

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

// Call this method after finishing any async loading for
// subtypes of ExcalidrawElement if the newly loaded code
// would change the rendering.
export const checkRefreshOnSubtypeLoad = (
  hasSubtype: SubtypeCheckFn,
  elements: readonly ExcalidrawElement[],
) => {
  const elementsMap = new Map() as ElementsMap;
  for (const element of elements) {
    if (!element.isDeleted) {
      elementsMap.set(element.id, element);
    }
  }
  let refreshNeeded = false;
  const scenes: Scene[] = [];
  getNonDeletedElements(elements).forEach((element) => {
    // If the element is of the subtype that was just
    // registered, update the element's dimensions, mark the
    // element for a re-render, and indicate the scene needs a refresh.
    if (hasSubtype(element)) {
      ShapeCache.delete(element);
      if (isTextElement(element)) {
        redrawTextBoundingBox(
          element,
          getContainerElement(element, elementsMap),
          elementsMap,
          false,
        );
      }
      refreshNeeded = true;
      const scene = Scene.getScene(element);
      if (scene && !scenes.includes(scene)) {
        // Store in case we have multiple scenes
        scenes.push(scene);
      }
    }
  });
  // Only inform each scene once
  scenes.forEach((scene) => scene.triggerUpdate());
  return refreshNeeded;
};

export const useSubtype = (
  api: ExcalidrawImperativeAPI | null,
  record: SubtypeRecord,
  subtypePrepFn: SubtypePrepFn,
) => {
  useEffect(() => {
    if (api) {
      const prep = api.addSubtype(record, subtypePrepFn);
      if (prep) {
        addSubtypeMethods(record.subtype, prep.methods);
        if (prep.actions) {
          prep.actions.forEach((action) => api.registerAction(action));
        }
      }
    }
  }, [api, record, subtypePrepFn]);
};
