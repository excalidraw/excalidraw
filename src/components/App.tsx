import { Point, simplify } from "points-on-curve";
import React from "react";
import { RoughCanvas } from "roughjs/bin/canvas";
import rough from "roughjs/bin/rough";
import clsx from "clsx";

import {
  actionAddToLibrary,
  actionBringForward,
  actionBringToFront,
  actionCopy,
  actionCopyAsPng,
  actionCopyAsSvg,
  actionCopyStyles,
  actionCut,
  actionDeleteSelected,
  actionDuplicateSelection,
  actionFinalize,
  actionGroup,
  actionPasteStyles,
  actionSelectAll,
  actionSendBackward,
  actionSendToBack,
  actionToggleGridMode,
  actionToggleStats,
  actionToggleZenMode,
  actionUngroup,
} from "../actions";
import { createRedoAction, createUndoAction } from "../actions/actionHistory";
import { ActionManager } from "../actions/manager";
import { actions } from "../actions/register";
import { ActionResult } from "../actions/types";
import { trackEvent } from "../analytics";
import { getDefaultAppState } from "../appState";
import {
  copyToClipboard,
  parseClipboard,
  probablySupportsClipboardBlob,
  probablySupportsClipboardWriteText,
} from "../clipboard";
import {
  APP_NAME,
  CURSOR_TYPE,
  DEFAULT_VERTICAL_ALIGN,
  DRAGGING_THRESHOLD,
  ELEMENT_SHIFT_TRANSLATE_AMOUNT,
  ELEMENT_TRANSLATE_AMOUNT,
  ENV,
  EVENT,
  GRID_SIZE,
  LINE_CONFIRM_THRESHOLD,
  MIME_TYPES,
  POINTER_BUTTON,
  SCROLL_TIMEOUT,
  TAP_TWICE_TIMEOUT,
  TEXT_TO_CENTER_SNAP_THRESHOLD,
  TOUCH_CTX_MENU_TIMEOUT,
  ZOOM_STEP,
} from "../constants";
import { loadFromBlob } from "../data";
import { isValidLibrary } from "../data/json";
import { Library } from "../data/library";
import { restore } from "../data/restore";
import {
  dragNewElement,
  dragSelectedElements,
  duplicateElement,
  getCommonBounds,
  getCursorForResizingElement,
  getDragOffsetXY,
  getElementWithTransformHandleType,
  getNonDeletedElements,
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
import { mutateElement } from "../element/mutateElement";
import { deepCopyElement } from "../element/newElement";
import { MaybeTransformHandleType } from "../element/transformHandles";
import {
  isBindingElement,
  isBindingElementType,
  isLinearElement,
  isLinearElementType,
} from "../element/typeChecks";
import {
  ExcalidrawBindableElement,
  ExcalidrawElement,
  ExcalidrawGenericElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  NonDeleted,
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
import { createHistory, SceneHistory } from "../history";
import { defaultLang, getLanguage, languages, setLanguage, t } from "../i18n";
import {
  CODES,
  getResizeCenterPointKey,
  getResizeWithSidesSameLengthKey,
  getRotateWithDiscreteAngleKey,
  isArrowKey,
  KEYS,
} from "../keys";
import { distance2d, getGridPoint, isPathALoop } from "../math";
import { renderScene } from "../renderer";
import { invalidateShapeForElement } from "../renderer/renderElement";
import {
  calculateScrollCenter,
  getElementContainingPosition,
  getElementsAtPosition,
  getElementsWithinSelection,
  getNormalizedZoom,
  getSelectedElements,
  isOverScrollBars,
  isSomeElementSelected,
} from "../scene";
import Scene from "../scene/Scene";
import { SceneState, ScrollBars } from "../scene/types";
import { getNewZoom } from "../scene/zoom";
import { findShapeByKey } from "../shapes";
import {
  AppState,
  ExcalidrawProps,
  Gesture,
  GestureEvent,
  SceneData,
} from "../types";
import {
  debounce,
  distance,
  isInputLike,
  isToolIcon,
  isWritableElement,
  resetCursor,
  ResolvablePromise,
  resolvablePromise,
  sceneCoordsToViewportCoords,
  setCursor,
  setCursorForShape,
  tupleToCoors,
  viewportCoordsToSceneCoords,
  withBatchedUpdates,
} from "../utils";
import { isMobile } from "../is-mobile";
import ContextMenu, { ContextMenuOption } from "./ContextMenu";
import LayerUI from "./LayerUI";
import { Stats } from "./Stats";
import { Toast } from "./Toast";
import { actionToggleViewMode } from "../actions/actionToggleViewMode";

const { history } = createHistory();

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

export type PointerDownState = Readonly<{
  // The first position at which pointerDown happened
  origin: Readonly<{ x: number; y: number }>;
  // Same as "origin" but snapped to the grid, if grid is on
  originInGrid: Readonly<{ x: number; y: number }>;
  // Scrollbar checks
  scrollbars: ReturnType<typeof isOverScrollBars>;
  // The previous pointer position
  lastCoords: { x: number; y: number };
  // map of original elements data
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
  drag: {
    // Might change during the pointer interation
    hasOccurred: boolean;
    // Might change during the pointer interation
    offset: { x: number; y: number } | null;
  };
  // We need to have these in the state so that we can unsubscribe them
  eventListeners: {
    // It's defined on the initial pointer down event
    onMove: null | ((event: PointerEvent) => void);
    // It's defined on the initial pointer down event
    onUp: null | ((event: PointerEvent) => void);
    // It's defined on the initial pointer down event
    onKeyDown: null | ((event: KeyboardEvent) => void);
    // It's defined on the initial pointer down event
    onKeyUp: null | ((event: KeyboardEvent) => void);
  };
}>;

export type ExcalidrawImperativeAPI = {
  updateScene: InstanceType<typeof App>["updateScene"];
  resetScene: InstanceType<typeof App>["resetScene"];
  getSceneElementsIncludingDeleted: InstanceType<
    typeof App
  >["getSceneElementsIncludingDeleted"];
  history: {
    clear: InstanceType<typeof App>["resetHistory"];
  };
  setScrollToCenter: InstanceType<typeof App>["setScrollToCenter"];
  getSceneElements: InstanceType<typeof App>["getSceneElements"];
  getAppState: () => InstanceType<typeof App>["state"];
  readyPromise: ResolvablePromise<ExcalidrawImperativeAPI>;
  ready: true;
};

class App extends React.Component<ExcalidrawProps, AppState> {
  canvas: HTMLCanvasElement | null = null;
  rc: RoughCanvas | null = null;
  unmounted: boolean = false;
  actionManager: ActionManager;
  private excalidrawContainerRef = React.createRef<HTMLDivElement>();

  public static defaultProps: Partial<ExcalidrawProps> = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  private scene: Scene;
  constructor(props: ExcalidrawProps) {
    super(props);
    const defaultAppState = getDefaultAppState();

    const {
      width = window.innerWidth,
      height = window.innerHeight,
      offsetLeft,
      offsetTop,
      excalidrawRef,
      viewModeEnabled = false,
      zenModeEnabled = false,
      gridModeEnabled = false,
    } = props;
    this.state = {
      ...defaultAppState,
      isLoading: true,
      width,
      height,
      ...this.getCanvasOffsets({ offsetLeft, offsetTop }),
      viewModeEnabled,
      zenModeEnabled,
      gridSize: gridModeEnabled ? GRID_SIZE : null,
    };
    if (excalidrawRef) {
      const readyPromise =
        ("current" in excalidrawRef && excalidrawRef.current?.readyPromise) ||
        resolvablePromise<ExcalidrawImperativeAPI>();

      const api: ExcalidrawImperativeAPI = {
        ready: true,
        readyPromise,
        updateScene: this.updateScene,
        resetScene: this.resetScene,
        getSceneElementsIncludingDeleted: this.getSceneElementsIncludingDeleted,
        history: {
          clear: this.resetHistory,
        },
        setScrollToCenter: this.setScrollToCenter,
        getSceneElements: this.getSceneElements,
        getAppState: () => this.state,
      } as const;
      if (typeof excalidrawRef === "function") {
        excalidrawRef(api);
      } else {
        excalidrawRef.current = api;
      }
      readyPromise.resolve(api);
    }
    this.scene = new Scene();

    this.actionManager = new ActionManager(
      this.syncActionResult,
      () => this.state,
      () => this.scene.getElementsIncludingDeleted(),
      this,
    );
    this.actionManager.registerAll(actions);

    this.actionManager.registerAction(createUndoAction(history));
    this.actionManager.registerAction(createRedoAction(history));
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
          id="canvas"
          style={{
            width: canvasDOMWidth,
            height: canvasDOMHeight,
            cursor: "grabbing",
          }}
          width={canvasWidth}
          height={canvasHeight}
          ref={this.handleCanvasRef}
          onContextMenu={this.handleCanvasContextMenu}
          onPointerMove={this.handleCanvasPointerMove}
          onPointerUp={this.removePointer}
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
        id="canvas"
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
        onPointerUp={this.removePointer}
        onPointerCancel={this.removePointer}
        onTouchMove={this.handleTouchMove}
        onDrop={this.handleCanvasOnDrop}
      >
        {t("labels.drawingCanvas")}
      </canvas>
    );
  }

  public render() {
    const {
      zenModeEnabled,
      width: canvasDOMWidth,
      height: canvasDOMHeight,
      viewModeEnabled,
    } = this.state;

    const { onCollabButtonClick, onExportToBackend, renderFooter } = this.props;

    const DEFAULT_PASTE_X = canvasDOMWidth / 2;
    const DEFAULT_PASTE_Y = canvasDOMHeight / 2;

    return (
      <div
        className={clsx("excalidraw", {
          "excalidraw--view-mode": viewModeEnabled,
        })}
        ref={this.excalidrawContainerRef}
        style={{
          width: canvasDOMWidth,
          height: canvasDOMHeight,
        }}
      >
        <LayerUI
          canvas={this.canvas}
          appState={this.state}
          setAppState={this.setAppState}
          actionManager={this.actionManager}
          elements={this.scene.getElements()}
          onCollabButtonClick={onCollabButtonClick}
          onLockToggle={this.toggleLock}
          onInsertElements={(elements) =>
            this.addElementsFromPasteOrLibrary(
              elements,
              DEFAULT_PASTE_X,
              DEFAULT_PASTE_Y,
            )
          }
          zenModeEnabled={zenModeEnabled}
          toggleZenMode={this.toggleZenMode}
          langCode={getLanguage().code}
          isCollaborating={this.props.isCollaborating || false}
          onExportToBackend={onExportToBackend}
          renderCustomFooter={renderFooter}
          viewModeEnabled={viewModeEnabled}
          showExitZenModeBtn={
            typeof this.props?.zenModeEnabled === "undefined" && zenModeEnabled
          }
        />
        <div className="excalidraw-textEditorContainer" />
        {this.state.showStats && (
          <Stats
            appState={this.state}
            setAppState={this.setAppState}
            elements={this.scene.getElements()}
            onClose={this.toggleStats}
          />
        )}
        {this.state.toastMessage !== null && (
          <Toast
            message={this.state.toastMessage}
            clearToast={this.clearToast}
          />
        )}
        <main>{this.renderCanvas()}</main>
      </div>
    );
  }

  public getSceneElementsIncludingDeleted = () => {
    return this.scene.getElementsIncludingDeleted();
  };

  public getSceneElements = () => {
    return this.scene.getElements();
  };

  private syncActionResult = withBatchedUpdates(
    (actionResult: ActionResult) => {
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
          history.resumeRecording();
        }
      }

      if (actionResult.appState || editingElement) {
        if (actionResult.commitToHistory) {
          history.resumeRecording();
        }

        let viewModeEnabled = actionResult?.appState?.viewModeEnabled || false;
        let zenModeEnabled = actionResult?.appState?.zenModeEnabled || false;
        let gridSize = actionResult?.appState?.gridSize || null;

        if (typeof this.props.viewModeEnabled !== "undefined") {
          viewModeEnabled = this.props.viewModeEnabled;
        }

        if (typeof this.props.zenModeEnabled !== "undefined") {
          zenModeEnabled = this.props.zenModeEnabled;
        }

        if (typeof this.props.gridModeEnabled !== "undefined") {
          gridSize = this.props.gridModeEnabled ? GRID_SIZE : null;
        }

        this.setState(
          (state) => {
            // using Object.assign instead of spread to fool TS 4.2.2+ into
            // regarding the resulting type as not containing undefined
            // (which the following expression will never contain)
            return Object.assign(actionResult.appState || {}, {
              editingElement:
                editingElement || actionResult.appState?.editingElement || null,
              width: state.width,
              height: state.height,
              offsetTop: state.offsetTop,
              offsetLeft: state.offsetLeft,
              viewModeEnabled,
              zenModeEnabled,
              gridSize,
            });
          },
          () => {
            if (actionResult.syncHistory) {
              history.setCurrentState(
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

  private disableEvent: EventHandlerNonNull = (event) => {
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

  private importLibraryFromUrl = async (url: string) => {
    window.history.replaceState({}, APP_NAME, window.location.origin);
    try {
      const request = await fetch(url);
      const blob = await request.blob();
      const json = JSON.parse(await blob.text());
      if (!isValidLibrary(json)) {
        throw new Error();
      }
      if (
        window.confirm(
          t("alerts.confirmAddLibrary", { numShapes: json.library.length }),
        )
      ) {
        await Library.importLibrary(blob);
        this.setState({
          isLibraryOpen: true,
        });
      }
    } catch (error) {
      window.alert(t("alerts.errorLoadingLibrary"));
      console.error(error);
    }
  };

  private resetHistory = () => {
    history.clear();
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
        appearance: this.state.appearance,
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
          blob.handle = fileHandle;
          loadFromBlob(blob, this.state)
            .then(({ elements, appState }) =>
              this.syncActionResult({
                elements,
                appState: {
                  ...(appState || this.state),
                  isLoading: false,
                },
                commitToHistory: true,
              }),
            )
            .catch((error) => {
              this.setState({ isLoading: false, errorMessage: error.message });
            });
        },
      );
    }

    if (!this.state.isLoading) {
      this.setState({ isLoading: true });
    }

    let initialData = null;
    try {
      initialData = (await this.props.initialData) || null;
    } catch (error) {
      console.error(error);
    }

    const scene = restore(initialData, null);

    scene.appState = {
      ...scene.appState,
      isLoading: false,
    };
    if (initialData?.scrollToCenter) {
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

    const addToLibraryUrl = new URLSearchParams(window.location.search).get(
      "addLibrary",
    );

    if (addToLibraryUrl) {
      await this.importLibraryFromUrl(addToLibraryUrl);
    }
  };

  public async componentDidMount() {
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
      });
    }

    this.scene.addCallback(this.onSceneUpdated);
    this.addEventListeners();

    // optim to avoid extra render on init
    if (
      typeof this.props.offsetLeft === "number" &&
      typeof this.props.offsetTop === "number"
    ) {
      this.initializeScene();
    } else {
      this.setState(this.getCanvasOffsets(this.props), () => {
        this.initializeScene();
      });
    }
  }

  public componentWillUnmount() {
    this.unmounted = true;
    this.removeEventListeners();
    this.scene.destroy();
    clearTimeout(touchTimeout);
    touchTimeout = 0;
  }

  private onResize = withBatchedUpdates(() => {
    this.scene
      .getElementsIncludingDeleted()
      .forEach((element) => invalidateShapeForElement(element));
    this.setState({});
  });

  private removeEventListeners() {
    document.removeEventListener(EVENT.COPY, this.onCopy);
    document.removeEventListener(EVENT.PASTE, this.pasteFromClipboard);
    document.removeEventListener(EVENT.CUT, this.onCut);

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
    window.removeEventListener(EVENT.DRAG_OVER, this.disableEvent, false);
    window.removeEventListener(EVENT.DROP, this.disableEvent, false);

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
  }

  private addEventListeners() {
    this.removeEventListeners();
    document.addEventListener(EVENT.COPY, this.onCopy);
    document.addEventListener(EVENT.KEYDOWN, this.onKeyDown, false);
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
    document.addEventListener(EVENT.SCROLL, this.onScroll);

    window.addEventListener(EVENT.RESIZE, this.onResize, false);
    window.addEventListener(EVENT.UNLOAD, this.onUnload, false);
    window.addEventListener(EVENT.BLUR, this.onBlur, false);
    window.addEventListener(EVENT.DRAG_OVER, this.disableEvent, false);
    window.addEventListener(EVENT.DROP, this.disableEvent, false);
  }

  componentDidUpdate(prevProps: ExcalidrawProps, prevState: AppState) {
    if (prevProps.langCode !== this.props.langCode) {
      this.updateLanguage();
    }

    if (
      prevProps.width !== this.props.width ||
      prevProps.height !== this.props.height ||
      (typeof this.props.offsetLeft === "number" &&
        prevProps.offsetLeft !== this.props.offsetLeft) ||
      (typeof this.props.offsetTop === "number" &&
        prevProps.offsetTop !== this.props.offsetTop)
    ) {
      this.setState({
        width: this.props.width ?? window.innerWidth,
        height: this.props.height ?? window.innerHeight,
        ...this.getCanvasOffsets(this.props),
      });
    }

    if (prevProps.viewModeEnabled !== this.props.viewModeEnabled) {
      this.setState(
        { viewModeEnabled: !!this.props.viewModeEnabled },
        this.addEventListeners,
      );
    }

    if (prevState.viewModeEnabled !== this.state.viewModeEnabled) {
      this.addEventListeners();
    }

    if (prevProps.zenModeEnabled !== this.props.zenModeEnabled) {
      this.setState({ zenModeEnabled: !!this.props.zenModeEnabled });
    }

    if (prevProps.gridModeEnabled !== this.props.gridModeEnabled) {
      this.setState({
        gridSize: this.props.gridModeEnabled ? GRID_SIZE : null,
      });
    }
    document
      .querySelector(".excalidraw")
      ?.classList.toggle("Appearance_dark", this.state.appearance === "dark");

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
      prevState.elementType !== this.state.elementType &&
      multiElement != null &&
      isBindingEnabled(this.state) &&
      isBindingElement(multiElement)
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
    const pointerViewportCoords: SceneState["remotePointerViewportCoords"] = {};
    const remoteSelectedElementIds: SceneState["remoteSelectedElementIds"] = {};
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
    const elements = this.scene.getElements();
    const { atLeastOneVisibleElement, scrollBars } = renderScene(
      elements.filter((element) => {
        // don't render text element that's being currently edited (it's
        // rendered on remote only)
        return (
          !this.state.editingElement ||
          this.state.editingElement.type !== "text" ||
          element.id !== this.state.editingElement.id
        );
      }),
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
      },
      {
        renderOptimizations: true,
        renderScrollbars: !isMobile(),
      },
    );
    if (scrollBars) {
      currentScrollBars = scrollBars;
    }
    const scrolledOutside =
      // hide when editing text
      this.state.editingElement?.type === "text"
        ? false
        : !atLeastOneVisibleElement && elements.length > 0;
    if (this.state.scrolledOutside !== scrolledOutside) {
      this.setState({ scrolledOutside });
    }

    history.record(this.state, this.scene.getElementsIncludingDeleted());

    // Do not notify consumers if we're still loading the scene. Among other
    // potential issues, this fixes a case where the tab isn't focused during
    // init, which would trigger onChange with empty elements, which would then
    // override whatever is in localStorage currently.
    if (!this.state.isLoading) {
      this.props.onChange?.(
        this.scene.getElementsIncludingDeleted(),
        this.state,
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
    if (isWritableElement(event.target)) {
      return;
    }
    this.cutAll();
    event.preventDefault();
  });

  private onCopy = withBatchedUpdates((event: ClipboardEvent) => {
    const activeSelection = document.getSelection();
    if (
      activeSelection?.anchorNode &&
      !this.excalidrawContainerRef.current!.contains(activeSelection.anchorNode)
    ) {
      return;
    }
    if (isWritableElement(event.target)) {
      return;
    }
    this.copyAll();
    event.preventDefault();
  });

  private cutAll = () => {
    this.copyAll();
    this.actionManager.executeAction(actionDeleteSelected);
  };

  private copyAll = () => {
    copyToClipboard(this.scene.getElements(), this.state);
  };

  private static resetTapTwice() {
    didTapTwice = false;
  }

  private onTapStart = (event: TouchEvent) => {
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
    event.preventDefault();
    if (event.touches.length === 2) {
      this.setState({
        selectedElementIds: {},
      });
    }
  };

  private onTapEnd = (event: TouchEvent) => {
    event.preventDefault();
    if (event.touches.length > 0) {
      this.setState({
        previousSelectedElementIds: {},
        selectedElementIds: this.state.previousSelectedElementIds,
      });
    }
  };

  private pasteFromClipboard = withBatchedUpdates(
    async (event: ClipboardEvent | null) => {
      // #686
      const target = document.activeElement;
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
      const data = await parseClipboard(event);
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
        this.addElementsFromPasteOrLibrary(data.elements);
      } else if (data.text) {
        this.addTextFromPaste(data.text);
      }
      this.selectShapeTool("selection");
      event?.preventDefault();
    },
  );

  private addElementsFromPasteOrLibrary = (
    clipboardElements: readonly ExcalidrawElement[],
    clientX = cursorX,
    clientY = cursorY,
  ) => {
    const [minX, minY, maxX, maxY] = getCommonBounds(clipboardElements);

    const elementsCenterX = distance(minX, maxX) / 2;
    const elementsCenterY = distance(minY, maxY) / 2;

    const { x, y } = viewportCoordsToSceneCoords(
      { clientX, clientY },
      this.state,
    );

    const dx = x - elementsCenterX;
    const dy = y - elementsCenterY;
    const groupIdMap = new Map();

    const [gridX, gridY] = getGridPoint(dx, dy, this.state.gridSize);

    const oldIdToDuplicatedId = new Map();
    const newElements = clipboardElements.map((element) => {
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
    const nextElements = [
      ...this.scene.getElementsIncludingDeleted(),
      ...newElements,
    ];
    fixBindingsAfterDuplication(
      nextElements,
      clipboardElements,
      oldIdToDuplicatedId,
    );

    this.scene.replaceAllElements(nextElements);
    history.resumeRecording();
    this.setState(
      selectGroupsForSelectedElements(
        {
          ...this.state,
          isLibraryOpen: false,
          selectedElementIds: newElements.reduce((map, element) => {
            map[element.id] = true;
            return map;
          }, {} as any),
          selectedGroupIds: {},
        },
        this.scene.getElements(),
      ),
    );
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
    });

    this.scene.replaceAllElements([
      ...this.scene.getElementsIncludingDeleted(),
      element,
    ]);
    this.setState({ selectedElementIds: { [element.id]: true } });
    history.resumeRecording();
  }

  // Collaboration

  setAppState = (obj: any) => {
    this.setState(obj);
  };

  removePointer = (event: React.PointerEvent<HTMLElement>) => {
    // remove touch handler for context menu on touch devices
    if (event.pointerType === "touch" && touchTimeout) {
      clearTimeout(touchTimeout);
      touchTimeout = 0;
      invalidateContextMenu = false;
    }

    gesture.pointers.delete(event.pointerId);
  };

  toggleLock = () => {
    this.setState((prevState) => {
      return {
        elementLocked: !prevState.elementLocked,
        elementType: prevState.elementLocked
          ? "selection"
          : prevState.elementType,
      };
    });
  };

  toggleZenMode = () => {
    this.actionManager.executeAction(actionToggleZenMode);
  };

  toggleStats = () => {
    if (!this.state.showStats) {
      trackEvent("dialog", "stats");
    }
    this.actionManager.executeAction(actionToggleStats);
  };

  setScrollToCenter = (remoteElements: readonly ExcalidrawElement[]) => {
    this.setState({
      ...calculateScrollCenter(
        getNonDeletedElements(remoteElements),
        this.state,
        this.canvas,
      ),
    });
  };

  clearToast = () => {
    this.setState({ toastMessage: null });
  };

  public updateScene = withBatchedUpdates((sceneData: SceneData) => {
    if (sceneData.commitToHistory) {
      history.resumeRecording();
    }

    // currently we only support syncing background color
    if (sceneData.appState?.viewBackgroundColor) {
      this.setState({
        viewBackgroundColor: sceneData.appState.viewBackgroundColor,
      });
    }

    if (sceneData.elements) {
      this.scene.replaceAllElements(sceneData.elements);
    }

    if (sceneData.collaborators) {
      this.setState({ collaborators: sceneData.collaborators });
    }
  });

  private onSceneUpdated = () => {
    this.setState({});
  };

  private updateCurrentCursorPosition = withBatchedUpdates(
    (event: MouseEvent) => {
      cursorX = event.x;
      cursorY = event.y;
    },
  );

  // Input handling

  private onKeyDown = withBatchedUpdates((event: KeyboardEvent) => {
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

    if (
      (isWritableElement(event.target) && event.key !== KEYS.ESCAPE) ||
      // case: using arrows to move between buttons
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

    if (event[KEYS.CTRL_OR_CMD]) {
      this.setState({ isBindingEnabled: false });
    }

    if (event.code === CODES.NINE) {
      this.setState({ isLibraryOpen: !this.state.isLibraryOpen });
    }

    if (isArrowKey(event.key)) {
      const step =
        (this.state.gridSize &&
          (event.shiftKey ? ELEMENT_TRANSLATE_AMOUNT : this.state.gridSize)) ||
        (event.shiftKey
          ? ELEMENT_SHIFT_TRANSLATE_AMOUNT
          : ELEMENT_TRANSLATE_AMOUNT);

      const selectedElements = this.scene
        .getElements()
        .filter((element) => this.state.selectedElementIds[element.id]);

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
        this.scene.getElements(),
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
          history.resumeRecording();
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
        this.selectShapeTool(shape);
      } else if (event.key === KEYS.Q) {
        this.toggleLock();
      }
    }
    if (event.key === KEYS.SPACE && gesture.pointers.size === 0) {
      isHoldingSpace = true;
      setCursor(this.canvas, CURSOR_TYPE.GRABBING);
    }
  });

  private onKeyUp = withBatchedUpdates((event: KeyboardEvent) => {
    if (event.key === KEYS.SPACE) {
      if (this.state.elementType === "selection") {
        resetCursor(this.canvas);
      } else {
        setCursorForShape(this.canvas, this.state.elementType);
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
        this.scene.getElements(),
        this.state,
      );
      isBindingEnabled(this.state)
        ? bindOrUnbindSelectedElements(selectedElements)
        : unbindLinearElements(selectedElements);
      this.setState({ suggestedBindings: [] });
    }
  });

  private selectShapeTool(elementType: AppState["elementType"]) {
    if (!isHoldingSpace) {
      setCursorForShape(this.canvas, elementType);
    }
    if (isToolIcon(document.activeElement)) {
      document.activeElement.blur();
    }
    if (!isLinearElementType(elementType)) {
      this.setState({ suggestedBindings: [] });
    }
    if (elementType !== "selection") {
      this.setState({
        elementType,
        selectedElementIds: {},
        selectedGroupIds: {},
        editingGroupId: null,
      });
    } else {
      this.setState({ elementType });
    }
  }

  private onGestureStart = withBatchedUpdates((event: GestureEvent) => {
    event.preventDefault();
    this.setState({
      selectedElementIds: {},
    });
    gesture.initialScale = this.state.zoom.value;
  });

  private onGestureChange = withBatchedUpdates((event: GestureEvent) => {
    event.preventDefault();

    // onGestureChange only has zoom factor but not the center.
    // If we're on iPad or iPhone, then we recognize multi-touch and will
    // zoom in at the right location on the touchMove handler already.
    // On Macbook, we don't have those events so will zoom in at the
    // current location instead.
    if (gesture.pointers.size === 2) {
      return;
    }

    const initialScale = gesture.initialScale;
    if (initialScale) {
      this.setState(({ zoom, offsetLeft, offsetTop }) => ({
        zoom: getNewZoom(
          getNormalizedZoom(initialScale * event.scale),
          zoom,
          { left: offsetLeft, top: offsetTop },
          { x: cursorX, y: cursorY },
        ),
      }));
    }
  });

  private onGestureEnd = withBatchedUpdates((event: GestureEvent) => {
    event.preventDefault();
    this.setState({
      previousSelectedElementIds: {},
      selectedElementIds: this.state.previousSelectedElementIds,
    });
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
    const updateElement = (text: string, isDeleted = false) => {
      this.scene.replaceAllElements([
        ...this.scene.getElementsIncludingDeleted().map((_element) => {
          if (_element.id === element.id && isTextElement(_element)) {
            return updateTextElement(_element, {
              text,
              isDeleted,
            });
          }
          return _element;
        }),
      ]);
    };

    textWysiwyg({
      id: element.id,
      appState: this.state,
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
        updateElement(text);
        if (isNonDeletedElement(element)) {
          updateBoundElements(element);
        }
      }),
      onSubmit: withBatchedUpdates((text) => {
        const isDeleted = !text.trim();
        updateElement(text, isDeleted);
        if (!isDeleted) {
          this.setState((prevState) => ({
            selectedElementIds: {
              ...prevState.selectedElementIds,
              [element.id]: true,
            },
          }));
        } else {
          fixBindingsAfterDeletion(this.scene.getElements(), [element]);
        }
        if (!isDeleted || isExistingElement) {
          history.resumeRecording();
        }

        this.setState({
          draggingElement: null,
          editingElement: null,
        });
        if (this.state.elementLocked) {
          setCursorForShape(this.canvas, this.state.elementType);
        }
      }),
      element,
    });
    // deselect all other elements when inserting text
    this.setState({
      selectedElementIds: {},
      selectedGroupIds: {},
      editingGroupId: null,
    });

    // do an initial update to re-initialize element position since we were
    // modifying element's x/y for sake of editor (case: syncing to remote)
    updateElement(element.text);
  }

  private getTextElementAtPosition(
    x: number,
    y: number,
  ): NonDeleted<ExcalidrawTextElement> | null {
    const element = this.getElementAtPosition(x, y);

    if (element && isTextElement(element) && !element.isDeleted) {
      return element;
    }
    return null;
  }

  private getElementAtPosition(
    x: number,
    y: number,
  ): NonDeleted<ExcalidrawElement> | null {
    const allHitElements = this.getElementsAtPosition(x, y);
    if (allHitElements.length > 1) {
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
  ): NonDeleted<ExcalidrawElement>[] {
    return getElementsAtPosition(this.scene.getElements(), (element) =>
      hitTest(element, this.state, x, y),
    );
  }

  private startTextEditing = ({
    sceneX,
    sceneY,
    insertAtParentCenter = true,
  }: {
    /** X position to insert text at */
    sceneX: number;
    /** Y position to insert text at */
    sceneY: number;
    /** whether to attempt to insert at element center if applicable */
    insertAtParentCenter?: boolean;
  }) => {
    const existingTextElement = this.getTextElementAtPosition(sceneX, sceneY);

    const parentCenterPosition =
      insertAtParentCenter &&
      this.getTextWysiwygSnappedToCenterPosition(
        sceneX,
        sceneY,
        this.state,
        this.canvas,
        window.devicePixelRatio,
      );

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
            ? "middle"
            : DEFAULT_VERTICAL_ALIGN,
        });

    this.setState({ editingElement: element });

    if (existingTextElement) {
      // if text element is no longer centered to a container, reset
      // verticalAlign to default because it's currently internal-only
      if (!parentCenterPosition || element.textAlign !== "center") {
        mutateElement(element, { verticalAlign: DEFAULT_VERTICAL_ALIGN });
      }
    } else {
      this.scene.replaceAllElements([
        ...this.scene.getElementsIncludingDeleted(),
        element,
      ]);

      // case: creating new text not centered to parent elemenent → offset Y
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
    if (this.state.elementType !== "selection") {
      return;
    }

    const selectedElements = getSelectedElements(
      this.scene.getElements(),
      this.state,
    );

    if (selectedElements.length === 1 && isLinearElement(selectedElements[0])) {
      if (
        !this.state.editingLinearElement ||
        this.state.editingLinearElement.elementId !== selectedElements[0].id
      ) {
        history.resumeRecording();
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

    const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
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
            this.scene.getElements(),
          ),
        );
        return;
      }
    }

    resetCursor(this.canvas);

    if (!event[KEYS.CTRL_OR_CMD]) {
      this.startTextEditing({
        sceneX,
        sceneY,
        insertAtParentCenter: !event.altKey,
      });
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
      const scaleFactor = distance / gesture.initialDistance;

      this.setState(({ zoom, scrollX, scrollY, offsetLeft, offsetTop }) => ({
        scrollX: scrollX + deltaX / zoom.value,
        scrollY: scrollY + deltaY / zoom.value,
        zoom: getNewZoom(
          getNormalizedZoom(initialScale * scaleFactor),
          zoom,
          { left: offsetLeft, top: offsetTop },
          center,
        ),
        shouldCacheIgnoreZoom: true,
      }));
      this.resetShouldCacheIgnoreZoomDebounced();
    } else {
      gesture.lastCenter = gesture.initialDistance = gesture.initialScale = null;
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
        setCursorForShape(this.canvas, this.state.elementType);
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

    if (isBindingElementType(this.state.elementType)) {
      // Hovering with a selected tool or creating new linear element via click
      // and point
      const { draggingElement } = this.state;
      if (isBindingElement(draggingElement)) {
        this.maybeSuggestBindingForLinearElementAtCursor(
          draggingElement,
          "end",
          scenePointer,
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

      setCursorForShape(this.canvas, this.state.elementType);

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
      (this.state.elementType !== "selection" &&
        this.state.elementType !== "text")
    ) {
      return;
    }

    const elements = this.scene.getElements();

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
    if (this.state.elementType === "text") {
      setCursor(
        this.canvas,
        isTextElement(hitElement) ? CURSOR_TYPE.TEXT : CURSOR_TYPE.CROSSHAIR,
      );
    } else if (isOverScrollBar) {
      setCursor(this.canvas, CURSOR_TYPE.AUTO);
    } else if (
      hitElement ||
      this.isHittingCommonBoundingBoxOfSelectedElements(
        scenePointer,
        selectedElements,
      )
    ) {
      setCursor(this.canvas, CURSOR_TYPE.MOVE);
    } else {
      setCursor(this.canvas, CURSOR_TYPE.AUTO);
    }
  };

  // set touch moving for mobile context menu
  private handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    invalidateContextMenu = true;
  };

  private handleCanvasPointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    event.persist();

    this.maybeOpenContextMenuAfterPointerDownOnTouchDevices(event);
    this.maybeCleanupAfterMissingPointerUp(event);

    if (isPanning) {
      return;
    }

    this.setState({
      lastPointerDownWith: event.pointerType,
      cursorButton: "down",
    });
    this.savePointer(event.clientX, event.clientY, "down");

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

    this.updateGestureOnPointerDown(event);

    // fixes pointermove causing selection of UI texts #32
    event.preventDefault();
    // Preventing the event above disables default behavior
    // of defocusing potentially focused element, which is what we
    // want when clicking inside the canvas.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
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

    this.clearSelectionIfNotUsingSelection();
    this.updateBindingEnabledOnPointerMove(event);

    if (this.handleSelectionOnPointerDown(event, pointerDownState)) {
      return;
    }

    if (this.state.elementType === "text") {
      this.handleTextOnPointerDown(event, pointerDownState);
      return;
    } else if (
      this.state.elementType === "arrow" ||
      this.state.elementType === "draw" ||
      this.state.elementType === "line"
    ) {
      this.handleLinearElementOnPointerDown(
        event,
        this.state.elementType,
        pointerDownState,
      );
    } else {
      this.createGenericElementOnPointerDown(
        this.state.elementType,
        pointerDownState,
      );
    }

    const onPointerMove = this.onPointerMoveFromPointerDownHandler(
      pointerDownState,
    );

    const onPointerUp = this.onPointerUpFromPointerDownHandler(
      pointerDownState,
    );

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
            this.openContextMenu({
              clientX: event.clientX,
              clientY: event.clientY,
            });
          }
        }, TOUCH_CTX_MENU_TIMEOUT);
      }
    }
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
        gesture.pointers.size === 0 &&
        (event.button === POINTER_BUTTON.WHEEL ||
          (event.button === POINTER_BUTTON.MAIN && isHoldingSpace) ||
          this.state.viewModeEnabled)
      )
    ) {
      return false;
    }
    isPanning = true;

    let nextPastePrevented = false;
    const isLinux = /Linux/.test(window.navigator.platform);

    setCursor(this.canvas, CURSOR_TYPE.GRABBING);
    let { clientX: lastX, clientY: lastY } = event;
    const onPointerMove = withBatchedUpdates((event: PointerEvent) => {
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
         * - rigth click paste
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
          setCursorForShape(this.canvas, this.state.elementType);
        }
        this.setState({
          cursorButton: "up",
        });
        this.savePointer(event.clientX, event.clientY, "up");
        window.removeEventListener(EVENT.POINTER_MOVE, onPointerMove);
        window.removeEventListener(EVENT.POINTER_UP, teardown);
        window.removeEventListener(EVENT.BLUR, teardown);
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
      this.scene.getElements(),
      this.state,
    );
    const [minX, minY, maxX, maxY] = getCommonBounds(selectedElements);

    return {
      origin,
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
      originalElements: this.scene.getElements().reduce((acc, element) => {
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
        hasHitCommonBoundingBoxOfSelectedElements: this.isHittingCommonBoundingBoxOfSelectedElements(
          origin,
          selectedElements,
        ),
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
    const onPointerMove = withBatchedUpdates((event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      this.handlePointerMoveOverScrollbars(event, pointerDownState);
    });

    const onPointerUp = withBatchedUpdates(() => {
      isDraggingScrollBar = false;
      setCursorForShape(this.canvas, this.state.elementType);
      lastPointerUp = null;
      this.setState({
        cursorButton: "up",
      });
      this.savePointer(event.clientX, event.clientY, "up");
      window.removeEventListener(EVENT.POINTER_MOVE, onPointerMove);
      window.removeEventListener(EVENT.POINTER_UP, onPointerUp);
    });

    lastPointerUp = onPointerUp;

    window.addEventListener(EVENT.POINTER_MOVE, onPointerMove);
    window.addEventListener(EVENT.POINTER_UP, onPointerUp);
    return true;
  }

  private clearSelectionIfNotUsingSelection = (): void => {
    if (this.state.elementType !== "selection") {
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
    if (this.state.elementType === "selection") {
      const elements = this.scene.getElements();
      const selectedElements = getSelectedElements(elements, this.state);
      if (selectedElements.length === 1 && !this.state.editingLinearElement) {
        const elementWithTransformHandleType = getElementWithTransformHandleType(
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
            history,
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

        // For overlapped elements one position may hit
        // multiple elements
        pointerDownState.hit.allHitElements = this.getElementsAtPosition(
          pointerDownState.origin.x,
          pointerDownState.origin.y,
        );

        const hitElement = pointerDownState.hit.element;
        const someHitElementIsSelected = pointerDownState.hit.allHitElements.some(
          (element) => this.isASelectedElement(element),
        );
        if (
          (hitElement === null || !someHitElementIsSelected) &&
          !event.shiftKey &&
          !pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements
        ) {
          this.clearSelection(hitElement);
        }

        // If we click on something
        if (hitElement != null) {
          // on CMD/CTRL, drill down to hit element regardless of groups etc.
          if (event[KEYS.CTRL_OR_CMD]) {
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
                  },
                  this.scene.getElements(),
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
    // of state.elementLocked)
    if (this.state.editingElement?.type === "text") {
      return;
    }

    this.startTextEditing({
      sceneX: pointerDownState.origin.x,
      sceneY: pointerDownState.origin.y,
      insertAtParentCenter: !event.altKey,
    });

    resetCursor(this.canvas);
    if (!this.state.elementLocked) {
      this.setState({
        elementType: "selection",
      });
    }
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
        elementType === "draw" ? null : this.state.gridSize,
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
  ): (event: PointerEvent) => void {
    return withBatchedUpdates((event: PointerEvent) => {
      // We need to initialize dragOffsetXY only after we've updated
      // `state.selectedElementIds` on pointerDown. Doing it here in pointerMove
      // event handler should hopefully ensure we're already working with
      // the updated state.
      if (pointerDownState.drag.offset === null) {
        pointerDownState.drag.offset = tupleToCoors(
          getDragOffsetXY(
            getSelectedElements(this.scene.getElements(), this.state),
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
        (this.state.elementType === "arrow" ||
          this.state.elementType === "line")
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
          (element, startOrEnd) => {
            this.maybeSuggestBindingForLinearElementAtCursor(
              element,
              startOrEnd,
              pointerCoords,
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
        hasHitASelectedElement ||
        pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements
      ) {
        // Marking that click was used for dragging to check
        // if elements should be deselected on pointerup
        pointerDownState.drag.hasOccurred = true;
        const selectedElements = getSelectedElements(
          this.scene.getElements(),
          this.state,
        );
        if (selectedElements.length > 0) {
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
            this.scene,
            lockDirection,
            dragDistanceX,
            dragDistanceY,
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
            for (const element of this.scene.getElementsIncludingDeleted()) {
              if (
                this.state.selectedElementIds[element.id] ||
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

      if (isLinearElement(draggingElement)) {
        pointerDownState.drag.hasOccurred = true;
        const points = draggingElement.points;
        let dx: number;
        let dy: number;
        if (draggingElement.type === "draw") {
          dx = pointerCoords.x - draggingElement.x;
          dy = pointerCoords.y - draggingElement.y;
        } else {
          dx = gridX - draggingElement.x;
          dy = gridY - draggingElement.y;
        }

        if (getRotateWithDiscreteAngleKey(event) && points.length === 2) {
          ({ width: dx, height: dy } = getPerfectElementSize(
            this.state.elementType,
            dx,
            dy,
          ));
        }

        if (points.length === 1) {
          mutateElement(draggingElement, { points: [...points, [dx, dy]] });
        } else if (points.length > 1) {
          if (draggingElement.type === "draw") {
            mutateElement(draggingElement, {
              points: simplify(
                [...(points as Point[]), [dx, dy]],
                0.7 / this.state.zoom.value,
              ),
            });
          } else {
            mutateElement(draggingElement, {
              points: [...points.slice(0, -1), [dx, dy]],
            });
          }
        }
        if (isBindingElement(draggingElement)) {
          // When creating a linear element by dragging
          this.maybeSuggestBindingForLinearElementAtCursor(
            draggingElement,
            "end",
            pointerCoords,
            this.state.startBoundElement,
          );
        }
      } else {
        pointerDownState.lastCoords.x = pointerCoords.x;
        pointerDownState.lastCoords.y = pointerCoords.y;
        this.maybeDragNewGenericElement(pointerDownState, event);
      }

      if (this.state.elementType === "selection") {
        const elements = this.scene.getElements();
        if (!event.shiftKey && isSomeElementSelected(elements, this.state)) {
          this.setState({
            selectedElementIds: {},
            selectedGroupIds: {},
            editingGroupId: null,
          });
        }
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
              },
            },
            this.scene.getElements(),
          ),
        );
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
        elementType,
        elementLocked,
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

      lastPointerUp = null;

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

      if (draggingElement?.type === "draw") {
        this.actionManager.executeAction(actionFinalize);
        return;
      }

      if (isLinearElement(draggingElement)) {
        if (draggingElement!.points.length > 1) {
          history.resumeRecording();
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
            isBindingElement(draggingElement)
          ) {
            maybeBindLinearElement(
              draggingElement,
              this.state,
              this.scene,
              pointerCoords,
            );
          }
          this.setState({ suggestedBindings: [], startBoundElement: null });
          if (!elementLocked && elementType !== "draw") {
            resetCursor(this.canvas);
            this.setState((prevState) => ({
              draggingElement: null,
              elementType: "selection",
              selectedElementIds: {
                ...prevState.selectedElementIds,
                [this.state.draggingElement!.id]: true,
              },
            }));
          } else {
            this.setState((prevState) => ({
              draggingElement: null,
              selectedElementIds: {
                ...prevState.selectedElementIds,
                [this.state.draggingElement!.id]: true,
              },
            }));
          }
        }
        return;
      }

      if (
        elementType !== "selection" &&
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
        history.resumeRecording();
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
      if (
        hitElement &&
        !pointerDownState.drag.hasOccurred &&
        !pointerDownState.hit.wasAddedToSelection
      ) {
        if (childEvent.shiftKey) {
          if (this.state.selectedElementIds[hitElement.id]) {
            if (isSelectedViaGroup(this.state, hitElement)) {
              // We want to unselect all groups hitElement is part of
              // as well as all elements that are part of the groups
              // hitElement is part of
              const idsOfSelectedElementsThatAreInGroups = hitElement.groupIds
                .flatMap((groupId) =>
                  getElementsInGroup(this.scene.getElements(), groupId),
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
              this.setState((prevState) => ({
                selectedElementIds: {
                  ...prevState.selectedElementIds,
                  [hitElement!.id]: false,
                },
              }));
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
              this.scene.getElements(),
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

      if (!elementLocked && elementType !== "draw" && draggingElement) {
        this.setState((prevState) => ({
          selectedElementIds: {
            ...prevState.selectedElementIds,
            [draggingElement.id]: true,
          },
        }));
      }

      if (
        elementType !== "selection" ||
        isSomeElementSelected(this.scene.getElements(), this.state)
      ) {
        history.resumeRecording();
      }

      if (pointerDownState.drag.hasOccurred || isResizing || isRotating) {
        (isBindingEnabled(this.state)
          ? bindOrUnbindSelectedElements
          : unbindLinearElements)(
          getSelectedElements(this.scene.getElements(), this.state),
        );
      }

      if (!elementLocked && elementType !== "draw") {
        resetCursor(this.canvas);
        this.setState({
          draggingElement: null,
          suggestedBindings: [],
          elementType: "selection",
        });
      } else {
        this.setState({
          draggingElement: null,
          suggestedBindings: [],
        });
      }
    });
  }

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

  private maybeSuggestBindingForLinearElementAtCursor = (
    linearElement: NonDeleted<ExcalidrawLinearElement>,
    startOrEnd: "start" | "end",
    pointerCoords: {
      x: number;
      y: number;
    },
    // During line creation the start binding hasn't been written yet
    // into `linearElement`
    oppositeBindingBoundElement?: ExcalidrawBindableElement | null,
  ): void => {
    const hoveredBindableElement = getHoveredElementForBinding(
      pointerCoords,
      this.scene,
    );
    this.setState({
      suggestedBindings:
        hoveredBindableElement != null &&
        !isLinearElementSimpleAndAlreadyBound(
          linearElement,
          oppositeBindingBoundElement?.id,
          hoveredBindableElement,
        )
          ? [hoveredBindableElement]
          : [],
    });
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

  private handleCanvasOnDrop = async (
    event: React.DragEvent<HTMLCanvasElement>,
  ) => {
    try {
      const file = event.dataTransfer.files[0];
      if (file?.type === "image/png" || file?.type === "image/svg+xml") {
        const { elements, appState } = await loadFromBlob(file, this.state);
        this.syncActionResult({
          elements,
          appState: {
            ...(appState || this.state),
            isLoading: false,
          },
          commitToHistory: true,
        });
        return;
      }
    } catch (error) {
      return this.setState({
        isLoading: false,
        errorMessage: error.message,
      });
    }

    const libraryShapes = event.dataTransfer.getData(MIME_TYPES.excalidrawlib);
    if (libraryShapes !== "") {
      this.addElementsFromPasteOrLibrary(
        JSON.parse(libraryShapes),
        event.clientX,
        event.clientY,
      );
      return;
    }

    const file = event.dataTransfer?.files[0];
    if (
      file?.type === "application/json" ||
      file?.name.endsWith(".excalidraw")
    ) {
      this.setState({ isLoading: true });
      if (
        "chooseFileSystemEntries" in window ||
        "showOpenFilePicker" in window
      ) {
        try {
          // This will only work as of Chrome 86,
          // but can be safely ignored on older releases.
          const item = event.dataTransfer.items[0];
          (file as any).handle = await (item as any).getAsFileSystemHandle();
        } catch (error) {
          console.warn(error.name, error.message);
        }
      }
      loadFromBlob(file, this.state)
        .then(({ elements, appState }) =>
          this.syncActionResult({
            elements,
            appState: {
              ...(appState || this.state),
              isLoading: false,
            },
            commitToHistory: true,
          }),
        )
        .catch((error) => {
          this.setState({ isLoading: false, errorMessage: error.message });
        });
    } else if (
      file?.type === MIME_TYPES.excalidrawlib ||
      file?.name.endsWith(".excalidrawlib")
    ) {
      Library.importLibrary(file)
        .then(() => {
          this.setState({ isLibraryOpen: false });
        })
        .catch((error) =>
          this.setState({ isLoading: false, errorMessage: error.message }),
        );
    } else {
      this.setState({
        isLoading: false,
        errorMessage: t("alerts.couldNotLoadInvalidFile"),
      });
    }
  };

  private handleCanvasContextMenu = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    event.preventDefault();
    this.openContextMenu(event);
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
    if (draggingElement.type === "selection") {
      dragNewElement(
        draggingElement,
        this.state.elementType,
        pointerDownState.origin.x,
        pointerDownState.origin.y,
        pointerCoords.x,
        pointerCoords.y,
        distance(pointerDownState.origin.x, pointerCoords.x),
        distance(pointerDownState.origin.y, pointerCoords.y),
        getResizeWithSidesSameLengthKey(event),
        getResizeCenterPointKey(event),
      );
    } else {
      const [gridX, gridY] = getGridPoint(
        pointerCoords.x,
        pointerCoords.y,
        this.state.gridSize,
      );
      dragNewElement(
        draggingElement,
        this.state.elementType,
        pointerDownState.originInGrid.x,
        pointerDownState.originInGrid.y,
        gridX,
        gridY,
        distance(pointerDownState.originInGrid.x, gridX),
        distance(pointerDownState.originInGrid.y, gridY),
        getResizeWithSidesSameLengthKey(event),
        getResizeCenterPointKey(event),
      );
      this.maybeSuggestBindingForAll([draggingElement]);
    }
  };

  private maybeHandleResize = (
    pointerDownState: PointerDownState,
    event: MouseEvent | KeyboardEvent,
  ): boolean => {
    const selectedElements = getSelectedElements(
      this.scene.getElements(),
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
        getRotateWithDiscreteAngleKey(event),
        getResizeCenterPointKey(event),
        getResizeWithSidesSameLengthKey(event),
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

  private openContextMenu = ({
    clientX,
    clientY,
  }: {
    clientX: number;
    clientY: number;
  }) => {
    const { x, y } = viewportCoordsToSceneCoords(
      { clientX, clientY },
      this.state,
    );

    const maybeGroupAction = actionGroup.contextItemPredicate!(
      this.actionManager.getElementsIncludingDeleted(),
      this.actionManager.getAppState(),
    );

    const maybeUngroupAction = actionUngroup.contextItemPredicate!(
      this.actionManager.getElementsIncludingDeleted(),
      this.actionManager.getAppState(),
    );

    const separator = "separator";

    const _isMobile = isMobile();

    const elements = this.scene.getElements();
    const element = this.getElementAtPosition(x, y);
    const options: ContextMenuOption[] = [];
    if (probablySupportsClipboardBlob && elements.length > 0) {
      options.push(actionCopyAsPng);
    }

    if (probablySupportsClipboardWriteText && elements.length > 0) {
      options.push(actionCopyAsSvg);
    }
    if (!element) {
      const viewModeOptions = [
        ...options,
        typeof this.props.gridModeEnabled === "undefined" &&
          actionToggleGridMode,
        typeof this.props.zenModeEnabled === "undefined" && actionToggleZenMode,
        typeof this.props.viewModeEnabled === "undefined" &&
          actionToggleViewMode,
        actionToggleStats,
      ];

      ContextMenu.push({
        options: viewModeOptions,
        top: clientY,
        left: clientX,
        actionManager: this.actionManager,
        appState: this.state,
      });

      if (this.state.viewModeEnabled) {
        return;
      }

      ContextMenu.push({
        options: [
          _isMobile &&
            navigator.clipboard && {
              name: "paste",
              perform: (elements, appStates) => {
                this.pasteFromClipboard(null);
                return {
                  commitToHistory: false,
                };
              },
              contextItemLabel: "labels.paste",
            },
          _isMobile && navigator.clipboard && separator,
          probablySupportsClipboardBlob &&
            elements.length > 0 &&
            actionCopyAsPng,
          probablySupportsClipboardWriteText &&
            elements.length > 0 &&
            actionCopyAsSvg,
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
        top: clientY,
        left: clientX,
        actionManager: this.actionManager,
        appState: this.state,
      });
      return;
    }

    if (!this.state.selectedElementIds[element.id]) {
      this.setState({ selectedElementIds: { [element.id]: true } });
    }

    if (this.state.viewModeEnabled) {
      ContextMenu.push({
        options: [navigator.clipboard && actionCopy, ...options],
        top: clientY,
        left: clientX,
        actionManager: this.actionManager,
        appState: this.state,
      });
      return;
    }

    ContextMenu.push({
      options: [
        _isMobile && actionCut,
        _isMobile && navigator.clipboard && actionCopy,
        _isMobile &&
          navigator.clipboard && {
            name: "paste",
            perform: (elements, appStates) => {
              this.pasteFromClipboard(null);
              return {
                commitToHistory: false,
              };
            },
            contextItemLabel: "labels.paste",
          },
        _isMobile && separator,
        ...options,
        separator,
        actionCopyStyles,
        actionPasteStyles,
        separator,
        maybeGroupAction && actionGroup,
        maybeUngroupAction && actionUngroup,
        (maybeGroupAction || maybeUngroupAction) && separator,
        actionAddToLibrary,
        separator,
        actionSendBackward,
        actionBringForward,
        actionSendToBack,
        actionBringToFront,
        separator,
        actionDuplicateSelection,
        actionDeleteSelected,
      ],
      top: clientY,
      left: clientX,
      actionManager: this.actionManager,
      appState: this.state,
    });
  };

  private handleWheel = withBatchedUpdates((event: WheelEvent) => {
    event.preventDefault();

    if (isPanning) {
      return;
    }

    const { deltaX, deltaY } = event;
    const { selectedElementIds, previousSelectedElementIds } = this.state;
    // note that event.ctrlKey is necessary to handle pinch zooming
    if (event.metaKey || event.ctrlKey) {
      const sign = Math.sign(deltaY);
      const MAX_STEP = 10;
      let delta = Math.abs(deltaY);
      if (delta > MAX_STEP) {
        delta = MAX_STEP;
      }
      delta *= sign;
      if (Object.keys(previousSelectedElementIds).length !== 0) {
        setTimeout(() => {
          this.setState({
            selectedElementIds: previousSelectedElementIds,
            previousSelectedElementIds: {},
          });
        }, 1000);
      }

      let newZoom = this.state.zoom.value - delta / 100;
      // increase zoom steps the more zoomed-in we are (applies to >100% only)
      newZoom += Math.log10(Math.max(1, this.state.zoom.value)) * -sign;
      // round to nearest step
      newZoom = Math.round(newZoom * ZOOM_STEP * 100) / (ZOOM_STEP * 100);

      this.setState(({ zoom, offsetLeft, offsetTop }) => ({
        zoom: getNewZoom(
          getNormalizedZoom(newZoom),
          zoom,
          { left: offsetLeft, top: offsetTop },
          {
            x: cursorX,
            y: cursorY,
          },
        ),
        selectedElementIds: {},
        previousSelectedElementIds:
          Object.keys(selectedElementIds).length !== 0
            ? selectedElementIds
            : previousSelectedElementIds,
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
    const elementClickedInside = getElementContainingPosition(
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

  private getCanvasOffsets(offsets?: {
    offsetLeft?: number;
    offsetTop?: number;
  }): Pick<AppState, "offsetTop" | "offsetLeft"> {
    if (
      typeof offsets?.offsetLeft === "number" &&
      typeof offsets?.offsetTop === "number"
    ) {
      return {
        offsetLeft: offsets.offsetLeft,
        offsetTop: offsets.offsetTop,
      };
    }
    if (this.excalidrawContainerRef?.current?.parentElement) {
      const parentElement = this.excalidrawContainerRef.current.parentElement;
      const { left, top } = parentElement.getBoundingClientRect();
      return {
        offsetLeft:
          typeof offsets?.offsetLeft === "number" ? offsets.offsetLeft : left,
        offsetTop:
          typeof offsets?.offsetTop === "number" ? offsets.offsetTop : top,
      };
    }
    return {
      offsetLeft:
        typeof offsets?.offsetLeft === "number" ? offsets.offsetLeft : 0,
      offsetTop: typeof offsets?.offsetTop === "number" ? offsets.offsetTop : 0,
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
      history: SceneHistory;
      app: InstanceType<typeof App>;
      library: typeof Library;
      collab: InstanceType<
        typeof import("../excalidraw-app/collab/CollabWrapper").default
      >;
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
        return this.app.scene.getElementsIncludingDeleted();
      },
      set(elements: ExcalidrawElement[]) {
        return this.app.scene.replaceAllElements(elements);
      },
    },
    history: {
      configurable: true,
      get: () => history,
    },
    library: {
      configurable: true,
      value: Library,
    },
  });
}
export default App;
