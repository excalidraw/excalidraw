import throttle from "lodash.throttle";
import React, { PureComponent } from "react";
import { ExcalidrawImperativeAPI } from "../../components/App";
import { ErrorDialog } from "../../components/ErrorDialog";
import { APP_NAME, ENV, EVENT } from "../../constants";
import { ImportedDataState } from "../../data/types";
import { ExcalidrawElement } from "../../element/types";
import {
  getSceneVersion,
  getSyncableElements,
} from "../../packages/excalidraw/index";
import { AppState, Collaborator, Gesture } from "../../types";
import { resolvablePromise, withBatchedUpdates } from "../../utils";
import {
  INITIAL_SCENE_UPDATE_TIMEOUT,
  SCENE,
  SYNC_FULL_SCENE_INTERVAL_MS,
} from "../app_constants";
import {
  decryptAESGEM,
  generateCollaborationLink,
  getCollaborationLinkData,
  SocketUpdateDataSource,
  SOCKET_SERVER,
} from "../data";
import { isSavedToFirebase, saveToFirebase } from "../data/firebase";
import {
  importUsernameFromLocalStorage,
  saveUsernameToLocalStorage,
  STORAGE_KEYS,
} from "../data/localStorage";
import Portal from "./Portal";
import RoomDialog from "./RoomDialog";

interface CollabState {
  isCollaborating: boolean;
  modalIsShown: boolean;
  errorMessage: string;
  username: string;
  activeRoomLink: string;
}

type CollabInstance = InstanceType<typeof CollabWrapper>;

export interface CollabAPI {
  isCollaborating: CollabState["isCollaborating"];
  username: CollabState["username"];
  onPointerUpdate: CollabInstance["onPointerUpdate"];
  initializeSocketClient: CollabInstance["initializeSocketClient"];
  onCollabButtonClick: CollabInstance["onCollabButtonClick"];
  broadcastElements: CollabInstance["broadcastElements"];
}

type ReconciledElements = readonly ExcalidrawElement[] & {
  _brand: "reconciledElements";
};

interface Props {
  children: (collab: CollabAPI) => React.ReactNode;
  // NOTE not type-safe because the refObject may in fact not be initialized
  // with ExcalidrawImperativeAPI yet
  excalidrawRef: React.MutableRefObject<ExcalidrawImperativeAPI>;
}

class CollabWrapper extends PureComponent<Props, CollabState> {
  portal: Portal;
  private socketInitializationTimer?: NodeJS.Timeout;
  private excalidrawRef: Props["excalidrawRef"];
  excalidrawAppState?: AppState;
  private lastBroadcastedOrReceivedSceneVersion: number = -1;
  private collaborators = new Map<string, Collaborator>();

  constructor(props: Props) {
    super(props);
    this.state = {
      isCollaborating: false,
      modalIsShown: false,
      errorMessage: "",
      username: importUsernameFromLocalStorage() || "",
      activeRoomLink: "",
    };
    this.portal = new Portal(this);
    this.excalidrawRef = props.excalidrawRef;
  }

  componentDidMount() {
    window.addEventListener(EVENT.BEFORE_UNLOAD, this.beforeUnload);
    window.addEventListener(EVENT.UNLOAD, this.onUnload);

    if (
      process.env.NODE_ENV === ENV.TEST ||
      process.env.NODE_ENV === ENV.DEVELOPMENT
    ) {
      window.h = window.h || ({} as Window["h"]);
      Object.defineProperties(window.h, {
        collab: {
          configurable: true,
          value: this,
        },
      });
    }
  }

  componentWillUnmount() {
    window.removeEventListener(EVENT.BEFORE_UNLOAD, this.beforeUnload);
    window.removeEventListener(EVENT.UNLOAD, this.onUnload);
  }

  private onUnload = () => {
    this.destroySocketClient();
  };

