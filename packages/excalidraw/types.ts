import type {
  IMAGE_MIME_TYPES,
  UserIdleState,
  throttleRAF,
  MIME_TYPES,
  EditorInterface,
} from "@excalidraw/common";

import type { SuggestedBinding } from "@excalidraw/element";

import type { LinearElementEditor } from "@excalidraw/element";

import type { MaybeTransformHandleType } from "@excalidraw/element";

import type {
  PointerType,
  ExcalidrawLinearElement,
  NonDeletedExcalidrawElement,
  NonDeleted,
  TextAlign,
  ExcalidrawElement,
  GroupId,
  ExcalidrawBindableElement,
  Arrowhead,
  ChartType,
  FontFamilyValues,
  FileId,
  Theme,
  StrokeRoundness,
  ExcalidrawEmbeddableElement,
  ExcalidrawMagicFrameElement,
  ExcalidrawFrameLikeElement,
  ExcalidrawElementType,
  ExcalidrawIframeLikeElement,
  OrderedExcalidrawElement,
  ExcalidrawNonSelectionElement,
} from "@excalidraw/element/types";

import type {
  Merge,
  MaybePromise,
  ValueOf,
  MakeBrand,
} from "@excalidraw/common/utility-types";

import type {
  CaptureUpdateActionType,
  DurableIncrement,
  EphemeralIncrement,
} from "@excalidraw/element";

import type { Action } from "./actions/types";
import type { Spreadsheet } from "./charts";
import type { ClipboardData } from "./clipboard";
import type App from "./components/App";
import type Library from "./data/library";
import type { FileSystemHandle } from "./data/filesystem";
import type { ContextMenuItems } from "./components/ContextMenu";
import type { SnapLine } from "./snapping";
import type { ImportedDataState } from "./data/types";

import type { Language } from "./i18n";
import type { isOverScrollBars } from "./scene/scrollbars";
import type React from "react";
import type { JSX } from "react";

export type SocketId = string & { _brand: "SocketId" };

export type Collaborator = Readonly<{
  pointer?: CollaboratorPointer;
  button?: "up" | "down";
  selectedElementIds?: AppState["selectedElementIds"];
  username?: string | null;
  userState?: UserIdleState;
  color?: {
    background: string;
    stroke: string;
  };
  // The url of the collaborator's avatar, defaults to username initials
  // if not present
  avatarUrl?: string;
  // user id. If supplied, we'll filter out duplicates when rendering user avatars.
  id?: string;
  socketId?: SocketId;
  isCurrentUser?: boolean;
  isInCall?: boolean;
  isSpeaking?: boolean;
  isMuted?: boolean;
}>;

export type CollaboratorPointer = {
  x: number;
  y: number;
  tool: "pointer" | "laser";
  /**
   * Whether to render cursor + username. Useful when you only want to render
   * laser trail.
   *
   * @default true
   */
  renderCursor?: boolean;
  /**
   * Explicit laser color.
   *
   * @default string collaborator's cursor color
   */
  laserColor?: string;
};

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
  | "embeddable"
  | "laser";

export type ElementOrToolType = ExcalidrawElementType | ToolType | "custom";

export type ActiveTool =
  | {
      type: ToolType;
      customType: null;
    }
  | {
      type: "custom";
      customType: string;
    };

export type SidebarName = string;
export type SidebarTabName = string;

export type UserToFollow = {
  socketId: SocketId;
  username: string;
};

type _CommonCanvasAppState = {
  zoom: AppState["zoom"];
  scrollX: AppState["scrollX"];
  scrollY: AppState["scrollY"];
  width: AppState["width"];
  height: AppState["height"];
  viewModeEnabled: AppState["viewModeEnabled"];
  openDialog: AppState["openDialog"];
  editingGroupId: AppState["editingGroupId"]; // TODO: move to interactive canvas if possible
  selectedElementIds: AppState["selectedElementIds"]; // TODO: move to interactive canvas if possible
  frameToHighlight: AppState["frameToHighlight"]; // TODO: move to interactive canvas if possible
  offsetLeft: AppState["offsetLeft"];
  offsetTop: AppState["offsetTop"];
  theme: AppState["theme"];
};

