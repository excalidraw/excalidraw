import {
  ExcalidrawElement,
  ExcalidrawSelectionElement,
  ExcalidrawTextElement,
  FontFamilyValues,
  PointBinding,
  StrokeRoundness,
} from "../element/types";
import {
  AppState,
  BinaryFiles,
  LibraryItem,
  NormalizedZoomValue,
} from "../types";
import { ImportedDataState, LegacyAppState } from "./types";
import {
  getNonDeletedElements,
  getNormalizedDimensions,
  isInvisiblySmallElement,
  refreshTextDimensions,
} from "../element";
import { isTextElement, isUsingAdaptiveRadius } from "../element/typeChecks";
import { randomId } from "../random";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
  PRECEDING_ELEMENT_KEY,
  FONT_FAMILY,
  ROUNDNESS,
  DEFAULT_SIDEBAR,
  DEFAULT_ELEMENT_PROPS,
} from "../constants";
import { getDefaultAppState } from "../appState";
import { LinearElementEditor } from "../element/linearElementEditor";
import { bumpVersion } from "../element/mutateElement";
import { getFontString, getUpdatedTimestamp, updateActiveTool } from "../utils";
import { arrayToMap } from "../utils";
import { MarkOptional, Mutable } from "../utility-types";
import {
  detectLineHeight,
  getDefaultLineHeight,
  measureBaseline,
} from "../element/textElement";
import { normalizeLink } from "./url";
import { isValidFrameChild } from "../frame";

type RestoredAppState = Omit<
  AppState,
  "offsetTop" | "offsetLeft" | "width" | "height"
>;

export const AllowedExcalidrawActiveTools: Record<
  AppState["activeTool"]["type"],
  boolean
> = {
  selection: true,
  text: true,
  rectangle: true,
  diamond: true,
  ellipse: true,
  line: true,
  image: true,
  arrow: true,
  freedraw: true,
  eraser: false,
  custom: true,
  frame: true,
  embeddable: true,
  hand: true,
  laser: false,
};

export type RestoredDataState = {
  elements: ExcalidrawElement[];
  appState: RestoredAppState;
  files: BinaryFiles;
};

const getFontFamilyByName = (fontFamilyName: string): FontFamilyValues => {
  if (Object.keys(FONT_FAMILY).includes(fontFamilyName)) {
    return FONT_FAMILY[
      fontFamilyName as keyof typeof FONT_FAMILY
    ] as FontFamilyValues;
  }
  return DEFAULT_FONT_FAMILY;
};

const repairBinding = (binding: PointBinding | null) => {
  if (!binding) {
    return null;
  }
  return { ...binding, focus: binding.focus || 0 };
};

const restoreElementWithProperties = <
  T extends Required<Omit<ExcalidrawElement, "customData">> & {
    customData?: ExcalidrawElement["customData"];
    /** @deprecated */
    boundElementIds?: readonly ExcalidrawElement["id"][];
    /** @deprecated */
    strokeSharpness?: StrokeRoundness;
    /** metadata that may be present in elements during collaboration */
    [PRECEDING_ELEMENT_KEY]?: string;
  },
  K extends Pick<T, keyof Omit<Required<T>, keyof ExcalidrawElement>>,
