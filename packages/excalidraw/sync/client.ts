import { Utils } from "./utils";
import type { CLIENT_CHANGE, SERVER_CHANGE } from "./protocol";

class ExcalidrawSyncClient {
  // TODO: add prod url
  private static readonly HOST_URL = "ws://localhost:8787";

  private roomId: string;
  private lastAcknowledgedVersion: number;

  private server: WebSocket | null = null;

  constructor(roomId: string = "test_room_1") {
    this.roomId = roomId;

    // TODO: persist in idb
    this.lastAcknowledgedVersion = 0;
  }

  public connect() {
    this.server = new WebSocket(
      `${ExcalidrawSyncClient.HOST_URL}/connect?roomId=${this.roomId}`,
    );

    this.server.addEventListener("open", this.onOpen);
    this.server.addEventListener("message", this.onMessage);
    this.server.addEventListener("close", this.onClose);
    this.server.addEventListener("error", this.onError);
  }

  public disconnect() {
    if (this.server) {
      this.server.removeEventListener("open", this.onOpen);
      this.server.removeEventListener("message", this.onMessage);
      this.server.removeEventListener("close", this.onClose);
      this.server.removeEventListener("error", this.onError);
      this.server.close();
    }
  }

  private onOpen = () => this.sync();

  // TODO: could be an array buffer
  private onMessage = (event: MessageEvent) => {
    const [result, error] = Utils.try(() => JSON.parse(event.data as string));

    if (error) {
      console.error("Failed to parse message:", event.data);
      return;
    }

    const { type, payload } = result;
    switch (type) {
      case "relayed":
        return this.handleRelayed(payload);
      case "acknowledged":
        return this.handleAcknowledged(payload);
      case "rejected":
        return this.handleRejected(payload);
      default:
        console.error("Unknown message type:", type);
    }
  };

  private onClose = () => this.disconnect();
  private onError = (error: Event) => console.error("WebSocket error:", error);

  public sync() {
    const remoteChanges = this.send({
      type: "pull",
      payload: { lastAcknowledgedVersion: this.lastAcknowledgedVersion },
    });
    // TODO: apply remote changes
    // const localChanges: Array<CLIENT_CHANGE> = [];
    // // TODO: apply local changes (unacknowledged)
    // this.push(localChanges, 'durable');
  }

  public pull() {
    return this.send({
      type: "pull",
      payload: { lastAcknowledgedVersion: this.lastAcknowledgedVersion },
    });
  }

  public push(changes: Array<CLIENT_CHANGE>, type: "durable" | "ephemeral") {
    return this.send({
      type: "push",
      payload: { type, changes },
    });
  }

  public relay(buffer: ArrayBuffer) {
    return this.send({
      type: "relay",
      payload: { buffer },
    });
  }

  private handleMessage(message: string) {
    const [result, error] = Utils.try(() => JSON.parse(message));

    if (error) {
      console.error("Failed to parse message:", message);
      return;
    }

    const { type, payload } = result;
    switch (type) {
      case "relayed":
        return this.handleRelayed(payload);
      case "acknowledged":
        return this.handleAcknowledged(payload);
      case "rejected":
        return this.handleRejected(payload);
      default:
        console.error("Unknown message type:", type);
    }
  }

  private handleRelayed(payload: { changes: Array<CLIENT_CHANGE> }) {
    console.log("Relayed message received:", payload);
    // Process relayed changes
  }

  private handleAcknowledged(payload: { changes: Array<SERVER_CHANGE> }) {
    console.log("Acknowledged message received:", payload);
    // Handle acknowledged changes
  }

  private handleRejected(payload: { ids: Array<string>; message: string }) {
    console.error("Rejected message received:", payload);
    // Handle rejected changes
  }

  private send(message: { type: string; payload: any }) {
    if (this.server && this.server.readyState === WebSocket.OPEN) {
      this.server.send(JSON.stringify(message));
    } else {
      console.error("WebSocket is not open. Unable to send message.");
    }
  }
}
