/* eslint-disable no-console */
import throttle from "lodash.throttle";
import ReconnectingWebSocket, {
  type Event,
  type CloseEvent,
} from "reconnecting-websocket";
import { Utils } from "./utils";
import {
  SyncQueue,
  type MetadataRepository,
  type IncrementsRepository,
} from "./queue";
import { StoreIncrement } from "../store";
import type { ExcalidrawImperativeAPI } from "../types";
import type { SceneElementsMap } from "../element/types";
import type {
  CLIENT_INCREMENT,
  CLIENT_MESSAGE_RAW,
  SERVER_INCREMENT,
} from "./protocol";
import { debounce } from "../utils";
import { randomId } from "../random";

class SocketMessage implements CLIENT_MESSAGE_RAW {
  constructor(
    public readonly type: "relay" | "pull" | "push",
    public readonly payload: string,
    public readonly chunkInfo?: {
      id: string;
      position: number;
      count: number;
    },
  ) {}
}

class SocketClient {
  // Max size for outgoing messages is 1MiB (due to CFDO limits),
  // thus working with a slighter smaller limit of 800 kB (leaving 224kB for metadata)
  private static readonly MAX_MESSAGE_SIZE = 800_000;

  private static readonly NORMAL_CLOSURE_CODE = 1000;
  // Chrome throws "Uncaught InvalidAccessError" with message:
  //   "The close code must be either 1000, or between 3000 and 4999. 1009 is neither."
  // therefore using custom codes instead.
  private static readonly MESSAGE_IS_TOO_LARGE_ERROR_CODE = 3009;

  private isOffline = true;
  private socket: ReconnectingWebSocket | null = null;

  private get isDisconnected() {
    return !this.socket;
  }

  constructor(
    private readonly host: string,
    private readonly roomId: String,
    private readonly handlers: {
      onOpen: (event: Event) => void;
      onOnline: () => void;
      onMessage: (event: MessageEvent) => void;
    },
  ) {}

  private onOnline = () => {
    this.isOffline = false;
    this.handlers.onOnline();
  };

  private onOffline = () => {
    this.isOffline = true;
  };

  public connect = throttle(
    () => {
      if (!this.isDisconnected && !this.isOffline) {
        return;
      }

      window.addEventListener("online", this.onOnline);
      window.addEventListener("offline", this.onOffline);

      console.debug(`Connecting to the room "${this.roomId}"...`);
      this.socket = new ReconnectingWebSocket(
        `${this.host}/connect?roomId=${this.roomId}`,
        [],
        {
          WebSocket: undefined, // WebSocket constructor, if none provided, defaults to global WebSocket
          maxReconnectionDelay: 10000, // max delay in ms between reconnections
          minReconnectionDelay: 1000, // min delay in ms between reconnections
          reconnectionDelayGrowFactor: 1.3, // how fast the reconnection delay grows
          minUptime: 5000, // min time in ms to consider connection as stable
          connectionTimeout: 4000, // retry connect if not connected after this time, in ms
          maxRetries: Infinity, // maximum number of retries
          maxEnqueuedMessages: 0, // maximum number of messages to buffer until reconnection
          startClosed: false, // start websocket in CLOSED state, call `.reconnect()` to connect
          debug: false, // enables debug output,
        },
      );
      this.socket.addEventListener("message", this.onMessage);
      this.socket.addEventListener("open", this.onOpen);
      this.socket.addEventListener("close", this.onClose);
      this.socket.addEventListener("error", this.onError);
    },
    1000,
    { leading: true, trailing: false },
  );

  // CFDO: the connections seem to keep hanging for some reason
  public disconnect() {
    if (this.isDisconnected) {
      return;
    }

    try {
      window.removeEventListener("online", this.onOnline);
      window.removeEventListener("offline", this.onOffline);

      this.socket?.removeEventListener("message", this.onMessage);
      this.socket?.removeEventListener("open", this.onOpen);
      this.socket?.removeEventListener("close", this.onClose);
      this.socket?.removeEventListener("error", this.onError);
      this.socket?.close();

      console.debug(`Disconnected from the room "${this.roomId}".`);
    } finally {
      this.socket = null;
    }
  }

