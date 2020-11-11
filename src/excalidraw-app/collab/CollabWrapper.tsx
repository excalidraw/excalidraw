import React, { PureComponent } from "react";
import throttle from "lodash.throttle";

import {
  INITIAL_SCENE_UPDATE_TIMEOUT,
  SAVE_TO_LOCAL_STORAGE_TIMEOUT,
  SYNC_FULL_SCENE_INTERVAL_MS,
} from "../../time_constants";
import { EVENT, SCENE } from "../../constants";

import {
  decryptAESGEM,
  SocketUpdateDataSource,
  getCollaborationLinkData,
  generateCollaborationLink,
  SOCKET_SERVER,
} from "../data";
import { isSavedToFirebase, saveToFirebase } from "../data/firebase";

import Portal from "./Portal";
import {
  AppState,
  Collaborator,
  ExcalidrawAPIRefValue,
  Gesture,
} from "../../types";
import { ExcalidrawElement } from "../../element/types";
import { saveToLocalStorage } from "../../data/localStorage";
import { debounce, resolvablePromise, withBatchedUpdates } from "../../utils";
import {
  getSceneVersion,
  getSyncableElements,
} from "../../packages/excalidraw/index";
import RoomDialog from "./RoomDialog";
import { ErrorDialog } from "../../components/ErrorDialog";
import { Emitter } from "../../emitter";
import { ImportedDataState } from "../../data/types";

interface Props {
  excalidrawRef: ExcalidrawAPIRefValue;
  username: string;
}

interface State {
  isLoading: boolean;
  isCollaborating: boolean;
  modalIsShown: boolean;
  errorMessage: string;
  username: string;
  activeRoomLink: string;
}

export interface CollabContext {
  roomId: string | null;
  isCollaborating: State["isCollaborating"];
  onPointerUpdate: InstanceType<typeof CollabWrapper>["onPointerUpdate"];
  initializeSocketClient: InstanceType<
    typeof CollabWrapper
  >["initializeSocketClient"];
  onChangeEmitter: InstanceType<typeof CollabWrapper>["onChangeEmitter"];
  username: State["username"];
  onCollabButtonClick: InstanceType<
    typeof CollabWrapper
  >["onCollabButtonClick"];
}

type ReconciledElements = readonly ExcalidrawElement[] & {
  _brand: "reconciledElements";
};

class CollabWrapper extends PureComponent<Props, State> {
  portal: Portal;
  private socketInitializationTimer: any;
  private unmounted: boolean;
  private excalidrawRef: any;
  excalidrawAppState?: AppState;
  private lastBroadcastedOrReceivedSceneVersion: number = -1;
  private onChangeEmitter = new Emitter<
    [readonly ExcalidrawElement[], AppState]
  >();
  private collaborators = new Map<string, Collaborator>();

  constructor(props: Props) {
    super(props);
    this.onChangeEmitter.subscribe(this.onChange);
    this.state = {
      isLoading: false,
      isCollaborating: false,
      modalIsShown: false,
      errorMessage: "",
      username: props.username,
      activeRoomLink: "",
    };
    this.portal = new Portal(this);
    this.unmounted = false;
    this.excalidrawRef = props.excalidrawRef;
  }

  componentDidMount() {
    this.unmounted = true;
    window.addEventListener(EVENT.BEFORE_UNLOAD, this.beforeUnload);
    window.addEventListener(EVENT.UNLOAD, this.onUnload);
    window.addEventListener(EVENT.BLUR, this.onBlur, false);
  }

  componentWillUnmount() {
    this.unmounted = true;
    this.onChangeEmitter.unsubscribe(this.onChange);
    window.removeEventListener(EVENT.BEFORE_UNLOAD, this.beforeUnload);
    window.removeEventListener(EVENT.UNLOAD, this.onUnload);
    window.removeEventListener(EVENT.BLUR, this.onBlur);
  }

