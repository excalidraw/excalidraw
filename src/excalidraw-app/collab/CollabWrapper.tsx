import React, { PureComponent, createRef } from "react";
import { unstable_batchedUpdates } from "react-dom";

import { CollabProvider } from "./CollabContext";

import {
  decryptAESGEM,
  generateCollaborationLink,
  getCollaborationLinkData,
  loadScene,
  SOCKET_SERVER,
  SocketUpdateDataSource,
} from "../../data";
import { INITIAL_SCENE_UPDATE_TIMEOUT } from "../../time_constants";
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
import { AppState, Collaborator } from "../../types";
import { ExcalidrawElement } from "../../element/types";
import { getSceneVersion, getSyncableElements } from "../../element";
import { ExcalidrawImperativeAPI } from "../../components/App";
import { t } from "../../i18n";
import { importFromLocalStorage } from "../../data/localStorage";
import { ImportedDataState } from "../../data/types";

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
  private lastBroadcastedOrReceivedSceneVersion: number = -1;
  private socketInitializationTimer: any;
  private unmounted: boolean;
  private excalidrawRef: any;
  excalidrawAppState?: AppState;
  private initialData: ImportedDataState;
  private isCollabScene: boolean;

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
    this.isCollabScene = !!getCollaborationLinkData(window.location.href);
  }

  componentWillUnmount() {
    this.unmounted = true;
    window.removeEventListener(EVENT.BEFORE_UNLOAD, this.beforeUnload);
    window.removeEventListener(EVENT.UNLOAD, this.onUnload);
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
        this.shouldForceLoadScene(scene) ||
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
    const syncableElements = getSyncableElements(
      this.excalidrawRef.current.getElementsIncludingDeleted(),
    );
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

  saveCollabRoomToFirebase = async (
    syncableElements: ExcalidrawElement[] = getSyncableElements(
      this.excalidrawRef.current.getSceneElementsIncludingDeleted(),
    ),
  ) => {
    try {
      await saveToFirebase(this.portal, syncableElements);
    } catch (error) {
      console.error(error);
    }
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

  public setLastBroadcastedOrReceivedSceneVersion = (version: number) => {
    this.lastBroadcastedOrReceivedSceneVersion = version;
  };

  public getLastBroadcastedOrReceivedSceneVersion = () => {
    return this.lastBroadcastedOrReceivedSceneVersion;
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

  public getSceneElementsIncludingDeleted = () => {
    return this.excalidrawRef.current.getSceneElementsIncludingDeleted();
  };

  private setExcalidrawAppState = (state: AppState) => {
    this.excalidrawAppState = state;
  };

  broadCastScene = (syncAll: boolean) => {
    this.portal.broadcastScene(SCENE.UPDATE, syncAll);
  };

  onMouseBroadCast = (payload: {
    pointer: SocketUpdateDataSource["MOUSE_LOCATION"]["payload"]["pointer"];
    button: SocketUpdateDataSource["MOUSE_LOCATION"]["payload"]["button"];
  }) => {
    this.portal.socket && this.portal.broadcastMouseLocation(payload);
  };

  getValue() {
    return {
      onCollaborationStart: this.openPortal,
      onCollaborationEnd: this.closePortal,
      excalidrawRef: this.excalidrawRef,
      setExcalidrawAppState: this.setExcalidrawAppState,
      isCollaborating: this.state.isCollaborating,
      broadCastScene: this.broadCastScene,
      onMouseBroadCast: this.onMouseBroadCast,
      collaborators: this.state.collaborators,
      initializeScene: this.initializeScene,
      isCollaborationScene: this.isCollaborationScene,
    };
  }

  render() {
    const { children } = this.props;
    return <CollabProvider value={this.getValue()}> {children}</CollabProvider>;
  }
}

export default CollabWrapper;
