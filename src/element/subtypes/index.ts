import { ExcalidrawElement, ExcalidrawTextElement, NonDeleted } from "../types";
import { getNonDeletedElements } from "../";

import { isTextElement } from "../typeChecks";
import { getContainerElement, redrawTextBoundingBox } from "../textElement";
import { ShapeCache } from "../../scene/ShapeCache";
import Scene from "../../scene/Scene";

// Use "let" instead of "const" so we can dynamically add subtypes
let subtypeNames: readonly Subtype[] = [];
let parentTypeMap: readonly {
  subtype: Subtype;
  parentType: ExcalidrawElement["type"];
}[] = [];

export type SubtypeRecord = Readonly<{
  subtype: Subtype;
  parents: readonly ExcalidrawElement["type"][];
}>;

// Subtype Names
export type Subtype = Required<ExcalidrawElement>["subtype"];
export const getSubtypeNames = (): readonly Subtype[] => {
  return subtypeNames;
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
  getEditorStyle: (element: ExcalidrawTextElement) => Record<string, any>;
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
  ) => { width: number; height: number; baseline: number };
  render: (
    element: NonDeleted<ExcalidrawElement>,
    context: CanvasRenderingContext2D,
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
  if (!subtypeNames.includes(subtype)) {
    return;
  }
  if (!methodMaps.find((method) => method.subtype === subtype)) {
    methodMaps.push({ subtype, methods });
  }
};

// Callback to re-render subtyped `ExcalidrawElement`s after completing
// async loading of the subtype.
export type SubtypeLoadedCb = (hasSubtype: SubtypeCheckFn) => void;
export type SubtypeCheckFn = (element: ExcalidrawElement) => boolean;

// Functions to prepare subtypes for use
export type SubtypePrepFn = (onSubtypeLoaded?: SubtypeLoadedCb) => {
  methods: Partial<SubtypeMethods>;
};

// This is the main method to set up the subtype.  The optional
// `onSubtypeLoaded` callback may be used to re-render subtyped
// `ExcalidrawElement`s after the subtype has finished async loading.
export const prepareSubtype = (
  record: SubtypeRecord,
  subtypePrepFn: SubtypePrepFn,
  onSubtypeLoaded?: SubtypeLoadedCb,
): { methods: Partial<SubtypeMethods> } => {
  const map = getSubtypeMethods(record.subtype);
  if (map) {
    return { methods: map };
  }

  // Check for undefined/null subtypes and parentTypes
  if (
    record.subtype === undefined ||
    record.subtype === "" ||
    record.parents === undefined ||
    record.parents.length === 0
  ) {
    return { methods: {} };
  }

  // Register the types
  const subtype = record.subtype;
  subtypeNames = [...subtypeNames, subtype];
  record.parents.forEach((parentType) => {
    parentTypeMap = [...parentTypeMap, { subtype, parentType }];
  });

  // Prepare the subtype
  const { methods } = subtypePrepFn(onSubtypeLoaded);

  // Register the subtype's methods
  addSubtypeMethods(record.subtype, methods);
  return { methods };
};

// Ensure all subtypes are loaded before continuing, eg to
// redraw text element bounding boxes correctly.
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
      el.subtype !== undefined &&
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
  let refreshNeeded = false;
  const scenes: Scene[] = [];
  getNonDeletedElements(elements).forEach((element) => {
    // If the element is of the subtype that was just
    // registered, update the element's dimensions, mark the
    // element for a re-render, and indicate the scene needs a refresh.
    if (hasSubtype(element)) {
      ShapeCache.delete(element);
      if (isTextElement(element)) {
        redrawTextBoundingBox(element, getContainerElement(element));
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
  scenes.forEach((scene) => scene.informMutation());
  return refreshNeeded;
};
