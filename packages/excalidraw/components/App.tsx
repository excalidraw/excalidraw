import clsx from "clsx";
import throttle from "lodash.throttle";
import React, { useContext } from "react";
import { flushSync } from "react-dom";
import rough from "roughjs/bin/rough";
import { nanoid } from "nanoid";

import {
  clamp,
  pointFrom,
  pointDistance,
  vector,
  pointRotateRads,
  vectorScale,
  vectorFromPoint,
  vectorSubtract,
  vectorDot,
  vectorNormalize,
} from "@excalidraw/math";

import {
  COLOR_PALETTE,
  CODES,
  shouldResizeFromCenter,
  shouldMaintainAspectRatio,
  shouldRotateWithDiscreteAngle,
  isArrowKey,
  KEYS,
  APP_NAME,
  CURSOR_TYPE,
  DEFAULT_MAX_IMAGE_WIDTH_OR_HEIGHT,
  DEFAULT_VERTICAL_ALIGN,
  DRAGGING_THRESHOLD,
  ELEMENT_SHIFT_TRANSLATE_AMOUNT,
  ELEMENT_TRANSLATE_AMOUNT,
  EVENT,
  FRAME_STYLE,
  IMAGE_MIME_TYPES,
  IMAGE_RENDER_TIMEOUT,
  isBrave,
  LINE_CONFIRM_THRESHOLD,
  MAX_ALLOWED_FILE_BYTES,
  MIME_TYPES,
  MQ_MAX_HEIGHT_LANDSCAPE,
  MQ_MAX_WIDTH_LANDSCAPE,
  MQ_MAX_WIDTH_PORTRAIT,
  MQ_RIGHT_SIDEBAR_MIN_WIDTH,
  POINTER_BUTTON,
  ROUNDNESS,
  SCROLL_TIMEOUT,
  TAP_TWICE_TIMEOUT,
  TEXT_TO_CENTER_SNAP_THRESHOLD,
  THEME,
  THEME_FILTER,
  TOUCH_CTX_MENU_TIMEOUT,
  VERTICAL_ALIGN,
  YOUTUBE_STATES,
  ZOOM_STEP,
  POINTER_EVENTS,
  TOOL_TYPE,
  isIOS,
  supportsResizeObserver,
  DEFAULT_COLLISION_THRESHOLD,
  DEFAULT_TEXT_ALIGN,
  ARROW_TYPE,
  DEFAULT_REDUCED_GLOBAL_ALPHA,
  isSafari,
  isLocalLink,
  normalizeLink,
  toValidURL,
  getGridPoint,
  getLineHeight,
  debounce,
  distance,
  getFontString,
  getNearestScrollableContainer,
  isInputLike,
  isToolIcon,
  isWritableElement,
  sceneCoordsToViewportCoords,
  tupleToCoors,
  viewportCoordsToSceneCoords,
  wrapEvent,
  updateObject,
  updateActiveTool,
  getShortcutKey,
  isTransparent,
  easeToValuesRAF,
  muteFSAbortError,
  isTestEnv,
  isDevEnv,
  easeOut,
  updateStable,
  addEventListener,
  normalizeEOL,
  getDateTime,
  isShallowEqual,
  arrayToMap,
  type EXPORT_IMAGE_TYPES,
  randomInteger,
  CLASSES,
  Emitter,
  isMobile,
  MINIMUM_ARROW_SIZE,
  DOUBLE_TAP_POSITION_THRESHOLD,
} from "@excalidraw/common";

import {
  getObservedAppState,
  getCommonBounds,
  maybeSuggestBindingsForLinearElementAtCoords,
  getElementAbsoluteCoords,
  bindOrUnbindLinearElements,
  fixBindingsAfterDeletion,
  getHoveredElementForBinding,
  isBindingEnabled,
  shouldEnableBindingForPointerEvent,
  updateBoundElements,
  getSuggestedBindingsForArrows,
  LinearElementEditor,
  newElementWith,
  newFrameElement,
  newFreeDrawElement,
  newEmbeddableElement,
  newMagicFrameElement,
  newIframeElement,
  newArrowElement,
  newElement,
  newImageElement,
  newLinearElement,
  newTextElement,
  refreshTextDimensions,
  deepCopyElement,
  duplicateElements,
  hasBoundTextElement,
  isArrowElement,
  isBindingElement,
  isBindingElementType,
  isBoundToContainer,
  isFrameLikeElement,
  isImageElement,
  isEmbeddableElement,
  isInitializedImageElement,
  isLinearElement,
  isLinearElementType,
  isUsingAdaptiveRadius,
  isIframeElement,
  isIframeLikeElement,
  isMagicFrameElement,
  isTextBindableContainer,
  isElbowArrow,
  isFlowchartNodeElement,
  isBindableElement,
  isTextElement,
  getLockedLinearCursorAlignSize,
  getNormalizedDimensions,
  isElementCompletelyInViewport,
  isElementInViewport,
  isInvisiblySmallElement,
  getCornerRadius,
  isPathALoop,
  createSrcDoc,
  embeddableURLValidator,
  maybeParseEmbedSrc,
  getEmbedLink,
  getInitializedImageElements,
  normalizeSVG,
  updateImageCache as _updateImageCache,
  getBoundTextElement,
  getContainerCenter,
  getContainerElement,
  isValidTextContainer,
  redrawTextBoundingBox,
  shouldShowBoundingBox,
  getFrameChildren,
  isCursorInFrame,
  addElementsToFrame,
  replaceAllElementsInFrame,
  removeElementsFromFrame,
  getElementsInResizingFrame,
  getElementsInNewFrame,
  getContainingFrame,
  elementOverlapsWithFrame,
  updateFrameMembershipOfSelectedElements,
  isElementInFrame,
  getFrameLikeTitle,
  getElementsOverlappingFrame,
  filterElementsEligibleAsFrameChildren,
  hitElementBoundText,
  hitElementBoundingBoxOnly,
  hitElementItself,
  getVisibleSceneBounds,
  FlowChartCreator,
  FlowChartNavigator,
  getLinkDirectionFromKey,
  cropElement,
  wrapText,
  isElementLink,
  parseElementLinkFromURL,
  isMeasureTextSupported,
  normalizeText,
  measureText,
  getLineHeightInPx,
  getApproxMinLineWidth,
  getApproxMinLineHeight,
  getMinTextElementWidth,
  ShapeCache,
  getRenderOpacity,
  editGroupForSelectedElement,
  getElementsInGroup,
  getSelectedGroupIdForElement,
  getSelectedGroupIds,
  isElementInGroup,
  isSelectedViaGroup,
  selectGroupsForSelectedElements,
  syncInvalidIndices,
  syncMovedIndices,
  excludeElementsInFramesFromSelection,
  getSelectionStateForElements,
  makeNextSelectedElementIds,
  getResizeOffsetXY,
  getResizeArrowDirection,
  transformElements,
  getCursorForResizingElement,
  getElementWithTransformHandleType,
  getTransformHandleTypeFromCoords,
  dragNewElement,
  dragSelectedElements,
  getDragOffsetXY,
  isNonDeletedElement,
  Scene,
  Store,
  CaptureUpdateAction,
  type ElementUpdate,
  hitElementBoundingBox,
  isLineElement,
  isSimpleArrow,
  StoreDelta,
  type ApplyToOptions,
  positionElementsOnGrid,
} from "@excalidraw/element";

import type { LocalPoint, Radians } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawGenericElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  NonDeleted,
  InitializedExcalidrawImageElement,
  ExcalidrawImageElement,
  FileId,
  NonDeletedExcalidrawElement,
  ExcalidrawTextContainer,
  ExcalidrawFrameLikeElement,
  ExcalidrawMagicFrameElement,
  ExcalidrawIframeLikeElement,
  IframeData,
  ExcalidrawIframeElement,
  ExcalidrawEmbeddableElement,
  Ordered,
  MagicGenerationData,
  ExcalidrawArrowElement,
  ExcalidrawElbowArrowElement,
  SceneElementsMap,
} from "@excalidraw/element/types";

import type { Mutable, ValueOf } from "@excalidraw/common/utility-types";

import {
  actionAddToLibrary,
  actionBringForward,
  actionBringToFront,
  actionCopy,
  actionCopyAsPng,
  actionCopyAsSvg,
  copyText,
  actionCopyStyles,
  actionCut,
  actionDeleteSelected,
  actionDuplicateSelection,
  actionFinalize,
  actionFlipHorizontal,
  actionFlipVertical,
  actionGroup,
  actionPasteStyles,
  actionSelectAll,
  actionSendBackward,
  actionSendToBack,
  actionToggleGridMode,
  actionToggleStats,
  actionToggleZenMode,
  actionUnbindText,
  actionBindText,
  actionUngroup,
  actionLink,
  actionToggleElementLock,
  actionToggleLinearEditor,
  actionToggleObjectsSnapMode,
  actionToggleCropEditor,
} from "../actions";
import { actionWrapTextInContainer } from "../actions/actionBoundText";
import { actionToggleHandTool, zoomToFit } from "../actions/actionCanvas";
import { actionPaste } from "../actions/actionClipboard";
import { actionCopyElementLink } from "../actions/actionElementLink";
import { actionUnlockAllElements } from "../actions/actionElementLock";
import {
  actionRemoveAllElementsFromFrame,
  actionSelectAllElementsInFrame,
  actionWrapSelectionInFrame,
} from "../actions/actionFrame";
import { createRedoAction, createUndoAction } from "../actions/actionHistory";
import { actionTextAutoResize } from "../actions/actionTextAutoResize";
import { actionToggleViewMode } from "../actions/actionToggleViewMode";
import { ActionManager } from "../actions/manager";
import { actions } from "../actions/register";
import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { trackEvent } from "../analytics";
import { AnimationFrameHandler } from "../animation-frame-handler";
import {
  getDefaultAppState,
  isEraserActive,
  isHandToolActive,
} from "../appState";
import {
  copyTextToSystemClipboard,
  parseClipboard,
  parseDataTransferEvent,
  type ParsedDataTransferFile,
} from "../clipboard";

import { exportCanvas, loadFromBlob } from "../data";
import Library, { distributeLibraryItemsOnSquareGrid } from "../data/library";
import { restore, restoreElements } from "../data/restore";
import { getCenter, getDistance } from "../gesture";
import { History } from "../history";
import { defaultLang, getLanguage, languages, setLanguage, t } from "../i18n";

import {
  calculateScrollCenter,
  getElementsWithinSelection,
  getNormalizedZoom,
  getSelectedElements,
  hasBackground,
  isSomeElementSelected,
} from "../scene";
import { getStateForZoom } from "../scene/zoom";
import {
  dataURLToString,
  generateIdFromFile,
  getDataURL,
  getDataURL_sync,
  ImageURLToFile,
  isImageFileHandle,
  isSupportedImageFile,
  loadSceneOrLibraryFromBlob,
  normalizeFile,
  parseLibraryJSON,
  resizeImageFile,
  SVGStringToFile,
} from "../data/blob";

import { fileOpen } from "../data/filesystem";
import {
  showHyperlinkTooltip,
  hideHyperlinkToolip,
  Hyperlink,
} from "../components/hyperlink/Hyperlink";

import { Fonts } from "../fonts";
import { editorJotaiStore, type WritableAtom } from "../editor-jotai";
import { ImageSceneDataError } from "../errors";
import {
  getSnapLinesAtPointer,
  snapDraggedElements,
  isActiveToolNonLinearSnappable,
  snapNewElement,
  snapResizingElements,
  isSnappingEnabled,
  getVisibleGaps,
  getReferenceSnapPoints,
  SnapCache,
  isGridModeEnabled,
} from "../snapping";
import { convertToExcalidrawElements } from "../data/transform";
import { Renderer } from "../scene/Renderer";
import {
  setEraserCursor,
  setCursor,
  resetCursor,
  setCursorForShape,
} from "../cursor";
import { ElementCanvasButtons } from "../components/ElementCanvasButtons";
import { LaserTrails } from "../laser-trails";
import { withBatchedUpdates, withBatchedUpdatesThrottled } from "../reactUtils";
import { textWysiwyg } from "../wysiwyg/textWysiwyg";
import { isOverScrollBars } from "../scene/scrollbars";

import { isMaybeMermaidDefinition } from "../mermaid";

import { LassoTrail } from "../lasso";

import { EraserTrail } from "../eraser";

import ConvertElementTypePopup, {
  getConversionTypeFromElements,
  convertElementTypePopupAtom,
  convertElementTypes,
} from "./ConvertElementTypePopup";

import { activeConfirmDialogAtom } from "./ActiveConfirmDialog";
import BraveMeasureTextError from "./BraveMeasureTextError";
import { ContextMenu, CONTEXT_MENU_SEPARATOR } from "./ContextMenu";
import { activeEyeDropperAtom } from "./EyeDropper";
import FollowMode from "./FollowMode/FollowMode";
import LayerUI from "./LayerUI";
import { ElementCanvasButton } from "./MagicButton";
import { SVGLayer } from "./SVGLayer";
import { searchItemInFocusAtom } from "./SearchMenu";
import { isSidebarDockedAtom } from "./Sidebar/Sidebar";
import { StaticCanvas, InteractiveCanvas } from "./canvases";
import NewElementCanvas from "./canvases/NewElementCanvas";
import {
  isPointHittingLink,
  isPointHittingLinkIcon,
} from "./hyperlink/helpers";
import { MagicIcon, copyIcon, fullscreenIcon } from "./icons";
import { Toast } from "./Toast";

import { findShapeByKey } from "./shapes";

import UnlockPopup from "./UnlockPopup";

import type {
  RenderInteractiveSceneCallback,
  ScrollBars,
} from "../scene/types";

import type { ClipboardData, PastedMixedContent } from "../clipboard";
import type { ExportedElements } from "../data";
import type { ContextMenuItems } from "./ContextMenu";
import type { FileSystemHandle } from "../data/filesystem";
import type { ExcalidrawElementSkeleton } from "../data/transform";
import type {
  AppClassProperties,
  AppProps,
  AppState,
  BinaryFileData,
  ExcalidrawImperativeAPI,
  BinaryFiles,
  Gesture,
  GestureEvent,
  LibraryItems,
  PointerDownState,
  SceneData,
  Device,
  FrameNameBoundsCache,
  SidebarName,
  SidebarTabName,
  KeyboardModifiersObject,
  CollaboratorPointer,
  ToolType,
  OnUserFollowedPayload,
  UnsubscribeCallback,
  EmbedsValidationStatus,
  ElementsPendingErasure,
  GenerateDiagramToCode,
  NullableGridSize,
  Offsets,
} from "../types";
import type { RoughCanvas } from "roughjs/bin/canvas";
import type { Action, ActionResult } from "../actions/types";

const AppContext = React.createContext<AppClassProperties>(null!);
const AppPropsContext = React.createContext<AppProps>(null!);

const deviceContextInitialValue = {
  viewport: {
    isMobile: false,
    isLandscape: false,
  },
  editor: {
    isMobile: false,
    canFitSidebar: false,
  },
  isTouchScreen: false,
};
const DeviceContext = React.createContext<Device>(deviceContextInitialValue);
DeviceContext.displayName = "DeviceContext";

export const ExcalidrawContainerContext = React.createContext<{
  container: HTMLDivElement | null;
  id: string | null;
}>({ container: null, id: null });
ExcalidrawContainerContext.displayName = "ExcalidrawContainerContext";

const ExcalidrawElementsContext = React.createContext<
  readonly NonDeletedExcalidrawElement[]
>([]);
ExcalidrawElementsContext.displayName = "ExcalidrawElementsContext";

const ExcalidrawAppStateContext = React.createContext<AppState>({
  ...getDefaultAppState(),
  width: 0,
  height: 0,
  offsetLeft: 0,
  offsetTop: 0,
});
ExcalidrawAppStateContext.displayName = "ExcalidrawAppStateContext";

const ExcalidrawSetAppStateContext = React.createContext<
  React.Component<any, AppState>["setState"]
>(() => {
  console.warn("Uninitialized ExcalidrawSetAppStateContext context!");
});
ExcalidrawSetAppStateContext.displayName = "ExcalidrawSetAppStateContext";

const ExcalidrawActionManagerContext = React.createContext<ActionManager>(
  null!,
);
ExcalidrawActionManagerContext.displayName = "ExcalidrawActionManagerContext";

export const useApp = () => useContext(AppContext);
export const useAppProps = () => useContext(AppPropsContext);
export const useDevice = () => useContext<Device>(DeviceContext);
export const useExcalidrawContainer = () =>
  useContext(ExcalidrawContainerContext);
export const useExcalidrawElements = () =>
  useContext(ExcalidrawElementsContext);
export const useExcalidrawAppState = () =>
  useContext(ExcalidrawAppStateContext);
export const useExcalidrawSetAppState = () =>
  useContext(ExcalidrawSetAppStateContext);
export const useExcalidrawActionManager = () =>
  useContext(ExcalidrawActionManagerContext);

let didTapTwice: boolean = false;
let tappedTwiceTimer = 0;
let firstTapPosition: { x: number; y: number } | null = null;
let isHoldingSpace: boolean = false;
let isPanning: boolean = false;
let isDraggingScrollBar: boolean = false;
let currentScrollBars: ScrollBars = { horizontal: null, vertical: null };
let touchTimeout = 0;
let invalidateContextMenu = false;

/**
 * Map of youtube embed video states
 */
const YOUTUBE_VIDEO_STATES = new Map<
  ExcalidrawElement["id"],
  ValueOf<typeof YOUTUBE_STATES>
>();

let IS_PLAIN_PASTE = false;
let IS_PLAIN_PASTE_TIMER = 0;
let PLAIN_PASTE_TOAST_SHOWN = false;

let lastPointerUp: (() => void) | null = null;
const gesture: Gesture = {
  pointers: new Map(),
  lastCenter: null,
  initialDistance: null,
  initialScale: null,
};

class App extends React.Component<AppProps, AppState> {
  canvas: AppClassProperties["canvas"];
  interactiveCanvas: AppClassProperties["interactiveCanvas"] = null;
  rc: RoughCanvas;
  unmounted: boolean = false;
  actionManager: ActionManager;
  device: Device = deviceContextInitialValue;

  private excalidrawContainerRef = React.createRef<HTMLDivElement>();

  public scene: Scene;
  public fonts: Fonts;
  public renderer: Renderer;
  public visibleElements: readonly NonDeletedExcalidrawElement[];
  private resizeObserver: ResizeObserver | undefined;
  private nearestScrollableContainer: HTMLElement | Document | undefined;
  public library: AppClassProperties["library"];
  public libraryItemsFromStorage: LibraryItems | undefined;
  public id: string;
  private store: Store;
  private history: History;
  public excalidrawContainerValue: {
    container: HTMLDivElement | null;
    id: string;
  };

  public files: BinaryFiles = {};
  public imageCache: AppClassProperties["imageCache"] = new Map();
  private iFrameRefs = new Map<ExcalidrawElement["id"], HTMLIFrameElement>();
  /**
   * Indicates whether the embeddable's url has been validated for rendering.
   * If value not set, indicates that the validation is pending.
   * Initially or on url change the flag is not reset so that we can guarantee
   * the validation came from a trusted source (the editor).
   **/
  private embedsValidationStatus: EmbedsValidationStatus = new Map();
  /** embeds that have been inserted to DOM (as a perf optim, we don't want to
   * insert to DOM before user initially scrolls to them) */
  private initializedEmbeds = new Set<ExcalidrawIframeLikeElement["id"]>();

  private handleToastClose = () => {
    this.setToast(null);
  };

  private elementsPendingErasure: ElementsPendingErasure = new Set();

  public flowChartCreator: FlowChartCreator = new FlowChartCreator();
  private flowChartNavigator: FlowChartNavigator = new FlowChartNavigator();

  hitLinkElement?: NonDeletedExcalidrawElement;
  lastPointerDownEvent: React.PointerEvent<HTMLElement> | null = null;
  lastPointerUpEvent: React.PointerEvent<HTMLElement> | PointerEvent | null =
    null;
  lastPointerMoveEvent: PointerEvent | null = null;
  lastPointerMoveCoords: { x: number; y: number } | null = null;
  lastViewportPosition = { x: 0, y: 0 };

  animationFrameHandler = new AnimationFrameHandler();

  laserTrails = new LaserTrails(this.animationFrameHandler, this);
  eraserTrail = new EraserTrail(this.animationFrameHandler, this);
  lassoTrail = new LassoTrail(this.animationFrameHandler, this);

  onChangeEmitter = new Emitter<
    [
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ]
  >();

  onPointerDownEmitter = new Emitter<
    [
      activeTool: AppState["activeTool"],
      pointerDownState: PointerDownState,
      event: React.PointerEvent<HTMLElement>,
    ]
  >();

  onPointerUpEmitter = new Emitter<
    [
      activeTool: AppState["activeTool"],
      pointerDownState: PointerDownState,
      event: PointerEvent,
    ]
  >();
  onUserFollowEmitter = new Emitter<[payload: OnUserFollowedPayload]>();
  onScrollChangeEmitter = new Emitter<
    [scrollX: number, scrollY: number, zoom: AppState["zoom"]]
  >();

  missingPointerEventCleanupEmitter = new Emitter<
    [event: PointerEvent | null]
  >();
  onRemoveEventListenersEmitter = new Emitter<[]>();

  defaultSelectionTool: "selection" | "lasso" = "selection";

  constructor(props: AppProps) {
    super(props);
    const defaultAppState = getDefaultAppState();
    this.defaultSelectionTool = this.isMobileOrTablet()
      ? ("lasso" as const)
      : ("selection" as const);
    const {
      excalidrawAPI,
      viewModeEnabled = false,
      zenModeEnabled = false,
      gridModeEnabled = false,
      objectsSnapModeEnabled = false,
      theme = defaultAppState.theme,
      name = `${t("labels.untitled")}-${getDateTime()}`,
    } = props;
    this.state = {
      ...defaultAppState,
      theme,
      isLoading: true,
      ...this.getCanvasOffsets(),
      viewModeEnabled,
      zenModeEnabled,
      objectsSnapModeEnabled,
      gridModeEnabled: gridModeEnabled ?? defaultAppState.gridModeEnabled,
      name,
      width: window.innerWidth,
      height: window.innerHeight,
    };

    this.id = nanoid();
    this.library = new Library(this);
    this.actionManager = new ActionManager(
      this.syncActionResult,
      () => this.state,
      () => this.scene.getElementsIncludingDeleted(),
      this,
    );
    this.scene = new Scene();

    this.canvas = document.createElement("canvas");
    this.rc = rough.canvas(this.canvas);
    this.renderer = new Renderer(this.scene);
    this.visibleElements = [];

    this.store = new Store(this);
    this.history = new History(this.store);

    if (excalidrawAPI) {
      const api: ExcalidrawImperativeAPI = {
        updateScene: this.updateScene,
        applyDeltas: this.applyDeltas,
        mutateElement: this.mutateElement,
        updateLibrary: this.library.updateLibrary,
        addFiles: this.addFiles,
        resetScene: this.resetScene,
        getSceneElementsIncludingDeleted: this.getSceneElementsIncludingDeleted,
        getSceneElementsMapIncludingDeleted:
          this.getSceneElementsMapIncludingDeleted,
        history: {
          clear: this.resetHistory,
        },
        scrollToContent: this.scrollToContent,
        getSceneElements: this.getSceneElements,
        getAppState: () => this.state,
        getFiles: () => this.files,
        getName: this.getName,
        registerAction: (action: Action) => {
          this.actionManager.registerAction(action);
        },
        refresh: this.refresh,
        setToast: this.setToast,
        id: this.id,
        setActiveTool: this.setActiveTool,
        setCursor: this.setCursor,
        resetCursor: this.resetCursor,
        updateFrameRendering: this.updateFrameRendering,
        toggleSidebar: this.toggleSidebar,
        onChange: (cb) => this.onChangeEmitter.on(cb),
        onIncrement: (cb) => this.store.onStoreIncrementEmitter.on(cb),
        onPointerDown: (cb) => this.onPointerDownEmitter.on(cb),
        onPointerUp: (cb) => this.onPointerUpEmitter.on(cb),
        onScrollChange: (cb) => this.onScrollChangeEmitter.on(cb),
        onUserFollow: (cb) => this.onUserFollowEmitter.on(cb),
      } as const;
      if (typeof excalidrawAPI === "function") {
        excalidrawAPI(api);
      } else {
        console.error("excalidrawAPI should be a function!");
      }
    }

    this.excalidrawContainerValue = {
      container: this.excalidrawContainerRef.current,
      id: this.id,
    };

    this.fonts = new Fonts(this.scene);
    this.history = new History(this.store);

    this.actionManager.registerAll(actions);
    this.actionManager.registerAction(createUndoAction(this.history));
    this.actionManager.registerAction(createRedoAction(this.history));
  }

  updateEditorAtom = <Value, Args extends unknown[], Result>(
    atom: WritableAtom<Value, Args, Result>,
    ...args: Args
  ): Result => {
    const result = editorJotaiStore.set(atom, ...args);
    this.triggerRender();
    return result;
  };

  private onWindowMessage(event: MessageEvent) {
    if (
      event.origin !== "https://player.vimeo.com" &&
      event.origin !== "https://www.youtube.com"
    ) {
      return;
    }

    let data = null;
    try {
      data = JSON.parse(event.data);
    } catch (e) {}
    if (!data) {
      return;
    }

    switch (event.origin) {
      case "https://player.vimeo.com":
        //Allowing for multiple instances of Excalidraw running in the window
        if (data.method === "paused") {
          let source: Window | null = null;
          const iframes = document.body.querySelectorAll(
            "iframe.excalidraw__embeddable",
          );
          if (!iframes) {
            break;
          }
          for (const iframe of iframes as NodeListOf<HTMLIFrameElement>) {
            if (iframe.contentWindow === event.source) {
              source = iframe.contentWindow;
            }
          }
          source?.postMessage(
            JSON.stringify({
              method: data.value ? "play" : "pause",
              value: true,
            }),
            "*",
          );
        }
        break;
      case "https://www.youtube.com":
        if (
          data.event === "infoDelivery" &&
          data.info &&
          data.id &&
          typeof data.info.playerState === "number"
        ) {
          const id = data.id;
          const playerState = data.info.playerState as number;
          if (
            (Object.values(YOUTUBE_STATES) as number[]).includes(playerState)
          ) {
            YOUTUBE_VIDEO_STATES.set(
              id,
              playerState as ValueOf<typeof YOUTUBE_STATES>,
            );
          }
        }
        break;
    }
  }

  private cacheEmbeddableRef(
    element: ExcalidrawIframeLikeElement,
    ref: HTMLIFrameElement | null,
  ) {
    if (ref) {
      this.iFrameRefs.set(element.id, ref);
    }
  }

  /**
   * Returns gridSize taking into account `gridModeEnabled`.
   * If disabled, returns null.
   */
  public getEffectiveGridSize = () => {
    return (
      isGridModeEnabled(this) ? this.state.gridSize : null
    ) as NullableGridSize;
  };

  private getHTMLIFrameElement(
    element: ExcalidrawIframeLikeElement,
  ): HTMLIFrameElement | undefined {
    return this.iFrameRefs.get(element.id);
  }

  private handleEmbeddableCenterClick(element: ExcalidrawIframeLikeElement) {
    if (
      this.state.activeEmbeddable?.element === element &&
      this.state.activeEmbeddable?.state === "active"
    ) {
      return;
    }

    // The delay serves two purposes
    // 1. To prevent first click propagating to iframe on mobile,
    //    else the click will immediately start and stop the video
    // 2. If the user double clicks the frame center to activate it
    //    without the delay youtube will immediately open the video
    //    in fullscreen mode
    setTimeout(() => {
      this.setState({
        activeEmbeddable: { element, state: "active" },
        selectedElementIds: { [element.id]: true },
        newElement: null,
        selectionElement: null,
      });
    }, 100);

    if (isIframeElement(element)) {
      return;
    }

    const iframe = this.getHTMLIFrameElement(element);

    if (!iframe?.contentWindow) {
      return;
    }

    if (iframe.src.includes("youtube")) {
      const state = YOUTUBE_VIDEO_STATES.get(element.id);
      if (!state) {
        YOUTUBE_VIDEO_STATES.set(element.id, YOUTUBE_STATES.UNSTARTED);
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event: "listening",
            id: element.id,
          }),
          "*",
        );
      }
      switch (state) {
        case YOUTUBE_STATES.PLAYING:
        case YOUTUBE_STATES.BUFFERING:
          iframe.contentWindow?.postMessage(
            JSON.stringify({
              event: "command",
              func: "pauseVideo",
              args: "",
            }),
            "*",
          );
          break;
        default:
          iframe.contentWindow?.postMessage(
            JSON.stringify({
              event: "command",
              func: "playVideo",
              args: "",
            }),
            "*",
          );
      }
    }

    if (iframe.src.includes("player.vimeo.com")) {
      iframe.contentWindow.postMessage(
        JSON.stringify({
          method: "paused", //video play/pause in onWindowMessage handler
        }),
        "*",
      );
    }
  }

  private isIframeLikeElementCenter(
    el: ExcalidrawIframeLikeElement | null,
    event: React.PointerEvent<HTMLElement> | PointerEvent,
    sceneX: number,
    sceneY: number,
  ) {
    return (
      el &&
      !event.altKey &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey &&
      (this.state.activeEmbeddable?.element !== el ||
        this.state.activeEmbeddable?.state === "hover" ||
        !this.state.activeEmbeddable) &&
      sceneX >= el.x + el.width / 3 &&
      sceneX <= el.x + (2 * el.width) / 3 &&
      sceneY >= el.y + el.height / 3 &&
      sceneY <= el.y + (2 * el.height) / 3
    );
  }

  private updateEmbedValidationStatus = (
    element: ExcalidrawEmbeddableElement,
    status: boolean,
  ) => {
    this.embedsValidationStatus.set(element.id, status);
    ShapeCache.delete(element);
  };

  private updateEmbeddables = () => {
    const iframeLikes = new Set<ExcalidrawIframeLikeElement["id"]>();

    let updated = false;
    this.scene.getNonDeletedElements().filter((element) => {
      if (isEmbeddableElement(element)) {
        iframeLikes.add(element.id);
        if (!this.embedsValidationStatus.has(element.id)) {
          updated = true;

          const validated = embeddableURLValidator(
            element.link,
            this.props.validateEmbeddable,
          );

          this.updateEmbedValidationStatus(element, validated);
        }
      } else if (isIframeElement(element)) {
        iframeLikes.add(element.id);
      }
      return false;
    });

    if (updated) {
      this.scene.triggerUpdate();
    }

    // GC
    this.iFrameRefs.forEach((ref, id) => {
      if (!iframeLikes.has(id)) {
        this.iFrameRefs.delete(id);
      }
    });
  };

  private renderEmbeddables() {
    const scale = this.state.zoom.value;
    const normalizedWidth = this.state.width;
    const normalizedHeight = this.state.height;

    const embeddableElements = this.scene
      .getNonDeletedElements()
      .filter(
        (el): el is Ordered<NonDeleted<ExcalidrawIframeLikeElement>> =>
          (isEmbeddableElement(el) &&
            this.embedsValidationStatus.get(el.id) === true) ||
          isIframeElement(el),
      );

    return (
      <>
        {embeddableElements.map((el) => {
          const { x, y } = sceneCoordsToViewportCoords(
            { sceneX: el.x, sceneY: el.y },
            this.state,
          );

          const isVisible = isElementInViewport(
            el,
            normalizedWidth,
            normalizedHeight,
            this.state,
            this.scene.getNonDeletedElementsMap(),
          );
          const hasBeenInitialized = this.initializedEmbeds.has(el.id);

          if (isVisible && !hasBeenInitialized) {
            this.initializedEmbeds.add(el.id);
          }
          const shouldRender = isVisible || hasBeenInitialized;

          if (!shouldRender) {
            return null;
          }

          let src: IframeData | null;

          if (isIframeElement(el)) {
            src = null;

            const data: MagicGenerationData = (el.customData?.generationData ??
              this.magicGenerations.get(el.id)) || {
              status: "error",
              message: "No generation data",
              code: "ERR_NO_GENERATION_DATA",
            };

            if (data.status === "done") {
              const html = data.html;
              src = {
                intrinsicSize: { w: el.width, h: el.height },
                type: "document",
                srcdoc: () => {
                  return html;
                },
              } as const;
            } else if (data.status === "pending") {
              src = {
                intrinsicSize: { w: el.width, h: el.height },
                type: "document",
                srcdoc: () => {
                  return createSrcDoc(`
                    <style>
                      html, body {
                        width: 100%;
                        height: 100%;
                        color: ${
                          this.state.theme === THEME.DARK ? "white" : "black"
                        };
                      }
                      body {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-direction: column;
                        gap: 1rem;
                      }

                      .Spinner {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-left: auto;
                        margin-right: auto;
                      }

                      .Spinner svg {
                        animation: rotate 1.6s linear infinite;
                        transform-origin: center center;
                        width: 40px;
                        height: 40px;
                      }

                      .Spinner circle {
                        stroke: currentColor;
                        animation: dash 1.6s linear 0s infinite;
                        stroke-linecap: round;
                      }

                      @keyframes rotate {
                        100% {
                          transform: rotate(360deg);
                        }
                      }

                      @keyframes dash {
                        0% {
                          stroke-dasharray: 1, 300;
                          stroke-dashoffset: 0;
                        }
                        50% {
                          stroke-dasharray: 150, 300;
                          stroke-dashoffset: -200;
                        }
                        100% {
                          stroke-dasharray: 1, 300;
                          stroke-dashoffset: -280;
                        }
                      }
                    </style>
                    <div class="Spinner">
                      <svg
                        viewBox="0 0 100 100"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="46"
                          stroke-width="8"
                          fill="none"
                          stroke-miter-limit="10"
                        />
                      </svg>
                    </div>
                    <div>Generating...</div>
                  `);
                },
              } as const;
            } else {
              let message: string;
              if (data.code === "ERR_GENERATION_INTERRUPTED") {
                message = "Generation was interrupted...";
              } else {
                message = data.message || "Generation failed";
              }
              src = {
                intrinsicSize: { w: el.width, h: el.height },
                type: "document",
                srcdoc: () => {
                  return createSrcDoc(`
                    <style>
                    html, body {
                      height: 100%;
                    }
                      body {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        color: ${COLOR_PALETTE.red[3]};
                      }
                      h1, h3 {
                        margin-top: 0;
                        margin-bottom: 0.5rem;
                      }
                    </style>
                    <h1>Error!</h1>
                    <h3>${message}</h3>
                  `);
                },
              } as const;
            }
          } else {
            src = getEmbedLink(toValidURL(el.link || ""));
          }

          const isActive =
            this.state.activeEmbeddable?.element === el &&
            this.state.activeEmbeddable?.state === "active";
          const isHovered =
            this.state.activeEmbeddable?.element === el &&
            this.state.activeEmbeddable?.state === "hover";

          return (
            <div
              key={el.id}
              className={clsx("excalidraw__embeddable-container", {
                "is-hovered": isHovered,
              })}
              style={{
                transform: isVisible
                  ? `translate(${x - this.state.offsetLeft}px, ${
                      y - this.state.offsetTop
                    }px) scale(${scale})`
                  : "none",
                display: isVisible ? "block" : "none",
                opacity: getRenderOpacity(
                  el,
                  getContainingFrame(el, this.scene.getNonDeletedElementsMap()),
                  this.elementsPendingErasure,
                  null,
                  this.state.openDialog?.name === "elementLinkSelector"
                    ? DEFAULT_REDUCED_GLOBAL_ALPHA
                    : 1,
                ),
                ["--embeddable-radius" as string]: `${getCornerRadius(
                  Math.min(el.width, el.height),
                  el,
                )}px`,
              }}
            >
              <div
                //this is a hack that addresses isse with embedded excalidraw.com embeddable
                //https://github.com/excalidraw/excalidraw/pull/6691#issuecomment-1607383938
                /*ref={(ref) => {
                  if (!this.excalidrawContainerRef.current) {
                    return;
                  }
                  const container = this.excalidrawContainerRef.current;
                  const sh = container.scrollHeight;
                  const ch = container.clientHeight;
                  if (sh !== ch) {
                    container.style.height = `${sh}px`;
                    setTimeout(() => {
                      container.style.height = `100%`;
                    });
                  }
                }}*/
                className="excalidraw__embeddable-container__inner"
                style={{
                  width: isVisible ? `${el.width}px` : 0,
                  height: isVisible ? `${el.height}px` : 0,
                  transform: isVisible ? `rotate(${el.angle}rad)` : "none",
                  pointerEvents: isActive
                    ? POINTER_EVENTS.enabled
                    : POINTER_EVENTS.disabled,
                }}
              >
                {isHovered && (
                  <div className="excalidraw__embeddable-hint">
                    {t("buttons.embeddableInteractionButton")}
                  </div>
                )}
                <div
                  className="excalidraw__embeddable__outer"
                  style={{
                    padding: `${el.strokeWidth}px`,
                  }}
                >
                  {(isEmbeddableElement(el)
                    ? this.props.renderEmbeddable?.(el, this.state)
                    : null) ?? (
                    <iframe
                      ref={(ref) => this.cacheEmbeddableRef(el, ref)}
                      className="excalidraw__embeddable"
                      srcDoc={
                        src?.type === "document"
                          ? src.srcdoc(this.state.theme)
                          : undefined
                      }
                      src={
                        src?.type !== "document" ? src?.link ?? "" : undefined
                      }
                      // https://stackoverflow.com/q/18470015
                      scrolling="no"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Excalidraw Embedded Content"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen={true}
                      sandbox={`${
                        src?.sandbox?.allowSameOrigin ? "allow-same-origin" : ""
                      } allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads`}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </>
    );
  }

  private getFrameNameDOMId = (frameElement: ExcalidrawElement) => {
    return `${this.id}-frame-name-${frameElement.id}`;
  };

  frameNameBoundsCache: FrameNameBoundsCache = {
    get: (frameElement) => {
      let bounds = this.frameNameBoundsCache._cache.get(frameElement.id);
      if (
        !bounds ||
        bounds.zoom !== this.state.zoom.value ||
        bounds.versionNonce !== frameElement.versionNonce
      ) {
        const frameNameDiv = document.getElementById(
          this.getFrameNameDOMId(frameElement),
        );

        if (frameNameDiv) {
          const box = frameNameDiv.getBoundingClientRect();
          const boxSceneTopLeft = viewportCoordsToSceneCoords(
            { clientX: box.x, clientY: box.y },
            this.state,
          );
          const boxSceneBottomRight = viewportCoordsToSceneCoords(
            { clientX: box.right, clientY: box.bottom },
            this.state,
          );

          bounds = {
            x: boxSceneTopLeft.x,
            y: boxSceneTopLeft.y,
            width: boxSceneBottomRight.x - boxSceneTopLeft.x,
            height: boxSceneBottomRight.y - boxSceneTopLeft.y,
            angle: 0,
            zoom: this.state.zoom.value,
            versionNonce: frameElement.versionNonce,
          };

          this.frameNameBoundsCache._cache.set(frameElement.id, bounds);

          return bounds;
        }
        return null;
      }

      return bounds;
    },
    /**
     * @private
     */
    _cache: new Map(),
  };

  private resetEditingFrame = (frame: ExcalidrawFrameLikeElement | null) => {
    if (frame) {
      this.scene.mutateElement(frame, { name: frame.name?.trim() || null });
    }
    this.setState({ editingFrame: null });
  };

  private renderFrameNames = () => {
    if (!this.state.frameRendering.enabled || !this.state.frameRendering.name) {
      if (this.state.editingFrame) {
        this.resetEditingFrame(null);
      }
      return null;
    }

    const isDarkTheme = this.state.theme === THEME.DARK;
    const nonDeletedFramesLikes = this.scene.getNonDeletedFramesLikes();

    const focusedSearchMatch =
      nonDeletedFramesLikes.length > 0
        ? this.state.searchMatches?.focusedId &&
          isFrameLikeElement(
            this.scene.getElement(this.state.searchMatches.focusedId),
          )
          ? this.state.searchMatches.matches.find((sm) => sm.focus)
          : null
        : null;

    return nonDeletedFramesLikes.map((f) => {
      if (
        !isElementInViewport(
          f,
          this.canvas.width / window.devicePixelRatio,
          this.canvas.height / window.devicePixelRatio,
          {
            offsetLeft: this.state.offsetLeft,
            offsetTop: this.state.offsetTop,
            scrollX: this.state.scrollX,
            scrollY: this.state.scrollY,
            zoom: this.state.zoom,
          },
          this.scene.getNonDeletedElementsMap(),
        )
      ) {
        if (this.state.editingFrame === f.id) {
          this.resetEditingFrame(f);
        }
        // if frame not visible, don't render its name
        return null;
      }

      const { x: x1, y: y1 } = sceneCoordsToViewportCoords(
        { sceneX: f.x, sceneY: f.y },
        this.state,
      );

      const FRAME_NAME_EDIT_PADDING = 6;

      let frameNameJSX;

      const frameName = getFrameLikeTitle(f);

      if (f.id === this.state.editingFrame) {
        const frameNameInEdit = frameName;

        frameNameJSX = (
          <input
            autoFocus
            value={frameNameInEdit}
            onChange={(e) => {
              this.scene.mutateElement(f, {
                name: e.target.value,
              });
            }}
            onFocus={(e) => e.target.select()}
            onBlur={() => this.resetEditingFrame(f)}
            onKeyDown={(event) => {
              // for some inexplicable reason, `onBlur` triggered on ESC
              // does not reset `state.editingFrame` despite being called,
              // and we need to reset it here as well
              if (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) {
                this.resetEditingFrame(f);
              }
            }}
            style={{
              background: this.state.viewBackgroundColor,
              filter: isDarkTheme ? THEME_FILTER : "none",
              zIndex: 2,
              border: "none",
              display: "block",
              padding: `${FRAME_NAME_EDIT_PADDING}px`,
              borderRadius: 4,
              boxShadow: "inset 0 0 0 1px var(--color-primary)",
              fontFamily: "Assistant",
              fontSize: `${FRAME_STYLE.nameFontSize}px`,
              transform: `translate(-${FRAME_NAME_EDIT_PADDING}px, ${FRAME_NAME_EDIT_PADDING}px)`,
              color: "var(--color-gray-80)",
              overflow: "hidden",
              maxWidth: `${
                document.body.clientWidth - x1 - FRAME_NAME_EDIT_PADDING
              }px`,
            }}
            size={frameNameInEdit.length + 1 || 1}
            dir="auto"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
          />
        );
      } else {
        frameNameJSX = frameName;
      }

      return (
        <div
          id={this.getFrameNameDOMId(f)}
          key={f.id}
          style={{
            position: "absolute",
            // Positioning from bottom so that we don't to either
            // calculate text height or adjust using transform (which)
            // messes up input position when editing the frame name.
            // This makes the positioning deterministic and we can calculate
            // the same position when rendering to canvas / svg.
            bottom: `${
              this.state.height +
              FRAME_STYLE.nameOffsetY -
              y1 +
              this.state.offsetTop
            }px`,
            left: `${x1 - this.state.offsetLeft}px`,
            zIndex: 2,
            fontSize: FRAME_STYLE.nameFontSize,
            color: isDarkTheme
              ? FRAME_STYLE.nameColorDarkTheme
              : FRAME_STYLE.nameColorLightTheme,
            lineHeight: FRAME_STYLE.nameLineHeight,
            width: "max-content",
            maxWidth:
              focusedSearchMatch?.id === f.id && focusedSearchMatch?.focus
                ? "none"
                : `${f.width * this.state.zoom.value}px`,
            overflow: f.id === this.state.editingFrame ? "visible" : "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            cursor: CURSOR_TYPE.MOVE,
            pointerEvents: this.state.viewModeEnabled
              ? POINTER_EVENTS.disabled
              : POINTER_EVENTS.enabled,
          }}
          onPointerDown={(event) => this.handleCanvasPointerDown(event)}
          onWheel={(event) => this.handleWheel(event)}
          onContextMenu={this.handleCanvasContextMenu}
          onDoubleClick={() => {
            this.setState({
              editingFrame: f.id,
            });
          }}
        >
          {frameNameJSX}
        </div>
      );
    });
  };

  private toggleOverscrollBehavior(event: React.PointerEvent) {
    // when pointer inside editor, disable overscroll behavior to prevent
    // panning to trigger history back/forward on MacOS Chrome
    document.documentElement.style.overscrollBehaviorX =
      event.type === "pointerenter" ? "none" : "auto";
  }

  public render() {
    const selectedElements = this.scene.getSelectedElements(this.state);
    const { renderTopRightUI, renderCustomStats } = this.props;

    const sceneNonce = this.scene.getSceneNonce();
    const { elementsMap, visibleElements } =
      this.renderer.getRenderableElements({
        sceneNonce,
        zoom: this.state.zoom,
        offsetLeft: this.state.offsetLeft,
        offsetTop: this.state.offsetTop,
        scrollX: this.state.scrollX,
        scrollY: this.state.scrollY,
        height: this.state.height,
        width: this.state.width,
        editingTextElement: this.state.editingTextElement,
        newElementId: this.state.newElement?.id,
      });
    this.visibleElements = visibleElements;

    const allElementsMap = this.scene.getNonDeletedElementsMap();

    const shouldBlockPointerEvents =
      // default back to `--ui-pointerEvents` flow if setPointerCapture
      // not supported
      "setPointerCapture" in HTMLElement.prototype
        ? false
        : this.state.selectionElement ||
          this.state.newElement ||
          this.state.selectedElementsAreBeingDragged ||
          this.state.resizingElement ||
          (this.state.activeTool.type === "laser" &&
            // technically we can just test on this once we make it more safe
            this.state.cursorButton === "down");

    const firstSelectedElement = selectedElements[0];

    const showShapeSwitchPanel =
      editorJotaiStore.get(convertElementTypePopupAtom)?.type === "panel";

    return (
      <div
        className={clsx("excalidraw excalidraw-container", {
          "excalidraw--view-mode":
            this.state.viewModeEnabled ||
            this.state.openDialog?.name === "elementLinkSelector",
          "excalidraw--mobile": this.device.editor.isMobile,
        })}
        style={{
          ["--ui-pointerEvents" as any]: shouldBlockPointerEvents
            ? POINTER_EVENTS.disabled
            : POINTER_EVENTS.enabled,
          ["--right-sidebar-width" as any]: "302px",
        }}
        ref={this.excalidrawContainerRef}
        onDrop={this.handleAppOnDrop}
        tabIndex={0}
        onKeyDown={
          this.props.handleKeyboardGlobally ? undefined : this.onKeyDown
        }
        onPointerEnter={this.toggleOverscrollBehavior}
        onPointerLeave={this.toggleOverscrollBehavior}
      >
        <AppContext.Provider value={this}>
          <AppPropsContext.Provider value={this.props}>
            <ExcalidrawContainerContext.Provider
              value={this.excalidrawContainerValue}
            >
              <DeviceContext.Provider value={this.device}>
                <ExcalidrawSetAppStateContext.Provider value={this.setAppState}>
                  <ExcalidrawAppStateContext.Provider value={this.state}>
                    <ExcalidrawElementsContext.Provider
                      value={this.scene.getNonDeletedElements()}
                    >
                      <ExcalidrawActionManagerContext.Provider
                        value={this.actionManager}
                      >
                        <LayerUI
                          canvas={this.canvas}
                          appState={this.state}
                          files={this.files}
                          setAppState={this.setAppState}
                          actionManager={this.actionManager}
                          elements={this.scene.getNonDeletedElements()}
                          onLockToggle={this.toggleLock}
                          onPenModeToggle={this.togglePenMode}
                          onHandToolToggle={this.onHandToolToggle}
                          langCode={getLanguage().code}
                          renderTopRightUI={renderTopRightUI}
                          renderCustomStats={renderCustomStats}
                          showExitZenModeBtn={
                            typeof this.props?.zenModeEnabled === "undefined" &&
                            this.state.zenModeEnabled
                          }
                          UIOptions={this.props.UIOptions}
                          onExportImage={this.onExportImage}
                          renderWelcomeScreen={
                            !this.state.isLoading &&
                            this.state.showWelcomeScreen &&
                            this.state.activeTool.type ===
                              this.defaultSelectionTool &&
                            !this.state.zenModeEnabled &&
                            !this.scene.getElementsIncludingDeleted().length
                          }
                          app={this}
                          isCollaborating={this.props.isCollaborating}
                          generateLinkForSelection={
                            this.props.generateLinkForSelection
                          }
                        >
                          {this.props.children}
                        </LayerUI>

                        <div className="excalidraw-textEditorContainer" />
                        <div className="excalidraw-contextMenuContainer" />
                        <div className="excalidraw-eye-dropper-container" />
                        <SVGLayer
                          trails={[
                            this.laserTrails,
                            this.lassoTrail,
                            this.eraserTrail,
                          ]}
                        />
                        {selectedElements.length === 1 &&
                          this.state.openDialog?.name !==
                            "elementLinkSelector" &&
                          this.state.showHyperlinkPopup && (
                            <Hyperlink
                              key={firstSelectedElement.id}
                              element={firstSelectedElement}
                              scene={this.scene}
                              setAppState={this.setAppState}
                              onLinkOpen={this.props.onLinkOpen}
                              setToast={this.setToast}
                              updateEmbedValidationStatus={
                                this.updateEmbedValidationStatus
                              }
                            />
                          )}
                        {this.props.aiEnabled !== false &&
                          selectedElements.length === 1 &&
                          isMagicFrameElement(firstSelectedElement) && (
                            <ElementCanvasButtons
                              element={firstSelectedElement}
                              elementsMap={elementsMap}
                            >
                              <ElementCanvasButton
                                title={t("labels.convertToCode")}
                                icon={MagicIcon}
                                checked={false}
                                onChange={() =>
                                  this.onMagicFrameGenerate(
                                    firstSelectedElement,
                                    "button",
                                  )
                                }
                              />
                            </ElementCanvasButtons>
                          )}
                        {selectedElements.length === 1 &&
                          isIframeElement(firstSelectedElement) &&
                          firstSelectedElement.customData?.generationData
                            ?.status === "done" && (
                            <ElementCanvasButtons
                              element={firstSelectedElement}
                              elementsMap={elementsMap}
                            >
                              <ElementCanvasButton
                                title={t("labels.copySource")}
                                icon={copyIcon}
                                checked={false}
                                onChange={() =>
                                  this.onIframeSrcCopy(firstSelectedElement)
                                }
                              />
                              <ElementCanvasButton
                                title="Enter fullscreen"
                                icon={fullscreenIcon}
                                checked={false}
                                onChange={() => {
                                  const iframe =
                                    this.getHTMLIFrameElement(
                                      firstSelectedElement,
                                    );
                                  if (iframe) {
                                    try {
                                      iframe.requestFullscreen();
                                      this.setState({
                                        activeEmbeddable: {
                                          element: firstSelectedElement,
                                          state: "active",
                                        },
                                        selectedElementIds: {
                                          [firstSelectedElement.id]: true,
                                        },
                                        newElement: null,
                                        selectionElement: null,
                                      });
                                    } catch (err: any) {
                                      console.warn(err);
                                      this.setState({
                                        errorMessage:
                                          "Couldn't enter fullscreen",
                                      });
                                    }
                                  }
                                }}
                              />
                            </ElementCanvasButtons>
                          )}

                        {this.state.toast !== null && (
                          <Toast
                            message={this.state.toast.message}
                            onClose={this.handleToastClose}
                            duration={this.state.toast.duration}
                            closable={this.state.toast.closable}
                          />
                        )}

                        {this.state.contextMenu && (
                          <ContextMenu
                            items={this.state.contextMenu.items}
                            top={this.state.contextMenu.top}
                            left={this.state.contextMenu.left}
                            actionManager={this.actionManager}
                            onClose={(callback) => {
                              this.setState({ contextMenu: null }, () => {
                                this.focusContainer();
                                callback?.();
                              });
                            }}
                          />
                        )}
                        <StaticCanvas
                          canvas={this.canvas}
                          rc={this.rc}
                          elementsMap={elementsMap}
                          allElementsMap={allElementsMap}
                          visibleElements={visibleElements}
                          sceneNonce={sceneNonce}
                          selectionNonce={
                            this.state.selectionElement?.versionNonce
                          }
                          scale={window.devicePixelRatio}
                          appState={this.state}
                          renderConfig={{
                            imageCache: this.imageCache,
                            isExporting: false,
                            renderGrid: isGridModeEnabled(this),
                            canvasBackgroundColor:
                              this.state.viewBackgroundColor,
                            embedsValidationStatus: this.embedsValidationStatus,
                            elementsPendingErasure: this.elementsPendingErasure,
                            pendingFlowchartNodes:
                              this.flowChartCreator.pendingNodes,
                          }}
                        />
                        {this.state.newElement && (
                          <NewElementCanvas
                            appState={this.state}
                            scale={window.devicePixelRatio}
                            rc={this.rc}
                            elementsMap={elementsMap}
                            allElementsMap={allElementsMap}
                            renderConfig={{
                              imageCache: this.imageCache,
                              isExporting: false,
                              renderGrid: false,
                              canvasBackgroundColor:
                                this.state.viewBackgroundColor,
                              embedsValidationStatus:
                                this.embedsValidationStatus,
                              elementsPendingErasure:
                                this.elementsPendingErasure,
                              pendingFlowchartNodes: null,
                            }}
                          />
                        )}
                        <InteractiveCanvas
                          containerRef={this.excalidrawContainerRef}
                          canvas={this.interactiveCanvas}
                          elementsMap={elementsMap}
                          visibleElements={visibleElements}
                          allElementsMap={allElementsMap}
                          selectedElements={selectedElements}
                          sceneNonce={sceneNonce}
                          selectionNonce={
                            this.state.selectionElement?.versionNonce
                          }
                          scale={window.devicePixelRatio}
                          appState={this.state}
                          renderScrollbars={
                            this.props.renderScrollbars === true
                          }
                          device={this.device}
                          renderInteractiveSceneCallback={
                            this.renderInteractiveSceneCallback
                          }
                          handleCanvasRef={this.handleInteractiveCanvasRef}
                          onContextMenu={this.handleCanvasContextMenu}
                          onPointerMove={this.handleCanvasPointerMove}
                          onPointerUp={this.handleCanvasPointerUp}
                          onPointerCancel={this.removePointer}
                          onTouchMove={this.handleTouchMove}
                          onPointerDown={this.handleCanvasPointerDown}
                          onDoubleClick={this.handleCanvasDoubleClick}
                        />
                        {this.state.userToFollow && (
                          <FollowMode
                            width={this.state.width}
                            height={this.state.height}
                            userToFollow={this.state.userToFollow}
                            onDisconnect={this.maybeUnfollowRemoteUser}
                          />
                        )}
                        {this.renderFrameNames()}
                        {this.state.activeLockedId && (
                          <UnlockPopup
                            app={this}
                            activeLockedId={this.state.activeLockedId}
                          />
                        )}
                        {showShapeSwitchPanel && (
                          <ConvertElementTypePopup app={this} />
                        )}
                      </ExcalidrawActionManagerContext.Provider>
                      {this.renderEmbeddables()}
                    </ExcalidrawElementsContext.Provider>
                  </ExcalidrawAppStateContext.Provider>
                </ExcalidrawSetAppStateContext.Provider>
              </DeviceContext.Provider>
            </ExcalidrawContainerContext.Provider>
          </AppPropsContext.Provider>
        </AppContext.Provider>
      </div>
    );
  }

  public focusContainer: AppClassProperties["focusContainer"] = () => {
    this.excalidrawContainerRef.current?.focus();
  };

  public getSceneElementsIncludingDeleted = () => {
    return this.scene.getElementsIncludingDeleted();
  };

  public getSceneElementsMapIncludingDeleted = () => {
    return this.scene.getElementsMapIncludingDeleted();
  };

  public getSceneElements = () => {
    return this.scene.getNonDeletedElements();
  };

  public onInsertElements = (elements: readonly ExcalidrawElement[]) => {
    this.addElementsFromPasteOrLibrary({
      elements,
      position: "center",
      files: null,
    });
  };

  public onExportImage = async (
    type: keyof typeof EXPORT_IMAGE_TYPES,
    elements: ExportedElements,
    opts: { exportingFrame: ExcalidrawFrameLikeElement | null },
  ) => {
    trackEvent("export", type, "ui");
    const fileHandle = await exportCanvas(
      type,
      elements,
      this.state,
      this.files,
      {
        exportBackground: this.state.exportBackground,
        name: this.getName(),
        viewBackgroundColor: this.state.viewBackgroundColor,
        exportingFrame: opts.exportingFrame,
      },
    )
      .catch(muteFSAbortError)
      .catch((error) => {
        console.error(error);
        this.setState({ errorMessage: error.message });
      });

    if (
      this.state.exportEmbedScene &&
      fileHandle &&
      isImageFileHandle(fileHandle)
    ) {
      this.setState({ fileHandle });
    }
  };

  private magicGenerations = new Map<
    ExcalidrawIframeElement["id"],
    MagicGenerationData
  >();

  private updateMagicGeneration = ({
    frameElement,
    data,
  }: {
    frameElement: ExcalidrawIframeElement;
    data: MagicGenerationData;
  }) => {
    if (data.status === "pending") {
      // We don't wanna persist pending state to storage. It should be in-app
      // state only.
      // Thus reset so that we prefer local cache (if there was some
      // generationData set previously)
      this.scene.mutateElement(
        frameElement,
        {
          customData: { generationData: undefined },
        },
        { informMutation: false, isDragging: false },
      );
    } else {
      this.scene.mutateElement(
        frameElement,
        {
          customData: { generationData: data },
        },
        { informMutation: false, isDragging: false },
      );
    }
    this.magicGenerations.set(frameElement.id, data);
    this.triggerRender();
  };

  public plugins: {
    diagramToCode?: {
      generate: GenerateDiagramToCode;
    };
  } = {};

  public setPlugins(plugins: Partial<App["plugins"]>) {
    Object.assign(this.plugins, plugins);
  }

  private async onMagicFrameGenerate(
    magicFrame: ExcalidrawMagicFrameElement,
    source: "button" | "upstream",
  ) {
    const generateDiagramToCode = this.plugins.diagramToCode?.generate;

    if (!generateDiagramToCode) {
      this.setState({
        errorMessage: "No diagram to code plugin found",
      });
      return;
    }

    const magicFrameChildren = getElementsOverlappingFrame(
      this.scene.getNonDeletedElements(),
      magicFrame,
    ).filter((el) => !isMagicFrameElement(el));

    if (!magicFrameChildren.length) {
      if (source === "button") {
        this.setState({ errorMessage: "Cannot generate from an empty frame" });
        trackEvent("ai", "generate (no-children)", "d2c");
      } else {
        this.setActiveTool({ type: "magicframe" });
      }
      return;
    }

    const frameElement = this.insertIframeElement({
      sceneX: magicFrame.x + magicFrame.width + 30,
      sceneY: magicFrame.y,
      width: magicFrame.width,
      height: magicFrame.height,
    });

    if (!frameElement) {
      return;
    }

    this.updateMagicGeneration({
      frameElement,
      data: { status: "pending" },
    });

    this.setState({
      selectedElementIds: { [frameElement.id]: true },
    });

    trackEvent("ai", "generate (start)", "d2c");
    try {
      const { html } = await generateDiagramToCode({
        frame: magicFrame,
        children: magicFrameChildren,
      });

      trackEvent("ai", "generate (success)", "d2c");

      if (!html.trim()) {
        this.updateMagicGeneration({
          frameElement,
          data: {
            status: "error",
            code: "ERR_OAI",
            message: "Nothing genereated :(",
          },
        });
        return;
      }

      const parsedHtml =
        html.includes("<!DOCTYPE html>") && html.includes("</html>")
          ? html.slice(
              html.indexOf("<!DOCTYPE html>"),
              html.indexOf("</html>") + "</html>".length,
            )
          : html;

      this.updateMagicGeneration({
        frameElement,
        data: { status: "done", html: parsedHtml },
      });
    } catch (error: any) {
      trackEvent("ai", "generate (failed)", "d2c");
      this.updateMagicGeneration({
        frameElement,
        data: {
          status: "error",
          code: "ERR_OAI",
          message: error.message || "Unknown error during generation",
        },
      });
    }
  }

  private onIframeSrcCopy(element: ExcalidrawIframeElement) {
    if (element.customData?.generationData?.status === "done") {
      copyTextToSystemClipboard(element.customData.generationData.html);
      this.setToast({
        message: "copied to clipboard",
        closable: false,
        duration: 1500,
      });
    }
  }

  public onMagicframeToolSelect = () => {
    const selectedElements = this.scene.getSelectedElements({
      selectedElementIds: this.state.selectedElementIds,
    });

    if (selectedElements.length === 0) {
      this.setActiveTool({ type: TOOL_TYPE.magicframe });
      trackEvent("ai", "tool-select (empty-selection)", "d2c");
    } else {
      const selectedMagicFrame: ExcalidrawMagicFrameElement | false =
        selectedElements.length === 1 &&
        isMagicFrameElement(selectedElements[0]) &&
        selectedElements[0];

      // case: user selected elements containing frame-like(s) or are frame
      // members, we don't want to wrap into another magicframe
      // (unless the only selected element is a magic frame which we reuse)
      if (
        !selectedMagicFrame &&
        selectedElements.some((el) => isFrameLikeElement(el) || el.frameId)
      ) {
        this.setActiveTool({ type: TOOL_TYPE.magicframe });
        return;
      }

      trackEvent("ai", "tool-select (existing selection)", "d2c");

      let frame: ExcalidrawMagicFrameElement;
      if (selectedMagicFrame) {
        // a single magicframe already selected -> use it
        frame = selectedMagicFrame;
      } else {
        // selected elements aren't wrapped in magic frame yet -> wrap now

        const [minX, minY, maxX, maxY] = getCommonBounds(selectedElements);
        const padding = 50;

        frame = newMagicFrameElement({
          ...FRAME_STYLE,
          x: minX - padding,
          y: minY - padding,
          width: maxX - minX + padding * 2,
          height: maxY - minY + padding * 2,
          opacity: 100,
          locked: false,
        });

        this.scene.insertElement(frame);

        for (const child of selectedElements) {
          this.scene.mutateElement(child, { frameId: frame.id });
        }

        this.setState({
          selectedElementIds: { [frame.id]: true },
        });
      }

      this.onMagicFrameGenerate(frame, "upstream");
    }
  };

  private openEyeDropper = ({ type }: { type: "stroke" | "background" }) => {
    this.updateEditorAtom(activeEyeDropperAtom, {
      swapPreviewOnAlt: true,
      colorPickerType:
        type === "stroke" ? "elementStroke" : "elementBackground",
      onSelect: (color, event) => {
        const shouldUpdateStrokeColor =
          (type === "background" && event.altKey) ||
          (type === "stroke" && !event.altKey);
        const selectedElements = this.scene.getSelectedElements(this.state);
        if (
          !selectedElements.length ||
          this.state.activeTool.type !== "selection"
        ) {
          if (shouldUpdateStrokeColor) {
            this.syncActionResult({
              appState: { ...this.state, currentItemStrokeColor: color },
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
          } else {
            this.syncActionResult({
              appState: { ...this.state, currentItemBackgroundColor: color },
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
          }
        } else {
          this.updateScene({
            elements: this.scene.getElementsIncludingDeleted().map((el) => {
              if (this.state.selectedElementIds[el.id]) {
                return newElementWith(el, {
                  [shouldUpdateStrokeColor ? "strokeColor" : "backgroundColor"]:
                    color,
                });
              }
              return el;
            }),
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });
        }
      },
      keepOpenOnAlt: false,
    });
  };

  public dismissLinearEditor = () => {
    setTimeout(() => {
      if (this.state.selectedLinearElement?.isEditing) {
        this.setState({
          selectedLinearElement: {
            ...this.state.selectedLinearElement,
            isEditing: false,
          },
        });
      }
    });
  };

  public syncActionResult = withBatchedUpdates((actionResult: ActionResult) => {
    if (this.unmounted || actionResult === false) {
      return;
    }

    this.store.scheduleAction(actionResult.captureUpdate);

    let didUpdate = false;

    let editingTextElement: AppState["editingTextElement"] | null = null;
    if (actionResult.elements) {
      this.scene.replaceAllElements(actionResult.elements);
      didUpdate = true;
    }

    if (actionResult.files) {
      this.addMissingFiles(actionResult.files, actionResult.replaceFiles);
      this.addNewImagesToImageCache();
    }

    if (actionResult.appState || editingTextElement || this.state.contextMenu) {
      let viewModeEnabled = actionResult?.appState?.viewModeEnabled || false;
      let zenModeEnabled = actionResult?.appState?.zenModeEnabled || false;
      const theme =
        actionResult?.appState?.theme || this.props.theme || THEME.LIGHT;
      const name = actionResult?.appState?.name ?? this.state.name;
      const errorMessage =
        actionResult?.appState?.errorMessage ?? this.state.errorMessage;
      if (typeof this.props.viewModeEnabled !== "undefined") {
        viewModeEnabled = this.props.viewModeEnabled;
      }

      if (typeof this.props.zenModeEnabled !== "undefined") {
        zenModeEnabled = this.props.zenModeEnabled;
      }

      editingTextElement = actionResult.appState?.editingTextElement || null;

      // make sure editingTextElement points to latest element reference
      if (actionResult.elements && editingTextElement) {
        actionResult.elements.forEach((element) => {
          if (
            editingTextElement?.id === element.id &&
            editingTextElement !== element &&
            isNonDeletedElement(element) &&
            isTextElement(element)
          ) {
            editingTextElement = element;
          }
        });
      }

      if (editingTextElement?.isDeleted) {
        editingTextElement = null;
      }

      this.setState((prevAppState) => {
        const actionAppState = actionResult.appState || {};

        return {
          ...prevAppState,
          ...actionAppState,
          // NOTE this will prevent opening context menu using an action
          // or programmatically from the host, so it will need to be
          // rewritten later
          contextMenu: null,
          editingTextElement,
          viewModeEnabled,
          zenModeEnabled,
          theme,
          name,
          errorMessage,
        };
      });

      didUpdate = true;
    }

    if (!didUpdate) {
      this.scene.triggerUpdate();
    }
  });

  // Lifecycle

  private onBlur = withBatchedUpdates(() => {
    isHoldingSpace = false;
    this.setState({ isBindingEnabled: true });
  });

  private onUnload = () => {
    this.onBlur();
  };

  private disableEvent: EventListener = (event) => {
    event.preventDefault();
  };

  private resetHistory = () => {
    this.history.clear();
  };

  private resetStore = () => {
    this.store.clear();
  };

  /**
   * Resets scene & history.
   * ! Do not use to clear scene user action !
   */
  private resetScene = withBatchedUpdates(
    (opts?: { resetLoadingState: boolean }) => {
      this.scene.replaceAllElements([]);
      this.setState((state) => ({
        ...getDefaultAppState(),
        isLoading: opts?.resetLoadingState ? false : state.isLoading,
        theme: this.state.theme,
      }));
      this.resetStore();
      this.resetHistory();
    },
  );

  private initializeScene = async () => {
    if ("launchQueue" in window && "LaunchParams" in window) {
      (window as any).launchQueue.setConsumer(
        async (launchParams: { files: any[] }) => {
          if (!launchParams.files.length) {
            return;
          }
          const fileHandle = launchParams.files[0];
          const blob: Blob = await fileHandle.getFile();
          this.loadFileToCanvas(
            new File([blob], blob.name || "", { type: blob.type }),
            fileHandle,
          );
        },
      );
    }

    if (this.props.theme) {
      this.setState({ theme: this.props.theme });
    }
    if (!this.state.isLoading) {
      this.setState({ isLoading: true });
    }
    let initialData = null;
    try {
      if (typeof this.props.initialData === "function") {
        initialData = (await this.props.initialData()) || null;
      } else {
        initialData = (await this.props.initialData) || null;
      }
      if (initialData?.libraryItems) {
        this.library
          .updateLibrary({
            libraryItems: initialData.libraryItems,
            merge: true,
          })
          .catch((error) => {
            console.error(error);
          });
      }
    } catch (error: any) {
      console.error(error);
      initialData = {
        appState: {
          errorMessage:
            error.message ||
            "Encountered an error during importing or restoring scene data",
        },
      };
    }
    const scene = restore(initialData, null, null, {
      repairBindings: true,
      deleteInvisibleElements: true,
    });
    const activeTool = scene.appState.activeTool;
    scene.appState = {
      ...scene.appState,
      theme: this.props.theme || scene.appState.theme,
      // we're falling back to current (pre-init) state when deciding
      // whether to open the library, to handle a case where we
      // update the state outside of initialData (e.g. when loading the app
      // with a library install link, which should auto-open the library)
      openSidebar: scene.appState?.openSidebar || this.state.openSidebar,
      activeTool:
        activeTool.type === "image" ||
        activeTool.type === "lasso" ||
        activeTool.type === "selection"
          ? {
              ...activeTool,
              type: this.defaultSelectionTool,
            }
          : scene.appState.activeTool,
      isLoading: false,
      toast: this.state.toast,
    };
    if (initialData?.scrollToContent) {
      scene.appState = {
        ...scene.appState,
        ...calculateScrollCenter(scene.elements, {
          ...scene.appState,
          width: this.state.width,
          height: this.state.height,
          offsetTop: this.state.offsetTop,
          offsetLeft: this.state.offsetLeft,
        }),
      };
    }

    this.resetStore();
    this.resetHistory();
    this.syncActionResult({
      ...scene,
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    // clear the shape and image cache so that any images in initialData
    // can be loaded fresh
    this.clearImageShapeCache();

    // manually loading the font faces seems faster even in browsers that do fire the loadingdone event
    this.fonts.loadSceneFonts().then((fontFaces) => {
      this.fonts.onLoaded(fontFaces);
    });

    if (isElementLink(window.location.href)) {
      this.scrollToContent(window.location.href, { animate: false });
    }
  };

  private isMobileOrTablet = (): boolean => {
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const hasCoarsePointer =
      "matchMedia" in window &&
      window?.matchMedia("(pointer: coarse)")?.matches;
    const isTouchMobile = hasTouch && hasCoarsePointer;

    return isMobile || isTouchMobile;
  };

  private isMobileBreakpoint = (width: number, height: number) => {
    return (
      width < MQ_MAX_WIDTH_PORTRAIT ||
      (height < MQ_MAX_HEIGHT_LANDSCAPE && width < MQ_MAX_WIDTH_LANDSCAPE)
    );
  };

  private refreshViewportBreakpoints = () => {
    const container = this.excalidrawContainerRef.current;
    if (!container) {
      return;
    }

    const { clientWidth: viewportWidth, clientHeight: viewportHeight } =
      document.body;

    const prevViewportState = this.device.viewport;

    const nextViewportState = updateObject(prevViewportState, {
      isLandscape: viewportWidth > viewportHeight,
      isMobile: this.isMobileBreakpoint(viewportWidth, viewportHeight),
    });

    if (prevViewportState !== nextViewportState) {
      this.device = { ...this.device, viewport: nextViewportState };
      return true;
    }
    return false;
  };

  private refreshEditorBreakpoints = () => {
    const container = this.excalidrawContainerRef.current;
    if (!container) {
      return;
    }

    const { width: editorWidth, height: editorHeight } =
      container.getBoundingClientRect();

    const sidebarBreakpoint =
      this.props.UIOptions.dockedSidebarBreakpoint != null
        ? this.props.UIOptions.dockedSidebarBreakpoint
        : MQ_RIGHT_SIDEBAR_MIN_WIDTH;

    const prevEditorState = this.device.editor;

    const nextEditorState = updateObject(prevEditorState, {
      isMobile: this.isMobileBreakpoint(editorWidth, editorHeight),
      canFitSidebar: editorWidth > sidebarBreakpoint,
    });

    if (prevEditorState !== nextEditorState) {
      this.device = { ...this.device, editor: nextEditorState };
      return true;
    }
    return false;
  };

  private clearImageShapeCache(filesMap?: BinaryFiles) {
    const files = filesMap ?? this.files;
    this.scene.getNonDeletedElements().forEach((element) => {
      if (isInitializedImageElement(element) && files[element.fileId]) {
        this.imageCache.delete(element.fileId);
        ShapeCache.delete(element);
      }
    });
  }

  public async componentDidMount() {
    this.unmounted = false;
    this.excalidrawContainerValue.container =
      this.excalidrawContainerRef.current;

    if (isTestEnv() || isDevEnv()) {
      const setState = this.setState.bind(this);
      Object.defineProperties(window.h, {
        state: {
          configurable: true,
          get: () => {
            return this.state;
          },
        },
        setState: {
          configurable: true,
          value: (...args: Parameters<typeof setState>) => {
            return this.setState(...args);
          },
        },
        app: {
          configurable: true,
          value: this,
        },
        history: {
          configurable: true,
          value: this.history,
        },
        store: {
          configurable: true,
          value: this.store,
        },
        fonts: {
          configurable: true,
          value: this.fonts,
        },
      });
    }

    this.store.onDurableIncrementEmitter.on((increment) => {
      this.history.record(increment.delta);
    });

    const { onIncrement } = this.props;

    // per. optimmisation, only subscribe if there is the `onIncrement` prop registered, to avoid unnecessary computation
    if (onIncrement) {
      this.store.onStoreIncrementEmitter.on((increment) => {
        onIncrement(increment);
      });
    }

    this.scene.onUpdate(this.triggerRender);
    this.addEventListeners();

    if (this.props.autoFocus && this.excalidrawContainerRef.current) {
      this.focusContainer();
    }

    if (
      // bounding rects don't work in tests so updating
      // the state on init would result in making the test enviro run
      // in mobile breakpoint (0 width/height), making everything fail
      !isTestEnv()
    ) {
      this.refreshViewportBreakpoints();
      this.refreshEditorBreakpoints();
    }

    if (supportsResizeObserver && this.excalidrawContainerRef.current) {
      this.resizeObserver = new ResizeObserver(() => {
        this.refreshEditorBreakpoints();
        this.updateDOMRect();
      });
      this.resizeObserver?.observe(this.excalidrawContainerRef.current);
    }

    const searchParams = new URLSearchParams(window.location.search.slice(1));

    if (searchParams.has("web-share-target")) {
      // Obtain a file that was shared via the Web Share Target API.
      this.restoreFileFromShare();
    } else {
      this.updateDOMRect(this.initializeScene);
    }

    // note that this check seems to always pass in localhost
    if (isBrave() && !isMeasureTextSupported()) {
      this.setState({
        errorMessage: <BraveMeasureTextError />,
      });
    }
  }

  public componentWillUnmount() {
    (window as any).launchQueue?.setConsumer(() => {});
    this.renderer.destroy();
    this.scene.destroy();
    this.scene = new Scene();
    this.fonts = new Fonts(this.scene);
    this.renderer = new Renderer(this.scene);
    this.files = {};
    this.imageCache.clear();
    this.resizeObserver?.disconnect();
    this.unmounted = true;
    this.removeEventListeners();
    this.library.destroy();
    this.laserTrails.stop();
    this.eraserTrail.stop();
    this.onChangeEmitter.clear();
    this.store.onStoreIncrementEmitter.clear();
    this.store.onDurableIncrementEmitter.clear();
    ShapeCache.destroy();
    SnapCache.destroy();
    clearTimeout(touchTimeout);
    isSomeElementSelected.clearCache();
    selectGroupsForSelectedElements.clearCache();
    touchTimeout = 0;
    document.documentElement.style.overscrollBehaviorX = "";
  }

  private onResize = withBatchedUpdates(() => {
    this.scene
      .getElementsIncludingDeleted()
      .forEach((element) => ShapeCache.delete(element));
    this.refreshViewportBreakpoints();
    this.updateDOMRect();
    if (!supportsResizeObserver) {
      this.refreshEditorBreakpoints();
    }
    this.setState({});
  });

  /** generally invoked only if fullscreen was invoked programmatically */
  private onFullscreenChange = () => {
    if (
      // points to the iframe element we fullscreened
      !document.fullscreenElement &&
      this.state.activeEmbeddable?.state === "active"
    ) {
      this.setState({
        activeEmbeddable: null,
      });
    }
  };

  private removeEventListeners() {
    this.onRemoveEventListenersEmitter.trigger();
  }

  private addEventListeners() {
    // remove first as we can add event listeners multiple times
    this.removeEventListeners();

    // -------------------------------------------------------------------------
    //                        view+edit mode listeners
    // -------------------------------------------------------------------------

    if (this.props.handleKeyboardGlobally) {
      this.onRemoveEventListenersEmitter.once(
        addEventListener(document, EVENT.KEYDOWN, this.onKeyDown, false),
      );
    }

    this.onRemoveEventListenersEmitter.once(
      addEventListener(
        this.excalidrawContainerRef.current,
        EVENT.WHEEL,
        this.handleWheel,
        { passive: false },
      ),
      addEventListener(window, EVENT.MESSAGE, this.onWindowMessage, false),
      addEventListener(document, EVENT.POINTER_UP, this.removePointer, {
        passive: false,
      }), // #3553
      addEventListener(document, EVENT.COPY, this.onCopy, { passive: false }),
      addEventListener(document, EVENT.KEYUP, this.onKeyUp, { passive: true }),
      addEventListener(
        document,
        EVENT.POINTER_MOVE,
        this.updateCurrentCursorPosition,
        { passive: false },
      ),
      // rerender text elements on font load to fix #637 && #1553
      addEventListener(
        document.fonts,
        "loadingdone",
        (event) => {
          const fontFaces = (event as FontFaceSetLoadEvent).fontfaces;
          this.fonts.onLoaded(fontFaces);
        },
        { passive: false },
      ),
      // Safari-only desktop pinch zoom
      addEventListener(
        document,
        EVENT.GESTURE_START,
        this.onGestureStart as any,
        false,
      ),
      addEventListener(
        document,
        EVENT.GESTURE_CHANGE,
        this.onGestureChange as any,
        false,
      ),
      addEventListener(
        document,
        EVENT.GESTURE_END,
        this.onGestureEnd as any,
        false,
      ),
      addEventListener(
        window,
        EVENT.FOCUS,
        () => {
          this.maybeCleanupAfterMissingPointerUp(null);
          // browsers (chrome?) tend to free up memory a lot, which results
          // in canvas context being cleared. Thus re-render on focus.
          this.triggerRender(true);
        },
        { passive: false },
      ),
    );

    if (this.state.viewModeEnabled) {
      return;
    }

    // -------------------------------------------------------------------------
    //                        edit-mode listeners only
    // -------------------------------------------------------------------------

    this.onRemoveEventListenersEmitter.once(
      addEventListener(
        document,
        EVENT.FULLSCREENCHANGE,
        this.onFullscreenChange,
        { passive: false },
      ),
      addEventListener(document, EVENT.PASTE, this.pasteFromClipboard, {
        passive: false,
      }),
      addEventListener(document, EVENT.CUT, this.onCut, { passive: false }),
      addEventListener(window, EVENT.RESIZE, this.onResize, false),
      addEventListener(window, EVENT.UNLOAD, this.onUnload, false),
      addEventListener(window, EVENT.BLUR, this.onBlur, false),
      addEventListener(
        this.excalidrawContainerRef.current,
        EVENT.WHEEL,
        this.handleWheel,
        { passive: false },
      ),
      addEventListener(
        this.excalidrawContainerRef.current,
        EVENT.DRAG_OVER,
        this.disableEvent,
        false,
      ),
      addEventListener(
        this.excalidrawContainerRef.current,
        EVENT.DROP,
        this.disableEvent,
        false,
      ),
    );

    if (this.props.detectScroll) {
      this.onRemoveEventListenersEmitter.once(
        addEventListener(
          getNearestScrollableContainer(this.excalidrawContainerRef.current!),
          EVENT.SCROLL,
          this.onScroll,
          { passive: false },
        ),
      );
    }
  }

  componentDidUpdate(prevProps: AppProps, prevState: AppState) {
    this.updateEmbeddables();
    const elements = this.scene.getElementsIncludingDeleted();
    const elementsMap = this.scene.getElementsMapIncludingDeleted();

    if (!this.state.showWelcomeScreen && !elements.length) {
      this.setState({ showWelcomeScreen: true });
    }

    if (
      prevProps.UIOptions.dockedSidebarBreakpoint !==
      this.props.UIOptions.dockedSidebarBreakpoint
    ) {
      this.refreshEditorBreakpoints();
    }

    const hasFollowedPersonLeft =
      prevState.userToFollow &&
      !this.state.collaborators.has(prevState.userToFollow.socketId);

    if (hasFollowedPersonLeft) {
      this.maybeUnfollowRemoteUser();
    }

    if (
      prevState.zoom.value !== this.state.zoom.value ||
      prevState.scrollX !== this.state.scrollX ||
      prevState.scrollY !== this.state.scrollY
    ) {
      this.props?.onScrollChange?.(
        this.state.scrollX,
        this.state.scrollY,
        this.state.zoom,
      );
      this.onScrollChangeEmitter.trigger(
        this.state.scrollX,
        this.state.scrollY,
        this.state.zoom,
      );
    }

    if (prevState.userToFollow !== this.state.userToFollow) {
      if (prevState.userToFollow) {
        this.onUserFollowEmitter.trigger({
          userToFollow: prevState.userToFollow,
          action: "UNFOLLOW",
        });
      }

      if (this.state.userToFollow) {
        this.onUserFollowEmitter.trigger({
          userToFollow: this.state.userToFollow,
          action: "FOLLOW",
        });
      }
    }

    if (
      Object.keys(this.state.selectedElementIds).length &&
      isEraserActive(this.state)
    ) {
      this.setState({
        activeTool: updateActiveTool(this.state, { type: "selection" }),
      });
    }
    if (
      this.state.activeTool.type === "eraser" &&
      prevState.theme !== this.state.theme
    ) {
      setEraserCursor(this.interactiveCanvas, this.state.theme);
    }
    // Hide hyperlink popup if shown when element type is not selection
    if (
      prevState.activeTool.type === "selection" &&
      this.state.activeTool.type !== "selection" &&
      this.state.showHyperlinkPopup
    ) {
      this.setState({ showHyperlinkPopup: false });
    }
    if (prevProps.langCode !== this.props.langCode) {
      this.updateLanguage();
    }

    if (isEraserActive(prevState) && !isEraserActive(this.state)) {
      this.eraserTrail.endPath();
    }

    if (prevProps.viewModeEnabled !== this.props.viewModeEnabled) {
      this.setState({ viewModeEnabled: !!this.props.viewModeEnabled });
    }

    if (prevState.viewModeEnabled !== this.state.viewModeEnabled) {
      this.addEventListeners();
      this.deselectElements();
    }

    // cleanup
    if (
      (prevState.openDialog?.name === "elementLinkSelector" ||
        this.state.openDialog?.name === "elementLinkSelector") &&
      prevState.openDialog?.name !== this.state.openDialog?.name
    ) {
      this.deselectElements();
      this.setState({
        hoveredElementIds: {},
      });
    }

    if (prevProps.zenModeEnabled !== this.props.zenModeEnabled) {
      this.setState({ zenModeEnabled: !!this.props.zenModeEnabled });
    }

    if (prevProps.theme !== this.props.theme && this.props.theme) {
      this.setState({ theme: this.props.theme });
    }

    this.excalidrawContainerRef.current?.classList.toggle(
      "theme--dark",
      this.state.theme === THEME.DARK,
    );

    if (
      this.state.selectedLinearElement?.isEditing &&
      !this.state.selectedElementIds[this.state.selectedLinearElement.elementId]
    ) {
      // defer so that the scheduleCapture flag isn't reset via current update
      setTimeout(() => {
        // execute only if the condition still holds when the deferred callback
        // executes (it can be scheduled multiple times depending on how
        // many times the component renders)
        this.state.selectedLinearElement?.isEditing &&
          this.actionManager.executeAction(actionFinalize);
      });
    }

    // failsafe in case the state is being updated in incorrect order resulting
    // in the editingTextElement being now a deleted element
    if (this.state.editingTextElement?.isDeleted) {
      this.setState({ editingTextElement: null });
    }

    if (
      this.state.selectedLinearElement &&
      !this.state.selectedElementIds[this.state.selectedLinearElement.elementId]
    ) {
      // To make sure `selectedLinearElement` is in sync with `selectedElementIds`, however this shouldn't be needed once
      // we have a single API to update `selectedElementIds`
      this.setState({ selectedLinearElement: null });
    }

    this.store.commit(elementsMap, this.state);

    // Do not notify consumers if we're still loading the scene. Among other
    // potential issues, this fixes a case where the tab isn't focused during
    // init, which would trigger onChange with empty elements, which would then
    // override whatever is in localStorage currently.
    if (!this.state.isLoading) {
      this.props.onChange?.(elements, this.state, this.files);
      this.onChangeEmitter.trigger(elements, this.state, this.files);
    }
  }

  private renderInteractiveSceneCallback = ({
    atLeastOneVisibleElement,
    scrollBars,
    elementsMap,
  }: RenderInteractiveSceneCallback) => {
    if (scrollBars) {
      currentScrollBars = scrollBars;
    }
    const scrolledOutside =
      // hide when editing text
      this.state.editingTextElement
        ? false
        : !atLeastOneVisibleElement && elementsMap.size > 0;
    if (this.state.scrolledOutside !== scrolledOutside) {
      this.setState({ scrolledOutside });
    }

    this.scheduleImageRefresh();
  };

  private onScroll = debounce(() => {
    const { offsetTop, offsetLeft } = this.getCanvasOffsets();
    this.setState((state) => {
      if (state.offsetLeft === offsetLeft && state.offsetTop === offsetTop) {
        return null;
      }
      return { offsetTop, offsetLeft };
    });
  }, SCROLL_TIMEOUT);

  // Copy/paste

  private onCut = withBatchedUpdates((event: ClipboardEvent) => {
    const isExcalidrawActive = this.excalidrawContainerRef.current?.contains(
      document.activeElement,
    );
    if (!isExcalidrawActive || isWritableElement(event.target)) {
      return;
    }
    this.actionManager.executeAction(actionCut, "keyboard", event);
    event.preventDefault();
    event.stopPropagation();
  });

  private onCopy = withBatchedUpdates((event: ClipboardEvent) => {
    const isExcalidrawActive = this.excalidrawContainerRef.current?.contains(
      document.activeElement,
    );
    if (!isExcalidrawActive || isWritableElement(event.target)) {
      return;
    }
    this.actionManager.executeAction(actionCopy, "keyboard", event);
    event.preventDefault();
    event.stopPropagation();
  });

  private static resetTapTwice() {
    didTapTwice = false;
    firstTapPosition = null;
  }

  private onTouchStart = (event: TouchEvent) => {
    // fix for Apple Pencil Scribble (do not prevent for other devices)
    if (isIOS) {
      event.preventDefault();
    }

    if (!didTapTwice) {
      didTapTwice = true;

      if (event.touches.length === 1) {
        firstTapPosition = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
      }
      clearTimeout(tappedTwiceTimer);
      tappedTwiceTimer = window.setTimeout(
        App.resetTapTwice,
        TAP_TWICE_TIMEOUT,
      );
      return;
    }

    // insert text only if we tapped twice with a single finger at approximately the same position
    // event.touches.length === 1 will also prevent inserting text when user's zooming
    if (didTapTwice && event.touches.length === 1 && firstTapPosition) {
      const touch = event.touches[0];
      const distance = pointDistance(
        pointFrom(touch.clientX, touch.clientY),
        pointFrom(firstTapPosition.x, firstTapPosition.y),
      );

      // only create text if the second tap is within the threshold of the first tap
      // this prevents accidental text creation during dragging/selection
      if (distance <= DOUBLE_TAP_POSITION_THRESHOLD) {
        // end lasso trail and deselect elements just in case
        this.lassoTrail.endPath();
        this.deselectElements();

        // @ts-ignore
        this.handleCanvasDoubleClick({
          clientX: touch.clientX,
          clientY: touch.clientY,
        });
      }
      didTapTwice = false;
      clearTimeout(tappedTwiceTimer);
    }

    if (event.touches.length === 2) {
      this.setState({
        selectedElementIds: makeNextSelectedElementIds({}, this.state),
        activeEmbeddable: null,
      });
    }
  };

  private onTouchEnd = (event: TouchEvent) => {
    this.resetContextMenuTimer();
    if (event.touches.length > 0) {
      this.setState({
        previousSelectedElementIds: {},
        selectedElementIds: makeNextSelectedElementIds(
          this.state.previousSelectedElementIds,
          this.state,
        ),
      });
    } else {
      gesture.pointers.clear();
    }
  };

  // TODO: Cover with tests
  private async insertClipboardContent(
    data: ClipboardData,
    dataTransferFiles: ParsedDataTransferFile[],
    isPlainPaste: boolean,
  ) {
    const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
      {
        clientX: this.lastViewportPosition.x,
        clientY: this.lastViewportPosition.y,
      },
      this.state,
    );

    // ------------------- Error -------------------
    if (data.errorMessage) {
      this.setState({ errorMessage: data.errorMessage });
      return;
    }

    // ------------------- Mixed content with no files -------------------
    if (dataTransferFiles.length === 0 && !isPlainPaste && data.mixedContent) {
      await this.addElementsFromMixedContentPaste(data.mixedContent, {
        isPlainPaste,
        sceneX,
        sceneY,
      });
      return;
    }

    // ------------------- Spreadsheet -------------------
    if (data.spreadsheet && !isPlainPaste) {
      this.setState({
        pasteDialog: {
          data: data.spreadsheet,
          shown: true,
        },
      });
      return;
    }

    // ------------------- Images or SVG code -------------------
    const imageFiles = dataTransferFiles.map((data) => data.file);

    if (imageFiles.length === 0 && data.text && !isPlainPaste) {
      const trimmedText = data.text.trim();
      if (trimmedText.startsWith("<svg") && trimmedText.endsWith("</svg>")) {
        // ignore SVG validation/normalization which will be done during image
        // initialization
        imageFiles.push(SVGStringToFile(trimmedText));
      }
    }

    if (imageFiles.length > 0) {
      if (this.isToolSupported("image")) {
        await this.insertImages(imageFiles, sceneX, sceneY);
      } else {
        this.setState({ errorMessage: t("errors.imageToolNotSupported") });
      }
      return;
    }

    // ------------------- Elements -------------------
    if (data.elements) {
      const elements = (
        data.programmaticAPI
          ? convertToExcalidrawElements(
              data.elements as ExcalidrawElementSkeleton[],
            )
          : data.elements
      ) as readonly ExcalidrawElement[];
      // TODO: remove formatting from elements if isPlainPaste
      this.addElementsFromPasteOrLibrary({
        elements,
        files: data.files || null,
        position: this.isMobileOrTablet() ? "center" : "cursor",
        retainSeed: isPlainPaste,
      });
      return;
    }

    // ------------------- Only textual stuff remaining -------------------
    if (!data.text) {
      return;
    }

    // ------------------- Successful Mermaid -------------------
    if (!isPlainPaste && isMaybeMermaidDefinition(data.text)) {
      const api = await import("@excalidraw/mermaid-to-excalidraw");
      try {
        const { elements: skeletonElements, files } =
          await api.parseMermaidToExcalidraw(data.text);

        const elements = convertToExcalidrawElements(skeletonElements, {
          regenerateIds: true,
        });

        this.addElementsFromPasteOrLibrary({
          elements,
          files,
          position: this.isMobileOrTablet() ? "center" : "cursor",
        });

        return;
      } catch (err: any) {
        console.warn(
          `parsing pasted text as mermaid definition failed: ${err.message}`,
        );
      }
    }

    // ------------------- Pure embeddable URLs -------------------
    const nonEmptyLines = normalizeEOL(data.text)
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const embbeddableUrls = nonEmptyLines
      .map((str) => maybeParseEmbedSrc(str))
      .filter(
        (string) =>
          embeddableURLValidator(string, this.props.validateEmbeddable) &&
          (/^(http|https):\/\/[^\s/$.?#].[^\s]*$/.test(string) ||
            getEmbedLink(string)?.type === "video"),
      );

    if (
      !isPlainPaste &&
      embbeddableUrls.length > 0 &&
      embbeddableUrls.length === nonEmptyLines.length
    ) {
      const embeddables: NonDeleted<ExcalidrawEmbeddableElement>[] = [];
      for (const url of embbeddableUrls) {
        const prevEmbeddable: ExcalidrawEmbeddableElement | undefined =
          embeddables[embeddables.length - 1];
        const embeddable = this.insertEmbeddableElement({
          sceneX: prevEmbeddable
            ? prevEmbeddable.x + prevEmbeddable.width + 20
            : sceneX,
          sceneY,
          link: normalizeLink(url),
        });
        if (embeddable) {
          embeddables.push(embeddable);
        }
      }
      if (embeddables.length) {
        this.store.scheduleCapture();
        this.setState({
          selectedElementIds: Object.fromEntries(
            embeddables.map((embeddable) => [embeddable.id, true]),
          ),
        });
      }
      return;
    }

    // ------------------- Text -------------------
    this.addTextFromPaste(data.text, isPlainPaste);
  }

  public pasteFromClipboard = withBatchedUpdates(
    async (event: ClipboardEvent) => {
      const isPlainPaste = !!IS_PLAIN_PASTE;

      // #686
      const target = document.activeElement;
      const isExcalidrawActive =
        this.excalidrawContainerRef.current?.contains(target);
      if (event && !isExcalidrawActive) {
        return;
      }

      const elementUnderCursor = document.elementFromPoint(
        this.lastViewportPosition.x,
        this.lastViewportPosition.y,
      );
      if (
        event &&
        (!(elementUnderCursor instanceof HTMLCanvasElement) ||
          isWritableElement(target))
      ) {
        return;
      }

      // must be called in the same frame (thus before any awaits) as the paste
      // event else some browsers (FF...) will clear the clipboardData
      // (something something security)
      const dataTransferList = await parseDataTransferEvent(event);

      const filesList = dataTransferList.getFiles();

      const data = await parseClipboard(dataTransferList, isPlainPaste);

      if (this.props.onPaste) {
        try {
          if ((await this.props.onPaste(data, event)) === false) {
            return;
          }
        } catch (error: any) {
          console.error(error);
        }
      }

      await this.insertClipboardContent(data, filesList, isPlainPaste);

      this.setActiveTool({ type: this.defaultSelectionTool }, true);
      event?.preventDefault();
    },
  );

  addElementsFromPasteOrLibrary = (opts: {
    elements: readonly ExcalidrawElement[];
    files: BinaryFiles | null;
    position: { clientX: number; clientY: number } | "cursor" | "center";
    retainSeed?: boolean;
    fitToContent?: boolean;
  }) => {
    const elements = restoreElements(opts.elements, null, {
      deleteInvisibleElements: true,
    });
    const [minX, minY, maxX, maxY] = getCommonBounds(elements);

    const elementsCenterX = distance(minX, maxX) / 2;
    const elementsCenterY = distance(minY, maxY) / 2;

    const clientX =
      typeof opts.position === "object"
        ? opts.position.clientX
        : opts.position === "cursor"
        ? this.lastViewportPosition.x
        : this.state.width / 2 + this.state.offsetLeft;
    const clientY =
      typeof opts.position === "object"
        ? opts.position.clientY
        : opts.position === "cursor"
        ? this.lastViewportPosition.y
        : this.state.height / 2 + this.state.offsetTop;

    const { x, y } = viewportCoordsToSceneCoords(
      { clientX, clientY },
      this.state,
    );

    const dx = x - elementsCenterX;
    const dy = y - elementsCenterY;

    const [gridX, gridY] = getGridPoint(dx, dy, this.getEffectiveGridSize());

    const { duplicatedElements } = duplicateElements({
      type: "everything",
      elements: elements.map((element) => {
        return newElementWith(element, {
          x: element.x + gridX - minX,
          y: element.y + gridY - minY,
        });
      }),
      randomizeSeed: !opts.retainSeed,
    });

    const prevElements = this.scene.getElementsIncludingDeleted();
    let nextElements = [...prevElements, ...duplicatedElements];

    const mappedNewSceneElements = this.props.onDuplicate?.(
      nextElements,
      prevElements,
    );

    nextElements = mappedNewSceneElements || nextElements;

    syncMovedIndices(nextElements, arrayToMap(duplicatedElements));

    const topLayerFrame = this.getTopLayerFrameAtSceneCoords({ x, y });

    if (topLayerFrame) {
      const eligibleElements = filterElementsEligibleAsFrameChildren(
        duplicatedElements,
        topLayerFrame,
      );
      addElementsToFrame(
        nextElements,
        eligibleElements,
        topLayerFrame,
        this.state,
      );
    }

    this.scene.replaceAllElements(nextElements);

    duplicatedElements.forEach((newElement) => {
      if (isTextElement(newElement) && isBoundToContainer(newElement)) {
        const container = getContainerElement(
          newElement,
          this.scene.getElementsMapIncludingDeleted(),
        );
        redrawTextBoundingBox(newElement, container, this.scene);
      }
    });

    // paste event may not fire FontFace loadingdone event in Safari, hence loading font faces manually
    if (isSafari) {
      Fonts.loadElementsFonts(duplicatedElements).then((fontFaces) => {
        this.fonts.onLoaded(fontFaces);
      });
    }

    if (opts.files) {
      this.addMissingFiles(opts.files);
    }

    const nextElementsToSelect =
      excludeElementsInFramesFromSelection(duplicatedElements);

    this.store.scheduleCapture();
    this.setState(
      {
        ...this.state,
        // keep sidebar (presumably the library) open if it's docked and
        // can fit.
        //
        // Note, we should close the sidebar only if we're dropping items
        // from library, not when pasting from clipboard. Alas.
        openSidebar:
          this.state.openSidebar &&
          this.device.editor.canFitSidebar &&
          editorJotaiStore.get(isSidebarDockedAtom)
            ? this.state.openSidebar
            : null,
        ...selectGroupsForSelectedElements(
          {
            editingGroupId: null,
            selectedElementIds: nextElementsToSelect.reduce(
              (acc: Record<ExcalidrawElement["id"], true>, element) => {
                if (!isBoundToContainer(element)) {
                  acc[element.id] = true;
                }
                return acc;
              },
              {},
            ),
          },
          this.scene.getNonDeletedElements(),
          this.state,
          this,
        ),
      },
      () => {
        if (opts.files) {
          this.addNewImagesToImageCache();
        }
      },
    );
    this.setActiveTool({ type: this.defaultSelectionTool }, true);

    if (opts.fitToContent) {
      this.scrollToContent(duplicatedElements, {
        fitToContent: true,
        canvasOffsets: this.getEditorUIOffsets(),
      });
    }
  };

  // TODO rewrite this to paste both text & images at the same time if
  // pasted data contains both
  private async addElementsFromMixedContentPaste(
    mixedContent: PastedMixedContent,
    {
      isPlainPaste,
      sceneX,
      sceneY,
    }: { isPlainPaste: boolean; sceneX: number; sceneY: number },
  ) {
    if (
      !isPlainPaste &&
      mixedContent.some((node) => node.type === "imageUrl") &&
      this.isToolSupported("image")
    ) {
      const imageURLs = mixedContent
        .filter((node) => node.type === "imageUrl")
        .map((node) => node.value);
      const responses = await Promise.all(
        imageURLs.map(async (url) => {
          try {
            return { file: await ImageURLToFile(url) };
          } catch (error: any) {
            let errorMessage = error.message;
            if (error.cause === "FETCH_ERROR") {
              errorMessage = t("errors.failedToFetchImage");
            } else if (error.cause === "UNSUPPORTED") {
              errorMessage = t("errors.unsupportedFileType");
            }
            return { errorMessage };
          }
        }),
      );

      const imageFiles = responses
        .filter((response): response is { file: File } => !!response.file)
        .map((response) => response.file);
      await this.insertImages(imageFiles, sceneX, sceneY);
      const error = responses.find((response) => !!response.errorMessage);
      if (error && error.errorMessage) {
        this.setState({ errorMessage: error.errorMessage });
      }
    } else {
      const textNodes = mixedContent.filter((node) => node.type === "text");
      if (textNodes.length) {
        this.addTextFromPaste(
          textNodes.map((node) => node.value).join("\n\n"),
          isPlainPaste,
        );
      }
    }
  }

  private addTextFromPaste(text: string, isPlainPaste = false) {
    const { x, y } = viewportCoordsToSceneCoords(
      {
        clientX: this.lastViewportPosition.x,
        clientY: this.lastViewportPosition.y,
      },
      this.state,
    );

    const textElementProps = {
      x,
      y,
      strokeColor: this.state.currentItemStrokeColor,
      backgroundColor: this.state.currentItemBackgroundColor,
      fillStyle: this.state.currentItemFillStyle,
      strokeWidth: this.state.currentItemStrokeWidth,
      strokeStyle: this.state.currentItemStrokeStyle,
      roundness: null,
      roughness: this.state.currentItemRoughness,
      opacity: this.state.currentItemOpacity,
      text,
      fontSize: this.state.currentItemFontSize,
      fontFamily: this.state.currentItemFontFamily,
      textAlign: DEFAULT_TEXT_ALIGN,
      verticalAlign: DEFAULT_VERTICAL_ALIGN,
      locked: false,
    };
    const fontString = getFontString({
      fontSize: textElementProps.fontSize,
      fontFamily: textElementProps.fontFamily,
    });
    const lineHeight = getLineHeight(textElementProps.fontFamily);
    const [x1, , x2] = getVisibleSceneBounds(this.state);
    // long texts should not go beyond 800 pixels in width nor should it go below 200 px
    const maxTextWidth = Math.max(Math.min((x2 - x1) * 0.5, 800), 200);
    const LINE_GAP = 10;
    let currentY = y;

    const lines = isPlainPaste ? [text] : text.split("\n");
    const textElements = lines.reduce(
      (acc: ExcalidrawTextElement[], line, idx) => {
        const originalText = normalizeText(line).trim();
        if (originalText.length) {
          const topLayerFrame = this.getTopLayerFrameAtSceneCoords({
            x,
            y: currentY,
          });

          let metrics = measureText(originalText, fontString, lineHeight);
          const isTextUnwrapped = metrics.width > maxTextWidth;

          const text = isTextUnwrapped
            ? wrapText(originalText, fontString, maxTextWidth)
            : originalText;

          metrics = isTextUnwrapped
            ? measureText(text, fontString, lineHeight)
            : metrics;

          const startX = x - metrics.width / 2;
          const startY = currentY - metrics.height / 2;

          const element = newTextElement({
            ...textElementProps,
            x: startX,
            y: startY,
            text,
            originalText,
            lineHeight,
            autoResize: !isTextUnwrapped,
            frameId: topLayerFrame ? topLayerFrame.id : null,
          });
          acc.push(element);
          currentY += element.height + LINE_GAP;
        } else {
          const prevLine = lines[idx - 1]?.trim();
          // add paragraph only if previous line was not empty, IOW don't add
          // more than one empty line
          if (prevLine) {
            currentY +=
              getLineHeightInPx(textElementProps.fontSize, lineHeight) +
              LINE_GAP;
          }
        }

        return acc;
      },
      [],
    );

    if (textElements.length === 0) {
      return;
    }

    this.scene.insertElements(textElements);
    this.store.scheduleCapture();
    this.setState({
      selectedElementIds: makeNextSelectedElementIds(
        Object.fromEntries(textElements.map((el) => [el.id, true])),
        this.state,
      ),
    });

    if (
      !isPlainPaste &&
      textElements.length > 1 &&
      PLAIN_PASTE_TOAST_SHOWN === false &&
      !this.device.editor.isMobile
    ) {
      this.setToast({
        message: t("toast.pasteAsSingleElement", {
          shortcut: getShortcutKey("CtrlOrCmd+Shift+V"),
        }),
        duration: 5000,
      });
      PLAIN_PASTE_TOAST_SHOWN = true;
    }
  }

  setAppState: React.Component<any, AppState>["setState"] = (
    state,
    callback,
  ) => {
    this.setState(state, callback);
  };

  removePointer = (event: React.PointerEvent<HTMLElement> | PointerEvent) => {
    if (touchTimeout) {
      this.resetContextMenuTimer();
    }

    gesture.pointers.delete(event.pointerId);
  };

  toggleLock = (source: "keyboard" | "ui" = "ui") => {
    if (!this.state.activeTool.locked) {
      trackEvent(
        "toolbar",
        "toggleLock",
        `${source} (${this.device.editor.isMobile ? "mobile" : "desktop"})`,
      );
    }
    this.setState((prevState) => {
      return {
        activeTool: {
          ...prevState.activeTool,
          ...updateActiveTool(
            this.state,
            prevState.activeTool.locked
              ? { type: this.defaultSelectionTool }
              : prevState.activeTool,
          ),
          locked: !prevState.activeTool.locked,
        },
      };
    });
  };

  updateFrameRendering = (
    opts:
      | Partial<AppState["frameRendering"]>
      | ((
          prevState: AppState["frameRendering"],
        ) => Partial<AppState["frameRendering"]>),
  ) => {
    this.setState((prevState) => {
      const next =
        typeof opts === "function" ? opts(prevState.frameRendering) : opts;
      return {
        frameRendering: {
          enabled: next?.enabled ?? prevState.frameRendering.enabled,
          clip: next?.clip ?? prevState.frameRendering.clip,
          name: next?.name ?? prevState.frameRendering.name,
          outline: next?.outline ?? prevState.frameRendering.outline,
        },
      };
    });
  };

  togglePenMode = (force: boolean | null) => {
    this.setState((prevState) => {
      return {
        penMode: force ?? !prevState.penMode,
        penDetected: true,
      };
    });
  };

  onHandToolToggle = () => {
    this.actionManager.executeAction(actionToggleHandTool);
  };

  /**
   * Zooms on canvas viewport center
   */
  zoomCanvas = (
    /**
     * Decimal fraction, auto-clamped between MIN_ZOOM and MAX_ZOOM.
     * 1 = 100% zoom, 2 = 200% zoom, 0.5 = 50% zoom
     */
    value: number,
  ) => {
    this.setState({
      ...getStateForZoom(
        {
          viewportX: this.state.width / 2 + this.state.offsetLeft,
          viewportY: this.state.height / 2 + this.state.offsetTop,
          nextZoom: getNormalizedZoom(value),
        },
        this.state,
      ),
    });
  };

  private cancelInProgressAnimation: (() => void) | null = null;

  scrollToContent = (
    /**
     * target to scroll to
     *
     * - string - id of element or group, or url containing elementLink
     * - ExcalidrawElement | ExcalidrawElement[] - element(s) objects
     */
    target:
      | string
      | ExcalidrawElement
      | readonly ExcalidrawElement[] = this.scene.getNonDeletedElements(),
    opts?: (
      | {
          fitToContent?: boolean;
          fitToViewport?: never;
          viewportZoomFactor?: number;
          animate?: boolean;
          duration?: number;
        }
      | {
          fitToContent?: never;
          fitToViewport?: boolean;
          /** when fitToViewport=true, how much screen should the content cover,
           * between 0.1 (10%) and 1 (100%)
           */
          viewportZoomFactor?: number;
          animate?: boolean;
          duration?: number;
        }
    ) & {
      minZoom?: number;
      maxZoom?: number;
      canvasOffsets?: Offsets;
    },
  ) => {
    if (typeof target === "string") {
      let id: string | null;
      if (isElementLink(target)) {
        id = parseElementLinkFromURL(target);
      } else {
        id = target;
      }
      if (id) {
        const elements = this.scene.getElementsFromId(id);

        if (elements?.length) {
          this.scrollToContent(elements, {
            fitToContent: opts?.fitToContent ?? true,
            animate: opts?.animate ?? true,
          });
        } else if (isElementLink(target)) {
          this.setState({
            toast: {
              message: t("elementLink.notFound"),
              duration: 3000,
              closable: true,
            },
          });
        }
      }
      return;
    }

    this.cancelInProgressAnimation?.();

    // convert provided target into ExcalidrawElement[] if necessary
    const targetElements = Array.isArray(target) ? target : [target];

    let zoom = this.state.zoom;
    let scrollX = this.state.scrollX;
    let scrollY = this.state.scrollY;

    if (opts?.fitToContent || opts?.fitToViewport) {
      const { appState } = zoomToFit({
        canvasOffsets: opts.canvasOffsets,
        targetElements,
        appState: this.state,
        fitToViewport: !!opts?.fitToViewport,
        viewportZoomFactor: opts?.viewportZoomFactor,
        minZoom: opts?.minZoom,
        maxZoom: opts?.maxZoom,
      });
      zoom = appState.zoom;
      scrollX = appState.scrollX;
      scrollY = appState.scrollY;
    } else {
      // compute only the viewport location, without any zoom adjustment
      const scroll = calculateScrollCenter(targetElements, this.state);
      scrollX = scroll.scrollX;
      scrollY = scroll.scrollY;
    }

    // when animating, we use RequestAnimationFrame to prevent the animation
    // from slowing down other processes
    if (opts?.animate) {
      const origScrollX = this.state.scrollX;
      const origScrollY = this.state.scrollY;
      const origZoom = this.state.zoom.value;

      const cancel = easeToValuesRAF({
        fromValues: {
          scrollX: origScrollX,
          scrollY: origScrollY,
          zoom: origZoom,
        },
        toValues: { scrollX, scrollY, zoom: zoom.value },
        interpolateValue: (from, to, progress, key) => {
          // for zoom, use different easing
          if (key === "zoom") {
            return from * Math.pow(to / from, easeOut(progress));
          }
          // handle using default
          return undefined;
        },
        onStep: ({ scrollX, scrollY, zoom }) => {
          this.setState({
            scrollX,
            scrollY,
            zoom: { value: zoom },
          });
        },
        onStart: () => {
          this.setState({ shouldCacheIgnoreZoom: true });
        },
        onEnd: () => {
          this.setState({ shouldCacheIgnoreZoom: false });
        },
        onCancel: () => {
          this.setState({ shouldCacheIgnoreZoom: false });
        },
        duration: opts?.duration ?? 500,
      });

      this.cancelInProgressAnimation = () => {
        cancel();
        this.cancelInProgressAnimation = null;
      };
    } else {
      this.setState({ scrollX, scrollY, zoom });
    }
  };

  private maybeUnfollowRemoteUser = () => {
    if (this.state.userToFollow) {
      this.setState({ userToFollow: null });
    }
  };

  /** use when changing scrollX/scrollY/zoom based on user interaction */
  private translateCanvas: React.Component<any, AppState>["setState"] = (
    state,
  ) => {
    this.cancelInProgressAnimation?.();
    this.maybeUnfollowRemoteUser();
    this.setState(state);
  };

  setToast = (
    toast: {
      message: string;
      closable?: boolean;
      duration?: number;
    } | null,
  ) => {
    this.setState({ toast });
  };

  restoreFileFromShare = async () => {
    try {
      const webShareTargetCache = await caches.open("web-share-target");

      const response = await webShareTargetCache.match("shared-file");
      if (response) {
        const blob = await response.blob();
        const file = new File([blob], blob.name || "", { type: blob.type });
        this.loadFileToCanvas(file, null);
        await webShareTargetCache.delete("shared-file");
        window.history.replaceState(null, APP_NAME, window.location.pathname);
      }
    } catch (error: any) {
      this.setState({ errorMessage: error.message });
    }
  };

  /**
   * adds supplied files to existing files in the appState.
   * NOTE if file already exists in editor state, the file data is not updated
   * */
  public addFiles: ExcalidrawImperativeAPI["addFiles"] = withBatchedUpdates(
    (files) => {
      const { addedFiles } = this.addMissingFiles(files);

      this.clearImageShapeCache(addedFiles);
      this.scene.triggerUpdate();

      this.addNewImagesToImageCache();
    },
  );

  private addMissingFiles = (
    files: BinaryFiles | BinaryFileData[],
    replace = false,
  ) => {
    const nextFiles = replace ? {} : { ...this.files };
    const addedFiles: BinaryFiles = {};

    const _files = Array.isArray(files) ? files : Object.values(files);

    for (const fileData of _files) {
      if (nextFiles[fileData.id]) {
        continue;
      }

      addedFiles[fileData.id] = fileData;
      nextFiles[fileData.id] = fileData;

      if (fileData.mimeType === MIME_TYPES.svg) {
        try {
          const restoredDataURL = getDataURL_sync(
            normalizeSVG(dataURLToString(fileData.dataURL)),
            MIME_TYPES.svg,
          );
          if (fileData.dataURL !== restoredDataURL) {
            // bump version so persistence layer can update the store
            fileData.version = (fileData.version ?? 1) + 1;
            fileData.dataURL = restoredDataURL;
          }
        } catch (error) {
          console.error(error);
        }
      }
    }

    this.files = nextFiles;

    return { addedFiles };
  };

  public updateScene = withBatchedUpdates(
    <K extends keyof AppState>(sceneData: {
      elements?: SceneData["elements"];
      appState?: Pick<AppState, K> | null;
      collaborators?: SceneData["collaborators"];
      /**
       *  Controls which updates should be captured by the `Store`. Captured updates are emmitted and listened to by other components, such as `History` for undo / redo purposes.
       *
       *  - `CaptureUpdateAction.IMMEDIATELY`: Updates are immediately undoable. Use for most local updates.
       *  - `CaptureUpdateAction.NEVER`: Updates never make it to undo/redo stack. Use for remote updates or scene initialization.
       *  - `CaptureUpdateAction.EVENTUALLY`: Updates will be eventually be captured as part of a future increment.
       *
       * Check [API docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#captureUpdate) for more details.
       *
       * @default CaptureUpdateAction.EVENTUALLY
       */
      captureUpdate?: SceneData["captureUpdate"];
    }) => {
      const { elements, appState, collaborators, captureUpdate } = sceneData;

      if (captureUpdate) {
        const nextElements = elements ? elements : undefined;
        const observedAppState = appState
          ? getObservedAppState({
              ...this.store.snapshot.appState,
              ...appState,
            })
          : undefined;

        this.store.scheduleMicroAction({
          action: captureUpdate,
          elements: nextElements,
          appState: observedAppState,
        });
      }

      if (appState) {
        this.setState(appState);
      }

      if (elements) {
        this.scene.replaceAllElements(elements);
      }

      if (collaborators) {
        this.setState({ collaborators });
      }
    },
  );

  public applyDeltas = (
    deltas: StoreDelta[],
    options?: ApplyToOptions,
  ): [SceneElementsMap, AppState, boolean] => {
    // squash all deltas together, starting with a fresh new delta instance
    const aggregatedDelta = StoreDelta.squash(...deltas);

    // create new instance of elements map & appState, so we don't accidentaly mutate existing ones
    const nextAppState = { ...this.state };
    const nextElements = new Map(
      this.scene.getElementsMapIncludingDeleted(),
    ) as SceneElementsMap;

    return StoreDelta.applyTo(
      aggregatedDelta,
      nextElements,
      nextAppState,
      options,
    );
  };

  public mutateElement = <TElement extends Mutable<ExcalidrawElement>>(
    element: TElement,
    updates: ElementUpdate<TElement>,
    informMutation = true,
  ) => {
    return this.scene.mutateElement(element, updates, {
      informMutation,
      isDragging: false,
    });
  };

  private triggerRender = (
    /** force always re-renders canvas even if no change */
    force?: boolean,
  ) => {
    if (force === true) {
      this.scene.triggerUpdate();
    } else {
      this.setState({});
    }
  };

  /**
   * @returns whether the menu was toggled on or off
   */
  public toggleSidebar = ({
    name,
    tab,
    force,
  }: {
    name: SidebarName | null;
    tab?: SidebarTabName;
    force?: boolean;
  }): boolean => {
    let nextName;
    if (force === undefined) {
      nextName =
        this.state.openSidebar?.name === name &&
        this.state.openSidebar?.tab === tab
          ? null
          : name;
    } else {
      nextName = force ? name : null;
    }

    const nextState: AppState["openSidebar"] = nextName
      ? { name: nextName }
      : null;
    if (nextState && tab) {
      nextState.tab = tab;
    }

    this.setState({ openSidebar: nextState });

    return !!nextName;
  };

  private updateCurrentCursorPosition = withBatchedUpdates(
    (event: MouseEvent) => {
      this.lastViewportPosition.x = event.clientX;
      this.lastViewportPosition.y = event.clientY;
    },
  );

  public getEditorUIOffsets = (): Offsets => {
    const toolbarBottom =
      this.excalidrawContainerRef?.current
        ?.querySelector(".App-toolbar")
        ?.getBoundingClientRect()?.bottom ?? 0;
    const sidebarRect = this.excalidrawContainerRef?.current
      ?.querySelector(".sidebar")
      ?.getBoundingClientRect();
    const propertiesPanelRect = this.excalidrawContainerRef?.current
      ?.querySelector(".App-menu__left")
      ?.getBoundingClientRect();

    const PADDING = 16;

    return getLanguage().rtl
      ? {
          top: toolbarBottom + PADDING,
          right:
            Math.max(
              this.state.width -
                (propertiesPanelRect?.left ?? this.state.width),
              0,
            ) + PADDING,
          bottom: PADDING,
          left: Math.max(sidebarRect?.right ?? 0, 0) + PADDING,
        }
      : {
          top: toolbarBottom + PADDING,
          right: Math.max(
            this.state.width -
              (sidebarRect?.left ?? this.state.width) +
              PADDING,
            0,
          ),
          bottom: PADDING,
          left: Math.max(propertiesPanelRect?.right ?? 0, 0) + PADDING,
        };
  };

  // Input handling
  private onKeyDown = withBatchedUpdates(
    (event: React.KeyboardEvent | KeyboardEvent) => {
      // normalize `event.key` when CapsLock is pressed #2372

      if (
        "Proxy" in window &&
        ((!event.shiftKey && /^[A-Z]$/.test(event.key)) ||
          (event.shiftKey && /^[a-z]$/.test(event.key)))
      ) {
        event = new Proxy(event, {
          get(ev: any, prop) {
            const value = ev[prop];
            if (typeof value === "function") {
              // fix for Proxies hijacking `this`
              return value.bind(ev);
            }
            return prop === "key"
              ? // CapsLock inverts capitalization based on ShiftKey, so invert
                // it back
                event.shiftKey
                ? ev.key.toUpperCase()
                : ev.key.toLowerCase()
              : value;
          },
        });
      }

      if (!isInputLike(event.target)) {
        if (
          (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) &&
          this.state.croppingElementId
        ) {
          this.finishImageCropping();
          return;
        }

        const selectedElements = getSelectedElements(
          this.scene.getNonDeletedElementsMap(),
          this.state,
        );

        if (
          selectedElements.length === 1 &&
          isImageElement(selectedElements[0]) &&
          event.key === KEYS.ENTER
        ) {
          this.startImageCropping(selectedElements[0]);
          return;
        }

        // Shape switching
        if (event.key === KEYS.ESCAPE) {
          this.updateEditorAtom(convertElementTypePopupAtom, null);
        } else if (
          event.key === KEYS.TAB &&
          (document.activeElement === this.excalidrawContainerRef?.current ||
            document.activeElement?.classList.contains(
              CLASSES.CONVERT_ELEMENT_TYPE_POPUP,
            ))
        ) {
          event.preventDefault();

          const conversionType =
            getConversionTypeFromElements(selectedElements);

          if (
            editorJotaiStore.get(convertElementTypePopupAtom)?.type === "panel"
          ) {
            if (
              convertElementTypes(this, {
                conversionType,
                direction: event.shiftKey ? "left" : "right",
              })
            ) {
              this.store.scheduleCapture();
            }
          }
          if (conversionType) {
            this.updateEditorAtom(convertElementTypePopupAtom, {
              type: "panel",
            });
          }
        }

        if (
          event.key === KEYS.ESCAPE &&
          this.flowChartCreator.isCreatingChart
        ) {
          this.flowChartCreator.clear();
          this.triggerRender(true);
          return;
        }

        const arrowKeyPressed = isArrowKey(event.key);

        if (event[KEYS.CTRL_OR_CMD] && arrowKeyPressed && !event.shiftKey) {
          event.preventDefault();

          const selectedElements = getSelectedElements(
            this.scene.getNonDeletedElementsMap(),
            this.state,
          );

          if (
            selectedElements.length === 1 &&
            isFlowchartNodeElement(selectedElements[0])
          ) {
            this.flowChartCreator.createNodes(
              selectedElements[0],
              this.state,
              getLinkDirectionFromKey(event.key),
              this.scene,
            );
          }

          if (
            this.flowChartCreator.pendingNodes?.length &&
            !isElementCompletelyInViewport(
              this.flowChartCreator.pendingNodes,
              this.canvas.width / window.devicePixelRatio,
              this.canvas.height / window.devicePixelRatio,
              {
                offsetLeft: this.state.offsetLeft,
                offsetTop: this.state.offsetTop,
                scrollX: this.state.scrollX,
                scrollY: this.state.scrollY,
                zoom: this.state.zoom,
              },
              this.scene.getNonDeletedElementsMap(),
              this.getEditorUIOffsets(),
            )
          ) {
            this.scrollToContent(this.flowChartCreator.pendingNodes, {
              animate: true,
              duration: 300,
              fitToContent: true,
              canvasOffsets: this.getEditorUIOffsets(),
            });
          }

          return;
        }

        if (event.altKey) {
          const selectedElements = getSelectedElements(
            this.scene.getNonDeletedElementsMap(),
            this.state,
          );

          if (selectedElements.length === 1 && arrowKeyPressed) {
            event.preventDefault();

            const nextId = this.flowChartNavigator.exploreByDirection(
              selectedElements[0],
              this.scene.getNonDeletedElementsMap(),
              getLinkDirectionFromKey(event.key),
            );

            if (nextId) {
              this.setState((prevState) => ({
                selectedElementIds: makeNextSelectedElementIds(
                  {
                    [nextId]: true,
                  },
                  prevState,
                ),
              }));

              const nextNode = this.scene
                .getNonDeletedElementsMap()
                .get(nextId);

              if (
                nextNode &&
                !isElementCompletelyInViewport(
                  [nextNode],
                  this.canvas.width / window.devicePixelRatio,
                  this.canvas.height / window.devicePixelRatio,
                  {
                    offsetLeft: this.state.offsetLeft,
                    offsetTop: this.state.offsetTop,
                    scrollX: this.state.scrollX,
                    scrollY: this.state.scrollY,
                    zoom: this.state.zoom,
                  },
                  this.scene.getNonDeletedElementsMap(),
                  this.getEditorUIOffsets(),
                )
              ) {
                this.scrollToContent(nextNode, {
                  animate: true,
                  duration: 300,
                  canvasOffsets: this.getEditorUIOffsets(),
                });
              }
            }
            return;
          }
        }
      }

      if (
        event[KEYS.CTRL_OR_CMD] &&
        event.key === KEYS.P &&
        !event.shiftKey &&
        !event.altKey
      ) {
        this.setToast({
          message: t("commandPalette.shortcutHint", {
            shortcut: getShortcutFromShortcutName("commandPalette"),
          }),
        });
        event.preventDefault();
        return;
      }

      if (event[KEYS.CTRL_OR_CMD] && event.key.toLowerCase() === KEYS.V) {
        IS_PLAIN_PASTE = event.shiftKey;
        clearTimeout(IS_PLAIN_PASTE_TIMER);
        // reset (100ms to be safe that we it runs after the ensuing
        // paste event). Though, technically unnecessary to reset since we
        // (re)set the flag before each paste event.
        IS_PLAIN_PASTE_TIMER = window.setTimeout(() => {
          IS_PLAIN_PASTE = false;
        }, 100);
      }

      // prevent browser zoom in input fields
      if (event[KEYS.CTRL_OR_CMD] && isWritableElement(event.target)) {
        if (event.code === CODES.MINUS || event.code === CODES.EQUAL) {
          event.preventDefault();
          return;
        }
      }

      // bail if
      if (
        // inside an input
        (isWritableElement(event.target) &&
          // unless pressing escape (finalize action)
          event.key !== KEYS.ESCAPE) ||
        // or unless using arrows (to move between buttons)
        (isArrowKey(event.key) && isInputLike(event.target))
      ) {
        return;
      }

      if (event.key === KEYS.QUESTION_MARK) {
        this.setState({
          openDialog: { name: "help" },
        });
        return;
      } else if (
        event.key.toLowerCase() === KEYS.E &&
        event.shiftKey &&
        event[KEYS.CTRL_OR_CMD]
      ) {
        event.preventDefault();
        this.setState({ openDialog: { name: "imageExport" } });
        return;
      }

      if (event.key === KEYS.PAGE_UP || event.key === KEYS.PAGE_DOWN) {
        let offset =
          (event.shiftKey ? this.state.width : this.state.height) /
          this.state.zoom.value;
        if (event.key === KEYS.PAGE_DOWN) {
          offset = -offset;
        }
        if (event.shiftKey) {
          this.translateCanvas((state) => ({
            scrollX: state.scrollX + offset,
          }));
        } else {
          this.translateCanvas((state) => ({
            scrollY: state.scrollY + offset,
          }));
        }
      }

      if (this.state.openDialog?.name === "elementLinkSelector") {
        return;
      }

      if (this.actionManager.handleKeyDown(event)) {
        return;
      }

      if (this.state.viewModeEnabled) {
        return;
      }

      if (event[KEYS.CTRL_OR_CMD] && this.state.isBindingEnabled) {
        this.setState({ isBindingEnabled: false });
      }

      if (isArrowKey(event.key)) {
        let selectedElements = this.scene.getSelectedElements({
          selectedElementIds: this.state.selectedElementIds,
          includeBoundTextElement: true,
          includeElementsInFrames: true,
        });

        const elbowArrow = selectedElements.find(isElbowArrow) as
          | ExcalidrawArrowElement
          | undefined;

        const arrowIdsToRemove = new Set<string>();

        selectedElements
          .filter(isElbowArrow)
          .filter((arrow) => {
            const startElementNotInSelection =
              arrow.startBinding &&
              !selectedElements.some(
                (el) => el.id === arrow.startBinding?.elementId,
              );
            const endElementNotInSelection =
              arrow.endBinding &&
              !selectedElements.some(
                (el) => el.id === arrow.endBinding?.elementId,
              );
            return startElementNotInSelection || endElementNotInSelection;
          })
          .forEach((arrow) => arrowIdsToRemove.add(arrow.id));

        selectedElements = selectedElements.filter(
          (el) => !arrowIdsToRemove.has(el.id),
        );

        const step =
          (this.getEffectiveGridSize() &&
            (event.shiftKey
              ? ELEMENT_TRANSLATE_AMOUNT
              : this.getEffectiveGridSize())) ||
          (event.shiftKey
            ? ELEMENT_SHIFT_TRANSLATE_AMOUNT
            : ELEMENT_TRANSLATE_AMOUNT);

        let offsetX = 0;
        let offsetY = 0;

        if (event.key === KEYS.ARROW_LEFT) {
          offsetX = -step;
        } else if (event.key === KEYS.ARROW_RIGHT) {
          offsetX = step;
        } else if (event.key === KEYS.ARROW_UP) {
          offsetY = -step;
        } else if (event.key === KEYS.ARROW_DOWN) {
          offsetY = step;
        }

        selectedElements.forEach((element) => {
          this.scene.mutateElement(
            element,
            {
              x: element.x + offsetX,
              y: element.y + offsetY,
            },
            { informMutation: false, isDragging: false },
          );

          updateBoundElements(element, this.scene, {
            simultaneouslyUpdated: selectedElements,
          });
        });

        this.setState({
          suggestedBindings: getSuggestedBindingsForArrows(
            selectedElements.filter(
              (element) => element.id !== elbowArrow?.id || step !== 0,
            ),
            this.scene.getNonDeletedElementsMap(),
            this.state.zoom,
          ),
        });

        this.scene.triggerUpdate();

        event.preventDefault();
      } else if (event.key === KEYS.ENTER) {
        const selectedElements = this.scene.getSelectedElements(this.state);
        if (selectedElements.length === 1) {
          const selectedElement = selectedElements[0];
          if (event[KEYS.CTRL_OR_CMD] || isLineElement(selectedElement)) {
            if (isLinearElement(selectedElement)) {
              if (
                !this.state.selectedLinearElement?.isEditing ||
                this.state.selectedLinearElement.elementId !==
                  selectedElement.id
              ) {
                this.store.scheduleCapture();
                if (!isElbowArrow(selectedElement)) {
                  this.actionManager.executeAction(actionToggleLinearEditor);
                }
              }
            }
          } else if (
            isTextElement(selectedElement) ||
            isValidTextContainer(selectedElement)
          ) {
            let container;
            if (!isTextElement(selectedElement)) {
              container = selectedElement as ExcalidrawTextContainer;
            }
            const midPoint = getContainerCenter(
              selectedElement,
              this.state,
              this.scene.getNonDeletedElementsMap(),
            );
            const sceneX = midPoint.x;
            const sceneY = midPoint.y;
            this.startTextEditing({
              sceneX,
              sceneY,
              container,
            });
            event.preventDefault();
            return;
          } else if (isFrameLikeElement(selectedElement)) {
            this.setState({
              editingFrame: selectedElement.id,
            });
          }
        }
      } else if (
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !this.state.newElement &&
        !this.state.selectionElement &&
        !this.state.selectedElementsAreBeingDragged
      ) {
        const shape = findShapeByKey(event.key, this);
        if (shape) {
          if (this.state.activeTool.type !== shape) {
            trackEvent(
              "toolbar",
              shape,
              `keyboard (${
                this.device.editor.isMobile ? "mobile" : "desktop"
              })`,
            );
          }
          if (shape === "arrow" && this.state.activeTool.type === "arrow") {
            this.setState((prevState) => ({
              currentItemArrowType:
                prevState.currentItemArrowType === ARROW_TYPE.sharp
                  ? ARROW_TYPE.round
                  : prevState.currentItemArrowType === ARROW_TYPE.round
                  ? ARROW_TYPE.elbow
                  : ARROW_TYPE.sharp,
            }));
          }
          this.setActiveTool({ type: shape });
          event.stopPropagation();
        } else if (event.key === KEYS.Q) {
          this.toggleLock("keyboard");
          event.stopPropagation();
        }
      }
      if (event.key === KEYS.SPACE && gesture.pointers.size === 0) {
        isHoldingSpace = true;
        setCursor(this.interactiveCanvas, CURSOR_TYPE.GRAB);
        event.preventDefault();
      }

      if (
        (event.key === KEYS.G || event.key === KEYS.S) &&
        !event.altKey &&
        !event[KEYS.CTRL_OR_CMD]
      ) {
        const selectedElements = this.scene.getSelectedElements(this.state);
        if (
          this.state.activeTool.type === "selection" &&
          !selectedElements.length
        ) {
          return;
        }

        if (
          event.key === KEYS.G &&
          (hasBackground(this.state.activeTool.type) ||
            selectedElements.some((element) => hasBackground(element.type)))
        ) {
          this.setState({ openPopup: "elementBackground" });
          event.stopPropagation();
        }
        if (event.key === KEYS.S) {
          this.setState({ openPopup: "elementStroke" });
          event.stopPropagation();
        }
      }

      if (
        !event[KEYS.CTRL_OR_CMD] &&
        event.shiftKey &&
        event.key.toLowerCase() === KEYS.F
      ) {
        const selectedElements = this.scene.getSelectedElements(this.state);

        if (
          this.state.activeTool.type === "selection" &&
          !selectedElements.length
        ) {
          return;
        }

        if (
          this.state.activeTool.type === "text" ||
          selectedElements.find(
            (element) =>
              isTextElement(element) ||
              getBoundTextElement(
                element,
                this.scene.getNonDeletedElementsMap(),
              ),
          )
        ) {
          event.preventDefault();
          this.setState({ openPopup: "fontFamily" });
        }
      }

      if (event.key === KEYS.K && !event.altKey && !event[KEYS.CTRL_OR_CMD]) {
        if (this.state.activeTool.type === "laser") {
          this.setActiveTool({ type: this.defaultSelectionTool });
        } else {
          this.setActiveTool({ type: "laser" });
        }
        return;
      }

      if (
        event[KEYS.CTRL_OR_CMD] &&
        (event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE)
      ) {
        this.updateEditorAtom(activeConfirmDialogAtom, "clearCanvas");
      }

      // eye dropper
      // -----------------------------------------------------------------------
      const lowerCased = event.key.toLocaleLowerCase();
      const isPickingStroke = lowerCased === KEYS.S && event.shiftKey;
      const isPickingBackground =
        event.key === KEYS.I || (lowerCased === KEYS.G && event.shiftKey);

      if (isPickingStroke || isPickingBackground) {
        this.openEyeDropper({
          type: isPickingStroke ? "stroke" : "background",
        });
      }
      // -----------------------------------------------------------------------
    },
  );

  private onKeyUp = withBatchedUpdates((event: KeyboardEvent) => {
    if (event.key === KEYS.SPACE) {
      if (
        this.state.viewModeEnabled ||
        this.state.openDialog?.name === "elementLinkSelector"
      ) {
        setCursor(this.interactiveCanvas, CURSOR_TYPE.GRAB);
      } else if (
        this.state.activeTool.type === "selection" ||
        this.state.activeTool.type === "lasso"
      ) {
        resetCursor(this.interactiveCanvas);
      } else {
        setCursorForShape(this.interactiveCanvas, this.state);
        this.setState({
          selectedElementIds: makeNextSelectedElementIds({}, this.state),
          selectedGroupIds: {},
          editingGroupId: null,
          activeEmbeddable: null,
        });
      }
      isHoldingSpace = false;
    }
    if (!event[KEYS.CTRL_OR_CMD] && !this.state.isBindingEnabled) {
      this.setState({ isBindingEnabled: true });
    }
    if (isArrowKey(event.key)) {
      bindOrUnbindLinearElements(
        this.scene.getSelectedElements(this.state).filter(isLinearElement),
        isBindingEnabled(this.state),
        this.state.selectedLinearElement?.selectedPointsIndices ?? [],
        this.scene,
        this.state.zoom,
      );
      this.setState({ suggestedBindings: [] });
    }

    if (!event.altKey) {
      if (this.flowChartNavigator.isExploring) {
        this.flowChartNavigator.clear();
        this.syncActionResult({
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      }
    }

    if (!event[KEYS.CTRL_OR_CMD]) {
      if (this.flowChartCreator.isCreatingChart) {
        if (this.flowChartCreator.pendingNodes?.length) {
          this.scene.insertElements(this.flowChartCreator.pendingNodes);
        }

        const firstNode = this.flowChartCreator.pendingNodes?.[0];

        if (firstNode) {
          this.setState((prevState) => ({
            selectedElementIds: makeNextSelectedElementIds(
              {
                [firstNode.id]: true,
              },
              prevState,
            ),
          }));

          if (
            !isElementCompletelyInViewport(
              [firstNode],
              this.canvas.width / window.devicePixelRatio,
              this.canvas.height / window.devicePixelRatio,
              {
                offsetLeft: this.state.offsetLeft,
                offsetTop: this.state.offsetTop,
                scrollX: this.state.scrollX,
                scrollY: this.state.scrollY,
                zoom: this.state.zoom,
              },
              this.scene.getNonDeletedElementsMap(),
              this.getEditorUIOffsets(),
            )
          ) {
            this.scrollToContent(firstNode, {
              animate: true,
              duration: 300,
              canvasOffsets: this.getEditorUIOffsets(),
            });
          }
        }

        this.flowChartCreator.clear();
        this.syncActionResult({
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      }
    }
  });

  // We purposely widen the `tool` type so this helper can be called with
  // any tool without having to type check it
  private isToolSupported = <T extends ToolType | "custom">(tool: T) => {
    return (
      this.props.UIOptions.tools?.[
        tool as Extract<T, keyof AppProps["UIOptions"]["tools"]>
      ] !== false
    );
  };

  setActiveTool = (
    tool: ({ type: ToolType } | { type: "custom"; customType: string }) & {
      locked?: boolean;
      fromSelection?: boolean;
    },
    keepSelection = false,
  ) => {
    if (!this.isToolSupported(tool.type)) {
      console.warn(
        `"${tool.type}" tool is disabled via "UIOptions.canvasActions.tools.${tool.type}"`,
      );
      return;
    }

    const nextActiveTool = updateActiveTool(this.state, tool);
    if (nextActiveTool.type === "hand") {
      setCursor(this.interactiveCanvas, CURSOR_TYPE.GRAB);
    } else if (!isHoldingSpace) {
      setCursorForShape(this.interactiveCanvas, {
        ...this.state,
        activeTool: nextActiveTool,
      });
    }
    if (isToolIcon(document.activeElement)) {
      this.focusContainer();
    }
    if (!isLinearElementType(nextActiveTool.type)) {
      this.setState({ suggestedBindings: [] });
    }
    if (nextActiveTool.type === "image") {
      this.onImageToolbarButtonClick();
    }

    this.setState((prevState) => {
      const commonResets = {
        snapLines: prevState.snapLines.length ? [] : prevState.snapLines,
        originSnapOffset: null,
        activeEmbeddable: null,
      } as const;

      if (nextActiveTool.type === "freedraw") {
        this.store.scheduleCapture();
      }

      if (nextActiveTool.type === "lasso") {
        return {
          ...prevState,
          activeTool: nextActiveTool,
          ...(keepSelection
            ? {}
            : {
                selectedElementIds: makeNextSelectedElementIds({}, prevState),
                selectedGroupIds: makeNextSelectedElementIds({}, prevState),
                editingGroupId: null,
                multiElement: null,
              }),
          ...commonResets,
        };
      } else if (nextActiveTool.type !== "selection") {
        return {
          ...prevState,
          activeTool: nextActiveTool,
          selectedElementIds: makeNextSelectedElementIds({}, prevState),
          selectedGroupIds: makeNextSelectedElementIds({}, prevState),
          editingGroupId: null,
          multiElement: null,
          ...commonResets,
        };
      }
      return {
        ...prevState,
        activeTool: nextActiveTool,
        ...commonResets,
      };
    });
  };

  setOpenDialog = (dialogType: AppState["openDialog"]) => {
    this.setState({ openDialog: dialogType });
  };

  private setCursor = (cursor: string) => {
    setCursor(this.interactiveCanvas, cursor);
  };

  private resetCursor = () => {
    resetCursor(this.interactiveCanvas);
  };
  /**
   * returns whether user is making a gesture with >= 2 fingers (points)
   * on o touch screen (not on a trackpad). Currently only relates to Darwin
   * (iOS/iPadOS,MacOS), but may work on other devices in the future if
   * GestureEvent is standardized.
   */
  private isTouchScreenMultiTouchGesture = () => {
    // we don't want to deselect when using trackpad, and multi-point gestures
    // only work on touch screens, so checking for >= pointers means we're on a
    // touchscreen
    return gesture.pointers.size >= 2;
  };

  public getName = () => {
    return (
      this.state.name ||
      this.props.name ||
      `${t("labels.untitled")}-${getDateTime()}`
    );
  };

  // fires only on Safari
  private onGestureStart = withBatchedUpdates((event: GestureEvent) => {
    event.preventDefault();

    // we only want to deselect on touch screens because user may have selected
    // elements by mistake while zooming
    if (this.isTouchScreenMultiTouchGesture()) {
      this.setState({
        selectedElementIds: makeNextSelectedElementIds({}, this.state),
        activeEmbeddable: null,
      });
    }
    gesture.initialScale = this.state.zoom.value;
  });

  // fires only on Safari
  private onGestureChange = withBatchedUpdates((event: GestureEvent) => {
    event.preventDefault();

    // onGestureChange only has zoom factor but not the center.
    // If we're on iPad or iPhone, then we recognize multi-touch and will
    // zoom in at the right location in the touchmove handler
    // (handleCanvasPointerMove).
    //
    // On Macbook trackpad, we don't have those events so will zoom in at the
    // current location instead.
    //
    // As such, bail from this handler on touch devices.
    if (this.isTouchScreenMultiTouchGesture()) {
      return;
    }

    const initialScale = gesture.initialScale;
    if (initialScale) {
      this.setState((state) => ({
        ...getStateForZoom(
          {
            viewportX: this.lastViewportPosition.x,
            viewportY: this.lastViewportPosition.y,
            nextZoom: getNormalizedZoom(initialScale * event.scale),
          },
          state,
        ),
      }));
    }
  });

  // fires only on Safari
  private onGestureEnd = withBatchedUpdates((event: GestureEvent) => {
    event.preventDefault();
    // reselect elements only on touch screens (see onGestureStart)
    if (this.isTouchScreenMultiTouchGesture()) {
      this.setState({
        previousSelectedElementIds: {},
        selectedElementIds: makeNextSelectedElementIds(
          this.state.previousSelectedElementIds,
          this.state,
        ),
      });
    }
    gesture.initialScale = null;
  });

  private handleTextWysiwyg(
    element: ExcalidrawTextElement,
    {
      isExistingElement = false,
    }: {
      isExistingElement?: boolean;
    },
  ) {
    const elementsMap = this.scene.getElementsMapIncludingDeleted();

    const updateElement = (nextOriginalText: string, isDeleted: boolean) => {
      this.scene.replaceAllElements([
        // Not sure why we include deleted elements as well hence using deleted elements map
        ...this.scene.getElementsIncludingDeleted().map((_element) => {
          if (_element.id === element.id && isTextElement(_element)) {
            return newElementWith(_element, {
              originalText: nextOriginalText,
              isDeleted: isDeleted ?? _element.isDeleted,
              // returns (wrapped) text and new dimensions
              ...refreshTextDimensions(
                _element,
                getContainerElement(_element, elementsMap),
                elementsMap,
                nextOriginalText,
              ),
            });
          }
          return _element;
        }),
      ]);
    };

    textWysiwyg({
      id: element.id,
      canvas: this.canvas,
      getViewportCoords: (x, y) => {
        const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
          {
            sceneX: x,
            sceneY: y,
          },
          this.state,
        );
        return [
          viewportX - this.state.offsetLeft,
          viewportY - this.state.offsetTop,
        ];
      },
      onChange: withBatchedUpdates((nextOriginalText) => {
        updateElement(nextOriginalText, false);
        if (isNonDeletedElement(element)) {
          updateBoundElements(element, this.scene);
        }
      }),
      onSubmit: withBatchedUpdates(({ viaKeyboard, nextOriginalText }) => {
        const isDeleted = !nextOriginalText.trim();
        updateElement(nextOriginalText, isDeleted);

        // select the created text element only if submitting via keyboard
        // (when submitting via click it should act as signal to deselect)
        if (!isDeleted && viaKeyboard) {
          const elementIdToSelect = element.containerId
            ? element.containerId
            : element.id;

          // needed to ensure state is updated before "finalize" action
          // that's invoked on keyboard-submit as well
          // TODO either move this into finalize as well, or handle all state
          // updates in one place, skipping finalize action
          flushSync(() => {
            this.setState((prevState) => ({
              selectedElementIds: makeNextSelectedElementIds(
                {
                  ...prevState.selectedElementIds,
                  [elementIdToSelect]: true,
                },
                prevState,
              ),
            }));
          });
        }

        if (isDeleted) {
          fixBindingsAfterDeletion(this.scene.getNonDeletedElements(), [
            element,
          ]);
        }

        if (!isDeleted || isExistingElement) {
          this.store.scheduleCapture();
        }

        flushSync(() => {
          this.setState({
            newElement: null,
            editingTextElement: null,
          });
        });

        if (this.state.activeTool.locked) {
          setCursorForShape(this.interactiveCanvas, this.state);
        }

        this.focusContainer();
      }),
      element,
      excalidrawContainer: this.excalidrawContainerRef.current,
      app: this,
      // when text is selected, it's hard (at least on iOS) to re-position the
      // caret (i.e. deselect). There's not much use for always selecting
      // the text on edit anyway (and users can select-all from contextmenu
      // if needed)
      autoSelect: !this.device.isTouchScreen,
    });
    // deselect all other elements when inserting text
    this.deselectElements();

    // do an initial update to re-initialize element position since we were
    // modifying element's x/y for sake of editor (case: syncing to remote)
    updateElement(element.originalText, false);
  }

  private deselectElements() {
    this.setState({
      selectedElementIds: makeNextSelectedElementIds({}, this.state),
      selectedGroupIds: {},
      editingGroupId: null,
      activeEmbeddable: null,
    });
  }

  private getTextElementAtPosition(
    x: number,
    y: number,
  ): NonDeleted<ExcalidrawTextElement> | null {
    const element = this.getElementAtPosition(x, y, {
      includeBoundTextElement: true,
    });
    if (element && isTextElement(element) && !element.isDeleted) {
      return element;
    }
    return null;
  }

  // NOTE: Hot path for hit testing, so avoid unnecessary computations
  private getElementAtPosition(
    x: number,
    y: number,
    opts?: (
      | {
          includeBoundTextElement?: boolean;
          includeLockedElements?: boolean;
        }
      | {
          allHitElements: NonDeleted<ExcalidrawElement>[];
        }
    ) & {
      preferSelected?: boolean;
    },
  ): NonDeleted<ExcalidrawElement> | null {
    let allHitElements: NonDeleted<ExcalidrawElement>[] = [];
    if (opts && "allHitElements" in opts) {
      allHitElements = opts?.allHitElements || [];
    } else {
      allHitElements = this.getElementsAtPosition(x, y, {
        includeBoundTextElement: opts?.includeBoundTextElement,
        includeLockedElements: opts?.includeLockedElements,
      });
    }

    if (allHitElements.length > 1) {
      if (opts?.preferSelected) {
        for (let index = allHitElements.length - 1; index > -1; index--) {
          if (this.state.selectedElementIds[allHitElements[index].id]) {
            return allHitElements[index];
          }
        }
      }
      const elementWithHighestZIndex =
        allHitElements[allHitElements.length - 1];

      // If we're hitting element with highest z-index only on its bounding box
      // while also hitting other element figure, the latter should be considered.
      return hitElementItself({
        point: pointFrom(x, y),
        element: elementWithHighestZIndex,
        // when overlapping, we would like to be more precise
        // this also avoids the need to update past tests
        threshold: this.getElementHitThreshold(elementWithHighestZIndex) / 2,
        elementsMap: this.scene.getNonDeletedElementsMap(),
        frameNameBound: isFrameLikeElement(elementWithHighestZIndex)
          ? this.frameNameBoundsCache.get(elementWithHighestZIndex)
          : null,
      })
        ? elementWithHighestZIndex
        : allHitElements[allHitElements.length - 2];
    }
    if (allHitElements.length === 1) {
      return allHitElements[0];
    }

    return null;
  }

  // NOTE: Hot path for hit testing, so avoid unnecessary computations
  private getElementsAtPosition(
    x: number,
    y: number,
    opts?: {
      includeBoundTextElement?: boolean;
      includeLockedElements?: boolean;
    },
  ): NonDeleted<ExcalidrawElement>[] {
    const iframeLikes: Ordered<ExcalidrawIframeElement>[] = [];

    const elementsMap = this.scene.getNonDeletedElementsMap();

    const elements = (
      opts?.includeBoundTextElement && opts?.includeLockedElements
        ? this.scene.getNonDeletedElements()
        : this.scene
            .getNonDeletedElements()
            .filter(
              (element) =>
                (opts?.includeLockedElements || !element.locked) &&
                (opts?.includeBoundTextElement ||
                  !(isTextElement(element) && element.containerId)),
            )
    )
      .filter((el) => this.hitElement(x, y, el))
      .filter((element) => {
        // hitting a frame's element from outside the frame is not considered a hit
        const containingFrame = getContainingFrame(element, elementsMap);
        return containingFrame &&
          this.state.frameRendering.enabled &&
          this.state.frameRendering.clip
          ? isCursorInFrame({ x, y }, containingFrame, elementsMap)
          : true;
      })
      .filter((el) => {
        // The parameter elements comes ordered from lower z-index to higher.
        // We want to preserve that order on the returned array.
        // Exception being embeddables which should be on top of everything else in
        // terms of hit testing.
        if (isIframeElement(el)) {
          iframeLikes.push(el);
          return false;
        }
        return true;
      })
      .concat(iframeLikes) as NonDeleted<ExcalidrawElement>[];

    return elements;
  }

  getElementHitThreshold(element: ExcalidrawElement) {
    return Math.max(
      element.strokeWidth / 2 + 0.1,
      // NOTE: Here be dragons. Do not go under the 0.63 multiplier unless you're
      // willing to test extensively. The hit testing starts to become unreliable
      // due to FP imprecision under 0.63 in high zoom levels.
      0.85 * (DEFAULT_COLLISION_THRESHOLD / this.state.zoom.value),
    );
  }

  private hitElement(
    x: number,
    y: number,
    element: ExcalidrawElement,
    considerBoundingBox = true,
  ) {
    // if the element is selected, then hit test is done against its bounding box
    if (
      considerBoundingBox &&
      this.state.selectedElementIds[element.id] &&
      shouldShowBoundingBox([element], this.state)
    ) {
      // if hitting the bounding box, return early
      // but if not, we should check for other cases as well (e.g. frame name)
      if (
        hitElementBoundingBox(
          pointFrom(x, y),
          element,
          this.scene.getNonDeletedElementsMap(),
          this.getElementHitThreshold(element),
        )
      ) {
        return true;
      }
    }

    // take bound text element into consideration for hit collision as well
    const hitBoundTextOfElement = hitElementBoundText(
      pointFrom(x, y),
      element,
      this.scene.getNonDeletedElementsMap(),
    );
    if (hitBoundTextOfElement) {
      return true;
    }

    return hitElementItself({
      point: pointFrom(x, y),
      element,
      threshold: this.getElementHitThreshold(element),
      elementsMap: this.scene.getNonDeletedElementsMap(),
      frameNameBound: isFrameLikeElement(element)
        ? this.frameNameBoundsCache.get(element)
        : null,
    });
  }

  private getTextBindableContainerAtPosition(x: number, y: number) {
    const elements = this.scene.getNonDeletedElements();
    const selectedElements = this.scene.getSelectedElements(this.state);
    if (selectedElements.length === 1) {
      return isTextBindableContainer(selectedElements[0], false)
        ? selectedElements[0]
        : null;
    }
    let hitElement = null;
    // We need to do hit testing from front (end of the array) to back (beginning of the array)
    for (let index = elements.length - 1; index >= 0; --index) {
      if (elements[index].isDeleted) {
        continue;
      }
      const [x1, y1, x2, y2] = getElementAbsoluteCoords(
        elements[index],
        this.scene.getNonDeletedElementsMap(),
      );
      if (
        isArrowElement(elements[index]) &&
        hitElementItself({
          point: pointFrom(x, y),
          element: elements[index],
          elementsMap: this.scene.getNonDeletedElementsMap(),
          threshold: this.getElementHitThreshold(elements[index]),
        })
      ) {
        hitElement = elements[index];
        break;
      } else if (x1 < x && x < x2 && y1 < y && y < y2) {
        hitElement = elements[index];
        break;
      }
    }

    return isTextBindableContainer(hitElement, false) ? hitElement : null;
  }

  private startTextEditing = ({
    sceneX,
    sceneY,
    insertAtParentCenter = true,
    container,
    autoEdit = true,
  }: {
    /** X position to insert text at */
    sceneX: number;
    /** Y position to insert text at */
    sceneY: number;
    /** whether to attempt to insert at element center if applicable */
    insertAtParentCenter?: boolean;
    container?: ExcalidrawTextContainer | null;
    autoEdit?: boolean;
  }) => {
    let shouldBindToContainer = false;

    let parentCenterPosition =
      insertAtParentCenter &&
      this.getTextWysiwygSnappedToCenterPosition(
        sceneX,
        sceneY,
        this.state,
        container,
      );
    if (container && parentCenterPosition) {
      const boundTextElementToContainer = getBoundTextElement(
        container,
        this.scene.getNonDeletedElementsMap(),
      );
      if (!boundTextElementToContainer) {
        shouldBindToContainer = true;
      }
    }
    let existingTextElement: NonDeleted<ExcalidrawTextElement> | null = null;

    const selectedElements = this.scene.getSelectedElements(this.state);

    if (selectedElements.length === 1) {
      if (isTextElement(selectedElements[0])) {
        existingTextElement = selectedElements[0];
      } else if (container) {
        existingTextElement = getBoundTextElement(
          selectedElements[0],
          this.scene.getNonDeletedElementsMap(),
        );
      } else {
        existingTextElement = this.getTextElementAtPosition(sceneX, sceneY);
      }
    } else {
      existingTextElement = this.getTextElementAtPosition(sceneX, sceneY);
    }

    const fontFamily =
      existingTextElement?.fontFamily || this.state.currentItemFontFamily;

    const lineHeight =
      existingTextElement?.lineHeight || getLineHeight(fontFamily);
    const fontSize = this.state.currentItemFontSize;

    if (
      !existingTextElement &&
      shouldBindToContainer &&
      container &&
      !isArrowElement(container)
    ) {
      const fontString = {
        fontSize,
        fontFamily,
      };
      const minWidth = getApproxMinLineWidth(
        getFontString(fontString),
        lineHeight,
      );
      const minHeight = getApproxMinLineHeight(fontSize, lineHeight);
      const newHeight = Math.max(container.height, minHeight);
      const newWidth = Math.max(container.width, minWidth);
      this.scene.mutateElement(container, {
        height: newHeight,
        width: newWidth,
      });
      sceneX = container.x + newWidth / 2;
      sceneY = container.y + newHeight / 2;
      if (parentCenterPosition) {
        parentCenterPosition = this.getTextWysiwygSnappedToCenterPosition(
          sceneX,
          sceneY,
          this.state,
          container,
        );
      }
    }

    const topLayerFrame = this.getTopLayerFrameAtSceneCoords({
      x: sceneX,
      y: sceneY,
    });

    const element =
      existingTextElement ||
      newTextElement({
        x: parentCenterPosition ? parentCenterPosition.elementCenterX : sceneX,
        y: parentCenterPosition ? parentCenterPosition.elementCenterY : sceneY,
        strokeColor: this.state.currentItemStrokeColor,
        backgroundColor: this.state.currentItemBackgroundColor,
        fillStyle: this.state.currentItemFillStyle,
        strokeWidth: this.state.currentItemStrokeWidth,
        strokeStyle: this.state.currentItemStrokeStyle,
        roughness: this.state.currentItemRoughness,
        opacity: this.state.currentItemOpacity,
        text: "",
        fontSize,
        fontFamily,
        textAlign: parentCenterPosition
          ? "center"
          : this.state.currentItemTextAlign,
        verticalAlign: parentCenterPosition
          ? VERTICAL_ALIGN.MIDDLE
          : DEFAULT_VERTICAL_ALIGN,
        containerId: shouldBindToContainer ? container?.id : undefined,
        groupIds: container?.groupIds ?? [],
        lineHeight,
        angle: container
          ? isArrowElement(container)
            ? (0 as Radians)
            : container.angle
          : (0 as Radians),
        frameId: topLayerFrame ? topLayerFrame.id : null,
      });

    if (!existingTextElement && shouldBindToContainer && container) {
      this.scene.mutateElement(container, {
        boundElements: (container.boundElements || []).concat({
          type: "text",
          id: element.id,
        }),
      });
    }
    this.setState({ editingTextElement: element });

    if (!existingTextElement) {
      if (container && shouldBindToContainer) {
        const containerIndex = this.scene.getElementIndex(container.id);
        this.scene.insertElementAtIndex(element, containerIndex + 1);
      } else {
        this.scene.insertElement(element);
      }
    }

    if (autoEdit || existingTextElement || container) {
      this.handleTextWysiwyg(element, {
        isExistingElement: !!existingTextElement,
      });
    } else {
      this.setState({
        newElement: element,
        multiElement: null,
      });
    }
  };

  private startImageCropping = (image: ExcalidrawImageElement) => {
    this.store.scheduleCapture();
    this.setState({
      croppingElementId: image.id,
    });
  };

  private finishImageCropping = () => {
    if (this.state.croppingElementId) {
      this.store.scheduleCapture();
      this.setState({
        croppingElementId: null,
      });
    }
  };

  private handleCanvasDoubleClick = (
    event: React.MouseEvent<HTMLCanvasElement>,
  ) => {
    // case: double-clicking with arrow/line tool selected would both create
    // text and enter multiElement mode
    if (this.state.multiElement) {
      return;
    }
    // we should only be able to double click when mode is selection
    if (this.state.activeTool.type !== this.defaultSelectionTool) {
      return;
    }

    const selectedElements = this.scene.getSelectedElements(this.state);

    let { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
      event,
      this.state,
    );

    if (selectedElements.length === 1 && isLinearElement(selectedElements[0])) {
      const selectedLinearElement: ExcalidrawLinearElement =
        selectedElements[0];
      if (
        ((event[KEYS.CTRL_OR_CMD] && isSimpleArrow(selectedLinearElement)) ||
          isLineElement(selectedLinearElement)) &&
        (!this.state.selectedLinearElement?.isEditing ||
          this.state.selectedLinearElement.elementId !==
            selectedLinearElement.id)
      ) {
        // Use the proper action to ensure immediate history capture
        this.actionManager.executeAction(actionToggleLinearEditor);
        return;
      } else if (
        this.state.selectedLinearElement &&
        isElbowArrow(selectedElements[0])
      ) {
        const hitCoords = LinearElementEditor.getSegmentMidpointHitCoords(
          this.state.selectedLinearElement,
          { x: sceneX, y: sceneY },
          this.state,
          this.scene.getNonDeletedElementsMap(),
        );
        const midPoint = hitCoords
          ? LinearElementEditor.getSegmentMidPointIndex(
              this.state.selectedLinearElement,
              this.state,
              hitCoords,
              this.scene.getNonDeletedElementsMap(),
            )
          : -1;

        if (midPoint && midPoint > -1) {
          this.store.scheduleCapture();
          LinearElementEditor.deleteFixedSegment(
            selectedElements[0],
            this.scene,
            midPoint,
          );

          const nextCoords = LinearElementEditor.getSegmentMidpointHitCoords(
            {
              ...this.state.selectedLinearElement,
              segmentMidPointHoveredCoords: null,
            },
            { x: sceneX, y: sceneY },
            this.state,
            this.scene.getNonDeletedElementsMap(),
          );
          const nextIndex = nextCoords
            ? LinearElementEditor.getSegmentMidPointIndex(
                this.state.selectedLinearElement,
                this.state,
                nextCoords,
                this.scene.getNonDeletedElementsMap(),
              )
            : null;

          this.setState({
            selectedLinearElement: {
              ...this.state.selectedLinearElement,
              pointerDownState: {
                ...this.state.selectedLinearElement.pointerDownState,
                segmentMidpoint: {
                  index: nextIndex,
                  value: hitCoords,
                  added: false,
                },
              },
              segmentMidPointHoveredCoords: nextCoords,
            },
          });

          return;
        }
      } else if (
        this.state.selectedLinearElement?.isEditing &&
        this.state.selectedLinearElement.elementId ===
          selectedLinearElement.id &&
        isLineElement(selectedLinearElement)
      ) {
        return;
      }
    }

    if (selectedElements.length === 1 && isImageElement(selectedElements[0])) {
      this.startImageCropping(selectedElements[0]);
      return;
    }

    resetCursor(this.interactiveCanvas);

    const selectedGroupIds = getSelectedGroupIds(this.state);

    if (selectedGroupIds.length > 0) {
      const hitElement = this.getElementAtPosition(sceneX, sceneY);

      const selectedGroupId =
        hitElement &&
        getSelectedGroupIdForElement(hitElement, this.state.selectedGroupIds);

      if (selectedGroupId) {
        this.store.scheduleCapture();
        this.setState((prevState) => ({
          ...prevState,
          ...selectGroupsForSelectedElements(
            {
              editingGroupId: selectedGroupId,
              selectedElementIds: { [hitElement!.id]: true },
            },
            this.scene.getNonDeletedElements(),
            prevState,
            this,
          ),
        }));
        return;
      }
    }

    resetCursor(this.interactiveCanvas);
    if (!event[KEYS.CTRL_OR_CMD] && !this.state.viewModeEnabled) {
      const hitElement = this.getElementAtPosition(sceneX, sceneY);

      if (isIframeLikeElement(hitElement)) {
        this.setState({
          activeEmbeddable: { element: hitElement, state: "active" },
        });
        return;
      }

      // shouldn't edit/create text when inside line editor (often false positive)

      if (!this.state.selectedLinearElement?.isEditing) {
        const container = this.getTextBindableContainerAtPosition(
          sceneX,
          sceneY,
        );

        if (container) {
          if (
            hasBoundTextElement(container) ||
            !isTransparent(container.backgroundColor) ||
            hitElementItself({
              point: pointFrom(sceneX, sceneY),
              element: container,
              elementsMap: this.scene.getNonDeletedElementsMap(),
              threshold: this.getElementHitThreshold(container),
            })
          ) {
            const midPoint = getContainerCenter(
              container,
              this.state,
              this.scene.getNonDeletedElementsMap(),
            );

            sceneX = midPoint.x;
            sceneY = midPoint.y;
          }
        }

        this.startTextEditing({
          sceneX,
          sceneY,
          insertAtParentCenter: !event.altKey,
          container,
        });
      }
    }
  };

  private getElementLinkAtPosition = (
    scenePointer: Readonly<{ x: number; y: number }>,
    hitElementMightBeLocked: NonDeletedExcalidrawElement | null,
  ): ExcalidrawElement | undefined => {
    if (hitElementMightBeLocked && hitElementMightBeLocked.locked) {
      return undefined;
    }

    const elements = this.scene.getNonDeletedElements();
    let hitElementIndex = -1;

    for (let index = elements.length - 1; index >= 0; index--) {
      const element = elements[index];
      if (
        hitElementMightBeLocked &&
        element.id === hitElementMightBeLocked.id
      ) {
        hitElementIndex = index;
      }
      if (
        element.link &&
        index >= hitElementIndex &&
        isPointHittingLink(
          element,
          this.scene.getNonDeletedElementsMap(),
          this.state,
          pointFrom(scenePointer.x, scenePointer.y),
          this.device.editor.isMobile,
        )
      ) {
        return element;
      }
    }
  };

  private redirectToLink = (
    event: React.PointerEvent<HTMLCanvasElement>,
    isTouchScreen: boolean,
  ) => {
    const draggedDistance = pointDistance(
      pointFrom(
        this.lastPointerDownEvent!.clientX,
        this.lastPointerDownEvent!.clientY,
      ),
      pointFrom(
        this.lastPointerUpEvent!.clientX,
        this.lastPointerUpEvent!.clientY,
      ),
    );
    if (!this.hitLinkElement || draggedDistance > DRAGGING_THRESHOLD) {
      return;
    }
    const lastPointerDownCoords = viewportCoordsToSceneCoords(
      this.lastPointerDownEvent!,
      this.state,
    );
    const elementsMap = this.scene.getNonDeletedElementsMap();
    const lastPointerDownHittingLinkIcon = isPointHittingLink(
      this.hitLinkElement,
      elementsMap,
      this.state,
      pointFrom(lastPointerDownCoords.x, lastPointerDownCoords.y),
      this.device.editor.isMobile,
    );
    const lastPointerUpCoords = viewportCoordsToSceneCoords(
      this.lastPointerUpEvent!,
      this.state,
    );
    const lastPointerUpHittingLinkIcon = isPointHittingLink(
      this.hitLinkElement,
      elementsMap,
      this.state,
      pointFrom(lastPointerUpCoords.x, lastPointerUpCoords.y),
      this.device.editor.isMobile,
    );
    if (lastPointerDownHittingLinkIcon && lastPointerUpHittingLinkIcon) {
      hideHyperlinkToolip();
      let url = this.hitLinkElement.link;
      if (url) {
        url = normalizeLink(url);
        let customEvent;
        if (this.props.onLinkOpen) {
          customEvent = wrapEvent(EVENT.EXCALIDRAW_LINK, event.nativeEvent);
          this.props.onLinkOpen(
            {
              ...this.hitLinkElement,
              link: url,
            },
            customEvent,
          );
        }
        if (!customEvent?.defaultPrevented) {
          const target = isLocalLink(url) ? "_self" : "_blank";
          const newWindow = window.open(undefined, target);
          // https://mathiasbynens.github.io/rel-noopener/
          if (newWindow) {
            newWindow.opener = null;
            newWindow.location = url;
          }
        }
      }
    }
  };

  private getTopLayerFrameAtSceneCoords = (sceneCoords: {
    x: number;
    y: number;
  }) => {
    const elementsMap = this.scene.getNonDeletedElementsMap();
    const frames = this.scene
      .getNonDeletedFramesLikes()
      .filter(
        (frame): frame is ExcalidrawFrameLikeElement =>
          !frame.locked && isCursorInFrame(sceneCoords, frame, elementsMap),
      );

    return frames.length ? frames[frames.length - 1] : null;
  };

  private handleCanvasPointerMove = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    this.savePointer(event.clientX, event.clientY, this.state.cursorButton);
    this.lastPointerMoveEvent = event.nativeEvent;

    if (gesture.pointers.has(event.pointerId)) {
      gesture.pointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    const initialScale = gesture.initialScale;
    if (
      gesture.pointers.size === 2 &&
      gesture.lastCenter &&
      initialScale &&
      gesture.initialDistance
    ) {
      const center = getCenter(gesture.pointers);
      const deltaX = center.x - gesture.lastCenter.x;
      const deltaY = center.y - gesture.lastCenter.y;
      gesture.lastCenter = center;

      const distance = getDistance(Array.from(gesture.pointers.values()));
      const scaleFactor =
        this.state.activeTool.type === "freedraw" && this.state.penMode
          ? 1
          : distance / gesture.initialDistance;

      const nextZoom = scaleFactor
        ? getNormalizedZoom(initialScale * scaleFactor)
        : this.state.zoom.value;

      this.setState((state) => {
        const zoomState = getStateForZoom(
          {
            viewportX: center.x,
            viewportY: center.y,
            nextZoom,
          },
          state,
        );

        this.translateCanvas({
          zoom: zoomState.zoom,
          // 2x multiplier is just a magic number that makes this work correctly
          // on touchscreen devices (note: if we get report that panning is slower/faster
          // than actual movement, consider swapping with devicePixelRatio)
          scrollX: zoomState.scrollX + 2 * (deltaX / nextZoom),
          scrollY: zoomState.scrollY + 2 * (deltaY / nextZoom),
          shouldCacheIgnoreZoom: true,
        });
      });
      this.resetShouldCacheIgnoreZoomDebounced();
    } else {
      gesture.lastCenter =
        gesture.initialDistance =
        gesture.initialScale =
          null;
    }

    if (
      isHoldingSpace ||
      isPanning ||
      isDraggingScrollBar ||
      isHandToolActive(this.state)
    ) {
      return;
    }

    const isPointerOverScrollBars = isOverScrollBars(
      currentScrollBars,
      event.clientX - this.state.offsetLeft,
      event.clientY - this.state.offsetTop,
    );
    const isOverScrollBar = isPointerOverScrollBars.isOverEither;
    if (
      !this.state.newElement &&
      !this.state.selectionElement &&
      !this.state.selectedElementsAreBeingDragged &&
      !this.state.multiElement
    ) {
      if (isOverScrollBar) {
        resetCursor(this.interactiveCanvas);
      } else {
        setCursorForShape(this.interactiveCanvas, this.state);
      }
    }

    const scenePointer = viewportCoordsToSceneCoords(event, this.state);
    const { x: scenePointerX, y: scenePointerY } = scenePointer;

    if (
      !this.state.newElement &&
      isActiveToolNonLinearSnappable(this.state.activeTool.type)
    ) {
      const { originOffset, snapLines } = getSnapLinesAtPointer(
        this.scene.getNonDeletedElements(),
        this,
        {
          x: scenePointerX,
          y: scenePointerY,
        },
        event,
        this.scene.getNonDeletedElementsMap(),
      );

      this.setState((prevState) => {
        const nextSnapLines = updateStable(prevState.snapLines, snapLines);
        const nextOriginOffset = prevState.originSnapOffset
          ? updateStable(prevState.originSnapOffset, originOffset)
          : originOffset;

        if (
          prevState.snapLines === nextSnapLines &&
          prevState.originSnapOffset === nextOriginOffset
        ) {
          return null;
        }
        return {
          snapLines: nextSnapLines,
          originSnapOffset: nextOriginOffset,
        };
      });
    } else if (
      !this.state.newElement &&
      !this.state.selectedElementsAreBeingDragged &&
      !this.state.selectionElement
    ) {
      this.setState((prevState) => {
        if (prevState.snapLines.length) {
          return {
            snapLines: [],
          };
        }
        return null;
      });
    }

    if (
      this.state.selectedLinearElement?.isEditing &&
      !this.state.selectedLinearElement.isDragging
    ) {
      const editingLinearElement = LinearElementEditor.handlePointerMove(
        event,
        scenePointerX,
        scenePointerY,
        this,
      );
      const linearElement = editingLinearElement
        ? this.scene.getElement(editingLinearElement.elementId)
        : null;

      if (
        editingLinearElement &&
        editingLinearElement !== this.state.selectedLinearElement
      ) {
        // Since we are reading from previous state which is not possible with
        // automatic batching in React 18 hence using flush sync to synchronously
        // update the state. Check https://github.com/excalidraw/excalidraw/pull/5508 for more details.
        flushSync(() => {
          this.setState({
            selectedLinearElement: editingLinearElement,
          });
        });
      }
      if (
        editingLinearElement?.lastUncommittedPoint != null &&
        linearElement &&
        isBindingElementType(linearElement.type)
      ) {
        this.maybeSuggestBindingAtCursor(
          scenePointer,
          editingLinearElement.elbowed,
        );
      } else if (this.state.suggestedBindings.length) {
        this.setState({ suggestedBindings: [] });
      }
    }

    if (isBindingElementType(this.state.activeTool.type)) {
      // Hovering with a selected tool or creating new linear element via click
      // and point
      const { newElement } = this.state;
      if (isBindingElement(newElement, false)) {
        this.setState({
          suggestedBindings: maybeSuggestBindingsForLinearElementAtCoords(
            newElement,
            [scenePointer],
            this.scene,
            this.state.zoom,
            this.state.startBoundElement,
          ),
        });
      } else {
        this.maybeSuggestBindingAtCursor(scenePointer, false);
      }
    }

    if (this.state.multiElement) {
      const { multiElement } = this.state;
      const { x: rx, y: ry } = multiElement;

      const { points, lastCommittedPoint } = multiElement;
      const lastPoint = points[points.length - 1];

      setCursorForShape(this.interactiveCanvas, this.state);

      if (lastPoint === lastCommittedPoint) {
        // if we haven't yet created a temp point and we're beyond commit-zone
        // threshold, add a point
        if (
          pointDistance(
            pointFrom(scenePointerX - rx, scenePointerY - ry),
            lastPoint,
          ) >= LINE_CONFIRM_THRESHOLD
        ) {
          this.scene.mutateElement(
            multiElement,
            {
              points: [
                ...points,
                pointFrom<LocalPoint>(scenePointerX - rx, scenePointerY - ry),
              ],
            },
            { informMutation: false, isDragging: false },
          );
        } else {
          setCursor(this.interactiveCanvas, CURSOR_TYPE.POINTER);
          // in this branch, we're inside the commit zone, and no uncommitted
          // point exists. Thus do nothing (don't add/remove points).
        }
      } else if (
        points.length > 2 &&
        lastCommittedPoint &&
        pointDistance(
          pointFrom(scenePointerX - rx, scenePointerY - ry),
          lastCommittedPoint,
        ) < LINE_CONFIRM_THRESHOLD
      ) {
        setCursor(this.interactiveCanvas, CURSOR_TYPE.POINTER);
        this.scene.mutateElement(
          multiElement,
          {
            points: points.slice(0, -1),
          },
          { informMutation: false, isDragging: false },
        );
      } else {
        const [gridX, gridY] = getGridPoint(
          scenePointerX,
          scenePointerY,
          event[KEYS.CTRL_OR_CMD] || isElbowArrow(multiElement)
            ? null
            : this.getEffectiveGridSize(),
        );

        const [lastCommittedX, lastCommittedY] =
          multiElement?.lastCommittedPoint ?? [0, 0];

        let dxFromLastCommitted = gridX - rx - lastCommittedX;
        let dyFromLastCommitted = gridY - ry - lastCommittedY;

        if (shouldRotateWithDiscreteAngle(event)) {
          ({ width: dxFromLastCommitted, height: dyFromLastCommitted } =
            getLockedLinearCursorAlignSize(
              // actual coordinate of the last committed point
              lastCommittedX + rx,
              lastCommittedY + ry,
              // cursor-grid coordinate
              gridX,
              gridY,
            ));
        }

        if (isPathALoop(points, this.state.zoom.value)) {
          setCursor(this.interactiveCanvas, CURSOR_TYPE.POINTER);
        }

        // update last uncommitted point
        this.scene.mutateElement(
          multiElement,
          {
            points: [
              ...points.slice(0, -1),
              pointFrom<LocalPoint>(
                lastCommittedX + dxFromLastCommitted,
                lastCommittedY + dyFromLastCommitted,
              ),
            ],
          },
          {
            isDragging: true,
            informMutation: false,
          },
        );

        // in this path, we're mutating multiElement to reflect
        // how it will be after adding pointer position as the next point
        // trigger update here so that new element canvas renders again to reflect this
        this.triggerRender(false);
      }

      return;
    }

    const hasDeselectedButton = Boolean(event.buttons);
    if (
      hasDeselectedButton ||
      (this.state.activeTool.type !== "selection" &&
        this.state.activeTool.type !== "lasso" &&
        this.state.activeTool.type !== "text" &&
        this.state.activeTool.type !== "eraser")
    ) {
      return;
    }

    const elements = this.scene.getNonDeletedElements();

    const selectedElements = this.scene.getSelectedElements(this.state);
    if (
      selectedElements.length === 1 &&
      !isOverScrollBar &&
      !this.state.selectedLinearElement?.isEditing
    ) {
      // for linear elements, we'd like to prioritize point dragging over edge resizing
      // therefore, we update and check hovered point index first
      if (this.state.selectedLinearElement) {
        this.handleHoverSelectedLinearElement(
          this.state.selectedLinearElement,
          scenePointerX,
          scenePointerY,
        );
      }

      if (
        (!this.state.selectedLinearElement ||
          this.state.selectedLinearElement.hoverPointIndex === -1) &&
        this.state.openDialog?.name !== "elementLinkSelector" &&
        !(selectedElements.length === 1 && isElbowArrow(selectedElements[0]))
      ) {
        const elementWithTransformHandleType =
          getElementWithTransformHandleType(
            elements,
            this.state,
            scenePointerX,
            scenePointerY,
            this.state.zoom,
            event.pointerType,
            this.scene.getNonDeletedElementsMap(),
            this.device,
          );
        if (
          elementWithTransformHandleType &&
          elementWithTransformHandleType.transformHandleType
        ) {
          setCursor(
            this.interactiveCanvas,
            getCursorForResizingElement(elementWithTransformHandleType),
          );
          return;
        }
      }
    } else if (
      selectedElements.length > 1 &&
      !isOverScrollBar &&
      this.state.openDialog?.name !== "elementLinkSelector"
    ) {
      const transformHandleType = getTransformHandleTypeFromCoords(
        getCommonBounds(selectedElements),
        scenePointerX,
        scenePointerY,
        this.state.zoom,
        event.pointerType,
        this.device,
      );
      if (transformHandleType) {
        setCursor(
          this.interactiveCanvas,
          getCursorForResizingElement({
            transformHandleType,
          }),
        );
        return;
      }
    }

    const hitElementMightBeLocked = this.getElementAtPosition(
      scenePointerX,
      scenePointerY,
      {
        preferSelected: true,
        includeLockedElements: true,
      },
    );

    let hitElement: ExcalidrawElement | null = null;
    if (hitElementMightBeLocked && hitElementMightBeLocked.locked) {
      hitElement = null;
    } else {
      hitElement = hitElementMightBeLocked;
    }

    this.hitLinkElement = this.getElementLinkAtPosition(
      scenePointer,
      hitElementMightBeLocked,
    );
    if (isEraserActive(this.state)) {
      return;
    }
    if (
      this.hitLinkElement &&
      !this.state.selectedElementIds[this.hitLinkElement.id]
    ) {
      setCursor(this.interactiveCanvas, CURSOR_TYPE.POINTER);
      showHyperlinkTooltip(
        this.hitLinkElement,
        this.state,
        this.scene.getNonDeletedElementsMap(),
      );
    } else {
      hideHyperlinkToolip();
      if (
        hitElement &&
        (hitElement.link || isEmbeddableElement(hitElement)) &&
        this.state.selectedElementIds[hitElement.id] &&
        !this.state.contextMenu &&
        !this.state.showHyperlinkPopup
      ) {
        this.setState({ showHyperlinkPopup: "info" });
      } else if (this.state.activeTool.type === "text") {
        setCursor(
          this.interactiveCanvas,
          isTextElement(hitElement) ? CURSOR_TYPE.TEXT : CURSOR_TYPE.CROSSHAIR,
        );
      } else if (this.state.viewModeEnabled) {
        setCursor(this.interactiveCanvas, CURSOR_TYPE.GRAB);
      } else if (this.state.openDialog?.name === "elementLinkSelector") {
        setCursor(this.interactiveCanvas, CURSOR_TYPE.AUTO);
      } else if (isOverScrollBar) {
        setCursor(this.interactiveCanvas, CURSOR_TYPE.AUTO);
      } else if (
        // if using cmd/ctrl, we're not dragging
        !event[KEYS.CTRL_OR_CMD]
      ) {
        if (
          (hitElement ||
            this.isHittingCommonBoundingBoxOfSelectedElements(
              scenePointer,
              selectedElements,
            )) &&
          !hitElement?.locked
        ) {
          if (
            hitElement &&
            isIframeLikeElement(hitElement) &&
            this.isIframeLikeElementCenter(
              hitElement,
              event,
              scenePointerX,
              scenePointerY,
            )
          ) {
            setCursor(this.interactiveCanvas, CURSOR_TYPE.POINTER);
            this.setState({
              activeEmbeddable: { element: hitElement, state: "hover" },
            });
          } else if (
            !hitElement ||
            // Ebow arrows can only be moved when unconnected
            !isElbowArrow(hitElement) ||
            !(hitElement.startBinding || hitElement.endBinding)
          ) {
            if (
              this.state.activeTool.type !== "lasso" ||
              selectedElements.length > 0
            ) {
              setCursor(this.interactiveCanvas, CURSOR_TYPE.MOVE);
            }
            if (this.state.activeEmbeddable?.state === "hover") {
              this.setState({ activeEmbeddable: null });
            }
          }
        }
      } else {
        setCursor(this.interactiveCanvas, CURSOR_TYPE.AUTO);
      }

      if (this.state.selectedLinearElement) {
        this.handleHoverSelectedLinearElement(
          this.state.selectedLinearElement,
          scenePointerX,
          scenePointerY,
        );
      }
    }

    if (this.state.openDialog?.name === "elementLinkSelector" && hitElement) {
      this.setState((prevState) => {
        return {
          hoveredElementIds: updateStable(
            prevState.hoveredElementIds,
            selectGroupsForSelectedElements(
              {
                editingGroupId: prevState.editingGroupId,
                selectedElementIds: { [hitElement!.id]: true },
              },
              this.scene.getNonDeletedElements(),
              prevState,
              this,
            ).selectedElementIds,
          ),
        };
      });
    } else if (
      this.state.openDialog?.name === "elementLinkSelector" &&
      !hitElement
    ) {
      this.setState((prevState) => ({
        hoveredElementIds: updateStable(prevState.hoveredElementIds, {}),
      }));
    }
  };

  private handleEraser = (
    event: PointerEvent,
    scenePointer: { x: number; y: number },
  ) => {
    const elementsToErase = this.eraserTrail.addPointToPath(
      scenePointer.x,
      scenePointer.y,
      event.altKey,
    );

    this.elementsPendingErasure = new Set(elementsToErase);
    this.triggerRender();
  };

  // set touch moving for mobile context menu
  private handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    invalidateContextMenu = true;
  };

  handleHoverSelectedLinearElement(
    linearElementEditor: LinearElementEditor,
    scenePointerX: number,
    scenePointerY: number,
  ) {
    const elementsMap = this.scene.getNonDeletedElementsMap();

    const element = LinearElementEditor.getElement(
      linearElementEditor.elementId,
      elementsMap,
    );

    if (!element) {
      return;
    }
    if (this.state.selectedLinearElement) {
      let hoverPointIndex = -1;
      let segmentMidPointHoveredCoords = null;
      if (
        hitElementItself({
          point: pointFrom(scenePointerX, scenePointerY),
          element,
          elementsMap,
          threshold: this.getElementHitThreshold(element),
        })
      ) {
        hoverPointIndex = LinearElementEditor.getPointIndexUnderCursor(
          element,
          elementsMap,
          this.state.zoom,
          scenePointerX,
          scenePointerY,
        );
        segmentMidPointHoveredCoords =
          LinearElementEditor.getSegmentMidpointHitCoords(
            linearElementEditor,
            { x: scenePointerX, y: scenePointerY },
            this.state,
            this.scene.getNonDeletedElementsMap(),
          );
        const isHoveringAPointHandle = isElbowArrow(element)
          ? hoverPointIndex === 0 ||
            hoverPointIndex === element.points.length - 1
          : hoverPointIndex >= 0;
        if (isHoveringAPointHandle || segmentMidPointHoveredCoords) {
          setCursor(this.interactiveCanvas, CURSOR_TYPE.POINTER);
        } else if (this.hitElement(scenePointerX, scenePointerY, element)) {
          if (
            // Ebow arrows can only be moved when unconnected
            !isElbowArrow(element) ||
            !(element.startBinding || element.endBinding)
          ) {
            if (
              this.state.activeTool.type !== "lasso" ||
              Object.keys(this.state.selectedElementIds).length > 0
            ) {
              setCursor(this.interactiveCanvas, CURSOR_TYPE.MOVE);
            }
          }
        }
      } else if (this.hitElement(scenePointerX, scenePointerY, element)) {
        if (
          // Ebow arrows can only be moved when unconnected
          !isElbowArrow(element) ||
          !(element.startBinding || element.endBinding)
        ) {
          if (
            this.state.activeTool.type !== "lasso" ||
            Object.keys(this.state.selectedElementIds).length > 0
          ) {
            setCursor(this.interactiveCanvas, CURSOR_TYPE.MOVE);
          }
        }
      }

      if (
        this.state.selectedLinearElement.hoverPointIndex !== hoverPointIndex
      ) {
        this.setState({
          selectedLinearElement: {
            ...this.state.selectedLinearElement,
            hoverPointIndex,
          },
        });
      }

      if (
        !LinearElementEditor.arePointsEqual(
          this.state.selectedLinearElement.segmentMidPointHoveredCoords,
          segmentMidPointHoveredCoords,
        )
      ) {
        this.setState({
          selectedLinearElement: {
            ...this.state.selectedLinearElement,
            segmentMidPointHoveredCoords,
          },
        });
      }
    } else {
      setCursor(this.interactiveCanvas, CURSOR_TYPE.AUTO);
    }
  }

  private handleCanvasPointerDown = (
    event: React.PointerEvent<HTMLElement>,
  ) => {
    const target = event.target as HTMLElement;
    // capture subsequent pointer events to the canvas
    // this makes other elements non-interactive until pointer up
    if (target.setPointerCapture) {
      target.setPointerCapture(event.pointerId);
    }

    this.maybeCleanupAfterMissingPointerUp(event.nativeEvent);
    this.maybeUnfollowRemoteUser();

    if (this.state.searchMatches) {
      this.setState((state) => {
        return {
          searchMatches: state.searchMatches && {
            focusedId: null,
            matches: state.searchMatches.matches.map((searchMatch) => ({
              ...searchMatch,
              focus: false,
            })),
          },
        };
      });
      this.updateEditorAtom(searchItemInFocusAtom, null);
    }

    if (editorJotaiStore.get(convertElementTypePopupAtom)) {
      this.updateEditorAtom(convertElementTypePopupAtom, null);
    }

    // since contextMenu options are potentially evaluated on each render,
    // and an contextMenu action may depend on selection state, we must
    // close the contextMenu before we update the selection on pointerDown
    // (e.g. resetting selection)
    if (this.state.contextMenu) {
      this.setState({ contextMenu: null });
    }

    if (this.state.snapLines) {
      this.setAppState({ snapLines: [] });
    }

    this.updateGestureOnPointerDown(event);

    // if dragging element is freedraw and another pointerdown event occurs
    // a second finger is on the screen
    // discard the freedraw element if it is very short because it is likely
    // just a spike, otherwise finalize the freedraw element when the second
    // finger is lifted
    if (
      event.pointerType === "touch" &&
      this.state.newElement &&
      this.state.newElement.type === "freedraw"
    ) {
      const element = this.state.newElement as ExcalidrawFreeDrawElement;
      this.updateScene({
        ...(element.points.length < 10
          ? {
              elements: this.scene
                .getElementsIncludingDeleted()
                .filter((el) => el.id !== element.id),
            }
          : {}),
        appState: {
          newElement: null,
          editingTextElement: null,
          startBoundElement: null,
          suggestedBindings: [],
          selectedElementIds: makeNextSelectedElementIds(
            Object.keys(this.state.selectedElementIds)
              .filter((key) => key !== element.id)
              .reduce((obj: { [id: string]: true }, key) => {
                obj[key] = this.state.selectedElementIds[key];
                return obj;
              }, {}),
            this.state,
          ),
        },
        captureUpdate:
          this.state.openDialog?.name === "elementLinkSelector"
            ? CaptureUpdateAction.EVENTUALLY
            : CaptureUpdateAction.NEVER,
      });
      return;
    }

    // remove any active selection when we start to interact with canvas
    // (mainly, we care about removing selection outside the component which
    //  would prevent our copy handling otherwise)
    const selection = document.getSelection();
    if (selection?.anchorNode) {
      selection.removeAllRanges();
    }
    this.maybeOpenContextMenuAfterPointerDownOnTouchDevices(event);

    //fires only once, if pen is detected, penMode is enabled
    //the user can disable this by toggling the penMode button
    if (!this.state.penDetected && event.pointerType === "pen") {
      this.setState((prevState) => {
        return {
          penMode: true,
          penDetected: true,
        };
      });
    }

    if (
      !this.device.isTouchScreen &&
      ["pen", "touch"].includes(event.pointerType)
    ) {
      this.device = updateObject(this.device, { isTouchScreen: true });
    }

    if (isPanning) {
      return;
    }

    this.lastPointerDownEvent = event;

    // we must exit before we set `cursorButton` state and `savePointer`
    // else it will send pointer state & laser pointer events in collab when
    // panning
    if (this.handleCanvasPanUsingWheelOrSpaceDrag(event)) {
      return;
    }

    this.setState({
      lastPointerDownWith: event.pointerType,
      cursorButton: "down",
    });
    this.savePointer(event.clientX, event.clientY, "down");

    if (
      event.button === POINTER_BUTTON.ERASER &&
      this.state.activeTool.type !== TOOL_TYPE.eraser
    ) {
      this.setState(
        {
          activeTool: updateActiveTool(this.state, {
            type: TOOL_TYPE.eraser,
            lastActiveToolBeforeEraser: this.state.activeTool,
          }),
        },
        () => {
          this.handleCanvasPointerDown(event);
          const onPointerUp = () => {
            unsubPointerUp();
            unsubCleanup?.();
            if (isEraserActive(this.state)) {
              this.setState({
                activeTool: updateActiveTool(this.state, {
                  ...(this.state.activeTool.lastActiveTool || {
                    type: TOOL_TYPE.selection,
                  }),
                  lastActiveToolBeforeEraser: null,
                }),
              });
            }
          };

          const unsubPointerUp = addEventListener(
            window,
            EVENT.POINTER_UP,
            onPointerUp,
            {
              once: true,
            },
          );
          let unsubCleanup: UnsubscribeCallback | undefined;
          // subscribe inside rAF lest it'd be triggered on the same pointerdown
          // if we start erasing while coming from blurred document since
          // we cleanup pointer events on focus
          requestAnimationFrame(() => {
            unsubCleanup =
              this.missingPointerEventCleanupEmitter.once(onPointerUp);
          });
        },
      );
      return;
    }

    // only handle left mouse button or touch
    if (
      event.button !== POINTER_BUTTON.MAIN &&
      event.button !== POINTER_BUTTON.TOUCH &&
      event.button !== POINTER_BUTTON.ERASER
    ) {
      return;
    }

    // don't select while panning
    if (gesture.pointers.size > 1) {
      return;
    }

    // State for the duration of a pointer interaction, which starts with a
    // pointerDown event, ends with a pointerUp event (or another pointerDown)
    const pointerDownState = this.initialPointerDownState(event);

    this.setState({
      selectedElementsAreBeingDragged: false,
    });

    if (this.handleDraggingScrollBar(event, pointerDownState)) {
      return;
    }

    this.clearSelectionIfNotUsingSelection();
    this.updateBindingEnabledOnPointerMove(event);

    if (this.handleSelectionOnPointerDown(event, pointerDownState)) {
      return;
    }

    const allowOnPointerDown =
      !this.state.penMode ||
      event.pointerType !== "touch" ||
      this.state.activeTool.type === "selection" ||
      this.state.activeTool.type === "lasso" ||
      this.state.activeTool.type === "text" ||
      this.state.activeTool.type === "image";

    if (!allowOnPointerDown) {
      return;
    }

    if (this.state.activeTool.type === "lasso") {
      const hitSelectedElement =
        pointerDownState.hit.element &&
        this.isASelectedElement(pointerDownState.hit.element);

      const isMobileOrTablet = this.isMobileOrTablet();

      if (
        !pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements &&
        !pointerDownState.resize.handleType &&
        !hitSelectedElement
      ) {
        this.lassoTrail.startPath(
          pointerDownState.origin.x,
          pointerDownState.origin.y,
          event.shiftKey,
        );

        // block dragging after lasso selection on PCs until the next pointer down
        // (on mobile or tablet, we want to allow user to drag immediately)
        pointerDownState.drag.blockDragging = !isMobileOrTablet;
      }

      // only for mobile or tablet, if we hit an element, select it immediately like normal selection
      if (
        isMobileOrTablet &&
        pointerDownState.hit.element &&
        !hitSelectedElement
      ) {
        this.setState((prevState) => {
          const nextSelectedElementIds: { [id: string]: true } = {
            ...prevState.selectedElementIds,
            [pointerDownState.hit.element!.id]: true,
          };

          const previouslySelectedElements: ExcalidrawElement[] = [];

          Object.keys(prevState.selectedElementIds).forEach((id) => {
            const element = this.scene.getElement(id);
            element && previouslySelectedElements.push(element);
          });

          const hitElement = pointerDownState.hit.element!;

          // if hitElement is frame-like, deselect all of its elements
          // if they are selected
          if (isFrameLikeElement(hitElement)) {
            getFrameChildren(previouslySelectedElements, hitElement.id).forEach(
              (element) => {
                delete nextSelectedElementIds[element.id];
              },
            );
          } else if (hitElement.frameId) {
            // if hitElement is in a frame and its frame has been selected
            // disable selection for the given element
            if (nextSelectedElementIds[hitElement.frameId]) {
              delete nextSelectedElementIds[hitElement.id];
            }
          } else {
            // hitElement is neither a frame nor an element in a frame
            // but since hitElement could be in a group with some frames
            // this means selecting hitElement will have the frames selected as well
            // because we want to keep the invariant:
            // - frames and their elements are not selected at the same time
            // we deselect elements in those frames that were previously selected

            const groupIds = hitElement.groupIds;
            const framesInGroups = new Set(
              groupIds
                .flatMap((gid) =>
                  getElementsInGroup(this.scene.getNonDeletedElements(), gid),
                )
                .filter((element) => isFrameLikeElement(element))
                .map((frame) => frame.id),
            );

            if (framesInGroups.size > 0) {
              previouslySelectedElements.forEach((element) => {
                if (element.frameId && framesInGroups.has(element.frameId)) {
                  // deselect element and groups containing the element
                  delete nextSelectedElementIds[element.id];
                  element.groupIds
                    .flatMap((gid) =>
                      getElementsInGroup(
                        this.scene.getNonDeletedElements(),
                        gid,
                      ),
                    )
                    .forEach((element) => {
                      delete nextSelectedElementIds[element.id];
                    });
                }
              });
            }
          }

          return {
            ...selectGroupsForSelectedElements(
              {
                editingGroupId: prevState.editingGroupId,
                selectedElementIds: nextSelectedElementIds,
              },
              this.scene.getNonDeletedElements(),
              prevState,
              this,
            ),
            showHyperlinkPopup:
              hitElement.link || isEmbeddableElement(hitElement)
                ? "info"
                : false,
          };
        });
        pointerDownState.hit.wasAddedToSelection = true;
      }
    } else if (this.state.activeTool.type === "text") {
      this.handleTextOnPointerDown(event, pointerDownState);
    } else if (
      this.state.activeTool.type === "arrow" ||
      this.state.activeTool.type === "line"
    ) {
      this.handleLinearElementOnPointerDown(
        event,
        this.state.activeTool.type,
        pointerDownState,
      );
    } else if (this.state.activeTool.type === "freedraw") {
      this.handleFreeDrawElementOnPointerDown(
        event,
        this.state.activeTool.type,
        pointerDownState,
      );
    } else if (this.state.activeTool.type === "custom") {
      setCursorForShape(this.interactiveCanvas, this.state);
    } else if (
      this.state.activeTool.type === TOOL_TYPE.frame ||
      this.state.activeTool.type === TOOL_TYPE.magicframe
    ) {
      this.createFrameElementOnPointerDown(
        pointerDownState,
        this.state.activeTool.type,
      );
    } else if (this.state.activeTool.type === "laser") {
      this.laserTrails.startPath(
        pointerDownState.lastCoords.x,
        pointerDownState.lastCoords.y,
      );
    } else if (
      this.state.activeTool.type !== "eraser" &&
      this.state.activeTool.type !== "hand" &&
      this.state.activeTool.type !== "image"
    ) {
      this.createGenericElementOnPointerDown(
        this.state.activeTool.type,
        pointerDownState,
      );
    }

    this.props?.onPointerDown?.(this.state.activeTool, pointerDownState);
    this.onPointerDownEmitter.trigger(
      this.state.activeTool,
      pointerDownState,
      event,
    );

    if (this.state.activeTool.type === "eraser") {
      this.eraserTrail.startPath(
        pointerDownState.lastCoords.x,
        pointerDownState.lastCoords.y,
      );
    }

    const onPointerMove =
      this.onPointerMoveFromPointerDownHandler(pointerDownState);

    const onPointerUp =
      this.onPointerUpFromPointerDownHandler(pointerDownState);

    const onKeyDown = this.onKeyDownFromPointerDownHandler(pointerDownState);
    const onKeyUp = this.onKeyUpFromPointerDownHandler(pointerDownState);

    this.missingPointerEventCleanupEmitter.once((_event) =>
      onPointerUp(_event || event.nativeEvent),
    );

    if (!this.state.viewModeEnabled || this.state.activeTool.type === "laser") {
      window.addEventListener(EVENT.POINTER_MOVE, onPointerMove);
      window.addEventListener(EVENT.POINTER_UP, onPointerUp);
      window.addEventListener(EVENT.KEYDOWN, onKeyDown);
      window.addEventListener(EVENT.KEYUP, onKeyUp);
      pointerDownState.eventListeners.onMove = onPointerMove;
      pointerDownState.eventListeners.onUp = onPointerUp;
      pointerDownState.eventListeners.onKeyUp = onKeyUp;
      pointerDownState.eventListeners.onKeyDown = onKeyDown;
    }
  };

  private handleCanvasPointerUp = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    this.removePointer(event);
    this.lastPointerUpEvent = event;

    const scenePointer = viewportCoordsToSceneCoords(
      { clientX: event.clientX, clientY: event.clientY },
      this.state,
    );
    const clicklength =
      event.timeStamp - (this.lastPointerDownEvent?.timeStamp ?? 0);

    if (this.device.editor.isMobile && clicklength < 300) {
      const hitElement = this.getElementAtPosition(
        scenePointer.x,
        scenePointer.y,
      );
      if (
        isIframeLikeElement(hitElement) &&
        this.isIframeLikeElementCenter(
          hitElement,
          event,
          scenePointer.x,
          scenePointer.y,
        )
      ) {
        this.handleEmbeddableCenterClick(hitElement);
        return;
      }
    }

    if (this.device.isTouchScreen) {
      const hitElement = this.getElementAtPosition(
        scenePointer.x,
        scenePointer.y,
        {
          includeLockedElements: true,
        },
      );
      this.hitLinkElement = this.getElementLinkAtPosition(
        scenePointer,
        hitElement,
      );
    }

    if (
      this.hitLinkElement &&
      !this.state.selectedElementIds[this.hitLinkElement.id]
    ) {
      if (
        clicklength < 300 &&
        isIframeLikeElement(this.hitLinkElement) &&
        !isPointHittingLinkIcon(
          this.hitLinkElement,
          this.scene.getNonDeletedElementsMap(),
          this.state,
          pointFrom(scenePointer.x, scenePointer.y),
        )
      ) {
        this.handleEmbeddableCenterClick(this.hitLinkElement);
      } else {
        this.redirectToLink(event, this.device.isTouchScreen);
      }
    } else if (this.state.viewModeEnabled) {
      this.setState({
        activeEmbeddable: null,
        selectedElementIds: {},
      });
    }
  };

  private maybeOpenContextMenuAfterPointerDownOnTouchDevices = (
    event: React.PointerEvent<HTMLElement>,
  ): void => {
    // deal with opening context menu on touch devices
    if (event.pointerType === "touch") {
      invalidateContextMenu = false;

      if (touchTimeout) {
        // If there's already a touchTimeout, this means that there's another
        // touch down and we are doing another touch, so we shouldn't open the
        // context menu.
        invalidateContextMenu = true;
      } else {
        // open the context menu with the first touch's clientX and clientY
        // if the touch is not moving
        touchTimeout = window.setTimeout(() => {
          touchTimeout = 0;
          if (!invalidateContextMenu) {
            this.handleCanvasContextMenu(event);
          }
        }, TOUCH_CTX_MENU_TIMEOUT);
      }
    }
  };

  private resetContextMenuTimer = () => {
    clearTimeout(touchTimeout);
    touchTimeout = 0;
    invalidateContextMenu = false;
  };

  /**
   * pointerup may not fire in certian cases (user tabs away...), so in order
   * to properly cleanup pointerdown state, we need to fire any hanging
   * pointerup handlers manually
   */
  private maybeCleanupAfterMissingPointerUp = (event: PointerEvent | null) => {
    lastPointerUp?.();
    this.missingPointerEventCleanupEmitter.trigger(event).clear();
  };

  // Returns whether the event is a panning
  public handleCanvasPanUsingWheelOrSpaceDrag = (
    event: React.PointerEvent<HTMLElement> | MouseEvent,
  ): boolean => {
    if (
      !(
        gesture.pointers.size <= 1 &&
        (event.button === POINTER_BUTTON.WHEEL ||
          (event.button === POINTER_BUTTON.MAIN && isHoldingSpace) ||
          isHandToolActive(this.state) ||
          this.state.viewModeEnabled)
      )
    ) {
      return false;
    }
    isPanning = true;

    // due to event.preventDefault below, container wouldn't get focus
    // automatically
    this.focusContainer();

    // preventing defualt while text editing messes with cursor/focus
    if (!this.state.editingTextElement) {
      // necessary to prevent browser from scrolling the page if excalidraw
      // not full-page #4489
      //
      // as such, the above is broken when panning canvas while in wysiwyg
      event.preventDefault();
    }

    let nextPastePrevented = false;
    const isLinux =
      typeof window === undefined
        ? false
        : /Linux/.test(window.navigator.platform);

    setCursor(this.interactiveCanvas, CURSOR_TYPE.GRABBING);
    let { clientX: lastX, clientY: lastY } = event;
    const onPointerMove = withBatchedUpdatesThrottled((event: PointerEvent) => {
      const deltaX = lastX - event.clientX;
      const deltaY = lastY - event.clientY;
      lastX = event.clientX;
      lastY = event.clientY;

      /*
       * Prevent paste event if we move while middle clicking on Linux.
       * See issue #1383.
       */
      if (
        isLinux &&
        !nextPastePrevented &&
        (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1)
      ) {
        nextPastePrevented = true;

        /* Prevent the next paste event */
        const preventNextPaste = (event: ClipboardEvent) => {
          document.body.removeEventListener(EVENT.PASTE, preventNextPaste);
          event.stopPropagation();
        };

        /*
         * Reenable next paste in case of disabled middle click paste for
         * any reason:
         * - right click paste
         * - empty clipboard
         */
        const enableNextPaste = () => {
          setTimeout(() => {
            document.body.removeEventListener(EVENT.PASTE, preventNextPaste);
            window.removeEventListener(EVENT.POINTER_UP, enableNextPaste);
          }, 100);
        };

        document.body.addEventListener(EVENT.PASTE, preventNextPaste);
        window.addEventListener(EVENT.POINTER_UP, enableNextPaste);
      }

      this.translateCanvas({
        scrollX: this.state.scrollX - deltaX / this.state.zoom.value,
        scrollY: this.state.scrollY - deltaY / this.state.zoom.value,
      });
    });
    const teardown = withBatchedUpdates(
      (lastPointerUp = () => {
        lastPointerUp = null;
        isPanning = false;
        if (!isHoldingSpace) {
          if (this.state.viewModeEnabled) {
            setCursor(this.interactiveCanvas, CURSOR_TYPE.GRAB);
          } else {
            setCursorForShape(this.interactiveCanvas, this.state);
          }
        }
        this.setState({
          cursorButton: "up",
        });
        this.savePointer(event.clientX, event.clientY, "up");
        window.removeEventListener(EVENT.POINTER_MOVE, onPointerMove);
        window.removeEventListener(EVENT.POINTER_UP, teardown);
        window.removeEventListener(EVENT.BLUR, teardown);
        onPointerMove.flush();
      }),
    );
    window.addEventListener(EVENT.BLUR, teardown);
    window.addEventListener(EVENT.POINTER_MOVE, onPointerMove, {
      passive: true,
    });
    window.addEventListener(EVENT.POINTER_UP, teardown);
    return true;
  };

  private updateGestureOnPointerDown(
    event: React.PointerEvent<HTMLElement>,
  ): void {
    gesture.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (gesture.pointers.size === 2) {
      gesture.lastCenter = getCenter(gesture.pointers);
      gesture.initialScale = this.state.zoom.value;
      gesture.initialDistance = getDistance(
        Array.from(gesture.pointers.values()),
      );
    }
  }

  private initialPointerDownState(
    event: React.PointerEvent<HTMLElement>,
  ): PointerDownState {
    const origin = viewportCoordsToSceneCoords(event, this.state);
    const selectedElements = this.scene.getSelectedElements(this.state);
    const [minX, minY, maxX, maxY] = getCommonBounds(selectedElements);
    const isElbowArrowOnly = selectedElements.findIndex(isElbowArrow) === 0;

    return {
      origin,
      withCmdOrCtrl: event[KEYS.CTRL_OR_CMD],
      originInGrid: tupleToCoors(
        getGridPoint(
          origin.x,
          origin.y,
          event[KEYS.CTRL_OR_CMD] || isElbowArrowOnly
            ? null
            : this.getEffectiveGridSize(),
        ),
      ),
      scrollbars: isOverScrollBars(
        currentScrollBars,
        event.clientX - this.state.offsetLeft,
        event.clientY - this.state.offsetTop,
      ),
      // we need to duplicate because we'll be updating this state
      lastCoords: { ...origin },
      originalElements: this.scene
        .getNonDeletedElements()
        .reduce((acc, element) => {
          acc.set(element.id, deepCopyElement(element));
          return acc;
        }, new Map() as PointerDownState["originalElements"]),
      resize: {
        handleType: false,
        isResizing: false,
        offset: { x: 0, y: 0 },
        arrowDirection: "origin",
        center: { x: (maxX + minX) / 2, y: (maxY + minY) / 2 },
      },
      hit: {
        element: null,
        allHitElements: [],
        wasAddedToSelection: false,
        hasBeenDuplicated: false,
        hasHitCommonBoundingBoxOfSelectedElements:
          this.isHittingCommonBoundingBoxOfSelectedElements(
            origin,
            selectedElements,
          ),
      },
      drag: {
        hasOccurred: false,
        offset: null,
        origin: { ...origin },
        blockDragging: false,
      },
      eventListeners: {
        onMove: null,
        onUp: null,
        onKeyUp: null,
        onKeyDown: null,
      },
      boxSelection: {
        hasOccurred: false,
      },
    };
  }

  // Returns whether the event is a dragging a scrollbar
  private handleDraggingScrollBar(
    event: React.PointerEvent<HTMLElement>,
    pointerDownState: PointerDownState,
  ): boolean {
    if (
      !(pointerDownState.scrollbars.isOverEither && !this.state.multiElement)
    ) {
      return false;
    }
    isDraggingScrollBar = true;
    pointerDownState.lastCoords.x = event.clientX;
    pointerDownState.lastCoords.y = event.clientY;
    const onPointerMove = withBatchedUpdatesThrottled((event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      this.handlePointerMoveOverScrollbars(event, pointerDownState);
    });
    const onPointerUp = withBatchedUpdates(() => {
      lastPointerUp = null;
      isDraggingScrollBar = false;
      setCursorForShape(this.interactiveCanvas, this.state);
      this.setState({
        cursorButton: "up",
      });
      this.savePointer(event.clientX, event.clientY, "up");
      window.removeEventListener(EVENT.POINTER_MOVE, onPointerMove);
      window.removeEventListener(EVENT.POINTER_UP, onPointerUp);
      onPointerMove.flush();
    });

    lastPointerUp = onPointerUp;

    window.addEventListener(EVENT.POINTER_MOVE, onPointerMove);
    window.addEventListener(EVENT.POINTER_UP, onPointerUp);
    return true;
  }

  private clearSelectionIfNotUsingSelection = (): void => {
    if (
      this.state.activeTool.type !== "selection" &&
      this.state.activeTool.type !== "lasso"
    ) {
      this.setState({
        selectedElementIds: makeNextSelectedElementIds({}, this.state),
        selectedGroupIds: {},
        editingGroupId: null,
        activeEmbeddable: null,
      });
    }
  };

  /**
   * @returns whether the pointer event has been completely handled
   */
  private handleSelectionOnPointerDown = (
    event: React.PointerEvent<HTMLElement>,
    pointerDownState: PointerDownState,
  ): boolean => {
    if (
      this.state.activeTool.type === "selection" ||
      this.state.activeTool.type === "lasso"
    ) {
      const elements = this.scene.getNonDeletedElements();
      const elementsMap = this.scene.getNonDeletedElementsMap();
      const selectedElements = this.scene.getSelectedElements(this.state);

      if (
        selectedElements.length === 1 &&
        !this.state.selectedLinearElement?.isEditing &&
        !isElbowArrow(selectedElements[0]) &&
        !(
          this.state.selectedLinearElement &&
          this.state.selectedLinearElement.hoverPointIndex !== -1
        )
      ) {
        const elementWithTransformHandleType =
          getElementWithTransformHandleType(
            elements,
            this.state,
            pointerDownState.origin.x,
            pointerDownState.origin.y,
            this.state.zoom,
            event.pointerType,
            this.scene.getNonDeletedElementsMap(),
            this.device,
          );
        if (elementWithTransformHandleType != null) {
          if (
            elementWithTransformHandleType.transformHandleType === "rotation"
          ) {
            this.setState({
              resizingElement: elementWithTransformHandleType.element,
            });
            pointerDownState.resize.handleType =
              elementWithTransformHandleType.transformHandleType;
          } else if (this.state.croppingElementId) {
            pointerDownState.resize.handleType =
              elementWithTransformHandleType.transformHandleType;
          } else {
            this.setState({
              resizingElement: elementWithTransformHandleType.element,
            });
            pointerDownState.resize.handleType =
              elementWithTransformHandleType.transformHandleType;
          }
        }
      } else if (selectedElements.length > 1) {
        pointerDownState.resize.handleType = getTransformHandleTypeFromCoords(
          getCommonBounds(selectedElements),
          pointerDownState.origin.x,
          pointerDownState.origin.y,
          this.state.zoom,
          event.pointerType,
          this.device,
        );
      }
      if (pointerDownState.resize.handleType) {
        pointerDownState.resize.isResizing = true;
        pointerDownState.resize.offset = tupleToCoors(
          getResizeOffsetXY(
            pointerDownState.resize.handleType,
            selectedElements,
            elementsMap,
            pointerDownState.origin.x,
            pointerDownState.origin.y,
          ),
        );
        if (
          selectedElements.length === 1 &&
          isLinearElement(selectedElements[0]) &&
          selectedElements[0].points.length === 2
        ) {
          pointerDownState.resize.arrowDirection = getResizeArrowDirection(
            pointerDownState.resize.handleType,
            selectedElements[0],
          );
        }
      } else {
        if (this.state.selectedLinearElement) {
          const linearElementEditor = this.state.selectedLinearElement;
          const ret = LinearElementEditor.handlePointerDown(
            event,
            this,
            this.store,
            pointerDownState.origin,
            linearElementEditor,
            this.scene,
          );
          if (ret.hitElement) {
            pointerDownState.hit.element = ret.hitElement;
          }
          if (ret.linearElementEditor) {
            this.setState({ selectedLinearElement: ret.linearElementEditor });
          }
          if (ret.didAddPoint) {
            return true;
          }
        }

        const allHitElements = this.getElementsAtPosition(
          pointerDownState.origin.x,
          pointerDownState.origin.y,
          {
            includeLockedElements: true,
          },
        );
        const unlockedHitElements = allHitElements.filter((e) => !e.locked);

        // Cannot set preferSelected in getElementAtPosition as we do in pointer move; consider:
        // A & B: both unlocked, A selected, B on top, A & B overlaps in some way
        // we want to select B when clicking on the overlapping area
        const hitElementMightBeLocked = this.getElementAtPosition(
          pointerDownState.origin.x,
          pointerDownState.origin.y,
          {
            allHitElements,
          },
        );

        if (
          !hitElementMightBeLocked ||
          hitElementMightBeLocked.id !== this.state.activeLockedId
        ) {
          this.setState({
            activeLockedId: null,
          });
        }

        if (
          hitElementMightBeLocked &&
          hitElementMightBeLocked.locked &&
          !unlockedHitElements.some(
            (el) => this.state.selectedElementIds[el.id],
          )
        ) {
          pointerDownState.hit.element = null;
        } else {
          // hitElement may already be set above, so check first
          pointerDownState.hit.element =
            pointerDownState.hit.element ??
            this.getElementAtPosition(
              pointerDownState.origin.x,
              pointerDownState.origin.y,
            );
        }

        this.hitLinkElement = this.getElementLinkAtPosition(
          pointerDownState.origin,
          hitElementMightBeLocked,
        );

        if (this.hitLinkElement) {
          return true;
        }

        if (
          this.state.croppingElementId &&
          pointerDownState.hit.element?.id !== this.state.croppingElementId
        ) {
          this.finishImageCropping();
        }

        if (pointerDownState.hit.element) {
          // Early return if pointer is hitting link icon
          const hitLinkElement = this.getElementLinkAtPosition(
            {
              x: pointerDownState.origin.x,
              y: pointerDownState.origin.y,
            },
            pointerDownState.hit.element,
          );
          if (hitLinkElement) {
            return false;
          }
        }

        // For overlapped elements one position may hit
        // multiple elements
        pointerDownState.hit.allHitElements = unlockedHitElements;

        const hitElement = pointerDownState.hit.element;
        const someHitElementIsSelected =
          pointerDownState.hit.allHitElements.some((element) =>
            this.isASelectedElement(element),
          );
        if (
          (hitElement === null || !someHitElementIsSelected) &&
          !event.shiftKey &&
          !pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements
        ) {
          this.clearSelection(hitElement);
        }

        if (this.state.selectedLinearElement?.isEditing) {
          this.setState({
            selectedElementIds: makeNextSelectedElementIds(
              {
                [this.state.selectedLinearElement.elementId]: true,
              },
              this.state,
            ),
          });
          // If we click on something
        } else if (hitElement != null) {
          // == deep selection ==
          // on CMD/CTRL, drill down to hit element regardless of groups etc.
          if (event[KEYS.CTRL_OR_CMD]) {
            if (event.altKey) {
              // ctrl + alt means we're lasso selecting - start lasso trail and switch to lasso tool

              // Close any open dialogs that might interfere with lasso selection
              if (this.state.openDialog?.name === "elementLinkSelector") {
                this.setOpenDialog(null);
              }
              this.lassoTrail.startPath(
                pointerDownState.origin.x,
                pointerDownState.origin.y,
                event.shiftKey,
              );
              this.setActiveTool({ type: "lasso", fromSelection: true });
              return false;
            }
            if (!this.state.selectedElementIds[hitElement.id]) {
              pointerDownState.hit.wasAddedToSelection = true;
            }
            this.setState((prevState) => ({
              ...editGroupForSelectedElement(prevState, hitElement),
              previousSelectedElementIds: this.state.selectedElementIds,
            }));
            // mark as not completely handled so as to allow dragging etc.
            return false;
          }

          // deselect if item is selected
          // if shift is not clicked, this will always return true
          // otherwise, it will trigger selection based on current
          // state of the box
          if (!this.state.selectedElementIds[hitElement.id]) {
            // if we are currently editing a group, exiting editing mode and deselect the group.
            if (
              this.state.editingGroupId &&
              !isElementInGroup(hitElement, this.state.editingGroupId)
            ) {
              this.setState({
                selectedElementIds: makeNextSelectedElementIds({}, this.state),
                selectedGroupIds: {},
                editingGroupId: null,
                activeEmbeddable: null,
              });
            }

            // Add hit element to selection. At this point if we're not holding
            // SHIFT the previously selected element(s) were deselected above
            // (make sure you use setState updater to use latest state)
            // With shift-selection, we want to make sure that frames and their containing
            // elements are not selected at the same time.
            if (
              !someHitElementIsSelected &&
              !pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements
            ) {
              this.setState((prevState) => {
                let nextSelectedElementIds: { [id: string]: true } = {
                  ...prevState.selectedElementIds,
                  [hitElement.id]: true,
                };

                const previouslySelectedElements: ExcalidrawElement[] = [];

                Object.keys(prevState.selectedElementIds).forEach((id) => {
                  const element = this.scene.getElement(id);
                  element && previouslySelectedElements.push(element);
                });

                // if hitElement is frame-like, deselect all of its elements
                // if they are selected
                if (isFrameLikeElement(hitElement)) {
                  getFrameChildren(
                    previouslySelectedElements,
                    hitElement.id,
                  ).forEach((element) => {
                    delete nextSelectedElementIds[element.id];
                  });
                } else if (hitElement.frameId) {
                  // if hitElement is in a frame and its frame has been selected
                  // disable selection for the given element
                  if (nextSelectedElementIds[hitElement.frameId]) {
                    delete nextSelectedElementIds[hitElement.id];
                  }
                } else {
                  // hitElement is neither a frame nor an element in a frame
                  // but since hitElement could be in a group with some frames
                  // this means selecting hitElement will have the frames selected as well
                  // because we want to keep the invariant:
                  // - frames and their elements are not selected at the same time
                  // we deselect elements in those frames that were previously selected

                  const groupIds = hitElement.groupIds;
                  const framesInGroups = new Set(
                    groupIds
                      .flatMap((gid) =>
                        getElementsInGroup(
                          this.scene.getNonDeletedElements(),
                          gid,
                        ),
                      )
                      .filter((element) => isFrameLikeElement(element))
                      .map((frame) => frame.id),
                  );

                  if (framesInGroups.size > 0) {
                    previouslySelectedElements.forEach((element) => {
                      if (
                        element.frameId &&
                        framesInGroups.has(element.frameId)
                      ) {
                        // deselect element and groups containing the element
                        delete nextSelectedElementIds[element.id];
                        element.groupIds
                          .flatMap((gid) =>
                            getElementsInGroup(
                              this.scene.getNonDeletedElements(),
                              gid,
                            ),
                          )
                          .forEach((element) => {
                            delete nextSelectedElementIds[element.id];
                          });
                      }
                    });
                  }
                }

                // Finally, in shape selection mode, we'd like to
                // keep only one shape or group selected at a time.
                // This means, if the hitElement is a different shape or group
                // than the previously selected ones, we deselect the previous ones
                // and select the hitElement
                if (prevState.openDialog?.name === "elementLinkSelector") {
                  if (
                    !hitElement.groupIds.some(
                      (gid) => prevState.selectedGroupIds[gid],
                    )
                  ) {
                    nextSelectedElementIds = {
                      [hitElement.id]: true,
                    };
                  }
                }

                return {
                  ...selectGroupsForSelectedElements(
                    {
                      editingGroupId: prevState.editingGroupId,
                      selectedElementIds: nextSelectedElementIds,
                    },
                    this.scene.getNonDeletedElements(),
                    prevState,
                    this,
                  ),
                  showHyperlinkPopup:
                    hitElement.link || isEmbeddableElement(hitElement)
                      ? "info"
                      : false,
                };
              });
              pointerDownState.hit.wasAddedToSelection = true;
            }
          }
        }

        this.setState({
          previousSelectedElementIds: this.state.selectedElementIds,
        });
      }
    }
    return false;
  };

  private isASelectedElement(hitElement: ExcalidrawElement | null): boolean {
    return hitElement != null && this.state.selectedElementIds[hitElement.id];
  }

  private isHittingCommonBoundingBoxOfSelectedElements(
    point: Readonly<{ x: number; y: number }>,
    selectedElements: readonly ExcalidrawElement[],
  ): boolean {
    if (selectedElements.length < 2) {
      return false;
    }

    // How many pixels off the shape boundary we still consider a hit
    const threshold = Math.max(
      DEFAULT_COLLISION_THRESHOLD / this.state.zoom.value,
      1,
    );
    const [x1, y1, x2, y2] = getCommonBounds(selectedElements);
    return (
      point.x > x1 - threshold &&
      point.x < x2 + threshold &&
      point.y > y1 - threshold &&
      point.y < y2 + threshold
    );
  }

  private handleTextOnPointerDown = (
    event: React.PointerEvent<HTMLElement>,
    pointerDownState: PointerDownState,
  ): void => {
    // if we're currently still editing text, clicking outside
    // should only finalize it, not create another (irrespective
    // of state.activeTool.locked)
    if (this.state.editingTextElement) {
      return;
    }
    let sceneX = pointerDownState.origin.x;
    let sceneY = pointerDownState.origin.y;

    const element = this.getElementAtPosition(sceneX, sceneY, {
      includeBoundTextElement: true,
    });

    // FIXME
    let container = this.getTextBindableContainerAtPosition(sceneX, sceneY);

    if (hasBoundTextElement(element)) {
      container = element as ExcalidrawTextContainer;
      sceneX = element.x + element.width / 2;
      sceneY = element.y + element.height / 2;
    }
    this.startTextEditing({
      sceneX,
      sceneY,
      insertAtParentCenter: !event.altKey,
      container,
      autoEdit: false,
    });

    resetCursor(this.interactiveCanvas);
    if (!this.state.activeTool.locked) {
      this.setState({
        activeTool: updateActiveTool(this.state, {
          type: this.defaultSelectionTool,
        }),
      });
    }
  };

  private handleFreeDrawElementOnPointerDown = (
    event: React.PointerEvent<HTMLElement>,
    elementType: ExcalidrawFreeDrawElement["type"],
    pointerDownState: PointerDownState,
  ) => {
    // Begin a mark capture. This does not have to update state yet.
    const [gridX, gridY] = getGridPoint(
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      null,
    );

    const topLayerFrame = this.getTopLayerFrameAtSceneCoords({
      x: gridX,
      y: gridY,
    });

    const simulatePressure = event.pressure === 0.5;

    const element = newFreeDrawElement({
      type: elementType,
      x: gridX,
      y: gridY,
      strokeColor: this.state.currentItemStrokeColor,
      backgroundColor: this.state.currentItemBackgroundColor,
      fillStyle: this.state.currentItemFillStyle,
      strokeWidth: this.state.currentItemStrokeWidth,
      strokeStyle: this.state.currentItemStrokeStyle,
      roughness: this.state.currentItemRoughness,
      opacity: this.state.currentItemOpacity,
      roundness: null,
      simulatePressure,
      locked: false,
      frameId: topLayerFrame ? topLayerFrame.id : null,
      points: [pointFrom<LocalPoint>(0, 0)],
      pressures: simulatePressure ? [] : [event.pressure],
    });

    this.scene.insertElement(element);

    this.setState((prevState) => {
      const nextSelectedElementIds = {
        ...prevState.selectedElementIds,
      };
      delete nextSelectedElementIds[element.id];
      return {
        selectedElementIds: makeNextSelectedElementIds(
          nextSelectedElementIds,
          prevState,
        ),
      };
    });

    const boundElement = getHoveredElementForBinding(
      pointerDownState.origin,
      this.scene.getNonDeletedElements(),
      this.scene.getNonDeletedElementsMap(),
      this.state.zoom,
    );

    this.setState({
      newElement: element,
      startBoundElement: boundElement,
      suggestedBindings: [],
    });
  };

  public insertIframeElement = ({
    sceneX,
    sceneY,
    width,
    height,
  }: {
    sceneX: number;
    sceneY: number;
    width: number;
    height: number;
  }) => {
    const [gridX, gridY] = getGridPoint(
      sceneX,
      sceneY,
      this.lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
        ? null
        : this.getEffectiveGridSize(),
    );

    const element = newIframeElement({
      type: "iframe",
      x: gridX,
      y: gridY,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      fillStyle: this.state.currentItemFillStyle,
      strokeWidth: this.state.currentItemStrokeWidth,
      strokeStyle: this.state.currentItemStrokeStyle,
      roughness: this.state.currentItemRoughness,
      roundness: this.getCurrentItemRoundness("iframe"),
      opacity: this.state.currentItemOpacity,
      locked: false,
      width,
      height,
    });

    this.scene.insertElement(element);

    return element;
  };

  //create rectangle element with youtube top left on nearest grid point width / hight 640/360
  public insertEmbeddableElement = ({
    sceneX,
    sceneY,
    link,
  }: {
    sceneX: number;
    sceneY: number;
    link: string;
  }) => {
    const [gridX, gridY] = getGridPoint(
      sceneX,
      sceneY,
      this.lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
        ? null
        : this.getEffectiveGridSize(),
    );

    const embedLink = getEmbedLink(link);

    if (!embedLink) {
      return;
    }

    if (embedLink.error instanceof URIError) {
      this.setToast({
        message: t("toast.unrecognizedLinkFormat"),
        closable: true,
      });
    }

    const element = newEmbeddableElement({
      type: "embeddable",
      x: gridX,
      y: gridY,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      fillStyle: this.state.currentItemFillStyle,
      strokeWidth: this.state.currentItemStrokeWidth,
      strokeStyle: this.state.currentItemStrokeStyle,
      roughness: this.state.currentItemRoughness,
      roundness: this.getCurrentItemRoundness("embeddable"),
      opacity: this.state.currentItemOpacity,
      locked: false,
      width: embedLink.intrinsicSize.w,
      height: embedLink.intrinsicSize.h,
      link,
    });

    this.scene.insertElement(element);

    return element;
  };

  private newImagePlaceholder = ({
    sceneX,
    sceneY,
    addToFrameUnderCursor = true,
  }: {
    sceneX: number;
    sceneY: number;
    addToFrameUnderCursor?: boolean;
  }) => {
    const [gridX, gridY] = getGridPoint(
      sceneX,
      sceneY,
      this.lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
        ? null
        : this.getEffectiveGridSize(),
    );

    const topLayerFrame = addToFrameUnderCursor
      ? this.getTopLayerFrameAtSceneCoords({
          x: gridX,
          y: gridY,
        })
      : null;

    const placeholderSize = 100 / this.state.zoom.value;

    return newImageElement({
      type: "image",
      strokeColor: this.state.currentItemStrokeColor,
      backgroundColor: this.state.currentItemBackgroundColor,
      fillStyle: this.state.currentItemFillStyle,
      strokeWidth: this.state.currentItemStrokeWidth,
      strokeStyle: this.state.currentItemStrokeStyle,
      roughness: this.state.currentItemRoughness,
      roundness: null,
      opacity: this.state.currentItemOpacity,
      locked: false,
      frameId: topLayerFrame ? topLayerFrame.id : null,
      x: gridX - placeholderSize / 2,
      y: gridY - placeholderSize / 2,
      width: placeholderSize,
      height: placeholderSize,
    });
  };

  private handleLinearElementOnPointerDown = (
    event: React.PointerEvent<HTMLElement>,
    elementType: ExcalidrawLinearElement["type"],
    pointerDownState: PointerDownState,
  ): void => {
    if (this.state.multiElement) {
      const { multiElement } = this.state;

      // finalize if completing a loop
      if (
        multiElement.type === "line" &&
        isPathALoop(multiElement.points, this.state.zoom.value)
      ) {
        this.scene.mutateElement(multiElement, {
          lastCommittedPoint:
            multiElement.points[multiElement.points.length - 1],
        });
        this.actionManager.executeAction(actionFinalize);
        return;
      }

      // Elbow arrows cannot be created by putting down points
      // only the start and end points can be defined
      if (isElbowArrow(multiElement) && multiElement.points.length > 1) {
        this.scene.mutateElement(multiElement, {
          lastCommittedPoint:
            multiElement.points[multiElement.points.length - 1],
        });
        this.actionManager.executeAction(actionFinalize);
        return;
      }

      const { x: rx, y: ry, lastCommittedPoint } = multiElement;

      // clicking inside commit zone → finalize arrow
      if (
        multiElement.points.length > 1 &&
        lastCommittedPoint &&
        pointDistance(
          pointFrom(
            pointerDownState.origin.x - rx,
            pointerDownState.origin.y - ry,
          ),
          lastCommittedPoint,
        ) < LINE_CONFIRM_THRESHOLD
      ) {
        this.actionManager.executeAction(actionFinalize);
        return;
      }

      this.setState((prevState) => ({
        selectedElementIds: makeNextSelectedElementIds(
          {
            ...prevState.selectedElementIds,
            [multiElement.id]: true,
          },
          prevState,
        ),
      }));
      // clicking outside commit zone → update reference for last committed
      // point
      this.scene.mutateElement(multiElement, {
        lastCommittedPoint: multiElement.points[multiElement.points.length - 1],
      });
      setCursor(this.interactiveCanvas, CURSOR_TYPE.POINTER);
    } else {
      const [gridX, gridY] = getGridPoint(
        pointerDownState.origin.x,
        pointerDownState.origin.y,
        event[KEYS.CTRL_OR_CMD] ? null : this.getEffectiveGridSize(),
      );

      const topLayerFrame = this.getTopLayerFrameAtSceneCoords({
        x: gridX,
        y: gridY,
      });

      /* If arrow is pre-arrowheads, it will have undefined for both start and end arrowheads.
      If so, we want it to be null for start and "arrow" for end. If the linear item is not
      an arrow, we want it to be null for both. Otherwise, we want it to use the
      values from appState. */

      const { currentItemStartArrowhead, currentItemEndArrowhead } = this.state;
      const [startArrowhead, endArrowhead] =
        elementType === "arrow"
          ? [currentItemStartArrowhead, currentItemEndArrowhead]
          : [null, null];

      const element =
        elementType === "arrow"
          ? newArrowElement({
              type: elementType,
              x: gridX,
              y: gridY,
              strokeColor: this.state.currentItemStrokeColor,
              backgroundColor: this.state.currentItemBackgroundColor,
              fillStyle: this.state.currentItemFillStyle,
              strokeWidth: this.state.currentItemStrokeWidth,
              strokeStyle: this.state.currentItemStrokeStyle,
              roughness: this.state.currentItemRoughness,
              opacity: this.state.currentItemOpacity,
              roundness:
                this.state.currentItemArrowType === ARROW_TYPE.round
                  ? { type: ROUNDNESS.PROPORTIONAL_RADIUS }
                  : // note, roundness doesn't have any effect for elbow arrows,
                    // but it's best to set it to null as well
                    null,
              startArrowhead,
              endArrowhead,
              locked: false,
              frameId: topLayerFrame ? topLayerFrame.id : null,
              elbowed: this.state.currentItemArrowType === ARROW_TYPE.elbow,
              fixedSegments:
                this.state.currentItemArrowType === ARROW_TYPE.elbow
                  ? []
                  : null,
            })
          : newLinearElement({
              type: elementType,
              x: gridX,
              y: gridY,
              strokeColor: this.state.currentItemStrokeColor,
              backgroundColor: this.state.currentItemBackgroundColor,
              fillStyle: this.state.currentItemFillStyle,
              strokeWidth: this.state.currentItemStrokeWidth,
              strokeStyle: this.state.currentItemStrokeStyle,
              roughness: this.state.currentItemRoughness,
              opacity: this.state.currentItemOpacity,
              roundness:
                this.state.currentItemRoundness === "round"
                  ? { type: ROUNDNESS.PROPORTIONAL_RADIUS }
                  : null,
              locked: false,
              frameId: topLayerFrame ? topLayerFrame.id : null,
            });
      this.setState((prevState) => {
        const nextSelectedElementIds = {
          ...prevState.selectedElementIds,
        };
        delete nextSelectedElementIds[element.id];
        return {
          selectedElementIds: makeNextSelectedElementIds(
            nextSelectedElementIds,
            prevState,
          ),
        };
      });
      this.scene.mutateElement(element, {
        points: [...element.points, pointFrom<LocalPoint>(0, 0)],
      });
      const boundElement = getHoveredElementForBinding(
        pointerDownState.origin,
        this.scene.getNonDeletedElements(),
        this.scene.getNonDeletedElementsMap(),
        this.state.zoom,
        isElbowArrow(element),
        isElbowArrow(element),
      );

      this.scene.insertElement(element);
      this.setState({
        newElement: element,
        startBoundElement: boundElement,
        suggestedBindings: [],
      });
    }
  };

  private getCurrentItemRoundness(
    elementType:
      | "selection"
      | "rectangle"
      | "diamond"
      | "ellipse"
      | "iframe"
      | "embeddable",
  ) {
    return this.state.currentItemRoundness === "round"
      ? {
          type: isUsingAdaptiveRadius(elementType)
            ? ROUNDNESS.ADAPTIVE_RADIUS
            : ROUNDNESS.PROPORTIONAL_RADIUS,
        }
      : null;
  }

  private createGenericElementOnPointerDown = (
    elementType: ExcalidrawGenericElement["type"] | "embeddable",
    pointerDownState: PointerDownState,
  ): void => {
    const [gridX, gridY] = getGridPoint(
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      this.lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
        ? null
        : this.getEffectiveGridSize(),
    );

    const topLayerFrame = this.getTopLayerFrameAtSceneCoords({
      x: gridX,
      y: gridY,
    });

    const baseElementAttributes = {
      x: gridX,
      y: gridY,
      strokeColor: this.state.currentItemStrokeColor,
      backgroundColor: this.state.currentItemBackgroundColor,
      fillStyle: this.state.currentItemFillStyle,
      strokeWidth: this.state.currentItemStrokeWidth,
      strokeStyle: this.state.currentItemStrokeStyle,
      roughness: this.state.currentItemRoughness,
      opacity: this.state.currentItemOpacity,
      roundness: this.getCurrentItemRoundness(elementType),
      locked: false,
      frameId: topLayerFrame ? topLayerFrame.id : null,
    } as const;

    let element;
    if (elementType === "embeddable") {
      element = newEmbeddableElement({
        type: "embeddable",
        ...baseElementAttributes,
      });
    } else {
      element = newElement({
        type: elementType,
        ...baseElementAttributes,
      });
    }

    if (element.type === "selection") {
      this.setState({
        selectionElement: element,
      });
    } else {
      this.scene.insertElement(element);
      this.setState({
        multiElement: null,
        newElement: element,
      });
    }
  };

  private createFrameElementOnPointerDown = (
    pointerDownState: PointerDownState,
    type: Extract<ToolType, "frame" | "magicframe">,
  ): void => {
    const [gridX, gridY] = getGridPoint(
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      this.lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
        ? null
        : this.getEffectiveGridSize(),
    );

    const constructorOpts = {
      x: gridX,
      y: gridY,
      opacity: this.state.currentItemOpacity,
      locked: false,
      ...FRAME_STYLE,
    } as const;

    const frame =
      type === TOOL_TYPE.magicframe
        ? newMagicFrameElement(constructorOpts)
        : newFrameElement(constructorOpts);

    this.scene.insertElement(frame);

    this.setState({
      multiElement: null,
      newElement: frame,
    });
  };

  private maybeCacheReferenceSnapPoints(
    event: KeyboardModifiersObject,
    selectedElements: ExcalidrawElement[],
    recomputeAnyways: boolean = false,
  ) {
    if (
      isSnappingEnabled({
        event,
        app: this,
        selectedElements,
      }) &&
      (recomputeAnyways || !SnapCache.getReferenceSnapPoints())
    ) {
      SnapCache.setReferenceSnapPoints(
        getReferenceSnapPoints(
          this.scene.getNonDeletedElements(),
          selectedElements,
          this.state,
          this.scene.getNonDeletedElementsMap(),
        ),
      );
    }
  }

  private maybeCacheVisibleGaps(
    event: KeyboardModifiersObject,
    selectedElements: ExcalidrawElement[],
    recomputeAnyways: boolean = false,
  ) {
    if (
      isSnappingEnabled({
        event,
        app: this,
        selectedElements,
      }) &&
      (recomputeAnyways || !SnapCache.getVisibleGaps())
    ) {
      SnapCache.setVisibleGaps(
        getVisibleGaps(
          this.scene.getNonDeletedElements(),
          selectedElements,
          this.state,
          this.scene.getNonDeletedElementsMap(),
        ),
      );
    }
  }

  private onKeyDownFromPointerDownHandler(
    pointerDownState: PointerDownState,
  ): (event: KeyboardEvent) => void {
    return withBatchedUpdates((event: KeyboardEvent) => {
      if (this.maybeHandleResize(pointerDownState, event)) {
        return;
      }
      this.maybeDragNewGenericElement(pointerDownState, event);
    });
  }

  private onKeyUpFromPointerDownHandler(
    pointerDownState: PointerDownState,
  ): (event: KeyboardEvent) => void {
    return withBatchedUpdates((event: KeyboardEvent) => {
      // Prevents focus from escaping excalidraw tab
      event.key === KEYS.ALT && event.preventDefault();
      if (this.maybeHandleResize(pointerDownState, event)) {
        return;
      }
      this.maybeDragNewGenericElement(pointerDownState, event);
    });
  }

  private onPointerMoveFromPointerDownHandler(
    pointerDownState: PointerDownState,
  ) {
    return withBatchedUpdatesThrottled((event: PointerEvent) => {
      if (this.state.openDialog?.name === "elementLinkSelector") {
        return;
      }
      const pointerCoords = viewportCoordsToSceneCoords(event, this.state);

      if (this.state.activeLockedId) {
        this.setState({
          activeLockedId: null,
        });
      }

      if (
        this.state.selectedLinearElement &&
        this.state.selectedLinearElement.elbowed &&
        this.state.selectedLinearElement.pointerDownState.segmentMidpoint.index
      ) {
        const [gridX, gridY] = getGridPoint(
          pointerCoords.x,
          pointerCoords.y,
          event[KEYS.CTRL_OR_CMD] ? null : this.getEffectiveGridSize(),
        );

        let index =
          this.state.selectedLinearElement.pointerDownState.segmentMidpoint
            .index;
        if (index < 0) {
          const nextCoords = LinearElementEditor.getSegmentMidpointHitCoords(
            {
              ...this.state.selectedLinearElement,
              segmentMidPointHoveredCoords: null,
            },
            { x: gridX, y: gridY },
            this.state,
            this.scene.getNonDeletedElementsMap(),
          );
          index = nextCoords
            ? LinearElementEditor.getSegmentMidPointIndex(
                this.state.selectedLinearElement,
                this.state,
                nextCoords,
                this.scene.getNonDeletedElementsMap(),
              )
            : -1;
        }

        const ret = LinearElementEditor.moveFixedSegment(
          this.state.selectedLinearElement,
          index,
          gridX,
          gridY,
          this.scene,
        );

        this.setState({
          selectedLinearElement: {
            ...this.state.selectedLinearElement,
            segmentMidPointHoveredCoords: ret.segmentMidPointHoveredCoords,
            pointerDownState: ret.pointerDownState,
          },
        });
        return;
      }

      const lastPointerCoords =
        this.lastPointerMoveCoords ?? pointerDownState.origin;
      this.lastPointerMoveCoords = pointerCoords;

      // We need to initialize dragOffsetXY only after we've updated
      // `state.selectedElementIds` on pointerDown. Doing it here in pointerMove
      // event handler should hopefully ensure we're already working with
      // the updated state.
      if (pointerDownState.drag.offset === null) {
        pointerDownState.drag.offset = tupleToCoors(
          getDragOffsetXY(
            this.scene.getSelectedElements(this.state),
            pointerDownState.origin.x,
            pointerDownState.origin.y,
          ),
        );
      }
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (this.handlePointerMoveOverScrollbars(event, pointerDownState)) {
        return;
      }

      if (isEraserActive(this.state)) {
        this.handleEraser(event, pointerCoords);
        return;
      }

      if (this.state.activeTool.type === "laser") {
        this.laserTrails.addPointToPath(pointerCoords.x, pointerCoords.y);
      }

      const [gridX, gridY] = getGridPoint(
        pointerCoords.x,
        pointerCoords.y,
        event[KEYS.CTRL_OR_CMD] ? null : this.getEffectiveGridSize(),
      );

      // for arrows/lines, don't start dragging until a given threshold
      // to ensure we don't create a 2-point arrow by mistake when
      // user clicks mouse in a way that it moves a tiny bit (thus
      // triggering pointermove)
      if (
        !pointerDownState.drag.hasOccurred &&
        (this.state.activeTool.type === "arrow" ||
          this.state.activeTool.type === "line")
      ) {
        if (
          pointDistance(
            pointFrom(pointerCoords.x, pointerCoords.y),
            pointFrom(pointerDownState.origin.x, pointerDownState.origin.y),
          ) *
            this.state.zoom.value <
          MINIMUM_ARROW_SIZE
        ) {
          return;
        }
      }
      if (pointerDownState.resize.isResizing) {
        pointerDownState.lastCoords.x = pointerCoords.x;
        pointerDownState.lastCoords.y = pointerCoords.y;
        if (this.maybeHandleCrop(pointerDownState, event)) {
          return true;
        }
        if (this.maybeHandleResize(pointerDownState, event)) {
          return true;
        }
      }
      const elementsMap = this.scene.getNonDeletedElementsMap();

      if (this.state.selectedLinearElement) {
        const linearElementEditor = this.state.selectedLinearElement;

        if (
          LinearElementEditor.shouldAddMidpoint(
            this.state.selectedLinearElement,
            pointerCoords,
            this.state,
            elementsMap,
          )
        ) {
          const ret = LinearElementEditor.addMidpoint(
            this.state.selectedLinearElement,
            pointerCoords,
            this,
            !event[KEYS.CTRL_OR_CMD],
            this.scene,
          );
          if (!ret) {
            return;
          }

          // Since we are reading from previous state which is not possible with
          // automatic batching in React 18 hence using flush sync to synchronously
          // update the state. Check https://github.com/excalidraw/excalidraw/pull/5508 for more details.

          flushSync(() => {
            if (this.state.selectedLinearElement) {
              this.setState({
                selectedLinearElement: {
                  ...this.state.selectedLinearElement,
                  pointerDownState: ret.pointerDownState,
                  selectedPointsIndices: ret.selectedPointsIndices,
                  segmentMidPointHoveredCoords: null,
                },
              });
            }
          });

          return;
        } else if (
          linearElementEditor.pointerDownState.segmentMidpoint.value !== null &&
          !linearElementEditor.pointerDownState.segmentMidpoint.added
        ) {
          return;
        }

        const newState = LinearElementEditor.handlePointDragging(
          event,
          this,
          pointerCoords.x,
          pointerCoords.y,
          linearElementEditor,
        );
        if (newState) {
          pointerDownState.lastCoords.x = pointerCoords.x;
          pointerDownState.lastCoords.y = pointerCoords.y;
          pointerDownState.drag.hasOccurred = true;

          this.setState(newState);

          return;
        }
      }

      const hasHitASelectedElement = pointerDownState.hit.allHitElements.some(
        (element) => this.isASelectedElement(element),
      );

      const isSelectingPointsInLineEditor =
        this.state.selectedLinearElement?.isEditing &&
        event.shiftKey &&
        this.state.selectedLinearElement.elementId ===
          pointerDownState.hit.element?.id;

      if (
        (hasHitASelectedElement ||
          pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements) &&
        !isSelectingPointsInLineEditor &&
        !pointerDownState.drag.blockDragging
      ) {
        const selectedElements = this.scene.getSelectedElements(this.state);
        if (
          selectedElements.length > 0 &&
          selectedElements.every((element) => element.locked)
        ) {
          return;
        }

        const selectedElementsHasAFrame = selectedElements.find((e) =>
          isFrameLikeElement(e),
        );
        const topLayerFrame = this.getTopLayerFrameAtSceneCoords(pointerCoords);
        const frameToHighlight =
          topLayerFrame && !selectedElementsHasAFrame ? topLayerFrame : null;
        // Only update the state if there is a difference
        if (this.state.frameToHighlight !== frameToHighlight) {
          flushSync(() => {
            this.setState({ frameToHighlight });
          });
        }

        // Marking that click was used for dragging to check
        // if elements should be deselected on pointerup
        pointerDownState.drag.hasOccurred = true;

        // prevent immediate dragging during lasso selection to avoid element displacement
        // only allow dragging if we're not in the middle of lasso selection
        // (on mobile, allow dragging if we hit an element)
        if (
          this.state.activeTool.type === "lasso" &&
          this.lassoTrail.hasCurrentTrail &&
          !(this.isMobileOrTablet() && pointerDownState.hit.element) &&
          !this.state.activeTool.fromSelection
        ) {
          return;
        }

        // Clear lasso trail when starting to drag selected elements with lasso tool
        // Only clear if we're actually dragging (not during lasso selection)
        if (
          this.state.activeTool.type === "lasso" &&
          selectedElements.length > 0 &&
          pointerDownState.drag.hasOccurred &&
          !this.state.activeTool.fromSelection
        ) {
          this.lassoTrail.endPath();
        }

        // prevent dragging even if we're no longer holding cmd/ctrl otherwise
        // it would have weird results (stuff jumping all over the screen)
        // Checking for editingTextElement to avoid jump while editing on mobile #6503
        if (
          selectedElements.length > 0 &&
          !pointerDownState.withCmdOrCtrl &&
          !this.state.editingTextElement &&
          this.state.activeEmbeddable?.state !== "active"
        ) {
          const dragOffset = {
            x: pointerCoords.x - pointerDownState.drag.origin.x,
            y: pointerCoords.y - pointerDownState.drag.origin.y,
          };

          const originalElements = [
            ...pointerDownState.originalElements.values(),
          ];

          // We only drag in one direction if shift is pressed
          const lockDirection = event.shiftKey;

          if (lockDirection) {
            const distanceX = Math.abs(dragOffset.x);
            const distanceY = Math.abs(dragOffset.y);

            const lockX = lockDirection && distanceX < distanceY;
            const lockY = lockDirection && distanceX > distanceY;

            if (lockX) {
              dragOffset.x = 0;
            }

            if (lockY) {
              dragOffset.y = 0;
            }
          }

          // #region move crop region
          if (this.state.croppingElementId) {
            const croppingElement = this.scene
              .getNonDeletedElementsMap()
              .get(this.state.croppingElementId);

            if (
              croppingElement &&
              isImageElement(croppingElement) &&
              croppingElement.crop !== null &&
              pointerDownState.hit.element === croppingElement
            ) {
              const crop = croppingElement.crop;
              const image =
                isInitializedImageElement(croppingElement) &&
                this.imageCache.get(croppingElement.fileId)?.image;

              if (image && !(image instanceof Promise)) {
                const instantDragOffset = vectorScale(
                  vector(
                    pointerCoords.x - lastPointerCoords.x,
                    pointerCoords.y - lastPointerCoords.y,
                  ),
                  Math.max(this.state.zoom.value, 2),
                );

                const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
                  croppingElement,
                  elementsMap,
                );

                const topLeft = vectorFromPoint(
                  pointRotateRads(
                    pointFrom(x1, y1),
                    pointFrom(cx, cy),
                    croppingElement.angle,
                  ),
                );
                const topRight = vectorFromPoint(
                  pointRotateRads(
                    pointFrom(x2, y1),
                    pointFrom(cx, cy),
                    croppingElement.angle,
                  ),
                );
                const bottomLeft = vectorFromPoint(
                  pointRotateRads(
                    pointFrom(x1, y2),
                    pointFrom(cx, cy),
                    croppingElement.angle,
                  ),
                );
                const topEdge = vectorNormalize(
                  vectorSubtract(topRight, topLeft),
                );
                const leftEdge = vectorNormalize(
                  vectorSubtract(bottomLeft, topLeft),
                );

                // project instantDrafOffset onto leftEdge and topEdge to decompose
                const offsetVector = vector(
                  vectorDot(instantDragOffset, topEdge),
                  vectorDot(instantDragOffset, leftEdge),
                );

                const nextCrop = {
                  ...crop,
                  x: clamp(
                    crop.x -
                      offsetVector[0] * Math.sign(croppingElement.scale[0]),
                    0,
                    image.naturalWidth - crop.width,
                  ),
                  y: clamp(
                    crop.y -
                      offsetVector[1] * Math.sign(croppingElement.scale[1]),
                    0,
                    image.naturalHeight - crop.height,
                  ),
                };

                this.scene.mutateElement(croppingElement, {
                  crop: nextCrop,
                });

                return;
              }
            }
          }

          // Snap cache *must* be synchronously popuplated before initial drag,
          // otherwise the first drag even will not snap, causing a jump before
          // it snaps to its position if previously snapped already.
          this.maybeCacheVisibleGaps(event, selectedElements);
          this.maybeCacheReferenceSnapPoints(event, selectedElements);

          const { snapOffset, snapLines } = snapDraggedElements(
            originalElements,
            dragOffset,
            this,
            event,
            this.scene.getNonDeletedElementsMap(),
          );

          this.setState({ snapLines });

          // when we're editing the name of a frame, we want the user to be
          // able to select and interact with the text input
          if (!this.state.editingFrame) {
            dragSelectedElements(
              pointerDownState,
              selectedElements,
              dragOffset,
              this.scene,
              snapOffset,
              event[KEYS.CTRL_OR_CMD] ? null : this.getEffectiveGridSize(),
            );
          }

          this.setState({
            selectedElementsAreBeingDragged: true,
            // element is being dragged and selectionElement that was created on pointer down
            // should be removed
            selectionElement: null,
          });

          if (
            selectedElements.length !== 1 ||
            !isElbowArrow(selectedElements[0])
          ) {
            this.setState({
              suggestedBindings: getSuggestedBindingsForArrows(
                selectedElements,
                this.scene.getNonDeletedElementsMap(),
                this.state.zoom,
              ),
            });
          }

          // We duplicate the selected element if alt is pressed on pointer move
          if (event.altKey && !pointerDownState.hit.hasBeenDuplicated) {
            // Move the currently selected elements to the top of the z index stack, and
            // put the duplicates where the selected elements used to be.
            // (the origin point where the dragging started)

            pointerDownState.hit.hasBeenDuplicated = true;

            const elements = this.scene.getElementsIncludingDeleted();
            const hitElement = pointerDownState.hit.element;
            const selectedElements = this.scene.getSelectedElements({
              selectedElementIds: this.state.selectedElementIds,
              includeBoundTextElement: true,
              includeElementsInFrames: true,
            });
            if (
              hitElement &&
              // hit element may not end up being selected
              // if we're alt-dragging a common bounding box
              // over the hit element
              pointerDownState.hit.wasAddedToSelection &&
              !selectedElements.find((el) => el.id === hitElement.id)
            ) {
              selectedElements.push(hitElement);
            }

            const idsOfElementsToDuplicate = new Map(
              selectedElements.map((el) => [el.id, el]),
            );

            const {
              duplicatedElements,
              duplicateElementsMap,
              elementsWithDuplicates,
              origIdToDuplicateId,
            } = duplicateElements({
              type: "in-place",
              elements,
              appState: this.state,
              randomizeSeed: true,
              idsOfElementsToDuplicate,
              overrides: ({ duplicateElement, origElement }) => {
                return {
                  // reset to the original element's frameId (unless we've
                  // duplicated alongside a frame in which case we need to
                  // keep the duplicate frame's id) so that the element
                  // frame membership is refreshed on pointerup
                  // NOTE this is a hacky solution and should be done
                  // differently
                  frameId: duplicateElement.frameId ?? origElement.frameId,
                  seed: randomInteger(),
                };
              },
            });
            duplicatedElements.forEach((element) => {
              pointerDownState.originalElements.set(
                element.id,
                deepCopyElement(element),
              );
            });

            const mappedClonedElements = elementsWithDuplicates.map((el) => {
              if (idsOfElementsToDuplicate.has(el.id)) {
                const origEl = pointerDownState.originalElements.get(el.id);

                if (origEl) {
                  return newElementWith(el, {
                    x: origEl.x,
                    y: origEl.y,
                  });
                }
              }
              return el;
            });

            const mappedNewSceneElements = this.props.onDuplicate?.(
              mappedClonedElements,
              elements,
            );

            const elementsWithIndices = syncMovedIndices(
              mappedNewSceneElements || mappedClonedElements,
              arrayToMap(duplicatedElements),
            );

            // we need to update synchronously so as to keep pointerDownState,
            // appState, and scene elements in sync
            flushSync(() => {
              // swap hit element with the duplicated one
              if (pointerDownState.hit.element) {
                const cloneId = origIdToDuplicateId.get(
                  pointerDownState.hit.element.id,
                );
                const clonedElement =
                  cloneId && duplicateElementsMap.get(cloneId);
                pointerDownState.hit.element = clonedElement || null;
              }
              // swap hit elements with the duplicated ones
              pointerDownState.hit.allHitElements =
                pointerDownState.hit.allHitElements.reduce(
                  (
                    acc: typeof pointerDownState.hit.allHitElements,
                    origHitElement,
                  ) => {
                    const cloneId = origIdToDuplicateId.get(origHitElement.id);
                    const clonedElement =
                      cloneId && duplicateElementsMap.get(cloneId);
                    if (clonedElement) {
                      acc.push(clonedElement);
                    }

                    return acc;
                  },
                  [],
                );

              // update drag origin to the position at which we started
              // the duplication so that the drag offset is correct
              pointerDownState.drag.origin = viewportCoordsToSceneCoords(
                event,
                this.state,
              );

              // switch selected elements to the duplicated ones
              this.setState((prevState) => ({
                ...getSelectionStateForElements(
                  duplicatedElements,
                  this.scene.getNonDeletedElements(),
                  prevState,
                ),
              }));

              this.scene.replaceAllElements(elementsWithIndices);
              this.maybeCacheVisibleGaps(event, selectedElements, true);
              this.maybeCacheReferenceSnapPoints(event, selectedElements, true);
            });
          }

          return;
        }
      }

      if (this.state.selectionElement) {
        pointerDownState.lastCoords.x = pointerCoords.x;
        pointerDownState.lastCoords.y = pointerCoords.y;
        if (event.altKey) {
          this.setActiveTool(
            { type: "lasso", fromSelection: true },
            event.shiftKey,
          );
          this.lassoTrail.startPath(
            pointerDownState.origin.x,
            pointerDownState.origin.y,
            event.shiftKey,
          );
          this.setAppState({
            selectionElement: null,
          });
          return;
        }
        this.maybeDragNewGenericElement(pointerDownState, event);
      } else if (this.state.activeTool.type === "lasso") {
        if (!event.altKey && this.state.activeTool.fromSelection) {
          this.setActiveTool({ type: "selection" });
          this.createGenericElementOnPointerDown("selection", pointerDownState);
          pointerDownState.lastCoords.x = pointerCoords.x;
          pointerDownState.lastCoords.y = pointerCoords.y;
          this.maybeDragNewGenericElement(pointerDownState, event);
          this.lassoTrail.endPath();
        } else {
          this.lassoTrail.addPointToPath(
            pointerCoords.x,
            pointerCoords.y,
            event.shiftKey,
          );
        }
      } else {
        // It is very important to read this.state within each move event,
        // otherwise we would read a stale one!
        const newElement = this.state.newElement;

        if (!newElement) {
          return;
        }

        if (newElement.type === "freedraw") {
          const points = newElement.points;
          const dx = pointerCoords.x - newElement.x;
          const dy = pointerCoords.y - newElement.y;

          const lastPoint = points.length > 0 && points[points.length - 1];
          const discardPoint =
            lastPoint && lastPoint[0] === dx && lastPoint[1] === dy;

          if (!discardPoint) {
            const pressures = newElement.simulatePressure
              ? newElement.pressures
              : [...newElement.pressures, event.pressure];

            this.scene.mutateElement(
              newElement,
              {
                points: [...points, pointFrom<LocalPoint>(dx, dy)],
                pressures,
              },
              {
                informMutation: false,
                isDragging: false,
              },
            );

            this.setState({
              newElement,
            });
          }
        } else if (isLinearElement(newElement)) {
          pointerDownState.drag.hasOccurred = true;
          const points = newElement.points;
          let dx = gridX - newElement.x;
          let dy = gridY - newElement.y;

          if (shouldRotateWithDiscreteAngle(event) && points.length === 2) {
            ({ width: dx, height: dy } = getLockedLinearCursorAlignSize(
              newElement.x,
              newElement.y,
              pointerCoords.x,
              pointerCoords.y,
            ));
          }

          if (points.length === 1) {
            this.scene.mutateElement(
              newElement,
              {
                points: [...points, pointFrom<LocalPoint>(dx, dy)],
              },
              { informMutation: false, isDragging: false },
            );
          } else if (
            points.length === 2 ||
            (points.length > 1 && isElbowArrow(newElement))
          ) {
            this.scene.mutateElement(
              newElement,
              {
                points: [...points.slice(0, -1), pointFrom<LocalPoint>(dx, dy)],
              },
              { isDragging: true, informMutation: false },
            );
          }

          this.setState({
            newElement,
          });

          if (isBindingElement(newElement, false)) {
            // When creating a linear element by dragging
            this.setState({
              suggestedBindings: maybeSuggestBindingsForLinearElementAtCoords(
                newElement,
                [pointerCoords],
                this.scene,
                this.state.zoom,
                this.state.startBoundElement,
              ),
            });
          }
        } else {
          pointerDownState.lastCoords.x = pointerCoords.x;
          pointerDownState.lastCoords.y = pointerCoords.y;
          this.maybeDragNewGenericElement(pointerDownState, event, false);
        }
      }

      if (this.state.activeTool.type === "selection") {
        pointerDownState.boxSelection.hasOccurred = true;

        const elements = this.scene.getNonDeletedElements();

        // box-select line editor points
        if (this.state.selectedLinearElement?.isEditing) {
          LinearElementEditor.handleBoxSelection(
            event,
            this.state,
            this.setState.bind(this),
            this.scene.getNonDeletedElementsMap(),
          );
          // regular box-select
        } else {
          let shouldReuseSelection = true;

          if (!event.shiftKey && isSomeElementSelected(elements, this.state)) {
            if (
              pointerDownState.withCmdOrCtrl &&
              pointerDownState.hit.element
            ) {
              this.setState((prevState) =>
                selectGroupsForSelectedElements(
                  {
                    ...prevState,
                    selectedElementIds: {
                      [pointerDownState.hit.element!.id]: true,
                    },
                  },
                  this.scene.getNonDeletedElements(),
                  prevState,
                  this,
                ),
              );
            } else {
              shouldReuseSelection = false;
            }
          }
          const elementsWithinSelection = this.state.selectionElement
            ? getElementsWithinSelection(
                elements,
                this.state.selectionElement,
                this.scene.getNonDeletedElementsMap(),
                false,
              )
            : [];

          this.setState((prevState) => {
            const nextSelectedElementIds = {
              ...(shouldReuseSelection && prevState.selectedElementIds),
              ...elementsWithinSelection.reduce(
                (acc: Record<ExcalidrawElement["id"], true>, element) => {
                  acc[element.id] = true;
                  return acc;
                },
                {},
              ),
            };

            if (pointerDownState.hit.element) {
              // if using ctrl/cmd, select the hitElement only if we
              // haven't box-selected anything else
              if (!elementsWithinSelection.length) {
                nextSelectedElementIds[pointerDownState.hit.element.id] = true;
              } else {
                delete nextSelectedElementIds[pointerDownState.hit.element.id];
              }
            }

            prevState = !shouldReuseSelection
              ? { ...prevState, selectedGroupIds: {}, editingGroupId: null }
              : prevState;

            return {
              ...selectGroupsForSelectedElements(
                {
                  editingGroupId: prevState.editingGroupId,
                  selectedElementIds: nextSelectedElementIds,
                },
                this.scene.getNonDeletedElements(),
                prevState,
                this,
              ),
              // select linear element only when we haven't box-selected anything else
              selectedLinearElement:
                elementsWithinSelection.length === 1 &&
                isLinearElement(elementsWithinSelection[0])
                  ? new LinearElementEditor(
                      elementsWithinSelection[0],
                      this.scene.getNonDeletedElementsMap(),
                    )
                  : null,
              showHyperlinkPopup:
                elementsWithinSelection.length === 1 &&
                (elementsWithinSelection[0].link ||
                  isEmbeddableElement(elementsWithinSelection[0]))
                  ? "info"
                  : false,
            };
          });
        }
      }
    });
  }

  // Returns whether the pointer move happened over either scrollbar
  private handlePointerMoveOverScrollbars(
    event: PointerEvent,
    pointerDownState: PointerDownState,
  ): boolean {
    if (pointerDownState.scrollbars.isOverHorizontal) {
      const x = event.clientX;
      const dx = x - pointerDownState.lastCoords.x;
      this.translateCanvas({
        scrollX:
          this.state.scrollX -
          (dx * (currentScrollBars.horizontal?.deltaMultiplier || 1)) /
            this.state.zoom.value,
      });
      pointerDownState.lastCoords.x = x;
      return true;
    }

    if (pointerDownState.scrollbars.isOverVertical) {
      const y = event.clientY;
      const dy = y - pointerDownState.lastCoords.y;
      this.translateCanvas({
        scrollY:
          this.state.scrollY -
          (dy * (currentScrollBars.vertical?.deltaMultiplier || 1)) /
            this.state.zoom.value,
      });
      pointerDownState.lastCoords.y = y;
      return true;
    }
    return false;
  }

  private onPointerUpFromPointerDownHandler(
    pointerDownState: PointerDownState,
  ): (event: PointerEvent) => void {
    return withBatchedUpdates((childEvent: PointerEvent) => {
      this.removePointer(childEvent);
      pointerDownState.drag.blockDragging = false;
      if (pointerDownState.eventListeners.onMove) {
        pointerDownState.eventListeners.onMove.flush();
      }
      const {
        newElement,
        resizingElement,
        croppingElementId,
        multiElement,
        activeTool,
        isResizing,
        isRotating,
        isCropping,
      } = this.state;

      this.setState((prevState) => ({
        isResizing: false,
        isRotating: false,
        isCropping: false,
        resizingElement: null,
        selectionElement: null,
        frameToHighlight: null,
        elementsToHighlight: null,
        cursorButton: "up",
        snapLines: updateStable(prevState.snapLines, []),
        originSnapOffset: null,
      }));

      // just in case, tool changes mid drag, always clean up
      this.lassoTrail.endPath();
      this.lastPointerMoveCoords = null;

      SnapCache.setReferenceSnapPoints(null);
      SnapCache.setVisibleGaps(null);

      this.savePointer(childEvent.clientX, childEvent.clientY, "up");

      // if current elements are still selected
      // and the pointer is just over a locked element
      // do not allow activeLockedId to be set

      const hitElements = pointerDownState.hit.allHitElements;

      const sceneCoords = viewportCoordsToSceneCoords(
        { clientX: childEvent.clientX, clientY: childEvent.clientY },
        this.state,
      );

      if (
        this.state.activeTool.type === "selection" &&
        !pointerDownState.boxSelection.hasOccurred &&
        !pointerDownState.resize.isResizing &&
        !hitElements.some((el) => this.state.selectedElementIds[el.id])
      ) {
        const hitLockedElement = this.getElementAtPosition(
          sceneCoords.x,
          sceneCoords.y,
          {
            includeLockedElements: true,
          },
        );

        this.store.scheduleCapture();

        if (hitLockedElement?.locked) {
          this.setState({
            activeLockedId:
              hitLockedElement.groupIds.length > 0
                ? hitLockedElement.groupIds.at(-1) || ""
                : hitLockedElement.id,
          });
        } else {
          this.setState({
            activeLockedId: null,
          });
        }
      } else {
        this.setState({
          activeLockedId: null,
        });
      }

      this.setState({
        selectedElementsAreBeingDragged: false,
      });
      const elementsMap = this.scene.getNonDeletedElementsMap();

      if (
        pointerDownState.drag.hasOccurred &&
        pointerDownState.hit?.element?.id
      ) {
        const element = elementsMap.get(pointerDownState.hit.element.id);
        if (isBindableElement(element)) {
          // Renormalize elbow arrows when they are changed via indirect move
          element.boundElements
            ?.filter((e) => e.type === "arrow")
            .map((e) => elementsMap.get(e.id))
            .filter((e) => isElbowArrow(e))
            .forEach((e) => {
              !!e && this.scene.mutateElement(e, {});
            });
        }
      }

      // Handle end of dragging a point of a linear element, might close a loop
      // and sets binding element
      if (this.state.selectedLinearElement?.isEditing) {
        if (
          !pointerDownState.boxSelection.hasOccurred &&
          pointerDownState.hit?.element?.id !==
            this.state.selectedLinearElement.elementId
        ) {
          this.actionManager.executeAction(actionFinalize);
        } else {
          const editingLinearElement = LinearElementEditor.handlePointerUp(
            childEvent,
            this.state.selectedLinearElement,
            this.state,
            this.scene,
          );
          if (editingLinearElement !== this.state.selectedLinearElement) {
            this.setState({
              selectedLinearElement: editingLinearElement,
              suggestedBindings: [],
            });
          }
        }
      } else if (this.state.selectedLinearElement) {
        // Normalize elbow arrow points, remove close parallel segments
        if (this.state.selectedLinearElement.elbowed) {
          const element = LinearElementEditor.getElement(
            this.state.selectedLinearElement.elementId,
            this.scene.getNonDeletedElementsMap(),
          );
          if (element) {
            this.scene.mutateElement(
              element as ExcalidrawElbowArrowElement,
              {},
            );
          }
        }

        if (
          pointerDownState.hit?.element?.id !==
          this.state.selectedLinearElement.elementId
        ) {
          const selectedELements = this.scene.getSelectedElements(this.state);
          // set selectedLinearElement to null if there is more than one element selected since we don't want to show linear element handles
          if (selectedELements.length > 1) {
            this.setState({ selectedLinearElement: null });
          }
        } else if (this.state.selectedLinearElement.isDragging) {
          this.actionManager.executeAction(actionFinalize, "ui", {
            event: childEvent,
            sceneCoords,
          });
        }
      }

      this.missingPointerEventCleanupEmitter.clear();

      window.removeEventListener(
        EVENT.POINTER_MOVE,
        pointerDownState.eventListeners.onMove!,
      );
      window.removeEventListener(
        EVENT.POINTER_UP,
        pointerDownState.eventListeners.onUp!,
      );
      window.removeEventListener(
        EVENT.KEYDOWN,
        pointerDownState.eventListeners.onKeyDown!,
      );
      window.removeEventListener(
        EVENT.KEYUP,
        pointerDownState.eventListeners.onKeyUp!,
      );

      this.props?.onPointerUp?.(activeTool, pointerDownState);
      this.onPointerUpEmitter.trigger(
        this.state.activeTool,
        pointerDownState,
        childEvent,
      );

      if (newElement?.type === "freedraw") {
        const pointerCoords = viewportCoordsToSceneCoords(
          childEvent,
          this.state,
        );

        const points = newElement.points;
        let dx = pointerCoords.x - newElement.x;
        let dy = pointerCoords.y - newElement.y;

        // Allows dots to avoid being flagged as infinitely small
        if (dx === points[0][0] && dy === points[0][1]) {
          dy += 0.0001;
          dx += 0.0001;
        }

        const pressures = newElement.simulatePressure
          ? []
          : [...newElement.pressures, childEvent.pressure];

        this.scene.mutateElement(newElement, {
          points: [...points, pointFrom<LocalPoint>(dx, dy)],
          pressures,
          lastCommittedPoint: pointFrom<LocalPoint>(dx, dy),
        });

        this.actionManager.executeAction(actionFinalize);

        return;
      }

      if (isLinearElement(newElement)) {
        if (newElement!.points.length > 1) {
          this.store.scheduleCapture();
        }
        const pointerCoords = viewportCoordsToSceneCoords(
          childEvent,
          this.state,
        );

        const dragDistance =
          pointDistance(
            pointFrom(pointerCoords.x, pointerCoords.y),
            pointFrom(pointerDownState.origin.x, pointerDownState.origin.y),
          ) * this.state.zoom.value;

        if (
          (!pointerDownState.drag.hasOccurred ||
            dragDistance < MINIMUM_ARROW_SIZE) &&
          newElement &&
          !multiElement
        ) {
          if (this.device.isTouchScreen) {
            const FIXED_DELTA_X = Math.min(
              (this.state.width * 0.7) / this.state.zoom.value,
              100,
            );

            this.scene.mutateElement(
              newElement,
              {
                x: newElement.x - FIXED_DELTA_X / 2,
                points: [
                  pointFrom<LocalPoint>(0, 0),
                  pointFrom<LocalPoint>(FIXED_DELTA_X, 0),
                ],
              },
              { informMutation: false, isDragging: false },
            );

            this.actionManager.executeAction(actionFinalize);
          } else {
            const dx = pointerCoords.x - newElement.x;
            const dy = pointerCoords.y - newElement.y;

            this.scene.mutateElement(
              newElement,
              {
                points: [...newElement.points, pointFrom<LocalPoint>(dx, dy)],
              },
              { informMutation: false, isDragging: false },
            );

            this.setState({
              multiElement: newElement,
              newElement,
            });
          }
        } else if (pointerDownState.drag.hasOccurred && !multiElement) {
          if (
            isBindingEnabled(this.state) &&
            isBindingElement(newElement, false)
          ) {
            this.actionManager.executeAction(actionFinalize, "ui", {
              event: childEvent,
              sceneCoords,
            });
          }
          this.setState({ suggestedBindings: [], startBoundElement: null });
          if (!activeTool.locked) {
            resetCursor(this.interactiveCanvas);
            this.setState((prevState) => ({
              newElement: null,
              activeTool: updateActiveTool(this.state, {
                type: this.defaultSelectionTool,
              }),
              selectedElementIds: makeNextSelectedElementIds(
                {
                  ...prevState.selectedElementIds,
                  [newElement.id]: true,
                },
                prevState,
              ),
              selectedLinearElement: new LinearElementEditor(
                newElement,
                this.scene.getNonDeletedElementsMap(),
              ),
            }));
          } else {
            this.setState((prevState) => ({
              newElement: null,
            }));
          }
          // so that the scene gets rendered again to display the newly drawn linear as well
          this.scene.triggerUpdate();
        }
        return;
      }

      if (isTextElement(newElement)) {
        const minWidth = getMinTextElementWidth(
          getFontString({
            fontSize: newElement.fontSize,
            fontFamily: newElement.fontFamily,
          }),
          newElement.lineHeight,
        );

        if (newElement.width < minWidth) {
          this.scene.mutateElement(newElement, {
            autoResize: true,
          });
        }

        this.resetCursor();

        this.handleTextWysiwyg(newElement, {
          isExistingElement: true,
        });
      }

      if (
        activeTool.type !== "selection" &&
        newElement &&
        isInvisiblySmallElement(newElement)
      ) {
        // remove invisible element which was added in onPointerDown
        // update the store snapshot, so that invisible elements are not captured by the store
        this.updateScene({
          elements: this.scene
            .getElementsIncludingDeleted()
            .filter((el) => el.id !== newElement.id),
          appState: {
            newElement: null,
          },
          captureUpdate: CaptureUpdateAction.NEVER,
        });

        return;
      }

      if (isFrameLikeElement(newElement)) {
        const elementsInsideFrame = getElementsInNewFrame(
          this.scene.getElementsIncludingDeleted(),
          newElement,
          this.scene.getNonDeletedElementsMap(),
        );

        this.scene.replaceAllElements(
          addElementsToFrame(
            this.scene.getElementsMapIncludingDeleted(),
            elementsInsideFrame,
            newElement,
            this.state,
          ),
        );
      }

      if (newElement) {
        this.scene.mutateElement(
          newElement,
          getNormalizedDimensions(newElement),
          {
            informMutation: false,
            isDragging: false,
          },
        );
        // the above does not guarantee the scene to be rendered again, hence the trigger below
        this.scene.triggerUpdate();
      }

      if (pointerDownState.drag.hasOccurred) {
        const sceneCoords = viewportCoordsToSceneCoords(childEvent, this.state);

        // when editing the points of a linear element, we check if the
        // linear element still is in the frame afterwards
        // if not, the linear element will be removed from its frame (if any)
        if (
          this.state.selectedLinearElement &&
          this.state.selectedLinearElement.isDragging
        ) {
          const linearElement = this.scene.getElement(
            this.state.selectedLinearElement.elementId,
          );

          if (linearElement?.frameId) {
            const frame = getContainingFrame(linearElement, elementsMap);

            if (frame && linearElement) {
              if (
                !elementOverlapsWithFrame(
                  linearElement,
                  frame,
                  this.scene.getNonDeletedElementsMap(),
                )
              ) {
                // remove the linear element from all groups
                // before removing it from the frame as well
                this.scene.mutateElement(linearElement, {
                  groupIds: [],
                });

                removeElementsFromFrame(
                  [linearElement],
                  this.scene.getNonDeletedElementsMap(),
                );

                this.scene.triggerUpdate();
              }
            }
          }
        } else {
          // update the relationships between selected elements and frames
          const topLayerFrame = this.getTopLayerFrameAtSceneCoords(sceneCoords);

          const selectedElements = this.scene.getSelectedElements(this.state);
          let nextElements = this.scene.getElementsMapIncludingDeleted();

          const updateGroupIdsAfterEditingGroup = (
            elements: ExcalidrawElement[],
          ) => {
            if (elements.length > 0) {
              for (const element of elements) {
                const index = element.groupIds.indexOf(
                  this.state.editingGroupId!,
                );

                this.scene.mutateElement(
                  element,
                  {
                    groupIds: element.groupIds.slice(0, index),
                  },
                  { informMutation: false, isDragging: false },
                );
              }

              nextElements.forEach((element) => {
                if (
                  element.groupIds.length &&
                  getElementsInGroup(
                    nextElements,
                    element.groupIds[element.groupIds.length - 1],
                  ).length < 2
                ) {
                  this.scene.mutateElement(
                    element,
                    {
                      groupIds: [],
                    },
                    { informMutation: false, isDragging: false },
                  );
                }
              });

              this.setState({
                editingGroupId: null,
              });
            }
          };

          if (
            topLayerFrame &&
            !this.state.selectedElementIds[topLayerFrame.id]
          ) {
            const elementsToAdd = selectedElements.filter(
              (element) =>
                element.frameId !== topLayerFrame.id &&
                isElementInFrame(element, nextElements, this.state),
            );

            if (this.state.editingGroupId) {
              updateGroupIdsAfterEditingGroup(elementsToAdd);
            }

            nextElements = addElementsToFrame(
              nextElements,
              elementsToAdd,
              topLayerFrame,
              this.state,
            );
          } else if (!topLayerFrame) {
            if (this.state.editingGroupId) {
              const elementsToRemove = selectedElements.filter(
                (element) =>
                  element.frameId &&
                  !isElementInFrame(element, nextElements, this.state),
              );

              updateGroupIdsAfterEditingGroup(elementsToRemove);
            }
          }

          nextElements = updateFrameMembershipOfSelectedElements(
            nextElements,
            this.state,
            this,
          );

          this.scene.replaceAllElements(nextElements);
        }
      }

      if (resizingElement) {
        this.store.scheduleCapture();
      }

      if (resizingElement && isInvisiblySmallElement(resizingElement)) {
        // update the store snapshot, so that invisible elements are not captured by the store
        this.updateScene({
          elements: this.scene
            .getElementsIncludingDeleted()
            .filter((el) => el.id !== resizingElement.id),
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      }

      // handle frame membership for resizing frames and/or selected elements
      if (pointerDownState.resize.isResizing) {
        let nextElements = updateFrameMembershipOfSelectedElements(
          this.scene.getElementsIncludingDeleted(),
          this.state,
          this,
        );

        const selectedFrames = this.scene
          .getSelectedElements(this.state)
          .filter((element): element is ExcalidrawFrameLikeElement =>
            isFrameLikeElement(element),
          );

        for (const frame of selectedFrames) {
          nextElements = replaceAllElementsInFrame(
            nextElements,
            getElementsInResizingFrame(
              this.scene.getElementsIncludingDeleted(),
              frame,
              this.state,
              elementsMap,
            ),
            frame,
            this,
          );
        }

        this.scene.replaceAllElements(nextElements);
      }

      // Code below handles selection when element(s) weren't
      // drag or added to selection on pointer down phase.
      const hitElement = pointerDownState.hit.element;
      if (
        this.state.selectedLinearElement?.elementId !== hitElement?.id &&
        isLinearElement(hitElement)
      ) {
        const selectedElements = this.scene.getSelectedElements(this.state);
        // set selectedLinearElement when no other element selected except
        // the one we've hit
        if (selectedElements.length === 1) {
          this.setState({
            selectedLinearElement: new LinearElementEditor(
              hitElement,
              this.scene.getNonDeletedElementsMap(),
            ),
          });
        }
      }

      // click outside the cropping region to exit
      if (
        // not in the cropping mode at all
        !croppingElementId ||
        // in the cropping mode
        (croppingElementId &&
          // not cropping and no hit element
          ((!hitElement && !isCropping) ||
            // hitting something else
            (hitElement && hitElement.id !== croppingElementId)))
      ) {
        this.finishImageCropping();
      }

      const pointerStart = this.lastPointerDownEvent;
      const pointerEnd = this.lastPointerUpEvent || this.lastPointerMoveEvent;

      if (isEraserActive(this.state) && pointerStart && pointerEnd) {
        this.eraserTrail.endPath();

        const draggedDistance = pointDistance(
          pointFrom(pointerStart.clientX, pointerStart.clientY),
          pointFrom(pointerEnd.clientX, pointerEnd.clientY),
        );

        if (draggedDistance === 0) {
          const scenePointer = viewportCoordsToSceneCoords(
            {
              clientX: pointerEnd.clientX,
              clientY: pointerEnd.clientY,
            },
            this.state,
          );
          const hitElements = this.getElementsAtPosition(
            scenePointer.x,
            scenePointer.y,
          );
          hitElements.forEach((hitElement) =>
            this.elementsPendingErasure.add(hitElement.id),
          );
        }
        this.eraseElements();
        return;
      } else if (this.elementsPendingErasure.size) {
        this.restoreReadyToEraseElements();
      }

      if (
        hitElement &&
        !pointerDownState.drag.hasOccurred &&
        !pointerDownState.hit.wasAddedToSelection &&
        // if we're editing a line, pointerup shouldn't switch selection if
        // box selected
        (!this.state.selectedLinearElement?.isEditing ||
          !pointerDownState.boxSelection.hasOccurred) &&
        // hitElement can be set when alt + ctrl to toggle lasso and we will
        // just respect the selected elements from lasso instead
        this.state.activeTool.type !== "lasso"
      ) {
        // when inside line editor, shift selects points instead
        if (
          childEvent.shiftKey &&
          !this.state.selectedLinearElement?.isEditing
        ) {
          if (this.state.selectedElementIds[hitElement.id]) {
            if (isSelectedViaGroup(this.state, hitElement)) {
              this.setState((_prevState) => {
                const nextSelectedElementIds = {
                  ..._prevState.selectedElementIds,
                };

                // We want to unselect all groups hitElement is part of
                // as well as all elements that are part of the groups
                // hitElement is part of
                for (const groupedElement of hitElement.groupIds.flatMap(
                  (groupId) =>
                    getElementsInGroup(
                      this.scene.getNonDeletedElements(),
                      groupId,
                    ),
                )) {
                  delete nextSelectedElementIds[groupedElement.id];
                }

                return {
                  selectedGroupIds: {
                    ..._prevState.selectedElementIds,
                    ...hitElement.groupIds
                      .map((gId) => ({ [gId]: false }))
                      .reduce((prev, acc) => ({ ...prev, ...acc }), {}),
                  },
                  selectedElementIds: makeNextSelectedElementIds(
                    nextSelectedElementIds,
                    _prevState,
                  ),
                };
              });
              // if not dragging a linear element point (outside editor)
            } else if (!this.state.selectedLinearElement?.isDragging) {
              // remove element from selection while
              // keeping prev elements selected

              this.setState((prevState) => {
                const newSelectedElementIds = {
                  ...prevState.selectedElementIds,
                };
                delete newSelectedElementIds[hitElement!.id];
                const newSelectedElements = getSelectedElements(
                  this.scene.getNonDeletedElements(),
                  { selectedElementIds: newSelectedElementIds },
                );

                return {
                  ...selectGroupsForSelectedElements(
                    {
                      editingGroupId: prevState.editingGroupId,
                      selectedElementIds: newSelectedElementIds,
                    },
                    this.scene.getNonDeletedElements(),
                    prevState,
                    this,
                  ),
                  // set selectedLinearElement only if thats the only element selected
                  selectedLinearElement:
                    newSelectedElements.length === 1 &&
                    isLinearElement(newSelectedElements[0])
                      ? new LinearElementEditor(
                          newSelectedElements[0],
                          this.scene.getNonDeletedElementsMap(),
                        )
                      : prevState.selectedLinearElement,
                };
              });
            }
          } else if (
            hitElement.frameId &&
            this.state.selectedElementIds[hitElement.frameId]
          ) {
            // when hitElement is part of a selected frame, deselect the frame
            // to avoid frame and containing elements selected simultaneously
            this.setState((prevState) => {
              const nextSelectedElementIds: {
                [id: string]: true;
              } = {
                ...prevState.selectedElementIds,
                [hitElement.id]: true,
              };
              // deselect the frame
              delete nextSelectedElementIds[hitElement.frameId!];

              // deselect groups containing the frame
              (this.scene.getElement(hitElement.frameId!)?.groupIds ?? [])
                .flatMap((gid) =>
                  getElementsInGroup(this.scene.getNonDeletedElements(), gid),
                )
                .forEach((element) => {
                  delete nextSelectedElementIds[element.id];
                });

              return {
                ...selectGroupsForSelectedElements(
                  {
                    editingGroupId: prevState.editingGroupId,
                    selectedElementIds: nextSelectedElementIds,
                  },
                  this.scene.getNonDeletedElements(),
                  prevState,
                  this,
                ),
                showHyperlinkPopup:
                  hitElement.link || isEmbeddableElement(hitElement)
                    ? "info"
                    : false,
              };
            });
          } else {
            // add element to selection while keeping prev elements selected
            this.setState((_prevState) => ({
              selectedElementIds: makeNextSelectedElementIds(
                {
                  ..._prevState.selectedElementIds,
                  [hitElement!.id]: true,
                },
                _prevState,
              ),
            }));
          }
        } else {
          this.setState((prevState) => ({
            ...selectGroupsForSelectedElements(
              {
                editingGroupId: prevState.editingGroupId,
                selectedElementIds: { [hitElement.id]: true },
              },
              this.scene.getNonDeletedElements(),
              prevState,
              this,
            ),
            selectedLinearElement:
              isLinearElement(hitElement) &&
              // Don't set `selectedLinearElement` if its same as the hitElement, this is mainly to prevent resetting the `hoverPointIndex` to -1.
              // Future we should update the API to take care of setting the correct `hoverPointIndex` when initialized
              prevState.selectedLinearElement?.elementId !== hitElement.id
                ? new LinearElementEditor(
                    hitElement,
                    this.scene.getNonDeletedElementsMap(),
                  )
                : prevState.selectedLinearElement,
          }));
        }
      }

      if (
        // do not clear selection if lasso is active
        this.state.activeTool.type !== "lasso" &&
        // not elbow midpoint dragged
        !(hitElement && isElbowArrow(hitElement)) &&
        // not dragged
        !pointerDownState.drag.hasOccurred &&
        // not resized
        !this.state.isResizing &&
        // only hitting the bounding box of the previous hit element
        ((hitElement &&
          hitElementBoundingBoxOnly(
            {
              point: pointFrom(
                pointerDownState.origin.x,
                pointerDownState.origin.y,
              ),
              element: hitElement,
              elementsMap,
              threshold: this.getElementHitThreshold(hitElement),
              frameNameBound: isFrameLikeElement(hitElement)
                ? this.frameNameBoundsCache.get(hitElement)
                : null,
            },
            elementsMap,
          )) ||
          (!hitElement &&
            pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements))
      ) {
        if (this.state.selectedLinearElement?.isEditing) {
          // Exit editing mode but keep the element selected
          this.actionManager.executeAction(actionToggleLinearEditor);
        } else {
          // Deselect selected elements
          this.setState({
            selectedElementIds: makeNextSelectedElementIds({}, this.state),
            selectedGroupIds: {},
            editingGroupId: null,
            activeEmbeddable: null,
          });
        }
        // reset cursor
        setCursor(this.interactiveCanvas, CURSOR_TYPE.AUTO);
        return;
      }

      if (!activeTool.locked && activeTool.type !== "freedraw" && newElement) {
        this.setState((prevState) => ({
          selectedElementIds: makeNextSelectedElementIds(
            {
              ...prevState.selectedElementIds,
              [newElement.id]: true,
            },
            prevState,
          ),
          showHyperlinkPopup:
            isEmbeddableElement(newElement) && !newElement.link
              ? "editor"
              : prevState.showHyperlinkPopup,
        }));
      }

      if (
        activeTool.type !== "selection" ||
        isSomeElementSelected(this.scene.getNonDeletedElements(), this.state) ||
        !isShallowEqual(
          this.state.previousSelectedElementIds,
          this.state.selectedElementIds,
        )
      ) {
        this.store.scheduleCapture();
      }

      if (
        (pointerDownState.drag.hasOccurred &&
          !this.state.selectedLinearElement) ||
        isResizing ||
        isRotating ||
        isCropping
      ) {
        // We only allow binding via linear elements, specifically via dragging
        // the endpoints ("start" or "end").
        const linearElements = this.scene
          .getSelectedElements(this.state)
          .filter(isLinearElement);

        bindOrUnbindLinearElements(
          linearElements,
          isBindingEnabled(this.state),
          this.state.selectedLinearElement?.selectedPointsIndices ?? [],
          this.scene,
          this.state.zoom,
        );
      }

      if (activeTool.type === "laser") {
        this.laserTrails.endPath();
        return;
      }

      if (
        !activeTool.locked &&
        activeTool.type !== "freedraw" &&
        (activeTool.type !== "lasso" ||
          // if lasso is turned on but from selection => reset to selection
          (activeTool.type === "lasso" && activeTool.fromSelection))
      ) {
        resetCursor(this.interactiveCanvas);
        this.setState({
          newElement: null,
          suggestedBindings: [],
          activeTool: updateActiveTool(this.state, {
            type: this.defaultSelectionTool,
          }),
        });
      } else {
        this.setState({
          newElement: null,
          suggestedBindings: [],
        });
      }

      if (
        hitElement &&
        this.lastPointerUpEvent &&
        this.lastPointerDownEvent &&
        this.lastPointerUpEvent.timeStamp -
          this.lastPointerDownEvent.timeStamp <
          300 &&
        gesture.pointers.size <= 1 &&
        isIframeLikeElement(hitElement) &&
        this.isIframeLikeElementCenter(
          hitElement,
          this.lastPointerUpEvent,
          pointerDownState.origin.x,
          pointerDownState.origin.y,
        )
      ) {
        this.handleEmbeddableCenterClick(hitElement);
      }
    });
  }

  private restoreReadyToEraseElements = () => {
    this.elementsPendingErasure = new Set();
    this.triggerRender();
  };

  private eraseElements = () => {
    let didChange = false;
    const elements = this.scene.getElementsIncludingDeleted().map((ele) => {
      if (
        this.elementsPendingErasure.has(ele.id) ||
        (ele.frameId && this.elementsPendingErasure.has(ele.frameId)) ||
        (isBoundToContainer(ele) &&
          this.elementsPendingErasure.has(ele.containerId))
      ) {
        didChange = true;
        return newElementWith(ele, { isDeleted: true });
      }
      return ele;
    });

    this.elementsPendingErasure = new Set();

    if (didChange) {
      this.store.scheduleCapture();
      this.scene.replaceAllElements(elements);
    }
  };

  private initializeImage = async (
    placeholderImageElement: ExcalidrawImageElement,
    imageFile: File,
  ) => {
    // at this point this should be guaranteed image file, but we do this check
    // to satisfy TS down the line
    if (!isSupportedImageFile(imageFile)) {
      throw new Error(t("errors.unsupportedFileType"));
    }
    const mimeType = imageFile.type;

    setCursor(this.interactiveCanvas, "wait");

    if (mimeType === MIME_TYPES.svg) {
      try {
        imageFile = SVGStringToFile(
          normalizeSVG(await imageFile.text()),
          imageFile.name,
        );
      } catch (error: any) {
        console.warn(error);
        throw new Error(t("errors.svgImageInsertError"));
      }
    }

    // generate image id (by default the file digest) before any
    // resizing/compression takes place to keep it more portable
    const fileId = await ((this.props.generateIdForFile?.(
      imageFile,
    ) as Promise<FileId>) || generateIdFromFile(imageFile));

    if (!fileId) {
      console.warn(
        "Couldn't generate file id or the supplied `generateIdForFile` didn't resolve to one.",
      );
      throw new Error(t("errors.imageInsertError"));
    }

    const existingFileData = this.files[fileId];
    if (!existingFileData?.dataURL) {
      try {
        imageFile = await resizeImageFile(imageFile, {
          maxWidthOrHeight: DEFAULT_MAX_IMAGE_WIDTH_OR_HEIGHT,
        });
      } catch (error: any) {
        console.error(
          "Error trying to resizing image file on insertion",
          error,
        );
      }

      if (imageFile.size > MAX_ALLOWED_FILE_BYTES) {
        throw new Error(
          t("errors.fileTooBig", {
            maxSize: `${Math.trunc(MAX_ALLOWED_FILE_BYTES / 1024 / 1024)}MB`,
          }),
        );
      }
    }

    const dataURL =
      this.files[fileId]?.dataURL || (await getDataURL(imageFile));

    return new Promise<NonDeleted<InitializedExcalidrawImageElement>>(
      async (resolve, reject) => {
        try {
          let initializedImageElement = this.getLatestInitializedImageElement(
            placeholderImageElement,
            fileId,
          );

          this.addMissingFiles([
            {
              mimeType,
              id: fileId,
              dataURL,
              created: Date.now(),
              lastRetrieved: Date.now(),
            },
          ]);

          if (!this.imageCache.get(fileId)) {
            this.addNewImagesToImageCache();

            const { erroredFiles } = await this.updateImageCache([
              initializedImageElement,
            ]);

            if (erroredFiles.size) {
              throw new Error("Image cache update resulted with an error.");
            }
          }

          const imageHTML = await this.imageCache.get(fileId)?.image;

          if (
            imageHTML &&
            this.state.newElement?.id !== initializedImageElement.id
          ) {
            initializedImageElement = this.getLatestInitializedImageElement(
              placeholderImageElement,
              fileId,
            );

            const naturalDimensions = this.getImageNaturalDimensions(
              initializedImageElement,
              imageHTML,
            );

            // no need to create a new instance anymore, just assign the natural dimensions
            Object.assign(initializedImageElement, naturalDimensions);
          }

          resolve(initializedImageElement);
        } catch (error: any) {
          console.error(error);
          reject(new Error(t("errors.imageInsertError")));
        }
      },
    );
  };

  /**
   * use during async image initialization,
   * when the placeholder image could have been modified in the meantime,
   * and when you don't want to loose those modifications
   */
  private getLatestInitializedImageElement = (
    imagePlaceholder: ExcalidrawImageElement,
    fileId: FileId,
  ) => {
    const latestImageElement =
      this.scene.getElement(imagePlaceholder.id) ?? imagePlaceholder;

    return newElementWith(
      latestImageElement as InitializedExcalidrawImageElement,
      {
        fileId,
      },
    );
  };

  private onImageToolbarButtonClick = async () => {
    try {
      const clientX = this.state.width / 2 + this.state.offsetLeft;
      const clientY = this.state.height / 2 + this.state.offsetTop;

      const { x, y } = viewportCoordsToSceneCoords(
        { clientX, clientY },
        this.state,
      );

      const imageFiles = await fileOpen({
        description: "Image",
        extensions: Object.keys(
          IMAGE_MIME_TYPES,
        ) as (keyof typeof IMAGE_MIME_TYPES)[],
        multiple: true,
      });

      this.insertImages(imageFiles, x, y);
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error(error);
      } else {
        console.warn(error);
      }
      this.setState(
        {
          newElement: null,
          activeTool: updateActiveTool(this.state, {
            type: this.defaultSelectionTool,
          }),
        },
        () => {
          this.actionManager.executeAction(actionFinalize);
        },
      );
    }
  };

  private getImageNaturalDimensions = (
    imageElement: ExcalidrawImageElement,
    imageHTML: HTMLImageElement,
  ) => {
    const minHeight = Math.max(this.state.height - 120, 160);
    // max 65% of canvas height, clamped to <300px, vh - 120px>
    const maxHeight = Math.min(
      minHeight,
      Math.floor(this.state.height * 0.5) / this.state.zoom.value,
    );

    const height = Math.min(imageHTML.naturalHeight, maxHeight);
    const width = height * (imageHTML.naturalWidth / imageHTML.naturalHeight);

    // add current imageElement width/height to account for previous centering
    // of the placeholder image
    const x = imageElement.x + imageElement.width / 2 - width / 2;
    const y = imageElement.y + imageElement.height / 2 - height / 2;

    return {
      x,
      y,
      width,
      height,
      crop: null,
    };
  };

  /** updates image cache, refreshing updated elements and/or setting status
      to error for images that fail during <img> element creation */
  private updateImageCache = async (
    elements: readonly InitializedExcalidrawImageElement[],
    files = this.files,
  ) => {
    const { updatedFiles, erroredFiles } = await _updateImageCache({
      imageCache: this.imageCache,
      fileIds: elements.map((element) => element.fileId),
      files,
    });

    if (erroredFiles.size) {
      this.store.scheduleAction(CaptureUpdateAction.NEVER);
      this.scene.replaceAllElements(
        this.scene.getElementsIncludingDeleted().map((element) => {
          if (
            isInitializedImageElement(element) &&
            erroredFiles.has(element.fileId)
          ) {
            return newElementWith(element, {
              status: "error",
            });
          }
          return element;
        }),
      );
    }

    return { updatedFiles, erroredFiles };
  };

  /** adds new images to imageCache and re-renders if needed */
  private addNewImagesToImageCache = async (
    imageElements: InitializedExcalidrawImageElement[] = getInitializedImageElements(
      this.scene.getNonDeletedElements(),
    ),
    files: BinaryFiles = this.files,
  ) => {
    const uncachedImageElements = imageElements.filter(
      (element) => !element.isDeleted && !this.imageCache.has(element.fileId),
    );

    if (uncachedImageElements.length) {
      const { updatedFiles } = await this.updateImageCache(
        uncachedImageElements,
        files,
      );

      if (updatedFiles.size) {
        for (const element of uncachedImageElements) {
          if (updatedFiles.has(element.fileId)) {
            ShapeCache.delete(element);
          }
        }
      }

      if (updatedFiles.size) {
        this.scene.triggerUpdate();
      }
    }
  };

  /** generally you should use `addNewImagesToImageCache()` directly if you need
   *  to render new images. This is just a failsafe  */
  private scheduleImageRefresh = throttle(() => {
    this.addNewImagesToImageCache();
  }, IMAGE_RENDER_TIMEOUT);

  private updateBindingEnabledOnPointerMove = (
    event: React.PointerEvent<HTMLElement>,
  ) => {
    const shouldEnableBinding = shouldEnableBindingForPointerEvent(event);
    if (this.state.isBindingEnabled !== shouldEnableBinding) {
      this.setState({ isBindingEnabled: shouldEnableBinding });
    }
  };

  private maybeSuggestBindingAtCursor = (
    pointerCoords: {
      x: number;
      y: number;
    },
    considerAll: boolean,
  ): void => {
    const hoveredBindableElement = getHoveredElementForBinding(
      pointerCoords,
      this.scene.getNonDeletedElements(),
      this.scene.getNonDeletedElementsMap(),
      this.state.zoom,
      false,
      considerAll,
    );
    this.setState({
      suggestedBindings:
        hoveredBindableElement != null ? [hoveredBindableElement] : [],
    });
  };

  private clearSelection(hitElement: ExcalidrawElement | null): void {
    this.setState((prevState) => ({
      selectedElementIds: makeNextSelectedElementIds({}, prevState),
      activeEmbeddable: null,
      selectedGroupIds: {},
      // Continue editing the same group if the user selected a different
      // element from it
      editingGroupId:
        prevState.editingGroupId &&
        hitElement != null &&
        isElementInGroup(hitElement, prevState.editingGroupId)
          ? prevState.editingGroupId
          : null,
    }));
    this.setState({
      selectedElementIds: makeNextSelectedElementIds({}, this.state),
      activeEmbeddable: null,
      previousSelectedElementIds: this.state.selectedElementIds,
    });
  }

  private handleInteractiveCanvasRef = (canvas: HTMLCanvasElement | null) => {
    // canvas is null when unmounting
    if (canvas !== null) {
      this.interactiveCanvas = canvas;

      // -----------------------------------------------------------------------
      // NOTE wheel, touchstart, touchend events must be registered outside
      // of react because react binds them them passively (so we can't prevent
      // default on them)
      this.interactiveCanvas.addEventListener(
        EVENT.TOUCH_START,
        this.onTouchStart,
        { passive: false },
      );
      this.interactiveCanvas.addEventListener(EVENT.TOUCH_END, this.onTouchEnd);
      // -----------------------------------------------------------------------
    } else {
      this.interactiveCanvas?.removeEventListener(
        EVENT.TOUCH_START,
        this.onTouchStart,
      );
      this.interactiveCanvas?.removeEventListener(
        EVENT.TOUCH_END,
        this.onTouchEnd,
      );
    }
  };

  private insertImages = async (
    imageFiles: File[],
    sceneX: number,
    sceneY: number,
  ) => {
    const gridPadding = 50 / this.state.zoom.value;
    // Create, position, and insert placeholders
    const placeholders = positionElementsOnGrid(
      imageFiles.map(() => this.newImagePlaceholder({ sceneX, sceneY })),
      sceneX,
      sceneY,
      gridPadding,
    );
    placeholders.forEach((el) => this.scene.insertElement(el));

    // Create, position, insert and select initialized (replacing placeholders)
    const initialized = await Promise.all(
      placeholders.map(async (placeholder, i) => {
        try {
          return await this.initializeImage(placeholder, imageFiles[i]);
        } catch (error: any) {
          this.setState({
            errorMessage: error.message || t("errors.imageInsertError"),
          });
          return newElementWith(placeholder, { isDeleted: true });
        }
      }),
    );
    const initializedMap = arrayToMap(initialized);

    const positioned = positionElementsOnGrid(
      initialized.filter((el) => !el.isDeleted),
      sceneX,
      sceneY,
      gridPadding,
    );
    const positionedMap = arrayToMap(positioned);

    const nextElements = this.scene
      .getElementsIncludingDeleted()
      .map((el) => positionedMap.get(el.id) ?? initializedMap.get(el.id) ?? el);

    this.updateScene({
      appState: {
        selectedElementIds: makeNextSelectedElementIds(
          Object.fromEntries(positioned.map((el) => [el.id, true])),
          this.state,
        ),
      },
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    this.setState({}, () => {
      // actionFinalize after all state values have been updated
      this.actionManager.executeAction(actionFinalize);
    });
  };

  private handleAppOnDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
      event,
      this.state,
    );
    const dataTransferList = await parseDataTransferEvent(event);

    // must be retrieved first, in the same frame
    const fileItems = dataTransferList.getFiles();

    if (fileItems.length === 1) {
      const { file, fileHandle } = fileItems[0];

      if (
        file &&
        (file.type === MIME_TYPES.png || file.type === MIME_TYPES.svg)
      ) {
        try {
          const scene = await loadFromBlob(
            file,
            this.state,
            this.scene.getElementsIncludingDeleted(),
            fileHandle,
          );
          this.syncActionResult({
            ...scene,
            appState: {
              ...(scene.appState || this.state),
              isLoading: false,
            },
            replaceFiles: true,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });
          return;
        } catch (error: any) {
          if (error.name !== "EncodingError") {
            throw new Error(t("alerts.couldNotLoadInvalidFile"));
          }
          // if EncodingError, fall through to insert as regular image
        }
      }
    }

    const imageFiles = fileItems
      .map((data) => data.file)
      .filter((file) => isSupportedImageFile(file));

    if (imageFiles.length > 0 && this.isToolSupported("image")) {
      return this.insertImages(imageFiles, sceneX, sceneY);
    }

    const libraryJSON = dataTransferList.getData(MIME_TYPES.excalidrawlib);
    if (libraryJSON && typeof libraryJSON === "string") {
      try {
        const libraryItems = parseLibraryJSON(libraryJSON);
        this.addElementsFromPasteOrLibrary({
          elements: distributeLibraryItemsOnSquareGrid(libraryItems),
          position: event,
          files: null,
        });
      } catch (error: any) {
        this.setState({ errorMessage: error.message });
      }
      return;
    }

    if (fileItems.length > 0) {
      const { file, fileHandle } = fileItems[0];
      if (file) {
        // Attempt to parse an excalidraw/excalidrawlib file
        await this.loadFileToCanvas(file, fileHandle);
      }
    }

    const textItem = dataTransferList.findByType(MIME_TYPES.text);

    if (textItem) {
      const text = textItem.value;
      if (
        text &&
        embeddableURLValidator(text, this.props.validateEmbeddable) &&
        (/^(http|https):\/\/[^\s/$.?#].[^\s]*$/.test(text) ||
          getEmbedLink(text)?.type === "video")
      ) {
        const embeddable = this.insertEmbeddableElement({
          sceneX,
          sceneY,
          link: normalizeLink(text),
        });
        if (embeddable) {
          this.store.scheduleCapture();
          this.setState({ selectedElementIds: { [embeddable.id]: true } });
        }
      }
    }
  };

  loadFileToCanvas = async (
    file: File,
    fileHandle: FileSystemHandle | null,
  ) => {
    file = await normalizeFile(file);
    try {
      const elements = this.scene.getElementsIncludingDeleted();
      let ret;
      try {
        ret = await loadSceneOrLibraryFromBlob(
          file,
          this.state,
          elements,
          fileHandle,
        );
      } catch (error: any) {
        const imageSceneDataError = error instanceof ImageSceneDataError;
        if (
          imageSceneDataError &&
          error.code === "IMAGE_NOT_CONTAINS_SCENE_DATA" &&
          !this.isToolSupported("image")
        ) {
          this.setState({
            isLoading: false,
            errorMessage: t("errors.imageToolNotSupported"),
          });
          return;
        }
        const errorMessage = imageSceneDataError
          ? t("alerts.cannotRestoreFromImage")
          : t("alerts.couldNotLoadInvalidFile");
        this.setState({
          isLoading: false,
          errorMessage,
        });
      }
      if (!ret) {
        return;
      }

      if (ret.type === MIME_TYPES.excalidraw) {
        // restore the fractional indices by mutating elements
        syncInvalidIndices(elements.concat(ret.data.elements));

        // don't capture and only update the store snapshot for old elements,
        // otherwise we would end up with duplicated fractional indices on undo
        this.store.scheduleMicroAction({
          action: CaptureUpdateAction.NEVER,
          elements,
          appState: undefined,
        });

        this.setState({ isLoading: true });
        this.syncActionResult({
          ...ret.data,
          appState: {
            ...(ret.data.appState || this.state),
            isLoading: false,
          },
          replaceFiles: true,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      } else if (ret.type === MIME_TYPES.excalidrawlib) {
        await this.library
          .updateLibrary({
            libraryItems: file,
            merge: true,
            openLibraryMenu: true,
          })
          .catch((error) => {
            console.error(error);
            this.setState({ errorMessage: t("errors.importLibraryError") });
          });
      }
    } catch (error: any) {
      this.setState({ isLoading: false, errorMessage: error.message });
    }
  };

  private handleCanvasContextMenu = (
    event: React.MouseEvent<HTMLElement | HTMLCanvasElement>,
  ) => {
    event.preventDefault();

    if (
      (("pointerType" in event.nativeEvent &&
        event.nativeEvent.pointerType === "touch") ||
        ("pointerType" in event.nativeEvent &&
          event.nativeEvent.pointerType === "pen" &&
          // always allow if user uses a pen secondary button
          event.button !== POINTER_BUTTON.SECONDARY)) &&
      this.state.activeTool.type !== this.defaultSelectionTool
    ) {
      return;
    }

    const { x, y } = viewportCoordsToSceneCoords(event, this.state);
    const element = this.getElementAtPosition(x, y, {
      preferSelected: true,
      includeLockedElements: true,
    });

    const selectedElements = this.scene.getSelectedElements(this.state);
    const isHittingCommonBoundBox =
      this.isHittingCommonBoundingBoxOfSelectedElements(
        { x, y },
        selectedElements,
      );

    const type = element || isHittingCommonBoundBox ? "element" : "canvas";

    const container = this.excalidrawContainerRef.current!;
    const { top: offsetTop, left: offsetLeft } =
      container.getBoundingClientRect();
    const left = event.clientX - offsetLeft;
    const top = event.clientY - offsetTop;

    trackEvent("contextMenu", "openContextMenu", type);

    this.setState(
      {
        ...(element && !this.state.selectedElementIds[element.id]
          ? {
              ...this.state,
              ...selectGroupsForSelectedElements(
                {
                  editingGroupId: this.state.editingGroupId,
                  selectedElementIds: { [element.id]: true },
                },
                this.scene.getNonDeletedElements(),
                this.state,
                this,
              ),
              selectedLinearElement: isLinearElement(element)
                ? new LinearElementEditor(
                    element,
                    this.scene.getNonDeletedElementsMap(),
                  )
                : null,
            }
          : this.state),
        showHyperlinkPopup: false,
      },
      () => {
        this.setState({
          contextMenu: { top, left, items: this.getContextMenuItems(type) },
        });
      },
    );
  };

  private maybeDragNewGenericElement = (
    pointerDownState: PointerDownState,
    event: MouseEvent | KeyboardEvent,
    informMutation = true,
  ): void => {
    const selectionElement = this.state.selectionElement;
    const pointerCoords = pointerDownState.lastCoords;
    if (selectionElement && this.state.activeTool.type !== "eraser") {
      dragNewElement({
        newElement: selectionElement,
        elementType: this.state.activeTool.type,
        originX: pointerDownState.origin.x,
        originY: pointerDownState.origin.y,
        x: pointerCoords.x,
        y: pointerCoords.y,
        width: distance(pointerDownState.origin.x, pointerCoords.x),
        height: distance(pointerDownState.origin.y, pointerCoords.y),
        shouldMaintainAspectRatio: shouldMaintainAspectRatio(event),
        shouldResizeFromCenter: false,
        scene: this.scene,
        zoom: this.state.zoom.value,
        informMutation: false,
      });
      return;
    }

    const newElement = this.state.newElement;
    if (!newElement) {
      return;
    }

    let [gridX, gridY] = getGridPoint(
      pointerCoords.x,
      pointerCoords.y,
      event[KEYS.CTRL_OR_CMD] ? null : this.getEffectiveGridSize(),
    );

    const image =
      isInitializedImageElement(newElement) &&
      this.imageCache.get(newElement.fileId)?.image;
    const aspectRatio =
      image && !(image instanceof Promise) ? image.width / image.height : null;

    this.maybeCacheReferenceSnapPoints(event, [newElement]);

    const { snapOffset, snapLines } = snapNewElement(
      newElement,
      this,
      event,
      {
        x:
          pointerDownState.originInGrid.x +
          (this.state.originSnapOffset?.x ?? 0),
        y:
          pointerDownState.originInGrid.y +
          (this.state.originSnapOffset?.y ?? 0),
      },
      {
        x: gridX - pointerDownState.originInGrid.x,
        y: gridY - pointerDownState.originInGrid.y,
      },
      this.scene.getNonDeletedElementsMap(),
    );

    gridX += snapOffset.x;
    gridY += snapOffset.y;

    this.setState({
      snapLines,
    });

    dragNewElement({
      newElement,
      elementType: this.state.activeTool.type,
      originX: pointerDownState.originInGrid.x,
      originY: pointerDownState.originInGrid.y,
      x: gridX,
      y: gridY,
      width: distance(pointerDownState.originInGrid.x, gridX),
      height: distance(pointerDownState.originInGrid.y, gridY),
      shouldMaintainAspectRatio: isImageElement(newElement)
        ? !shouldMaintainAspectRatio(event)
        : shouldMaintainAspectRatio(event),
      shouldResizeFromCenter: shouldResizeFromCenter(event),
      zoom: this.state.zoom.value,
      scene: this.scene,
      widthAspectRatio: aspectRatio,
      originOffset: this.state.originSnapOffset,
      informMutation,
    });

    this.setState({
      newElement,
    });

    // highlight elements that are to be added to frames on frames creation
    if (
      this.state.activeTool.type === TOOL_TYPE.frame ||
      this.state.activeTool.type === TOOL_TYPE.magicframe
    ) {
      this.setState({
        elementsToHighlight: getElementsInResizingFrame(
          this.scene.getNonDeletedElements(),
          newElement as ExcalidrawFrameLikeElement,
          this.state,
          this.scene.getNonDeletedElementsMap(),
        ),
      });
    }
  };

  private maybeHandleCrop = (
    pointerDownState: PointerDownState,
    event: MouseEvent | KeyboardEvent,
  ): boolean => {
    // to crop, we must already be in the cropping mode, where croppingElement has been set
    if (!this.state.croppingElementId) {
      return false;
    }

    const transformHandleType = pointerDownState.resize.handleType;
    const pointerCoords = pointerDownState.lastCoords;
    const [x, y] = getGridPoint(
      pointerCoords.x - pointerDownState.resize.offset.x,
      pointerCoords.y - pointerDownState.resize.offset.y,
      event[KEYS.CTRL_OR_CMD] ? null : this.getEffectiveGridSize(),
    );

    const croppingElement = this.scene
      .getNonDeletedElementsMap()
      .get(this.state.croppingElementId);

    if (
      transformHandleType &&
      croppingElement &&
      isImageElement(croppingElement)
    ) {
      const croppingAtStateStart = pointerDownState.originalElements.get(
        croppingElement.id,
      );

      const image =
        isInitializedImageElement(croppingElement) &&
        this.imageCache.get(croppingElement.fileId)?.image;

      if (
        croppingAtStateStart &&
        isImageElement(croppingAtStateStart) &&
        image &&
        !(image instanceof Promise)
      ) {
        const [gridX, gridY] = getGridPoint(
          pointerCoords.x,
          pointerCoords.y,
          event[KEYS.CTRL_OR_CMD] ? null : this.getEffectiveGridSize(),
        );

        const dragOffset = {
          x: gridX - pointerDownState.originInGrid.x,
          y: gridY - pointerDownState.originInGrid.y,
        };

        this.maybeCacheReferenceSnapPoints(event, [croppingElement]);

        const { snapOffset, snapLines } = snapResizingElements(
          [croppingElement],
          [croppingAtStateStart],
          this,
          event,
          dragOffset,
          transformHandleType,
        );

        this.scene.mutateElement(
          croppingElement,
          cropElement(
            croppingElement,
            this.scene.getNonDeletedElementsMap(),
            transformHandleType,
            image.naturalWidth,
            image.naturalHeight,
            x + snapOffset.x,
            y + snapOffset.y,
            event.shiftKey
              ? croppingAtStateStart.width / croppingAtStateStart.height
              : undefined,
          ),
        );

        updateBoundElements(croppingElement, this.scene, {
          newSize: {
            width: croppingElement.width,
            height: croppingElement.height,
          },
        });

        this.setState({
          isCropping: transformHandleType && transformHandleType !== "rotation",
          snapLines,
        });
      }

      return true;
    }

    return false;
  };

  private maybeHandleResize = (
    pointerDownState: PointerDownState,
    event: MouseEvent | KeyboardEvent,
  ): boolean => {
    const selectedElements = this.scene.getSelectedElements(this.state);
    const selectedFrames = selectedElements.filter(
      (element): element is ExcalidrawFrameLikeElement =>
        isFrameLikeElement(element),
    );

    const transformHandleType = pointerDownState.resize.handleType;

    if (
      // Frames cannot be rotated.
      (selectedFrames.length > 0 && transformHandleType === "rotation") ||
      // Elbow arrows cannot be transformed (resized or rotated).
      (selectedElements.length === 1 && isElbowArrow(selectedElements[0])) ||
      // Do not resize when in crop mode
      this.state.croppingElementId
    ) {
      return false;
    }

    this.setState({
      // TODO: rename this state field to "isScaling" to distinguish
      // it from the generic "isResizing" which includes scaling and
      // rotating
      isResizing: transformHandleType && transformHandleType !== "rotation",
      isRotating: transformHandleType === "rotation",
      activeEmbeddable: null,
    });
    const pointerCoords = pointerDownState.lastCoords;
    let [resizeX, resizeY] = getGridPoint(
      pointerCoords.x - pointerDownState.resize.offset.x,
      pointerCoords.y - pointerDownState.resize.offset.y,
      event[KEYS.CTRL_OR_CMD] ? null : this.getEffectiveGridSize(),
    );

    const frameElementsOffsetsMap = new Map<
      string,
      {
        x: number;
        y: number;
      }
    >();

    selectedFrames.forEach((frame) => {
      const elementsInFrame = getFrameChildren(
        this.scene.getNonDeletedElements(),
        frame.id,
      );

      elementsInFrame.forEach((element) => {
        frameElementsOffsetsMap.set(frame.id + element.id, {
          x: element.x - frame.x,
          y: element.y - frame.y,
        });
      });
    });

    // check needed for avoiding flickering when a key gets pressed
    // during dragging
    if (!this.state.selectedElementsAreBeingDragged) {
      const [gridX, gridY] = getGridPoint(
        pointerCoords.x,
        pointerCoords.y,
        event[KEYS.CTRL_OR_CMD] ? null : this.getEffectiveGridSize(),
      );

      const dragOffset = {
        x: gridX - pointerDownState.originInGrid.x,
        y: gridY - pointerDownState.originInGrid.y,
      };

      const originalElements = [...pointerDownState.originalElements.values()];

      this.maybeCacheReferenceSnapPoints(event, selectedElements);

      const { snapOffset, snapLines } = snapResizingElements(
        selectedElements,
        getSelectedElements(originalElements, this.state),
        this,
        event,
        dragOffset,
        transformHandleType,
      );

      resizeX += snapOffset.x;
      resizeY += snapOffset.y;

      this.setState({
        snapLines,
      });
    }

    if (
      transformElements(
        pointerDownState.originalElements,
        transformHandleType,
        selectedElements,
        this.scene,
        shouldRotateWithDiscreteAngle(event),
        shouldResizeFromCenter(event),
        selectedElements.some((element) => isImageElement(element))
          ? !shouldMaintainAspectRatio(event)
          : shouldMaintainAspectRatio(event),
        resizeX,
        resizeY,
        pointerDownState.resize.center.x,
        pointerDownState.resize.center.y,
      )
    ) {
      const suggestedBindings = getSuggestedBindingsForArrows(
        selectedElements,
        this.scene.getNonDeletedElementsMap(),
        this.state.zoom,
      );

      const elementsToHighlight = new Set<ExcalidrawElement>();
      selectedFrames.forEach((frame) => {
        getElementsInResizingFrame(
          this.scene.getNonDeletedElements(),
          frame,
          this.state,
          this.scene.getNonDeletedElementsMap(),
        ).forEach((element) => elementsToHighlight.add(element));
      });

      this.setState({
        elementsToHighlight: [...elementsToHighlight],
        suggestedBindings,
      });

      return true;
    }
    return false;
  };

  private getContextMenuItems = (
    type: "canvas" | "element",
  ): ContextMenuItems => {
    const options: ContextMenuItems = [];

    options.push(actionCopyAsPng, actionCopyAsSvg);

    // canvas contextMenu
    // -------------------------------------------------------------------------

    if (type === "canvas") {
      if (this.state.viewModeEnabled) {
        return [
          ...options,
          actionToggleGridMode,
          actionToggleZenMode,
          actionToggleViewMode,
          actionToggleStats,
        ];
      }

      return [
        actionPaste,
        CONTEXT_MENU_SEPARATOR,
        actionCopyAsPng,
        actionCopyAsSvg,
        copyText,
        CONTEXT_MENU_SEPARATOR,
        actionSelectAll,
        actionUnlockAllElements,
        CONTEXT_MENU_SEPARATOR,
        actionToggleGridMode,
        actionToggleObjectsSnapMode,
        actionToggleZenMode,
        actionToggleViewMode,
        actionToggleStats,
      ];
    }

    // element contextMenu
    // -------------------------------------------------------------------------

    options.push(copyText);

    if (this.state.viewModeEnabled) {
      return [actionCopy, ...options];
    }

    return [
      CONTEXT_MENU_SEPARATOR,
      actionCut,
      actionCopy,
      actionPaste,
      CONTEXT_MENU_SEPARATOR,
      actionSelectAllElementsInFrame,
      actionRemoveAllElementsFromFrame,
      actionWrapSelectionInFrame,
      CONTEXT_MENU_SEPARATOR,
      actionToggleCropEditor,
      CONTEXT_MENU_SEPARATOR,
      ...options,
      CONTEXT_MENU_SEPARATOR,
      actionCopyStyles,
      actionPasteStyles,
      CONTEXT_MENU_SEPARATOR,
      actionGroup,
      actionTextAutoResize,
      actionUnbindText,
      actionBindText,
      actionWrapTextInContainer,
      actionUngroup,
      CONTEXT_MENU_SEPARATOR,
      actionAddToLibrary,
      CONTEXT_MENU_SEPARATOR,
      actionSendBackward,
      actionBringForward,
      actionSendToBack,
      actionBringToFront,
      CONTEXT_MENU_SEPARATOR,
      actionFlipHorizontal,
      actionFlipVertical,
      CONTEXT_MENU_SEPARATOR,
      actionToggleLinearEditor,
      CONTEXT_MENU_SEPARATOR,
      actionLink,
      actionCopyElementLink,
      CONTEXT_MENU_SEPARATOR,
      actionDuplicateSelection,
      actionToggleElementLock,
      CONTEXT_MENU_SEPARATOR,
      actionDeleteSelected,
    ];
  };

  private handleWheel = withBatchedUpdates(
    (
      event: WheelEvent | React.WheelEvent<HTMLDivElement | HTMLCanvasElement>,
    ) => {
      // if not scrolling on canvas/wysiwyg, ignore
      if (
        !(
          event.target instanceof HTMLCanvasElement ||
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLIFrameElement
        )
      ) {
        // prevent zooming the browser (but allow scrolling DOM)
        if (event[KEYS.CTRL_OR_CMD]) {
          event.preventDefault();
        }

        return;
      }

      event.preventDefault();

      if (isPanning) {
        return;
      }

      const { deltaX, deltaY } = event;
      // note that event.ctrlKey is necessary to handle pinch zooming
      if (event.metaKey || event.ctrlKey) {
        const sign = Math.sign(deltaY);
        const MAX_STEP = ZOOM_STEP * 100;
        const absDelta = Math.abs(deltaY);
        let delta = deltaY;
        if (absDelta > MAX_STEP) {
          delta = MAX_STEP * sign;
        }

        let newZoom = this.state.zoom.value - delta / 100;
        // increase zoom steps the more zoomed-in we are (applies to >100% only)
        newZoom +=
          Math.log10(Math.max(1, this.state.zoom.value)) *
          -sign *
          // reduced amplification for small deltas (small movements on a trackpad)
          Math.min(1, absDelta / 20);

        this.translateCanvas((state) => ({
          ...getStateForZoom(
            {
              viewportX: this.lastViewportPosition.x,
              viewportY: this.lastViewportPosition.y,
              nextZoom: getNormalizedZoom(newZoom),
            },
            state,
          ),
          shouldCacheIgnoreZoom: true,
        }));
        this.resetShouldCacheIgnoreZoomDebounced();
        return;
      }

      // scroll horizontally when shift pressed
      if (event.shiftKey) {
        this.translateCanvas(({ zoom, scrollX }) => ({
          // on Mac, shift+wheel tends to result in deltaX
          scrollX: scrollX - (deltaY || deltaX) / zoom.value,
        }));
        return;
      }

      this.translateCanvas(({ zoom, scrollX, scrollY }) => ({
        scrollX: scrollX - deltaX / zoom.value,
        scrollY: scrollY - deltaY / zoom.value,
      }));
    },
  );

  private getTextWysiwygSnappedToCenterPosition(
    x: number,
    y: number,
    appState: AppState,
    container?: ExcalidrawTextContainer | null,
  ) {
    if (container) {
      let elementCenterX = container.x + container.width / 2;
      let elementCenterY = container.y + container.height / 2;

      const elementCenter = getContainerCenter(
        container,
        appState,
        this.scene.getNonDeletedElementsMap(),
      );
      if (elementCenter) {
        elementCenterX = elementCenter.x;
        elementCenterY = elementCenter.y;
      }
      const distanceToCenter = Math.hypot(
        x - elementCenterX,
        y - elementCenterY,
      );
      const isSnappedToCenter =
        distanceToCenter < TEXT_TO_CENTER_SNAP_THRESHOLD;
      if (isSnappedToCenter) {
        const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
          { sceneX: elementCenterX, sceneY: elementCenterY },
          appState,
        );
        return { viewportX, viewportY, elementCenterX, elementCenterY };
      }
    }
  }

  private savePointer = (x: number, y: number, button: "up" | "down") => {
    if (!x || !y) {
      return;
    }
    const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
      { clientX: x, clientY: y },
      this.state,
    );

    if (isNaN(sceneX) || isNaN(sceneY)) {
      // sometimes the pointer goes off screen
    }

    const pointer: CollaboratorPointer = {
      x: sceneX,
      y: sceneY,
      tool: this.state.activeTool.type === "laser" ? "laser" : "pointer",
    };

    this.props.onPointerUpdate?.({
      pointer,
      button,
      pointersMap: gesture.pointers,
    });
  };

  private resetShouldCacheIgnoreZoomDebounced = debounce(() => {
    if (!this.unmounted) {
      this.setState({ shouldCacheIgnoreZoom: false });
    }
  }, 300);

  private updateDOMRect = (cb?: () => void) => {
    if (this.excalidrawContainerRef?.current) {
      const excalidrawContainer = this.excalidrawContainerRef.current;
      const {
        width,
        height,
        left: offsetLeft,
        top: offsetTop,
      } = excalidrawContainer.getBoundingClientRect();
      const {
        width: currentWidth,
        height: currentHeight,
        offsetTop: currentOffsetTop,
        offsetLeft: currentOffsetLeft,
      } = this.state;

      if (
        width === currentWidth &&
        height === currentHeight &&
        offsetLeft === currentOffsetLeft &&
        offsetTop === currentOffsetTop
      ) {
        if (cb) {
          cb();
        }
        return;
      }

      this.setState(
        {
          width,
          height,
          offsetLeft,
          offsetTop,
        },
        () => {
          cb && cb();
        },
      );
    }
  };

  public refresh = () => {
    this.setState({ ...this.getCanvasOffsets() });
  };

  private getCanvasOffsets(): Pick<AppState, "offsetTop" | "offsetLeft"> {
    if (this.excalidrawContainerRef?.current) {
      const excalidrawContainer = this.excalidrawContainerRef.current;
      const { left, top } = excalidrawContainer.getBoundingClientRect();
      return {
        offsetLeft: left,
        offsetTop: top,
      };
    }
    return {
      offsetLeft: 0,
      offsetTop: 0,
    };
  }

  private async updateLanguage() {
    const currentLang =
      languages.find((lang) => lang.code === this.props.langCode) ||
      defaultLang;
    await setLanguage(currentLang);
    this.setAppState({});
  }
}

// -----------------------------------------------------------------------------
// TEST HOOKS
// -----------------------------------------------------------------------------
declare global {
  interface Window {
    h: {
      scene: Scene;
      elements: readonly ExcalidrawElement[];
      state: AppState;
      setState: React.Component<any, AppState>["setState"];
      app: InstanceType<typeof App>;
      history: History;
      store: Store;
    };
  }
}

export const createTestHook = () => {
  if (isTestEnv() || isDevEnv()) {
    window.h = window.h || ({} as Window["h"]);

    Object.defineProperties(window.h, {
      elements: {
        configurable: true,
        get() {
          return this.app?.scene.getElementsIncludingDeleted();
        },
        set(elements: ExcalidrawElement[]) {
          return this.app?.scene.replaceAllElements(
            syncInvalidIndices(elements),
          );
        },
      },
      scene: {
        configurable: true,
        get() {
          return this.app?.scene;
        },
      },
    });
  }
};

createTestHook();
export default App;