>(
  element: T,
  extra: Pick<
    T,
    // This extra Pick<T, keyof K> ensure no excess properties are passed.
    // @ts-ignore TS complains here but type checks the call sites fine.
    keyof K
  > &
    Partial<Pick<ExcalidrawElement, "type" | "x" | "y">>,
): T => {
  const base: Pick<T, keyof ExcalidrawElement> & {
    [PRECEDING_ELEMENT_KEY]?: string;
  } = {
    type: extra.type || element.type,
    // all elements must have version > 0 so getSceneVersion() will pick up
    // newly added elements
    version: element.version || 1,
    versionNonce: element.versionNonce ?? 0,
    isDeleted: element.isDeleted ?? false,
    id: element.id || randomId(),
    fillStyle: element.fillStyle || DEFAULT_ELEMENT_PROPS.fillStyle,
    strokeWidth: element.strokeWidth || DEFAULT_ELEMENT_PROPS.strokeWidth,
    strokeStyle: element.strokeStyle ?? DEFAULT_ELEMENT_PROPS.strokeStyle,
    roughness: element.roughness ?? DEFAULT_ELEMENT_PROPS.roughness,
    opacity:
      element.opacity == null ? DEFAULT_ELEMENT_PROPS.opacity : element.opacity,
    angle: element.angle || 0,
    x: extra.x ?? element.x ?? 0,
    y: extra.y ?? element.y ?? 0,
    strokeColor: element.strokeColor || DEFAULT_ELEMENT_PROPS.strokeColor,
    backgroundColor:
      element.backgroundColor || DEFAULT_ELEMENT_PROPS.backgroundColor,
    width: element.width || 0,
    height: element.height || 0,
    seed: element.seed ?? 1,
    groupIds: element.groupIds ?? [],
    frameId: element.frameId ?? null,
    roundness: element.roundness
      ? element.roundness
      : element.strokeSharpness === "round"
      ? {
          // for old elements that would now use adaptive radius algo,
          // use legacy algo instead
          type: isUsingAdaptiveRadius(element.type)
            ? ROUNDNESS.LEGACY
            : ROUNDNESS.PROPORTIONAL_RADIUS,
        }
      : null,
    boundElements: element.boundElementIds
      ? element.boundElementIds.map((id) => ({ type: "arrow", id }))
      : element.boundElements ?? [],
    updated: element.updated ?? getUpdatedTimestamp(),
    link: element.link ? normalizeLink(element.link) : null,
    locked: element.locked ?? false,
  };

  if ("customData" in element) {
    base.customData = element.customData;
  }

  if (PRECEDING_ELEMENT_KEY in element) {
    base[PRECEDING_ELEMENT_KEY] = element[PRECEDING_ELEMENT_KEY];
  }

  return {
    ...base,
    ...getNormalizedDimensions(base),
    ...extra,
  } as unknown as T;
};

const restoreElement = (
  element: Exclude<ExcalidrawElement, ExcalidrawSelectionElement>,
  refreshDimensions = false,
): typeof element | null => {
  switch (element.type) {
    case "text":
      let fontSize = element.fontSize;
      let fontFamily = element.fontFamily;
      if ("font" in element) {
        const [fontPx, _fontFamily]: [string, string] = (
          element as any
        ).font.split(" ");
        fontSize = parseFloat(fontPx);
        fontFamily = getFontFamilyByName(_fontFamily);
      }
      const text = (typeof element.text === "string" && element.text) || "";

      // line-height might not be specified either when creating elements
      // programmatically, or when importing old diagrams.
      // For the latter we want to detect the original line height which
      // will likely differ from our per-font fixed line height we now use,
      // to maintain backward compatibility.
      const lineHeight =
        element.lineHeight ||
        (element.height
          ? // detect line-height from current element height and font-size
            detectLineHeight(element)
          : // no element height likely means programmatic use, so default
            // to a fixed line height
            getDefaultLineHeight(element.fontFamily));
      const baseline = measureBaseline(
        element.text,
        getFontString(element),
        lineHeight,
      );
      element = restoreElementWithProperties(element, {
        fontSize,
        fontFamily,
        text,
        textAlign: element.textAlign || DEFAULT_TEXT_ALIGN,
        verticalAlign: element.verticalAlign || DEFAULT_VERTICAL_ALIGN,
        containerId: element.containerId ?? null,
        originalText: element.originalText || text,

        lineHeight,
        baseline,
      });

      // if empty text, mark as deleted. We keep in array
      // for data integrity purposes (collab etc.)
      if (!text && !element.isDeleted) {
        element = { ...element, originalText: text, isDeleted: true };
        element = bumpVersion(element);
      }

      if (refreshDimensions) {
        element = { ...element, ...refreshTextDimensions(element) };
      }

      return element;
    case "freedraw": {
      return restoreElementWithProperties(element, {
        points: element.points,
        lastCommittedPoint: null,
        simulatePressure: element.simulatePressure,
        pressures: element.pressures,
      });
    }
    case "image":
      return restoreElementWithProperties(element, {
        status: element.status || "pending",
        fileId: element.fileId,
        scale: element.scale || [1, 1],
      });
    case "line":
    // @ts-ignore LEGACY type
    // eslint-disable-next-line no-fallthrough
    case "draw":
    case "arrow": {
      const {
        startArrowhead = null,
        endArrowhead = element.type === "arrow" ? "arrow" : null,
      } = element;
      let x = element.x;
      let y = element.y;
      let points = // migrate old arrow model to new one
        !Array.isArray(element.points) || element.points.length < 2
          ? [
              [0, 0],
              [element.width, element.height],
            ]
          : element.points;

      if (points[0][0] !== 0 || points[0][1] !== 0) {
        ({ points, x, y } = LinearElementEditor.getNormalizedPoints(element));
      }

      return restoreElementWithProperties(element, {
        type:
          (element.type as ExcalidrawElement["type"] | "draw") === "draw"
            ? "line"
            : element.type,
        startBinding: repairBinding(element.startBinding),
        endBinding: repairBinding(element.endBinding),
        lastCommittedPoint: null,
        startArrowhead,
        endArrowhead,
        points,
        x,
        y,
      });
    }

    // generic elements
    case "ellipse":
      return restoreElementWithProperties(element, {});
    case "rectangle":
      return restoreElementWithProperties(element, {});
    case "diamond":
      return restoreElementWithProperties(element, {});
    case "embeddable":
      return restoreElementWithProperties(element, {
        validated: null,
      });
    case "frame":
      return restoreElementWithProperties(element, {
        name: element.name ?? null,
      });

    // Don't use default case so as to catch a missing an element type case.
    // We also don't want to throw, but instead return void so we filter
    // out these unsupported elements from the restored array.
  }
  return null;
};

