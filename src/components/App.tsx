import React, { useContext } from "react";
import { RoughCanvas } from "roughjs/bin/canvas";
import rough from "roughjs/bin/rough";
import clsx from "clsx";
import { nanoid } from "nanoid";

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
  actionToggleLock,
} from "../actions";
import { createRedoAction, createUndoAction } from "../actions/actionHistory";
import { ActionManager } from "../actions/manager";
import { actions } from "../actions/register";
import { ActionResult } from "../actions/types";
import { trackEvent } from "../analytics";
import { getDefaultAppState, isEraserActive } from "../appState";
import {
  parseClipboard,
  probablySupportsClipboardBlob,
  probablySupportsClipboardWriteText,
} from "../clipboard";
import {
  APP_NAME,
  CURSOR_TYPE,
  DEFAULT_MAX_IMAGE_WIDTH_OR_HEIGHT,
  DEFAULT_UI_OPTIONS,
  DEFAULT_VERTICAL_ALIGN,
  DRAGGING_THRESHOLD,
  ELEMENT_READY_TO_ERASE_OPACITY,
  ELEMENT_SHIFT_TRANSLATE_AMOUNT,
  ELEMENT_TRANSLATE_AMOUNT,
  ENV,
  EVENT,
  GRID_SIZE,
  IMAGE_RENDER_TIMEOUT,
  LINE_CONFIRM_THRESHOLD,
  MAX_ALLOWED_FILE_BYTES,
  MIME_TYPES,
  MQ_MAX_HEIGHT_LANDSCAPE,
  MQ_MAX_WIDTH_LANDSCAPE,
  MQ_MAX_WIDTH_PORTRAIT,
  MQ_RIGHT_SIDEBAR_MIN_WIDTH,
  MQ_SM_MAX_WIDTH,
  POINTER_BUTTON,
  SCROLL_TIMEOUT,
  TAP_TWICE_TIMEOUT,
  TEXT_TO_CENTER_SNAP_THRESHOLD,
  THEME,
  TOUCH_CTX_MENU_TIMEOUT,
  VERTICAL_ALIGN,
} from "../constants";
import { loadFromBlob } from "../data";
import Library, { distributeLibraryItemsOnSquareGrid } from "../data/library";
import { restore, restoreElements } from "../data/restore";
import {
  dragNewElement,
  dragSelectedElements,
  duplicateElement,
  getCommonBounds,
  getCursorForResizingElement,
  getDragOffsetXY,
  getElementWithTransformHandleType,
  getNormalizedDimensions,
  getPerfectElementSize,
  getResizeArrowDirection,
  getResizeOffsetXY,
  getTransformHandleTypeFromCoords,
  hitTest,
  isHittingElementBoundingBoxWithoutHittingElement,
  isInvisiblySmallElement,
  isNonDeletedElement,
  isTextElement,
  newElement,
  newLinearElement,
  newTextElement,
  newImageElement,
  textWysiwyg,
  transformElements,
  updateTextElement,
} from "../element";
import {
  bindOrUnbindSelectedElements,
  fixBindingsAfterDeletion,
  fixBindingsAfterDuplication,
  getEligibleElementsForBinding,
  getHoveredElementForBinding,
  isBindingEnabled,
  isLinearElementSimpleAndAlreadyBound,
  maybeBindLinearElement,
  shouldEnableBindingForPointerEvent,
  unbindLinearElements,
  updateBoundElements,
} from "../element/binding";
import { LinearElementEditor } from "../element/linearElementEditor";
import { mutateElement, newElementWith } from "../element/mutateElement";
import { deepCopyElement, newFreeDrawElement } from "../element/newElement";
import {
  hasBoundTextElement,
  isBindingElement,
  isBindingElementType,
  isBoundToContainer,
  isImageElement,
  isInitializedImageElement,
  isLinearElement,
  isLinearElementType,
  isTextBindableContainer,
} from "../element/typeChecks";
import {
  ExcalidrawBindableElement,
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
} from "../element/types";
import { getCenter, getDistance } from "../gesture";
import {
  editGroupForSelectedElement,
  getElementsInGroup,
  getSelectedGroupIdForElement,
  getSelectedGroupIds,
  isElementInGroup,
  isSelectedViaGroup,
  selectGroupsForSelectedElements,
} from "../groups";
import History from "../history";
import { defaultLang, getLanguage, languages, setLanguage, t } from "../i18n";
import {
  CODES,
  shouldResizeFromCenter,
  shouldMaintainAspectRatio,
  shouldRotateWithDiscreteAngle,
  isArrowKey,
  KEYS,
  isAndroid,
} from "../keys";
import { distance2d, getGridPoint, isPathALoop } from "../math";
import { renderScene } from "../renderer";
import { invalidateShapeForElement } from "../renderer/renderElement";
import {
  calculateScrollCenter,
  getTextBindableContainerAtPosition,
  getElementsAtPosition,
  getElementsWithinSelection,
  getNormalizedZoom,
  getSelectedElements,
  hasBackground,
  isOverScrollBars,
  isSomeElementSelected,
} from "../scene";
import Scene from "../scene/Scene";
import { RenderConfig, ScrollBars } from "../scene/types";
import { getStateForZoom } from "../scene/zoom";
import { findShapeByKey, SHAPES } from "../shapes";
import {
  AppClassProperties,
  AppProps,
  AppState,
  BinaryFileData,
  DataURL,
  ExcalidrawImperativeAPI,
  BinaryFiles,
  Gesture,
  GestureEvent,
  LibraryItems,
  PointerDownState,
  SceneData,
  Device,
} from "../types";
import {
  debounce,
  distance,
  getFontString,
  getNearestScrollableContainer,
  isInputLike,
  isToolIcon,
  isWritableElement,
  resetCursor,
  resolvablePromise,
  sceneCoordsToViewportCoords,
  setCursor,
  setCursorForShape,
  tupleToCoors,
  viewportCoordsToSceneCoords,
  withBatchedUpdates,
  wrapEvent,
  withBatchedUpdatesThrottled,
  updateObject,
  setEraserCursor,
  updateActiveTool,
} from "../utils";
import ContextMenu, { ContextMenuOption } from "./ContextMenu";
import LayerUI from "./LayerUI";
import { Toast } from "./Toast";
import { actionToggleViewMode } from "../actions/actionToggleViewMode";
import {
  dataURLToFile,
  generateIdFromFile,
  getDataURL,
  getFileFromEvent,
  isSupportedImageFile,
  loadSceneOrLibraryFromBlob,
  normalizeFile,
  parseLibraryJSON,
  resizeImageFile,
  SVGStringToFile,
} from "../data/blob";
import {
  getInitializedImageElements,
  loadHTMLImageElement,
  normalizeSVG,
  updateImageCache as _updateImageCache,
} from "../element/image";
import throttle from "lodash.throttle";
import { fileOpen, FileSystemHandle } from "../data/filesystem";
import {
  bindTextToShapeAfterDuplication,
  getApproxMinLineHeight,
  getApproxMinLineWidth,
  getBoundTextElement,
} from "../element/textElement";
import { isHittingElementNotConsideringBoundingBox } from "../element/collision";
import {
  normalizeLink,
  showHyperlinkTooltip,
  hideHyperlinkToolip,
  Hyperlink,
  isPointHittingLinkIcon,
  isLocalLink,
} from "../element/Hyperlink";

const deviceContextInitialValue = {
  isSmScreen: false,
  isMobile: false,
  isTouchScreen: false,
  canDeviceFitSidebar: false,
};
const DeviceContext = React.createContext<Device>(deviceContextInitialValue);
export const useDevice = () => useContext<Device>(DeviceContext);
const ExcalidrawContainerContext = React.createContext<{
  container: HTMLDivElement | null;
  id: string | null;
}>({ container: null, id: null });
export const useExcalidrawContainer = () =>
  useContext(ExcalidrawContainerContext);

let didTapTwice: boolean = false;
let tappedTwiceTimer = 0;
let cursorX = 0;
let cursorY = 0;
let isHoldingSpace: boolean = false;
let isPanning: boolean = false;
let isDraggingScrollBar: boolean = false;
let currentScrollBars: ScrollBars = { horizontal: null, vertical: null };
let touchTimeout = 0;
let invalidateContextMenu = false;

let lastPointerUp: ((event: any) => void) | null = null;
const gesture: Gesture = {
  pointers: new Map(),
  lastCenter: null,
  initialDistance: null,
  initialScale: null,
};

class App extends React.Component<AppProps, AppState> {
  canvas: AppClassProperties["canvas"] = null;
  rc: RoughCanvas | null = null;
  unmounted: boolean = false;
  actionManager: ActionManager;
  device: Device = deviceContextInitialValue;
  detachIsMobileMqHandler?: () => void;

  private excalidrawContainerRef = React.createRef<HTMLDivElement>();

  public static defaultProps: Partial<AppProps> = {
    // needed for tests to pass since we directly render App in many tests
    UIOptions: DEFAULT_UI_OPTIONS,
  };

  public scene: Scene;
  private resizeObserver: ResizeObserver | undefined;
  private nearestScrollableContainer: HTMLElement | Document | undefined;
  public library: AppClassProperties["library"];
  public libraryItemsFromStorage: LibraryItems | undefined;
  private id: string;
  private history: History;
  private excalidrawContainerValue: {
    container: HTMLDivElement | null;
    id: string;
  };

  public files: BinaryFiles = {};
  public imageCache: AppClassProperties["imageCache"] = new Map();

  hitLinkElement?: NonDeletedExcalidrawElement;
  lastPointerDown: React.PointerEvent<HTMLCanvasElement> | null = null;
  lastPointerUp: React.PointerEvent<HTMLElement> | PointerEvent | null = null;
  contextMenuOpen: boolean = false;
  lastScenePointer: { x: number; y: number } | null = null;

  constructor(props: AppProps) {
    super(props);
    const defaultAppState = getDefaultAppState();
    const {
      excalidrawRef,
      viewModeEnabled = false,
      zenModeEnabled = false,
      gridModeEnabled = false,
      theme = defaultAppState.theme,
      name = defaultAppState.name,
    } = props;
    this.state = {
      ...defaultAppState,
      theme,
      isLoading: true,
      ...this.getCanvasOffsets(),
      viewModeEnabled,
      zenModeEnabled,
      gridSize: gridModeEnabled ? GRID_SIZE : null,
      name,
      width: window.innerWidth,
      height: window.innerHeight,
      showHyperlinkPopup: false,
      isLibraryMenuDocked: false,
    };

    this.id = nanoid();

    this.library = new Library(this);
    if (excalidrawRef) {
      const readyPromise =
        ("current" in excalidrawRef && excalidrawRef.current?.readyPromise) ||
        resolvablePromise<ExcalidrawImperativeAPI>();

      const api: ExcalidrawImperativeAPI = {
        ready: true,
        readyPromise,
        updateScene: this.updateScene,
        updateLibrary: this.library.updateLibrary,
        addFiles: this.addFiles,
        resetScene: this.resetScene,
        getSceneElementsIncludingDeleted: this.getSceneElementsIncludingDeleted,
        history: {
          clear: this.resetHistory,
        },
        scrollToContent: this.scrollToContent,
        getSceneElements: this.getSceneElements,
        getAppState: () => this.state,
        getFiles: () => this.files,
        refresh: this.refresh,
        setToastMessage: this.setToastMessage,
        id: this.id,
        setActiveTool: this.setActiveTool,
        setCursor: this.setCursor,
        resetCursor: this.resetCursor,
      } as const;
      if (typeof excalidrawRef === "function") {
        excalidrawRef(api);
      } else {
        excalidrawRef.current = api;
      }
      readyPromise.resolve(api);
    }

    this.excalidrawContainerValue = {
      container: this.excalidrawContainerRef.current,
      id: this.id,
    };

    this.scene = new Scene();
    this.history = new History();
    this.actionManager = new ActionManager(
      this.syncActionResult,
      () => this.state,
      () => this.scene.getElementsIncludingDeleted(),
      this,
    );
    this.actionManager.registerAll(actions);

    this.actionManager.registerAction(createUndoAction(this.history));
    this.actionManager.registerAction(createRedoAction(this.history));
  }

  private renderCanvas() {
    const canvasScale = window.devicePixelRatio;
    const {
      width: canvasDOMWidth,
      height: canvasDOMHeight,
      viewModeEnabled,
    } = this.state;
    const canvasWidth = canvasDOMWidth * canvasScale;
    const canvasHeight = canvasDOMHeight * canvasScale;
    if (viewModeEnabled) {
      return (
        <canvas
          className="excalidraw__canvas"
          style={{
            width: canvasDOMWidth,
            height: canvasDOMHeight,
            cursor: CURSOR_TYPE.GRAB,
          }}
          width={canvasWidth}
          height={canvasHeight}
          ref={this.handleCanvasRef}
          onContextMenu={this.handleCanvasContextMenu}
          onPointerMove={this.handleCanvasPointerMove}
          onPointerUp={this.handleCanvasPointerUp}
          onPointerCancel={this.removePointer}
          onTouchMove={this.handleTouchMove}
          onPointerDown={this.handleCanvasPointerDown}
        >
          {t("labels.drawingCanvas")}
        </canvas>
      );
    }
    return (
      <canvas
        className="excalidraw__canvas"
        style={{
          width: canvasDOMWidth,
          height: canvasDOMHeight,
        }}
        width={canvasWidth}
        height={canvasHeight}
        ref={this.handleCanvasRef}
        onContextMenu={this.handleCanvasContextMenu}
        onPointerDown={this.handleCanvasPointerDown}
        onDoubleClick={this.handleCanvasDoubleClick}
        onPointerMove={this.handleCanvasPointerMove}
        onPointerUp={this.handleCanvasPointerUp}
        onPointerCancel={this.removePointer}
        onTouchMove={this.handleTouchMove}
      >
        {t("labels.drawingCanvas")}
      </canvas>
    );
  }

  public render() {
    const { zenModeEnabled, viewModeEnabled } = this.state;
    const selectedElement = getSelectedElements(
      this.scene.getNonDeletedElements(),
      this.state,
    );
    const {
      onCollabButtonClick,
      renderTopRightUI,
      renderFooter,
      renderCustomStats,
    } = this.props;

    return (
      <div
        className={clsx("excalidraw excalidraw-container", {
          "excalidraw--view-mode": viewModeEnabled,
          "excalidraw--mobile": this.device.isMobile,
        })}
        ref={this.excalidrawContainerRef}
        onDrop={this.handleAppOnDrop}
        tabIndex={0}
        onKeyDown={
          this.props.handleKeyboardGlobally ? undefined : this.onKeyDown
        }
      >
        <ExcalidrawContainerContext.Provider
          value={this.excalidrawContainerValue}
        >
          <DeviceContext.Provider value={this.device}>
            <LayerUI
              canvas={this.canvas}
              appState={this.state}
              files={this.files}
              setAppState={this.setAppState}
              actionManager={this.actionManager}
              elements={this.scene.getNonDeletedElements()}
              onCollabButtonClick={onCollabButtonClick}
              onLockToggle={this.toggleLock}
              onPenModeToggle={this.togglePenMode}
              onInsertElements={(elements) =>
                this.addElementsFromPasteOrLibrary({
                  elements,
                  position: "center",
                  files: null,
                })
              }
              zenModeEnabled={zenModeEnabled}
              toggleZenMode={this.toggleZenMode}
              langCode={getLanguage().code}
              isCollaborating={this.props.isCollaborating}
              renderTopRightUI={renderTopRightUI}
              renderCustomFooter={renderFooter}
              renderCustomStats={renderCustomStats}
              viewModeEnabled={viewModeEnabled}
              showExitZenModeBtn={
                typeof this.props?.zenModeEnabled === "undefined" &&
                zenModeEnabled
              }
              showThemeBtn={
                typeof this.props?.theme === "undefined" &&
                this.props.UIOptions.canvasActions.theme
              }
              libraryReturnUrl={this.props.libraryReturnUrl}
              UIOptions={this.props.UIOptions}
              focusContainer={this.focusContainer}
              library={this.library}
              id={this.id}
              onImageAction={this.onImageAction}
            />
            <div className="excalidraw-textEditorContainer" />
            <div className="excalidraw-contextMenuContainer" />
            {selectedElement.length === 1 && this.state.showHyperlinkPopup && (
              <Hyperlink
                key={selectedElement[0].id}
                element={selectedElement[0]}
                appState={this.state}
                setAppState={this.setAppState}
                onLinkOpen={this.props.onLinkOpen}
              />
            )}
            {this.state.toastMessage !== null && (
              <Toast
                message={this.state.toastMessage}
                clearToast={this.clearToast}
                duration={
                  this.state.toastMessage === t("alerts.browserZoom")
                    ? Infinity
                    : undefined
                }
                closable={this.state.toastMessage === t("alerts.browserZoom")}
              />
            )}
            <main>{this.renderCanvas()}</main>
          </DeviceContext.Provider>
        </ExcalidrawContainerContext.Provider>
      </div>
    );
  }

  public focusContainer: AppClassProperties["focusContainer"] = () => {
    if (this.props.autoFocus) {
      this.excalidrawContainerRef.current?.focus();
    }
  };

  public getSceneElementsIncludingDeleted = () => {
    return this.scene.getElementsIncludingDeleted();
  };

  public getSceneElements = () => {
    return this.scene.getNonDeletedElements();
  };

