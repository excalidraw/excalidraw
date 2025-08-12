import { isFiniteNumber, pointFrom } from "@excalidraw/math";

import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
  FONT_FAMILY,
  ROUNDNESS,
  DEFAULT_SIDEBAR,
  DEFAULT_ELEMENT_PROPS,
  DEFAULT_GRID_SIZE,
  DEFAULT_GRID_STEP,
  randomId,
  getUpdatedTimestamp,
  updateActiveTool,
  arrayToMap,
  getSizeFromPoints,
  normalizeLink,
  getLineHeight,
} from "@excalidraw/common";
import { getNonDeletedElements, isValidPolygon } from "@excalidraw/element";
import { normalizeFixedPoint } from "@excalidraw/element";
import {
  updateElbowArrowPoints,
  validateElbowPoints,
} from "@excalidraw/element";
import { LinearElementEditor } from "@excalidraw/element";
import { bumpVersion } from "@excalidraw/element";
import { getContainerElement } from "@excalidraw/element";
import { detectLineHeight } from "@excalidraw/element";
import {
  isArrowBoundToElement,
  isArrowElement,
  isElbowArrow,
  isFixedPointBinding,
  isLinearElement,
  isLineElement,
  isTextElement,
  isUsingAdaptiveRadius,
} from "@excalidraw/element";

import { syncInvalidIndices } from "@excalidraw/element";

import { refreshTextDimensions } from "@excalidraw/element";

import { getNormalizedDimensions } from "@excalidraw/element";

import { isInvisiblySmallElement } from "@excalidraw/element";

import type { LocalPoint, Radians } from "@excalidraw/math";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElbowArrowElement,
  ExcalidrawElement,
  ExcalidrawElementType,
  ExcalidrawLinearElement,
  ExcalidrawSelectionElement,
  ExcalidrawTextElement,
  FixedPointBinding,
  FontFamilyValues,
  NonDeletedSceneElementsMap,
  OrderedExcalidrawElement,
  PointBinding,
  StrokeRoundness,
} from "@excalidraw/element/types";

import type { MarkOptional, Mutable } from "@excalidraw/common/utility-types";

import { getDefaultAppState } from "../appState";

import {
  getNormalizedGridSize,
  getNormalizedGridStep,
  getNormalizedZoom,
} from "../scene";

import type { AppState, BinaryFiles, LibraryItem } from "../types";
import type { ImportedDataState, LegacyAppState } from "./types";

type RestoredAppState = Omit<
  AppState,
  "offsetTop" | "offsetLeft" | "width" | "height"
>;

export const AllowedExcalidrawActiveTools: Record<
  AppState["activeTool"]["type"],
  boolean
> = {
  selection: true,
  lasso: true,
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
  magicframe: false,
};

