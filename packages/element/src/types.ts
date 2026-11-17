import type { GlobalPoint, LocalPoint, Radians } from "@excalidraw/math";

import type {
  FillStyle,
  FontFamilyKeys,
  IMAGE_MIME_TYPES,
  MIME_TYPES,
  FontFamilyValues,
  FontString,
  RoundnessType,
  StrokeStyle,
  StrokeWidthKey,
  TEXT_ALIGN,
  UnitlessLineHeight,
  THEME,
  VERTICAL_ALIGN,
  Zoom,
} from "@excalidraw/common";

import type {
  MakeBrand,
  MarkNonNullable,
  Merge,
  ValueOf,
} from "@excalidraw/common/utility-types";

import type { Drawable } from "roughjs/bin/core";

import type { LinearElementEditor } from "./linearElementEditor";
import type { RenderEnvironment } from "./renderEnvironment";

export type {
  FillStyle,
  FontFamilyKeys,
  FontFamilyValues,
  FontString,
  RoundnessType,
  StrokeStyle,
};

export type ChartType = "bar" | "line" | "radar";
export type Theme = typeof THEME[keyof typeof THEME];
export type GroupId = string;
export type PointerType = "mouse" | "pen" | "touch";
export type StrokeRoundness = "round" | "sharp";
export type TextAlign = typeof TEXT_ALIGN[keyof typeof TEXT_ALIGN];

type VerticalAlignKeys = keyof typeof VERTICAL_ALIGN;
export type VerticalAlign = typeof VERTICAL_ALIGN[VerticalAlignKeys];
export type FractionalIndex = string & { _brand: "franctionalIndex" };

export type BoundElement = Readonly<{
  id: ExcalidrawLinearElement["id"];
  type: "arrow" | "text";
}>;

type _ExcalidrawElementBase = Readonly<{
  id: string;
  x: number;
  y: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roundness: null | { type: RoundnessType; value?: number };
  roughness: number;
  opacity: number;
  width: number;
  height: number;
  angle: Radians;
  /** Random integer used to seed shape generation so that the roughjs shape
      doesn't differ across renders. */
  seed: number;
  /** Integer that is sequentially incremented on each change. Used to reconcile
      elements during collaboration or when saving to server. */
  version: number;
  /** Random integer that is regenerated on each change.
      Used for deterministic reconciliation of updates during collaboration,
      in case the versions (see above) are identical. */
  versionNonce: number;
  /** String in a fractional form defined by https://github.com/rocicorp/fractional-indexing.
      Used for ordering in multiplayer scenarios, such as during reconciliation or undo / redo.
      Always kept in sync with the array order by `syncMovedIndices` and `syncInvalidIndices`.
      Could be null, i.e. for new elements which were not yet assigned to the scene. */
  index: FractionalIndex | null;
  isDeleted: boolean;
  /** List of groups the element belongs to.
      Ordered from deepest to shallowest. */
  groupIds: readonly GroupId[];
  frameId: string | null;
  /** other elements that are bound to this element */
  boundElements: readonly BoundElement[] | null;
  /** epoch (ms) timestamp of last element update */
  updated: number;
  /** Client wall-clock creation time in epoch milliseconds; null if unknown.
      Preserved for this element's lifetime, including edits and undo/redo,
      and excluded from `ElementUpdate` (mutateElement / newElementWith).
      Duplicating an element starts a new lifetime. Not an ordering clock. */
  created: number | null;
  link: string | null;
  locked: boolean;
  customData?: Record<string, any>;
}>;

export type ExcalidrawSelectionElement = _ExcalidrawElementBase & {
  type: "selection";
};

export type ExcalidrawRectangleElement = _ExcalidrawElementBase & {
  type: "rectangle";
};

export type ExcalidrawStickyNoteElement = _ExcalidrawElementBase &
  Readonly<{
    type: "stickynote";
    /**
     * The height the user set, from which the layout derives `height`: the
     * note grows above it to fit its label and never shrinks below it
     */
    baseHeight: number;
  }>;

export type ExcalidrawDiamondElement = _ExcalidrawElementBase & {
  type: "diamond";
};

export type ExcalidrawEllipseElement = _ExcalidrawElementBase & {
  type: "ellipse";
};

