/* eslint-disable no-console */
import { Utils } from "./utils";
import { ElementsChange } from "../change";
import type { ExcalidrawImperativeAPI } from "../types";
import type { SceneElementsMap } from "../element/types";
import type { CLIENT_CHANGE, PUSH_PAYLOAD, SERVER_CHANGE } from "./protocol";
import throttle from "lodash.throttle";

export class ExcalidrawSyncClient {
  // TODO: add prod url
  private static readonly HOST_URL = "ws://localhost:8787";
  private static readonly RECONNECT_INTERVAL = 10_000;

  private lastAcknowledgedVersion = 0;

  private readonly api: ExcalidrawImperativeAPI;
  private readonly roomId: string;
  private readonly queuedChanges: Map<string, CLIENT_CHANGE> = new Map();
  private get localChanges() {
    return Array.from(this.queuedChanges.values());
  }

  private server: WebSocket | null = null;
  private get isConnected() {
    return this.server?.readyState === WebSocket.OPEN;
  }

  private isConnecting: { done: (error?: Error) => void } | null = null;

  constructor(api: ExcalidrawImperativeAPI, roomId: string = "test_room_1") {
    this.api = api;
    this.roomId = roomId;

    // TODO: persist in idb
    this.lastAcknowledgedVersion = 0;
  }

  public reconnect = throttle(
    async () => {
      try {
        if (this.isConnected) {
          console.debug("Already connected to the sync server.");
          return;
        }

        if (this.isConnecting !== null) {
          console.debug("Already reconnecting to the sync server...");
          return;
        }

        console.trace("Reconnecting to the sync server...");

        const isConnecting = {
          done: () => {},
        };

        // ensure there won't be multiple reconnection attempts
        this.isConnecting = isConnecting;

        return await new Promise<void>((resolve, reject) => {
          this.server = new WebSocket(
            `${ExcalidrawSyncClient.HOST_URL}/connect?roomId=${this.roomId}`,
          );

          // wait for 10 seconds before timing out
          const timeoutId = setTimeout(() => {
            reject("Connecting the sync server timed out");
          }, 10_000);

          // resolved when opened, rejected on error
          isConnecting.done = (error?: Error) => {
            clearTimeout(timeoutId);

            if (error) {
              reject(error);
            } else {
              resolve();
            }
          };

          this.server.addEventListener("message", this.onMessage);
          this.server.addEventListener("close", this.onClose);
          this.server.addEventListener("error", this.onError);
          this.server.addEventListener("open", this.onOpen);
        });
      } catch (e) {
        console.error("Failed to connect to sync server:", e);
        this.disconnect(e as Error);
      }
    },
    ExcalidrawSyncClient.RECONNECT_INTERVAL,
    { leading: true },
  );

  public disconnect = throttle(
    (error?: Error) => {
      try {
        this.server?.removeEventListener("message", this.onMessage);
        this.server?.removeEventListener("close", this.onClose);
        this.server?.removeEventListener("error", this.onError);
        this.server?.removeEventListener("open", this.onOpen);

        if (error) {
          this.isConnecting?.done(error);
        }
      } finally {
        this.isConnecting = null;
        this.server = null;
        this.reconnect();
      }
    },
    ExcalidrawSyncClient.RECONNECT_INTERVAL,
    { leading: true },
  );

  private onOpen = async () => {
    if (!this.isConnected) {
      throw new Error(
        "Received open event, but the connection is still not ready.",
      );
    }

    if (!this.isConnecting) {
      throw new Error(
        "Can't resolve connection without `isConnecting` callback.",
      );
    }

    // resolve the current connection
    this.isConnecting.done();

    // initiate pull
    this.pull();
  };

  private onClose = () =>
    this.disconnect(
      new Error(`Received "closed" event on the sync connection`),
    );

  private onError = (event: Event) =>
    this.disconnect(
      new Error(`Received "${event.type}" on the sync connection`),
    );

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

  private pull = (): void => {
    this.send({
      type: "pull",
      payload: {
        lastAcknowledgedVersion: this.lastAcknowledgedVersion,
      },
    });
  };

  public push = (
    type: "durable" | "ephemeral" = "durable",
    changes: Array<CLIENT_CHANGE> = [],
  ): void => {
    const payload: PUSH_PAYLOAD = { type, changes: [] };

    if (type === "durable") {
      // TODO: persist in idb (with insertion order)
      for (const change of changes) {
        this.queuedChanges.set(change.id, change);
      }

      // batch all queued changes
      payload.changes = this.localChanges;
    } else {
      payload.changes = changes;
    }

    if (payload.changes.length > 0) {
      this.send({
        type: "push",
        payload,
      });
    }
  };

  public relay(buffer: ArrayBuffer): void {
    this.send({
      type: "relay",
      payload: { buffer },
    });
  }

  // TODO: refactor by applying all operations to store, not to the elements
  private handleAcknowledged(payload: { changes: Array<SERVER_CHANGE> }) {
    const { changes: remoteChanges } = payload;

    const oldAcknowledgedVersion = this.lastAcknowledgedVersion;
    let elements = new Map(
      this.api.getSceneElementsIncludingDeleted().map((el) => [el.id, el]),
    ) as SceneElementsMap;

    console.log("remote changes", remoteChanges);
    console.log("local changes", this.localChanges);

    try {
      // apply remote changes
      for (const remoteChange of remoteChanges) {
        if (this.queuedChanges.has(remoteChange.id)) {
          // local change acknowledge by the server, safe to remove
          this.queuedChanges.delete(remoteChange.id);
        } else {
          [elements] = ElementsChange.load(remoteChange.payload).applyTo(
            elements,
            this.api.store.snapshot.elements,
          );

          // TODO: we might not need to be that strict here
          if (this.lastAcknowledgedVersion + 1 !== remoteChange.version) {
            throw new Error(
              `Received out of order change, expected "${
                this.lastAcknowledgedVersion + 1
              }", but received "${remoteChange.version}"`,
            );
          }
        }

        this.lastAcknowledgedVersion = remoteChange.version;
      }

      // apply local changes
      // TODO: only necessary when remote changes modified same element properties!
      for (const localChange of this.localChanges) {
        [elements] = localChange.applyTo(
          elements,
          this.api.store.snapshot.elements,
        );
      }

      this.api.updateScene({
        elements: Array.from(elements.values()),
        storeAction: "update",
      });

      // push all queued changes
      this.push();
    } catch (e) {
      console.error("Failed to apply acknowledged changes:", e);
      // rollback the last acknowledged version
      this.lastAcknowledgedVersion = oldAcknowledgedVersion;
      // pull again to get the latest changes
      this.pull();
    }
  }

  private handleRejected(payload: { ids: Array<string>; message: string }) {
    // handle rejected changes
    console.error("Rejected message received:", payload);
  }

  private handleRelayed(payload: { changes: Array<CLIENT_CHANGE> }) {
    // apply relayed changes / buffer
    console.log("Relayed message received:", payload);
  }

  private send(message: { type: string; payload: any }): void {
    if (!this.isConnected) {
      console.error("Can't send a message without an active connection!");
      return;
    }

    this.server?.send(JSON.stringify(message));
  }
}
