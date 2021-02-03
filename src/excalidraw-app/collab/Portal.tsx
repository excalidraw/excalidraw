import {
  encryptAESGEM,
  SocketUpdateData,
  SocketUpdateDataSource,
} from "../data";

import CollabWrapper from "./CollabWrapper";

import { getSyncableElements } from "../../packages/excalidraw/index";
import { ExcalidrawElement } from "../../element/types";
import { BROADCAST, SCENE } from "../app_constants";
import { UserIdleState } from "./types";

class Portal {
  collab: CollabWrapper;
  socket: SocketIOClient.Socket | null = null;
  socketInitialized: boolean = false; // we don't want the socket to emit any updates until it is fully initialized
  roomId: string | null = null;
  roomKey: string | null = null;
  broadcastedElementVersions: Map<string, number> = new Map();

  constructor(collab: CollabWrapper) {
    this.collab = collab;
  }

  open(socket: SocketIOClient.Socket, id: string, key: string) {
    this.socket = socket;
    this.roomId = id;
    this.roomKey = key;

    // Initialize socket listeners
    this.socket.on("init-room", () => {
      if (this.socket) {
        this.socket.emit("join-room", this.roomId);
      }
    });
    this.socket.on("new-user", async (_socketId: string) => {
      this.broadcastScene(
        SCENE.INIT,
        getSyncableElements(this.collab.getSceneElementsIncludingDeleted()),
        /* syncAll */ true,
      );
    });
    this.socket.on("room-user-change", (clients: string[]) => {
      this.collab.setCollaborators(clients);
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

    if (syncAll && this.collab.isCollaborating) {
      await Promise.all([
        broadcastPromise,
        this.collab.saveCollabRoomToFirebase(syncableElements),
      ]);
    } else {
      await broadcastPromise;
    }
  };

  broadcastIdleChange = (userState: UserIdleState) => {
    if (this.socket?.id) {
      const data: SocketUpdateDataSource["IDLE_STATUS"] = {
        type: "IDLE_STATUS",
        payload: {
          socketId: this.socket.id,
          userState,
          username: this.collab.state.username,
        },
      };
      return this._broadcastSocketData(
        data as SocketUpdateData,
        true, // volatile
      );
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
          selectedElementIds: this.collab.excalidrawAPI.getAppState()
            .selectedElementIds,
          username: this.collab.state.username,
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