export type ExcalidrawEmbeddableElement = _ExcalidrawElementBase &
  Readonly<{
    type: "embeddable";
  }>;

export type MagicGenerationData =
  | {
      status: "pending";
    }
  | { status: "done"; html: string }
  | {
      status: "error";
      message?: string;
      code: "ERR_GENERATION_INTERRUPTED" | string;
    };

export type ExcalidrawIframeElement = _ExcalidrawElementBase &
  Readonly<{
    type: "iframe";
    // TODO move later to AI-specific frame
    customData?: { generationData?: MagicGenerationData };
  }>;

export type ExcalidrawIframeLikeElement =
  | ExcalidrawIframeElement
  | ExcalidrawEmbeddableElement;

export type IframeData =
  | {
      intrinsicSize: { w: number; h: number };
      error?: Error;
      sandbox?: { allowSameOrigin?: boolean };
    } & (
      | { type: "video" | "generic"; link: string }
      | { type: "document"; srcdoc: (theme: Theme) => string }
    );

export type ImageCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
};

export type ExcalidrawImageElement = _ExcalidrawElementBase &
  Readonly<{
    type: "image";
    fileId: FileId | null;
    /** whether respective file is persisted */
    status: "pending" | "saved" | "error";
    /** X and Y scale factors <-1, 1>, used for image axis flipping */
    scale: [number, number];
    /** whether an element is cropped */
    crop: ImageCrop | null;
  }>;

export type InitializedExcalidrawImageElement = MarkNonNullable<
  ExcalidrawImageElement,
  "fileId"
>;

export type ExcalidrawFrameElement = _ExcalidrawElementBase & {
  type: "frame";
  name: string | null;
};

export type ExcalidrawMagicFrameElement = _ExcalidrawElementBase & {
  type: "magicframe";
  name: string | null;
};

export type ExcalidrawFrameLikeElement =
  | ExcalidrawFrameElement
  | ExcalidrawMagicFrameElement;

/**
 * These are elements that don't have any additional properties.
 */
export type ExcalidrawGenericElement =
  | ExcalidrawSelectionElement
  | ExcalidrawRectangleElement
  | ExcalidrawDiamondElement
  | ExcalidrawEllipseElement;

export type ExcalidrawFlowchartNodeElement =
  | ExcalidrawRectangleElement
  | ExcalidrawStickyNoteElement
  | ExcalidrawDiamondElement
  | ExcalidrawEllipseElement;

export type ExcalidrawRectanguloidElement =
  | ExcalidrawRectangleElement
  | ExcalidrawStickyNoteElement
  | ExcalidrawImageElement
  | ExcalidrawTextElement
  | ExcalidrawFreeDrawElement
  | ExcalidrawIframeLikeElement
  | ExcalidrawFrameLikeElement
  | ExcalidrawEmbeddableElement
  | ExcalidrawSelectionElement;

/**
 * ExcalidrawElement should be JSON serializable and (eventually) contain
 * no computed data. The list of all ExcalidrawElements should be shareable
 * between peers and contain no state local to the peer.
 */
export type ExcalidrawElement =
  | ExcalidrawGenericElement
  | ExcalidrawStickyNoteElement
  | ExcalidrawTextElement
  | ExcalidrawLinearElement
  | ExcalidrawArrowElement
  | ExcalidrawFreeDrawElement
  | ExcalidrawImageElement
  | ExcalidrawFrameElement
  | ExcalidrawMagicFrameElement
  | ExcalidrawIframeElement
  | ExcalidrawEmbeddableElement;

export type ExcalidrawNonSelectionElement = Exclude<
  ExcalidrawElement,
  ExcalidrawSelectionElement
>;

export type Ordered<TElement extends ExcalidrawElement> = TElement & {
  index: FractionalIndex;
};

export type OrderedExcalidrawElement = Ordered<ExcalidrawElement>;

export type NonDeleted<TElement extends ExcalidrawElement> = TElement & {
  isDeleted: false;
};

export type NonDeletedExcalidrawElement = NonDeleted<ExcalidrawElement>;

