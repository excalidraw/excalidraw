import {
  encryptAESGEM,
  SocketUpdateData,
  SocketUpdateDataSource,
} from "../data";

import CollabWrapper from "./CollabWrapper";

import {
  getElementMap,
  getSyncableElements,
} from "../../packages/excalidraw/index";
import { ExcalidrawElement } from "../../element/types";
import { BROADCAST, SCENE } from "../app_constants";

class Portal {
  app: CollabWrapper;
  socket: SocketIOClient.Socket | null = null;
  socketInitialized: boolean = false; // we don't want the socket to emit any updates until it is fully initialized
  roomId: string | null = null;
  roomKey: string | null = null;
  broadcastedElementVersions: Map<string, number> = new Map();

  constructor(app: CollabWrapper) {
    this.app = app;
  }

  open(socket: SocketIOClient.Socket, id: string, key: string) {
    this.socket = socket;
    this.roomId = id;
    this.roomKey = key;

    // Initialize socket listeners (moving from App)
    this.socket.on("init-room", () => {
      if (this.socket) {
        this.socket.emit("join-room", this.roomId);
      }
    });
    this.socket.on("new-user", async (_socketId: string) => {
      this.broadcastScene(
        SCENE.INIT,
        getSyncableElements(this.app.getSceneElementsIncludingDeleted()),
        /* syncAll */ true,
      );
    });
    this.socket.on("room-user-change", (clients: string[]) => {
      this.app.setCollaborators(clients);
    });
  }

  close() {
    if (!this.socket) {
      return;
    }
    this.socket.close();
    this.socket = null;
    this.roomId = null;
    this.roomKey = null;
    this.socketInitialized = false;
    this.broadcastedElementVersions = new Map();
  }

  isOpen() {
    return !!(
      this.socketInitialized &&
      this.socket &&
      this.roomId &&
      this.roomKey
    );
  }

  async _broadcastSocketData(
    data: SocketUpdateData,
    volatile: boolean = false,
  ) {
    if (this.isOpen()) {
      const json = JSON.stringify(data);
      const encoded = new TextEncoder().encode(json);
      const encrypted = await encryptAESGEM(encoded, this.roomKey!);
      this.socket!.emit(
        volatile ? BROADCAST.SERVER_VOLATILE : BROADCAST.SERVER,
        this.roomId,
        encrypted.data,
        encrypted.iv,
      );
    }
  }

  broadcastScene = async (
    sceneType: SCENE.INIT | SCENE.UPDATE,
    syncableElements: ExcalidrawElement[],
    syncAll: boolean,
  ) => {
    if (sceneType === SCENE.INIT && !syncAll) {
      throw new Error("syncAll must be true when sending SCENE.INIT");
    }

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

    for (const syncableElement of syncableElements) {
      this.broadcastedElementVersions.set(
        syncableElement.id,
        syncableElement.version,
      );
    }

    const broadcastPromise = this._broadcastSocketData(
      data as SocketUpdateData,
    );

    if (syncAll && this.app.state.isCollaborating) {
      await Promise.all([
        broadcastPromise,
        this.app.saveCollabRoomToFirebase(syncableElements),
      ]);
    } else {
      await broadcastPromise;
    }
  };

  broadcastMouseLocation = (payload: {
    pointer: SocketUpdateDataSource["MOUSE_LOCATION"]["payload"]["pointer"];
    button: SocketUpdateDataSource["MOUSE_LOCATION"]["payload"]["button"];
  }) => {
    if (this.socket?.id) {
      const data: SocketUpdateDataSource["MOUSE_LOCATION"] = {
        type: "MOUSE_LOCATION",
        payload: {
          socketId: this.socket.id,
          pointer: payload.pointer,
          button: payload.button || "up",
          selectedElementIds:
            this.app.excalidrawAppState?.selectedElementIds || {},
          username: this.app.state.username,
        },
      };
      return this._broadcastSocketData(
        data as SocketUpdateData,
        true, // volatile
      );
    }
  };

  reconcileElements = (
    sceneElements: readonly ExcalidrawElement[],
  ): readonly ExcalidrawElement[] => {
    const currentElements = this.app.getSceneElementsIncludingDeleted();
    // create a map of ids so we don't have to iterate
    // over the array more than once.
    const localElementMap = getElementMap(currentElements);

    // Reconcile
    return (
      sceneElements
        .reduce((elements, element) => {
          // if the remote element references one that's currently
          // edited on local, skip it (it'll be added in the next step)
          if (
            element.id === this.app.excalidrawAppState?.editingElement?.id ||
            element.id === this.app.excalidrawAppState?.resizingElement?.id ||
            element.id === this.app.excalidrawAppState?.draggingElement?.id
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
            if (
              localElementMap[element.id].versionNonce < element.versionNonce
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
        }, [] as Mutable<typeof sceneElements>)
        // add local elements that weren't deleted or on remote
        .concat(...Object.values(localElementMap))
    );
  };
}

export default Portal;
