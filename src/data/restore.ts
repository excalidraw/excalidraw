import {
  ExcalidrawDiamondElement,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawImageElement,
  ExcalidrawLinearElement,
  ExcalidrawRectangleElement,
  ExcalidrawSelectionElement,
  ExcalidrawTextElement,
  FontFamilyValues,
} from "../element/types";
import {
  AppState,
  BinaryFiles,
  LibraryItem,
  NormalizedZoomValue,
} from "../types";
import { ImportedDataState } from "./types";
import {
  getNonDeletedElements,
  getNormalizedDimensions,
  isInvisiblySmallElement,
} from "../element";
import { isLinearElementType } from "../element/typeChecks";
import { randomId } from "../random";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
  FONT_FAMILY,
} from "../constants";
import { getDefaultAppState } from "../appState";
import { LinearElementEditor } from "../element/linearElementEditor";
import { bumpVersion } from "../element/mutateElement";
import { getUpdatedTimestamp, updateActiveTool } from "../utils";
import { arrayToMap } from "../utils";
import { delUndefinedProps } from "../element/newElement";

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

const restoreElementWithProperties = <
  T extends ExcalidrawElement,
  K extends Pick<T, keyof Omit<Required<T>, keyof ExcalidrawElement>>,
>(
  element: MarkOptional<Required<T>, "subtype" | "customProps"> & {
    /** @deprecated */
    boundElementIds?: readonly ExcalidrawElement["id"][];
  },
  extra: Pick<
    T,
    // This extra Pick<T, keyof K> ensure no excess properties are passed.
    // @ts-ignore TS complains here but type checks the call sites fine.
    keyof K
  > &
    Partial<Pick<ExcalidrawElement, "type" | "x" | "y">>,
): T => {
  const { subtype, customProps } = element;
  const custom = delUndefinedProps({ subtype, customProps }, [
    "subtype",
    "customProps",
  ]);
  const base: Pick<T, keyof ExcalidrawElement> = {
    ...custom,
    type: extra.type || element.type,
    // all elements must have version > 0 so getSceneVersion() will pick up
    // newly added elements
    version: element.version || 1,
    versionNonce: element.versionNonce ?? 0,
    isDeleted: element.isDeleted ?? false,
    id: element.id || randomId(),
    fillStyle: element.fillStyle || "hachure",
    strokeWidth: element.strokeWidth || 1,
    strokeStyle: element.strokeStyle ?? "solid",
    roughness: element.roughness ?? 1,
    opacity: element.opacity == null ? 100 : element.opacity,
    angle: element.angle || 0,
    x: extra.x ?? element.x ?? 0,
    y: extra.y ?? element.y ?? 0,
    strokeColor: element.strokeColor,
    backgroundColor: element.backgroundColor,
    width: element.width || 0,
    height: element.height || 0,
    seed: element.seed ?? 1,
    groupIds: element.groupIds ?? [],
    strokeSharpness:
      element.strokeSharpness ??
      (isLinearElementType(element.type) ? "round" : "sharp"),
    boundElements: element.boundElementIds
      ? element.boundElementIds.map((id) => ({ type: "arrow", id }))
      : element.boundElements ?? [],
    updated: element.updated ?? getUpdatedTimestamp(),
    link: element.link ?? null,
    locked: element.locked ?? false,
  };

  return {
    ...base,
    ...getNormalizedDimensions(base),
    ...extra,
  } as unknown as T;
};

