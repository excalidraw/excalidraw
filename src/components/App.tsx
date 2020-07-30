import React from "react";

import rough from "roughjs/bin/rough";
import { RoughCanvas } from "roughjs/bin/canvas";
import { simplify, Point } from "points-on-curve";
import { SocketUpdateData } from "../types";

import {
  newElement,
  newTextElement,
  duplicateElement,
  resizeTest,
  isInvisiblySmallElement,
  isTextElement,
  textWysiwyg,
  getCommonBounds,
  getCursorForResizingElement,
  getPerfectElementSize,
  getNormalizedDimensions,
  getElementMap,
  getDrawingVersion,
  getSyncableElements,
  newLinearElement,
  resizeElements,
  getElementWithResizeHandler,
  getResizeOffsetXY,
  getResizeArrowDirection,
  getResizeHandlerFromCoords,
  isNonDeletedElement,
  updateTextElement,
  dragSelectedElements,
  getDragOffsetXY,
  dragNewElement,
} from "../element";
import {
  getElementsWithinSelection,
  isOverScrollBars,
  getElementAtPosition,
  getElementContainingPosition,
  getNormalizedZoom,
  getSelectedElements,
  isSomeElementSelected,
  calculateScrollCenter,
} from "../scene";
import {
  decryptAESGEM,
  saveToLocalStorage,
  loadScene,
  loadFromBlob,
  SOCKET_SERVER,
  SocketUpdateDataSource,
  exportCanvas,
} from "../data";
import Portal from "./Portal";

import { renderScene } from "../renderer";
import { AppState, GestureEvent, Gesture, ExcalidrawProps } from "../types";
import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeleted,
  ExcalidrawGenericElement,
} from "../element/types";

import { distance2d, isPathALoop, getGridPoint } from "../math";

import {
  isWritableElement,
  isInputLike,
  isToolIcon,
  debounce,
  distance,
  resetCursor,
  viewportCoordsToSceneCoords,
  sceneCoordsToViewportCoords,
  setCursorForShape,
  tupleToCoors,
} from "../utils";
import {
  KEYS,
  isArrowKey,
  getResizeCenterPointKey,
  getResizeWithSidesSameLengthKey,
  getRotateWithDiscreteAngleKey,
} from "../keys";

import { findShapeByKey } from "../shapes";
import { createHistory, SceneHistory } from "../history";

import ContextMenu from "./ContextMenu";

import { ActionManager } from "../actions/manager";
import "../actions";
import { actions } from "../actions/register";

import { ActionResult } from "../actions/types";
import { getDefaultAppState } from "../appState";
import { t, getLanguage } from "../i18n";

import {
  copyToAppClipboard,
  getClipboardContent,
  probablySupportsClipboardBlob,
  probablySupportsClipboardWriteText,
} from "../clipboard";
import { normalizeScroll } from "../scene";
import { getCenter, getDistance } from "../gesture";
import { createUndoAction, createRedoAction } from "../actions/actionHistory";

import {
  CURSOR_TYPE,
  ELEMENT_SHIFT_TRANSLATE_AMOUNT,
  ELEMENT_TRANSLATE_AMOUNT,
  POINTER_BUTTON,
  DRAGGING_THRESHOLD,
  TEXT_TO_CENTER_SNAP_THRESHOLD,
  LINE_CONFIRM_THRESHOLD,
  SCENE,
  EVENT,
  ENV,
  CANVAS_ONLY_ACTIONS,
  DEFAULT_VERTICAL_ALIGN,
  GRID_SIZE,
  LOCAL_STORAGE_KEY_COLLAB_FORCE_FLAG,
} from "../constants";
import {
  INITIAL_SCENE_UPDATE_TIMEOUT,
  TAP_TWICE_TIMEOUT,
  SYNC_FULL_SCENE_INTERVAL_MS,
  TOUCH_CTX_MENU_TIMEOUT,
} from "../time_constants";

import LayerUI from "./LayerUI";
import { ScrollBars, SceneState } from "../scene/types";
import { generateCollaborationLink, getCollaborationLinkData } from "../data";
import { mutateElement, newElementWith } from "../element/mutateElement";
import { invalidateShapeForElement } from "../renderer/renderElement";
import { unstable_batchedUpdates } from "react-dom";
import { isLinearElement } from "../element/typeChecks";
import { actionFinalize, actionDeleteSelected } from "../actions";
import {
  restoreUsernameFromLocalStorage,
  saveUsernameToLocalStorage,
  loadLibrary,
} from "../data/localStorage";

import throttle from "lodash.throttle";
import { LinearElementEditor } from "../element/linearElementEditor";
import {
  getSelectedGroupIds,
  selectGroupsForSelectedElements,
  isElementInGroup,
  getSelectedGroupIdForElement,
} from "../groups";
import { Library } from "../data/library";
import Scene from "../scene/Scene";

/**
 * @param func handler taking at most single parameter (event).
 */
const withBatchedUpdates = <
  TFunction extends ((event: any) => void) | (() => void)
>(
  func: Parameters<TFunction>["length"] extends 0 | 1 ? TFunction : never,
) =>
  ((event) => {
    unstable_batchedUpdates(func as TFunction, event);
  }) as TFunction;

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
let touchMoving = false;

let lastPointerUp: ((event: any) => void) | null = null;
const gesture: Gesture = {
  pointers: new Map(),
  lastCenter: null,
  initialDistance: null,
  initialScale: null,
};

type PointerDownState = Readonly<{
  // The first position at which pointerDown happened
  origin: Readonly<{ x: number; y: number }>;
  // Same as "origin" but snapped to the grid, if grid is on
  originInGrid: Readonly<{ x: number; y: number }>;
  // Scrollbar checks
  scrollbars: ReturnType<typeof isOverScrollBars>;
  // The previous pointer position
  lastCoords: { x: number; y: number };
  resize: {
    // Handle when resizing, might change during the pointer interaction
    handle: ReturnType<typeof resizeTest>;
    // This is determined on the initial pointer down event
    isResizing: boolean;
    // This is determined on the initial pointer down event
    offset: { x: number; y: number };
    // This is determined on the initial pointer down event
    arrowDirection: "origin" | "end";
    // This is a center point of selected elements determined on the initial pointer down event (for rotation only)
    center: { x: number; y: number };
    // This is a list of selected elements determined on the initial pointer down event (for rotation only)
    originalElements: readonly NonDeleted<ExcalidrawElement>[];
  };
  hit: {
    // The element the pointer is "hitting", is determined on the initial
    // pointer down event
    element: ExcalidrawElement | null;
    // This is determined on the initial pointer down event
    wasAddedToSelection: boolean;
    // Whether selected element(s) were duplicated, might change during the
    // pointer interation
    hasBeenDuplicated: boolean;
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
  };
}>;

class App extends React.Component<ExcalidrawProps, AppState> {
  canvas: HTMLCanvasElement | null = null;
  rc: RoughCanvas | null = null;
  portal: Portal = new Portal(this);
  lastBroadcastedOrReceivedSceneVersion: number = -1;
  broadcastedElementVersions: Map<string, number> = new Map();
  unmounted: boolean = false;
  actionManager: ActionManager;
  private excalidrawRef: any;

  public static defaultProps: Partial<ExcalidrawProps> = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  private scene: Scene;

  constructor(props: ExcalidrawProps) {
    super(props);
    const defaultAppState = getDefaultAppState();

    const { width, height } = props;
    this.state = {
      ...defaultAppState,
      isLoading: true,
      width,
      height,
      ...this.getCanvasOffsets(),
    };

    this.scene = new Scene();
    this.excalidrawRef = React.createRef();
    this.actionManager = new ActionManager(
      this.syncActionResult,
      () => this.state,
      () => this.scene.getElementsIncludingDeleted(),
    );
    this.actionManager.registerAll(actions);

    this.actionManager.registerAction(createUndoAction(history));
    this.actionManager.registerAction(createRedoAction(history));
  }