  private beforeUnload = withBatchedUpdates((event: BeforeUnloadEvent) => {
    const syncableElements = getSyncableElements(
      this.getSceneElementsIncludingDeleted(),
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

    if (this.state.isCollaborating || this.portal.roomId) {
      try {
        localStorage?.setItem(
          STORAGE_KEYS.LOCAL_STORAGE_KEY_COLLAB_FORCE_FLAG,
          JSON.stringify({
            timestamp: Date.now(),
            room: this.portal.roomId,
          }),
        );
      } catch {}
    }
  });

  saveCollabRoomToFirebase = async (
    syncableElements: ExcalidrawElement[] = getSyncableElements(
      this.excalidrawRef.current!.getSceneElementsIncludingDeleted(),
    ),
  ) => {
    try {
      await saveToFirebase(this.portal, syncableElements);
    } catch (error) {
      console.error(error);
    }
  };

  openPortal = async () => {
    window.history.pushState({}, APP_NAME, await generateCollaborationLink());
    const elements = this.excalidrawRef.current!.getSceneElements();
    // remove deleted elements from elements array & history to ensure we don't
    // expose potentially sensitive user data in case user manually deletes
    // existing elements (or clears scene), which would otherwise be persisted
    // to database even if deleted before creating the room.
    this.excalidrawRef.current!.history.clear();
    this.excalidrawRef.current!.updateScene({
      elements,
      commitToHistory: true,
    });
    return this.initializeSocketClient();
  };

  closePortal = () => {
    this.saveCollabRoomToFirebase();
    window.history.pushState({}, APP_NAME, window.location.origin);
    this.destroySocketClient();
  };

  private destroySocketClient = () => {
    this.collaborators = new Map();
    this.excalidrawRef.current!.updateScene({
      collaborators: this.collaborators,
    });
    this.setState({
      isCollaborating: false,
      activeRoomLink: "",
    });
    this.portal.close();
  };

  private initializeSocketClient = async (): Promise<ImportedDataState | null> => {
    if (this.portal.socket) {
      return null;
    }

    const scenePromise = resolvablePromise<ImportedDataState | null>();

    const roomMatch = getCollaborationLinkData(window.location.href);

    if (roomMatch) {
      const roomId = roomMatch[1];
      const roomKey = roomMatch[2];

      // fallback in case you're not alone in the room but still don't receive
      // initial SCENE_UPDATE message
      this.socketInitializationTimer = setTimeout(() => {
        this.initializeSocket();
        scenePromise.resolve(null);
      }, INITIAL_SCENE_UPDATE_TIMEOUT);

      const { default: socketIOClient }: any = await import(
        /* webpackChunkName: "socketIoClient" */ "socket.io-client"
      );

      this.portal.open(socketIOClient(SOCKET_SERVER), roomId, roomKey);

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
                const reconciledElements = this.reconcileElements(
                  remoteElements,
                );
                this.handleRemoteSceneUpdate(reconciledElements, {
                  init: true,
                });
                this.initializeSocket();
                scenePromise.resolve({ elements: reconciledElements });
              }
              break;
            }
            case SCENE.UPDATE:
              this.handleRemoteSceneUpdate(
                this.reconcileElements(decryptedData.payload.elements),
              );
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

              const collaborators = new Map(this.collaborators);
              const user = collaborators.get(socketId) || {}!;
              user.pointer = pointer;
              user.button = button;
              user.selectedElementIds = selectedElementIds;
              user.username = username;
              collaborators.set(socketId, user);
              this.excalidrawRef.current!.updateScene({
                collaborators,
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
        scenePromise.resolve(null);
      });

      this.setState({
        isCollaborating: true,
        activeRoomLink: window.location.href,
      });

      return scenePromise;
    }