export type StaticCanvasAppState = Readonly<
  _CommonCanvasAppState & {
    shouldCacheIgnoreZoom: AppState["shouldCacheIgnoreZoom"];
    /** null indicates transparent bg */
    viewBackgroundColor: AppState["viewBackgroundColor"] | null;
    exportScale: AppState["exportScale"];
    selectedElementsAreBeingDragged: AppState["selectedElementsAreBeingDragged"];
    gridSize: AppState["gridSize"];
    gridStep: AppState["gridStep"];
    frameRendering: AppState["frameRendering"];
    currentHoveredFontFamily: AppState["currentHoveredFontFamily"];
    hoveredElementIds: AppState["hoveredElementIds"];
    // Cropping
    croppingElementId: AppState["croppingElementId"];
  }
>;

export type InteractiveCanvasAppState = Readonly<
  _CommonCanvasAppState & {
    // renderInteractiveScene
    activeEmbeddable: AppState["activeEmbeddable"];
    selectionElement: AppState["selectionElement"];
    selectedGroupIds: AppState["selectedGroupIds"];
    selectedLinearElement: AppState["selectedLinearElement"];
    multiElement: AppState["multiElement"];
    isBindingEnabled: AppState["isBindingEnabled"];
    suggestedBindings: AppState["suggestedBindings"];
    isRotating: AppState["isRotating"];
    elementsToHighlight: AppState["elementsToHighlight"];
    // Collaborators
    collaborators: AppState["collaborators"];
    // SnapLines
    snapLines: AppState["snapLines"];
    zenModeEnabled: AppState["zenModeEnabled"];
    editingTextElement: AppState["editingTextElement"];
    // Cropping
    isCropping: AppState["isCropping"];
    croppingElementId: AppState["croppingElementId"];
    // Search matches
    searchMatches: AppState["searchMatches"];
    activeLockedId: AppState["activeLockedId"];
  }
>;

export type ObservedAppState = ObservedStandaloneAppState &
  ObservedElementsAppState;

export type ObservedStandaloneAppState = {
  name: AppState["name"];
  viewBackgroundColor: AppState["viewBackgroundColor"];
};

export type ObservedElementsAppState = {
  editingGroupId: AppState["editingGroupId"];
  selectedElementIds: AppState["selectedElementIds"];
  selectedGroupIds: AppState["selectedGroupIds"];
  selectedLinearElement: {
    elementId: LinearElementEditor["elementId"];
    isEditing: boolean;
  } | null;
  croppingElementId: AppState["croppingElementId"];
  lockedMultiSelections: AppState["lockedMultiSelections"];
  activeLockedId: AppState["activeLockedId"];
};