  public render() {
    const {
      zenModeEnabled,
      width: canvasDOMWidth,
      height: canvasDOMHeight,
      offsetTop,
      offsetLeft,
    } = this.state;

    const canvasScale = window.devicePixelRatio;

    const canvasWidth = canvasDOMWidth * canvasScale;
    const canvasHeight = canvasDOMHeight * canvasScale;

    return (
      <div
        className="excalidraw"
        ref={this.excalidrawRef}
        style={{
          width: canvasDOMWidth,
          height: canvasDOMHeight,
          top: offsetTop,
          left: offsetLeft,
        }}
      >
        <LayerUI
          canvas={this.canvas}
          appState={this.state}
          setAppState={this.setAppState}
          actionManager={this.actionManager}
          elements={this.scene.getElements()}
          onRoomCreate={this.openPortal}
          onRoomDestroy={this.closePortal}
          onUsernameChange={(username) => {
            saveUsernameToLocalStorage(username);
            this.setState({
              username,
            });
          }}
          onLockToggle={this.toggleLock}
          onInsertShape={(elements) =>
            this.addElementsFromPasteOrLibrary(elements)
          }
          zenModeEnabled={zenModeEnabled}
          toggleZenMode={this.toggleZenMode}
          lng={getLanguage().lng}
        />
        <main>
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
        </main>
      </div>
    );
  }

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
        this.setState(
          (state) => ({
            ...actionResult.appState,
            editingElement:
              editingElement || actionResult.appState?.editingElement || null,
            isCollaborating: state.isCollaborating,
            collaborators: state.collaborators,
            width: state.width,
            height: state.height,
            offsetTop: state.offsetTop,
            offsetLeft: state.offsetLeft,
          }),
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
    this.saveDebounced();
    this.saveDebounced.flush();
  });

  private onUnload = () => {
    this.destroySocketClient();
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

  private shouldForceLoadScene(
    scene: ResolutionType<typeof loadScene>,
  ): boolean {
    if (!scene.elements.length) {
      return true;
    }

    const roomMatch = getCollaborationLinkData(window.location.href);

    if (!roomMatch) {
      return false;
    }

    let collabForceLoadFlag;
    try {
      collabForceLoadFlag = localStorage?.getItem(
        LOCAL_STORAGE_KEY_COLLAB_FORCE_FLAG,
      );
    } catch {}

    if (collabForceLoadFlag) {
      try {
        const {
          room: previousRoom,
          timestamp,
        }: { room: string; timestamp: number } = JSON.parse(
          collabForceLoadFlag,
        );
        // if loading same room as the one previously unloaded within 15sec
        //  force reload without prompting
        if (previousRoom === roomMatch[1] && Date.now() - timestamp < 15000) {
          return true;
        }
      } catch {}
    }
    return false;
  }

  private initializeScene = async () => {
    const searchParams = new URLSearchParams(window.location.search);
    const id = searchParams.get("id");
    const jsonMatch = window.location.hash.match(
      /^#json=([0-9]+),([a-zA-Z0-9_-]+)$/,
    );

    if (!this.state.isLoading) {
      this.setState({ isLoading: true });
    }

    let scene = await loadScene(null);

    let isCollaborationScene = !!getCollaborationLinkData(window.location.href);
    const isExternalScene = !!(id || jsonMatch || isCollaborationScene);

    if (isExternalScene) {
      if (
        this.shouldForceLoadScene(scene) ||
        window.confirm(t("alerts.loadSceneOverridePrompt"))
      ) {
        // Backwards compatibility with legacy url format
        if (id) {
          scene = await loadScene(id);
        } else if (jsonMatch) {
          scene = await loadScene(jsonMatch[1], jsonMatch[2]);
        }
        if (!isCollaborationScene) {
          window.history.replaceState({}, "Excalidraw", window.location.origin);
        }
      } else {
        // https://github.com/excalidraw/excalidraw/issues/1919
        if (document.hidden) {
          window.addEventListener("focus", () => this.initializeScene(), {
            once: true,
          });
          return;
        }

        isCollaborationScene = false;
        window.history.replaceState({}, "Excalidraw", window.location.origin);
      }
    }

    if (this.state.isLoading) {
      this.setState({ isLoading: false });
    }

    if (isCollaborationScene) {
      this.initializeSocketClient({ showLoadingState: true });
    } else if (scene) {
      if (scene.appState) {
        scene.appState = {
          ...scene.appState,
          ...calculateScrollCenter(
            scene.elements,
            {
              ...scene.appState,
              offsetTop: this.state.offsetTop,
              offsetLeft: this.state.offsetLeft,
            },
            null,
          ),
        };
      }
      this.syncActionResult(scene);
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
    this.setState(this.getCanvasOffsets(), () => {
      this.initializeScene();
    });
  }

  public componentWillUnmount() {
    this.unmounted = true;
    this.removeEventListeners();
    this.scene.destroy();
    clearTimeout(touchTimeout);
  }

  private onResize = withBatchedUpdates(() => {
    this.scene
      .getElementsIncludingDeleted()
      .forEach((element) => invalidateShapeForElement(element));
    this.setState({});
  });

  private onHashChange = (event: HashChangeEvent) => {
    if (window.location.hash.length > 1) {
      this.initializeScene();
    }
  };

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
    window.removeEventListener(EVENT.HASHCHANGE, this.onHashChange, false);

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
    window.removeEventListener(EVENT.BEFORE_UNLOAD, this.beforeUnload);
  }

  private addEventListeners() {
    document.addEventListener(EVENT.COPY, this.onCopy);
    document.addEventListener(EVENT.PASTE, this.pasteFromClipboard);
    document.addEventListener(EVENT.CUT, this.onCut);

    document.addEventListener(EVENT.KEYDOWN, this.onKeyDown, false);
    document.addEventListener(EVENT.KEYUP, this.onKeyUp, { passive: true });
    document.addEventListener(
      EVENT.MOUSE_MOVE,
      this.updateCurrentCursorPosition,
    );
    window.addEventListener(EVENT.RESIZE, this.onResize, false);
    window.addEventListener(EVENT.UNLOAD, this.onUnload, false);
    window.addEventListener(EVENT.BLUR, this.onBlur, false);
    window.addEventListener(EVENT.DRAG_OVER, this.disableEvent, false);
    window.addEventListener(EVENT.DROP, this.disableEvent, false);
    window.addEventListener(EVENT.HASHCHANGE, this.onHashChange, false);

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
    window.addEventListener(EVENT.BEFORE_UNLOAD, this.beforeUnload);
  }

  private beforeUnload = withBatchedUpdates((event: BeforeUnloadEvent) => {
    if (this.state.isCollaborating && this.portal.roomID) {
      try {
        localStorage?.setItem(
          LOCAL_STORAGE_KEY_COLLAB_FORCE_FLAG,
          JSON.stringify({
            timestamp: Date.now(),
            room: this.portal.roomID,
          }),
        );
      } catch {}
    }
    if (this.state.isCollaborating && this.scene.getElements().length > 0) {
      event.preventDefault();
      // NOTE: modern browsers no longer allow showing a custom message here
      event.returnValue = "";
    }
  });

  queueBroadcastAllElements = throttle(() => {
    this.broadcastScene(SCENE.UPDATE, /* syncAll */ true);
  }, SYNC_FULL_SCENE_INTERVAL_MS);

  componentDidUpdate(prevProps: ExcalidrawProps) {
    const { width: prevWidth, height: prevHeight } = prevProps;
    const { width: currentWidth, height: currentHeight } = this.props;
    if (prevWidth !== currentWidth || prevHeight !== currentHeight) {
      this.setState({
        width: currentWidth,
        height: currentHeight,
        ...this.getCanvasOffsets(),
      });
    }

    if (this.state.isCollaborating && !this.portal.socket) {
      this.initializeSocketClient({ showLoadingState: true });
    }

    if (
      this.state.editingLinearElement &&
      !this.state.selectedElementIds[this.state.editingLinearElement.elementId]
    ) {
      // defer so that the commitToHistory flag isn't reset via current update
      setTimeout(() => {
        this.actionManager.executeAction(actionFinalize);
      });
    }

    const cursorButton: {
      [id: string]: string | undefined;
    } = {};
    const pointerViewportCoords: SceneState["remotePointerViewportCoords"] = {};
    const remoteSelectedElementIds: SceneState["remoteSelectedElementIds"] = {};
    const pointerUsernames: { [id: string]: string } = {};
    this.state.collaborators.forEach((user, socketID) => {
      if (user.selectedElementIds) {
        for (const id of Object.keys(user.selectedElementIds)) {
          if (!(id in remoteSelectedElementIds)) {
            remoteSelectedElementIds[id] = [];
          }
          remoteSelectedElementIds[id].push(socketID);
        }
      }
      if (!user.pointer) {
        return;
      }
      if (user.username) {
        pointerUsernames[socketID] = user.username;
      }
      pointerViewportCoords[socketID] = sceneCoordsToViewportCoords(
        {
          sceneX: user.pointer.x,
          sceneY: user.pointer.y,
        },
        this.state,
        this.canvas,
        window.devicePixelRatio,
      );
      cursorButton[socketID] = user.button;
    });
    const elements = this.scene.getElements();
    const { atLeastOneVisibleElement, scrollBars } = renderScene(
      elements.filter((element) => {
        // don't render text element that's being currently edited (it's
        //  rendered on remote only)
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
        remoteSelectedElementIds: remoteSelectedElementIds,
        remotePointerUsernames: pointerUsernames,
        shouldCacheIgnoreZoom: this.state.shouldCacheIgnoreZoom,
      },
      {
        renderOptimizations: true,
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
      this.setState({ scrolledOutside: scrolledOutside });
    }
    this.saveDebounced();

    if (
      getDrawingVersion(this.scene.getElementsIncludingDeleted()) >
      this.lastBroadcastedOrReceivedSceneVersion
    ) {
      this.broadcastScene(SCENE.UPDATE, /* syncAll */ false);
      this.queueBroadcastAllElements();
    }

    history.record(this.state, this.scene.getElementsIncludingDeleted());
  }

  // Copy/paste

  private onCut = withBatchedUpdates((event: ClipboardEvent) => {
    if (isWritableElement(event.target)) {
      return;
    }
    this.copyAll();
    this.actionManager.executeAction(actionDeleteSelected);
    event.preventDefault();
  });

  private onCopy = withBatchedUpdates((event: ClipboardEvent) => {
    if (isWritableElement(event.target)) {
      return;
    }
    this.copyAll();
    event.preventDefault();
  });

  private copyAll = () => {
    copyToAppClipboard(this.scene.getElements(), this.state);
  };

  private copyToClipboardAsPng = () => {
    const elements = this.scene.getElements();

    const selectedElements = getSelectedElements(elements, this.state);
    exportCanvas(
      "clipboard",
      selectedElements.length ? selectedElements : elements,
      this.state,
      this.canvas!,
      this.state,
    );
  };

  private copyToClipboardAsSvg = () => {
    const selectedElements = getSelectedElements(
      this.scene.getElements(),
      this.state,
    );
    exportCanvas(
      "clipboard-svg",
      selectedElements.length ? selectedElements : this.scene.getElements(),
      this.state,
      this.canvas!,
      this.state,
    );
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
      const { previousSelectedElementIds } = this.state;
      this.setState({
        previousSelectedElementIds: {},
        selectedElementIds: previousSelectedElementIds,
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
        //  thus these checks don't make sense
        event &&
        (!(elementUnderCursor instanceof HTMLCanvasElement) ||
          isWritableElement(target))
      ) {
        return;
      }
      const data = await getClipboardContent(
        this.state,
        cursorX,
        cursorY,
        event,
      );
      if (data.error) {
        alert(data.error);
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
      this.canvas,
      window.devicePixelRatio,
    );

    const dx = x - elementsCenterX;
    const dy = y - elementsCenterY;
    const groupIdMap = new Map();

    const newElements = clipboardElements.map((element) => {
      return duplicateElement(this.state.editingGroupId, groupIdMap, element, {
        x: element.x + dx - minX,
        y: element.y + dy - minY,
      });
    });

    this.scene.replaceAllElements([
      ...this.scene.getElementsIncludingDeleted(),
      ...newElements,
    ]);
    history.resumeRecording();
    this.setState({
      isLibraryOpen: false,
      selectedElementIds: newElements.reduce((map, element) => {
        map[element.id] = true;
        return map;
      }, {} as any),
    });
  };

  private addTextFromPaste(text: any) {
    const { x, y } = viewportCoordsToSceneCoords(
      { clientX: cursorX, clientY: cursorY },
      this.state,
      this.canvas,
      window.devicePixelRatio,
    );

    const element = newTextElement({
      x: x,
      y: y,
      strokeColor: this.state.currentItemStrokeColor,
      backgroundColor: this.state.currentItemBackgroundColor,
      fillStyle: this.state.currentItemFillStyle,
      strokeWidth: this.state.currentItemStrokeWidth,
      strokeStyle: this.state.currentItemStrokeStyle,
      roughness: this.state.currentItemRoughness,
      opacity: this.state.currentItemOpacity,
      text: text,
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
      touchMoving = false;
    }

    gesture.pointers.delete(event.pointerId);
  };

  openPortal = async () => {
    window.history.pushState(
      {},
      "Excalidraw",
      await generateCollaborationLink(),
    );
    this.initializeSocketClient({ showLoadingState: false });
  };

  closePortal = () => {
    window.history.pushState({}, "Excalidraw", window.location.origin);
    this.destroySocketClient();
  };

  toggleLock = () => {
    this.setState((prevState) => ({
      elementLocked: !prevState.elementLocked,
      elementType: prevState.elementLocked
        ? "selection"
        : prevState.elementType,
    }));
  };

  toggleZenMode = () => {
    this.setState({
      zenModeEnabled: !this.state.zenModeEnabled,
    });
  };

  toggleGridMode = () => {
    this.setState({
      gridSize: this.state.gridSize ? null : GRID_SIZE,
    });
  };

  private destroySocketClient = () => {
    this.setState({
      isCollaborating: false,
      collaborators: new Map(),
    });
    this.portal.close();
  };

  private initializeSocketClient = async (opts: {
    showLoadingState: boolean;
  }) => {
    if (this.portal.socket) {
      return;
    }
    const roomMatch = getCollaborationLinkData(window.location.href);
    if (roomMatch) {
      const initialize = () => {
        this.portal.socketInitialized = true;
        clearTimeout(initializationTimer);
        if (this.state.isLoading && !this.unmounted) {
          this.setState({ isLoading: false });
        }
      };
      // fallback in case you're not alone in the room but still don't receive
      //  initial SCENE_UPDATE message
      const initializationTimer = setTimeout(
        initialize,
        INITIAL_SCENE_UPDATE_TIMEOUT,
      );

      const updateScene = (
        decryptedData: SocketUpdateDataSource[SCENE.INIT | SCENE.UPDATE],
        { scrollToContent = false }: { scrollToContent?: boolean } = {},
      ) => {
        const { elements: remoteElements } = decryptedData.payload;

        if (scrollToContent) {
          this.setState({
            ...this.state,
            ...calculateScrollCenter(
              remoteElements.filter((element: { isDeleted: boolean }) => {
                return !element.isDeleted;
              }),
              this.state,
              this.canvas,
            ),
          });
        }

        // Perform reconciliation - in collaboration, if we encounter
        // elements with more staler versions than ours, ignore them
        // and keep ours.
        if (
          this.scene.getElementsIncludingDeleted() == null ||
          this.scene.getElementsIncludingDeleted().length === 0
        ) {
          this.scene.replaceAllElements(remoteElements);
        } else {
          // create a map of ids so we don't have to iterate
          // over the array more than once.
          const localElementMap = getElementMap(
            this.scene.getElementsIncludingDeleted(),
          );

          // Reconcile
          const newElements = remoteElements
            .reduce((elements, element) => {
              // if the remote element references one that's currently
              //  edited on local, skip it (it'll be added in the next
              //  step)
              if (
                element.id === this.state.editingElement?.id ||
                element.id === this.state.resizingElement?.id ||
                element.id === this.state.draggingElement?.id
              ) {
                return elements;
              }

              if (
                localElementMap.hasOwnProperty(element.id) &&
                localElementMap[element.id].version > element.version
              ) {
                elements.push(localElementMap[element.id]);
                delete localElementMap[element.id];
              } else if (
                localElementMap.hasOwnProperty(element.id) &&
                localElementMap[element.id].version === element.version &&
                localElementMap[element.id].versionNonce !==
                  element.versionNonce
              ) {
                // resolve conflicting edits deterministically by taking the one with the lowest versionNonce
                if (
                  localElementMap[element.id].versionNonce <
                  element.versionNonce
                ) {
                  elements.push(localElementMap[element.id]);
                } else {
                  // it should be highly unlikely that the two versionNonces are the same. if we are
                  // really worried about this, we can replace the versionNonce with the socket id.
                  elements.push(element);
                }
                delete localElementMap[element.id];
              } else {
                elements.push(element);
                delete localElementMap[element.id];
              }

              return elements;
            }, [] as Mutable<typeof remoteElements>)
            // add local elements that weren't deleted or on remote
            .concat(...Object.values(localElementMap));

          // Avoid broadcasting to the rest of the collaborators the scene
          // we just received!
          // Note: this needs to be set before replaceAllElements as it
          // syncronously calls render.
          this.lastBroadcastedOrReceivedSceneVersion = getDrawingVersion(
            newElements,
          );

          this.scene.replaceAllElements(newElements);
        }

        // We haven't yet implemented multiplayer undo functionality, so we clear the undo stack
        // when we receive any messages from another peer. This UX can be pretty rough -- if you
        // undo, a user makes a change, and then try to redo, your element(s) will be lost. However,
        // right now we think this is the right tradeoff.
        history.clear();
        if (!this.portal.socketInitialized) {
          initialize();
        }
      };

      const { default: socketIOClient }: any = await import(
        /* webpackChunkName: "socketIoClient" */ "socket.io-client"
      );

      this.portal.open(
        socketIOClient(SOCKET_SERVER),
        roomMatch[1],
        roomMatch[2],
      );

      // All socket listeners are moving to Portal
      this.portal.socket!.on(
        "client-broadcast",
        async (encryptedData: ArrayBuffer, iv: Uint8Array) => {
          if (!this.portal.roomKey) {
            return;
          }
          const decryptedData = await decryptAESGEM(
            encryptedData,
            this.portal.roomKey,
            iv,
          );

          switch (decryptedData.type) {
            case "INVALID_RESPONSE":
              return;
            case SCENE.INIT: {
              if (!this.portal.socketInitialized) {
                updateScene(decryptedData, { scrollToContent: true });
              }
              break;
            }
            case SCENE.UPDATE:
              updateScene(decryptedData);
              break;
            case "MOUSE_LOCATION": {
              const {
                socketID,
                pointerCoords,
                button,
                username,
                selectedElementIds,
              } = decryptedData.payload;
              this.setState((state) => {
                if (!state.collaborators.has(socketID)) {
                  state.collaborators.set(socketID, {});
                }
                const user = state.collaborators.get(socketID)!;
                user.pointer = pointerCoords;
                user.button = button;
                user.selectedElementIds = selectedElementIds;
                user.username = username;
                state.collaborators.set(socketID, user);
                return state;
              });
              break;
            }
          }
        },
      );
      this.portal.socket!.on("first-in-room", () => {
        if (this.portal.socket) {
          this.portal.socket.off("first-in-room");
        }
        initialize();
      });

      this.setState({
        isCollaborating: true,
        isLoading: opts.showLoadingState ? true : this.state.isLoading,
      });
    }
  };

  // Portal-only
  setCollaborators(sockets: string[]) {
    this.setState((state) => {
      const collaborators: typeof state.collaborators = new Map();
      for (const socketID of sockets) {
        if (state.collaborators.has(socketID)) {
          collaborators.set(socketID, state.collaborators.get(socketID)!);
        } else {
          collaborators.set(socketID, {});
        }
      }
      return {
        ...state,
        collaborators,
      };
    });
  }

  private broadcastMouseLocation = (payload: {
    pointerCoords: SocketUpdateDataSource["MOUSE_LOCATION"]["payload"]["pointerCoords"];
    button: SocketUpdateDataSource["MOUSE_LOCATION"]["payload"]["button"];
  }) => {
    if (this.portal.socket?.id) {
      const data: SocketUpdateDataSource["MOUSE_LOCATION"] = {
        type: "MOUSE_LOCATION",
        payload: {
          socketID: this.portal.socket.id,
          pointerCoords: payload.pointerCoords,
          button: payload.button || "up",
          selectedElementIds: this.state.selectedElementIds,
          username: this.state.username,
        },
      };
      return this.portal._broadcastSocketData(
        data as SocketUpdateData,
        true, // volatile
      );
    }
  };

  // maybe should move to Portal
  broadcastScene = (sceneType: SCENE.INIT | SCENE.UPDATE, syncAll: boolean) => {
    if (sceneType === SCENE.INIT && !syncAll) {
      throw new Error("syncAll must be true when sending SCENE.INIT");
    }

    let syncableElements = getSyncableElements(
      this.scene.getElementsIncludingDeleted(),
    );

    if (!syncAll) {
      // sync out only the elements we think we need to to save bandwidth.
      // periodically we'll resync the whole thing to make sure no one diverges
      // due to a dropped message (server goes down etc).
      syncableElements = syncableElements.filter(
        (syncableElement) =>
          !this.broadcastedElementVersions.has(syncableElement.id) ||
          syncableElement.version >
            this.broadcastedElementVersions.get(syncableElement.id)!,
      );
    }

    const data: SocketUpdateDataSource[typeof sceneType] = {
      type: sceneType,
      payload: {
        elements: syncableElements,
      },
    };
    this.lastBroadcastedOrReceivedSceneVersion = Math.max(
      this.lastBroadcastedOrReceivedSceneVersion,
      getDrawingVersion(this.scene.getElementsIncludingDeleted()),
    );
    for (const syncableElement of syncableElements) {
      this.broadcastedElementVersions.set(
        syncableElement.id,
        syncableElement.version,
      );
    }
    return this.portal._broadcastSocketData(data as SocketUpdateData);
  };

  private onSceneUpdated = () => {
    this.setState({});
  };

  private updateCurrentCursorPosition = withBatchedUpdates(
    (event: MouseEvent) => {
      cursorX = event.x;
      cursorY = event.y;
    },
  );

  restoreUserName() {
    const username = restoreUsernameFromLocalStorage();

    if (username !== null) {
      this.setState({
        username,
      });
    }
  }

  // Input handling

  private onKeyDown = withBatchedUpdates((event: KeyboardEvent) => {
    // ensures we don't prevent devTools select-element feature
    if (event[KEYS.CTRL_OR_CMD] && event.shiftKey && event.key === "C") {
      return;
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
        showShortcutsDialog: true,
      });
    }

    if (
      !event[KEYS.CTRL_OR_CMD] &&
      event.altKey &&
      event.keyCode === KEYS.Z_KEY_CODE
    ) {
      this.toggleZenMode();
    }

    if (event[KEYS.CTRL_OR_CMD] && event.keyCode === KEYS.GRID_KEY_CODE) {
      this.toggleGridMode();
    }

    if (event.code === "KeyC" && event.altKey && event.shiftKey) {
      this.copyToClipboardAsPng();
      event.preventDefault();
      return;
    }

    if (this.actionManager.handleKeyDown(event)) {
      return;
    }

    if (event.code === "Digit9") {
      this.setState({ isLibraryOpen: !this.state.isLibraryOpen });
    }

    if (isArrowKey(event.key)) {
      const step =
        (this.state.gridSize &&
          (event.shiftKey ? ELEMENT_TRANSLATE_AMOUNT : this.state.gridSize)) ||
        (event.shiftKey
          ? ELEMENT_SHIFT_TRANSLATE_AMOUNT
          : ELEMENT_TRANSLATE_AMOUNT);
      this.scene.replaceAllElements(
        this.scene.getElementsIncludingDeleted().map((el) => {
          if (this.state.selectedElementIds[el.id]) {
            const update: { x?: number; y?: number } = {};
            if (event.key === KEYS.ARROW_LEFT) {
              update.x = el.x - step;
            } else if (event.key === KEYS.ARROW_RIGHT) {
              update.x = el.x + step;
            } else if (event.key === KEYS.ARROW_UP) {
              update.y = el.y - step;
            } else if (event.key === KEYS.ARROW_DOWN) {
              update.y = el.y + step;
            }
            return newElementWith(el, update);
          }
          return el;
        }),
      );
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
      } else if (event.key === "q") {
        this.toggleLock();
      }
    }
    if (event.key === KEYS.SPACE && gesture.pointers.size === 0) {
      isHoldingSpace = true;
      document.documentElement.style.cursor = CURSOR_TYPE.GRABBING;
    }
  });

  private onKeyUp = withBatchedUpdates((event: KeyboardEvent) => {
    if (event.key === KEYS.SPACE) {
      if (this.state.elementType === "selection") {
        resetCursor();
      } else {
        setCursorForShape(this.state.elementType);
        this.setState({
          selectedElementIds: {},
          selectedGroupIds: {},
          editingGroupId: null,
        });
      }
      isHoldingSpace = false;
    }
  });

  private selectShapeTool(elementType: AppState["elementType"]) {
    if (!isHoldingSpace) {
      setCursorForShape(elementType);
    }
    if (isToolIcon(document.activeElement)) {
      document.activeElement.blur();
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
    gesture.initialScale = this.state.zoom;
  });

  private onGestureChange = withBatchedUpdates((event: GestureEvent) => {
    event.preventDefault();

    this.setState({
      zoom: getNormalizedZoom(gesture.initialScale! * event.scale),
    });
  });

  private onGestureEnd = withBatchedUpdates((event: GestureEvent) => {
    event.preventDefault();
    const { previousSelectedElementIds } = this.state;
    this.setState({
      previousSelectedElementIds: {},
      selectedElementIds: previousSelectedElementIds,
    });
    gesture.initialScale = null;
  });

  private setElements = (elements: readonly ExcalidrawElement[]) => {
    this.scene.replaceAllElements(elements);
  };

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
      getViewportCoords: (x, y) => {
        const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
          {
            sceneX: x,
            sceneY: y,
          },
          this.state,
          this.canvas,
          window.devicePixelRatio,
        );
        return [viewportX, viewportY];
      },
      onChange: withBatchedUpdates((text) => {
        updateElement(text);
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
        }
        if (!isDeleted || isExistingElement) {
          history.resumeRecording();
        }

        this.setState({
          draggingElement: null,
          editingElement: null,
        });
        if (this.state.elementLocked) {
          setCursorForShape(this.state.elementType);
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
    //  modifying element's x/y for sake of editor (case: syncing to remote)
    updateElement(element.text);
  }

  private getTextElementAtPosition(
    x: number,
    y: number,
  ): NonDeleted<ExcalidrawTextElement> | null {
    const element = getElementAtPosition(
      this.scene.getElements(),
      this.state,
      x,
      y,
      this.state.zoom,
    );

    if (element && isTextElement(element) && !element.isDeleted) {
      return element;
    }
    return null;
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
      //  verticalAlign to default because it's currently internal-only
      if (!parentCenterPosition || element.textAlign !== "center") {
        mutateElement(element, { verticalAlign: DEFAULT_VERTICAL_ALIGN });
      }
    } else {
      this.scene.replaceAllElements([
        ...this.scene.getElementsIncludingDeleted(),
        element,
      ]);

      // case: creating new text not centered to parent elemenent → offset Y
      //  so that the text is centered to cursor position
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
    //  text and enter multiElement mode
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

    resetCursor();

    const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
      event,
      this.state,
      this.canvas,
      window.devicePixelRatio,
    );

    const selectedGroupIds = getSelectedGroupIds(this.state);

    if (selectedGroupIds.length > 0) {
      const elements = this.scene.getElements();
      const hitElement = getElementAtPosition(
        elements,
        this.state,
        sceneX,
        sceneY,
        this.state.zoom,
      );

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

    resetCursor();

    this.startTextEditing({
      sceneX,
      sceneY,
      insertAtParentCenter: !event.altKey,
    });
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

    if (gesture.pointers.size === 2) {
      const center = getCenter(gesture.pointers);
      const deltaX = center.x - gesture.lastCenter!.x;
      const deltaY = center.y - gesture.lastCenter!.y;
      gesture.lastCenter = center;

      const distance = getDistance(Array.from(gesture.pointers.values()));
      const scaleFactor = distance / gesture.initialDistance!;

      this.setState({
        scrollX: normalizeScroll(this.state.scrollX + deltaX / this.state.zoom),
        scrollY: normalizeScroll(this.state.scrollY + deltaY / this.state.zoom),
        zoom: getNormalizedZoom(gesture.initialScale! * scaleFactor),
        shouldCacheIgnoreZoom: true,
      });
      this.resetShouldCacheIgnoreZoomDebounced();
    } else {
      gesture.lastCenter = gesture.initialDistance = gesture.initialScale = null;
    }

    if (isHoldingSpace || isPanning || isDraggingScrollBar) {
      return;
    }
    const isPointerOverScrollBars = isOverScrollBars(
      currentScrollBars,
      event.clientX,
      event.clientY,
    );
    const isOverScrollBar = isPointerOverScrollBars.isOverEither;
    if (!this.state.draggingElement && !this.state.multiElement) {
      if (isOverScrollBar) {
        resetCursor();
      } else {
        setCursorForShape(this.state.elementType);
      }
    }

    const { x: scenePointerX, y: scenePointerY } = viewportCoordsToSceneCoords(
      event,
      this.state,
      this.canvas,
      window.devicePixelRatio,
    );

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
    }

    if (this.state.multiElement) {
      const { multiElement } = this.state;
      const { x: rx, y: ry } = multiElement;

      const { points, lastCommittedPoint } = multiElement;
      const lastPoint = points[points.length - 1];

      setCursorForShape(this.state.elementType);

      if (lastPoint === lastCommittedPoint) {
        // if we haven't yet created a temp point and we're beyond commit-zone
        //  threshold, add a point
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
          document.documentElement.style.cursor = CURSOR_TYPE.POINTER;
          // in this branch, we're inside the commit zone, and no uncommitted
          //  point exists. Thus do nothing (don't add/remove points).
        }
      } else {
        // cursor moved inside commit zone, and there's uncommitted point,
        //  thus remove it
        if (
          points.length > 2 &&
          lastCommittedPoint &&
          distance2d(
            scenePointerX - rx,
            scenePointerY - ry,
            lastCommittedPoint[0],
            lastCommittedPoint[1],
          ) < LINE_CONFIRM_THRESHOLD
        ) {
          document.documentElement.style.cursor = CURSOR_TYPE.POINTER;
          mutateElement(multiElement, {
            points: points.slice(0, -1),
          });
        } else {
          if (isPathALoop(points)) {
            document.documentElement.style.cursor = CURSOR_TYPE.POINTER;
          }
          // update last uncommitted point
          mutateElement(multiElement, {
            points: [
              ...points.slice(0, -1),
              [scenePointerX - rx, scenePointerY - ry],
            ],
          });
        }
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
      const elementWithResizeHandler = getElementWithResizeHandler(
        elements,
        this.state,
        scenePointerX,
        scenePointerY,
        this.state.zoom,
        event.pointerType,
      );
      if (elementWithResizeHandler && elementWithResizeHandler.resizeHandle) {
        document.documentElement.style.cursor = getCursorForResizingElement(
          elementWithResizeHandler,
        );
        return;
      }
    } else if (selectedElements.length > 1 && !isOverScrollBar) {
      const resizeHandle = getResizeHandlerFromCoords(
        getCommonBounds(selectedElements),
        scenePointerX,
        scenePointerY,
        this.state.zoom,
        event.pointerType,
      );
      if (resizeHandle) {
        document.documentElement.style.cursor = getCursorForResizingElement({
          resizeHandle,
        });
        return;
      }
    }
    const hitElement = getElementAtPosition(
      elements,
      this.state,
      scenePointerX,
      scenePointerY,
      this.state.zoom,
    );
    if (this.state.elementType === "text") {
      document.documentElement.style.cursor = isTextElement(hitElement)
        ? CURSOR_TYPE.TEXT
        : CURSOR_TYPE.CROSSHAIR;
    } else {
      document.documentElement.style.cursor =
        hitElement && !isOverScrollBar ? "move" : "";
    }
  };

  // set touch moving for mobile context menu
  private handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    touchMoving = true;
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
    //  of defocusing potentially focused element, which is what we
    //  want when clicking inside the canvas.
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

    lastPointerUp = onPointerUp;

    window.addEventListener(EVENT.POINTER_MOVE, onPointerMove);
    window.addEventListener(EVENT.POINTER_UP, onPointerUp);
    pointerDownState.eventListeners.onMove = onPointerMove;
    pointerDownState.eventListeners.onUp = onPointerUp;
  };

  private maybeOpenContextMenuAfterPointerDownOnTouchDevices = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ): void => {
    // deal with opening context menu on touch devices
    if (event.pointerType === "touch") {
      touchMoving = false;

      // open the context menu with the first touch's clientX and clientY
      // if the touch is not moving
      touchTimeout = window.setTimeout(() => {
        if (!touchMoving) {
          this.openContextMenu({
            clientX: event.clientX,
            clientY: event.clientY,
          });
        }
      }, TOUCH_CTX_MENU_TIMEOUT);
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
          (event.button === POINTER_BUTTON.MAIN && isHoldingSpace))
      )
    ) {
      return false;
    }
    isPanning = true;

    let nextPastePrevented = false;
    const isLinux = /Linux/.test(window.navigator.platform);

    document.documentElement.style.cursor = CURSOR_TYPE.GRABBING;
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
        scrollX: normalizeScroll(this.state.scrollX - deltaX / this.state.zoom),
        scrollY: normalizeScroll(this.state.scrollY - deltaY / this.state.zoom),
      });
    });
    const teardown = withBatchedUpdates(
      (lastPointerUp = () => {
        lastPointerUp = null;
        isPanning = false;
        if (!isHoldingSpace) {
          setCursorForShape(this.state.elementType);
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
      gesture.initialScale = this.state.zoom;
      gesture.initialDistance = getDistance(
        Array.from(gesture.pointers.values()),
      );
    }
  }

  private initialPointerDownState(
    event: React.PointerEvent<HTMLCanvasElement>,
  ): PointerDownState {
    const origin = viewportCoordsToSceneCoords(
      event,
      this.state,
      this.canvas,
      window.devicePixelRatio,
    );
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
        event.clientX,
        event.clientY,
      ),
      // we need to duplicate because we'll be updating this state
      lastCoords: { ...origin },
      resize: {
        handle: false as ReturnType<typeof resizeTest>,
        isResizing: false,
        offset: { x: 0, y: 0 },
        arrowDirection: "origin",
        center: { x: (maxX + minX) / 2, y: (maxY + minY) / 2 },
        originalElements: selectedElements.map((element) => ({ ...element })),
      },
      hit: {
        element: null,
        wasAddedToSelection: false,
        hasBeenDuplicated: false,
      },
      drag: {
        hasOccurred: false,
        offset: null,
      },
      eventListeners: {
        onMove: null,
        onUp: null,
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

      if (pointerDownState.scrollbars.isOverHorizontal) {
        const x = event.clientX;
        const dx = x - pointerDownState.lastCoords.x;
        this.setState({
          scrollX: normalizeScroll(this.state.scrollX - dx / this.state.zoom),
        });
        pointerDownState.lastCoords.x = x;
        return;
      }

      if (pointerDownState.scrollbars.isOverVertical) {
        const y = event.clientY;
        const dy = y - pointerDownState.lastCoords.y;
        this.setState({
          scrollY: normalizeScroll(this.state.scrollY - dy / this.state.zoom),
        });
        pointerDownState.lastCoords.y = y;
      }
    });

    const onPointerUp = withBatchedUpdates(() => {
      isDraggingScrollBar = false;
      setCursorForShape(this.state.elementType);
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

  // Returns whether the pointer event has been completely handled
  private handleSelectionOnPointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>,
    pointerDownState: PointerDownState,
  ): boolean => {
    if (this.state.elementType === "selection") {
      const elements = this.scene.getElements();
      const selectedElements = getSelectedElements(elements, this.state);
      if (selectedElements.length === 1 && !this.state.editingLinearElement) {
        const elementWithResizeHandler = getElementWithResizeHandler(
          elements,
          this.state,
          pointerDownState.origin.x,
          pointerDownState.origin.y,
          this.state.zoom,
          event.pointerType,
        );
        if (elementWithResizeHandler != null) {
          this.setState({
            resizingElement: elementWithResizeHandler.element,
          });
          pointerDownState.resize.handle =
            elementWithResizeHandler.resizeHandle;
        }
      } else if (selectedElements.length > 1) {
        pointerDownState.resize.handle = getResizeHandlerFromCoords(
          getCommonBounds(selectedElements),
          pointerDownState.origin.x,
          pointerDownState.origin.y,
          this.state.zoom,
          event.pointerType,
        );
      }
      if (pointerDownState.resize.handle) {
        document.documentElement.style.cursor = getCursorForResizingElement({
          resizeHandle: pointerDownState.resize.handle,
        });
        pointerDownState.resize.isResizing = true;
        pointerDownState.resize.offset = tupleToCoors(
          getResizeOffsetXY(
            pointerDownState.resize.handle,
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
            pointerDownState.resize.handle,
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
            pointerDownState.origin.x,
            pointerDownState.origin.y,
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
          getElementAtPosition(
            elements,
            this.state,
            pointerDownState.origin.x,
            pointerDownState.origin.y,
            this.state.zoom,
          );

        this.maybeClearSelectionWhenHittingElement(
          event,
          pointerDownState.hit.element,
        );

        // If we click on something
        const hitElement = pointerDownState.hit.element;
        if (hitElement != null) {
          // deselect if item is selected
          // if shift is not clicked, this will always return true
          // otherwise, it will trigger selection based on current
          // state of the box
          if (!this.state.selectedElementIds[hitElement.id]) {
            // if we are currently editing a group, treat all selections outside of the group
            // as exiting editing mode.
            if (
              this.state.editingGroupId &&
              !isElementInGroup(hitElement, this.state.editingGroupId)
            ) {
              this.setState({
                selectedElementIds: {},
                selectedGroupIds: {},
                editingGroupId: null,
              });
              return true;
            }
            this.setState((prevState) => {
              return selectGroupsForSelectedElements(
                {
                  ...prevState,
                  selectedElementIds: {
                    ...prevState.selectedElementIds,
                    [hitElement!.id]: true,
                  },
                },
                this.scene.getElements(),
              );
            });
            // TODO: this is strange...
            this.scene.replaceAllElements(
              this.scene.getElementsIncludingDeleted(),
            );
            pointerDownState.hit.wasAddedToSelection = true;
          }
        }

        const { selectedElementIds } = this.state;
        this.setState({
          previousSelectedElementIds: selectedElementIds,
        });
      }
    }
    return false;
  };

  private handleTextOnPointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>,
    pointerDownState: PointerDownState,
  ): void => {
    // if we're currently still editing text, clicking outside
    //  should only finalize it, not create another (irrespective
    //  of state.elementLocked)
    if (this.state.editingElement?.type === "text") {
      return;
    }

    this.startTextEditing({
      sceneX: pointerDownState.origin.x,
      sceneY: pointerDownState.origin.y,
      insertAtParentCenter: !event.altKey,
    });

    resetCursor();
    if (!this.state.elementLocked) {
      this.setState({
        elementType: "selection",
      });
    }
  };

  private handleLinearElementOnPointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>,
    elementType: "draw" | "line" | "arrow",
    pointerDownState: PointerDownState,
  ): void => {
    if (this.state.multiElement) {
      const { multiElement } = this.state;

      // finalize if completing a loop
      if (multiElement.type === "line" && isPathALoop(multiElement.points)) {
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
      //  point
      mutateElement(multiElement, {
        lastCommittedPoint: multiElement.points[multiElement.points.length - 1],
      });
      document.documentElement.style.cursor = CURSOR_TYPE.POINTER;
    } else {
      const [gridX, gridY] = getGridPoint(
        pointerDownState.origin.x,
        pointerDownState.origin.y,
        elementType === "draw" ? null : this.state.gridSize,
      );
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
      this.scene.replaceAllElements([
        ...this.scene.getElementsIncludingDeleted(),
        element,
      ]);
      this.setState({
        draggingElement: element,
        editingElement: element,
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

      if (pointerDownState.scrollbars.isOverHorizontal) {
        const x = event.clientX;
        const dx = x - pointerDownState.lastCoords.x;
        this.setState({
          scrollX: normalizeScroll(this.state.scrollX - dx / this.state.zoom),
        });
        pointerDownState.lastCoords.x = x;
        return;
      }

      if (pointerDownState.scrollbars.isOverVertical) {
        const y = event.clientY;
        const dy = y - pointerDownState.lastCoords.y;
        this.setState({
          scrollY: normalizeScroll(this.state.scrollY - dy / this.state.zoom),
        });
        pointerDownState.lastCoords.y = y;
        return;
      }

      const { x, y } = viewportCoordsToSceneCoords(
        event,
        this.state,
        this.canvas,
        window.devicePixelRatio,
      );
      const [gridX, gridY] = getGridPoint(x, y, this.state.gridSize);

      // for arrows/lines, don't start dragging until a given threshold
      //  to ensure we don't create a 2-point arrow by mistake when
      //  user clicks mouse in a way that it moves a tiny bit (thus
      //  triggering pointermove)
      if (
        !pointerDownState.drag.hasOccurred &&
        (this.state.elementType === "arrow" ||
          this.state.elementType === "line")
      ) {
        if (
          distance2d(
            x,
            y,
            pointerDownState.origin.x,
            pointerDownState.origin.y,
          ) < DRAGGING_THRESHOLD
        ) {
          return;
        }
      }

      if (pointerDownState.resize.isResizing) {
        const selectedElements = getSelectedElements(
          this.scene.getElements(),
          this.state,
        );
        const resizeHandle = pointerDownState.resize.handle;
        this.setState({
          // TODO: rename this state field to "isScaling" to distinguish
          // it from the generic "isResizing" which includes scaling and
          // rotating
          isResizing: resizeHandle && resizeHandle !== "rotation",
          isRotating: resizeHandle === "rotation",
        });
        const [resizeX, resizeY] = getGridPoint(
          x - pointerDownState.resize.offset.x,
          y - pointerDownState.resize.offset.y,
          this.state.gridSize,
        );
        if (
          resizeElements(
            resizeHandle,
            (newResizeHandle) => {
              pointerDownState.resize.handle = newResizeHandle;
            },
            selectedElements,
            pointerDownState.resize.arrowDirection,
            getRotateWithDiscreteAngleKey(event),
            getResizeWithSidesSameLengthKey(event),
            getResizeCenterPointKey(event),
            resizeX,
            resizeY,
            pointerDownState.resize.center.x,
            pointerDownState.resize.center.y,
            pointerDownState.resize.originalElements,
          )
        ) {
          return;
        }
      }

      if (this.state.editingLinearElement) {
        const didDrag = LinearElementEditor.handlePointDragging(
          this.state,
          (appState) => this.setState(appState),
          x,
          y,
        );

        if (didDrag) {
          pointerDownState.lastCoords.x = x;
          pointerDownState.lastCoords.y = y;
          return;
        }
      }

      const hitElement = pointerDownState.hit.element;
      if (hitElement && this.state.selectedElementIds[hitElement.id]) {
        // Marking that click was used for dragging to check
        // if elements should be deselected on pointerup
        pointerDownState.drag.hasOccurred = true;
        const selectedElements = getSelectedElements(
          this.scene.getElements(),
          this.state,
        );
        if (selectedElements.length > 0) {
          const [dragX, dragY] = getGridPoint(
            x - pointerDownState.drag.offset.x,
            y - pointerDownState.drag.offset.y,
            this.state.gridSize,
          );
          dragSelectedElements(selectedElements, dragX, dragY);

          // We duplicate the selected element if alt is pressed on pointer move
          if (event.altKey && !pointerDownState.hit.hasBeenDuplicated) {
            // Move the currently selected elements to the top of the z index stack, and
            // put the duplicates where the selected elements used to be.
            // (the origin point where the dragging started)

            pointerDownState.hit.hasBeenDuplicated = true;

            const nextElements = [];
            const elementsToAppend = [];
            const groupIdMap = new Map();
            for (const element of this.scene.getElementsIncludingDeleted()) {
              if (
                this.state.selectedElementIds[element.id] ||
                // case: the state.selectedElementIds might not have been
                //  updated yet by the time this mousemove event is fired
                (element.id === hitElement.id &&
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
              } else {
                nextElements.push(element);
              }
            }
            this.scene.replaceAllElements([
              ...nextElements,
              ...elementsToAppend,
            ]);
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
          dx = x - draggingElement.x;
          dy = y - draggingElement.y;
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
              points: simplify([...(points as Point[]), [dx, dy]], 0.7),
            });
          } else {
            mutateElement(draggingElement, {
              points: [...points.slice(0, -1), [dx, dy]],
            });
          }
        }
      } else if (draggingElement.type === "selection") {
        dragNewElement(
          draggingElement,
          this.state.elementType,
          pointerDownState.origin.x,
          pointerDownState.origin.y,
          x,
          y,
          distance(pointerDownState.origin.x, x),
          distance(pointerDownState.origin.y, y),
          getResizeWithSidesSameLengthKey(event),
          getResizeCenterPointKey(event),
        );
      } else {
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
      } = this.state;

      this.setState({
        isResizing: false,
        isRotating: false,
        resizingElement: null,
        selectionElement: null,
        cursorButton: "up",
        // text elements are reset on finalize, and resetting on pointerup
        //  may cause issues with double taps
        editingElement:
          multiElement || isTextElement(this.state.editingElement)
            ? this.state.editingElement
            : null,
      });

      this.savePointer(childEvent.clientX, childEvent.clientY, "up");

      // if moving start/end point towards start/end point within threshold,
      //  close the loop
      if (this.state.editingLinearElement) {
        const editingLinearElement = LinearElementEditor.handlePointerUp(
          this.state.editingLinearElement,
        );
        if (editingLinearElement !== this.state.editingLinearElement) {
          this.setState({ editingLinearElement });
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

      if (draggingElement?.type === "draw") {
        this.actionManager.executeAction(actionFinalize);
        return;
      }
      if (isLinearElement(draggingElement)) {
        if (draggingElement!.points.length > 1) {
          history.resumeRecording();
        }
        if (
          !pointerDownState.drag.hasOccurred &&
          draggingElement &&
          !multiElement
        ) {
          const { x, y } = viewportCoordsToSceneCoords(
            childEvent,
            this.state,
            this.canvas,
            window.devicePixelRatio,
          );
          mutateElement(draggingElement, {
            points: [
              ...draggingElement.points,
              [x - draggingElement.x, y - draggingElement.y],
            ],
          });
          this.setState({
            multiElement: draggingElement,
            editingElement: this.state.draggingElement,
          });
        } else if (pointerDownState.drag.hasOccurred && !multiElement) {
          if (!elementLocked) {
            resetCursor();
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

      // If click occurred on already selected element
      // it is needed to remove selection from other elements
      // or if SHIFT or META key pressed remove selection
      // from hitted element
      //
      // If click occurred and elements were dragged or some element
      // was added to selection (on pointerdown phase) we need to keep
      // selection unchanged
      const hitElement = pointerDownState.hit.element;
      if (
        getSelectedGroupIds(this.state).length === 0 &&
        hitElement &&
        !pointerDownState.drag.hasOccurred &&
        !pointerDownState.hit.wasAddedToSelection
      ) {
        if (childEvent.shiftKey) {
          this.setState((prevState) => ({
            selectedElementIds: {
              ...prevState.selectedElementIds,
              [hitElement!.id]: false,
            },
          }));
        } else {
          this.setState((_prevState) => ({
            selectedElementIds: { [hitElement!.id]: true },
          }));
        }
      }

      if (draggingElement === null) {
        // if no element is clicked, clear the selection and redraw
        this.setState({
          selectedElementIds: {},
          selectedGroupIds: {},
          editingGroupId: null,
        });
        return;
      }

      if (!elementLocked) {
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

      if (!elementLocked) {
        resetCursor();
        this.setState({
          draggingElement: null,
          elementType: "selection",
        });
      } else {
        this.setState({
          draggingElement: null,
        });
      }
    });
  }

  private maybeClearSelectionWhenHittingElement(
    event: React.PointerEvent<HTMLCanvasElement>,
    hitElement: ExcalidrawElement | null,
  ): void {
    const isHittingASelectedElement =
      hitElement != null && this.state.selectedElementIds[hitElement.id];

    // clear selection if shift is not clicked
    if (isHittingASelectedElement || event.shiftKey) {
      return;
    }
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
    const { selectedElementIds } = this.state;
    this.setState({
      selectedElementIds: {},
      previousSelectedElementIds: selectedElementIds,
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

  private handleCanvasOnDrop = (event: React.DragEvent<HTMLCanvasElement>) => {
    const libraryShapes = event.dataTransfer.getData(
      "application/vnd.excalidrawlib+json",
    );
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
      loadFromBlob(file, this.state)
        .then(({ elements, appState }) =>
          this.syncActionResult({
            elements,
            appState: {
              ...(appState || this.state),
              isLoading: false,
            },
            commitToHistory: false,
          }),
        )
        .catch((error) => {
          this.setState({ isLoading: false, errorMessage: error.message });
        });
    } else if (
      file?.type === "application/vnd.excalidrawlib+json" ||
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
      this.canvas,
      window.devicePixelRatio,
    );

    const elements = this.scene.getElements();
    const element = getElementAtPosition(
      elements,
      this.state,
      x,
      y,
      this.state.zoom,
    );
    if (!element) {
      ContextMenu.push({
        options: [
          navigator.clipboard && {
            label: t("labels.paste"),
            action: () => this.pasteFromClipboard(null),
          },
          probablySupportsClipboardBlob &&
            elements.length > 0 && {
              label: t("labels.copyAsPng"),
              action: this.copyToClipboardAsPng,
            },
          probablySupportsClipboardWriteText &&
            elements.length > 0 && {
              label: t("labels.copyAsSvg"),
              action: this.copyToClipboardAsSvg,
            },
          ...this.actionManager.getContextMenuItems((action) =>
            CANVAS_ONLY_ACTIONS.includes(action.name),
          ),
          {
            label: t("labels.toggleGridMode"),
            action: this.toggleGridMode,
          },
        ],
        top: clientY,
        left: clientX,
      });
      return;
    }

    if (!this.state.selectedElementIds[element.id]) {
      this.setState({ selectedElementIds: { [element.id]: true } });
    }

    ContextMenu.push({
      options: [
        navigator.clipboard && {
          label: t("labels.copy"),
          action: this.copyAll,
        },
        navigator.clipboard && {
          label: t("labels.paste"),
          action: () => this.pasteFromClipboard(null),
        },
        probablySupportsClipboardBlob && {
          label: t("labels.copyAsPng"),
          action: this.copyToClipboardAsPng,
        },
        probablySupportsClipboardWriteText && {
          label: t("labels.copyAsSvg"),
          action: this.copyToClipboardAsSvg,
        },
        ...this.actionManager.getContextMenuItems(
          (action) => !CANVAS_ONLY_ACTIONS.includes(action.name),
        ),
      ],
      top: clientY,
      left: clientX,
    });
  };

  private handleWheel = withBatchedUpdates((event: WheelEvent) => {
    event.preventDefault();
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
      this.setState(({ zoom }) => ({
        zoom: getNormalizedZoom(zoom - delta / 100),
        selectedElementIds: {},
        previousSelectedElementIds:
          Object.keys(selectedElementIds).length !== 0
            ? selectedElementIds
            : previousSelectedElementIds,
      }));
      return;
    }

    // scroll horizontally when shift pressed
    if (event.shiftKey) {
      this.setState(({ zoom, scrollX }) => ({
        // on Mac, shift+wheel tends to result in deltaX
        scrollX: normalizeScroll(scrollX - (deltaY || deltaX) / zoom),
      }));
      return;
    }

    this.setState(({ zoom, scrollX, scrollY }) => ({
      scrollX: normalizeScroll(scrollX - deltaX / zoom),
      scrollY: normalizeScroll(scrollY - deltaY / zoom),
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
          canvas,
          scale,
        );
        return { viewportX, viewportY, elementCenterX, elementCenterY };
      }
    }
  }

  private savePointer = (x: number, y: number, button: "up" | "down") => {
    if (!x || !y) {
      return;
    }
    const pointerCoords = viewportCoordsToSceneCoords(
      { clientX: x, clientY: y },
      this.state,
      this.canvas,
      window.devicePixelRatio,
    );

    if (isNaN(pointerCoords.x) || isNaN(pointerCoords.y)) {
      // sometimes the pointer goes off screen
      return;
    }
    this.portal.socket &&
      // do not broadcast when more than 1 pointer since that shows flickering on the other side
      gesture.pointers.size < 2 &&
      this.broadcastMouseLocation({
        pointerCoords,
        button,
      });
  };

  private resetShouldCacheIgnoreZoomDebounced = debounce(() => {
    this.setState({ shouldCacheIgnoreZoom: false });
  }, 300);

  private saveDebounced = debounce(() => {
    saveToLocalStorage(this.scene.getElementsIncludingDeleted(), this.state);
  }, 300);

  private getCanvasOffsets() {
    if (this.excalidrawRef?.current) {
      const parentElement = this.excalidrawRef.current.parentElement;
      const { left, top } = parentElement.getBoundingClientRect();
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
      library: ReturnType<typeof loadLibrary>;
    };
  }
}

if (
  process.env.NODE_ENV === ENV.TEST ||
  process.env.NODE_ENV === ENV.DEVELOPMENT
) {
  window.h = {} as Window["h"];

  Object.defineProperties(window.h, {
    elements: {
      get() {
        return this.app.scene.getElementsIncludingDeleted();
      },
      set(elements: ExcalidrawElement[]) {
        return this.app.scene.replaceAllElements(elements);
      },
    },
    history: {
      get: () => history,
    },
    library: {
      get: () => loadLibrary(),
    },
  });
}

export default App;