export type ExcalidrawTextElement = _ExcalidrawElementBase &
  Readonly<{
    type: "text";
    fontSize: number;
    fontFamily: FontFamilyValues;
    /**
     * The font size the user picked, from which the layout derives `fontSize`.
     * Today only sticky note labels have one: the auto-fit shrinks below it
     * and never above it (compare `baseHeight`, which the note grows above).
     * `null` for every other text. Read it through `getBaseFontSize` —
     * generic binding repair can detach a label without clearing this, so
     * the container decides its meaning.
     */
    baseFontSize: number | null;
    text: string;
    textAlign: TextAlign;
    verticalAlign: VerticalAlign;
    containerId: ExcalidrawTextContainer["id"] | null;
    originalText: string;
    /**
     * If `true` the width will fit the text. If `false`, the text will
     * wrap to fit the width.
     *
     * @default true
     */
    autoResize: boolean;
    /**
     * Unitless line height (aligned to W3C). To get line height in px, multiply
     *  with font size (using `getLineHeightInPx` helper).
     */
    lineHeight: UnitlessLineHeight;
    /**
     * Position of text bound to a linear element (such as an arrow),
     * expressed as a normalized arc-length parameter (0–1) along the
     * container's whole path. Independent of how the path is segmented,
     * so it survives midpoint insertion and other geometry changes.
     * */
    labelPosition?: number | null;
  }>;

export type ExcalidrawBindableElement =
  | ExcalidrawRectangleElement
  | ExcalidrawStickyNoteElement
  | ExcalidrawDiamondElement
  | ExcalidrawEllipseElement
  | ExcalidrawTextElement
  | ExcalidrawImageElement
  | ExcalidrawIframeElement
  | ExcalidrawEmbeddableElement
  | ExcalidrawFrameElement
  | ExcalidrawMagicFrameElement;

export type ExcalidrawTextContainer =
  | ExcalidrawRectangleElement
  | ExcalidrawStickyNoteElement
  | ExcalidrawDiamondElement
  | ExcalidrawEllipseElement
  | ExcalidrawArrowElement;

export type ExcalidrawTextElementWithContainer = {
  containerId: ExcalidrawTextContainer["id"];
} & ExcalidrawTextElement;

export type FixedPoint = [number, number];

export type BindMode = "inside" | "orbit" | "skip";

export type FixedPointBinding = {
  elementId: ExcalidrawBindableElement["id"];

  // Represents the fixed point binding information in form of a vertical and
  // horizontal ratio (i.e. a percentage value in the 0.0-1.0 range). This ratio
  // gives the user selected fixed point by multiplying the bound element width
  // with fixedPoint[0] and the bound element height with fixedPoint[1] to get the
  // bound element-local point coordinate.
  fixedPoint: FixedPoint;

  // Determines whether the arrow remains outside the shape or is allowed to
  // go all the way inside the shape up to the exact fixed point.
  mode: BindMode;
};

type Index = number;

export type PointsPositionUpdates = Map<
  Index,
  { point: LocalPoint; isDragging?: boolean }
>;

export type CardinalityArrowhead =
  | "cardinality_one"
  | "cardinality_many"
  | "cardinality_one_or_many"
  | "cardinality_exactly_one"
  | "cardinality_zero_or_one"
  | "cardinality_zero_or_many";

export type ArrowheadLegacy =
  | "dot"
  | "crowfoot_one"
  | "crowfoot_many"
  | "crowfoot_one_or_many";

export type Arrowhead =
  | "arrow"
  | "bar"
  | "circle"
  | "circle_outline"
  | "triangle"
  | "triangle_outline"
  | "diamond"
  | "diamond_outline"
  | CardinalityArrowhead;

export type AnyArrowhead = Arrowhead | ArrowheadLegacy;

export type ExcalidrawLinearElement = _ExcalidrawElementBase &
  Readonly<{
    type: "line" | "arrow";
    points: readonly LocalPoint[];
    startBinding: FixedPointBinding | null;
    endBinding: FixedPointBinding | null;
    startArrowhead: Arrowhead | null;
    endArrowhead: Arrowhead | null;
  }>;

export type ExcalidrawLineElement = ExcalidrawLinearElement &
  Readonly<{
    type: "line";
    polygon: boolean;
  }>;

export type FixedSegment = {
  start: LocalPoint;
  end: LocalPoint;
  index: Index;
};

export type ExcalidrawArrowElement = ExcalidrawLinearElement &
  Readonly<{
    type: "arrow";
    elbowed: boolean;
  }>;