    return null;
  };

  private initializeSocket = () => {
    this.portal.socketInitialized = true;
    clearTimeout(this.socketInitializationTimer!);
  };

  private reconcileElements = (
    elements: readonly ExcalidrawElement[],
  ): ReconciledElements => {
    const newElements = this.portal.reconcileElements(elements);

    // Avoid broadcasting to the rest of the collaborators the scene
    // we just received!
    // Note: this needs to be set before updating the scene as it
    // syncronously calls render.
    this.setLastBroadcastedOrReceivedSceneVersion(getSceneVersion(newElements));

    return newElements as ReconciledElements;
  };

  private handleRemoteSceneUpdate = (
    elements: ReconciledElements,
    {
      init = false,
      initFromSnapshot = false,
    }: { init?: boolean; initFromSnapshot?: boolean } = {},
  ) => {
    if (init || initFromSnapshot) {
      this.excalidrawRef.current!.setScrollToCenter(elements);
    }

    this.excalidrawRef.current!.updateScene({
      elements,
      commitToHistory: !!init,
    });

    // We haven't yet implemented multiplayer undo functionality, so we clear the undo stack
    // when we receive any messages from another peer. This UX can be pretty rough -- if you
    // undo, a user makes a change, and then try to redo, your element(s) will be lost. However,
    // right now we think this is the right tradeoff.
    this.excalidrawRef.current!.history.clear();
  };

  setCollaborators(sockets: string[]) {
    this.setState((state) => {
      const collaborators: InstanceType<
        typeof CollabWrapper
      >["collaborators"] = new Map();
      for (const socketId of sockets) {
        if (this.collaborators.has(socketId)) {
          collaborators.set(socketId, this.collaborators.get(socketId)!);
        } else {
          collaborators.set(socketId, {});
        }
      }
      this.collaborators = collaborators;
      this.excalidrawRef.current!.updateScene({ collaborators });
    });
  }

  public setLastBroadcastedOrReceivedSceneVersion = (version: number) => {
    this.lastBroadcastedOrReceivedSceneVersion = version;
  };

  public getLastBroadcastedOrReceivedSceneVersion = () => {
    return this.lastBroadcastedOrReceivedSceneVersion;
  };

  public getSceneElementsIncludingDeleted = () => {
    return this.excalidrawRef.current!.getSceneElementsIncludingDeleted();
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

  broadcastElements = (
    elements: readonly ExcalidrawElement[],
    state: AppState,
  ) => {
    this.excalidrawAppState = state;
    if (
      getSceneVersion(elements) >
      this.getLastBroadcastedOrReceivedSceneVersion()
    ) {
      this.portal.broadcastScene(
        SCENE.UPDATE,
        getSyncableElements(elements),
        false,
      );
      this.lastBroadcastedOrReceivedSceneVersion = getSceneVersion(elements);
      this.queueBroadcastAllElements();
    }
  };

  queueBroadcastAllElements = throttle(() => {
    this.portal.broadcastScene(
      SCENE.UPDATE,
      getSyncableElements(
        this.excalidrawRef.current!.getSceneElementsIncludingDeleted(),
      ),
      true,
    );
    const currentVersion = this.getLastBroadcastedOrReceivedSceneVersion();
    const newVersion = Math.max(
      currentVersion,
      getSceneVersion(this.getSceneElementsIncludingDeleted()),
    );
    this.setLastBroadcastedOrReceivedSceneVersion(newVersion);
  }, SYNC_FULL_SCENE_INTERVAL_MS);

  handleClose = () => {
    this.setState({ modalIsShown: false });
    const collabIcon = document.querySelector(".CollabButton") as HTMLElement;
    collabIcon.focus();
  };

  onUsernameChange = (username: string) => {
    this.setState({ username });
    saveUsernameToLocalStorage(username);
  };

  onCollabButtonClick = () => {
    this.setState({
      modalIsShown: true,
    });
  };

  render() {
    const { children } = this.props;
    const { modalIsShown, username, errorMessage, activeRoomLink } = this.state;

    return (
      <>
        {modalIsShown && (
          <RoomDialog
            handleClose={this.handleClose}
            activeRoomLink={activeRoomLink}
            username={username}
            onUsernameChange={this.onUsernameChange}
            onRoomCreate={this.openPortal}
            onRoomDestroy={this.closePortal}
            setErrorMessage={(errorMessage) => {
              this.setState({ errorMessage });
            }}
          />
        )}
        {errorMessage && (
          <ErrorDialog
            message={errorMessage}
            onClose={() => this.setState({ errorMessage: "" })}
          />
        )}
        {children({
          isCollaborating: this.state.isCollaborating,
          username: this.state.username,
          onPointerUpdate: this.onPointerUpdate,
          initializeSocketClient: this.initializeSocketClient,
          onCollabButtonClick: this.onCollabButtonClick,
          broadcastElements: this.broadcastElements,
        })}
      </>
    );
  }
}

export default CollabWrapper;