  private syncActionResult = withBatchedUpdates(
    (actionResult: ActionResult) => {
      // Since context menu closes when action triggered so setting to false
      this.contextMenuOpen = false;
      if (this.unmounted || actionResult === false) {
        return;
      }

      let editingElement: AppState["editingElement"] | null = null;
      if (actionResult.elements) {
        actionResult.elements.forEach((element) => {
          if (
            this.state.editingElement?.id === element.id &&
            this.state.editingElement !== element &&
            isNonDeletedElement(element)
          ) {
            editingElement = element;
          }
        });
        this.scene.replaceAllElements(actionResult.elements);
        if (actionResult.commitToHistory) {
          this.history.resumeRecording();
        }
      }

      if (actionResult.files) {
        this.files = actionResult.replaceFiles
          ? actionResult.files
          : { ...this.files, ...actionResult.files };
        this.addNewImagesToImageCache();
      }

      if (actionResult.appState || editingElement) {
        if (actionResult.commitToHistory) {
          this.history.resumeRecording();
        }

        let viewModeEnabled = actionResult?.appState?.viewModeEnabled || false;
        let zenModeEnabled = actionResult?.appState?.zenModeEnabled || false;
        let gridSize = actionResult?.appState?.gridSize || null;
        let theme = actionResult?.appState?.theme || THEME.LIGHT;
        let name = actionResult?.appState?.name ?? this.state.name;
        if (typeof this.props.viewModeEnabled !== "undefined") {
          viewModeEnabled = this.props.viewModeEnabled;
        }

        if (typeof this.props.zenModeEnabled !== "undefined") {
          zenModeEnabled = this.props.zenModeEnabled;
        }

        if (typeof this.props.gridModeEnabled !== "undefined") {
          gridSize = this.props.gridModeEnabled ? GRID_SIZE : null;
        }

        if (typeof this.props.theme !== "undefined") {
          theme = this.props.theme;
        }

        if (typeof this.props.name !== "undefined") {
          name = this.props.name;
        }
        this.setState(
          (state) => {
            // using Object.assign instead of spread to fool TS 4.2.2+ into
            // regarding the resulting type as not containing undefined
            // (which the following expression will never contain)
            return Object.assign(actionResult.appState || {}, {
              editingElement:
                editingElement || actionResult.appState?.editingElement || null,
              viewModeEnabled,
              zenModeEnabled,
              gridSize,
              theme,
              name,
            });
          },
          () => {
            if (actionResult.syncHistory) {
              this.history.setCurrentState(
                this.state,
                this.scene.getElementsIncludingDeleted(),
              );
            }
          },
        );
      }
    },
  );

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

  private onFontLoaded = () => {
    this.scene.getElementsIncludingDeleted().forEach((element) => {
      if (isTextElement(element)) {
        invalidateShapeForElement(element);
      }
    });
    this.onSceneUpdated();
  };

  private resetHistory = () => {
    this.history.clear();
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

    if (!this.state.isLoading) {
      this.setState({ isLoading: true });
    }
    let initialData = null;
    try {
      initialData = (await this.props.initialData) || null;
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
    const scene = restore(initialData, null, null);
    scene.appState = {
      ...scene.appState,
      // we're falling back to current (pre-init) state when deciding
      // whether to open the library, to handle a case where we
      // update the state outside of initialData (e.g. when loading the app
      // with a library install link, which should auto-open the library)
      isLibraryOpen:
        initialData?.appState?.isLibraryOpen || this.state.isLibraryOpen,
      activeTool:
        scene.appState.activeTool.type === "image"
          ? { ...scene.appState.activeTool, type: "selection" }
          : scene.appState.activeTool,
      isLoading: false,
      toastMessage: this.state.toastMessage || null,
    };
    if (initialData?.scrollToContent) {
      scene.appState = {
        ...scene.appState,
        ...calculateScrollCenter(
          scene.elements,
          {
            ...scene.appState,
            width: this.state.width,
            height: this.state.height,
            offsetTop: this.state.offsetTop,
            offsetLeft: this.state.offsetLeft,
          },
          null,
        ),
      };
    }

    this.resetHistory();
    this.syncActionResult({
      ...scene,
      commitToHistory: true,
    });
  };

  private refreshDeviceState = (container: HTMLDivElement) => {
    const { width, height } = container.getBoundingClientRect();
    const sidebarBreakpoint =
      this.props.UIOptions.dockedSidebarBreakpoint != null
        ? this.props.UIOptions.dockedSidebarBreakpoint
        : MQ_RIGHT_SIDEBAR_MIN_WIDTH;
    this.device = updateObject(this.device, {
      isSmScreen: width < MQ_SM_MAX_WIDTH,
      isMobile:
        width < MQ_MAX_WIDTH_PORTRAIT ||
        (height < MQ_MAX_HEIGHT_LANDSCAPE && width < MQ_MAX_WIDTH_LANDSCAPE),
      canDeviceFitSidebar: width > sidebarBreakpoint,
    });
  };

  public async componentDidMount() {
    this.unmounted = false;
    this.excalidrawContainerValue.container =
      this.excalidrawContainerRef.current;

    if (
      process.env.NODE_ENV === ENV.TEST ||
      process.env.NODE_ENV === ENV.DEVELOPMENT
    ) {
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
      });
    }

    this.scene.addCallback(this.onSceneUpdated);
    this.addEventListeners();

    if (this.excalidrawContainerRef.current) {
      this.focusContainer();
    }

    if (
      this.excalidrawContainerRef.current &&
      // bounding rects don't work in tests so updating
      // the state on init would result in making the test enviro run
      // in mobile breakpoint (0 width/height), making everything fail
      process.env.NODE_ENV !== "test"
    ) {
      this.refreshDeviceState(this.excalidrawContainerRef.current);
    }

    if ("ResizeObserver" in window && this.excalidrawContainerRef?.current) {
      this.resizeObserver = new ResizeObserver(() => {
        // recompute device dimensions state
        // ---------------------------------------------------------------------
        this.refreshDeviceState(this.excalidrawContainerRef.current!);
        // refresh offsets
        // ---------------------------------------------------------------------
        this.updateDOMRect();
      });
      this.resizeObserver?.observe(this.excalidrawContainerRef.current);
    } else if (window.matchMedia) {
      const mdScreenQuery = window.matchMedia(
        `(max-width: ${MQ_MAX_WIDTH_PORTRAIT}px), (max-height: ${MQ_MAX_HEIGHT_LANDSCAPE}px) and (max-width: ${MQ_MAX_WIDTH_LANDSCAPE}px)`,
      );
      const smScreenQuery = window.matchMedia(
        `(max-width: ${MQ_SM_MAX_WIDTH}px)`,
      );
      const canDeviceFitSidebarMediaQuery = window.matchMedia(
        `(min-width: ${
          // NOTE this won't update if a different breakpoint is supplied
          // after mount
          this.props.UIOptions.dockedSidebarBreakpoint != null
            ? this.props.UIOptions.dockedSidebarBreakpoint
            : MQ_RIGHT_SIDEBAR_MIN_WIDTH
        }px)`,
      );
      const handler = () => {
        this.excalidrawContainerRef.current!.getBoundingClientRect();
        this.device = updateObject(this.device, {
          isSmScreen: smScreenQuery.matches,
          isMobile: mdScreenQuery.matches,
          canDeviceFitSidebar: canDeviceFitSidebarMediaQuery.matches,
        });
      };
      mdScreenQuery.addListener(handler);
      this.detachIsMobileMqHandler = () =>
        mdScreenQuery.removeListener(handler);
    }

    const searchParams = new URLSearchParams(window.location.search.slice(1));

