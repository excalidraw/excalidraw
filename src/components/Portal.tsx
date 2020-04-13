import { encryptAESGEM } from "../data";

import { SocketUpdateData } from "../types";
import { BROADCAST } from "../constants";

class Portal {
  socket: SocketIOClient.Socket | null = null;
  socketInitialized: boolean = false; // we don't want the socket to emit any updates until it is fully initialized
  roomID: string | null = null;
  roomKey: string | null = null;

  open(socket: SocketIOClient.Socket, id: string, key: string) {
    this.socket = socket;
    this.roomID = id;
    this.roomKey = key;
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
