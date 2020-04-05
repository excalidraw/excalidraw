import React from "react";

import socketIOClient from "socket.io-client";
import rough from "roughjs/bin/rough";
import { RoughCanvas } from "roughjs/bin/canvas";
import { FlooredNumber } from "../types";
import { getElementAbsoluteCoords } from "../element/bounds";

import {
  newElement,
  newTextElement,
  duplicateElement,
  resizeTest,
  normalizeResizeHandle,
  isInvisiblySmallElement,
  isTextElement,
  textWysiwyg,
  getCommonBounds,
  getCursorForResizingElement,
  getPerfectElementSize,
  normalizeDimensions,
  getElementMap,
  getDrawingVersion,
  getSyncableElements,
  hasNonDeletedElements,
  newLinearElement,
} from "../element";
import {
  deleteSelectedElements,
  getElementsWithinSelection,
  isOverScrollBars,
  getElementAtPosition,
  getElementContainingPosition,
  getNormalizedZoom,
  getSelectedElements,
  globalSceneState,
  isSomeElementSelected,
  calculateScrollCenter,
} from "../scene";
import {
  decryptAESGEM,
  encryptAESGEM,
  saveToLocalStorage,
  loadScene,
  loadFromBlob,
  SOCKET_SERVER,
  SocketUpdateDataSource,
  exportCanvas,
} from "../data";

import { renderScene } from "../renderer";
import { AppState, GestureEvent, Gesture } from "../types";
import {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
} from "../element/types";
import { rotate, adjustXYWithRotation } from "../math";

import {
  isWritableElement,
  isInputLike,
  isToolIcon,
  debounce,
  distance,
  distance2d,
  resetCursor,
  viewportCoordsToSceneCoords,
  sceneCoordsToViewportCoords,
} from "../utils";
import { KEYS, isArrowKey } from "../keys";

import { findShapeByKey, shapesShortcutKeys } from "../shapes";
import { createHistory, SceneHistory } from "../history";

import ContextMenu from "./ContextMenu";

import { getElementWithResizeHandler } from "../element/resizeTest";
import { ActionManager } from "../actions/manager";
import "../actions";
import { actions } from "../actions/register";

import { ActionResult } from "../actions/types";
import { getDefaultAppState } from "../appState";
import { t } from "../i18n";

import {
  copyToAppClipboard,
  getClipboardContent,
  probablySupportsClipboardBlob,
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
  ARROW_CONFIRM_THRESHOLD,
  SHIFT_LOCKING_ANGLE,
} from "../constants";
import { LayerUI } from "./LayerUI";
import { ScrollBars, SceneState } from "../scene/types";
import { generateCollaborationLink, getCollaborationLinkData } from "../data";
import { mutateElement, newElementWith } from "../element/mutateElement";
import { invalidateShapeForElement } from "../renderer/renderElement";
import { unstable_batchedUpdates } from "react-dom";
import { SceneStateCallbackRemover } from "../scene/globalScene";
import { isLinearElement } from "../element/typeChecks";
import { rescalePoints } from "../points";
import { actionFinalize } from "../actions";

/**
 * @param func handler taking at most single parameter (event).
 */
function withBatchedUpdates<
  TFunction extends ((event: any) => void) | (() => void)
>(func: Parameters<TFunction>["length"] extends 0 | 1 ? TFunction : never) {
  return ((event) => {
    unstable_batchedUpdates(func as TFunction, event);
  }) as TFunction;
}

const { history } = createHistory();

let didTapTwice: boolean = false;
let tappedTwiceTimer = 0;
let cursorX = 0;
let cursorY = 0;
let isHoldingSpace: boolean = false;
let isPanning: boolean = false;
let isDraggingScrollBar: boolean = false;
let currentScrollBars: ScrollBars = { horizontal: null, vertical: null };

let lastPointerUp: ((event: any) => void) | null = null;
const gesture: Gesture = {
  pointers: new Map(),
  lastCenter: null,
  initialDistance: null,
  initialScale: null,
};

function setCursorForShape(shape: string) {
  if (shape === "selection") {
    resetCursor();
  } else {
    document.documentElement.style.cursor =
      shape === "text" ? CURSOR_TYPE.TEXT : CURSOR_TYPE.CROSSHAIR;
  }
}

export class App extends React.Component<any, AppState> {
  canvas: HTMLCanvasElement | null = null;
  rc: RoughCanvas | null = null;
  socket: SocketIOClient.Socket | null = null;
  socketInitialized: boolean = false; // we don't want the socket to emit any updates until it is fully initalized
  roomID: string | null = null;
  roomKey: string | null = null;
  lastBroadcastedOrReceivedSceneVersion: number = -1;
  removeSceneCallback: SceneStateCallbackRemover | null = null;

  actionManager: ActionManager;
  canvasOnlyActions = ["selectAll"];

  public state: AppState = {
    ...getDefaultAppState(),
    isLoading: true,
  };

  constructor(props: any) {
    super(props);
    this.actionManager = new ActionManager(
      this.syncActionResult,
      () => this.state,
      () => globalSceneState.getAllElements(),
    );
    this.actionManager.registerAll(actions);

    this.actionManager.registerAction(createUndoAction(history));
    this.actionManager.registerAction(createRedoAction(history));
  }

  public render() {
    const canvasDOMWidth = window.innerWidth;
    const canvasDOMHeight = window.innerHeight;

    const canvasScale = window.devicePixelRatio;

    const canvasWidth = canvasDOMWidth * canvasScale;
    const canvasHeight = canvasDOMHeight * canvasScale;

    return (
      <div className="container">
        <LayerUI
          canvas={this.canvas}
          appState={this.state}
          setAppState={this.setAppState}
          actionManager={this.actionManager}
          elements={globalSceneState.getAllElements().filter((element) => {
            return !element.isDeleted;
          })}
          setElements={this.setElements}
          onRoomCreate={this.createRoom}
          onRoomDestroy={this.destroyRoom}
          onLockToggle={this.toggleLock}
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
            onDrop={this.handleCanvasOnDrop}
          >
            {t("labels.drawingCanvas")}
          </canvas>
        </main>
      </div>
    );
  }

  private syncActionResult = withBatchedUpdates((res: ActionResult) => {
    if (this.unmounted) {
      return;
    }
    if (res.elements) {
      globalSceneState.replaceAllElements(res.elements);
      if (res.commitToHistory) {
        history.resumeRecording();
      }
    }

    if (res.appState) {
      if (res.commitToHistory) {
        history.resumeRecording();
      }
      this.setState((state) => ({
        ...res.appState,
        isCollaborating: state.isCollaborating,
        collaborators: state.collaborators,
      }));
    }
  });

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