export interface AppState {
  contextMenu: {
    items: ContextMenuItems;
    top: number;
    left: number;
  } | null;
  showWelcomeScreen: boolean;
  isLoading: boolean;
  errorMessage: React.ReactNode;
  activeEmbeddable: {
    element: NonDeletedExcalidrawElement;
    state: "hover" | "active";
  } | null;
  /**
   * for a newly created element
   * - set on pointer down, updated during pointer move, used on pointer up
   */
  newElement: NonDeleted<ExcalidrawNonSelectionElement> | null;
  /**
   * for a single element that's being resized
   * - set on pointer down when it's selected and the active tool is selection
   */
  resizingElement: NonDeletedExcalidrawElement | null;
  /**
   * multiElement is for multi-point linear element that's created by clicking as opposed to dragging
   * - when set and present, the editor will handle linear element creation logic accordingly
   */
  multiElement: NonDeleted<ExcalidrawLinearElement> | null;
  /**
   * decoupled from newElement, dragging selection only creates selectionElement
   * - set on pointer down, updated during pointer move
   */
  selectionElement: NonDeletedExcalidrawElement | null;
  isBindingEnabled: boolean;
  startBoundElement: NonDeleted<ExcalidrawBindableElement> | null;
  suggestedBindings: SuggestedBinding[];
  frameToHighlight: NonDeleted<ExcalidrawFrameLikeElement> | null;
  frameRendering: {
    enabled: boolean;
    name: boolean;
    outline: boolean;
    clip: boolean;
  };
  editingFrame: string | null;
  elementsToHighlight: NonDeleted<ExcalidrawElement>[] | null;
  /**
   * set when a new text is created or when an existing text is being edited
   */
  editingTextElement: NonDeletedExcalidrawElement | null;
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
  preferredSelectionTool: {
    type: "selection" | "lasso";
    initialized: boolean;
  };
  penMode: boolean;
  penDetected: boolean;
  exportBackground: boolean;
  exportEmbedScene: boolean;
  exportWithDarkMode: boolean;
  exportScale: number;
  currentItemStrokeColor: string;
  currentItemBackgroundColor: string;
  currentItemFillStyle: ExcalidrawElement["fillStyle"];
  currentItemStrokeWidth: number;
  currentItemStrokeStyle: ExcalidrawElement["strokeStyle"];
  currentItemRoughness: number;
  currentItemOpacity: number;
  currentItemFontFamily: FontFamilyValues;
  currentItemFontSize: number;
  currentItemTextAlign: TextAlign;
  currentItemStartArrowhead: Arrowhead | null;
  currentItemEndArrowhead: Arrowhead | null;
  currentHoveredFontFamily: FontFamilyValues | null;
  currentItemRoundness: StrokeRoundness;
  currentItemArrowType: "sharp" | "round" | "elbow";
  viewBackgroundColor: string;
  scrollX: number;
  scrollY: number;
  cursorButton: "up" | "down";
  scrolledOutside: boolean;
  name: string | null;
  isResizing: boolean;
  isRotating: boolean;
  zoom: Zoom;
  openMenu: "canvas" | null;
  openPopup:
    | "canvasBackground"
    | "elementBackground"
    | "elementStroke"
    | "fontFamily"
    | "compactTextProperties"
    | "compactStrokeStyles"
    | "compactOtherProperties"
    | "compactArrowProperties"
    | null;
  openSidebar: { name: SidebarName; tab?: SidebarTabName } | null;
  openDialog:
    | null
    | { name: "imageExport" | "help" | "jsonExport" }
    | { name: "ttd"; tab: "text-to-diagram" | "mermaid" }
    | { name: "commandPalette" }
    | { name: "elementLinkSelector"; sourceElementId: ExcalidrawElement["id"] };
  /**
   * Reflects user preference for whether the default sidebar should be docked.
   *
   * NOTE this is only a user preference and does not reflect the actual docked
   * state of the sidebar, because the host apps can override this through
   * a DefaultSidebar prop, which is not reflected back to the appState.
   */
  defaultSidebarDockedPreference: boolean;

  lastPointerDownWith: PointerType;
  selectedElementIds: Readonly<{ [id: string]: true }>;
  hoveredElementIds: Readonly<{ [id: string]: true }>;
  previousSelectedElementIds: { [id: string]: true };
  selectedElementsAreBeingDragged: boolean;
  shouldCacheIgnoreZoom: boolean;
  toast: { message: string; closable?: boolean; duration?: number } | null;
  zenModeEnabled: boolean;
  theme: Theme;
  /** grid cell px size */
  gridSize: number;
  gridStep: number;
  gridModeEnabled: boolean;
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

  fileHandle: FileSystemHandle | null;
  collaborators: Map<SocketId, Collaborator>;
  stats: {
    open: boolean;
    /** bitmap. Use `STATS_PANELS` bit values */
    panels: number;
  };
  currentChartType: ChartType;
  pasteDialog:
    | {
        shown: false;
        data: null;
      }
    | {
        shown: true;
        data: Spreadsheet;
      };
  showHyperlinkPopup: false | "info" | "editor";
  selectedLinearElement: LinearElementEditor | null;
  snapLines: readonly SnapLine[];
  originSnapOffset: {
    x: number;
    y: number;
  } | null;
  objectsSnapModeEnabled: boolean;
  /** the user's socket id & username who is being followed on the canvas */
  userToFollow: UserToFollow | null;
  /** the socket ids of the users following the current user */
  followedBy: Set<SocketId>;

  /** image cropping */
  isCropping: boolean;
  croppingElementId: ExcalidrawElement["id"] | null;

  /** null if no search matches found / search closed */
  searchMatches: Readonly<{
    focusedId: ExcalidrawElement["id"] | null;
    matches: readonly SearchMatch[];
  }> | null;

  /** the locked element/group that's active and shows unlock popup */
  activeLockedId: string | null;
  // when locking multiple units of elements together, we assign a temporary
  // groupId to them so we can unlock them together;
  // as elements are unlocked, we remove the groupId from the elements
  // and also remove groupId from this map
  lockedMultiSelections: { [groupId: string]: true };
}

