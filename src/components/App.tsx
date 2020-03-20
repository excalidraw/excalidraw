import React from "react";

import socketIOClient from "socket.io-client";
import rough from "roughjs/bin/rough";
import { RoughCanvas } from "roughjs/bin/canvas";

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
import { restore } from "../data/restore";

import { renderScene } from "../renderer";
import { AppState, GestureEvent, Gesture } from "../types";
import { ExcalidrawElement, ExcalidrawLinearElement } from "../element/types";

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
import { t, getLanguage } from "../i18n";

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
} from "../constants";
import { LayerUI } from "./LayerUI";
import { ScrollBars } from "../scene/types";
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
  return (event => {
    unstable_batchedUpdates(func as TFunction, event);
  }) as TFunction;
}

const { history } = createHistory();

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
      this.setState(state => ({
        ...res.appState,
        isCollaborating: state.isCollaborating,
        collaborators: state.collaborators,
      }));
    }
  });

  private onCut = withBatchedUpdates((event: ClipboardEvent) => {
    if (isWritableElement(event.target)) {
      return;
    }
    copyToAppClipboard(globalSceneState.getAllElements(), this.state);
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
    copyToAppClipboard(globalSceneState.getAllElements(), this.state);
    event.preventDefault();
  });

  private onUnload = withBatchedUpdates(() => {
    isHoldingSpace = false;
    this.saveDebounced();
    this.saveDebounced.flush();
  });

  private disableEvent: EventHandlerNonNull = event => {
    event.preventDefault();
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

  private initializeSocketClient = () => {
    if (this.socket) {
      return;
    }
    const roomMatch = getCollaborationLinkData(window.location.href);
    if (roomMatch) {
      this.setState({
        isCollaborating: true,
      });
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
            case "SCENE_UPDATE":
              const { elements: remoteElements } = decryptedData.payload;
              const restoredState = restore(remoteElements || [], null, {
                scrollToContent: true,
              });
              // Perform reconciliation - in collaboration, if we encounter
              // elements with more staler versions than ours, ignore them
              // and keep ours.
              if (
                globalSceneState.getAllElements() == null ||
                globalSceneState.getAllElements().length === 0
              ) {
                globalSceneState.replaceAllElements(restoredState.elements);
              } else {
                // create a map of ids so we don't have to iterate
                // over the array more than once.
                const localElementMap = getElementMap(
                  globalSceneState.getAllElements(),
                );

                // Reconcile
                globalSceneState.replaceAllElements(
                  restoredState.elements
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
                        localElementMap[element.id].version ===
                          element.version &&
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
                    }, [] as Mutable<typeof restoredState.elements>)
                    // add local elements that weren't deleted or on remote
                    .concat(...Object.values(localElementMap)),
                );
              }
              this.lastBroadcastedOrReceivedSceneVersion = getDrawingVersion(
                globalSceneState.getAllElements(),
              );
              // We haven't yet implemented multiplayer undo functionality, so we clear the undo stack
              // when we receive any messages from another peer. This UX can be pretty rough -- if you
              // undo, a user makes a change, and then try to redo, your element(s) will be lost. However,
              // right now we think this is the right tradeoff.
              history.clear();
              if (this.socketInitialized === false) {
                this.socketInitialized = true;
              }
              break;
            case "MOUSE_LOCATION":
              const { socketID, pointerCoords } = decryptedData.payload;
              this.setState(state => {
                if (!state.collaborators.has(socketID)) {
                  state.collaborators.set(socketID, {});
                }
                const user = state.collaborators.get(socketID)!;
                user.pointer = pointerCoords;
                state.collaborators.set(socketID, user);
                return state;
              });
              break;
          }
        },
      );
      this.socket.on("first-in-room", () => {
        if (this.socket) {
          this.socket.off("first-in-room");
        }
        this.socketInitialized = true;
      });
      this.socket.on("room-user-change", (clients: string[]) => {
        this.setState(state => {
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
        this.broadcastSceneUpdate();
      });
    }
  };

  private broadcastMouseLocation = (payload: {
    pointerCoords: SocketUpdateDataSource["MOUSE_LOCATION"]["payload"]["pointerCoords"];
  }) => {
    if (this.socket?.id) {
      const data: SocketUpdateDataSource["MOUSE_LOCATION"] = {
        type: "MOUSE_LOCATION",
        payload: {
          socketID: this.socket.id,
          pointerCoords: payload.pointerCoords,
        },
      };
      return this._broadcastSocketData(
        data as typeof data & { _brand: "socketUpdateData" },
      );
    }
  };

  private broadcastSceneUpdate = () => {
    const data: SocketUpdateDataSource["SCENE_UPDATE"] = {
      type: "SCENE_UPDATE",
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
    window.addEventListener("blur", this.onUnload, false);
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

    const searchParams = new URLSearchParams(window.location.search);
    const id = searchParams.get("id");

    if (id) {
      // Backwards compatibility with legacy url format
      const scene = await loadScene(id);
      this.syncActionResult(scene);
    }

    const jsonMatch = window.location.hash.match(
      /^#json=([0-9]+),([a-zA-Z0-9_-]+)$/,
    );
    if (jsonMatch) {
      const scene = await loadScene(jsonMatch[1], jsonMatch[2]);
      this.syncActionResult(scene);
      return;
    }

    const roomMatch = getCollaborationLinkData(window.location.href);
    if (roomMatch) {
      this.initializeSocketClient();
      return;
    }
    const scene = await loadScene(null);
    this.syncActionResult(scene);

    window.addEventListener("beforeunload", this.beforeUnload);
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
    window.removeEventListener("blur", this.onUnload, false);
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

  public state: AppState = getDefaultAppState();

  private onResize = withBatchedUpdates(() => {
    globalSceneState
      .getAllElements()
      .forEach(element => invalidateShapeForElement(element));
    this.setState({});
  });

  private updateCurrentCursorPosition = withBatchedUpdates(
    (event: MouseEvent) => {
      cursorX = event.x;
      cursorY = event.y;
    },
  );

  private onKeyDown = withBatchedUpdates((event: KeyboardEvent) => {
    if (
      (isWritableElement(event.target) && event.key !== KEYS.ESCAPE) ||
      // case: using arrows to move between buttons
      (isArrowKey(event.key) && isInputLike(event.target))
    ) {
      return;
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
        globalSceneState.getAllElements().map(el => {
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

  private copyToAppClipboard = () => {
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

  private pasteFromClipboard = withBatchedUpdates(
    async (event: ClipboardEvent | null) => {
      // #686
      const target = document.activeElement;
      const elementUnderCursor = document.elementFromPoint(cursorX, cursorY);
      if (
        // if no ClipboardEvent supplied, assume we're pasting via contextMenu
        //  thus these checks don't make sense
        !event ||
        (elementUnderCursor instanceof HTMLCanvasElement &&
          !isWritableElement(target))
      ) {
        const data = await getClipboardContent(event);
        if (data.elements) {
          this.addElementsFromPaste(data.elements);
        } else if (data.text) {
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
            text: data.text,
            font: this.state.currentItemFont,
          });

          globalSceneState.replaceAllElements([
            ...globalSceneState.getAllElements(),
            element,
          ]);
          this.setState({ selectedElementIds: { [element.id]: true } });
          history.resumeRecording();
        }
        this.selectShapeTool("selection");
        event?.preventDefault();
      }
    },
  );

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
    this.initializeSocketClient();
  };

  destroyRoom = () => {
    window.history.pushState({}, "Excalidraw", window.location.origin);
    this.destroySocketClient();
  };

  toggleLock = () => {
    this.setState(prevState => ({
      elementLocked: !prevState.elementLocked,
      elementType: prevState.elementLocked
        ? "selection"
        : prevState.elementType,
    }));
  };

  private setElements = (elements: readonly ExcalidrawElement[]) => {
    globalSceneState.replaceAllElements(elements);
  };

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
          elements={globalSceneState.getAllElements()}
          setElements={this.setElements}
          language={getLanguage()}
          onRoomCreate={this.createRoom}
          onRoomDestroy={this.destroyRoom}
          onToggleLock={this.toggleLock}
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
            ref={canvas => {
              // canvas is null when unmounting
              if (canvas !== null) {
                this.canvas = canvas;
                this.rc = rough.canvas(this.canvas);

                this.canvas.addEventListener("wheel", this.handleWheel, {
                  passive: false,
                });
              } else {
                this.canvas?.removeEventListener("wheel", this.handleWheel);
              }
            }}
            onContextMenu={event => {
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
                      hasNonDeletedElements(
                        globalSceneState.getAllElements(),
                      ) && {
                        label: t("labels.copyAsPng"),
                        action: this.copyToClipboardAsPng,
                      },
                    ...this.actionManager.getContextMenuItems(action =>
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
                    action: this.copyToAppClipboard,
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
                    action => !this.canvasOnlyActions.includes(action.name),
                  ),
                ],
                top: event.clientY,
                left: event.clientX,
              });
            }}
            onPointerDown={this.handleCanvasPointerDown}
            onDoubleClick={this.handleCanvasDoubleClick}
            onPointerMove={this.handleCanvasPointerMove}
            onPointerUp={this.removePointer}
            onPointerCancel={this.removePointer}
            onDrop={event => {
              const file = event.dataTransfer.files[0];
              if (
                file?.type === "application/json" ||
                file?.name.endsWith(".excalidraw")
              ) {
                loadFromBlob(file)
                  .then(({ elements, appState }) =>
                    this.syncActionResult({
                      elements,
                      appState,
                      commitToHistory: false,
                    }),
                  )
                  .catch(error => console.error(error));
              }
            }}
          >
            {t("labels.drawingCanvas")}
          </canvas>
        </main>
      </div>
    );
  }

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

    let textX = event.clientX;
    let textY = event.clientY;

    if (elementAtPosition && isTextElement(elementAtPosition)) {
      globalSceneState.replaceAllElements(
        globalSceneState
          .getAllElements()
          .filter(element => element.id !== elementAtPosition.id),
      );

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
    } else if (!event.altKey) {
      const snappedToCenterPosition = this.getTextWysiwygSnappedToCenterPosition(
        x,
        y,
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

    const resetSelection = () => {
      this.setState({
        draggingElement: null,
        editingElement: null,
      });
    };

    // deselect all other elements when inserting text
    this.setState({ selectedElementIds: {} });

    textWysiwyg({
      initText: element.text,
      x: textX,
      y: textY,
      strokeColor: element.strokeColor,
      font: element.font,
      opacity: this.state.currentItemOpacity,
      zoom: this.state.zoom,
      onSubmit: text => {
        if (text) {
          globalSceneState.replaceAllElements([
            ...globalSceneState.getAllElements(),
            // we need to recreate the element to update dimensions & position
            newTextElement({ ...element, text, font: element.font }),
          ]);
        }
        this.setState(prevState => ({
          selectedElementIds: {
            ...prevState.selectedElementIds,
            [element.id]: true,
          },
        }));
        history.resumeRecording();
        resetSelection();
      },
      onCancel: () => {
        resetSelection();
      },
    });
  };

  private handleCanvasPointerMove = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    const pointerCoords = viewportCoordsToSceneCoords(
      event,
      this.state,
      this.canvas,
      window.devicePixelRatio,
    );
    this.savePointer(pointerCoords);
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
      });
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

    this.setState({ lastPointerDownWith: event.pointerType });

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
            this.setState(prevState => ({
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
        : this.getTextWysiwygSnappedToCenterPosition(x, y);

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

      const resetSelection = () => {
        this.setState({
          draggingElement: null,
          editingElement: null,
        });
      };

      textWysiwyg({
        initText: "",
        x: snappedToCenterPosition?.wysiwygX ?? event.clientX,
        y: snappedToCenterPosition?.wysiwygY ?? event.clientY,
        strokeColor: this.state.currentItemStrokeColor,
        opacity: this.state.currentItemOpacity,
        font: this.state.currentItemFont,
        zoom: this.state.zoom,
        onSubmit: text => {
          if (text) {
            globalSceneState.replaceAllElements([
              ...globalSceneState.getAllElements(),
              newTextElement({
                ...element,
                text,
                font: this.state.currentItemFont,
              }),
            ]);
          }
          this.setState(prevState => ({
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
        },
        onCancel: () => {
          resetSelection();
        },
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
        this.setState(prevState => ({
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
        this.setState(prevState => ({
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
      const p1 = element.points[pointIndex];
      if (perfect) {
        const absPx = p1[0] + element.x;
        const absPy = p1[1] + element.y;

        const { width, height } = getPerfectElementSize(
          element.type,
          pointerX - element.x - p1[0],
          pointerY - element.y - p1[1],
        );

        const dx = element.x + width + p1[0];
        const dy = element.y + height + p1[1];
        mutateElement(element, {
          x: dx,
          y: dy,
          points: element.points.map((point, i) =>
            i === pointIndex
              ? ([absPx - element.x, absPy - element.y] as const)
              : point,
          ),
        });
      } else {
        mutateElement(element, {
          x: element.x + deltaX,
          y: element.y + deltaY,
          points: element.points.map((point, i) =>
            i === pointIndex
              ? ([p1[0] - deltaX, p1[1] - deltaY] as const)
              : point,
          ),
        });
      }
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
      const p1 = element.points[pointIndex];
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
            i === pointIndex
              ? ([p1[0] + deltaX, p1[1] + deltaY] as const)
              : point,
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
        this.setState({ isResizing: true });
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
          const deltaX = x - lastX;
          const deltaY = y - lastY;
          const element = selectedElements[0];
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
                mutateElement(element, {
                  x: element.x + deltaX,
                  y: event.shiftKey
                    ? element.y + element.height - element.width
                    : element.y + deltaY,
                  width: element.width - deltaX,
                  height: event.shiftKey
                    ? element.width
                    : element.height - deltaY,
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
                const nextWidth = element.width + deltaX;
                mutateElement(element, {
                  y: event.shiftKey
                    ? element.y + element.height - nextWidth
                    : element.y + deltaY,
                  width: nextWidth,
                  height: event.shiftKey ? nextWidth : element.height - deltaY,
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
                mutateElement(element, {
                  x: element.x + deltaX,
                  width: element.width - deltaX,
                  height: event.shiftKey
                    ? element.width
                    : element.height + deltaY,
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
                mutateElement(element, {
                  width: element.width + deltaX,
                  height: event.shiftKey
                    ? element.width
                    : element.height + deltaY,
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
                  y: element.y + deltaY,
                  points: rescalePoints(1, height, element.points),
                });
              } else {
                mutateElement(element, {
                  height,
                  y: element.y + deltaY,
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
                  x: element.x + deltaX,
                  points: rescalePoints(0, width, element.points),
                });
              } else {
                mutateElement(element, {
                  width,
                  x: element.x + deltaX,
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
                  points: rescalePoints(1, height, element.points),
                });
              } else {
                mutateElement(element, {
                  height,
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
                  points: rescalePoints(0, width, element.points),
                });
              } else {
                mutateElement(element, {
                  width,
                });
              }
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

          selectedElements.forEach(element => {
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
        this.setState(prevState => ({
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

    const onPointerUp = withBatchedUpdates((event: PointerEvent) => {
      const {
        draggingElement,
        resizingElement,
        multiElement,
        elementType,
        elementLocked,
      } = this.state;

      this.setState({
        isResizing: false,
        resizingElement: null,
        selectionElement: null,
        editingElement: multiElement ? this.state.editingElement : null,
      });

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
            event,
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
            this.setState(prevState => ({
              draggingElement: null,
              elementType: "selection",
              selectedElementIds: {
                ...prevState.selectedElementIds,
                [this.state.draggingElement!.id]: true,
              },
            }));
          } else {
            this.setState(prevState => ({
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
            .filter(el => el.id !== resizingElement.id),
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
        if (event.shiftKey) {
          this.setState(prevState => ({
            selectedElementIds: {
              ...prevState.selectedElementIds,
              [hitElement!.id]: false,
            },
          }));
        } else {
          this.setState(prevState => ({
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
        this.setState(prevState => ({
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

    const newElements = clipboardElements.map(element =>
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

  private getTextWysiwygSnappedToCenterPosition(x: number, y: number) {
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
        const wysiwygX =
          this.state.scrollX +
          elementClickedInside.x +
          elementClickedInside.width / 2;
        const wysiwygY =
          this.state.scrollY +
          elementClickedInside.y +
          elementClickedInside.height / 2;
        return { wysiwygX, wysiwygY, elementCenterX, elementCenterY };
      }
    }
  }

  private savePointer = (pointerCoords: { x: number; y: number }) => {
    if (isNaN(pointerCoords.x) || isNaN(pointerCoords.y)) {
      // sometimes the pointer goes off screen
      return;
    }
    this.socket && this.broadcastMouseLocation({ pointerCoords });
  };

  private saveDebounced = debounce(() => {
    saveToLocalStorage(globalSceneState.getAllElements(), this.state);
  }, 300);

  componentDidUpdate() {
    if (this.state.isCollaborating && !this.socket) {
      this.initializeSocketClient();
    }
    const pointerViewportCoords: {
      [id: string]: { x: number; y: number };
    } = {};
    this.state.collaborators.forEach((user, socketID) => {
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
    });
    const { atLeastOneVisibleElement, scrollBars } = renderScene(
      globalSceneState.getAllElements(),
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
      this.broadcastSceneUpdate();
    }

    if (history.isRecording()) {
      history.pushEntry(this.state, globalSceneState.getAllElements());
      history.skipRecording();
    }
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
      history: SceneHistory;
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