  private onUnload = () => {
    this.onBlur();
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
  });

  private onBlur = () => {
    this.saveDebounced.flush();
  };

  saveCollabRoomToFirebase = async (
    syncableElements: ExcalidrawElement[] = getSyncableElements(
      this.excalidrawRef.getSceneElementsIncludingDeleted(),
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
    const elements = this.excalidrawRef.getSceneElements();
    // remove deleted elements from elements array & history to ensure we don't
    // expose potentially sensitive user data in case user manually deletes
    // existing elements (or clears scene), which would otherwise be persisted
    // to database even if deleted before creating the room.
    this.excalidrawRef.history.clear();
    this.excalidrawRef.updateScene({ elements, commitToHistory: true });
    this.initializeSocketClient({ showLoadingState: false });
  };

  closePortal = () => {
    this.saveCollabRoomToFirebase();
    window.history.pushState({}, "Excalidraw", window.location.origin);
    this.destroySocketClient();
  };

  private destroySocketClient = () => {
    this.collaborators = new Map();
    this.excalidrawRef.updateScene({
      collaborators: this.collaborators,
    });
    this.setState({
      isCollaborating: false,
      activeRoomLink: "",
    });
    this.portal.close();
  };

  private initializeSocketClient = async (opts: {
    showLoadingState: boolean;
  }): Promise<ImportedDataState | null> => {
    if (this.portal.socket) {
      return null;
    }

    const scenePromise = resolvablePromise<ImportedDataState | null>();

    const roomMatch = getCollaborationLinkData(window.location.href);

    if (roomMatch) {
      const roomID = roomMatch[1];
      const roomKey = roomMatch[2];

      // fallback in case you're not alone in the room but still don't receive
      //  initial SCENE_UPDATE message
      this.socketInitializationTimer = setTimeout(() => {
        this.initializeSocket();
        scenePromise.resolve(null);
      }, INITIAL_SCENE_UPDATE_TIMEOUT);

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
              this.excalidrawRef.updateScene({
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
        isLoading: opts.showLoadingState ? true : this.state.isLoading,
      });

      return scenePromise;
    }

    return null;
  };

  private initializeSocket = () => {
    this.portal.socketInitialized = true;
    clearTimeout(this.socketInitializationTimer);
    if (this.state.isLoading && !this.unmounted) {
      this.setState({ isLoading: false });
    }
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
      this.excalidrawRef.setScrollToCenter(elements);
    }

    this.excalidrawRef.updateScene({
      elements: elements,
      commitToHistory: !!init,
    });

    // We haven't yet implemented multiplayer undo functionality, so we clear the undo stack
    // when we receive any messages from another peer. This UX can be pretty rough -- if you
    // undo, a user makes a change, and then try to redo, your element(s) will be lost. However,
    // right now we think this is the right tradeoff.
    this.excalidrawRef.history.clear();
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
      this.excalidrawRef.updateScene({ collaborators });
    });
  }

  public setLastBroadcastedOrReceivedSceneVersion = (version: number) => {
    this.lastBroadcastedOrReceivedSceneVersion = version;
  };

  public getLastBroadcastedOrReceivedSceneVersion = () => {
    return this.lastBroadcastedOrReceivedSceneVersion;
  };

  public getSceneElementsIncludingDeleted = () => {
    return this.excalidrawRef.getSceneElementsIncludingDeleted();
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
      getSyncableElements(
        this.excalidrawRef.getSceneElementsIncludingDeleted(),
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
  };

  onCollabButtonClick = () => {
    this.setState({
      modalIsShown: true,
    });
  };

  getValue() {
    return {
      isCollaborating: this.state.isCollaborating,
      onPointerUpdate: this.onPointerUpdate,
      initializeSocketClient: this.initializeSocketClient,
      onChangeEmitter: this.onChangeEmitter,
      username: this.state.username,
      onCollabButtonClick: this.onCollabButtonClick,
      roomId: this.portal.roomID,
    };
  }

  render() {
    const { children } = (this.props as unknown) as {
      children: (context: any) => any;
    };
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
        {children(this.getValue())}
      </>
    );
  }
}

export default CollabWrapper;