  public send(message: {
    type: "relay" | "pull" | "push";
    payload: any;
  }): void {
    if (this.isOffline) {
      // connection opened, don't let the WS buffer the messages,
      // as we do explicitly buffer unacknowledged increments
      return;
    }

    // CFDO: could be closed / closing / connecting
    if (this.isDisconnected) {
      this.connect();
      return;
    }

    const { type, payload } = message;

    const stringifiedPayload = JSON.stringify(payload);
    const payloadSize = new TextEncoder().encode(stringifiedPayload).byteLength;

    if (payloadSize < SocketClient.MAX_MESSAGE_SIZE) {
      const message = new SocketMessage(type, stringifiedPayload);
      return this.socket?.send(JSON.stringify(message));
    }

    const chunkId = randomId();
    const chunkSize = SocketClient.MAX_MESSAGE_SIZE;
    const chunksCount = Math.ceil(payloadSize / chunkSize);

    for (let position = 0; position < chunksCount; position++) {
      const start = position * chunkSize;
      const end = start + chunkSize;
      const chunkedPayload = stringifiedPayload.slice(start, end);
      const message = new SocketMessage(type, chunkedPayload, {
        id: chunkId,
        position,
        count: chunksCount,
      });

      this.socket?.send(JSON.stringify(message));
    }
  }

  private onMessage = (event: MessageEvent) => {
    this.handlers.onMessage(event);
  };

  private onOpen = (event: Event) => {
    console.debug(`Connection to the room "${this.roomId}" opened.`);
    this.isOffline = false;
    this.handlers.onOpen(event);
  };

  private onClose = (event: CloseEvent) => {
    console.debug(`Connection to the room "${this.roomId}" closed.`, event);
  };

  private onError = (event: Event) => {
    console.debug(
      `Connection to the room "${this.roomId}" returned an error.`,
      event,
    );
  };
}

interface AcknowledgedIncrement {
  increment: StoreIncrement;
  version: number;
}

export class SyncClient {
  private static readonly HOST_URL = import.meta.env.DEV
    ? "ws://localhost:8787"
    : "https://excalidraw-sync.marcel-529.workers.dev";

  private static readonly ROOM_ID = import.meta.env.DEV
    ? "test_room_x"
    : "test_room_prod";

  private readonly api: ExcalidrawImperativeAPI;
  private readonly queue: SyncQueue;
  private readonly metadata: MetadataRepository;
  private readonly client: SocketClient;

  // #region ACKNOWLEDGED INCREMENTS & METADATA
  // CFDO: shouldn't be stateful, only request / response
  private readonly acknowledgedIncrementsMap: Map<
    string,
    AcknowledgedIncrement
  > = new Map();

  public get acknowledgedIncrements() {
    return Array.from(this.acknowledgedIncrementsMap.values())
      .sort((a, b) => (a.version < b.version ? -1 : 1))
      .map((x) => x.increment);
  }

  private _lastAcknowledgedVersion = 0;

  private get lastAcknowledgedVersion() {
    return this._lastAcknowledgedVersion;
  }

  private set lastAcknowledgedVersion(version: number) {
    this._lastAcknowledgedVersion = version;
    this.metadata.saveMetadata({ lastAcknowledgedVersion: version });
  }
  // #endregion

  private constructor(
    api: ExcalidrawImperativeAPI,
    repository: MetadataRepository,
    queue: SyncQueue,
    options: { host: string; roomId: string; lastAcknowledgedVersion: number },
  ) {
    this.api = api;
    this.metadata = repository;
    this.queue = queue;
    this.lastAcknowledgedVersion = options.lastAcknowledgedVersion;
    this.client = new SocketClient(options.host, options.roomId, {
      onOpen: this.onOpen,
      onOnline: this.onOnline,
      onMessage: this.onMessage,
    });
  }

  // #region SYNC_CLIENT FACTORY
  public static async create(
    api: ExcalidrawImperativeAPI,
    repository: IncrementsRepository & MetadataRepository,
  ) {
    const queue = await SyncQueue.create(repository);
    // CFDO: temporary for custom roomId (though E+ will be similar)
    const roomId = window.location.pathname.split("/").at(-1);

    return new SyncClient(api, repository, queue, {
      host: SyncClient.HOST_URL,
      roomId: roomId ?? SyncClient.ROOM_ID,
      // CFDO: temporary, so that all increments are loaded and applied on init
      lastAcknowledgedVersion: 0,
    });
  }
  // #endregion