export type RestoredDataState = {
  elements: OrderedExcalidrawElement[];
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

const repairBinding = <T extends ExcalidrawLinearElement>(
  element: T,
  binding: PointBinding | FixedPointBinding | null,
): T extends ExcalidrawElbowArrowElement
  ? FixedPointBinding | null
  : PointBinding | FixedPointBinding | null => {
  if (!binding) {
    return null;
  }

  const focus = binding.focus || 0;

  if (isElbowArrow(element)) {
    const fixedPointBinding:
      | ExcalidrawElbowArrowElement["startBinding"]
      | ExcalidrawElbowArrowElement["endBinding"] = isFixedPointBinding(binding)
      ? {
          ...binding,
          focus,
          fixedPoint: normalizeFixedPoint(binding.fixedPoint ?? [0, 0]),
        }
      : null;

    return fixedPointBinding;
  }

  return {
    ...binding,
    focus,
  } as T extends ExcalidrawElbowArrowElement
    ? FixedPointBinding | null
    : PointBinding | FixedPointBinding | null;
};

const restoreElementWithProperties = <
  T extends Required<Omit<ExcalidrawElement, "customData">> & {
    customData?: ExcalidrawElement["customData"];
    /** @deprecated */
    boundElementIds?: readonly ExcalidrawElement["id"][];
    /** @deprecated */
    strokeSharpness?: StrokeRoundness;
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
    Partial<Pick<ExcalidrawElement, "type" | "x" | "y" | "customData">>,
): T => {
  const base: Pick<T, keyof ExcalidrawElement> = {
    type: extra.type || element.type,
    // all elements must have version > 0 so getSceneVersion() will pick up
    // newly added elements
    version: element.version || 1,
    versionNonce: element.versionNonce ?? 0,
    index: element.index ?? null,
    isDeleted: element.isDeleted ?? false,
    id: element.id || randomId(),
    fillStyle: element.fillStyle || DEFAULT_ELEMENT_PROPS.fillStyle,
    strokeWidth: element.strokeWidth || DEFAULT_ELEMENT_PROPS.strokeWidth,
    strokeStyle: element.strokeStyle ?? DEFAULT_ELEMENT_PROPS.strokeStyle,
    roughness: element.roughness ?? DEFAULT_ELEMENT_PROPS.roughness,
    opacity:
      element.opacity == null ? DEFAULT_ELEMENT_PROPS.opacity : element.opacity,
    angle: element.angle || (0 as Radians),
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

  if ("customData" in element || "customData" in extra) {
    base.customData =
      "customData" in extra ? extra.customData : element.customData;
  }

  const ret = {
    // spread the original element properties to not lose unknown ones
    // for forward-compatibility
    ...element,
    // normalized properties
    ...base,
    ...getNormalizedDimensions(base),
    ...extra,
  } as unknown as T;

  // strip legacy props (migrated in previous steps)
  delete ret.strokeSharpness;
  delete ret.boundElementIds;

  return ret;
};

export const restoreElement = (
  element: Exclude<ExcalidrawElement, ExcalidrawSelectionElement>,
  opts?: { deleteInvisibleElements?: boolean },
): typeof element | null => {
  element = { ...element };

  switch (element.type) {
    case "text":
      // temp fix: cleanup legacy obsidian-excalidraw attribute else it'll
      // conflict when porting between the apps
      delete (element as any).rawText;

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
            getLineHeight(element.fontFamily));
      element = restoreElementWithProperties(element, {
        fontSize,
        fontFamily,
        text,
        textAlign: element.textAlign || DEFAULT_TEXT_ALIGN,
        verticalAlign: element.verticalAlign || DEFAULT_VERTICAL_ALIGN,
        containerId: element.containerId ?? null,
        originalText: element.originalText || text,
        autoResize: element.autoResize ?? true,
        lineHeight,
      });

      // if empty text, mark as deleted. We keep in array
      // for data integrity purposes (collab etc.)
      if (opts?.deleteInvisibleElements && !text && !element.isDeleted) {
        // TODO: we should not do this since it breaks sync / versioning when we exchange / apply just deltas and restore the elements (deletion isn't recorded)
        element = { ...element, originalText: text, isDeleted: true };
        element = bumpVersion(element);
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
        crop: element.crop ?? null,
      });
    case "line":
    // @ts-ignore LEGACY type
    // eslint-disable-next-line no-fallthrough
    case "draw":
      const { startArrowhead = null, endArrowhead = null } = element;
      let x = element.x;
      let y = element.y;
      let points = // migrate old arrow model to new one
        !Array.isArray(element.points) || element.points.length < 2
          ? [pointFrom(0, 0), pointFrom(element.width, element.height)]
          : element.points;

      if (points[0][0] !== 0 || points[0][1] !== 0) {
        ({ points, x, y } =
          LinearElementEditor.getNormalizeElementPointsAndCoords(element));
      }

      return restoreElementWithProperties(element, {
        type:
          (element.type as ExcalidrawElementType | "draw") === "draw"
            ? "line"
            : element.type,
        startBinding: repairBinding(element, element.startBinding),
        endBinding: repairBinding(element, element.endBinding),
        lastCommittedPoint: null,
        startArrowhead,
        endArrowhead,
        points,
        x,
        y,
        ...(isLineElement(element)
          ? {
              polygon: isValidPolygon(element.points)
                ? element.polygon ?? false
                : false,
            }
          : {}),
        ...getSizeFromPoints(points),
      });
    case "arrow": {
      const { startArrowhead = null, endArrowhead = "arrow" } = element;
      let x: number | undefined = element.x;
      let y: number | undefined = element.y;
      let points: readonly LocalPoint[] | undefined = // migrate old arrow model to new one
        !Array.isArray(element.points) || element.points.length < 2
          ? [pointFrom(0, 0), pointFrom(element.width, element.height)]
          : element.points;

      if (points[0][0] !== 0 || points[0][1] !== 0) {
        ({ points, x, y } =
          LinearElementEditor.getNormalizeElementPointsAndCoords(element));
      }

      const base = {
        type: element.type,
        startBinding: repairBinding(element, element.startBinding),
        endBinding: repairBinding(element, element.endBinding),
        lastCommittedPoint: null,
        startArrowhead,
        endArrowhead,
        points,
        x,
        y,
        elbowed: (element as ExcalidrawArrowElement).elbowed,
        ...getSizeFromPoints(points),
      } as const;

      // TODO: Separate arrow from linear element
      return isElbowArrow(element)
        ? restoreElementWithProperties(element as ExcalidrawElbowArrowElement, {
            ...base,
            elbowed: true,
            startBinding: repairBinding(element, element.startBinding),
            endBinding: repairBinding(element, element.endBinding),
            fixedSegments: element.fixedSegments,
            startIsSpecial: element.startIsSpecial,
            endIsSpecial: element.endIsSpecial,
          })
        : restoreElementWithProperties(element as ExcalidrawArrowElement, base);
    }

    // generic elements
    case "ellipse":
    case "rectangle":
    case "diamond":
    case "iframe":
    case "embeddable":
      return restoreElementWithProperties(element, {});
    case "magicframe":
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
 * Repairs container element's boundElements array by removing duplicates and
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
            (boundElement as Mutable<typeof boundElement>).containerId =
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

  (boundElement as Mutable<typeof boundElement>).angle = (
    isArrowElement(container) ? 0 : container?.angle ?? 0
  ) as Radians;

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
 * Remove an element's frameId if its containing frame is non-existent
 *
 * NOTE mutates elements.
 */
const repairFrameMembership = (
  element: Mutable<ExcalidrawElement>,
  elementsMap: Map<string, Mutable<ExcalidrawElement>>,
) => {
  if (element.frameId) {
    const containingFrame = elementsMap.get(element.frameId);

    if (!containingFrame) {
      element.frameId = null;
    }
  }
};

export const restoreElements = (
  elements: ImportedDataState["elements"],
  /** NOTE doesn't serve for reconciliation */
  localElements: readonly ExcalidrawElement[] | null | undefined,
  opts?:
    | {
        refreshDimensions?: boolean;
        repairBindings?: boolean;
        deleteInvisibleElements?: boolean;
      }
    | undefined,
): OrderedExcalidrawElement[] => {
  // used to detect duplicate top-level element ids
  const existingIds = new Set<string>();
  const localElementsMap = localElements ? arrayToMap(localElements) : null;
  const restoredElements = syncInvalidIndices(
    (elements || []).reduce((elements, element) => {
      // filtering out selection, which is legacy, no longer kept in elements,
      // and causing issues if retained
      if (element.type === "selection") {
        return elements;
      }

      let migratedElement: ExcalidrawElement | null = restoreElement(element, {
        deleteInvisibleElements: opts?.deleteInvisibleElements,
      });
      if (migratedElement) {
        const localElement = localElementsMap?.get(element.id);

        const shouldMarkAsDeleted =
          opts?.deleteInvisibleElements && isInvisiblySmallElement(element);

        if (
          shouldMarkAsDeleted ||
          (localElement && localElement.version > migratedElement.version)
        ) {
          migratedElement = bumpVersion(migratedElement, localElement?.version);
        }

        if (shouldMarkAsDeleted) {
          migratedElement = { ...migratedElement, isDeleted: true };
        }

        if (existingIds.has(migratedElement.id)) {
          migratedElement = { ...migratedElement, id: randomId() };
        }
        existingIds.add(migratedElement.id);

        elements.push(migratedElement);
      }

      return elements;
    }, [] as ExcalidrawElement[]),
  );

  if (!opts?.repairBindings) {
    return restoredElements;
  }

  // repair binding. Mutates elements.
  const restoredElementsMap = arrayToMap(restoredElements);
  for (const element of restoredElements) {
    if (element.frameId) {
      repairFrameMembership(element, restoredElementsMap);
    }

    if (isTextElement(element) && element.containerId) {
      repairBoundElement(element, restoredElementsMap);
    } else if (element.boundElements) {
      repairContainerElement(element, restoredElementsMap);
    }

    if (opts.refreshDimensions && isTextElement(element)) {
      Object.assign(
        element,
        refreshTextDimensions(
          element,
          getContainerElement(element, restoredElementsMap),
          restoredElementsMap,
        ),
      );
    }

    if (isLinearElement(element)) {
      if (
        element.startBinding &&
        (!restoredElementsMap.has(element.startBinding.elementId) ||
          !isArrowElement(element))
      ) {
        (element as Mutable<ExcalidrawLinearElement>).startBinding = null;
      }
      if (
        element.endBinding &&
        (!restoredElementsMap.has(element.endBinding.elementId) ||
          !isArrowElement(element))
      ) {
        (element as Mutable<ExcalidrawLinearElement>).endBinding = null;
      }
    }
  }

  // NOTE (mtolmacs): Temporary fix for extremely large arrows
  // Need to iterate again so we have attached text nodes in elementsMap
  return restoredElements.map((element) => {
    if (
      isElbowArrow(element) &&
      !isArrowBoundToElement(element) &&
      !validateElbowPoints(element.points)
    ) {
      return {
        ...element,
        ...updateElbowArrowPoints(
          element,
          restoredElementsMap as NonDeletedSceneElementsMap,
          {
            points: [
              pointFrom<LocalPoint>(0, 0),
              element.points[element.points.length - 1],
            ],
          },
        ),
        index: element.index,
      };
    }

    if (
      isElbowArrow(element) &&
      element.startBinding &&
      element.endBinding &&
      element.startBinding.elementId === element.endBinding.elementId &&
      element.points.length > 1 &&
      element.points.some(
        ([rx, ry]) => Math.abs(rx) > 1e6 || Math.abs(ry) > 1e6,
      )
    ) {
      console.error("Fixing self-bound elbow arrow", element.id);
      const boundElement = restoredElementsMap.get(
        element.startBinding.elementId,
      );
      if (!boundElement) {
        console.error(
          "Bound element not found",
          element.startBinding.elementId,
        );
        return element;
      }

      return {
        ...element,
        x: boundElement.x + boundElement.width / 2,
        y: boundElement.y - 5,
        width: boundElement.width,
        height: boundElement.height,
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(0, -10),
          pointFrom<LocalPoint>(boundElement.width / 2 + 5, -10),
          pointFrom<LocalPoint>(
            boundElement.width / 2 + 5,
            boundElement.height / 2 + 5,
          ),
        ],
      };
    }

    return element;
  });
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
    zoom: {
      value: getNormalizedZoom(
        isFiniteNumber(appState.zoom)
          ? appState.zoom
          : appState.zoom?.value ?? defaultAppState.zoom.value,
      ),
    },
    openSidebar:
      // string (legacy)
      typeof (appState.openSidebar as any as string) === "string"
        ? { name: DEFAULT_SIDEBAR.name }
        : nextAppState.openSidebar,
    gridSize: getNormalizedGridSize(
      isFiniteNumber(appState.gridSize) ? appState.gridSize : DEFAULT_GRID_SIZE,
    ),
    gridStep: getNormalizedGridStep(
      isFiniteNumber(appState.gridStep) ? appState.gridStep : DEFAULT_GRID_STEP,
    ),
    editingFrame: null,
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
  elementsConfig?: {
    refreshDimensions?: boolean;
    repairBindings?: boolean;
    deleteInvisibleElements?: boolean;
  },
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