/**
 * Repairs contaienr element's boundElements array by removing duplicates and
 * fixing containerId of bound elements if not present. Also removes any
 * bound elements that do not exist in the elements array.
 *
 * NOTE mutates elements.
 */
const repairContainerElement = (
  container: Mutable<ExcalidrawElement>,
  elementsMap: Map<string, Mutable<ExcalidrawElement>>,
) => {
  if (container.boundElements) {
    // copy because we're not cloning on restore, and we don't want to mutate upstream
    const boundElements = container.boundElements.slice();

    // dedupe bindings & fix boundElement.containerId if not set already
    const boundIds = new Set<ExcalidrawElement["id"]>();
    container.boundElements = boundElements.reduce(
      (
        acc: Mutable<NonNullable<ExcalidrawElement["boundElements"]>>,
        binding,
      ) => {
        const boundElement = elementsMap.get(binding.id);
        if (boundElement && !boundIds.has(binding.id)) {
          boundIds.add(binding.id);

          if (boundElement.isDeleted) {
            return acc;
          }

          acc.push(binding);

          if (
            isTextElement(boundElement) &&
            // being slightly conservative here, preserving existing containerId
            // if defined, lest boundElements is stale
            !boundElement.containerId
          ) {
            (boundElement as Mutable<ExcalidrawTextElement>).containerId =
              container.id;
          }
        }
        return acc;
      },
      [],
    );
  }
};

/**
 * Repairs target bound element's container's boundElements array,
 * or removes contaienrId if container does not exist.
 *
 * NOTE mutates elements.
 */
const repairBoundElement = (
  boundElement: Mutable<ExcalidrawTextElement>,
  elementsMap: Map<string, Mutable<ExcalidrawElement>>,
) => {
  const container = boundElement.containerId
    ? elementsMap.get(boundElement.containerId)
    : null;

  if (!container) {
    boundElement.containerId = null;
    return;
  }

  if (boundElement.isDeleted) {
    return;
  }

  if (
    container.boundElements &&
    !container.boundElements.find((binding) => binding.id === boundElement.id)
  ) {
    // copy because we're not cloning on restore, and we don't want to mutate upstream
    const boundElements = (
      container.boundElements || (container.boundElements = [])
    ).slice();
    boundElements.push({ type: "text", id: boundElement.id });
    container.boundElements = boundElements;
  }
};

