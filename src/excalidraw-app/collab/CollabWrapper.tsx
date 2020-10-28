import React, { PureComponent, createRef } from "react";
import { unstable_batchedUpdates } from "react-dom";

import { CollabProvider } from "./CollabContext";

import {
  decryptAESGEM,
  generateCollaborationLink,
  getCollaborationLinkData,
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
  }

  componentDidMount() {
    this.unmounted = true;
    window.addEventListener(EVENT.BEFORE_UNLOAD, this.beforeUnload);
    this.initializeScene();
  }

  componentWillUnmount() {
    this.unmounted = true;
    window.removeEventListener(EVENT.BEFORE_UNLOAD, this.beforeUnload);
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

              // NOTE purposefully mutating collaborators map in case of
              //  pointer updates so as not to trigger LayerUI rerender
              this.setState((state) => {
                if (!state.collaborators.has(socketId)) {
                  state.collaborators.set(socketId, {});
                }
                const user = state.collaborators.get(socketId)!;
                user.pointer = pointer;
                user.button = button;
                user.selectedElementIds = selectedElementIds;
                user.username = username;
                state.collaborators.set(socketId, user);
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

  initializeScene = () => {
    const isCollaborationScene = !!getCollaborationLinkData(
      window.location.href,
    );
    if (isCollaborationScene) {
      this.initializeSocketClient({ showLoadingState: true });
    }
  };

  getValue() {
    return {
      onCollaborationStart: this.openPortal,
      excalidrawRef: this.excalidrawRef,
      setExcalidrawAppState: this.setExcalidrawAppState,
      isCollaborating: this.state.isCollaborating,
      broadCastScene: this.broadCastScene,
    };
  }

  render() {
    const { children } = this.props;
    return <CollabProvider value={this.getValue()}> {children}</CollabProvider>;
  }
}

export default CollabWrapper;