export type ExcalidrawElbowArrowElement = Merge<
  ExcalidrawArrowElement,
  {
    elbowed: true;
    fixedSegments: readonly FixedSegment[] | null;
    startBinding: FixedPointBinding | null;
    endBinding: FixedPointBinding | null;
    /**
     * Marks that the 3rd point should be used as the 2nd point of the arrow in
     * order to temporarily hide the first segment of the arrow without losing
     * the data from the points array. It allows creating the expected arrow
     * path when the arrow with fixed segments is bound on a horizontal side and
     * moved to a vertical and vica versa.
     */
    startIsSpecial: boolean | null;
    /**
     * Marks that the 3rd point backwards from the end should be used as the 2nd
     * point of the arrow in order to temporarily hide the last segment of the
     * arrow without losing the data from the points array. It allows creating
     * the expected arrow path when the arrow with fixed segments is bound on a
     * horizontal side and moved to a vertical and vica versa.
     */
    endIsSpecial: boolean | null;
  }
>;

export type StrokeVariability = "variable" | "constant";

export type StrokeOptions = Readonly<{
  variability: StrokeVariability;
  streamline: number;
}>;

export type ExcalidrawFreeDrawElement = _ExcalidrawElementBase &
  Readonly<{
    type: "freedraw";
    points: readonly LocalPoint[];
    pressures: readonly number[];
    simulatePressure: boolean;
    strokeOptions: StrokeOptions;
  }>;

export type FileId = string & { _brand: "FileId" };

export type ExcalidrawElementType = ExcalidrawElement["type"];

/**
 * Map of excalidraw elements.
 * Unspecified whether deleted or non-deleted.
 * Can be a subset of Scene elements.
 */
export type ElementsMap = Map<ExcalidrawElement["id"], ExcalidrawElement>;

/**
 * Map of non-deleted elements.
 * Can be a subset of Scene elements.
 */
export type NonDeletedElementsMap = Map<
  ExcalidrawElement["id"],
  NonDeletedExcalidrawElement
> &
  MakeBrand<"NonDeletedElementsMap">;

/**
 * Map of all excalidraw Scene elements, including deleted.
 * Not a subset. Use this type when you need access to current Scene elements.
 */
export type SceneElementsMap = Map<
  ExcalidrawElement["id"],
  Ordered<ExcalidrawElement>
> &
  MakeBrand<"SceneElementsMap">;

/**
 * Map of all non-deleted Scene elements.
 * Not a subset. Use this type when you need access to current Scene elements.
 */
export type NonDeletedSceneElementsMap = Map<
  ExcalidrawElement["id"],
  Ordered<NonDeletedExcalidrawElement>
> &
  MakeBrand<"NonDeletedSceneElementsMap">;

export type ElementsMapOrArray =
  | readonly ExcalidrawElement[]
  | Readonly<ElementsMap>;

export type NonDeletedElementsMapOrArray =
  | readonly NonDeletedExcalidrawElement[]
  | Readonly<NonDeletedElementsMap | NonDeletedSceneElementsMap>;

export type ExcalidrawLinearElementSubType =
  | "line"
  | "sharpArrow"
  | "curvedArrow"
  | "elbowArrow";

export type ConvertibleGenericTypes = "rectangle" | "diamond" | "ellipse";
export type ConvertibleLinearTypes = ExcalidrawLinearElementSubType;
export type ConvertibleTypes = ConvertibleGenericTypes | ConvertibleLinearTypes;

// -----------------------------------------------------------------------------
// Editor-adjacent types that element code operates on (re-exported from
// `@excalidraw/excalidraw/types` and `@excalidraw/excalidraw/scene/types`)
// -----------------------------------------------------------------------------

export type DataURL = string & { _brand: "DataURL" };

export type BinaryFileData = {
  mimeType:
    | ValueOf<typeof IMAGE_MIME_TYPES>
    // future user or unknown file type
    | typeof MIME_TYPES.binary;
  id: FileId;
  dataURL: DataURL;
  /**
   * Epoch timestamp in milliseconds
   */
  created: number;
  /**
   * Indicates when the file was last retrieved from storage to be loaded
   * onto the scene. We use this flag to determine whether to delete unused
   * files from storage.
   *
   * Epoch timestamp in milliseconds.
   */
  lastRetrieved?: number;
  /**
   * indicates the version of the file. This can be used to determine whether
   * the file dataURL has changed e.g. as part of restore due to schema update.
   */
  version?: number;
};