    if (searchParams.has("web-share-target")) {
      // Obtain a file that was shared via the Web Share Target API.
      this.restoreFileFromShare();
    } else {
      this.updateDOMRect(this.initializeScene);
    }
    this.checkIfBrowserZoomed();
  }

  public componentWillUnmount() {
    this.files = {};
    this.imageCache.clear();
    this.resizeObserver?.disconnect();
    this.unmounted = true;
    this.removeEventListeners();
    this.scene.destroy();
    clearTimeout(touchTimeout);
    touchTimeout = 0;
  }
  private checkIfBrowserZoomed = () => {
    if (!this.device.isMobile) {
      const scrollBarWidth = 10;
      const widthRatio =
        (window.outerWidth - scrollBarWidth) / window.innerWidth;
      const isBrowserZoomed = widthRatio < 0.75 || widthRatio > 1.1;
      if (isBrowserZoomed) {
        this.setToastMessage(t("alerts.browserZoom"));
      } else {
        this.clearToast();
      }
    }
  };
  private onResize = withBatchedUpdates(() => {
    this.checkIfBrowserZoomed();
    this.scene
      .getElementsIncludingDeleted()
      .forEach((element) => invalidateShapeForElement(element));
    this.setState({});
  });

  private removeEventListeners() {
    document.removeEventListener(EVENT.POINTER_UP, this.removePointer);
    document.removeEventListener(EVENT.COPY, this.onCopy);
    document.removeEventListener(EVENT.PASTE, this.pasteFromClipboard);
    document.removeEventListener(EVENT.CUT, this.onCut);
    this.nearestScrollableContainer?.removeEventListener(
      EVENT.SCROLL,
      this.onScroll,
    );
    document.removeEventListener(EVENT.KEYDOWN, this.onKeyDown, false);
    document.removeEventListener(
      EVENT.MOUSE_MOVE,
      this.updateCurrentCursorPosition,
      false,
    );
    document.removeEventListener(EVENT.KEYUP, this.onKeyUp);
    window.removeEventListener(EVENT.RESIZE, this.onResize, false);
    window.removeEventListener(EVENT.UNLOAD, this.onUnload, false);
    window.removeEventListener(EVENT.BLUR, this.onBlur, false);
    this.excalidrawContainerRef.current?.removeEventListener(
      EVENT.DRAG_OVER,
      this.disableEvent,
      false,
    );
    this.excalidrawContainerRef.current?.removeEventListener(
      EVENT.DROP,
      this.disableEvent,
      false,
    );

    document.removeEventListener(
      EVENT.GESTURE_START,
      this.onGestureStart as any,
      false,
    );
    document.removeEventListener(
      EVENT.GESTURE_CHANGE,
      this.onGestureChange as any,
      false,
    );
    document.removeEventListener(
      EVENT.GESTURE_END,
      this.onGestureEnd as any,
      false,
    );

    this.detachIsMobileMqHandler?.();
  }

  private addEventListeners() {
    this.removeEventListeners();
    document.addEventListener(EVENT.POINTER_UP, this.removePointer); // #3553
    document.addEventListener(EVENT.COPY, this.onCopy);
    if (this.props.handleKeyboardGlobally) {
      document.addEventListener(EVENT.KEYDOWN, this.onKeyDown, false);
    }
    document.addEventListener(EVENT.KEYUP, this.onKeyUp, { passive: true });
    document.addEventListener(
      EVENT.MOUSE_MOVE,
      this.updateCurrentCursorPosition,
    );
    // rerender text elements on font load to fix #637 && #1553
    document.fonts?.addEventListener?.("loadingdone", this.onFontLoaded);
    // Safari-only desktop pinch zoom
    document.addEventListener(
      EVENT.GESTURE_START,
      this.onGestureStart as any,
      false,
    );
    document.addEventListener(
      EVENT.GESTURE_CHANGE,
      this.onGestureChange as any,
      false,
    );
    document.addEventListener(
      EVENT.GESTURE_END,
      this.onGestureEnd as any,
      false,
    );
    if (this.state.viewModeEnabled) {
      return;
    }

    document.addEventListener(EVENT.PASTE, this.pasteFromClipboard);
    document.addEventListener(EVENT.CUT, this.onCut);
    if (this.props.detectScroll) {
      this.nearestScrollableContainer = getNearestScrollableContainer(
        this.excalidrawContainerRef.current!,
      );
      this.nearestScrollableContainer.addEventListener(
        EVENT.SCROLL,
        this.onScroll,
      );
    }
    window.addEventListener(EVENT.RESIZE, this.onResize, false);
    window.addEventListener(EVENT.UNLOAD, this.onUnload, false);
    window.addEventListener(EVENT.BLUR, this.onBlur, false);
    this.excalidrawContainerRef.current?.addEventListener(
      EVENT.DRAG_OVER,
      this.disableEvent,
      false,
    );
    this.excalidrawContainerRef.current?.addEventListener(
      EVENT.DROP,
      this.disableEvent,
      false,
    );
  }

  componentDidUpdate(prevProps: AppProps, prevState: AppState) {
    if (
      this.excalidrawContainerRef.current &&
      prevProps.UIOptions.dockedSidebarBreakpoint !==
        this.props.UIOptions.dockedSidebarBreakpoint
    ) {
      this.refreshDeviceState(this.excalidrawContainerRef.current);
    }

    if (
      prevState.scrollX !== this.state.scrollX ||
      prevState.scrollY !== this.state.scrollY
    ) {
      this.props?.onScrollChange?.(this.state.scrollX, this.state.scrollY);
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
      setEraserCursor(this.canvas, this.state.theme);
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

    if (prevProps.viewModeEnabled !== this.props.viewModeEnabled) {
      this.setState({ viewModeEnabled: !!this.props.viewModeEnabled });
    }

    if (prevState.viewModeEnabled !== this.state.viewModeEnabled) {
      this.addEventListeners();
      this.deselectElements();
    }

    if (prevProps.zenModeEnabled !== this.props.zenModeEnabled) {
      this.setState({ zenModeEnabled: !!this.props.zenModeEnabled });
    }

    if (prevProps.theme !== this.props.theme && this.props.theme) {
      this.setState({ theme: this.props.theme });
    }

    if (prevProps.gridModeEnabled !== this.props.gridModeEnabled) {
      this.setState({
        gridSize: this.props.gridModeEnabled ? GRID_SIZE : null,
      });
    }

    if (this.props.name && prevProps.name !== this.props.name) {
      this.setState({
        name: this.props.name,
      });
    }

    this.excalidrawContainerRef.current?.classList.toggle(
      "theme--dark",
      this.state.theme === "dark",
    );

    if (
      this.state.editingLinearElement &&
      !this.state.selectedElementIds[this.state.editingLinearElement.elementId]
    ) {
      // defer so that the commitToHistory flag isn't reset via current update
      setTimeout(() => {
        this.actionManager.executeAction(actionFinalize);
      });
    }
    const { multiElement } = prevState;
    if (
      prevState.activeTool !== this.state.activeTool &&
      multiElement != null &&
      isBindingEnabled(this.state) &&
      isBindingElement(multiElement, false)
    ) {
      maybeBindLinearElement(
        multiElement,
        this.state,
        this.scene,
        tupleToCoors(
          LinearElementEditor.getPointAtIndexGlobalCoordinates(
            multiElement,
            -1,
          ),
        ),
      );
    }

    const cursorButton: {
      [id: string]: string | undefined;
    } = {};
    const pointerViewportCoords: RenderConfig["remotePointerViewportCoords"] =
      {};
    const remoteSelectedElementIds: RenderConfig["remoteSelectedElementIds"] =
      {};
    const pointerUsernames: { [id: string]: string } = {};
    const pointerUserStates: { [id: string]: string } = {};
    this.state.collaborators.forEach((user, socketId) => {
      if (user.selectedElementIds) {
        for (const id of Object.keys(user.selectedElementIds)) {
          if (!(id in remoteSelectedElementIds)) {
            remoteSelectedElementIds[id] = [];
          }
          remoteSelectedElementIds[id].push(socketId);
        }
      }
      if (!user.pointer) {
        return;
      }
      if (user.username) {
        pointerUsernames[socketId] = user.username;
      }
      if (user.userState) {
        pointerUserStates[socketId] = user.userState;
      }
      pointerViewportCoords[socketId] = sceneCoordsToViewportCoords(
        {
          sceneX: user.pointer.x,
          sceneY: user.pointer.y,
        },
        this.state,
      );
      cursorButton[socketId] = user.button;
    });
    const renderingElements = this.scene
      .getNonDeletedElements()
      .filter((element) => {
        if (isImageElement(element)) {
          if (
            // not placed on canvas yet (but in elements array)
            this.state.pendingImageElementId === element.id
          ) {
            return false;
          }
        }
        // don't render text element that's being currently edited (it's
        // rendered on remote only)
        return (
          !this.state.editingElement ||
          this.state.editingElement.type !== "text" ||
          element.id !== this.state.editingElement.id
        );
      });
    const { atLeastOneVisibleElement, scrollBars } = renderScene(
      renderingElements,
      this.state,
      this.state.selectionElement,
      window.devicePixelRatio,
      this.rc!,
      this.canvas!,
      {
        scrollX: this.state.scrollX,
        scrollY: this.state.scrollY,
        viewBackgroundColor: this.state.viewBackgroundColor,
        zoom: this.state.zoom,
        remotePointerViewportCoords: pointerViewportCoords,
        remotePointerButton: cursorButton,
        remoteSelectedElementIds,
        remotePointerUsernames: pointerUsernames,
        remotePointerUserStates: pointerUserStates,
        shouldCacheIgnoreZoom: this.state.shouldCacheIgnoreZoom,
        theme: this.state.theme,
        imageCache: this.imageCache,
        isExporting: false,
        renderScrollbars: !this.device.isMobile,
      },
    );

    if (scrollBars) {
      currentScrollBars = scrollBars;
    }
    const scrolledOutside =
      // hide when editing text
      isTextElement(this.state.editingElement)
        ? false
        : !atLeastOneVisibleElement && renderingElements.length > 0;
    if (this.state.scrolledOutside !== scrolledOutside) {
      this.setState({ scrolledOutside });
    }

    this.history.record(this.state, this.scene.getElementsIncludingDeleted());

    this.scheduleImageRefresh();

    // Do not notify consumers if we're still loading the scene. Among other
    // potential issues, this fixes a case where the tab isn't focused during
    // init, which would trigger onChange with empty elements, which would then
    // override whatever is in localStorage currently.
    if (!this.state.isLoading) {
      this.props.onChange?.(
        this.scene.getElementsIncludingDeleted(),
        this.state,
        this.files,
      );
    }
  }

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
    this.cutAll();
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
    this.copyAll();
    event.preventDefault();
    event.stopPropagation();
  });

  private cutAll = () => {
    this.actionManager.executeAction(actionCut, "keyboard");
  };

  private copyAll = () => {
    this.actionManager.executeAction(actionCopy, "keyboard");
  };

  private static resetTapTwice() {
    didTapTwice = false;
  }

  private onTapStart = (event: TouchEvent) => {
    // fix for Apple Pencil Scribble
    // On Android, preventing the event would disable contextMenu on tap-hold
    if (!isAndroid) {
      event.preventDefault();
    }

    if (!didTapTwice) {
      didTapTwice = true;
      clearTimeout(tappedTwiceTimer);
      tappedTwiceTimer = window.setTimeout(
        App.resetTapTwice,
        TAP_TWICE_TIMEOUT,
      );
      return;
    }
    // insert text only if we tapped twice with a single finger
    // event.touches.length === 1 will also prevent inserting text when user's zooming
    if (didTapTwice && event.touches.length === 1) {
      const [touch] = event.touches;
      // @ts-ignore
      this.handleCanvasDoubleClick({
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
      didTapTwice = false;
      clearTimeout(tappedTwiceTimer);
    }
    if (isAndroid) {
      event.preventDefault();
    }

    if (event.touches.length === 2) {
      this.setState({
        selectedElementIds: {},
      });
    }
  };

  private onTapEnd = (event: TouchEvent) => {
    this.resetContextMenuTimer();
    if (event.touches.length > 0) {
      this.setState({
        previousSelectedElementIds: {},
        selectedElementIds: this.state.previousSelectedElementIds,
      });
    } else {
      gesture.pointers.clear();
    }
  };

  private pasteFromClipboard = withBatchedUpdates(
    async (event: ClipboardEvent | null) => {
      // #686
      const target = document.activeElement;
      const isExcalidrawActive =
        this.excalidrawContainerRef.current?.contains(target);
      if (!isExcalidrawActive) {
        return;
      }

      const elementUnderCursor = document.elementFromPoint(cursorX, cursorY);
      if (
        // if no ClipboardEvent supplied, assume we're pasting via contextMenu
        // thus these checks don't make sense
        event &&
        (!(elementUnderCursor instanceof HTMLCanvasElement) ||
          isWritableElement(target))
      ) {
        return;
      }

      // must be called in the same frame (thus before any awaits) as the paste
      // event else some browsers (FF...) will clear the clipboardData
      // (something something security)
      let file = event?.clipboardData?.files[0];

      const data = await parseClipboard(event);

      if (!file && data.text) {
        const string = data.text.trim();
        if (string.startsWith("<svg") && string.endsWith("</svg>")) {
          // ignore SVG validation/normalization which will be done during image
          // initialization
          file = SVGStringToFile(string);
        }
      }

      // prefer spreadsheet data over image file (MS Office/Libre Office)
      if (isSupportedImageFile(file) && !data.spreadsheet) {
        const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
          { clientX: cursorX, clientY: cursorY },
          this.state,
        );

        const imageElement = this.createImageElement({ sceneX, sceneY });
        this.insertImageElement(imageElement, file);
        this.initializeImageDimensions(imageElement);
        this.setState({ selectedElementIds: { [imageElement.id]: true } });

        return;
      }

      if (this.props.onPaste) {
        try {
          if ((await this.props.onPaste(data, event)) === false) {
            return;
          }
        } catch (error: any) {
          console.error(error);
        }
      }
      if (data.errorMessage) {
        this.setState({ errorMessage: data.errorMessage });
      } else if (data.spreadsheet) {
        this.setState({
          pasteDialog: {
            data: data.spreadsheet,
            shown: true,
          },
        });
      } else if (data.elements) {
        this.addElementsFromPasteOrLibrary({
          elements: data.elements,
          files: data.files || null,
          position: "cursor",
        });
      } else if (data.text) {
        this.addTextFromPaste(data.text);
      }
      this.setActiveTool({ type: "selection" });
      event?.preventDefault();
    },
  );

  private addElementsFromPasteOrLibrary = (opts: {
    elements: readonly ExcalidrawElement[];
    files: BinaryFiles | null;
    position: { clientX: number; clientY: number } | "cursor" | "center";
  }) => {
    const elements = restoreElements(opts.elements, null);
    const [minX, minY, maxX, maxY] = getCommonBounds(elements);

    const elementsCenterX = distance(minX, maxX) / 2;
    const elementsCenterY = distance(minY, maxY) / 2;

    const clientX =
      typeof opts.position === "object"
        ? opts.position.clientX
        : opts.position === "cursor"
        ? cursorX
        : this.state.width / 2 + this.state.offsetLeft;
    const clientY =
      typeof opts.position === "object"
        ? opts.position.clientY
        : opts.position === "cursor"
        ? cursorY
        : this.state.height / 2 + this.state.offsetTop;

    const { x, y } = viewportCoordsToSceneCoords(
      { clientX, clientY },
      this.state,
    );

    const dx = x - elementsCenterX;
    const dy = y - elementsCenterY;
    const groupIdMap = new Map();

    const [gridX, gridY] = getGridPoint(dx, dy, this.state.gridSize);

    const oldIdToDuplicatedId = new Map();
    const newElements = elements.map((element) => {
      const newElement = duplicateElement(
        this.state.editingGroupId,
        groupIdMap,
        element,
        {
          x: element.x + gridX - minX,
          y: element.y + gridY - minY,
        },
      );
      oldIdToDuplicatedId.set(element.id, newElement.id);
      return newElement;
    });
    bindTextToShapeAfterDuplication(newElements, elements, oldIdToDuplicatedId);
    const nextElements = [
      ...this.scene.getElementsIncludingDeleted(),
      ...newElements,
    ];
    fixBindingsAfterDuplication(nextElements, elements, oldIdToDuplicatedId);

    if (opts.files) {
      this.files = { ...this.files, ...opts.files };
    }

    this.scene.replaceAllElements(nextElements);
    this.history.resumeRecording();

    this.setState(
      selectGroupsForSelectedElements(
        {
          ...this.state,
          isLibraryOpen:
            this.state.isLibraryOpen && this.device.canDeviceFitSidebar
              ? this.state.isLibraryMenuDocked
              : false,
          selectedElementIds: newElements.reduce((map, element) => {
            if (!isBoundToContainer(element)) {
              map[element.id] = true;
            }
            return map;
          }, {} as any),
          selectedGroupIds: {},
        },
        this.scene.getNonDeletedElements(),
      ),
      () => {
        if (opts.files) {
          this.addNewImagesToImageCache();
        }
      },
    );
    this.setActiveTool({ type: "selection" });
  };

  private addTextFromPaste(text: any) {
    const { x, y } = viewportCoordsToSceneCoords(
      { clientX: cursorX, clientY: cursorY },
      this.state,
    );

    const element = newTextElement({
      x,
      y,
      strokeColor: this.state.currentItemStrokeColor,
      backgroundColor: this.state.currentItemBackgroundColor,
      fillStyle: this.state.currentItemFillStyle,
      strokeWidth: this.state.currentItemStrokeWidth,
      strokeStyle: this.state.currentItemStrokeStyle,
      roughness: this.state.currentItemRoughness,
      opacity: this.state.currentItemOpacity,
      strokeSharpness: this.state.currentItemStrokeSharpness,
      text,
      fontSize: this.state.currentItemFontSize,
      fontFamily: this.state.currentItemFontFamily,
      textAlign: this.state.currentItemTextAlign,
      verticalAlign: DEFAULT_VERTICAL_ALIGN,
      locked: false,
    });

    this.scene.replaceAllElements([
      ...this.scene.getElementsIncludingDeleted(),
      element,
    ]);
    this.setState({ selectedElementIds: { [element.id]: true } });
    this.history.resumeRecording();
  }

  // Collaboration

  setAppState = (obj: any) => {
    this.setState(obj);
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
        `${source} (${this.device.isMobile ? "mobile" : "desktop"})`,
      );
    }
    this.setState((prevState) => {
      return {
        activeTool: {
          ...prevState.activeTool,
          ...updateActiveTool(
            this.state,
            prevState.activeTool.locked
              ? { type: "selection" }
              : prevState.activeTool,
          ),
          locked: !prevState.activeTool.locked,
        },
      };
    });
  };

  togglePenMode = () => {
    this.setState((prevState) => {
      return {
        penMode: !prevState.penMode,
      };
    });
  };

  toggleZenMode = () => {
    this.actionManager.executeAction(actionToggleZenMode);
  };

  scrollToContent = (
    target:
      | ExcalidrawElement
      | readonly ExcalidrawElement[] = this.scene.getNonDeletedElements(),
  ) => {
    this.setState({
      ...calculateScrollCenter(
        Array.isArray(target) ? target : [target],
        this.state,
        this.canvas,
      ),
    });
  };

  clearToast = () => {
    this.setState({ toastMessage: null });
  };

  setToastMessage = (toastMessage: string) => {
    this.setState({ toastMessage });
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

  /** adds supplied files to existing files in the appState */
  public addFiles: ExcalidrawImperativeAPI["addFiles"] = withBatchedUpdates(
    (files) => {
      const filesMap = files.reduce((acc, fileData) => {
        acc.set(fileData.id, fileData);
        return acc;
      }, new Map<FileId, BinaryFileData>());

      this.files = { ...this.files, ...Object.fromEntries(filesMap) };

      this.scene.getNonDeletedElements().forEach((element) => {
        if (
          isInitializedImageElement(element) &&
          filesMap.has(element.fileId)
        ) {
          this.imageCache.delete(element.fileId);
          invalidateShapeForElement(element);
        }
      });
      this.scene.informMutation();

      this.addNewImagesToImageCache();
    },
  );

  public updateScene = withBatchedUpdates(
    <K extends keyof AppState>(sceneData: {
      elements?: SceneData["elements"];
      appState?: Pick<AppState, K> | null;
      collaborators?: SceneData["collaborators"];
      commitToHistory?: SceneData["commitToHistory"];
    }) => {
      if (sceneData.commitToHistory) {
        this.history.resumeRecording();
      }

      if (sceneData.appState) {
        this.setState(sceneData.appState);
      }

      if (sceneData.elements) {
        this.scene.replaceAllElements(sceneData.elements);
      }

      if (sceneData.collaborators) {
        this.setState({ collaborators: sceneData.collaborators });
      }
    },
  );

  private onSceneUpdated = () => {
    this.setState({});
  };

  private updateCurrentCursorPosition = withBatchedUpdates(
    (event: MouseEvent) => {
      cursorX = event.clientX;
      cursorY = event.clientY;
    },
  );

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
          showHelpDialog: true,
        });
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

      if (event.code === CODES.ZERO) {
        const nextState = !this.state.isLibraryOpen;
        this.setState({ isLibraryOpen: nextState });
        // track only openings
        if (nextState) {
          trackEvent(
            "library",
            "toggleLibrary (open)",
            `keyboard (${this.device.isMobile ? "mobile" : "desktop"})`,
          );
        }
      }

      if (isArrowKey(event.key)) {
        const step =
          (this.state.gridSize &&
            (event.shiftKey
              ? ELEMENT_TRANSLATE_AMOUNT
              : this.state.gridSize)) ||
          (event.shiftKey
            ? ELEMENT_SHIFT_TRANSLATE_AMOUNT
            : ELEMENT_TRANSLATE_AMOUNT);

        const selectedElements = getSelectedElements(
          this.scene.getNonDeletedElements(),
          this.state,
          true,
        );

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
          mutateElement(element, {
            x: element.x + offsetX,
            y: element.y + offsetY,
          });

          updateBoundElements(element, {
            simultaneouslyUpdated: selectedElements,
          });
        });

        this.maybeSuggestBindingForAll(selectedElements);

        event.preventDefault();
      } else if (event.key === KEYS.ENTER) {
        const selectedElements = getSelectedElements(
          this.scene.getNonDeletedElements(),
          this.state,
        );

        if (
          selectedElements.length === 1 &&
          isLinearElement(selectedElements[0])
        ) {
          if (
            !this.state.editingLinearElement ||
            this.state.editingLinearElement.elementId !== selectedElements[0].id
          ) {
            this.history.resumeRecording();
            this.setState({
              editingLinearElement: new LinearElementEditor(
                selectedElements[0],
                this.scene,
              ),
            });
          }
        } else if (
          selectedElements.length === 1 &&
          !isLinearElement(selectedElements[0])
        ) {
          const selectedElement = selectedElements[0];

          this.startTextEditing({
            sceneX: selectedElement.x + selectedElement.width / 2,
            sceneY: selectedElement.y + selectedElement.height / 2,
            shouldBind: true,
          });
          event.preventDefault();
          return;
        }
      } else if (
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        this.state.draggingElement === null
      ) {
        const shape = findShapeByKey(event.key);
        if (shape) {
          if (this.state.activeTool.type !== shape) {
            trackEvent(
              "toolbar",
              shape,
              `keyboard (${this.device.isMobile ? "mobile" : "desktop"})`,
            );
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
        setCursor(this.canvas, CURSOR_TYPE.GRABBING);
        event.preventDefault();
      }

      if (
        (event.key === KEYS.G || event.key === KEYS.S) &&
        !event.altKey &&
        !event[KEYS.CTRL_OR_CMD]
      ) {
        const selectedElements = getSelectedElements(
          this.scene.getNonDeletedElements(),
          this.state,
        );
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
          this.setState({ openPopup: "backgroundColorPicker" });
          event.stopPropagation();
        }
        if (event.key === KEYS.S) {
          this.setState({ openPopup: "strokeColorPicker" });
          event.stopPropagation();
        }
      }
    },
  );

  private onKeyUp = withBatchedUpdates((event: KeyboardEvent) => {
    if (event.key === KEYS.SPACE) {
      if (this.state.viewModeEnabled) {
        setCursor(this.canvas, CURSOR_TYPE.GRAB);
      } else if (this.state.activeTool.type === "selection") {
        resetCursor(this.canvas);
      } else {
        setCursorForShape(this.canvas, this.state);
        this.setState({
          selectedElementIds: {},
          selectedGroupIds: {},
          editingGroupId: null,
        });
      }
      isHoldingSpace = false;
    }
    if (!event[KEYS.CTRL_OR_CMD] && !this.state.isBindingEnabled) {
      this.setState({ isBindingEnabled: true });
    }
    if (isArrowKey(event.key)) {
      const selectedElements = getSelectedElements(
        this.scene.getNonDeletedElements(),
        this.state,
      );
      isBindingEnabled(this.state)
        ? bindOrUnbindSelectedElements(selectedElements)
        : unbindLinearElements(selectedElements);
      this.setState({ suggestedBindings: [] });
    }
  });

  private setActiveTool = (
    tool:
      | { type: typeof SHAPES[number]["value"] | "eraser" }
      | { type: "custom"; customType: string },
  ) => {
    const nextActiveTool = updateActiveTool(this.state, tool);
    if (!isHoldingSpace) {
      setCursorForShape(this.canvas, this.state);
    }
    if (isToolIcon(document.activeElement)) {
      this.focusContainer();
    }
    if (!isLinearElementType(nextActiveTool.type)) {
      this.setState({ suggestedBindings: [] });
    }
    if (nextActiveTool.type === "image") {
      this.onImageAction();
    }
    if (nextActiveTool.type !== "selection") {
      this.setState({
        activeTool: nextActiveTool,
        selectedElementIds: {},
        selectedGroupIds: {},
        editingGroupId: null,
      });
    } else {
      this.setState({ activeTool: nextActiveTool });
    }
  };

  private setCursor = (cursor: string) => {
    setCursor(this.canvas, cursor);
  };

  private resetCursor = () => {
    resetCursor(this.canvas);
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

  // fires only on Safari
  private onGestureStart = withBatchedUpdates((event: GestureEvent) => {
    event.preventDefault();

    // we only want to deselect on touch screens because user may have selected
    // elements by mistake while zooming
    if (this.isTouchScreenMultiTouchGesture()) {
      this.setState({
        selectedElementIds: {},
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
            viewportX: cursorX,
            viewportY: cursorY,
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
        selectedElementIds: this.state.previousSelectedElementIds,
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
    const updateElement = (
      text: string,
      originalText: string,
      isDeleted: boolean,
    ) => {
      this.scene.replaceAllElements([
        ...this.scene.getElementsIncludingDeleted().map((_element) => {
          if (_element.id === element.id && isTextElement(_element)) {
            return updateTextElement(_element, {
              text,
              isDeleted,
              originalText,
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
      onChange: withBatchedUpdates((text) => {
        updateElement(text, text, false);
        if (isNonDeletedElement(element)) {
          updateBoundElements(element);
        }
      }),
      onSubmit: withBatchedUpdates(({ text, viaKeyboard, originalText }) => {
        const isDeleted = !text.trim();
        updateElement(text, originalText, isDeleted);
        // select the created text element only if submitting via keyboard
        // (when submitting via click it should act as signal to deselect)
        if (!isDeleted && viaKeyboard) {
          const elementIdToSelect = element.containerId
            ? element.containerId
            : element.id;
          this.setState((prevState) => ({
            selectedElementIds: {
              ...prevState.selectedElementIds,
              [elementIdToSelect]: true,
            },
          }));
        }
        if (isDeleted) {
          fixBindingsAfterDeletion(this.scene.getNonDeletedElements(), [
            element,
          ]);
        }
        if (!isDeleted || isExistingElement) {
          this.history.resumeRecording();
        }

        this.setState({
          draggingElement: null,
          editingElement: null,
        });
        if (this.state.activeTool.locked) {
          setCursorForShape(this.canvas, this.state);
        }

        this.focusContainer();
      }),
      element,
      excalidrawContainer: this.excalidrawContainerRef.current,
      app: this,
    });
    // deselect all other elements when inserting text
    this.deselectElements();

    // do an initial update to re-initialize element position since we were
    // modifying element's x/y for sake of editor (case: syncing to remote)
    updateElement(element.text, element.originalText, false);
  }

  private deselectElements() {
    this.setState({
      selectedElementIds: {},
      selectedGroupIds: {},
      editingGroupId: null,
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

  private getElementAtPosition(
    x: number,
    y: number,
    opts?: {
      /** if true, returns the first selected element (with highest z-index)
        of all hit elements */
      preferSelected?: boolean;
      includeBoundTextElement?: boolean;
      includeLockedElements?: boolean;
    },
  ): NonDeleted<ExcalidrawElement> | null {
    const allHitElements = this.getElementsAtPosition(
      x,
      y,
      opts?.includeBoundTextElement,
      opts?.includeLockedElements,
    );
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
      return isHittingElementBoundingBoxWithoutHittingElement(
        elementWithHighestZIndex,
        this.state,
        x,
        y,
      )
        ? allHitElements[allHitElements.length - 2]
        : elementWithHighestZIndex;
    }
    if (allHitElements.length === 1) {
      return allHitElements[0];
    }
    return null;
  }

  private getElementsAtPosition(
    x: number,
    y: number,
    includeBoundTextElement: boolean = false,
    includeLockedElements: boolean = false,
  ): NonDeleted<ExcalidrawElement>[] {
    const elements =
      includeBoundTextElement && includeLockedElements
        ? this.scene.getNonDeletedElements()
        : this.scene
            .getNonDeletedElements()
            .filter(
              (element) =>
                (includeLockedElements || !element.locked) &&
                (includeBoundTextElement ||
                  !(isTextElement(element) && element.containerId)),
            );

    return getElementsAtPosition(elements, (element) =>
      hitTest(element, this.state, x, y),
    );
  }

  private startTextEditing = ({
    sceneX,
    sceneY,
    shouldBind,
    insertAtParentCenter = true,
  }: {
    /** X position to insert text at */
    sceneX: number;
    /** Y position to insert text at */
    sceneY: number;
    shouldBind: boolean;
    /** whether to attempt to insert at element center if applicable */
    insertAtParentCenter?: boolean;
  }) => {
    let parentCenterPosition =
      insertAtParentCenter &&
      this.getTextWysiwygSnappedToCenterPosition(
        sceneX,
        sceneY,
        this.state,
        this.canvas,
        window.devicePixelRatio,
      );

    let existingTextElement: NonDeleted<ExcalidrawTextElement> | null = null;
    let container: ExcalidrawTextContainer | null = null;

    const selectedElements = getSelectedElements(
      this.scene.getNonDeletedElements(),
      this.state,
    );

    if (selectedElements.length === 1) {
      if (isTextElement(selectedElements[0])) {
        existingTextElement = selectedElements[0];
      } else if (isTextBindableContainer(selectedElements[0], false)) {
        existingTextElement = getBoundTextElement(selectedElements[0]);
      } else {
        existingTextElement = this.getTextElementAtPosition(sceneX, sceneY);
      }
    } else {
      existingTextElement = this.getTextElementAtPosition(sceneX, sceneY);
    }

    // bind to container when shouldBind is true or
    // clicked on center of container
    if (
      !container &&
      !existingTextElement &&
      (shouldBind || parentCenterPosition)
    ) {
      container = getTextBindableContainerAtPosition(
        this.scene
          .getNonDeletedElements()
          .filter(
            (ele) =>
              isTextBindableContainer(ele, false) && !getBoundTextElement(ele),
          ),
        sceneX,
        sceneY,
      );
    }

    if (!existingTextElement && container) {
      const fontString = {
        fontSize: this.state.currentItemFontSize,
        fontFamily: this.state.currentItemFontFamily,
      };
      const minWidth = getApproxMinLineWidth(getFontString(fontString));
      const minHeight = getApproxMinLineHeight(getFontString(fontString));
      const newHeight = Math.max(container.height, minHeight);
      const newWidth = Math.max(container.width, minWidth);
      mutateElement(container, { height: newHeight, width: newWidth });
      sceneX = container.x + newWidth / 2;
      sceneY = container.y + newHeight / 2;
      if (parentCenterPosition) {
        parentCenterPosition = this.getTextWysiwygSnappedToCenterPosition(
          sceneX,
          sceneY,
          this.state,
          this.canvas,
          window.devicePixelRatio,
        );
      }
    }

    const element = existingTextElement
      ? existingTextElement
      : newTextElement({
          x: parentCenterPosition
            ? parentCenterPosition.elementCenterX
            : sceneX,
          y: parentCenterPosition
            ? parentCenterPosition.elementCenterY
            : sceneY,
          strokeColor: this.state.currentItemStrokeColor,
          backgroundColor: this.state.currentItemBackgroundColor,
          fillStyle: this.state.currentItemFillStyle,
          strokeWidth: this.state.currentItemStrokeWidth,
          strokeStyle: this.state.currentItemStrokeStyle,
          roughness: this.state.currentItemRoughness,
          opacity: this.state.currentItemOpacity,
          strokeSharpness: this.state.currentItemStrokeSharpness,
          text: "",
          fontSize: this.state.currentItemFontSize,
          fontFamily: this.state.currentItemFontFamily,
          textAlign: parentCenterPosition
            ? "center"
            : this.state.currentItemTextAlign,
          verticalAlign: parentCenterPosition
            ? VERTICAL_ALIGN.MIDDLE
            : DEFAULT_VERTICAL_ALIGN,
          containerId: container?.id ?? undefined,
          groupIds: container?.groupIds ?? [],
          locked: false,
        });

    this.setState({ editingElement: element });

    if (!existingTextElement) {
      this.scene.replaceAllElements([
        ...this.scene.getElementsIncludingDeleted(),
        element,
      ]);

      // case: creating new text not centered to parent element → offset Y
      // so that the text is centered to cursor position
      if (!parentCenterPosition) {
        mutateElement(element, {
          y: element.y - element.baseline / 2,
        });
      }
    }

    this.setState({
      editingElement: element,
    });

    this.handleTextWysiwyg(element, {
      isExistingElement: !!existingTextElement,
    });
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
    if (this.state.activeTool.type !== "selection") {
      return;
    }

    const selectedElements = getSelectedElements(
      this.scene.getNonDeletedElements(),
      this.state,
    );

    if (selectedElements.length === 1 && isLinearElement(selectedElements[0])) {
      if (
        !this.state.editingLinearElement ||
        this.state.editingLinearElement.elementId !== selectedElements[0].id
      ) {
        this.history.resumeRecording();
        this.setState({
          editingLinearElement: new LinearElementEditor(
            selectedElements[0],
            this.scene,
          ),
        });
      }
      return;
    }

    resetCursor(this.canvas);

    let { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
      event,
      this.state,
    );

    const selectedGroupIds = getSelectedGroupIds(this.state);

    if (selectedGroupIds.length > 0) {
      const hitElement = this.getElementAtPosition(sceneX, sceneY);

      const selectedGroupId =
        hitElement &&
        getSelectedGroupIdForElement(hitElement, this.state.selectedGroupIds);

      if (selectedGroupId) {
        this.setState((prevState) =>
          selectGroupsForSelectedElements(
            {
              ...prevState,
              editingGroupId: selectedGroupId,
              selectedElementIds: { [hitElement!.id]: true },
              selectedGroupIds: {},
            },
            this.scene.getNonDeletedElements(),
          ),
        );
        return;
      }
    }

    resetCursor(this.canvas);
    if (!event[KEYS.CTRL_OR_CMD] && !this.state.viewModeEnabled) {
      const selectedElements = getSelectedElements(
        this.scene.getNonDeletedElements(),
        this.state,
      );
      if (selectedElements.length === 1) {
        const selectedElement = selectedElements[0];
        const canBindText = hasBoundTextElement(selectedElement);
        if (canBindText) {
          sceneX = selectedElement.x + selectedElement.width / 2;
          sceneY = selectedElement.y + selectedElement.height / 2;
        }
      }
      this.startTextEditing({
        sceneX,
        sceneY,
        shouldBind: false,
        insertAtParentCenter: !event.altKey,
      });
    }
  };

  private getElementLinkAtPosition = (
    scenePointer: Readonly<{ x: number; y: number }>,
    hitElement: NonDeletedExcalidrawElement | null,
  ): ExcalidrawElement | undefined => {
    // Reversing so we traverse the elements in decreasing order
    // of z-index
    const elements = this.scene.getNonDeletedElements().slice().reverse();
    let hitElementIndex = Infinity;

    return elements.find((element, index) => {
      if (hitElement && element.id === hitElement.id) {
        hitElementIndex = index;
      }
      return (
        element.link &&
        index <= hitElementIndex &&
        isPointHittingLinkIcon(
          element,
          this.state,
          [scenePointer.x, scenePointer.y],
          this.device.isMobile,
        )
      );
    });
  };

  private redirectToLink = (
    event: React.PointerEvent<HTMLCanvasElement>,
    isTouchScreen: boolean,
  ) => {
    const draggedDistance = distance2d(
      this.lastPointerDown!.clientX,
      this.lastPointerDown!.clientY,
      this.lastPointerUp!.clientX,
      this.lastPointerUp!.clientY,
    );
    if (
      !this.hitLinkElement ||
      // For touch screen allow dragging threshold else strict check
      (isTouchScreen && draggedDistance > DRAGGING_THRESHOLD) ||
      (!isTouchScreen && draggedDistance !== 0)
    ) {
      return;
    }
    const lastPointerDownCoords = viewportCoordsToSceneCoords(
      this.lastPointerDown!,
      this.state,
    );
    const lastPointerDownHittingLinkIcon = isPointHittingLinkIcon(
      this.hitLinkElement,
      this.state,
      [lastPointerDownCoords.x, lastPointerDownCoords.y],
      this.device.isMobile,
    );
    const lastPointerUpCoords = viewportCoordsToSceneCoords(
      this.lastPointerUp!,
      this.state,
    );
    const lastPointerUpHittingLinkIcon = isPointHittingLinkIcon(
      this.hitLinkElement,
      this.state,
      [lastPointerUpCoords.x, lastPointerUpCoords.y],
      this.device.isMobile,
    );
    if (lastPointerDownHittingLinkIcon && lastPointerUpHittingLinkIcon) {
      const url = this.hitLinkElement.link;
      if (url) {
        let customEvent;
        if (this.props.onLinkOpen) {
          customEvent = wrapEvent(EVENT.EXCALIDRAW_LINK, event.nativeEvent);
          this.props.onLinkOpen(this.hitLinkElement, customEvent);
        }
        if (!customEvent?.defaultPrevented) {
          const target = isLocalLink(url) ? "_self" : "_blank";
          const newWindow = window.open(undefined, target);
          // https://mathiasbynens.github.io/rel-noopener/
          if (newWindow) {
            newWindow.opener = null;
            newWindow.location = normalizeLink(url);
          }
        }
      }
    }
  };

  private handleCanvasPointerMove = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    this.savePointer(event.clientX, event.clientY, this.state.cursorButton);
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

        return {
          zoom: zoomState.zoom,
          scrollX: zoomState.scrollX + deltaX / nextZoom,
          scrollY: zoomState.scrollY + deltaY / nextZoom,
          shouldCacheIgnoreZoom: true,
        };
      });
      this.resetShouldCacheIgnoreZoomDebounced();
    } else {
      gesture.lastCenter =
        gesture.initialDistance =
        gesture.initialScale =
          null;
    }

    if (isHoldingSpace || isPanning || isDraggingScrollBar) {
      return;
    }

    const isPointerOverScrollBars = isOverScrollBars(
      currentScrollBars,
      event.clientX - this.state.offsetLeft,
      event.clientY - this.state.offsetTop,
    );
    const isOverScrollBar = isPointerOverScrollBars.isOverEither;
    if (!this.state.draggingElement && !this.state.multiElement) {
      if (isOverScrollBar) {
        resetCursor(this.canvas);
      } else {
        setCursorForShape(this.canvas, this.state);
      }
    }

    const scenePointer = viewportCoordsToSceneCoords(event, this.state);
    const { x: scenePointerX, y: scenePointerY } = scenePointer;

    if (
      this.state.editingLinearElement &&
      !this.state.editingLinearElement.isDragging
    ) {
      const editingLinearElement = LinearElementEditor.handlePointerMove(
        event,
        scenePointerX,
        scenePointerY,
        this.state.editingLinearElement,
        this.state.gridSize,
      );
      if (editingLinearElement !== this.state.editingLinearElement) {
        this.setState({ editingLinearElement });
      }
      if (editingLinearElement.lastUncommittedPoint != null) {
        this.maybeSuggestBindingAtCursor(scenePointer);
      } else {
        this.setState({ suggestedBindings: [] });
      }
    }

    if (isBindingElementType(this.state.activeTool.type)) {
      // Hovering with a selected tool or creating new linear element via click
      // and point
      const { draggingElement } = this.state;
      if (isBindingElement(draggingElement, false)) {
        this.maybeSuggestBindingsForLinearElementAtCoords(
          draggingElement,
          [scenePointer],
          this.state.startBoundElement,
        );
      } else {
        this.maybeSuggestBindingAtCursor(scenePointer);
      }
    }

    if (this.state.multiElement) {
      const { multiElement } = this.state;
      const { x: rx, y: ry } = multiElement;

      const { points, lastCommittedPoint } = multiElement;
      const lastPoint = points[points.length - 1];

      setCursorForShape(this.canvas, this.state);

      if (lastPoint === lastCommittedPoint) {
        // if we haven't yet created a temp point and we're beyond commit-zone
        // threshold, add a point
        if (
          distance2d(
            scenePointerX - rx,
            scenePointerY - ry,
            lastPoint[0],
            lastPoint[1],
          ) >= LINE_CONFIRM_THRESHOLD
        ) {
          mutateElement(multiElement, {
            points: [...points, [scenePointerX - rx, scenePointerY - ry]],
          });
        } else {
          setCursor(this.canvas, CURSOR_TYPE.POINTER);
          // in this branch, we're inside the commit zone, and no uncommitted
          // point exists. Thus do nothing (don't add/remove points).
        }
      } else if (
        points.length > 2 &&
        lastCommittedPoint &&
        distance2d(
          scenePointerX - rx,
          scenePointerY - ry,
          lastCommittedPoint[0],
          lastCommittedPoint[1],
        ) < LINE_CONFIRM_THRESHOLD
      ) {
        setCursor(this.canvas, CURSOR_TYPE.POINTER);
        mutateElement(multiElement, {
          points: points.slice(0, -1),
        });
      } else {
        if (isPathALoop(points, this.state.zoom.value)) {
          setCursor(this.canvas, CURSOR_TYPE.POINTER);
        }
        // update last uncommitted point
        mutateElement(multiElement, {
          points: [
            ...points.slice(0, -1),
            [scenePointerX - rx, scenePointerY - ry],
          ],
        });
      }

      return;
    }

    const hasDeselectedButton = Boolean(event.buttons);
    if (
      hasDeselectedButton ||
      (this.state.activeTool.type !== "selection" &&
        this.state.activeTool.type !== "text" &&
        this.state.activeTool.type !== "eraser")
    ) {
      return;
    }

    const elements = this.scene.getNonDeletedElements();

    const selectedElements = getSelectedElements(elements, this.state);
    if (
      selectedElements.length === 1 &&
      !isOverScrollBar &&
      !this.state.editingLinearElement
    ) {
      const elementWithTransformHandleType = getElementWithTransformHandleType(
        elements,
        this.state,
        scenePointerX,
        scenePointerY,
        this.state.zoom,
        event.pointerType,
      );
      if (
        elementWithTransformHandleType &&
        elementWithTransformHandleType.transformHandleType
      ) {
        setCursor(
          this.canvas,
          getCursorForResizingElement(elementWithTransformHandleType),
        );
        return;
      }
    } else if (selectedElements.length > 1 && !isOverScrollBar) {
      const transformHandleType = getTransformHandleTypeFromCoords(
        getCommonBounds(selectedElements),
        scenePointerX,
        scenePointerY,
        this.state.zoom,
        event.pointerType,
      );
      if (transformHandleType) {
        setCursor(
          this.canvas,
          getCursorForResizingElement({
            transformHandleType,
          }),
        );
        return;
      }
    }

    const hitElement = this.getElementAtPosition(
      scenePointer.x,
      scenePointer.y,
    );
    this.hitLinkElement = this.getElementLinkAtPosition(
      scenePointer,
      hitElement,
    );
    if (isEraserActive(this.state)) {
      return;
    }
    if (
      this.hitLinkElement &&
      !this.state.selectedElementIds[this.hitLinkElement.id]
    ) {
      setCursor(this.canvas, CURSOR_TYPE.POINTER);
      showHyperlinkTooltip(this.hitLinkElement, this.state);
    } else {
      hideHyperlinkToolip();
      if (
        hitElement &&
        hitElement.link &&
        this.state.selectedElementIds[hitElement.id] &&
        !this.contextMenuOpen &&
        !this.state.showHyperlinkPopup
      ) {
        this.setState({ showHyperlinkPopup: "info" });
      } else if (this.state.activeTool.type === "text") {
        setCursor(
          this.canvas,
          isTextElement(hitElement) ? CURSOR_TYPE.TEXT : CURSOR_TYPE.CROSSHAIR,
        );
      } else if (this.state.viewModeEnabled) {
        setCursor(this.canvas, CURSOR_TYPE.GRAB);
      } else if (isOverScrollBar) {
        setCursor(this.canvas, CURSOR_TYPE.AUTO);
      } else if (this.state.editingLinearElement) {
        const element = LinearElementEditor.getElement(
          this.state.editingLinearElement.elementId,
        );

        if (
          element &&
          isHittingElementNotConsideringBoundingBox(element, this.state, [
            scenePointer.x,
            scenePointer.y,
          ])
        ) {
          setCursor(this.canvas, CURSOR_TYPE.MOVE);
        } else {
          setCursor(this.canvas, CURSOR_TYPE.AUTO);
        }
      } else if (
        // if using cmd/ctrl, we're not dragging
        !event[KEYS.CTRL_OR_CMD] &&
        (hitElement ||
          this.isHittingCommonBoundingBoxOfSelectedElements(
            scenePointer,
            selectedElements,
          )) &&
        !hitElement?.locked
      ) {
        setCursor(this.canvas, CURSOR_TYPE.MOVE);
      } else {
        setCursor(this.canvas, CURSOR_TYPE.AUTO);
      }
    }
  };

  private handleEraser = (
    event: PointerEvent,
    pointerDownState: PointerDownState,
    scenePointer: { x: number; y: number },
  ) => {
    const updateElementIds = (elements: ExcalidrawElement[]) => {
      elements.forEach((element) => {
        if (element.locked) {
          return;
        }

        idsToUpdate.push(element.id);
        if (event.altKey) {
          if (
            pointerDownState.elementIdsToErase[element.id] &&
            pointerDownState.elementIdsToErase[element.id].erase
          ) {
            pointerDownState.elementIdsToErase[element.id].erase = false;
          }
        } else if (!pointerDownState.elementIdsToErase[element.id]) {
          pointerDownState.elementIdsToErase[element.id] = {
            erase: true,
            opacity: element.opacity,
          };
        }
      });
    };

    const idsToUpdate: Array<string> = [];

    const distance = distance2d(
      pointerDownState.lastCoords.x,
      pointerDownState.lastCoords.y,
      scenePointer.x,
      scenePointer.y,
    );
    const threshold = 10 / this.state.zoom.value;
    const point = { ...pointerDownState.lastCoords };
    let samplingInterval = 0;
    while (samplingInterval <= distance) {
      const hitElements = this.getElementsAtPosition(point.x, point.y);
      updateElementIds(hitElements);

      // Exit since we reached current point
      if (samplingInterval === distance) {
        break;
      }

      // Calculate next point in the line at a distance of sampling interval
      samplingInterval = Math.min(samplingInterval + threshold, distance);

      const distanceRatio = samplingInterval / distance;
      const nextX =
        (1 - distanceRatio) * point.x + distanceRatio * scenePointer.x;
      const nextY =
        (1 - distanceRatio) * point.y + distanceRatio * scenePointer.y;
      point.x = nextX;
      point.y = nextY;
    }

    const elements = this.scene.getElementsIncludingDeleted().map((ele) => {
      const id =
        isBoundToContainer(ele) && idsToUpdate.includes(ele.containerId)
          ? ele.containerId
          : ele.id;
      if (idsToUpdate.includes(id)) {
        if (event.altKey) {
          if (
            pointerDownState.elementIdsToErase[id] &&
            pointerDownState.elementIdsToErase[id].erase === false
          ) {
            return newElementWith(ele, {
              opacity: pointerDownState.elementIdsToErase[id].opacity,
            });
          }
        } else {
          return newElementWith(ele, {
            opacity: ELEMENT_READY_TO_ERASE_OPACITY,
          });
        }
      }
      return ele;
    });

    this.scene.replaceAllElements(elements);

    pointerDownState.lastCoords.x = scenePointer.x;
    pointerDownState.lastCoords.y = scenePointer.y;
  };
  // set touch moving for mobile context menu
  private handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    invalidateContextMenu = true;
  };

  private handleCanvasPointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    // remove any active selection when we start to interact with canvas
    // (mainly, we care about removing selection outside the component which
    //  would prevent our copy handling otherwise)
    const selection = document.getSelection();
    if (selection?.anchorNode) {
      selection.removeAllRanges();
    }
    this.maybeOpenContextMenuAfterPointerDownOnTouchDevices(event);
    this.maybeCleanupAfterMissingPointerUp(event);

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

    this.lastPointerDown = event;
    this.setState({
      lastPointerDownWith: event.pointerType,
      cursorButton: "down",
    });
    this.savePointer(event.clientX, event.clientY, "down");

    this.updateGestureOnPointerDown(event);

    if (this.handleCanvasPanUsingWheelOrSpaceDrag(event)) {
      return;
    }

    // only handle left mouse button or touch
    if (
      event.button !== POINTER_BUTTON.MAIN &&
      event.button !== POINTER_BUTTON.TOUCH
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

    if (this.handleDraggingScrollBar(event, pointerDownState)) {
      return;
    }

    // Since context menu closes on pointer down so setting to false
    this.contextMenuOpen = false;
    this.clearSelectionIfNotUsingSelection();
    this.updateBindingEnabledOnPointerMove(event);

    if (this.handleSelectionOnPointerDown(event, pointerDownState)) {
      return;
    }

    const allowOnPointerDown =
      !this.state.penMode ||
      event.pointerType !== "touch" ||
      this.state.activeTool.type === "selection" ||
      this.state.activeTool.type === "text" ||
      this.state.activeTool.type === "image";

    if (!allowOnPointerDown) {
      return;
    }

    if (this.state.activeTool.type === "text") {
      this.handleTextOnPointerDown(event, pointerDownState);
      return;
    } else if (
      this.state.activeTool.type === "arrow" ||
      this.state.activeTool.type === "line"
    ) {
      this.handleLinearElementOnPointerDown(
        event,
        this.state.activeTool.type,
        pointerDownState,
      );
    } else if (this.state.activeTool.type === "image") {
      // reset image preview on pointerdown
      setCursor(this.canvas, CURSOR_TYPE.CROSSHAIR);

      // retrieve the latest element as the state may be stale
      const pendingImageElement =
        this.state.pendingImageElementId &&
        this.scene.getElement(this.state.pendingImageElementId);

      if (!pendingImageElement) {
        return;
      }

      this.setState({
        draggingElement: pendingImageElement,
        editingElement: pendingImageElement,
        pendingImageElementId: null,
        multiElement: null,
      });

      const { x, y } = viewportCoordsToSceneCoords(event, this.state);
      mutateElement(pendingImageElement, {
        x,
        y,
      });
    } else if (this.state.activeTool.type === "freedraw") {
      this.handleFreeDrawElementOnPointerDown(
        event,
        this.state.activeTool.type,
        pointerDownState,
      );
    } else if (this.state.activeTool.type === "custom") {
      setCursor(this.canvas, CURSOR_TYPE.AUTO);
    } else if (this.state.activeTool.type !== "eraser") {
      this.createGenericElementOnPointerDown(
        this.state.activeTool.type,
        pointerDownState,
      );
    }

    this.props?.onPointerDown?.(this.state.activeTool, pointerDownState);

    const onPointerMove =
      this.onPointerMoveFromPointerDownHandler(pointerDownState);

    const onPointerUp =
      this.onPointerUpFromPointerDownHandler(pointerDownState);

    const onKeyDown = this.onKeyDownFromPointerDownHandler(pointerDownState);
    const onKeyUp = this.onKeyUpFromPointerDownHandler(pointerDownState);

    lastPointerUp = onPointerUp;

    if (!this.state.viewModeEnabled) {
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
    this.lastPointerUp = event;
    if (this.device.isTouchScreen) {
      const scenePointer = viewportCoordsToSceneCoords(
        { clientX: event.clientX, clientY: event.clientY },
        this.state,
      );
      const hitElement = this.getElementAtPosition(
        scenePointer.x,
        scenePointer.y,
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
      this.redirectToLink(event, this.device.isTouchScreen);
    }

    this.removePointer(event);
  };

  private maybeOpenContextMenuAfterPointerDownOnTouchDevices = (
    event: React.PointerEvent<HTMLCanvasElement>,
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

  private maybeCleanupAfterMissingPointerUp(
    event: React.PointerEvent<HTMLCanvasElement>,
  ): void {
    if (lastPointerUp !== null) {
      // Unfortunately, sometimes we don't get a pointerup after a pointerdown,
      // this can happen when a contextual menu or alert is triggered. In order to avoid
      // being in a weird state, we clean up on the next pointerdown
      lastPointerUp(event);
    }
  }

  // Returns whether the event is a panning
  private handleCanvasPanUsingWheelOrSpaceDrag = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ): boolean => {
    if (
      !(
        gesture.pointers.size <= 1 &&
        (event.button === POINTER_BUTTON.WHEEL ||
          (event.button === POINTER_BUTTON.MAIN && isHoldingSpace) ||
          this.state.viewModeEnabled)
      ) ||
      isTextElement(this.state.editingElement)
    ) {
      return false;
    }
    isPanning = true;
    event.preventDefault();

    let nextPastePrevented = false;
    const isLinux = /Linux/.test(window.navigator.platform);

    setCursor(this.canvas, CURSOR_TYPE.GRABBING);
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

      this.setState({
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
            setCursor(this.canvas, CURSOR_TYPE.GRAB);
          } else {
            setCursorForShape(this.canvas, this.state);
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
    event: React.PointerEvent<HTMLCanvasElement>,
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
    event: React.PointerEvent<HTMLCanvasElement>,
  ): PointerDownState {
    const origin = viewportCoordsToSceneCoords(event, this.state);
    const selectedElements = getSelectedElements(
      this.scene.getNonDeletedElements(),
      this.state,
    );
    const [minX, minY, maxX, maxY] = getCommonBounds(selectedElements);

    return {
      origin,
      withCmdOrCtrl: event[KEYS.CTRL_OR_CMD],
      originInGrid: tupleToCoors(
        getGridPoint(origin.x, origin.y, this.state.gridSize),
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
        hasHitElementInside: false,
      },
      drag: {
        hasOccurred: false,
        offset: null,
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
      elementIdsToErase: {},
    };
  }

  // Returns whether the event is a dragging a scrollbar
  private handleDraggingScrollBar(
    event: React.PointerEvent<HTMLCanvasElement>,
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
      isDraggingScrollBar = false;
      setCursorForShape(this.canvas, this.state);
      lastPointerUp = null;
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
    if (this.state.activeTool.type !== "selection") {
      this.setState({
        selectedElementIds: {},
        selectedGroupIds: {},
        editingGroupId: null,
      });
    }
  };

  /**
   * @returns whether the pointer event has been completely handled
   */
  private handleSelectionOnPointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>,
    pointerDownState: PointerDownState,
  ): boolean => {
    if (this.state.activeTool.type === "selection") {
      const elements = this.scene.getNonDeletedElements();
      const selectedElements = getSelectedElements(elements, this.state);
      if (selectedElements.length === 1 && !this.state.editingLinearElement) {
        const elementWithTransformHandleType =
          getElementWithTransformHandleType(
            elements,
            this.state,
            pointerDownState.origin.x,
            pointerDownState.origin.y,
            this.state.zoom,
            event.pointerType,
          );
        if (elementWithTransformHandleType != null) {
          this.setState({
            resizingElement: elementWithTransformHandleType.element,
          });
          pointerDownState.resize.handleType =
            elementWithTransformHandleType.transformHandleType;
        }
      } else if (selectedElements.length > 1) {
        pointerDownState.resize.handleType = getTransformHandleTypeFromCoords(
          getCommonBounds(selectedElements),
          pointerDownState.origin.x,
          pointerDownState.origin.y,
          this.state.zoom,
          event.pointerType,
        );
      }
      if (pointerDownState.resize.handleType) {
        setCursor(
          this.canvas,
          getCursorForResizingElement({
            transformHandleType: pointerDownState.resize.handleType,
          }),
        );
        pointerDownState.resize.isResizing = true;
        pointerDownState.resize.offset = tupleToCoors(
          getResizeOffsetXY(
            pointerDownState.resize.handleType,
            selectedElements,
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
        if (this.state.editingLinearElement) {
          const ret = LinearElementEditor.handlePointerDown(
            event,
            this.state,
            (appState) => this.setState(appState),
            this.history,
            pointerDownState.origin,
          );
          if (ret.hitElement) {
            pointerDownState.hit.element = ret.hitElement;
          }
          if (ret.didAddPoint) {
            return true;
          }
        }
        // hitElement may already be set above, so check first
        pointerDownState.hit.element =
          pointerDownState.hit.element ??
          this.getElementAtPosition(
            pointerDownState.origin.x,
            pointerDownState.origin.y,
          );

        if (pointerDownState.hit.element) {
          // Early return if pointer is hitting link icon
          if (
            isPointHittingLinkIcon(
              pointerDownState.hit.element,
              this.state,
              [pointerDownState.origin.x, pointerDownState.origin.y],
              this.device.isMobile,
            )
          ) {
            return false;
          }
          pointerDownState.hit.hasHitElementInside =
            isHittingElementNotConsideringBoundingBox(
              pointerDownState.hit.element,
              this.state,
              [pointerDownState.origin.x, pointerDownState.origin.y],
            );
        }

        // For overlapped elements one position may hit
        // multiple elements
        pointerDownState.hit.allHitElements = this.getElementsAtPosition(
          pointerDownState.origin.x,
          pointerDownState.origin.y,
        );

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

        if (this.state.editingLinearElement) {
          this.setState({
            selectedElementIds: {
              [this.state.editingLinearElement.elementId]: true,
            },
          });
          // If we click on something
        } else if (hitElement != null) {
          // on CMD/CTRL, drill down to hit element regardless of groups etc.
          if (event[KEYS.CTRL_OR_CMD]) {
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
                selectedElementIds: {},
                selectedGroupIds: {},
                editingGroupId: null,
              });
            }

            // Add hit element to selection. At this point if we're not holding
            // SHIFT the previously selected element(s) were deselected above
            // (make sure you use setState updater to use latest state)
            if (
              !someHitElementIsSelected &&
              !pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements
            ) {
              this.setState((prevState) => {
                return selectGroupsForSelectedElements(
                  {
                    ...prevState,
                    selectedElementIds: {
                      ...prevState.selectedElementIds,
                      [hitElement.id]: true,
                    },
                    showHyperlinkPopup: hitElement.link ? "info" : false,
                  },
                  this.scene.getNonDeletedElements(),
                );
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
    const threshold = 10 / this.state.zoom.value;
    const [x1, y1, x2, y2] = getCommonBounds(selectedElements);
    return (
      point.x > x1 - threshold &&
      point.x < x2 + threshold &&
      point.y > y1 - threshold &&
      point.y < y2 + threshold
    );
  }

  private handleTextOnPointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>,
    pointerDownState: PointerDownState,
  ): void => {
    // if we're currently still editing text, clicking outside
    // should only finalize it, not create another (irrespective
    // of state.activeTool.locked)
    if (isTextElement(this.state.editingElement)) {
      return;
    }
    let sceneX = pointerDownState.origin.x;
    let sceneY = pointerDownState.origin.y;

    const element = this.getElementAtPosition(sceneX, sceneY, {
      includeBoundTextElement: true,
    });

    const canBindText = hasBoundTextElement(element);
    if (canBindText) {
      sceneX = element.x + element.width / 2;
      sceneY = element.y + element.height / 2;
    }
    this.startTextEditing({
      sceneX,
      sceneY,
      shouldBind: false,
      insertAtParentCenter: !event.altKey,
    });

    resetCursor(this.canvas);
    if (!this.state.activeTool.locked) {
      this.setState({
        activeTool: updateActiveTool(this.state, { type: "selection" }),
      });
    }
  };

  private handleFreeDrawElementOnPointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>,
    elementType: ExcalidrawFreeDrawElement["type"],
    pointerDownState: PointerDownState,
  ) => {
    // Begin a mark capture. This does not have to update state yet.
    const [gridX, gridY] = getGridPoint(
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      null,
    );

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
      strokeSharpness: this.state.currentItemLinearStrokeSharpness,
      simulatePressure: event.pressure === 0.5,
      locked: false,
    });

    this.setState((prevState) => ({
      selectedElementIds: {
        ...prevState.selectedElementIds,
        [element.id]: false,
      },
    }));

    const pressures = element.simulatePressure
      ? element.pressures
      : [...element.pressures, event.pressure];

    mutateElement(element, {
      points: [[0, 0]],
      pressures,
    });

    const boundElement = getHoveredElementForBinding(
      pointerDownState.origin,
      this.scene,
    );
    this.scene.replaceAllElements([
      ...this.scene.getElementsIncludingDeleted(),
      element,
    ]);
    this.setState({
      draggingElement: element,
      editingElement: element,
      startBoundElement: boundElement,
      suggestedBindings: [],
    });
  };

  private createImageElement = ({
    sceneX,
    sceneY,
  }: {
    sceneX: number;
    sceneY: number;
  }) => {
    const [gridX, gridY] = getGridPoint(sceneX, sceneY, this.state.gridSize);

    const element = newImageElement({
      type: "image",
      x: gridX,
      y: gridY,
      strokeColor: this.state.currentItemStrokeColor,
      backgroundColor: this.state.currentItemBackgroundColor,
      fillStyle: this.state.currentItemFillStyle,
      strokeWidth: this.state.currentItemStrokeWidth,
      strokeStyle: this.state.currentItemStrokeStyle,
      roughness: this.state.currentItemRoughness,
      opacity: this.state.currentItemOpacity,
      strokeSharpness: this.state.currentItemLinearStrokeSharpness,
      locked: false,
    });

    return element;
  };

  private handleLinearElementOnPointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>,
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
        mutateElement(multiElement, {
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
        distance2d(
          pointerDownState.origin.x - rx,
          pointerDownState.origin.y - ry,
          lastCommittedPoint[0],
          lastCommittedPoint[1],
        ) < LINE_CONFIRM_THRESHOLD
      ) {
        this.actionManager.executeAction(actionFinalize);
        return;
      }

      this.setState((prevState) => ({
        selectedElementIds: {
          ...prevState.selectedElementIds,
          [multiElement.id]: true,
        },
      }));
      // clicking outside commit zone → update reference for last committed
      // point
      mutateElement(multiElement, {
        lastCommittedPoint: multiElement.points[multiElement.points.length - 1],
      });
      setCursor(this.canvas, CURSOR_TYPE.POINTER);
    } else {
      const [gridX, gridY] = getGridPoint(
        pointerDownState.origin.x,
        pointerDownState.origin.y,
        this.state.gridSize,
      );

      /* If arrow is pre-arrowheads, it will have undefined for both start and end arrowheads.
      If so, we want it to be null for start and "arrow" for end. If the linear item is not
      an arrow, we want it to be null for both. Otherwise, we want it to use the
      values from appState. */

      const { currentItemStartArrowhead, currentItemEndArrowhead } = this.state;
      const [startArrowhead, endArrowhead] =
        elementType === "arrow"
          ? [currentItemStartArrowhead, currentItemEndArrowhead]
          : [null, null];

      const element = newLinearElement({
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
        strokeSharpness: this.state.currentItemLinearStrokeSharpness,
        startArrowhead,
        endArrowhead,
        locked: false,
      });
      this.setState((prevState) => ({
        selectedElementIds: {
          ...prevState.selectedElementIds,
          [element.id]: false,
        },
      }));
      mutateElement(element, {
        points: [...element.points, [0, 0]],
      });
      const boundElement = getHoveredElementForBinding(
        pointerDownState.origin,
        this.scene,
      );
      this.scene.replaceAllElements([
        ...this.scene.getElementsIncludingDeleted(),
        element,
      ]);
      this.setState({
        draggingElement: element,
        editingElement: element,
        startBoundElement: boundElement,
        suggestedBindings: [],
      });
    }
  };

  private createGenericElementOnPointerDown = (
    elementType: ExcalidrawGenericElement["type"],
    pointerDownState: PointerDownState,
  ): void => {
    const [gridX, gridY] = getGridPoint(
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      this.state.gridSize,
    );
    const element = newElement({
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
      strokeSharpness: this.state.currentItemStrokeSharpness,
      locked: false,
    });

    if (element.type === "selection") {
      this.setState({
        selectionElement: element,
        draggingElement: element,
      });
    } else {
      this.scene.replaceAllElements([
        ...this.scene.getElementsIncludingDeleted(),
        element,
      ]);
      this.setState({
        multiElement: null,
        draggingElement: element,
        editingElement: element,
      });
    }
  };

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
      // We need to initialize dragOffsetXY only after we've updated
      // `state.selectedElementIds` on pointerDown. Doing it here in pointerMove
      // event handler should hopefully ensure we're already working with
      // the updated state.
      if (pointerDownState.drag.offset === null) {
        pointerDownState.drag.offset = tupleToCoors(
          getDragOffsetXY(
            getSelectedElements(this.scene.getNonDeletedElements(), this.state),
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

      const pointerCoords = viewportCoordsToSceneCoords(event, this.state);

      if (isEraserActive(this.state)) {
        this.handleEraser(event, pointerDownState, pointerCoords);
        return;
      }

      const [gridX, gridY] = getGridPoint(
        pointerCoords.x,
        pointerCoords.y,
        this.state.gridSize,
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
          distance2d(
            pointerCoords.x,
            pointerCoords.y,
            pointerDownState.origin.x,
            pointerDownState.origin.y,
          ) < DRAGGING_THRESHOLD
        ) {
          return;
        }
      }

      if (pointerDownState.resize.isResizing) {
        pointerDownState.lastCoords.x = pointerCoords.x;
        pointerDownState.lastCoords.y = pointerCoords.y;
        if (this.maybeHandleResize(pointerDownState, event)) {
          return true;
        }
      }

      if (this.state.editingLinearElement) {
        const didDrag = LinearElementEditor.handlePointDragging(
          this.state,
          (appState) => this.setState(appState),
          pointerCoords.x,
          pointerCoords.y,
          (element, pointsSceneCoords) => {
            this.maybeSuggestBindingsForLinearElementAtCoords(
              element,
              pointsSceneCoords,
            );
          },
        );

        if (didDrag) {
          pointerDownState.lastCoords.x = pointerCoords.x;
          pointerDownState.lastCoords.y = pointerCoords.y;
          return;
        }
      }

      const hasHitASelectedElement = pointerDownState.hit.allHitElements.some(
        (element) => this.isASelectedElement(element),
      );

      if (
        (hasHitASelectedElement ||
          pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements) &&
        // this allows for box-selecting points when clicking inside the
        // line's bounding box
        (!this.state.editingLinearElement || !event.shiftKey) &&
        // box-selecting without shift when editing line, not clicking on a line
        (!this.state.editingLinearElement ||
          this.state.editingLinearElement?.elementId !==
            pointerDownState.hit.element?.id ||
          pointerDownState.hit.hasHitElementInside)
      ) {
        const selectedElements = getSelectedElements(
          this.scene.getNonDeletedElements(),
          this.state,
        );
        if (selectedElements.every((element) => element.locked)) {
          return;
        }
        // Marking that click was used for dragging to check
        // if elements should be deselected on pointerup
        pointerDownState.drag.hasOccurred = true;
        // prevent dragging even if we're no longer holding cmd/ctrl otherwise
        // it would have weird results (stuff jumping all over the screen)
        if (selectedElements.length > 0 && !pointerDownState.withCmdOrCtrl) {
          const [dragX, dragY] = getGridPoint(
            pointerCoords.x - pointerDownState.drag.offset.x,
            pointerCoords.y - pointerDownState.drag.offset.y,
            this.state.gridSize,
          );

          const [dragDistanceX, dragDistanceY] = [
            Math.abs(pointerCoords.x - pointerDownState.origin.x),
            Math.abs(pointerCoords.y - pointerDownState.origin.y),
          ];

          // We only drag in one direction if shift is pressed
          const lockDirection = event.shiftKey;

          dragSelectedElements(
            pointerDownState,
            selectedElements,
            dragX,
            dragY,
            lockDirection,
            dragDistanceX,
            dragDistanceY,
            this.state,
          );
          this.maybeSuggestBindingForAll(selectedElements);

          // We duplicate the selected element if alt is pressed on pointer move
          if (event.altKey && !pointerDownState.hit.hasBeenDuplicated) {
            // Move the currently selected elements to the top of the z index stack, and
            // put the duplicates where the selected elements used to be.
            // (the origin point where the dragging started)

            pointerDownState.hit.hasBeenDuplicated = true;

            const nextElements = [];
            const elementsToAppend = [];
            const groupIdMap = new Map();
            const oldIdToDuplicatedId = new Map();
            const hitElement = pointerDownState.hit.element;
            const elements = this.scene.getElementsIncludingDeleted();
            const selectedElementIds: Array<ExcalidrawElement["id"]> =
              getSelectedElements(elements, this.state, true).map(
                (element) => element.id,
              );

            for (const element of elements) {
              if (
                selectedElementIds.includes(element.id) ||
                // case: the state.selectedElementIds might not have been
                // updated yet by the time this mousemove event is fired
                (element.id === hitElement?.id &&
                  pointerDownState.hit.wasAddedToSelection)
              ) {
                const duplicatedElement = duplicateElement(
                  this.state.editingGroupId,
                  groupIdMap,
                  element,
                );
                const [originDragX, originDragY] = getGridPoint(
                  pointerDownState.origin.x - pointerDownState.drag.offset.x,
                  pointerDownState.origin.y - pointerDownState.drag.offset.y,
                  this.state.gridSize,
                );
                mutateElement(duplicatedElement, {
                  x: duplicatedElement.x + (originDragX - dragX),
                  y: duplicatedElement.y + (originDragY - dragY),
                });
                nextElements.push(duplicatedElement);
                elementsToAppend.push(element);
                oldIdToDuplicatedId.set(element.id, duplicatedElement.id);
              } else {
                nextElements.push(element);
              }
            }
            const nextSceneElements = [...nextElements, ...elementsToAppend];
            bindTextToShapeAfterDuplication(
              nextElements,
              elementsToAppend,
              oldIdToDuplicatedId,
            );
            fixBindingsAfterDuplication(
              nextSceneElements,
              elementsToAppend,
              oldIdToDuplicatedId,
              "duplicatesServeAsOld",
            );
            this.scene.replaceAllElements(nextSceneElements);
          }
          return;
        }
      }

      // It is very important to read this.state within each move event,
      // otherwise we would read a stale one!
      const draggingElement = this.state.draggingElement;
      if (!draggingElement) {
        return;
      }

      if (draggingElement.type === "freedraw") {
        const points = draggingElement.points;
        const dx = pointerCoords.x - draggingElement.x;
        const dy = pointerCoords.y - draggingElement.y;

        const lastPoint = points.length > 0 && points[points.length - 1];
        const discardPoint =
          lastPoint && lastPoint[0] === dx && lastPoint[1] === dy;

        if (!discardPoint) {
          const pressures = draggingElement.simulatePressure
            ? draggingElement.pressures
            : [...draggingElement.pressures, event.pressure];

          mutateElement(draggingElement, {
            points: [...points, [dx, dy]],
            pressures,
          });
        }
      } else if (isLinearElement(draggingElement)) {
        pointerDownState.drag.hasOccurred = true;
        const points = draggingElement.points;
        let dx = gridX - draggingElement.x;
        let dy = gridY - draggingElement.y;

        if (shouldRotateWithDiscreteAngle(event) && points.length === 2) {
          ({ width: dx, height: dy } = getPerfectElementSize(
            this.state.activeTool.type,
            dx,
            dy,
          ));
        }

        if (points.length === 1) {
          mutateElement(draggingElement, { points: [...points, [dx, dy]] });
        } else if (points.length > 1) {
          mutateElement(draggingElement, {
            points: [...points.slice(0, -1), [dx, dy]],
          });
        }

        if (isBindingElement(draggingElement, false)) {
          // When creating a linear element by dragging
          this.maybeSuggestBindingsForLinearElementAtCoords(
            draggingElement,
            [pointerCoords],
            this.state.startBoundElement,
          );
        }
      } else {
        pointerDownState.lastCoords.x = pointerCoords.x;
        pointerDownState.lastCoords.y = pointerCoords.y;
        this.maybeDragNewGenericElement(pointerDownState, event);
      }

      if (this.state.activeTool.type === "selection") {
        pointerDownState.boxSelection.hasOccurred = true;

        const elements = this.scene.getNonDeletedElements();
        if (
          !event.shiftKey &&
          // allows for box-selecting points (without shift)
          !this.state.editingLinearElement &&
          isSomeElementSelected(elements, this.state)
        ) {
          if (pointerDownState.withCmdOrCtrl && pointerDownState.hit.element) {
            this.setState((prevState) =>
              selectGroupsForSelectedElements(
                {
                  ...prevState,
                  selectedElementIds: {
                    [pointerDownState.hit.element!.id]: true,
                  },
                },
                this.scene.getNonDeletedElements(),
              ),
            );
          } else {
            this.setState({
              selectedElementIds: {},
              selectedGroupIds: {},
              editingGroupId: null,
            });
          }
        }
        // box-select line editor points
        if (this.state.editingLinearElement) {
          LinearElementEditor.handleBoxSelection(
            event,
            this.state,
            this.setState.bind(this),
          );
          // regular box-select
        } else {
          const elementsWithinSelection = getElementsWithinSelection(
            elements,
            draggingElement,
          );
          this.setState((prevState) =>
            selectGroupsForSelectedElements(
              {
                ...prevState,
                selectedElementIds: {
                  ...prevState.selectedElementIds,
                  ...elementsWithinSelection.reduce((map, element) => {
                    map[element.id] = true;
                    return map;
                  }, {} as any),
                  ...(pointerDownState.hit.element
                    ? {
                        // if using ctrl/cmd, select the hitElement only if we
                        // haven't box-selected anything else
                        [pointerDownState.hit.element.id]:
                          !elementsWithinSelection.length,
                      }
                    : null),
                },
                showHyperlinkPopup:
                  elementsWithinSelection.length === 1 &&
                  elementsWithinSelection[0].link
                    ? "info"
                    : false,
              },
              this.scene.getNonDeletedElements(),
            ),
          );
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
      this.setState({
        scrollX: this.state.scrollX - dx / this.state.zoom.value,
      });
      pointerDownState.lastCoords.x = x;
      return true;
    }

    if (pointerDownState.scrollbars.isOverVertical) {
      const y = event.clientY;
      const dy = y - pointerDownState.lastCoords.y;
      this.setState({
        scrollY: this.state.scrollY - dy / this.state.zoom.value,
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
      const {
        draggingElement,
        resizingElement,
        multiElement,
        activeTool,
        isResizing,
        isRotating,
      } = this.state;
      this.setState({
        isResizing: false,
        isRotating: false,
        resizingElement: null,
        selectionElement: null,
        cursorButton: "up",
        // text elements are reset on finalize, and resetting on pointerup
        // may cause issues with double taps
        editingElement:
          multiElement || isTextElement(this.state.editingElement)
            ? this.state.editingElement
            : null,
      });

      this.savePointer(childEvent.clientX, childEvent.clientY, "up");

      // Handle end of dragging a point of a linear element, might close a loop
      // and sets binding element
      if (this.state.editingLinearElement) {
        if (
          !pointerDownState.boxSelection.hasOccurred &&
          (pointerDownState.hit?.element?.id !==
            this.state.editingLinearElement.elementId ||
            !pointerDownState.hit.hasHitElementInside)
        ) {
          this.actionManager.executeAction(actionFinalize);
        } else {
          const editingLinearElement = LinearElementEditor.handlePointerUp(
            childEvent,
            this.state.editingLinearElement,
            this.state,
          );
          if (editingLinearElement !== this.state.editingLinearElement) {
            this.setState({
              editingLinearElement,
              suggestedBindings: [],
            });
          }
        }
      }

      lastPointerUp = null;

      if (pointerDownState.eventListeners.onMove) {
        pointerDownState.eventListeners.onMove.flush();
      }

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

      if (this.state.pendingImageElementId) {
        this.setState({ pendingImageElementId: null });
      }

      if (draggingElement?.type === "freedraw") {
        const pointerCoords = viewportCoordsToSceneCoords(
          childEvent,
          this.state,
        );

        const points = draggingElement.points;
        let dx = pointerCoords.x - draggingElement.x;
        let dy = pointerCoords.y - draggingElement.y;

        // Allows dots to avoid being flagged as infinitely small
        if (dx === points[0][0] && dy === points[0][1]) {
          dy += 0.0001;
          dx += 0.0001;
        }

        const pressures = draggingElement.simulatePressure
          ? []
          : [...draggingElement.pressures, childEvent.pressure];

        mutateElement(draggingElement, {
          points: [...points, [dx, dy]],
          pressures,
          lastCommittedPoint: [dx, dy],
        });

        this.actionManager.executeAction(actionFinalize);

        return;
      }
      if (isImageElement(draggingElement)) {
        const imageElement = draggingElement;
        try {
          this.initializeImageDimensions(imageElement);
          this.setState(
            { selectedElementIds: { [imageElement.id]: true } },
            () => {
              this.actionManager.executeAction(actionFinalize);
            },
          );
        } catch (error: any) {
          console.error(error);
          this.scene.replaceAllElements(
            this.scene
              .getElementsIncludingDeleted()
              .filter((el) => el.id !== imageElement.id),
          );
          this.actionManager.executeAction(actionFinalize);
        }
        return;
      }

      if (isLinearElement(draggingElement)) {
        if (draggingElement!.points.length > 1) {
          this.history.resumeRecording();
        }
        const pointerCoords = viewportCoordsToSceneCoords(
          childEvent,
          this.state,
        );

        if (
          !pointerDownState.drag.hasOccurred &&
          draggingElement &&
          !multiElement
        ) {
          mutateElement(draggingElement, {
            points: [
              ...draggingElement.points,
              [
                pointerCoords.x - draggingElement.x,
                pointerCoords.y - draggingElement.y,
              ],
            ],
          });
          this.setState({
            multiElement: draggingElement,
            editingElement: this.state.draggingElement,
          });
        } else if (pointerDownState.drag.hasOccurred && !multiElement) {
          if (
            isBindingEnabled(this.state) &&
            isBindingElement(draggingElement, false)
          ) {
            maybeBindLinearElement(
              draggingElement,
              this.state,
              this.scene,
              pointerCoords,
            );
          }
          this.setState({ suggestedBindings: [], startBoundElement: null });
          if (!activeTool.locked) {
            resetCursor(this.canvas);
            this.setState((prevState) => ({
              draggingElement: null,
              activeTool: updateActiveTool(this.state, {
                type: "selection",
              }),
              selectedElementIds: {
                ...prevState.selectedElementIds,
                [draggingElement.id]: true,
              },
            }));
          } else {
            this.setState((prevState) => ({
              draggingElement: null,
              selectedElementIds: {
                ...prevState.selectedElementIds,
                [draggingElement.id]: true,
              },
            }));
          }
        }
        return;
      }

      if (
        activeTool.type !== "selection" &&
        draggingElement &&
        isInvisiblySmallElement(draggingElement)
      ) {
        // remove invisible element which was added in onPointerDown
        this.scene.replaceAllElements(
          this.scene.getElementsIncludingDeleted().slice(0, -1),
        );
        this.setState({
          draggingElement: null,
        });
        return;
      }

      if (draggingElement) {
        mutateElement(
          draggingElement,
          getNormalizedDimensions(draggingElement),
        );
      }

      if (resizingElement) {
        this.history.resumeRecording();
      }

      if (resizingElement && isInvisiblySmallElement(resizingElement)) {
        this.scene.replaceAllElements(
          this.scene
            .getElementsIncludingDeleted()
            .filter((el) => el.id !== resizingElement.id),
        );
      }

      // Code below handles selection when element(s) weren't
      // drag or added to selection on pointer down phase.
      const hitElement = pointerDownState.hit.element;
      if (isEraserActive(this.state)) {
        const draggedDistance = distance2d(
          this.lastPointerDown!.clientX,
          this.lastPointerDown!.clientY,
          this.lastPointerUp!.clientX,
          this.lastPointerUp!.clientY,
        );

        if (draggedDistance === 0) {
          const scenePointer = viewportCoordsToSceneCoords(
            {
              clientX: this.lastPointerUp!.clientX,
              clientY: this.lastPointerUp!.clientY,
            },
            this.state,
          );
          const hitElements = this.getElementsAtPosition(
            scenePointer.x,
            scenePointer.y,
          );
          hitElements.forEach(
            (hitElement) =>
              (pointerDownState.elementIdsToErase[hitElement.id] = {
                erase: true,
                opacity: hitElement.opacity,
              }),
          );
        }
        this.eraseElements(pointerDownState);
        return;
      } else if (Object.keys(pointerDownState.elementIdsToErase).length) {
        this.restoreReadyToEraseElements(pointerDownState);
      }

      if (
        hitElement &&
        !pointerDownState.drag.hasOccurred &&
        !pointerDownState.hit.wasAddedToSelection &&
        // if we're editing a line, pointerup shouldn't switch selection if
        // box selected
        (!this.state.editingLinearElement ||
          !pointerDownState.boxSelection.hasOccurred)
      ) {
        // when inside line editor, shift selects points instead
        if (childEvent.shiftKey && !this.state.editingLinearElement) {
          if (this.state.selectedElementIds[hitElement.id]) {
            if (isSelectedViaGroup(this.state, hitElement)) {
              // We want to unselect all groups hitElement is part of
              // as well as all elements that are part of the groups
              // hitElement is part of
              const idsOfSelectedElementsThatAreInGroups = hitElement.groupIds
                .flatMap((groupId) =>
                  getElementsInGroup(
                    this.scene.getNonDeletedElements(),
                    groupId,
                  ),
                )
                .map((element) => ({ [element.id]: false }))
                .reduce((prevId, acc) => ({ ...prevId, ...acc }), {});

              this.setState((_prevState) => ({
                selectedGroupIds: {
                  ..._prevState.selectedElementIds,
                  ...hitElement.groupIds
                    .map((gId) => ({ [gId]: false }))
                    .reduce((prev, acc) => ({ ...prev, ...acc }), {}),
                },
                selectedElementIds: {
                  ..._prevState.selectedElementIds,
                  ...idsOfSelectedElementsThatAreInGroups,
                },
              }));
            } else {
              // remove element from selection while
              // keeping prev elements selected
              this.setState((prevState) =>
                selectGroupsForSelectedElements(
                  {
                    ...prevState,
                    selectedElementIds: {
                      ...prevState.selectedElementIds,
                      [hitElement!.id]: false,
                    },
                  },
                  this.scene.getNonDeletedElements(),
                ),
              );
            }
          } else {
            // add element to selection while
            // keeping prev elements selected

            this.setState((_prevState) => ({
              selectedElementIds: {
                ..._prevState.selectedElementIds,
                [hitElement!.id]: true,
              },
            }));
          }
        } else {
          this.setState((prevState) => ({
            ...selectGroupsForSelectedElements(
              {
                ...prevState,
                selectedElementIds: { [hitElement.id]: true },
              },
              this.scene.getNonDeletedElements(),
            ),
          }));
        }
      }

      if (
        !this.state.editingLinearElement &&
        !pointerDownState.drag.hasOccurred &&
        !this.state.isResizing &&
        ((hitElement &&
          isHittingElementBoundingBoxWithoutHittingElement(
            hitElement,
            this.state,
            pointerDownState.origin.x,
            pointerDownState.origin.y,
          )) ||
          (!hitElement &&
            pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements))
      ) {
        // Deselect selected elements
        this.setState({
          selectedElementIds: {},
          selectedGroupIds: {},
          editingGroupId: null,
        });

        return;
      }

      if (
        !activeTool.locked &&
        activeTool.type !== "freedraw" &&
        draggingElement
      ) {
        this.setState((prevState) => ({
          selectedElementIds: {
            ...prevState.selectedElementIds,
            [draggingElement.id]: true,
          },
        }));
      }

      if (
        activeTool.type !== "selection" ||
        isSomeElementSelected(this.scene.getNonDeletedElements(), this.state)
      ) {
        this.history.resumeRecording();
      }

      if (pointerDownState.drag.hasOccurred || isResizing || isRotating) {
        (isBindingEnabled(this.state)
          ? bindOrUnbindSelectedElements
          : unbindLinearElements)(
          getSelectedElements(this.scene.getNonDeletedElements(), this.state),
        );
      }

      if (!activeTool.locked && activeTool.type !== "freedraw") {
        resetCursor(this.canvas);
        this.setState({
          draggingElement: null,
          suggestedBindings: [],
          activeTool: updateActiveTool(this.state, { type: "selection" }),
        });
      } else {
        this.setState({
          draggingElement: null,
          suggestedBindings: [],
        });
      }
    });
  }

  private restoreReadyToEraseElements = (
    pointerDownState: PointerDownState,
  ) => {
    const elements = this.scene.getElementsIncludingDeleted().map((ele) => {
      if (
        pointerDownState.elementIdsToErase[ele.id] &&
        pointerDownState.elementIdsToErase[ele.id].erase
      ) {
        return newElementWith(ele, {
          opacity: pointerDownState.elementIdsToErase[ele.id].opacity,
        });
      } else if (
        isBoundToContainer(ele) &&
        pointerDownState.elementIdsToErase[ele.containerId] &&
        pointerDownState.elementIdsToErase[ele.containerId].erase
      ) {
        return newElementWith(ele, {
          opacity: pointerDownState.elementIdsToErase[ele.containerId].opacity,
        });
      }
      return ele;
    });

    this.scene.replaceAllElements(elements);
  };

  private eraseElements = (pointerDownState: PointerDownState) => {
    const elements = this.scene.getElementsIncludingDeleted().map((ele) => {
      if (
        pointerDownState.elementIdsToErase[ele.id] &&
        pointerDownState.elementIdsToErase[ele.id].erase
      ) {
        return newElementWith(ele, { isDeleted: true });
      } else if (
        isBoundToContainer(ele) &&
        pointerDownState.elementIdsToErase[ele.containerId] &&
        pointerDownState.elementIdsToErase[ele.containerId].erase
      ) {
        return newElementWith(ele, { isDeleted: true });
      }
      return ele;
    });

    this.history.resumeRecording();
    this.scene.replaceAllElements(elements);
  };

  private initializeImage = async ({
    imageFile,
    imageElement: _imageElement,
    showCursorImagePreview = false,
  }: {
    imageFile: File;
    imageElement: ExcalidrawImageElement;
    showCursorImagePreview?: boolean;
  }) => {
    // at this point this should be guaranteed image file, but we do this check
    // to satisfy TS down the line
    if (!isSupportedImageFile(imageFile)) {
      throw new Error(t("errors.unsupportedFileType"));
    }
    const mimeType = imageFile.type;

    setCursor(this.canvas, "wait");

    if (mimeType === MIME_TYPES.svg) {
      try {
        imageFile = SVGStringToFile(
          await normalizeSVG(await imageFile.text()),
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
        console.error("error trying to resing image file on insertion", error);
      }

      if (imageFile.size > MAX_ALLOWED_FILE_BYTES) {
        throw new Error(
          t("errors.fileTooBig", {
            maxSize: `${Math.trunc(MAX_ALLOWED_FILE_BYTES / 1024 / 1024)}MB`,
          }),
        );
      }
    }

    if (showCursorImagePreview) {
      const dataURL = this.files[fileId]?.dataURL;
      // optimization so that we don't unnecessarily resize the original
      // full-size file for cursor preview
      // (it's much faster to convert the resized dataURL to File)
      const resizedFile = dataURL && dataURLToFile(dataURL);

      this.setImagePreviewCursor(resizedFile || imageFile);
    }

    const dataURL =
      this.files[fileId]?.dataURL || (await getDataURL(imageFile));

    const imageElement = mutateElement(
      _imageElement,
      {
        fileId,
      },
      false,
    ) as NonDeleted<InitializedExcalidrawImageElement>;

    return new Promise<NonDeleted<InitializedExcalidrawImageElement>>(
      async (resolve, reject) => {
        try {
          this.files = {
            ...this.files,
            [fileId]: {
              mimeType,
              id: fileId,
              dataURL,
              created: Date.now(),
            },
          };
          const cachedImageData = this.imageCache.get(fileId);
          if (!cachedImageData) {
            this.addNewImagesToImageCache();
            await this.updateImageCache([imageElement]);
          }
          if (cachedImageData?.image instanceof Promise) {
            await cachedImageData.image;
          }
          if (
            this.state.pendingImageElementId !== imageElement.id &&
            this.state.draggingElement?.id !== imageElement.id
          ) {
            this.initializeImageDimensions(imageElement, true);
          }
          resolve(imageElement);
        } catch (error: any) {
          console.error(error);
          reject(new Error(t("errors.imageInsertError")));
        } finally {
          if (!showCursorImagePreview) {
            resetCursor(this.canvas);
          }
        }
      },
    );
  };

  /**
   * inserts image into elements array and rerenders
   */
  private insertImageElement = async (
    imageElement: ExcalidrawImageElement,
    imageFile: File,
    showCursorImagePreview?: boolean,
  ) => {
    this.scene.replaceAllElements([
      ...this.scene.getElementsIncludingDeleted(),
      imageElement,
    ]);

    try {
      await this.initializeImage({
        imageFile,
        imageElement,
        showCursorImagePreview,
      });
    } catch (error: any) {
      mutateElement(imageElement, {
        isDeleted: true,
      });
      this.actionManager.executeAction(actionFinalize);
      this.setState({
        errorMessage: error.message || t("errors.imageInsertError"),
      });
    }
  };

  private setImagePreviewCursor = async (imageFile: File) => {
    // mustn't be larger than 128 px
    // https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Basic_User_Interface/Using_URL_values_for_the_cursor_property
    const cursorImageSizePx = 96;

    const imagePreview = await resizeImageFile(imageFile, {
      maxWidthOrHeight: cursorImageSizePx,
    });

    let previewDataURL = await getDataURL(imagePreview);

    // SVG cannot be resized via `resizeImageFile` so we resize by rendering to
    // a small canvas
    if (imageFile.type === MIME_TYPES.svg) {
      const img = await loadHTMLImageElement(previewDataURL);

      let height = Math.min(img.height, cursorImageSizePx);
      let width = height * (img.width / img.height);

      if (width > cursorImageSizePx) {
        width = cursorImageSizePx;
        height = width * (img.height / img.width);
      }

      const canvas = document.createElement("canvas");
      canvas.height = height;
      canvas.width = width;
      const context = canvas.getContext("2d")!;

      context.drawImage(img, 0, 0, width, height);

      previewDataURL = canvas.toDataURL(MIME_TYPES.svg) as DataURL;
    }

    if (this.state.pendingImageElementId) {
      setCursor(this.canvas, `url(${previewDataURL}) 4 4, auto`);
    }
  };

  private onImageAction = async (
    { insertOnCanvasDirectly } = { insertOnCanvasDirectly: false },
  ) => {
    try {
      const clientX = this.state.width / 2 + this.state.offsetLeft;
      const clientY = this.state.height / 2 + this.state.offsetTop;

      const { x, y } = viewportCoordsToSceneCoords(
        { clientX, clientY },
        this.state,
      );

      const imageFile = await fileOpen({
        description: "Image",
        extensions: ["jpg", "png", "svg", "gif"],
      });

      const imageElement = this.createImageElement({
        sceneX: x,
        sceneY: y,
      });

      if (insertOnCanvasDirectly) {
        this.insertImageElement(imageElement, imageFile);
        this.initializeImageDimensions(imageElement);
        this.setState(
          {
            selectedElementIds: { [imageElement.id]: true },
          },
          () => {
            this.actionManager.executeAction(actionFinalize);
          },
        );
      } else {
        this.setState(
          {
            pendingImageElementId: imageElement.id,
          },
          () => {
            this.insertImageElement(
              imageElement,
              imageFile,
              /* showCursorImagePreview */ true,
            );
          },
        );
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error(error);
      } else {
        console.warn(error);
      }
      this.setState(
        {
          pendingImageElementId: null,
          editingElement: null,
          activeTool: updateActiveTool(this.state, { type: "selection" }),
        },
        () => {
          this.actionManager.executeAction(actionFinalize);
        },
      );
    }
  };

  private initializeImageDimensions = (
    imageElement: ExcalidrawImageElement,
    forceNaturalSize = false,
  ) => {
    const image =
      isInitializedImageElement(imageElement) &&
      this.imageCache.get(imageElement.fileId)?.image;

    if (!image || image instanceof Promise) {
      if (
        imageElement.width < DRAGGING_THRESHOLD / this.state.zoom.value &&
        imageElement.height < DRAGGING_THRESHOLD / this.state.zoom.value
      ) {
        const placeholderSize = 100 / this.state.zoom.value;
        mutateElement(imageElement, {
          x: imageElement.x - placeholderSize / 2,
          y: imageElement.y - placeholderSize / 2,
          width: placeholderSize,
          height: placeholderSize,
        });
      }

      return;
    }

    if (
      forceNaturalSize ||
      // if user-created bounding box is below threshold, assume the
      // intention was to click instead of drag, and use the image's
      // intrinsic size
      (imageElement.width < DRAGGING_THRESHOLD / this.state.zoom.value &&
        imageElement.height < DRAGGING_THRESHOLD / this.state.zoom.value)
    ) {
      const minHeight = Math.max(this.state.height - 120, 160);
      // max 65% of canvas height, clamped to <300px, vh - 120px>
      const maxHeight = Math.min(
        minHeight,
        Math.floor(this.state.height * 0.5) / this.state.zoom.value,
      );

      const height = Math.min(image.naturalHeight, maxHeight);
      const width = height * (image.naturalWidth / image.naturalHeight);

      // add current imageElement width/height to account for previous centering
      // of the placeholder image
      const x = imageElement.x + imageElement.width / 2 - width / 2;
      const y = imageElement.y + imageElement.height / 2 - height / 2;

      mutateElement(imageElement, { x, y, width, height });
    }
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
    if (updatedFiles.size || erroredFiles.size) {
      for (const element of elements) {
        if (updatedFiles.has(element.fileId)) {
          invalidateShapeForElement(element);
        }
      }
    }
    if (erroredFiles.size) {
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
        this.scene.informMutation();
      }
    }
  };

  /** generally you should use `addNewImagesToImageCache()` directly if you need
   *  to render new images. This is just a failsafe  */
  private scheduleImageRefresh = throttle(() => {
    this.addNewImagesToImageCache();
  }, IMAGE_RENDER_TIMEOUT);

  private updateBindingEnabledOnPointerMove = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    const shouldEnableBinding = shouldEnableBindingForPointerEvent(event);
    if (this.state.isBindingEnabled !== shouldEnableBinding) {
      this.setState({ isBindingEnabled: shouldEnableBinding });
    }
  };

  private maybeSuggestBindingAtCursor = (pointerCoords: {
    x: number;
    y: number;
  }): void => {
    const hoveredBindableElement = getHoveredElementForBinding(
      pointerCoords,
      this.scene,
    );
    this.setState({
      suggestedBindings:
        hoveredBindableElement != null ? [hoveredBindableElement] : [],
    });
  };

  private maybeSuggestBindingsForLinearElementAtCoords = (
    linearElement: NonDeleted<ExcalidrawLinearElement>,
    /** scene coords */
    pointerCoords: {
      x: number;
      y: number;
    }[],
    // During line creation the start binding hasn't been written yet
    // into `linearElement`
    oppositeBindingBoundElement?: ExcalidrawBindableElement | null,
  ): void => {
    if (!pointerCoords.length) {
      return;
    }

    const suggestedBindings = pointerCoords.reduce(
      (acc: NonDeleted<ExcalidrawBindableElement>[], coords) => {
        const hoveredBindableElement = getHoveredElementForBinding(
          coords,
          this.scene,
        );
        if (
          hoveredBindableElement != null &&
          !isLinearElementSimpleAndAlreadyBound(
            linearElement,
            oppositeBindingBoundElement?.id,
            hoveredBindableElement,
          )
        ) {
          acc.push(hoveredBindableElement);
        }
        return acc;
      },
      [],
    );

    this.setState({ suggestedBindings });
  };

  private maybeSuggestBindingForAll(
    selectedElements: NonDeleted<ExcalidrawElement>[],
  ): void {
    const suggestedBindings = getEligibleElementsForBinding(selectedElements);
    this.setState({ suggestedBindings });
  }

  private clearSelection(hitElement: ExcalidrawElement | null): void {
    this.setState((prevState) => ({
      selectedElementIds: {},
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
      selectedElementIds: {},
      previousSelectedElementIds: this.state.selectedElementIds,
    });
  }

  private handleCanvasRef = (canvas: HTMLCanvasElement) => {
    // canvas is null when unmounting
    if (canvas !== null) {
      this.canvas = canvas;
      this.rc = rough.canvas(this.canvas);

      this.canvas.addEventListener(EVENT.WHEEL, this.handleWheel, {
        passive: false,
      });
      this.canvas.addEventListener(EVENT.TOUCH_START, this.onTapStart);
      this.canvas.addEventListener(EVENT.TOUCH_END, this.onTapEnd);
    } else {
      this.canvas?.removeEventListener(EVENT.WHEEL, this.handleWheel);
      this.canvas?.removeEventListener(EVENT.TOUCH_START, this.onTapStart);
      this.canvas?.removeEventListener(EVENT.TOUCH_END, this.onTapEnd);
    }
  };

  private handleAppOnDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    // must be retrieved first, in the same frame
    const { file, fileHandle } = await getFileFromEvent(event);

    try {
      if (isSupportedImageFile(file)) {
        // first attempt to decode scene from the image if it's embedded
        // ---------------------------------------------------------------------

        if (file?.type === MIME_TYPES.png || file?.type === MIME_TYPES.svg) {
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
              commitToHistory: true,
            });
            return;
          } catch (error: any) {
            if (error.name !== "EncodingError") {
              throw error;
            }
          }
        }

        // if no scene is embedded or we fail for whatever reason, fall back
        // to importing as regular image
        // ---------------------------------------------------------------------

        const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
          event,
          this.state,
        );

        const imageElement = this.createImageElement({ sceneX, sceneY });
        this.insertImageElement(imageElement, file);
        this.initializeImageDimensions(imageElement);
        this.setState({ selectedElementIds: { [imageElement.id]: true } });

        return;
      }
    } catch (error: any) {
      return this.setState({
        isLoading: false,
        errorMessage: error.message,
      });
    }

    const libraryJSON = event.dataTransfer.getData(MIME_TYPES.excalidrawlib);
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

    if (file) {
      // atetmpt to parse an excalidraw/excalidrawlib file
      await this.loadFileToCanvas(file, fileHandle);
    }
  };

  loadFileToCanvas = async (
    file: File,
    fileHandle: FileSystemHandle | null,
  ) => {
    file = await normalizeFile(file);
    try {
      const ret = await loadSceneOrLibraryFromBlob(
        file,
        this.state,
        this.scene.getElementsIncludingDeleted(),
        fileHandle,
      );
      if (ret.type === MIME_TYPES.excalidraw) {
        this.setState({ isLoading: true });
        this.syncActionResult({
          ...ret.data,
          appState: {
            ...(ret.data.appState || this.state),
            isLoading: false,
          },
          replaceFiles: true,
          commitToHistory: true,
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
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    event.preventDefault();

    if (
      (event.nativeEvent.pointerType === "touch" ||
        (event.nativeEvent.pointerType === "pen" &&
          // always allow if user uses a pen secondary button
          event.button !== POINTER_BUTTON.SECONDARY)) &&
      this.state.activeTool.type !== "selection"
    ) {
      return;
    }

    const { x, y } = viewportCoordsToSceneCoords(event, this.state);
    const element = this.getElementAtPosition(x, y, {
      preferSelected: true,
      includeLockedElements: true,
    });

    const type = element ? "element" : "canvas";

    const container = this.excalidrawContainerRef.current!;
    const { top: offsetTop, left: offsetLeft } =
      container.getBoundingClientRect();
    const left = event.clientX - offsetLeft;
    const top = event.clientY - offsetTop;

    if (element && !this.state.selectedElementIds[element.id]) {
      this.setState(
        selectGroupsForSelectedElements(
          {
            ...this.state,
            selectedElementIds: { [element.id]: true },
          },
          this.scene.getNonDeletedElements(),
        ),
        () => {
          this._openContextMenu({ top, left }, type);
        },
      );
    } else {
      this._openContextMenu({ top, left }, type);
    }
  };

  private maybeDragNewGenericElement = (
    pointerDownState: PointerDownState,
    event: MouseEvent | KeyboardEvent,
  ): void => {
    const draggingElement = this.state.draggingElement;
    const pointerCoords = pointerDownState.lastCoords;
    if (!draggingElement) {
      return;
    }
    if (
      draggingElement.type === "selection" &&
      this.state.activeTool.type !== "eraser"
    ) {
      dragNewElement(
        draggingElement,
        this.state.activeTool.type,
        pointerDownState.origin.x,
        pointerDownState.origin.y,
        pointerCoords.x,
        pointerCoords.y,
        distance(pointerDownState.origin.x, pointerCoords.x),
        distance(pointerDownState.origin.y, pointerCoords.y),
        shouldMaintainAspectRatio(event),
        shouldResizeFromCenter(event),
      );
    } else {
      const [gridX, gridY] = getGridPoint(
        pointerCoords.x,
        pointerCoords.y,
        this.state.gridSize,
      );

      const image =
        isInitializedImageElement(draggingElement) &&
        this.imageCache.get(draggingElement.fileId)?.image;
      const aspectRatio =
        image && !(image instanceof Promise)
          ? image.width / image.height
          : null;

      dragNewElement(
        draggingElement,
        this.state.activeTool.type,
        pointerDownState.originInGrid.x,
        pointerDownState.originInGrid.y,
        gridX,
        gridY,
        distance(pointerDownState.originInGrid.x, gridX),
        distance(pointerDownState.originInGrid.y, gridY),
        isImageElement(draggingElement)
          ? !shouldMaintainAspectRatio(event)
          : shouldMaintainAspectRatio(event),
        shouldResizeFromCenter(event),
        aspectRatio,
      );

      this.maybeSuggestBindingForAll([draggingElement]);
    }
  };

  private maybeHandleResize = (
    pointerDownState: PointerDownState,
    event: MouseEvent | KeyboardEvent,
  ): boolean => {
    const selectedElements = getSelectedElements(
      this.scene.getNonDeletedElements(),
      this.state,
    );
    const transformHandleType = pointerDownState.resize.handleType;
    this.setState({
      // TODO: rename this state field to "isScaling" to distinguish
      // it from the generic "isResizing" which includes scaling and
      // rotating
      isResizing: transformHandleType && transformHandleType !== "rotation",
      isRotating: transformHandleType === "rotation",
    });
    const pointerCoords = pointerDownState.lastCoords;
    const [resizeX, resizeY] = getGridPoint(
      pointerCoords.x - pointerDownState.resize.offset.x,
      pointerCoords.y - pointerDownState.resize.offset.y,
      this.state.gridSize,
    );
    if (
      transformElements(
        pointerDownState,
        transformHandleType,
        selectedElements,
        pointerDownState.resize.arrowDirection,
        shouldRotateWithDiscreteAngle(event),
        shouldResizeFromCenter(event),
        selectedElements.length === 1 && isImageElement(selectedElements[0])
          ? !shouldMaintainAspectRatio(event)
          : shouldMaintainAspectRatio(event),
        resizeX,
        resizeY,
        pointerDownState.resize.center.x,
        pointerDownState.resize.center.y,
      )
    ) {
      this.maybeSuggestBindingForAll(selectedElements);
      return true;
    }
    return false;
  };

  /** @private use this.handleCanvasContextMenu */
  private _openContextMenu = (
    {
      left,
      top,
    }: {
      left: number;
      top: number;
    },
    type: "canvas" | "element",
  ) => {
    if (this.state.showHyperlinkPopup) {
      this.setState({ showHyperlinkPopup: false });
    }
    this.contextMenuOpen = true;
    const maybeGroupAction = actionGroup.contextItemPredicate!(
      this.actionManager.getElementsIncludingDeleted(),
      this.actionManager.getAppState(),
    );

    const maybeUngroupAction = actionUngroup.contextItemPredicate!(
      this.actionManager.getElementsIncludingDeleted(),
      this.actionManager.getAppState(),
    );

    const maybeFlipHorizontal = actionFlipHorizontal.contextItemPredicate!(
      this.actionManager.getElementsIncludingDeleted(),
      this.actionManager.getAppState(),
    );

    const maybeFlipVertical = actionFlipVertical.contextItemPredicate!(
      this.actionManager.getElementsIncludingDeleted(),
      this.actionManager.getAppState(),
    );

    const mayBeAllowUnbinding = actionUnbindText.contextItemPredicate(
      this.actionManager.getElementsIncludingDeleted(),
      this.actionManager.getAppState(),
    );

    const mayBeAllowBinding = actionBindText.contextItemPredicate(
      this.actionManager.getElementsIncludingDeleted(),
      this.actionManager.getAppState(),
    );

    const separator = "separator";

    const elements = this.scene.getNonDeletedElements();

    const selectedElements = getSelectedElements(
      this.scene.getNonDeletedElements(),
      this.state,
    );

    const options: ContextMenuOption[] = [];
    if (probablySupportsClipboardBlob && elements.length > 0) {
      options.push(actionCopyAsPng);
    }

    if (probablySupportsClipboardWriteText && elements.length > 0) {
      options.push(actionCopyAsSvg);
    }

    if (
      type === "element" &&
      copyText.contextItemPredicate(elements, this.state) &&
      probablySupportsClipboardWriteText
    ) {
      options.push(copyText);
    }
    if (type === "canvas") {
      const viewModeOptions = [
        ...options,
        typeof this.props.gridModeEnabled === "undefined" &&
          actionToggleGridMode,
        typeof this.props.zenModeEnabled === "undefined" && actionToggleZenMode,
        typeof this.props.viewModeEnabled === "undefined" &&
          actionToggleViewMode,
        actionToggleStats,
      ];

      if (this.state.viewModeEnabled) {
        ContextMenu.push({
          options: viewModeOptions,
          top,
          left,
          actionManager: this.actionManager,
          appState: this.state,
          container: this.excalidrawContainerRef.current!,
          elements,
        });
      } else {
        ContextMenu.push({
          options: [
            this.device.isMobile &&
              navigator.clipboard && {
                trackEvent: false,
                name: "paste",
                perform: (elements, appStates) => {
                  this.pasteFromClipboard(null);
                  return {
                    commitToHistory: false,
                  };
                },
                contextItemLabel: "labels.paste",
              },
            this.device.isMobile && navigator.clipboard && separator,
            probablySupportsClipboardBlob &&
              elements.length > 0 &&
              actionCopyAsPng,
            probablySupportsClipboardWriteText &&
              elements.length > 0 &&
              actionCopyAsSvg,
            probablySupportsClipboardWriteText &&
              selectedElements.length > 0 &&
              copyText,
            ((probablySupportsClipboardBlob && elements.length > 0) ||
              (probablySupportsClipboardWriteText && elements.length > 0)) &&
              separator,
            actionSelectAll,
            separator,
            typeof this.props.gridModeEnabled === "undefined" &&
              actionToggleGridMode,
            typeof this.props.zenModeEnabled === "undefined" &&
              actionToggleZenMode,
            typeof this.props.viewModeEnabled === "undefined" &&
              actionToggleViewMode,
            actionToggleStats,
          ],
          top,
          left,
          actionManager: this.actionManager,
          appState: this.state,
          container: this.excalidrawContainerRef.current!,
          elements,
        });
      }
    } else if (type === "element") {
      if (this.state.viewModeEnabled) {
        ContextMenu.push({
          options: [navigator.clipboard && actionCopy, ...options],
          top,
          left,
          actionManager: this.actionManager,
          appState: this.state,
          container: this.excalidrawContainerRef.current!,
          elements,
        });
      } else {
        ContextMenu.push({
          options: [
            this.device.isMobile && actionCut,
            this.device.isMobile && navigator.clipboard && actionCopy,
            this.device.isMobile &&
              navigator.clipboard && {
                name: "paste",
                trackEvent: false,
                perform: (elements, appStates) => {
                  this.pasteFromClipboard(null);
                  return {
                    commitToHistory: false,
                  };
                },
                contextItemLabel: "labels.paste",
              },
            this.device.isMobile && separator,
            ...options,
            separator,
            actionCopyStyles,
            actionPasteStyles,
            separator,
            maybeGroupAction && actionGroup,
            mayBeAllowUnbinding && actionUnbindText,
            mayBeAllowBinding && actionBindText,
            maybeUngroupAction && actionUngroup,
            (maybeGroupAction || maybeUngroupAction) && separator,
            actionAddToLibrary,
            separator,
            actionSendBackward,
            actionBringForward,
            actionSendToBack,
            actionBringToFront,
            separator,
            maybeFlipHorizontal && actionFlipHorizontal,
            maybeFlipVertical && actionFlipVertical,
            (maybeFlipHorizontal || maybeFlipVertical) && separator,
            actionLink.contextItemPredicate(elements, this.state) && actionLink,
            actionDuplicateSelection,
            actionToggleLock,
            separator,
            actionDeleteSelected,
          ],
          top,
          left,
          actionManager: this.actionManager,
          appState: this.state,
          container: this.excalidrawContainerRef.current!,
          elements,
        });
      }
    }
  };

  private handleWheel = withBatchedUpdates((event: WheelEvent) => {
    event.preventDefault();

    if (isPanning) {
      return;
    }

    const { deltaX, deltaY } = event;
    // note that event.ctrlKey is necessary to handle pinch zooming
    if (event.metaKey || event.ctrlKey) {
      const sign = Math.sign(deltaY);
      const MAX_STEP = 10;
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

      this.setState((state) => ({
        ...getStateForZoom(
          {
            viewportX: cursorX,
            viewportY: cursorY,
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
      this.setState(({ zoom, scrollX }) => ({
        // on Mac, shift+wheel tends to result in deltaX
        scrollX: scrollX - (deltaY || deltaX) / zoom.value,
      }));
      return;
    }

    this.setState(({ zoom, scrollX, scrollY }) => ({
      scrollX: scrollX - deltaX / zoom.value,
      scrollY: scrollY - deltaY / zoom.value,
    }));
  });

  private getTextWysiwygSnappedToCenterPosition(
    x: number,
    y: number,
    appState: AppState,
    canvas: HTMLCanvasElement | null,
    scale: number,
  ) {
    const elementClickedInside = getTextBindableContainerAtPosition(
      this.scene
        .getElementsIncludingDeleted()
        .filter((element) => !isTextElement(element)),
      x,
      y,
    );
    if (elementClickedInside) {
      const elementCenterX =
        elementClickedInside.x + elementClickedInside.width / 2;
      const elementCenterY =
        elementClickedInside.y + elementClickedInside.height / 2;
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
    const pointer = viewportCoordsToSceneCoords(
      { clientX: x, clientY: y },
      this.state,
    );

    if (isNaN(pointer.x) || isNaN(pointer.y)) {
      // sometimes the pointer goes off screen
    }

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
      elements: readonly ExcalidrawElement[];
      state: AppState;
      setState: React.Component<any, AppState>["setState"];
      app: InstanceType<typeof App>;
      history: History;
    };
  }
}

if (
  process.env.NODE_ENV === ENV.TEST ||
  process.env.NODE_ENV === ENV.DEVELOPMENT
) {
  window.h = window.h || ({} as Window["h"]);

  Object.defineProperties(window.h, {
    elements: {
      configurable: true,
      get() {
        return this.app?.scene.getElementsIncludingDeleted();
      },
      set(elements: ExcalidrawElement[]) {
        return this.app?.scene.replaceAllElements(elements);
      },
    },
  });
}
export default App;
