import throttle from "lodash.throttle";
import React, { PureComponent } from "react";
import { ExcalidrawImperativeAPI } from "../../components/App";
import { ErrorDialog } from "../../components/ErrorDialog";
import { APP_NAME, ENV, EVENT } from "../../constants";
import { ImportedDataState } from "../../data/types";
import { ExcalidrawElement } from "../../element/types";
import {
  getElementMap,
  getSceneVersion,
  getSyncableElements,
} from "../../packages/excalidraw/index";
import { Collaborator, Gesture } from "../../types";
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
import { createInverseContext } from "../../createInverseContext";

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
  excalidrawAPI: ExcalidrawImperativeAPI;
}

const {
  Context: CollabContext,
  Consumer: CollabContextConsumer,
  Provider: CollabContextProvider,
} = createInverseContext<{ api: CollabAPI | null }>({ api: null });

export { CollabContext, CollabContextConsumer };

class CollabWrapper extends PureComponent<Props, CollabState> {
  portal: Portal;
  excalidrawAPI: Props["excalidrawAPI"];
  private socketInitializationTimer?: NodeJS.Timeout;
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
    this.excalidrawAPI = props.excalidrawAPI;
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
      this.excalidrawAPI.getSceneElementsIncludingDeleted(),
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
    const elements = this.excalidrawAPI.getSceneElements();
    // remove deleted elements from elements array & history to ensure we don't
    // expose potentially sensitive user data in case user manually deletes
    // existing elements (or clears scene), which would otherwise be persisted
    // to database even if deleted before creating the room.
    this.excalidrawAPI.history.clear();
    this.excalidrawAPI.updateScene({
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
    this.excalidrawAPI.updateScene({
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
              this.excalidrawAPI.updateScene({
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
    const currentElements = this.getSceneElementsIncludingDeleted();
    // create a map of ids so we don't have to iterate
    // over the array more than once.
    const localElementMap = getElementMap(currentElements);

    const appState = this.excalidrawAPI.getAppState();

    // Reconcile
    const newElements: readonly ExcalidrawElement[] = elements
      .reduce((elements, element) => {
        // if the remote element references one that's currently
        // edited on local, skip it (it'll be added in the next step)
        if (
          element.id === appState.editingElement?.id ||
          element.id === appState.resizingElement?.id ||
          element.id === appState.draggingElement?.id
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
          localElementMap[element.id].versionNonce !== element.versionNonce
        ) {
          // resolve conflicting edits deterministically by taking the one with the lowest versionNonce
          if (localElementMap[element.id].versionNonce < element.versionNonce) {
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
      }, [] as Mutable<typeof elements>)
      // add local elements that weren't deleted or on remote
      .concat(...Object.values(localElementMap));

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
      this.excalidrawAPI.setScrollToCenter(elements);
    }

    this.excalidrawAPI.updateScene({
      elements,
      commitToHistory: !!init,
    });

    // We haven't yet implemented multiplayer undo functionality, so we clear the undo stack
    // when we receive any messages from another peer. This UX can be pretty rough -- if you
    // undo, a user makes a change, and then try to redo, your element(s) will be lost. However,
    // right now we think this is the right tradeoff.
    this.excalidrawAPI.history.clear();
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
      this.excalidrawAPI.updateScene({ collaborators });
    });
  }

  public setLastBroadcastedOrReceivedSceneVersion = (version: number) => {
    this.lastBroadcastedOrReceivedSceneVersion = version;
  };

  public getLastBroadcastedOrReceivedSceneVersion = () => {
    return this.lastBroadcastedOrReceivedSceneVersion;
  };

  public getSceneElementsIncludingDeleted = () => {
    return this.excalidrawAPI.getSceneElementsIncludingDeleted();
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

  broadcastElements = (elements: readonly ExcalidrawElement[]) => {
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
        this.excalidrawAPI.getSceneElementsIncludingDeleted(),
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

  /** PRIVATE. Use `this.getContextValue()` instead. */
  private contextValue: CollabAPI | null = null;

  /** Getter of context value. Returned object is stable. */
  getContextValue = (): CollabAPI => {
    this.contextValue = this.contextValue || ({} as CollabAPI);

    this.contextValue.isCollaborating = this.state.isCollaborating;
    this.contextValue.username = this.state.username;
    this.contextValue.onPointerUpdate = this.onPointerUpdate;
    this.contextValue.initializeSocketClient = this.initializeSocketClient;
    this.contextValue.onCollabButtonClick = this.onCollabButtonClick;
    this.contextValue.broadcastElements = this.broadcastElements;
    return this.contextValue;
  };

  render() {
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
        <CollabContextProvider
          value={{
            api: this.getContextValue(),
          }}
        />
      </>
    );
  }
}

export default CollabWrapper;