export type BinaryFileMetadata = Omit<BinaryFileData, "dataURL">;

export type BinaryFiles = Record<ExcalidrawElement["id"], BinaryFileData>;

export type ToolType =
  | "selection"
  | "lasso"
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "line"
  | "freedraw"
  | "text"
  | "image"
  | "eraser"
  | "hand"
  | "frame"
  | "magicframe"
  | "stickynote"
  | "embeddable"
  | "laser"
  | "autoshape"
  | "bucketfill";

export type ElementOrToolType = ExcalidrawElementType | ToolType | "custom";

export type BoxSelectionMode = "contain" | "overlap";

export type PointerCoords = Readonly<{
  x: number;
  y: number;
}>;

export type FrameNameBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type EmbedsValidationStatus = Map<
  ExcalidrawIframeLikeElement["id"],
  boolean
>;

export type PendingExcalidrawElements = NonDeletedExcalidrawElement[];

export type Offsets = Partial<{
  top: number;
  right: number;
  bottom: number;
  left: number;
}>;

export type SVGPathString = string & { __brand: "SVGPathString" };

export type ElementShape =
  | Drawable
  | Drawable[]
  | Path2D
  | (Drawable | SVGPathString)[]
  | null;

export type ElementShapes = {
  rectangle: Drawable;
  ellipse: Drawable;
  diamond: Drawable;
  iframe: Drawable;
  embeddable: Drawable;
  freedraw: (Drawable | SVGPathString)[];
  arrow: Drawable[];
  line: Drawable[];
  text: null;
  stickynote: null;
  image: null;
  frame: null;
  magicframe: null;
};

export type ActiveTool =
  | {
      type: ToolType;
      customType: null;
    }
  | {
      type: "custom";
      customType: string;
    };

/**
 * The part of the editor state that element code reads. The editor's
 * `AppState` (`@excalidraw/excalidraw/types`) extends it.
 */
export interface ElementsState {
  /**
   * for a newly created element
   * - set on pointer down, updated during pointer move, used on pointer up
   */
  newElement: NonDeleted<ExcalidrawNonSelectionElement> | null;
  /**
   * tracking current arrow binding editor state (takes into account
   * `bindingPreference` and keyboard modifiers (ctrl/alt)
   */
  isBindingEnabled: boolean;
  /**
   * The bindable element the UI highlights for the user when an arrow is
   * dragged or otherwise its endpoint being close to said element.
   */
  suggestedBinding: {
    element: NonDeleted<ExcalidrawBindableElement>;
    midPoint?: GlobalPoint;
  } | null;
  frameToHighlight: NonDeleted<ExcalidrawFrameLikeElement> | null;
  frameRendering: {
    enabled: boolean;
    name: boolean;
    outline: boolean;
    clip: boolean;
  };
  /**
   * set when a new text is created or when an existing text is being edited
   */
  editingTextElement: ExcalidrawTextElement | null;
  activeTool: {
    /**
     * indicates a previous tool we should revert back to if we deselect the
     * currently active tool. At the moment applies to `eraser` and `hand` tool.
     */
    lastActiveTool: ActiveTool | null;
    locked: boolean;
    // indicates if the current tool is temporarily switched on from the selection tool
    fromSelection: boolean;
  } & ActiveTool;
  currentItemStrokeColor: string;
  currentItemBackgroundColor: string;
  currentItemFillStyle: ExcalidrawElement["fillStyle"];
  currentItemStrokeWidthKey: StrokeWidthKey;
  currentItemStrokeStyle: ExcalidrawElement["strokeStyle"];
  currentItemRoughness: number;
  currentItemOpacity: number;
  currentItemStartArrowhead: Arrowhead | null;
  currentItemEndArrowhead: Arrowhead | null;
  currentItemRoundness: StrokeRoundness;
  viewBackgroundColor: string;
  scrollX: number;
  scrollY: number;
  zoom: Zoom;
  selectedElementIds: Readonly<{ [id: string]: true }>;
  selectedElementsAreBeingDragged: boolean;
  theme: Theme;
  viewModeEnabled: boolean;
  /** top-most selected groups (i.e. does not include nested groups) */
  selectedGroupIds: { [groupId: string]: boolean };
  /** group being edited when you drill down to its constituent element
    (e.g. when you double-click on a group's element) */
  editingGroupId: GroupId | null;
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
  selectedLinearElement: LinearElementEditor | null;
  croppingElementId: ExcalidrawElement["id"] | null;
  // Stores the current bind mode which is detemined at various points during
  // a drag operation (like pointer position vs bindable element) but needed
  // globally for calculating the binding strategy
  bindMode: BindMode;
  /** user preference whether arrow snap to midpoints while binding */
  isMidpointSnappingEnabled: boolean;
  hoveredElementIds: Readonly<{ [id: string]: true }>;
  /** grid cell px size */
  gridSize: number;
  gridModeEnabled: boolean;
  shouldCacheIgnoreZoom: boolean;
  /** the open dialog, if any (`AppState` narrows this to its dialogs) */
  openDialog: { name: string } | null;
}

