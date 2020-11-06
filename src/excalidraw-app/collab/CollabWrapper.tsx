import React, { PureComponent, createRef } from "react";
import { unstable_batchedUpdates } from "react-dom";
import throttle from "lodash.throttle";

import { CollabProvider } from "./CollabContext";

import {
  decryptAESGEM,
  generateCollaborationLink,
  getCollaborationLinkData,
  loadScene,
  SOCKET_SERVER,
  SocketUpdateDataSource,
} from "../../data";
import {
  INITIAL_SCENE_UPDATE_TIMEOUT,
  SAVE_TO_LOCAL_STORAGE_TIMEOUT,
  SYNC_FULL_SCENE_INTERVAL_MS,
} from "../../time_constants";
import {
  EVENT,
  LOCAL_STORAGE_KEY_COLLAB_FORCE_FLAG,
  SCENE,
} from "../../constants";
import {
  isSavedToFirebase,
  loadFromFirebase,
  saveToFirebase,
} from "../../data/firebase";
import Portal from "../../components/Portal";
import { AppState, Collaborator, Gesture } from "../../types";
import { ExcalidrawElement } from "../../element/types";
import { ExcalidrawImperativeAPI } from "../../components/App";
import { t } from "../../i18n";
import {
  importFromLocalStorage,
  saveToLocalStorage,
} from "../../data/localStorage";
import { ImportedDataState } from "../../data/types";
import { debounce } from "../../utils";
import { getSceneVersion, getSyncableElements } from "../../element";

interface Props {}
interface State {
  isLoading: boolean;
  collaborators: Map<string, Collaborator>;
  isCollaborating: boolean;
}

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

class CollabWrapper extends PureComponent<Props, State> {
  portal: Portal;
  private socketInitializationTimer: any;
  private unmounted: boolean;
  private excalidrawRef: any;
  excalidrawAppState?: AppState;
  private initialData: ImportedDataState;
  private isCollabScene: boolean;
  private lastBroadcastedOrReceivedSceneVersion: number = -1;

  constructor(props: Props) {
    super(props);
    this.state = {
      isLoading: false,
      collaborators: new Map(),
      isCollaborating: false,
    };
    this.portal = new Portal(this);
    this.unmounted = false;
    this.excalidrawRef = createRef<ExcalidrawImperativeAPI>();
    this.initialData = {};
    this.isCollabScene = false;
  }

  componentDidMount() {
    this.unmounted = true;
    this.initialData = importFromLocalStorage();
    window.addEventListener(EVENT.BEFORE_UNLOAD, this.beforeUnload);
    window.addEventListener(EVENT.UNLOAD, this.onUnload);
    window.addEventListener(EVENT.BLUR, this.onBlur, false);

    this.isCollabScene = !!getCollaborationLinkData(window.location.href);
  }

  componentWillUnmount() {
    this.unmounted = true;
    window.removeEventListener(EVENT.BEFORE_UNLOAD, this.beforeUnload);
    window.removeEventListener(EVENT.UNLOAD, this.onUnload);
    window.removeEventListener(EVENT.BLUR, this.onBlur);
  }

  initializeScene = async (scene: any) => {
    const searchParams = new URLSearchParams(window.location.search);
    const id = searchParams.get("id");
    const jsonMatch = window.location.hash.match(
      /^#json=([0-9]+),([a-zA-Z0-9_-]+)$/,
    );
    const isExternalScene = !!(id || jsonMatch || this.isCollabScene);
    if (isExternalScene) {
      if (
        CollabWrapper.shouldForceLoadScene(scene) ||
        window.confirm(t("alerts.loadSceneOverridePrompt"))
      ) {
        // Backwards compatibility with legacy url format
        if (id) {
          scene = await loadScene(id, null, this.initialData);
        } else if (jsonMatch) {
          scene = await loadScene(jsonMatch[1], jsonMatch[2], this.initialData);
        }
        if (!this.isCollabScene) {
          window.history.replaceState({}, "Excalidraw", window.location.origin);
        }
      } else {
        // https://github.com/excalidraw/excalidraw/issues/1919
        if (document.hidden) {
          window.addEventListener(
            "focus",
            () => this.excalidrawRef.current.initializeScene(),
            {
              once: true,
            },
          );
          return;
        }

        this.isCollabScene = false;
        window.history.replaceState({}, "Excalidraw", window.location.origin);
      }
    }

    if (this.isCollabScene) {
      // when joining a room we don't want user's local scene data to be merged
      //  into the remote scene
      this.excalidrawRef.current.resetScene();
      this.initializeSocketClient({ showLoadingState: true });
    }
  };

  private isCollaborationScene() {
    return this.isCollabScene;
  }