const restoreElement = (
  element: Exclude<ExcalidrawElement, ExcalidrawSelectionElement>,
): typeof element | null => {
  let el;
  switch (element.type) {
    case "text":
      let fontSize = element.fontSize;
      let fontFamily = element.fontFamily;
      if ("font" in element) {
        const [fontPx, _fontFamily]: [string, string] = (
          element as any
        ).font.split(" ");
        fontSize = parseInt(fontPx, 10);
        fontFamily = getFontFamilyByName(_fontFamily);
      }
      return restoreElementWithProperties(element, {
        fontSize,
        fontFamily,
        text: element.text ?? "",
        baseline: element.baseline,
        textAlign: element.textAlign || DEFAULT_TEXT_ALIGN,
        verticalAlign: element.verticalAlign || DEFAULT_VERTICAL_ALIGN,
        containerId: element.containerId ?? null,
        originalText: element.originalText || element.text,
      }) as ExcalidrawTextElement;
    case "freedraw": {
      return restoreElementWithProperties(element, {
        points: element.points,
        lastCommittedPoint: null,
        simulatePressure: element.simulatePressure,
        pressures: element.pressures,
      }) as ExcalidrawFreeDrawElement;
    }
    case "image":
      return restoreElementWithProperties(element, {
        status: element.status || "pending",
        fileId: element.fileId,
        scale: element.scale || [1, 1],
      }) as ExcalidrawImageElement;
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
        startBinding: element.startBinding,
        endBinding: element.endBinding,
        lastCommittedPoint: null,
        startArrowhead,
        endArrowhead,
        points,
        x,
        y,
      }) as ExcalidrawLinearElement;
    }

    // generic elements
    case "ellipse":
      el = restoreElementWithProperties(element, {});
      return el as ExcalidrawEllipseElement;
    case "rectangle":
      el = restoreElementWithProperties(element, {});
      return el as ExcalidrawRectangleElement;
    case "diamond":
      el = restoreElementWithProperties(element, {});
      return el as ExcalidrawDiamondElement;

    // Don't use default case so as to catch a missing an element type case.
    // We also don't want to throw, but instead return void so we filter
    // out these unsupported elements from the restored array.
  }
};

export const restoreElements = (
  elements: ImportedDataState["elements"],
  /** NOTE doesn't serve for reconciliation */
  localElements: readonly ExcalidrawElement[] | null | undefined,
): ExcalidrawElement[] => {
  const localElementsMap = localElements ? arrayToMap(localElements) : null;
  return (elements || []).reduce((elements, element) => {
    // filtering out selection, which is legacy, no longer kept in elements,
    // and causing issues if retained
    if (element.type !== "selection" && !isInvisiblySmallElement(element)) {
      let migratedElement: ExcalidrawElement | null = restoreElement(element);
      if (migratedElement) {
        const localElement = localElementsMap?.get(element.id);
        if (localElement && localElement.version > migratedElement.version) {
          migratedElement = bumpVersion(migratedElement, localElement.version);
        }
        elements.push(migratedElement);
      }
    }
    return elements;
  }, [] as ExcalidrawElement[]);
};

export const restoreAppState = (
  appState: ImportedDataState["appState"],
  localAppState: Partial<AppState> | null | undefined,
): RestoredAppState => {
  appState = appState || {};
  const defaultAppState = getDefaultAppState();
  const nextAppState = {} as typeof defaultAppState;
  for (const [key, defaultValue] of Object.entries(defaultAppState) as [
    keyof typeof defaultAppState,
    any,
  ][]) {
    const suppliedValue = appState[key];
    const localValue = localAppState ? localAppState[key] : undefined;
    (nextAppState as any)[key] =
      suppliedValue !== undefined
        ? suppliedValue
        : localValue !== undefined
        ? localValue
        : defaultValue;
  }

  const { customSubtype, customProps } = appState;
  const custom = delUndefinedProps({ customSubtype, customProps }, [
    "customSubtype",
    "customProps",
  ]);
  return {
    ...nextAppState,
    ...custom,
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
      lastActiveToolBeforeEraser: null,
      locked: nextAppState.activeTool.locked ?? false,
    },
    // Migrates from previous version where appState.zoom was a number
    zoom:
      typeof appState.zoom === "number"
        ? {
            value: appState.zoom as NormalizedZoomValue,
          }
        : appState.zoom || defaultAppState.zoom,
    // when sidebar docked and user left it open in last session,
    // keep it open. If not docked, keep it closed irrespective of last state.
    isLibraryOpen: nextAppState.isLibraryMenuDocked
      ? nextAppState.isLibraryOpen
      : false,
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
): RestoredDataState => {
  return {
    elements: restoreElements(data?.elements, localElements),
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
