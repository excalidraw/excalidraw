import { encryptAESGEM, SocketUpdateDataSource } from "../data";

import { SocketUpdateData } from "../types";
import { BROADCAST, SCENE } from "../constants";
import App from "./App";
import { getSceneVersion, getSyncableElements } from "../element";

class Portal {
  app: App;
  socket: SocketIOClient.Socket | null = null;
  socketInitialized: boolean = false; // we don't want the socket to emit any updates until it is fully initialized
  roomID: string | null = null;
  roomKey: string | null = null;
  broadcastedElementVersions: Map<string, number> = new Map();

  constructor(app: App) {
    this.app = app;
  }

  open(socket: SocketIOClient.Socket, id: string, key: string) {
    this.socket = socket;
    this.roomID = id;
    this.roomKey = key;

    // Initialize socket listeners (moving from App)
    this.socket.on("init-room", () => {
      if (this.socket) {
        this.socket.emit("join-room", this.roomID);
      }
    });
    this.socket.on("new-user", async (_socketId: string) => {
      this.broadcastScene(SCENE.INIT, /* syncAll */ true);
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
    this.roomID = null;
    this.roomKey = null;
  }

  isOpen() {
    return !!(
      this.socketInitialized &&
      this.socket &&
      this.roomID &&
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
        this.roomID,
        encrypted.data,
        encrypted.iv,
      );
    }
  }

  broadcastScene = async (
    sceneType: SCENE.INIT | SCENE.UPDATE,
    syncAll: boolean,
  ) => {
    if (sceneType === SCENE.INIT && !syncAll) {
      throw new Error("syncAll must be true when sending SCENE.INIT");
    }

    let syncableElements = getSyncableElements(
      this.app.getSceneElementsIncludingDeleted(),
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
    const currentVersion = this.app.getLastBroadcastedOrReceivedSceneVersion();
    const newVersion = Math.max(
      currentVersion,
      getSceneVersion(this.app.getSceneElementsIncludingDeleted()),
    );
    this.app.setLastBroadcastedOrReceivedSceneVersion(newVersion);

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
          selectedElementIds: this.app.state.selectedElementIds,
          username: this.app.state.username,
        },
      };
      return this._broadcastSocketData(
        data as SocketUpdateData,
        true, // volatile
      );
    }
  };
}

export default Portal;