/** images loaded for the scene's image elements, keyed by file id */
export type ImageCache = Map<
  FileId,
  {
    image: HTMLImageElement | Promise<HTMLImageElement>;
    mimeType: ValueOf<typeof IMAGE_MIME_TYPES>;
  }
>;

/** host-supplied validation of embeddable URLs (the `validateEmbeddable` prop) */
export type EmbeddableValidator =
  | boolean
  | string[]
  | RegExp
  | RegExp[]
  | ((link: string) => boolean | undefined);

/** host-supplied element link generator (the `generateLinkForSelection` prop) */
export type GenerateLinkForSelection = (
  id: string,
  type: "element" | "group",
) => string;

/** elements as they were when the pointer went down, keyed by id */
export type OriginalElementsMap = Map<string, NonDeleted<ExcalidrawElement>>;

/** Supported visual changes. Geometry, content, bindings and styles are not overridable. */
export type ElementRenderOverride = Readonly<{
  /** Absolute render opacity (0–100, clamped). Omitted: use element.opacity. */
  opacity?: number;
  /** Translation in scene units. Bound labels inherit their container's offset and ignore this field. */
  offset?: Readonly<{ x: number; y: number }>;
}>;

/** see {@link ExcalidrawImperativeAPI.setElementRenderOverrides} for details */
export type ElementRenderOverrides = ReadonlyMap<
  ExcalidrawElement["id"],
  ElementRenderOverride
>;

/** The translation part of a snapshot: only the entries that carry an offset. */
export type ElementRenderOffsets = ReadonlyMap<
  ExcalidrawElement["id"],
  NonNullable<ElementRenderOverride["offset"]>
>;

export type ElementsPendingErasure = Set<ExcalidrawElement["id"]>;

export type RenderableElementsMap = NonDeletedElementsMap &
  MakeBrand<"RenderableElementsMap">;

export type StaticCanvasRenderConfig = {
  canvasBackgroundColor: ElementsState["viewBackgroundColor"];
  /**
   * Backing-store scale the target canvas was bootstrapped with -- the owner
   * window's devicePixelRatio when rendering into the editor, exportScale when
   * exporting. Element caches are built and blitted at this ratio, so it must
   * be the same value passed as `StaticSceneRenderConfig["scale"]`.
   */
  scale: number;
  /**
   * Host environment that creates the canvases and images this render
   * rasterizes (per-editor owner window in the app; the export's
   * `config.environment` when exporting). Defaults to the browser's.
   */
  renderEnvironment?: RenderEnvironment;
  /** export only: clips everything drawn to this frame (square corners) */
  clipToFrame?: ExcalidrawFrameLikeElement | null;
  // extra options passed to the renderer
  // ---------------------------------------------------------------------------
  imageCache: ImageCache;
  renderGrid: boolean;
  /** whether to render link icons on elements with links (never rendered
   when exporting). @default true */
  renderLinks?: boolean;
  /** when exporting the behavior is slightly different (e.g. we can't use
   CSS filters), and we disable render optimizations for best output */
  isExporting: boolean;
  embedsValidationStatus: EmbedsValidationStatus;
  elementsPendingErasure: ElementsPendingErasure;
  pendingFlowchartNodes: PendingExcalidrawElements | null;
  theme: ElementsState["theme"];
  elementRenderOverrides?: ElementRenderOverrides;
};