export type SearchMatch = {
  id: string;
  focus: boolean;
  matchedLines: {
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    showOnCanvas: boolean;
  }[];
};

export type UIAppState = Omit<
  AppState,
  | "suggestedBindings"
  | "startBoundElement"
  | "cursorButton"
  | "scrollX"
  | "scrollY"
>;

export type NormalizedZoomValue = number & { _brand: "normalizedZoom" };

export type Zoom = Readonly<{
  value: NormalizedZoomValue;
}>;

export type PointerCoords = Readonly<{
  x: number;
  y: number;
}>;

export type Gesture = {
  pointers: Map<number, PointerCoords>;
  lastCenter: { x: number; y: number } | null;
  initialDistance: number | null;
  initialScale: number | null;
};

export declare class GestureEvent extends UIEvent {
  readonly rotation: number;
  readonly scale: number;
}

// libraries
// -----------------------------------------------------------------------------
/** @deprecated legacy: do not use outside of migration paths */
export type LibraryItem_v1 = readonly NonDeleted<ExcalidrawElement>[];
/** @deprecated legacy: do not use outside of migration paths */
type LibraryItems_v1 = readonly LibraryItem_v1[];

/** v2 library item */
export type LibraryItem = {
  id: string;
  status: "published" | "unpublished";
  elements: readonly NonDeleted<ExcalidrawElement>[];
  /** timestamp in epoch (ms) */
  created: number;
  name?: string;
  error?: string;
};
export type LibraryItems = readonly LibraryItem[];
export type LibraryItems_anyVersion = LibraryItems | LibraryItems_v1;

export type LibraryItemsSource =
  | ((
      currentLibraryItems: LibraryItems,
    ) => MaybePromise<LibraryItems_anyVersion | Blob>)
  | MaybePromise<LibraryItems_anyVersion | Blob>;
// -----------------------------------------------------------------------------

export type ExcalidrawInitialDataState = Merge<
  ImportedDataState,
  {
    libraryItems?: MaybePromise<Required<ImportedDataState>["libraryItems"]>;
  }
>;

export type OnUserFollowedPayload = {
  userToFollow: UserToFollow;
  action: "FOLLOW" | "UNFOLLOW";
};