/**
 * resets `frameId` if no longer applicable.
 *
 * NOTE mutates elements.
 */
const repairFrameMembership = (
  element: Mutable<ExcalidrawElement>,
  elementsMap: Map<string, Mutable<ExcalidrawElement>>,
) => {
  if (!element.frameId) {
    return;
  }

  if (
    !isValidFrameChild(element) ||
    // target frame not exists
    !elementsMap.get(element.frameId)
  ) {
    element.frameId = null;
  }
};

export const restoreElements = (
  elements: ImportedDataState["elements"],
  /** NOTE doesn't serve for reconciliation */
  localElements: readonly ExcalidrawElement[] | null | undefined,
  opts?: { refreshDimensions?: boolean; repairBindings?: boolean } | undefined,
): ExcalidrawElement[] => {
  // used to detect duplicate top-level element ids
  const existingIds = new Set<string>();
  const localElementsMap = localElements ? arrayToMap(localElements) : null;
  const restoredElements = (elements || []).reduce((elements, element) => {
    // filtering out selection, which is legacy, no longer kept in elements,
    // and causing issues if retained
    if (element.type !== "selection" && !isInvisiblySmallElement(element)) {
      let migratedElement: ExcalidrawElement | null = restoreElement(
        element,
        opts?.refreshDimensions,
      );
      if (migratedElement) {
        const localElement = localElementsMap?.get(element.id);
        if (localElement && localElement.version > migratedElement.version) {
          migratedElement = bumpVersion(migratedElement, localElement.version);
        }
        if (existingIds.has(migratedElement.id)) {
          migratedElement = { ...migratedElement, id: randomId() };
        }
        existingIds.add(migratedElement.id);

        elements.push(migratedElement);
      }
    }
    return elements;
  }, [] as ExcalidrawElement[]);

  if (!opts?.repairBindings) {
    return restoredElements;
  }

  // repair binding. Mutates elements.
  const restoredElementsMap = arrayToMap(restoredElements);
  for (const element of restoredElements) {
    // repair frame membership *after* bindings we do in restoreElement()
    // since we rely on bindings to be correct
    if (element.frameId) {
      repairFrameMembership(element, restoredElementsMap);
    }

    if (isTextElement(element) && element.containerId) {
      repairBoundElement(element, restoredElementsMap);
    } else if (element.boundElements) {
      repairContainerElement(element, restoredElementsMap);
    }
  }

  return restoredElements;
};

const coalesceAppStateValue = <
  T extends keyof ReturnType<typeof getDefaultAppState>,
>(
  key: T,
  appState: Exclude<ImportedDataState["appState"], null | undefined>,
  defaultAppState: ReturnType<typeof getDefaultAppState>,
) => {
  const value = appState[key];
  // NOTE the value! assertion is needed in TS 4.5.5 (fixed in newer versions)
  return value !== undefined ? value! : defaultAppState[key];
};

const LegacyAppStateMigrations: {
  [K in keyof LegacyAppState]: (
    ImportedDataState: Exclude<ImportedDataState["appState"], null | undefined>,
    defaultAppState: ReturnType<typeof getDefaultAppState>,
  ) => [LegacyAppState[K][1], AppState[LegacyAppState[K][1]]];
} = {
  isSidebarDocked: (appState, defaultAppState) => {
    return [
      "defaultSidebarDockedPreference",
      appState.isSidebarDocked ??
        coalesceAppStateValue(
          "defaultSidebarDockedPreference",
          appState,
          defaultAppState,
        ),
    ];
  },
};