  private initializeScene = async () => {
    const searchParams = new URLSearchParams(window.location.search);
    const id = searchParams.get("id");
    const jsonMatch = window.location.hash.match(
      /^#json=([0-9]+),([a-zA-Z0-9_-]+)$/,
    );

    const isCollaborationScene = getCollaborationLinkData(window.location.href);

    if (!isCollaborationScene) {
      let scene: ResolutionType<typeof loadScene> | undefined;
      // Backwards compatibility with legacy url format
      if (id) {
        scene = await loadScene(id);
      } else if (jsonMatch) {
        scene = await loadScene(jsonMatch[1], jsonMatch[2]);
      } else {
        scene = await loadScene(null);
      }
      if (scene) {
        this.syncActionResult(scene);
      }
    }

    // rerender text elements on font load to fix #637
    try {
      await Promise.race([
        document.fonts?.ready?.then(() => {
          globalSceneState.getAllElements().forEach((element) => {
            if (isTextElement(element)) {
              invalidateShapeForElement(element);
            }
          });
        }),
        // if fonts don't load in 1s for whatever reason, don't block the UI
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
    } catch (error) {
      console.error(error);
    }

    if (this.state.isLoading) {
      this.setState({ isLoading: false });
    }

    // run this last else the `isLoading` state
    if (isCollaborationScene) {
      this.initializeSocketClient({ showLoadingState: true });
    }
  };

  private unmounted = false;

  public async componentDidMount() {
    if (
      process.env.NODE_ENV === "test" ||
      process.env.NODE_ENV === "development"
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

    this.removeSceneCallback = globalSceneState.addCallback(
      this.onSceneUpdated,
    );

    document.addEventListener("copy", this.onCopy);
    document.addEventListener("paste", this.pasteFromClipboard);
    document.addEventListener("cut", this.onCut);

    document.addEventListener("keydown", this.onKeyDown, false);
    document.addEventListener("keyup", this.onKeyUp, { passive: true });
    document.addEventListener("mousemove", this.updateCurrentCursorPosition);
    window.addEventListener("resize", this.onResize, false);
    window.addEventListener("unload", this.onUnload, false);
    window.addEventListener("blur", this.onBlur, false);
    window.addEventListener("dragover", this.disableEvent, false);
    window.addEventListener("drop", this.disableEvent, false);

    // Safari-only desktop pinch zoom
    document.addEventListener(
      "gesturestart",
      this.onGestureStart as any,
      false,
    );
    document.addEventListener(
      "gesturechange",
      this.onGestureChange as any,
      false,
    );
    document.addEventListener("gestureend", this.onGestureEnd as any, false);
    window.addEventListener("beforeunload", this.beforeUnload);

    this.initializeScene();
  }

  public componentWillUnmount() {
    this.unmounted = true;
    this.removeSceneCallback!();

    document.removeEventListener("copy", this.onCopy);
    document.removeEventListener("paste", this.pasteFromClipboard);
    document.removeEventListener("cut", this.onCut);

    document.removeEventListener("keydown", this.onKeyDown, false);
    document.removeEventListener(
      "mousemove",
      this.updateCurrentCursorPosition,
      false,
    );
    document.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.onResize, false);
    window.removeEventListener("unload", this.onUnload, false);
    window.removeEventListener("blur", this.onBlur, false);
    window.removeEventListener("dragover", this.disableEvent, false);
    window.removeEventListener("drop", this.disableEvent, false);

    document.removeEventListener(
      "gesturestart",
      this.onGestureStart as any,
      false,
    );
    document.removeEventListener(
      "gesturechange",
      this.onGestureChange as any,
      false,
    );
    document.removeEventListener("gestureend", this.onGestureEnd as any, false);
    window.removeEventListener("beforeunload", this.beforeUnload);
  }
  private onResize = withBatchedUpdates(() => {
    globalSceneState
      .getAllElements()
      .forEach((element) => invalidateShapeForElement(element));
    this.setState({});
  });

  private beforeUnload = withBatchedUpdates((event: BeforeUnloadEvent) => {
    if (
      this.state.isCollaborating &&
      hasNonDeletedElements(globalSceneState.getAllElements())
    ) {
      event.preventDefault();
      // NOTE: modern browsers no longer allow showing a custom message here
      event.returnValue = "";
    }
  });

  componentDidUpdate() {
    if (this.state.isCollaborating && !this.socket) {
      this.initializeSocketClient({ showLoadingState: true });
    }

    const cursorButton: {
      [id: string]: string | undefined;
    } = {};
    const pointerViewportCoords: SceneState["remotePointerViewportCoords"] = {};
    const remoteSelectedElementIds: SceneState["remoteSelectedElementIds"] = {};
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
    const { atLeastOneVisibleElement, scrollBars } = renderScene(
      globalSceneState.getAllElements().filter((element) => {
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
      !atLeastOneVisibleElement &&
      hasNonDeletedElements(globalSceneState.getAllElements());
    if (this.state.scrolledOutside !== scrolledOutside) {
      this.setState({ scrolledOutside: scrolledOutside });
    }
    this.saveDebounced();

    if (
      getDrawingVersion(globalSceneState.getAllElements()) >
      this.lastBroadcastedOrReceivedSceneVersion
    ) {
      this.broadcastScene("SCENE_UPDATE");
    }

    history.record(this.state, globalSceneState.getAllElements());
  }

  // Copy/paste

  private onCut = withBatchedUpdates((event: ClipboardEvent) => {
    if (isWritableElement(event.target)) {
      return;
    }
    this.copyAll();
    const { elements: nextElements, appState } = deleteSelectedElements(
      globalSceneState.getAllElements(),
      this.state,
    );
    globalSceneState.replaceAllElements(nextElements);
    history.resumeRecording();
    this.setState({ ...appState });
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
    copyToAppClipboard(globalSceneState.getAllElements(), this.state);
  };

  private copyToClipboardAsPng = () => {
    const selectedElements = getSelectedElements(
      globalSceneState.getAllElements(),
      this.state,
    );
    exportCanvas(
      "clipboard",
      selectedElements.length
        ? selectedElements
        : globalSceneState.getAllElements(),
      this.state,
      this.canvas!,
      this.state,
    );
  };

  private onTapStart = (event: TouchEvent) => {
    if (!didTapTwice) {
      didTapTwice = true;
      clearTimeout(tappedTwiceTimer);
      tappedTwiceTimer = window.setTimeout(() => (didTapTwice = false), 300);
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
      const data = await getClipboardContent(event);
      if (data.elements) {
        this.addElementsFromPaste(data.elements);
      } else if (data.text) {
        this.addTextFromPaste(data.text);
      }
      this.selectShapeTool("selection");
      event?.preventDefault();
    },
  );

  private addElementsFromPaste = (
    clipboardElements: readonly ExcalidrawElement[],
  ) => {
    const [minX, minY, maxX, maxY] = getCommonBounds(clipboardElements);

    const elementsCenterX = distance(minX, maxX) / 2;
    const elementsCenterY = distance(minY, maxY) / 2;

    const { x, y } = viewportCoordsToSceneCoords(
      { clientX: cursorX, clientY: cursorY },
      this.state,
      this.canvas,
      window.devicePixelRatio,
    );

    const dx = x - elementsCenterX;
    const dy = y - elementsCenterY;

    const newElements = clipboardElements.map((element) =>
      duplicateElement(element, {
        x: element.x + dx - minX,
        y: element.y + dy - minY,
      }),
    );

    globalSceneState.replaceAllElements([
      ...globalSceneState.getAllElements(),
      ...newElements,
    ]);
    history.resumeRecording();
    this.setState({
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
      roughness: this.state.currentItemRoughness,
      opacity: this.state.currentItemOpacity,
      text: text,
      font: this.state.currentItemFont,
    });

    globalSceneState.replaceAllElements([
      ...globalSceneState.getAllElements(),
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
    gesture.pointers.delete(event.pointerId);
  };

  createRoom = async () => {
    window.history.pushState(
      {},
      "Excalidraw",
      await generateCollaborationLink(),
    );
    this.initializeSocketClient({ showLoadingState: false });
  };

  destroyRoom = () => {
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

  private destroySocketClient = () => {
    this.setState({
      isCollaborating: false,
      collaborators: new Map(),
    });
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.roomID = null;
      this.roomKey = null;
    }
  };

  private initializeSocketClient = (opts: { showLoadingState: boolean }) => {
    if (this.socket) {
      return;
    }
    const roomMatch = getCollaborationLinkData(window.location.href);
    if (roomMatch) {
      const initialize = () => {
        this.socketInitialized = true;
        clearTimeout(initializationTimer);
        if (this.state.isLoading && !this.unmounted) {
          this.setState({ isLoading: false });
        }
      };
      // fallback in case you're not alone in the room but still don't receive
      //  initial SCENE_UPDATE message
      const initializationTimer = setTimeout(initialize, 5000);

      const updateScene = (
        decryptedData: SocketUpdateDataSource["SCENE_INIT" | "SCENE_UPDATE"],
        { scrollToContent = false }: { scrollToContent?: boolean } = {},
      ) => {
        const { elements: remoteElements } = decryptedData.payload;

        if (scrollToContent) {
          this.setState({
            ...this.state,
            ...calculateScrollCenter(
              remoteElements.filter((element) => {
                return !element.isDeleted;
              }),
            ),
          });
        }

        // Perform reconciliation - in collaboration, if we encounter
        // elements with more staler versions than ours, ignore them
        // and keep ours.
        if (
          globalSceneState.getAllElements() == null ||
          globalSceneState.getAllElements().length === 0
        ) {
          globalSceneState.replaceAllElements(remoteElements);
        } else {
          // create a map of ids so we don't have to iterate
          // over the array more than once.
          const localElementMap = getElementMap(
            globalSceneState.getAllElements(),
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

          globalSceneState.replaceAllElements(newElements);
        }

        // We haven't yet implemented multiplayer undo functionality, so we clear the undo stack
        // when we receive any messages from another peer. This UX can be pretty rough -- if you
        // undo, a user makes a change, and then try to redo, your element(s) will be lost. However,
        // right now we think this is the right tradeoff.
        history.clear();
        if (this.socketInitialized === false) {
          initialize();
        }
      };

      this.socket = socketIOClient(SOCKET_SERVER);
      this.roomID = roomMatch[1];
      this.roomKey = roomMatch[2];
      this.socket.on("init-room", () => {
        this.socket && this.socket.emit("join-room", this.roomID);
      });
      this.socket.on(
        "client-broadcast",
        async (encryptedData: ArrayBuffer, iv: Uint8Array) => {
          if (!this.roomKey) {
            return;
          }
          const decryptedData = await decryptAESGEM(
            encryptedData,
            this.roomKey,
            iv,
          );

          switch (decryptedData.type) {
            case "INVALID_RESPONSE":
              return;
            case "SCENE_INIT": {
              if (!this.socketInitialized) {
                updateScene(decryptedData, { scrollToContent: true });
              }
              break;
            }
            case "SCENE_UPDATE":
              updateScene(decryptedData);
              break;
            case "MOUSE_LOCATION": {
              const {
                socketID,
                pointerCoords,
                button,
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
                state.collaborators.set(socketID, user);
                return state;
              });
              break;
            }
          }
        },
      );
      this.socket.on("first-in-room", () => {
        if (this.socket) {
          this.socket.off("first-in-room");
        }
        initialize();
      });
      this.socket.on("room-user-change", (clients: string[]) => {
        this.setState((state) => {
          const collaborators: typeof state.collaborators = new Map();
          for (const socketID of clients) {
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
      });
      this.socket.on("new-user", async (socketID: string) => {
        this.broadcastScene("SCENE_INIT");
      });

      this.setState({
        isCollaborating: true,
        isLoading: opts.showLoadingState ? true : this.state.isLoading,
      });
    }
  };

  private broadcastMouseLocation = (payload: {
    pointerCoords: SocketUpdateDataSource["MOUSE_LOCATION"]["payload"]["pointerCoords"];
    button: SocketUpdateDataSource["MOUSE_LOCATION"]["payload"]["button"];
  }) => {
    if (this.socket?.id) {
      const data: SocketUpdateDataSource["MOUSE_LOCATION"] = {
        type: "MOUSE_LOCATION",
        payload: {
          socketID: this.socket.id,
          pointerCoords: payload.pointerCoords,
          button: payload.button || "up",
          selectedElementIds: this.state.selectedElementIds,
        },
      };
      return this._broadcastSocketData(
        data as typeof data & { _brand: "socketUpdateData" },
      );
    }
  };

  private broadcastScene = (sceneType: "SCENE_INIT" | "SCENE_UPDATE") => {
    const data: SocketUpdateDataSource[typeof sceneType] = {
      type: sceneType,
      payload: {
        elements: getSyncableElements(globalSceneState.getAllElements()),
      },
    };
    this.lastBroadcastedOrReceivedSceneVersion = Math.max(
      this.lastBroadcastedOrReceivedSceneVersion,
      getDrawingVersion(globalSceneState.getAllElements()),
    );
    return this._broadcastSocketData(
      data as typeof data & { _brand: "socketUpdateData" },
    );
  };

  // Low-level. Use type-specific broadcast* method.
  private async _broadcastSocketData(
    data: SocketUpdateDataSource[keyof SocketUpdateDataSource] & {
      _brand: "socketUpdateData";
    },
  ) {
    if (this.socketInitialized && this.socket && this.roomID && this.roomKey) {
      const json = JSON.stringify(data);
      const encoded = new TextEncoder().encode(json);
      const encrypted = await encryptAESGEM(encoded, this.roomKey);
      this.socket.emit(
        "server-broadcast",
        this.roomID,
        encrypted.data,
        encrypted.iv,
      );
    }
  }

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

    if (event.code === "KeyC" && event.altKey && event.shiftKey) {
      this.copyToClipboardAsPng();
      event.preventDefault();
      return;
    }

    if (this.actionManager.handleKeyDown(event)) {
      return;
    }

    const shape = findShapeByKey(event.key);

    if (isArrowKey(event.key)) {
      const step = event.shiftKey
        ? ELEMENT_SHIFT_TRANSLATE_AMOUNT
        : ELEMENT_TRANSLATE_AMOUNT;
      globalSceneState.replaceAllElements(
        globalSceneState.getAllElements().map((el) => {
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
        globalSceneState.getAllElements(),
        this.state,
      );

      if (
        selectedElements.length === 1 &&
        !isLinearElement(selectedElements[0])
      ) {
        const selectedElement = selectedElements[0];
        const x = selectedElement.x + selectedElement.width / 2;
        const y = selectedElement.y + selectedElement.height / 2;

        this.startTextEditing({
          x: x,
          y: y,
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
      if (shapesShortcutKeys.includes(event.key.toLowerCase())) {
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
        document.documentElement.style.cursor =
          this.state.elementType === "text"
            ? CURSOR_TYPE.TEXT
            : CURSOR_TYPE.CROSSHAIR;
        this.setState({ selectedElementIds: {} });
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
      this.setState({ elementType, selectedElementIds: {} });
    } else {
      this.setState({ elementType });
    }
  }

  private onGestureStart = withBatchedUpdates((event: GestureEvent) => {
    event.preventDefault();
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
    gesture.initialScale = null;
  });

  private setElements = (elements: readonly ExcalidrawElement[]) => {
    globalSceneState.replaceAllElements(elements);
  };

  private handleTextWysiwyg(
    element: ExcalidrawTextElement,
    {
      x,
      y,
      isExistingElement = false,
    }: { x: number; y: number; isExistingElement?: boolean },
  ) {
    const resetSelection = () => {
      this.setState({
        draggingElement: null,
        editingElement: null,
      });
    };

    // deselect all other elements when inserting text
    this.setState({ selectedElementIds: {} });

    const deleteElement = () => {
      globalSceneState.replaceAllElements([
        ...globalSceneState.getAllElements().map((_element) => {
          if (_element.id === element.id) {
            return newElementWith(_element, { isDeleted: true });
          }
          return _element;
        }),
      ]);
    };

    const updateElement = (text: string) => {
      globalSceneState.replaceAllElements([
        ...globalSceneState.getAllElements().map((_element) => {
          if (_element.id === element.id) {
            return newTextElement({
              ..._element,
              x: element.x,
              y: element.y,
              text,
              font: this.state.currentItemFont,
            });
          }
          return _element;
        }),
      ]);
    };

    textWysiwyg({
      x,
      y,
      initText: element.text,
      strokeColor: element.strokeColor,
      opacity: element.opacity,
      font: element.font,
      angle: element.angle,
      zoom: this.state.zoom,
      onChange: withBatchedUpdates((text) => {
        if (text) {
          updateElement(text);
        } else {
          deleteElement();
        }
      }),
      onSubmit: withBatchedUpdates((text) => {
        updateElement(text);
        this.setState((prevState) => ({
          selectedElementIds: {
            ...prevState.selectedElementIds,
            [element.id]: true,
          },
        }));
        if (this.state.elementLocked) {
          setCursorForShape(this.state.elementType);
        }
        history.resumeRecording();
        resetSelection();
      }),
      onCancel: withBatchedUpdates(() => {
        deleteElement();
        if (isExistingElement) {
          history.resumeRecording();
        }
        resetSelection();
      }),
    });

    // do an initial update to re-initialize element position since we were
    //  modifying element's x/y for sake of editor (case: syncing to remote)
    updateElement(element.text);
  }

  private startTextEditing = ({
    x,
    y,
    clientX,
    clientY,
    centerIfPossible = true,
  }: {
    x: number;
    y: number;
    clientX?: number;
    clientY?: number;
    centerIfPossible?: boolean;
  }) => {
    const elementAtPosition = getElementAtPosition(
      globalSceneState.getAllElements(),
      this.state,
      x,
      y,
      this.state.zoom,
    );

    const element =
      elementAtPosition && isTextElement(elementAtPosition)
        ? elementAtPosition
        : newTextElement({
            x: x,
            y: y,
            strokeColor: this.state.currentItemStrokeColor,
            backgroundColor: this.state.currentItemBackgroundColor,
            fillStyle: this.state.currentItemFillStyle,
            strokeWidth: this.state.currentItemStrokeWidth,
            roughness: this.state.currentItemRoughness,
            opacity: this.state.currentItemOpacity,
            text: "",
            font: this.state.currentItemFont,
          });

    this.setState({ editingElement: element });

    let textX = clientX || x;
    let textY = clientY || y;

    let isExistingTextElement = false;

    if (elementAtPosition && isTextElement(elementAtPosition)) {
      isExistingTextElement = true;
      const centerElementX = elementAtPosition.x + elementAtPosition.width / 2;
      const centerElementY = elementAtPosition.y + elementAtPosition.height / 2;

      const {
        x: centerElementXInViewport,
        y: centerElementYInViewport,
      } = sceneCoordsToViewportCoords(
        { sceneX: centerElementX, sceneY: centerElementY },
        this.state,
        this.canvas,
        window.devicePixelRatio,
      );

      textX = centerElementXInViewport;
      textY = centerElementYInViewport;

      // x and y will change after calling newTextElement function
      mutateElement(element, {
        x: centerElementX,
        y: centerElementY,
      });
    } else {
      globalSceneState.replaceAllElements([
        ...globalSceneState.getAllElements(),
        element,
      ]);

      if (centerIfPossible) {
        const snappedToCenterPosition = this.getTextWysiwygSnappedToCenterPosition(
          x,
          y,
          this.state,
          this.canvas,
          window.devicePixelRatio,
        );

        if (snappedToCenterPosition) {
          mutateElement(element, {
            x: snappedToCenterPosition.elementCenterX,
            y: snappedToCenterPosition.elementCenterY,
          });
          textX = snappedToCenterPosition.wysiwygX;
          textY = snappedToCenterPosition.wysiwygY;
        }
      }
    }

    this.setState({
      editingElement: element,
    });

    this.handleTextWysiwyg(element, {
      x: textX,
      y: textY,
      isExistingElement: isExistingTextElement,
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

    resetCursor();

    const { x, y } = viewportCoordsToSceneCoords(
      event,
      this.state,
      this.canvas,
      window.devicePixelRatio,
    );

    this.startTextEditing({
      x: x,
      y: y,
      clientX: event.clientX,
      clientY: event.clientY,
      centerIfPossible: !event.altKey,
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
    const {
      isOverHorizontalScrollBar,
      isOverVerticalScrollBar,
    } = isOverScrollBars(currentScrollBars, event.clientX, event.clientY);
    const isOverScrollBar =
      isOverVerticalScrollBar || isOverHorizontalScrollBar;
    if (!this.state.draggingElement && !this.state.multiElement) {
      if (isOverScrollBar) {
        resetCursor();
      } else {
        setCursorForShape(this.state.elementType);
      }
    }

    const { x, y } = viewportCoordsToSceneCoords(
      event,
      this.state,
      this.canvas,
      window.devicePixelRatio,
    );
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
          distance2d(x - rx, y - ry, lastPoint[0], lastPoint[1]) >=
          ARROW_CONFIRM_THRESHOLD
        ) {
          mutateElement(multiElement, {
            points: [...points, [x - rx, y - ry]],
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
            x - rx,
            y - ry,
            lastCommittedPoint[0],
            lastCommittedPoint[1],
          ) < ARROW_CONFIRM_THRESHOLD
        ) {
          document.documentElement.style.cursor = CURSOR_TYPE.POINTER;
          mutateElement(multiElement, {
            points: points.slice(0, -1),
          });
        } else {
          // update last uncommitted point
          mutateElement(multiElement, {
            points: [...points.slice(0, -1), [x - rx, y - ry]],
          });
        }
      }
      return;
    }

    const hasDeselectedButton = Boolean(event.buttons);
    if (hasDeselectedButton || this.state.elementType !== "selection") {
      return;
    }

    const selectedElements = getSelectedElements(
      globalSceneState.getAllElements(),
      this.state,
    );
    if (selectedElements.length === 1 && !isOverScrollBar) {
      const resizeElement = getElementWithResizeHandler(
        globalSceneState.getAllElements(),
        this.state,
        { x, y },
        this.state.zoom,
        event.pointerType,
      );
      if (resizeElement && resizeElement.resizeHandle) {
        document.documentElement.style.cursor = getCursorForResizingElement(
          resizeElement,
        );
        return;
      }
    }
    const hitElement = getElementAtPosition(
      globalSceneState.getAllElements(),
      this.state,
      x,
      y,
      this.state.zoom,
    );
    document.documentElement.style.cursor =
      hitElement && !isOverScrollBar ? "move" : "";
  };

  private handleCanvasPointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    if (lastPointerUp !== null) {
      // Unfortunately, sometimes we don't get a pointerup after a pointerdown,
      // this can happen when a contextual menu or alert is triggered. In order to avoid
      // being in a weird state, we clean up on the next pointerdown
      lastPointerUp(event);
    }

    if (isPanning) {
      return;
    }

    this.setState({
      lastPointerDownWith: event.pointerType,
      cursorButton: "down",
    });
    this.savePointer(event.clientX, event.clientY, "down");

    // pan canvas on wheel button drag or space+drag
    if (
      gesture.pointers.size === 0 &&
      (event.button === POINTER_BUTTON.WHEEL ||
        (event.button === POINTER_BUTTON.MAIN && isHoldingSpace))
    ) {
      isPanning = true;
      document.documentElement.style.cursor = CURSOR_TYPE.GRABBING;
      let { clientX: lastX, clientY: lastY } = event;
      const onPointerMove = withBatchedUpdates((event: PointerEvent) => {
        const deltaX = lastX - event.clientX;
        const deltaY = lastY - event.clientY;
        lastX = event.clientX;
        lastY = event.clientY;

        this.setState({
          scrollX: normalizeScroll(
            this.state.scrollX - deltaX / this.state.zoom,
          ),
          scrollY: normalizeScroll(
            this.state.scrollY - deltaY / this.state.zoom,
          ),
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
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", teardown);
          window.removeEventListener("blur", teardown);
        }),
      );
      window.addEventListener("blur", teardown);
      window.addEventListener("pointermove", onPointerMove, {
        passive: true,
      });
      window.addEventListener("pointerup", teardown);
      return;
    }

    // only handle left mouse button or touch
    if (
      event.button !== POINTER_BUTTON.MAIN &&
      event.button !== POINTER_BUTTON.TOUCH
    ) {
      return;
    }

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

    // Handle scrollbars dragging
    const {
      isOverHorizontalScrollBar,
      isOverVerticalScrollBar,
    } = isOverScrollBars(currentScrollBars, event.clientX, event.clientY);

    const { x, y } = viewportCoordsToSceneCoords(
      event,
      this.state,
      this.canvas,
      window.devicePixelRatio,
    );
    let lastX = x;
    let lastY = y;

    if (
      (isOverHorizontalScrollBar || isOverVerticalScrollBar) &&
      !this.state.multiElement
    ) {
      isDraggingScrollBar = true;
      lastX = event.clientX;
      lastY = event.clientY;
      const onPointerMove = withBatchedUpdates((event: PointerEvent) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        if (isOverHorizontalScrollBar) {
          const x = event.clientX;
          const dx = x - lastX;
          this.setState({
            scrollX: normalizeScroll(this.state.scrollX - dx / this.state.zoom),
          });
          lastX = x;
          return;
        }

        if (isOverVerticalScrollBar) {
          const y = event.clientY;
          const dy = y - lastY;
          this.setState({
            scrollY: normalizeScroll(this.state.scrollY - dy / this.state.zoom),
          });
          lastY = y;
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
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      });

      lastPointerUp = onPointerUp;

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      return;
    }

    const originX = x;
    const originY = y;

    type ResizeTestType = ReturnType<typeof resizeTest>;
    let resizeHandle: ResizeTestType = false;
    let isResizingElements = false;
    let draggingOccurred = false;
    let hitElement: ExcalidrawElement | null = null;
    let hitElementWasAddedToSelection = false;
    if (this.state.elementType === "selection") {
      const resizeElement = getElementWithResizeHandler(
        globalSceneState.getAllElements(),
        this.state,
        { x, y },
        this.state.zoom,
        event.pointerType,
      );

      const selectedElements = getSelectedElements(
        globalSceneState.getAllElements(),
        this.state,
      );
      if (selectedElements.length === 1 && resizeElement) {
        this.setState({
          resizingElement: resizeElement ? resizeElement.element : null,
        });

        resizeHandle = resizeElement.resizeHandle;
        document.documentElement.style.cursor = getCursorForResizingElement(
          resizeElement,
        );
        isResizingElements = true;
      } else {
        hitElement = getElementAtPosition(
          globalSceneState.getAllElements(),
          this.state,
          x,
          y,
          this.state.zoom,
        );
        // clear selection if shift is not clicked
        if (
          !(hitElement && this.state.selectedElementIds[hitElement.id]) &&
          !event.shiftKey
        ) {
          this.setState({ selectedElementIds: {} });
        }

        // If we click on something
        if (hitElement) {
          // deselect if item is selected
          // if shift is not clicked, this will always return true
          // otherwise, it will trigger selection based on current
          // state of the box
          if (!this.state.selectedElementIds[hitElement.id]) {
            this.setState((prevState) => ({
              selectedElementIds: {
                ...prevState.selectedElementIds,
                [hitElement!.id]: true,
              },
            }));
            globalSceneState.replaceAllElements(
              globalSceneState.getAllElements(),
            );
            hitElementWasAddedToSelection = true;
          }

          // We duplicate the selected element if alt is pressed on pointer down
          if (event.altKey) {
            // Move the currently selected elements to the top of the z index stack, and
            // put the duplicates where the selected elements used to be.
            const nextElements = [];
            const elementsToAppend = [];
            for (const element of globalSceneState.getAllElements()) {
              if (
                this.state.selectedElementIds[element.id] ||
                (element.id === hitElement.id && hitElementWasAddedToSelection)
              ) {
                nextElements.push(duplicateElement(element));
                elementsToAppend.push(element);
              } else {
                nextElements.push(element);
              }
            }
            globalSceneState.replaceAllElements([
              ...nextElements,
              ...elementsToAppend,
            ]);
          }
        }
      }
    } else {
      this.setState({ selectedElementIds: {} });
    }

    if (this.state.elementType === "text") {
      // if we're currently still editing text, clicking outside
      //  should only finalize it, not create another (irrespective
      //  of state.elementLocked)
      if (this.state.editingElement?.type === "text") {
        return;
      }

      const snappedToCenterPosition = event.altKey
        ? null
        : this.getTextWysiwygSnappedToCenterPosition(
            x,
            y,
            this.state,
            this.canvas,
            window.devicePixelRatio,
          );

      const element = newTextElement({
        x: snappedToCenterPosition?.elementCenterX ?? x,
        y: snappedToCenterPosition?.elementCenterY ?? y,
        strokeColor: this.state.currentItemStrokeColor,
        backgroundColor: this.state.currentItemBackgroundColor,
        fillStyle: this.state.currentItemFillStyle,
        strokeWidth: this.state.currentItemStrokeWidth,
        roughness: this.state.currentItemRoughness,
        opacity: this.state.currentItemOpacity,
        text: "",
        font: this.state.currentItemFont,
      });

      globalSceneState.replaceAllElements([
        ...globalSceneState.getAllElements(),
        element,
      ]);

      this.handleTextWysiwyg(element, {
        x: snappedToCenterPosition?.wysiwygX ?? event.clientX,
        y: snappedToCenterPosition?.wysiwygY ?? event.clientY,
      });
      resetCursor();
      if (!this.state.elementLocked) {
        this.setState({
          editingElement: element,
          elementType: "selection",
        });
      } else {
        this.setState({
          editingElement: element,
        });
      }
      return;
    } else if (
      this.state.elementType === "arrow" ||
      this.state.elementType === "line"
    ) {
      if (this.state.multiElement) {
        const { multiElement } = this.state;

        const { x: rx, y: ry, lastCommittedPoint } = multiElement;

        // clicking inside commit zone → finalize arrow
        if (
          multiElement.points.length > 1 &&
          lastCommittedPoint &&
          distance2d(
            x - rx,
            y - ry,
            lastCommittedPoint[0],
            lastCommittedPoint[1],
          ) < ARROW_CONFIRM_THRESHOLD
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
          lastCommittedPoint:
            multiElement.points[multiElement.points.length - 1],
        });
        document.documentElement.style.cursor = CURSOR_TYPE.POINTER;
      } else {
        const element = newLinearElement({
          type: this.state.elementType,
          x: x,
          y: y,
          strokeColor: this.state.currentItemStrokeColor,
          backgroundColor: this.state.currentItemBackgroundColor,
          fillStyle: this.state.currentItemFillStyle,
          strokeWidth: this.state.currentItemStrokeWidth,
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
        globalSceneState.replaceAllElements([
          ...globalSceneState.getAllElements(),
          element,
        ]);
        this.setState({
          draggingElement: element,
          editingElement: element,
        });
      }
    } else {
      const element = newElement({
        type: this.state.elementType,
        x: x,
        y: y,
        strokeColor: this.state.currentItemStrokeColor,
        backgroundColor: this.state.currentItemBackgroundColor,
        fillStyle: this.state.currentItemFillStyle,
        strokeWidth: this.state.currentItemStrokeWidth,
        roughness: this.state.currentItemRoughness,
        opacity: this.state.currentItemOpacity,
      });

      if (element.type === "selection") {
        this.setState({
          selectionElement: element,
          draggingElement: element,
        });
      } else {
        globalSceneState.replaceAllElements([
          ...globalSceneState.getAllElements(),
          element,
        ]);
        this.setState({
          multiElement: null,
          draggingElement: element,
          editingElement: element,
        });
      }
    }

    let resizeArrowFn:
      | ((
          element: ExcalidrawLinearElement,
          pointIndex: number,
          deltaX: number,
          deltaY: number,
          pointerX: number,
          pointerY: number,
          perfect: boolean,
        ) => void)
      | null = null;

    const arrowResizeOrigin = (
      element: ExcalidrawLinearElement,
      pointIndex: number,
      deltaX: number,
      deltaY: number,
      pointerX: number,
      pointerY: number,
      perfect: boolean,
    ) => {
      const [px, py] = element.points[pointIndex];
      let x = element.x + deltaX;
      let y = element.y + deltaY;
      let pointX = px - deltaX;
      let pointY = py - deltaY;

      if (perfect) {
        const { width, height } = getPerfectElementSize(
          element.type,
          px + element.x - pointerX,
          py + element.y - pointerY,
        );
        x = px + element.x - width;
        y = py + element.y - height;
        pointX = width;
        pointY = height;
      }

      mutateElement(element, {
        x,
        y,
        points: element.points.map((point, i) =>
          i === pointIndex ? ([pointX, pointY] as const) : point,
        ),
      });
    };

    const arrowResizeEnd = (
      element: ExcalidrawLinearElement,
      pointIndex: number,
      deltaX: number,
      deltaY: number,
      pointerX: number,
      pointerY: number,
      perfect: boolean,
    ) => {
      const [px, py] = element.points[pointIndex];
      if (perfect) {
        const { width, height } = getPerfectElementSize(
          element.type,
          pointerX - element.x,
          pointerY - element.y,
        );
        mutateElement(element, {
          points: element.points.map((point, i) =>
            i === pointIndex ? ([width, height] as const) : point,
          ),
        });
      } else {
        mutateElement(element, {
          points: element.points.map((point, i) =>
            i === pointIndex ? ([px + deltaX, py + deltaY] as const) : point,
          ),
        });
      }
    };

    const onPointerMove = withBatchedUpdates((event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (isOverHorizontalScrollBar) {
        const x = event.clientX;
        const dx = x - lastX;
        this.setState({
          scrollX: normalizeScroll(this.state.scrollX - dx / this.state.zoom),
        });
        lastX = x;
        return;
      }

      if (isOverVerticalScrollBar) {
        const y = event.clientY;
        const dy = y - lastY;
        this.setState({
          scrollY: normalizeScroll(this.state.scrollY - dy / this.state.zoom),
        });
        lastY = y;
        return;
      }

      // for arrows, don't start dragging until a given threshold
      //  to ensure we don't create a 2-point arrow by mistake when
      //  user clicks mouse in a way that it moves a tiny bit (thus
      //  triggering pointermove)
      if (
        !draggingOccurred &&
        (this.state.elementType === "arrow" ||
          this.state.elementType === "line")
      ) {
        const { x, y } = viewportCoordsToSceneCoords(
          event,
          this.state,
          this.canvas,
          window.devicePixelRatio,
        );
        if (distance2d(x, y, originX, originY) < DRAGGING_THRESHOLD) {
          return;
        }
      }

      if (isResizingElements && this.state.resizingElement) {
        this.setState({
          isResizing: resizeHandle !== "rotation",
          isRotating: resizeHandle === "rotation",
        });
        const el = this.state.resizingElement;
        const selectedElements = getSelectedElements(
          globalSceneState.getAllElements(),
          this.state,
        );
        if (selectedElements.length === 1) {
          const { x, y } = viewportCoordsToSceneCoords(
            event,
            this.state,
            this.canvas,
            window.devicePixelRatio,
          );
          const element = selectedElements[0];
          const angle = element.angle;
          // reverse rotate delta
          const [deltaX, deltaY] = rotate(x - lastX, y - lastY, 0, 0, -angle);
          switch (resizeHandle) {
            case "nw":
              if (isLinearElement(element) && element.points.length === 2) {
                const [, p1] = element.points;

                if (!resizeArrowFn) {
                  if (p1[0] < 0 || p1[1] < 0) {
                    resizeArrowFn = arrowResizeEnd;
                  } else {
                    resizeArrowFn = arrowResizeOrigin;
                  }
                }
                resizeArrowFn(element, 1, deltaX, deltaY, x, y, event.shiftKey);
              } else {
                const width = element.width - deltaX;
                const height = event.shiftKey ? width : element.height - deltaY;
                const dY = element.height - height;
                mutateElement(element, {
                  width,
                  height,
                  ...adjustXYWithRotation("nw", element, deltaX, dY, angle),
                  ...(isLinearElement(element) && width >= 0 && height >= 0
                    ? {
                        points: rescalePoints(
                          0,
                          width,
                          rescalePoints(1, height, element.points),
                        ),
                      }
                    : {}),
                });
              }
              break;
            case "ne":
              if (isLinearElement(element) && element.points.length === 2) {
                const [, p1] = element.points;
                if (!resizeArrowFn) {
                  if (p1[0] >= 0) {
                    resizeArrowFn = arrowResizeEnd;
                  } else {
                    resizeArrowFn = arrowResizeOrigin;
                  }
                }
                resizeArrowFn(element, 1, deltaX, deltaY, x, y, event.shiftKey);
              } else {
                const width = element.width + deltaX;
                const height = event.shiftKey ? width : element.height - deltaY;
                const dY = element.height - height;
                mutateElement(element, {
                  width,
                  height,
                  ...adjustXYWithRotation("ne", element, deltaX, dY, angle),
                  ...(isLinearElement(element) && width >= 0 && height >= 0
                    ? {
                        points: rescalePoints(
                          0,
                          width,
                          rescalePoints(1, height, element.points),
                        ),
                      }
                    : {}),
                });
              }
              break;
            case "sw":
              if (isLinearElement(element) && element.points.length === 2) {
                const [, p1] = element.points;
                if (!resizeArrowFn) {
                  if (p1[0] <= 0) {
                    resizeArrowFn = arrowResizeEnd;
                  } else {
                    resizeArrowFn = arrowResizeOrigin;
                  }
                }
                resizeArrowFn(element, 1, deltaX, deltaY, x, y, event.shiftKey);
              } else {
                const width = element.width - deltaX;
                const height = event.shiftKey ? width : element.height + deltaY;
                const dY = height - element.height;
                mutateElement(element, {
                  width,
                  height,
                  ...adjustXYWithRotation("sw", element, deltaX, dY, angle),
                  ...(isLinearElement(element) && width >= 0 && height >= 0
                    ? {
                        points: rescalePoints(
                          0,
                          width,
                          rescalePoints(1, height, element.points),
                        ),
                      }
                    : {}),
                });
              }
              break;
            case "se":
              if (isLinearElement(element) && element.points.length === 2) {
                const [, p1] = element.points;
                if (!resizeArrowFn) {
                  if (p1[0] > 0 || p1[1] > 0) {
                    resizeArrowFn = arrowResizeEnd;
                  } else {
                    resizeArrowFn = arrowResizeOrigin;
                  }
                }
                resizeArrowFn(element, 1, deltaX, deltaY, x, y, event.shiftKey);
              } else {
                const width = element.width + deltaX;
                const height = event.shiftKey ? width : element.height + deltaY;
                const dY = height - element.height;
                mutateElement(element, {
                  width,
                  height,
                  ...adjustXYWithRotation("se", element, deltaX, dY, angle),
                  ...(isLinearElement(element) && width >= 0 && height >= 0
                    ? {
                        points: rescalePoints(
                          0,
                          width,
                          rescalePoints(1, height, element.points),
                        ),
                      }
                    : {}),
                });
              }
              break;
            case "n": {
              const height = element.height - deltaY;

              if (isLinearElement(element)) {
                if (element.points.length > 2 && height <= 0) {
                  // Someday we should implement logic to flip the shape.
                  // But for now, just stop.
                  break;
                }
                mutateElement(element, {
                  height,
                  ...adjustXYWithRotation("n", element, 0, deltaY, angle),
                  points: rescalePoints(1, height, element.points),
                });
              } else {
                mutateElement(element, {
                  height,
                  ...adjustXYWithRotation("n", element, 0, deltaY, angle),
                });
              }

              break;
            }
            case "w": {
              const width = element.width - deltaX;

              if (isLinearElement(element)) {
                if (element.points.length > 2 && width <= 0) {
                  // Someday we should implement logic to flip the shape.
                  // But for now, just stop.
                  break;
                }

                mutateElement(element, {
                  width,
                  ...adjustXYWithRotation("w", element, deltaX, 0, angle),
                  points: rescalePoints(0, width, element.points),
                });
              } else {
                mutateElement(element, {
                  width,
                  ...adjustXYWithRotation("w", element, deltaX, 0, angle),
                });
              }
              break;
            }
            case "s": {
              const height = element.height + deltaY;

              if (isLinearElement(element)) {
                if (element.points.length > 2 && height <= 0) {
                  // Someday we should implement logic to flip the shape.
                  // But for now, just stop.
                  break;
                }
                mutateElement(element, {
                  height,
                  ...adjustXYWithRotation("s", element, 0, deltaY, angle),
                  points: rescalePoints(1, height, element.points),
                });
              } else {
                mutateElement(element, {
                  height,
                  ...adjustXYWithRotation("s", element, 0, deltaY, angle),
                });
              }
              break;
            }
            case "e": {
              const width = element.width + deltaX;

              if (isLinearElement(element)) {
                if (element.points.length > 2 && width <= 0) {
                  // Someday we should implement logic to flip the shape.
                  // But for now, just stop.
                  break;
                }
                mutateElement(element, {
                  width,
                  ...adjustXYWithRotation("e", element, deltaX, 0, angle),
                  points: rescalePoints(0, width, element.points),
                });
              } else {
                mutateElement(element, {
                  width,
                  ...adjustXYWithRotation("e", element, deltaX, 0, angle),
                });
              }
              break;
            }
            case "rotation": {
              const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
              const cx = (x1 + x2) / 2;
              const cy = (y1 + y2) / 2;
              let angle = (5 * Math.PI) / 2 + Math.atan2(y - cy, x - cx);
              if (event.shiftKey) {
                angle += SHIFT_LOCKING_ANGLE / 2;
                angle -= angle % SHIFT_LOCKING_ANGLE;
              }
              if (angle >= 2 * Math.PI) {
                angle -= 2 * Math.PI;
              }
              mutateElement(element, { angle });
              break;
            }
          }

          if (resizeHandle) {
            resizeHandle = normalizeResizeHandle(element, resizeHandle);
          }
          normalizeDimensions(element);

          document.documentElement.style.cursor = getCursorForResizingElement({
            element,
            resizeHandle,
          });
          mutateElement(el, {
            x: element.x,
            y: element.y,
          });

          lastX = x;
          lastY = y;
          return;
        }
      }

      if (hitElement && this.state.selectedElementIds[hitElement.id]) {
        // Marking that click was used for dragging to check
        // if elements should be deselected on pointerup
        draggingOccurred = true;
        const selectedElements = getSelectedElements(
          globalSceneState.getAllElements(),
          this.state,
        );
        if (selectedElements.length > 0) {
          const { x, y } = viewportCoordsToSceneCoords(
            event,
            this.state,
            this.canvas,
            window.devicePixelRatio,
          );

          selectedElements.forEach((element) => {
            mutateElement(element, {
              x: element.x + x - lastX,
              y: element.y + y - lastY,
            });
          });
          lastX = x;
          lastY = y;
          return;
        }
      }

      // It is very important to read this.state within each move event,
      // otherwise we would read a stale one!
      const draggingElement = this.state.draggingElement;
      if (!draggingElement) {
        return;
      }

      const { x, y } = viewportCoordsToSceneCoords(
        event,
        this.state,
        this.canvas,
        window.devicePixelRatio,
      );

      let width = distance(originX, x);
      let height = distance(originY, y);

      if (isLinearElement(draggingElement)) {
        draggingOccurred = true;
        const points = draggingElement.points;
        let dx = x - draggingElement.x;
        let dy = y - draggingElement.y;

        if (event.shiftKey && points.length === 2) {
          ({ width: dx, height: dy } = getPerfectElementSize(
            this.state.elementType,
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
      } else {
        if (event.shiftKey) {
          ({ width, height } = getPerfectElementSize(
            this.state.elementType,
            width,
            y < originY ? -height : height,
          ));

          if (height < 0) {
            height = -height;
          }
        }

        mutateElement(draggingElement, {
          x: x < originX ? originX - width : originX,
          y: y < originY ? originY - height : originY,
          width: width,
          height: height,
        });
      }

      if (this.state.elementType === "selection") {
        if (
          !event.shiftKey &&
          isSomeElementSelected(globalSceneState.getAllElements(), this.state)
        ) {
          this.setState({ selectedElementIds: {} });
        }
        const elementsWithinSelection = getElementsWithinSelection(
          globalSceneState.getAllElements(),
          draggingElement,
        );
        this.setState((prevState) => ({
          selectedElementIds: {
            ...prevState.selectedElementIds,
            ...elementsWithinSelection.reduce((map, element) => {
              map[element.id] = true;
              return map;
            }, {} as any),
          },
        }));
      }
    });

    const onPointerUp = withBatchedUpdates((childEvent: PointerEvent) => {
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
        editingElement: multiElement ? this.state.editingElement : null,
      });

      this.savePointer(childEvent.clientX, childEvent.clientY, "up");

      resizeArrowFn = null;
      lastPointerUp = null;

      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      if (isLinearElement(draggingElement)) {
        if (draggingElement!.points.length > 1) {
          history.resumeRecording();
        }
        if (!draggingOccurred && draggingElement && !multiElement) {
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
        } else if (draggingOccurred && !multiElement) {
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
        globalSceneState.replaceAllElements(
          globalSceneState.getAllElements().slice(0, -1),
        );
        this.setState({
          draggingElement: null,
        });
        return;
      }

      normalizeDimensions(draggingElement);

      if (resizingElement) {
        history.resumeRecording();
      }

      if (resizingElement && isInvisiblySmallElement(resizingElement)) {
        globalSceneState.replaceAllElements(
          globalSceneState
            .getAllElements()
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
      if (hitElement && !draggingOccurred && !hitElementWasAddedToSelection) {
        if (childEvent.shiftKey) {
          this.setState((prevState) => ({
            selectedElementIds: {
              ...prevState.selectedElementIds,
              [hitElement!.id]: false,
            },
          }));
        } else {
          this.setState((prevState) => ({
            selectedElementIds: { [hitElement!.id]: true },
          }));
        }
      }

      if (draggingElement === null) {
        // if no element is clicked, clear the selection and redraw
        this.setState({ selectedElementIds: {} });
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
        isSomeElementSelected(globalSceneState.getAllElements(), this.state)
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

    lastPointerUp = onPointerUp;

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  private handleCanvasRef = (canvas: HTMLCanvasElement) => {
    // canvas is null when unmounting
    if (canvas !== null) {
      this.canvas = canvas;
      this.rc = rough.canvas(this.canvas);

      this.canvas.addEventListener("wheel", this.handleWheel, {
        passive: false,
      });
      this.canvas.addEventListener("touchstart", this.onTapStart);
    } else {
      this.canvas?.removeEventListener("wheel", this.handleWheel);
      this.canvas?.removeEventListener("touchstart", this.onTapStart);
    }
  };

  private handleCanvasOnDrop = (event: React.DragEvent<HTMLCanvasElement>) => {
    const file = event.dataTransfer?.files[0];
    if (
      file?.type === "application/json" ||
      file?.name.endsWith(".excalidraw")
    ) {
      this.setState({ isLoading: true });
      loadFromBlob(file)
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
          this.setState({ isLoading: false, errorMessage: error });
        });
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

    const { x, y } = viewportCoordsToSceneCoords(
      event,
      this.state,
      this.canvas,
      window.devicePixelRatio,
    );

    const element = getElementAtPosition(
      globalSceneState.getAllElements(),
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
            hasNonDeletedElements(globalSceneState.getAllElements()) && {
              label: t("labels.copyAsPng"),
              action: this.copyToClipboardAsPng,
            },
          ...this.actionManager.getContextMenuItems((action) =>
            this.canvasOnlyActions.includes(action.name),
          ),
        ],
        top: event.clientY,
        left: event.clientX,
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
        ...this.actionManager.getContextMenuItems(
          (action) => !this.canvasOnlyActions.includes(action.name),
        ),
      ],
      top: event.clientY,
      left: event.clientX,
    });
  };

  private handleWheel = withBatchedUpdates((event: WheelEvent) => {
    event.preventDefault();
    const { deltaX, deltaY } = event;

    // note that event.ctrlKey is necessary to handle pinch zooming
    if (event.metaKey || event.ctrlKey) {
      const sign = Math.sign(deltaY);
      const MAX_STEP = 10;
      let delta = Math.abs(deltaY);
      if (delta > MAX_STEP) {
        delta = MAX_STEP;
      }
      delta *= sign;
      this.setState(({ zoom }) => ({
        zoom: getNormalizedZoom(zoom - delta / 100),
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
    state: {
      scrollX: FlooredNumber;
      scrollY: FlooredNumber;
      zoom: number;
    },
    canvas: HTMLCanvasElement | null,
    scale: number,
  ) {
    const elementClickedInside = getElementContainingPosition(
      globalSceneState.getAllElements(),
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
        const { x: wysiwygX, y: wysiwygY } = sceneCoordsToViewportCoords(
          { sceneX: elementCenterX, sceneY: elementCenterY },
          state,
          canvas,
          scale,
        );
        return { wysiwygX, wysiwygY, elementCenterX, elementCenterY };
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
    this.socket &&
      this.broadcastMouseLocation({
        pointerCoords,
        button,
      });
  };

  private resetShouldCacheIgnoreZoomDebounced = debounce(() => {
    this.setState({ shouldCacheIgnoreZoom: false });
  }, 300);

  private saveDebounced = debounce(() => {
    saveToLocalStorage(globalSceneState.getAllElements(), this.state);
  }, 300);
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
    };
  }
}

if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") {
  window.h = {} as Window["h"];

  Object.defineProperties(window.h, {
    elements: {
      get() {
        return globalSceneState.getAllElements();
      },
      set(elements: ExcalidrawElement[]) {
        return globalSceneState.replaceAllElements(elements);
      },
    },
    history: {
      get() {
        return history;
      },
    },
  });
}

// -----------------------------------------------------------------------------