export interface ExcalidrawProps {
  onChange?: (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => void;
  onIncrement?: (event: DurableIncrement | EphemeralIncrement) => void;
  initialData?:
    | (() => MaybePromise<ExcalidrawInitialDataState | null>)
    | MaybePromise<ExcalidrawInitialDataState | null>;
  excalidrawAPI?: (api: ExcalidrawImperativeAPI) => void;
  isCollaborating?: boolean;
  onPointerUpdate?: (payload: {
    pointer: { x: number; y: number; tool: "pointer" | "laser" };
    button: "down" | "up";
    pointersMap: Gesture["pointers"];
  }) => void;
  onPaste?: (
    data: ClipboardData,
    event: ClipboardEvent | null,
  ) => Promise<boolean> | boolean;
  /**
   * Called when element(s) are duplicated so you can listen or modify as
   * needed.
   *
   * Called when duplicating via mouse-drag, keyboard, paste, library insert
   * etc.
   *
   * Returned elements will be used in place of the next elements
   * (you should return all elements, including deleted, and not mutate
   * the element if changes are made)
   */
  onDuplicate?: (
    nextElements: readonly ExcalidrawElement[],
    /** excludes the duplicated elements */
    prevElements: readonly ExcalidrawElement[],
  ) => ExcalidrawElement[] | void;
  renderTopLeftUI?: (
    isMobile: boolean,
    appState: UIAppState,
  ) => JSX.Element | null;
  renderTopRightUI?: (
    isMobile: boolean,
    appState: UIAppState,
  ) => JSX.Element | null;
  langCode?: Language["code"];
  viewModeEnabled?: boolean;
  zenModeEnabled?: boolean;
  gridModeEnabled?: boolean;
  objectsSnapModeEnabled?: boolean;
  libraryReturnUrl?: string;
  theme?: Theme;
  // @TODO come with better API before v0.18.0
  name?: string;
  renderCustomStats?: (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: UIAppState,
  ) => JSX.Element;
  UIOptions?: Partial<UIOptions>;
  detectScroll?: boolean;
  handleKeyboardGlobally?: boolean;
  onLibraryChange?: (libraryItems: LibraryItems) => void | Promise<any>;
  autoFocus?: boolean;
  generateIdForFile?: (file: File) => string | Promise<string>;
  generateLinkForSelection?: (id: string, type: "element" | "group") => string;
  onLinkOpen?: (
    element: NonDeletedExcalidrawElement,
    event: CustomEvent<{
      nativeEvent: MouseEvent | React.PointerEvent<HTMLCanvasElement>;
    }>,
  ) => void;
  onPointerDown?: (
    activeTool: AppState["activeTool"],
    pointerDownState: PointerDownState,
  ) => void;
  onPointerUp?: (
    activeTool: AppState["activeTool"],
    pointerDownState: PointerDownState,
  ) => void;
  onScrollChange?: (scrollX: number, scrollY: number, zoom: Zoom) => void;
  onUserFollow?: (payload: OnUserFollowedPayload) => void;
  children?: React.ReactNode;
  validateEmbeddable?:
    | boolean
    | string[]
    | RegExp
    | RegExp[]
    | ((link: string) => boolean | undefined);
  renderEmbeddable?: (
    element: NonDeleted<ExcalidrawEmbeddableElement>,
    appState: AppState,
  ) => JSX.Element | null;
  aiEnabled?: boolean;
  showDeprecatedFonts?: boolean;
  renderScrollbars?: boolean;
}

export type SceneData = {
  elements?: ImportedDataState["elements"];
  appState?: ImportedDataState["appState"];
  collaborators?: Map<SocketId, Collaborator>;
  captureUpdate?: CaptureUpdateActionType;
};

export type ExportOpts = {
  saveFileToDisk?: boolean;
  onExportToBackend?: (
    exportedElements: readonly NonDeletedExcalidrawElement[],
    appState: UIAppState,
    files: BinaryFiles,
  ) => void;
  renderCustomUI?: (
    exportedElements: readonly NonDeletedExcalidrawElement[],
    appState: UIAppState,
    files: BinaryFiles,
    canvas: HTMLCanvasElement,
  ) => JSX.Element;
};

// NOTE at the moment, if action name corresponds to canvasAction prop, its
// truthiness value will determine whether the action is rendered or not
// (see manager renderAction). We also override canvasAction values in
// Excalidraw package index.tsx.
export type CanvasActions = Partial<{
  changeViewBackgroundColor: boolean;
  clearCanvas: boolean;
  export: false | ExportOpts;
  loadScene: boolean;
  saveToActiveFile: boolean;
  toggleTheme: boolean | null;
  saveAsImage: boolean;
}>;

export type UIOptions = Partial<{
  dockedSidebarBreakpoint: number;
  canvasActions: CanvasActions;
  tools: {
    image: boolean;
  };
  /**
   * Optionally control the editor form factor and desktop UI mode from the host app.
   * If not provided, we will take care of it internally.
   */
  formFactor?: EditorInterface["formFactor"];
  desktopUIMode?: EditorInterface["desktopUIMode"];
  /** @deprecated does nothing. Will be removed in 0.15 */
  welcomeScreen?: boolean;
}>;

export type AppProps = Merge<
  ExcalidrawProps,
  {
    UIOptions: Merge<
      UIOptions,
      {
        canvasActions: Required<CanvasActions> & { export: ExportOpts };
      }
    >;
    detectScroll: boolean;
    handleKeyboardGlobally: boolean;
    isCollaborating: boolean;
    children?: React.ReactNode;
    aiEnabled: boolean;
  }
>;

/** A subset of App class properties that we need to use elsewhere
 * in the app, eg Manager. Factored out into a separate type to keep DRY. */
export type AppClassProperties = {
  props: AppProps;
  state: AppState;
  interactiveCanvas: HTMLCanvasElement | null;
  /** static canvas */
  canvas: HTMLCanvasElement;
  focusContainer(): void;
  library: Library;
  imageCache: Map<
    FileId,
    {
      image: HTMLImageElement | Promise<HTMLImageElement>;
      mimeType: ValueOf<typeof IMAGE_MIME_TYPES>;
    }
  >;
  files: BinaryFiles;
  editorInterface: App["editorInterface"];
  scene: App["scene"];
  syncActionResult: App["syncActionResult"];
  fonts: App["fonts"];
  pasteFromClipboard: App["pasteFromClipboard"];
  id: App["id"];
  onInsertElements: App["onInsertElements"];
  onExportImage: App["onExportImage"];
  lastViewportPosition: App["lastViewportPosition"];
  scrollToContent: App["scrollToContent"];
  addFiles: App["addFiles"];
  addElementsFromPasteOrLibrary: App["addElementsFromPasteOrLibrary"];
  togglePenMode: App["togglePenMode"];
  toggleLock: App["toggleLock"];
  setActiveTool: App["setActiveTool"];
  setOpenDialog: App["setOpenDialog"];
  insertEmbeddableElement: App["insertEmbeddableElement"];
  onMagicframeToolSelect: App["onMagicframeToolSelect"];
  getName: App["getName"];
  dismissLinearEditor: App["dismissLinearEditor"];
  flowChartCreator: App["flowChartCreator"];
  getEffectiveGridSize: App["getEffectiveGridSize"];
  setPlugins: App["setPlugins"];
  plugins: App["plugins"];
  getEditorUIOffsets: App["getEditorUIOffsets"];
  visibleElements: App["visibleElements"];
  excalidrawContainerValue: App["excalidrawContainerValue"];

  onPointerUpEmitter: App["onPointerUpEmitter"];
  updateEditorAtom: App["updateEditorAtom"];
  onPointerDownEmitter: App["onPointerDownEmitter"];
};

export type PointerDownState = Readonly<{
  // The first position at which pointerDown happened
  origin: Readonly<{ x: number; y: number }>;
  // Same as "origin" but snapped to the grid, if grid is on
  originInGrid: Readonly<{ x: number; y: number }>;
  // Scrollbar checks
  scrollbars: ReturnType<typeof isOverScrollBars>;
  // The previous pointer position
  lastCoords: { x: number; y: number };
  // original element frozen snapshots so we can access the original
  // element attribute values at time of pointerdown
  originalElements: Map<string, NonDeleted<ExcalidrawElement>>;
  resize: {
    // Handle when resizing, might change during the pointer interaction
    handleType: MaybeTransformHandleType;
    // This is determined on the initial pointer down event
    isResizing: boolean;
    // This is determined on the initial pointer down event
    offset: { x: number; y: number };
    // This is determined on the initial pointer down event
    arrowDirection: "origin" | "end";
    // This is a center point of selected elements determined on the initial pointer down event (for rotation only)
    center: { x: number; y: number };
  };
  hit: {
    // The element the pointer is "hitting", is determined on the initial
    // pointer down event
    element: NonDeleted<ExcalidrawElement> | null;
    // The elements the pointer is "hitting", is determined on the initial
    // pointer down event
    allHitElements: NonDeleted<ExcalidrawElement>[];
    // This is determined on the initial pointer down event
    wasAddedToSelection: boolean;
    // Whether selected element(s) were duplicated, might change during the
    // pointer interaction
    hasBeenDuplicated: boolean;
    hasHitCommonBoundingBoxOfSelectedElements: boolean;
  };
  withCmdOrCtrl: boolean;
  drag: {
    // Might change during the pointer interaction
    hasOccurred: boolean;
    // Might change during the pointer interaction
    offset: { x: number; y: number } | null;
    // by default same as PointerDownState.origin. On alt-duplication, reset
    // to current pointer position at time of duplication.
    origin: { x: number; y: number };
    // Whether to block drag after lasso selection
    // this is meant to be used to block dragging after lasso selection on PCs
    // until the next pointer down
    blockDragging: boolean;
  };
  // We need to have these in the state so that we can unsubscribe them
  eventListeners: {
    // It's defined on the initial pointer down event
    onMove: null | ReturnType<typeof throttleRAF>;
    // It's defined on the initial pointer down event
    onUp: null | ((event: PointerEvent) => void);
    // It's defined on the initial pointer down event
    onKeyDown: null | ((event: KeyboardEvent) => void);
    // It's defined on the initial pointer down event
    onKeyUp: null | ((event: KeyboardEvent) => void);
  };
  boxSelection: {
    hasOccurred: boolean;
  };
}>;

export type UnsubscribeCallback = () => void;

export interface ExcalidrawImperativeAPI {
  updateScene: InstanceType<typeof App>["updateScene"];
  applyDeltas: InstanceType<typeof App>["applyDeltas"];
  mutateElement: InstanceType<typeof App>["mutateElement"];
  updateLibrary: InstanceType<typeof Library>["updateLibrary"];
  resetScene: InstanceType<typeof App>["resetScene"];
  getSceneElementsIncludingDeleted: InstanceType<
    typeof App
  >["getSceneElementsIncludingDeleted"];
  getSceneElementsMapIncludingDeleted: InstanceType<
    typeof App
  >["getSceneElementsMapIncludingDeleted"];
  history: {
    clear: InstanceType<typeof App>["resetHistory"];
  };
  getSceneElements: InstanceType<typeof App>["getSceneElements"];
  getAppState: () => InstanceType<typeof App>["state"];
  getFiles: () => InstanceType<typeof App>["files"];
  getName: InstanceType<typeof App>["getName"];
  scrollToContent: InstanceType<typeof App>["scrollToContent"];
  registerAction: (action: Action) => void;
  refresh: InstanceType<typeof App>["refresh"];
  setToast: InstanceType<typeof App>["setToast"];
  addFiles: (data: BinaryFileData[]) => void;
  id: string;
  setActiveTool: InstanceType<typeof App>["setActiveTool"];
  setCursor: InstanceType<typeof App>["setCursor"];
  resetCursor: InstanceType<typeof App>["resetCursor"];
  toggleSidebar: InstanceType<typeof App>["toggleSidebar"];
  getEditorInterface: () => EditorInterface;
  /**
   * Disables rendering of frames (including element clipping), but currently
   * the frames are still interactive in edit mode. As such, this API should be
   * used in conjunction with view mode (props.viewModeEnabled).
   */
  updateFrameRendering: InstanceType<typeof App>["updateFrameRendering"];
  onChange: (
    callback: (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => void,
  ) => UnsubscribeCallback;
  onIncrement: (
    callback: (event: DurableIncrement | EphemeralIncrement) => void,
  ) => UnsubscribeCallback;
  onPointerDown: (
    callback: (
      activeTool: AppState["activeTool"],
      pointerDownState: PointerDownState,
      event: React.PointerEvent<HTMLElement>,
    ) => void,
  ) => UnsubscribeCallback;
  onPointerUp: (
    callback: (
      activeTool: AppState["activeTool"],
      pointerDownState: PointerDownState,
      event: PointerEvent,
    ) => void,
  ) => UnsubscribeCallback;
  onScrollChange: (
    callback: (scrollX: number, scrollY: number, zoom: Zoom) => void,
  ) => UnsubscribeCallback;
  onUserFollow: (
    callback: (payload: OnUserFollowedPayload) => void,
  ) => UnsubscribeCallback;
}

export type FrameNameBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
};

export type FrameNameBoundsCache = {
  get: (
    frameElement: ExcalidrawFrameLikeElement | ExcalidrawMagicFrameElement,
  ) => FrameNameBounds | null;
  _cache: Map<
    string,
    FrameNameBounds & {
      zoom: AppState["zoom"]["value"];
      versionNonce: ExcalidrawFrameLikeElement["versionNonce"];
    }
  >;
};

export type KeyboardModifiersObject = {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
};

export type Primitive =
  | number
  | string
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

export type JSONValue = string | number | boolean | null | object;

export type EmbedsValidationStatus = Map<
  ExcalidrawIframeLikeElement["id"],
  boolean
>;

export type ElementsPendingErasure = Set<ExcalidrawElement["id"]>;

export type PendingExcalidrawElements = ExcalidrawElement[];

/** Runtime gridSize value. Null indicates disabled grid. */
export type NullableGridSize =
  | (AppState["gridSize"] & MakeBrand<"NullableGridSize">)
  | null;

export type GenerateDiagramToCode = (props: {
  frame: ExcalidrawMagicFrameElement;
  children: readonly ExcalidrawElement[];
}) => MaybePromise<{ html: string }>;

export type Offsets = Partial<{
  top: number;
  right: number;
  bottom: number;
  left: number;
}>;