export const restoreAppState = (
  appState: ImportedDataState["appState"],
  localAppState: Partial<AppState> | null | undefined,
): RestoredAppState => {
  appState = appState || {};
  const defaultAppState = getDefaultAppState();
  const nextAppState = {} as typeof defaultAppState;

  // first, migrate all legacy AppState properties to new ones. We do it
  // in one go before migrate the rest of the properties in case the new ones
  // depend on checking any other key (i.e. they are coupled)
  for (const legacyKey of Object.keys(
    LegacyAppStateMigrations,
  ) as (keyof typeof LegacyAppStateMigrations)[]) {
    if (legacyKey in appState) {
      const [nextKey, nextValue] = LegacyAppStateMigrations[legacyKey](
        appState,
        defaultAppState,
      );
      (nextAppState as any)[nextKey] = nextValue;
    }
  }

  for (const [key, defaultValue] of Object.entries(defaultAppState) as [
    keyof typeof defaultAppState,
    any,
  ][]) {
    // if AppState contains a legacy key, prefer that one and migrate its
    // value to the new one
    const suppliedValue = appState[key];

    const localValue = localAppState ? localAppState[key] : undefined;
    (nextAppState as any)[key] =
      suppliedValue !== undefined
        ? suppliedValue
        : localValue !== undefined
        ? localValue
        : defaultValue;
  }

  return {
    ...nextAppState,
    cursorButton: localAppState?.cursorButton || "up",
    // reset on fresh restore so as to hide the UI button if penMode not active
    penDetected:
      localAppState?.penDetected ??
      (appState.penMode ? appState.penDetected ?? false : false),
    activeTool: {
      ...updateActiveTool(
        defaultAppState,
        nextAppState.activeTool.type &&
          AllowedExcalidrawActiveTools[nextAppState.activeTool.type]
          ? nextAppState.activeTool
          : { type: "selection" },
      ),
      lastActiveTool: null,
      locked: nextAppState.activeTool.locked ?? false,
    },
    // Migrates from previous version where appState.zoom was a number
    zoom:
      typeof appState.zoom === "number"
        ? {
            value: appState.zoom as NormalizedZoomValue,
          }
        : appState.zoom?.value
        ? appState.zoom
        : defaultAppState.zoom,
    openSidebar:
      // string (legacy)
      typeof (appState.openSidebar as any as string) === "string"
        ? { name: DEFAULT_SIDEBAR.name }
        : nextAppState.openSidebar,
  };
};

export const restore = (
  data: Pick<ImportedDataState, "appState" | "elements" | "files"> | null,
  /**
   * Local AppState (`this.state` or initial state from localStorage) so that we
   * don't overwrite local state with default values (when values not
   * explicitly specified).
   * Supply `null` if you can't get access to it.
   */
  localAppState: Partial<AppState> | null | undefined,
  localElements: readonly ExcalidrawElement[] | null | undefined,
  elementsConfig?: { refreshDimensions?: boolean; repairBindings?: boolean },
): RestoredDataState => {
  return {
    elements: restoreElements(data?.elements, localElements, elementsConfig),
    appState: restoreAppState(data?.appState, localAppState || null),
    files: data?.files || {},
  };
};

const restoreLibraryItem = (libraryItem: LibraryItem) => {
  const elements = restoreElements(
    getNonDeletedElements(libraryItem.elements),
    null,
  );
  return elements.length ? { ...libraryItem, elements } : null;
};

export const restoreLibraryItems = (
  libraryItems: ImportedDataState["libraryItems"] = [],
  defaultStatus: LibraryItem["status"],
) => {
  const restoredItems: LibraryItem[] = [];
  for (const item of libraryItems) {
    // migrate older libraries
    if (Array.isArray(item)) {
      const restoredItem = restoreLibraryItem({
        status: defaultStatus,
        elements: item,
        id: randomId(),
        created: Date.now(),
      });
      if (restoredItem) {
        restoredItems.push(restoredItem);
      }
    } else {
      const _item = item as MarkOptional<
        LibraryItem,
        "id" | "status" | "created"
      >;
      const restoredItem = restoreLibraryItem({
        ..._item,
        id: _item.id || randomId(),
        status: _item.status || defaultStatus,
        created: _item.created || Date.now(),
      });
      if (restoredItem) {
        restoredItems.push(restoredItem);
      }
    }
  }
  return restoredItems;
};