  private static shouldForceLoadScene(
    scene: ResolutionType<typeof loadScene>,
  ): boolean {
    if (!scene.elements.length) {
      return true;
    }

    const roomMatch = getCollaborationLinkData(window.location.href);

    if (!roomMatch) {
      return false;
    }

    const roomID = roomMatch[1];

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
        if (previousRoom === roomID && Date.now() - timestamp < 15000) {
          return true;
        }
      } catch {}
    }
    return false;
  }

  private onUnload = () => {
    this.onBlur();
    this.destroySocketClient();
  };

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
    const syncableElements = this.excalidrawRef.current.getSceneSyncableElements();
    if (
      this.state.isCollaborating &&
      !isSavedToFirebase(this.portal, syncableElements)
    ) {
      // this won't run in time if user decides to leave the site, but
      //  the purpose is to run in immediately after user decides to stay
      this.saveCollabRoomToFirebase(syncableElements);

      event.preventDefault();
      // NOTE: modern browsers no longer allow showing a custom message here
      event.returnValue = "";
    }
  });

  private onBlur = () => {
    this.saveDebounced.flush();
  };

  saveCollabRoomToFirebase = async (
    syncableElements: ExcalidrawElement[] = this.excalidrawRef.current.getSceneSyncableElements(),
  ) => {
    try {
      await saveToFirebase(this.portal, syncableElements);
    } catch (error) {
      console.error(error);
    }
  };

  openPortal = async (elements: readonly ExcalidrawElement[]) => {
    window.history.pushState(
      {},
      "Excalidraw",
      await generateCollaborationLink(),
    );
    // remove deleted elements from elements array & history to ensure we don't
    // expose potentially sensitive user data in case user manually deletes
    // existing elements (or clears scene), which would otherwise be persisted
    // to database even if deleted before creating the room.
    this.excalidrawRef.current.history.clear();
    this.excalidrawRef.current.history.resumeRecording();
    this.excalidrawRef.current.updateScene({ elements });
    this.initializeSocketClient({ showLoadingState: false });
  };

  closePortal = () => {
    this.saveCollabRoomToFirebase();
    window.history.pushState({}, "Excalidraw", window.location.origin);
    this.destroySocketClient();
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
      const roomID = roomMatch[1];
      const roomKey = roomMatch[2];

      // fallback in case you're not alone in the room but still don't receive
      //  initial SCENE_UPDATE message
      this.socketInitializationTimer = setTimeout(
        this.initializeSocket,
        INITIAL_SCENE_UPDATE_TIMEOUT,
      );

      const { default: socketIOClient }: any = await import(
        /* webpackChunkName: "socketIoClient" */ "socket.io-client"
      );

      this.portal.open(socketIOClient(SOCKET_SERVER), roomID, roomKey);

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
                const remoteElements = decryptedData.payload.elements;
                this.handleRemoteSceneUpdate(remoteElements, { init: true });
              }
              break;
            }
            case SCENE.UPDATE:
              this.handleRemoteSceneUpdate(decryptedData.payload.elements);
              break;
            case "MOUSE_LOCATION": {
              const {
                pointer,
                button,
                username,
                selectedElementIds,
              } = decryptedData.payload;
              const socketId: SocketUpdateDataSource["MOUSE_LOCATION"]["payload"]["socketId"] =
                decryptedData.payload.socketId ||
                // @ts-ignore legacy, see #2094 (#2097)
                decryptedData.payload.socketID;
              // Will have to find better soln to prevent rerender
              this.setState((state) => {
                const collaborators = new Map(state.collaborators);
                const user = collaborators.get(socketId) || {}!;
                user.pointer = pointer;
                user.button = button;
                user.selectedElementIds = selectedElementIds;
                user.username = username;
                collaborators.set(socketId, user);
                return {
                  ...state,
                  collaborators,
                };
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
        this.initializeSocket();
      });

      this.setState({
        isCollaborating: true,
        isLoading: opts.showLoadingState ? true : this.state.isLoading,
      });

      try {
        const elements = await loadFromFirebase(roomID, roomKey);
        if (elements) {
          this.handleRemoteSceneUpdate(elements, { initFromSnapshot: true });
        }
      } catch (e) {
        // log the error and move on. other peers will sync us the scene.
        console.error(e);
      }
    }
  };

  private initializeSocket = () => {
    this.portal.socketInitialized = true;
    clearTimeout(this.socketInitializationTimer);
    if (this.state.isLoading && !this.unmounted) {
      this.setState({ isLoading: false });
    }
  };

  private handleRemoteSceneUpdate = (
    elements: readonly ExcalidrawElement[],
    {
      init = false,
      initFromSnapshot = false,
    }: { init?: boolean; initFromSnapshot?: boolean } = {},
  ) => {
    if (init) {
      this.excalidrawRef.current.history.resumeRecording();
    }

    if (init || initFromSnapshot) {
      this.excalidrawRef.current.setScrollToCenter(elements);
    }
    const newElements = this.portal.reconcileElements(elements);

    // Avoid broadcasting to the rest of the collaborators the scene
    // we just received!
    // Note: this needs to be set before updating the scene as it
    // syncronously calls render.

    this.setLastBroadcastedOrReceivedSceneVersion(getSceneVersion(newElements));
    this.excalidrawRef.current.updateScene({ elements: newElements });

    // We haven't yet implemented multiplayer undo functionality, so we clear the undo stack
    // when we receive any messages from another peer. This UX can be pretty rough -- if you
    // undo, a user makes a change, and then try to redo, your element(s) will be lost. However,
    // right now we think this is the right tradeoff.
    this.excalidrawRef.current.history.clear();

    if (!this.portal.socketInitialized && !initFromSnapshot) {
      this.initializeSocket();
    }
  };

  setCollaborators(sockets: string[]) {
    this.setState((state) => {
      const collaborators: typeof state.collaborators = new Map();
      for (const socketId of sockets) {
        if (state.collaborators.has(socketId)) {
          collaborators.set(socketId, state.collaborators.get(socketId)!);
        } else {
          collaborators.set(socketId, {});
        }
      }
      return {
        ...state,
        collaborators,
      };
    });
  }

  public setLastBroadcastedOrReceivedSceneVersion = (version: number) => {
    this.lastBroadcastedOrReceivedSceneVersion = version;
  };

  public getLastBroadcastedOrReceivedSceneVersion = () => {
    return this.lastBroadcastedOrReceivedSceneVersion;
  };

  public getSceneElementsIncludingDeleted = () => {
    return this.excalidrawRef.current.getSceneElementsIncludingDeleted();
  };

  public getSceneSyncableElemets = () => {
    return this.excalidrawRef.current.getSceneSyncableElements();
  };

  onSceneBroadCast = (
    syncableElements: ExcalidrawElement[],
    syncAll: boolean,
  ) => {
    this.portal.broadcastScene(SCENE.UPDATE, syncableElements, syncAll);
  };

  onPointerUpdate = (payload: {
    pointer: SocketUpdateDataSource["MOUSE_LOCATION"]["payload"]["pointer"];
    button: SocketUpdateDataSource["MOUSE_LOCATION"]["payload"]["button"];
    pointersMap: Gesture["pointers"];
  }) => {
    payload.pointersMap.size < 2 &&
      this.portal.socket &&
      this.portal.broadcastMouseLocation(payload);
  };

  onChange = (elements: readonly ExcalidrawElement[], state: AppState) => {
    this.saveDebounced(elements, state);
    this.excalidrawAppState = state;

    if (
      getSceneVersion(elements) >
      this.getLastBroadcastedOrReceivedSceneVersion()
    ) {
      this.onSceneBroadCast(getSyncableElements(elements), false);
      this.lastBroadcastedOrReceivedSceneVersion = getSceneVersion(elements);
      this.queueBroadcastAllElements();
    }
  };

  private saveDebounced = debounce(
    (elements: readonly ExcalidrawElement[], state: AppState) => {
      saveToLocalStorage(elements, state);
    },
    SAVE_TO_LOCAL_STORAGE_TIMEOUT,
  );

  queueBroadcastAllElements = throttle(() => {
    this.onSceneBroadCast(
      this.excalidrawRef.current.getSceneSyncableElements(),
      true,
    );
    const currentVersion = this.getLastBroadcastedOrReceivedSceneVersion();
    const newVersion = Math.max(
      currentVersion,
      getSceneVersion(
        this.excalidrawRef.current.getSceneElementsIncludingDeleted(),
      ),
    );
    this.setLastBroadcastedOrReceivedSceneVersion(newVersion);
  }, SYNC_FULL_SCENE_INTERVAL_MS);

  getValue() {
    return {
      onCollaborationStart: this.openPortal,
      onCollaborationEnd: this.closePortal,
      excalidrawRef: this.excalidrawRef,
      isCollaborating: this.state.isCollaborating,
      onPointerUpdate: this.onPointerUpdate,
      collaborators: this.state.collaborators,
      initializeScene: this.initializeScene,
      isCollaborationScene: this.isCollaborationScene,
      onChange: this.onChange,
    };
  }

  render() {
    const { children } = this.props;
    return <CollabProvider value={this.getValue()}> {children}</CollabProvider>;
  }
}

export default CollabWrapper;
