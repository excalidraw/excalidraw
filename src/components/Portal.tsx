import { encryptAESGEM } from "../data";

import { SocketUpdateData } from "../types";
import { BROADCAST, SCENE } from "../constants";
import App from "./App";

class Portal {
  app: App;
  socket: SocketIOClient.Socket | null = null;
  socketInitialized: boolean = false; // we don't want the socket to emit any updates until it is fully initialized
  roomID: string | null = null;
  roomKey: string | null = null;

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

        this.app.restoreUserName();
      }
    });
    this.socket.on("new-user", async (_socketID: string) => {
      this.app.broadcastScene(SCENE.INIT, /* syncAll */ true);
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
}
export default Portal;