  // #region PUBLIC API METHODS
  public connect() {
    return this.client.connect();
  }

  public disconnect() {
    return this.client.disconnect();
  }

  public pull(sinceVersion?: number): void {
    this.client.send({
      type: "pull",
      payload: {
        lastAcknowledgedVersion: sinceVersion ?? this.lastAcknowledgedVersion,
      },
    });
  }

  public push(increment?: StoreIncrement): void {
    if (increment) {
      this.queue.add(increment);
    }

    // re-send all already queued increments
    for (const queuedIncrement of this.queue.getAll()) {
      this.client.send({
        type: "push",
        payload: {
          ...queuedIncrement,
        },
      });
    }
  }

  public relay(buffer: ArrayBuffer): void {
    this.client.send({
      type: "relay",
      payload: { buffer },
    });
  }
  // #endregion

  // #region PRIVATE SOCKET MESSAGE HANDLERS
  private onOpen = (event: Event) => {
    // CFDO: hack to pull everything for on init
    this.pull(0);
    this.push();
  };

  private onOnline = () => {
    // perform incremental sync
    this.pull();
    this.push();
  };

  private onMessage = (event: MessageEvent) => {
    // CFDO: could be an array buffer
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

  // CFDO: refactor by applying all operations to store, not to the elements
  private handleAcknowledged = (payload: {
    increments: Array<SERVER_INCREMENT>;
  }) => {
    let nextAcknowledgedVersion = this.lastAcknowledgedVersion;
    let elements = new Map(
      // CFDO: retrieve the map already
      this.api.getSceneElementsIncludingDeleted().map((el) => [el.id, el]),
    ) as SceneElementsMap;

    try {
      const { increments: remoteIncrements } = payload;

      // apply remote increments
      for (const { id, version, payload } of remoteIncrements) {
        // CFDO: temporary to load all increments on init
        this.acknowledgedIncrementsMap.set(id, {
          increment: StoreIncrement.load(payload),
          version,
        });

        // we've already applied this increment
        if (version <= nextAcknowledgedVersion) {
          continue;
        }

        if (version === nextAcknowledgedVersion + 1) {
          nextAcknowledgedVersion = version;
        } else {
          // it's fine to apply increments our of order,
          // as they are idempontent, so that we can re-apply them again,
          // as long as we don't mark their version as acknowledged
          console.debug(
            `Received out of order increment, expected "${
              nextAcknowledgedVersion + 1
            }", but received "${version}"`,
          );
        }

        // local increment shall not have to be applied again
        if (this.queue.has(id)) {
          this.queue.remove(id);
        } else {
          // apply remote increment with higher version than the last acknowledged one
          const remoteIncrement = StoreIncrement.load(payload);
          [elements] = remoteIncrement.elementsChange.applyTo(
            elements,
            this.api.store.snapshot.elements,
          );
        }

        // apply local increments
        for (const localIncrement of this.queue.getAll()) {
          // CFDO: in theory only necessary when remote increments modified same element properties!
          [elements] = localIncrement.elementsChange.applyTo(
            elements,
            this.api.store.snapshot.elements,
          );
        }

        this.api.updateScene({
          elements: Array.from(elements.values()),
          storeAction: "update",
        });
      }

      this.lastAcknowledgedVersion = nextAcknowledgedVersion;
    } catch (e) {
      console.error("Failed to apply acknowledged increments:", e);
      // CFDO: might just be on error
      this.schedulePull();
    }
  };

  private handleRejected = (payload: {
    ids: Array<string>;
    message: string;
  }) => {
    // handle rejected increments
    console.error("Rejected message received:", payload);
  };

  private handleRelayed = (payload: {
    increments: Array<CLIENT_INCREMENT>;
  }) => {
    // apply relayed increments / buffer
    console.log("Relayed message received:", payload);
  };

  private schedulePull = debounce(() => this.pull(), 1000);
  // #endregion
}
