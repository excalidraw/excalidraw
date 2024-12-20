/* eslint-disable no-console */
import debounce from "lodash.debounce";
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
  PUSH_PAYLOAD,
  SERVER_INCREMENT,
} from "./protocol";

const NO_STATUS_RECEIVED_ERROR_CODE = 1005;
const ABNORMAL_CLOSURE_ERROR_CODE = 1006;

export class SyncClient {
  private static readonly HOST_URL = import.meta.env.DEV
    ? "ws://localhost:8787"
    : "https://excalidraw-sync.marcel-529.workers.dev";

  private static readonly ROOM_ID = import.meta.env.DEV
    ? "test_room_x"
    : "test_room_prod";

  private server: ReconnectingWebSocket | null = null;
  private readonly api: ExcalidrawImperativeAPI;
  private readonly queue: SyncQueue;
  private readonly repository: MetadataRepository;

  // CFDO: shouldn't be stateful, only request / response
  private readonly acknowledgedIncrementsMap: Map<string, StoreIncrement> =
    new Map();

  public get acknowledgedIncrements() {
    return Array.from(this.acknowledgedIncrementsMap.values());
  }

  private readonly roomId: string;

  private _lastAcknowledgedVersion = 0;

  private get lastAcknowledgedVersion() {
    return this._lastAcknowledgedVersion;
  }

  private set lastAcknowledgedVersion(version: number) {
    this._lastAcknowledgedVersion = version;
    this.repository.saveMetadata({ lastAcknowledgedVersion: version });
  }

  private constructor(
    api: ExcalidrawImperativeAPI,
    repository: MetadataRepository,
    queue: SyncQueue,
    options: { roomId: string; lastAcknowledgedVersion: number },
  ) {
    this.api = api;
    this.repository = repository;
    this.queue = queue;
    this.roomId = options.roomId;
    this.lastAcknowledgedVersion = options.lastAcknowledgedVersion;
  }

  public static async create(
    api: ExcalidrawImperativeAPI,
    repository: IncrementsRepository & MetadataRepository,
    roomId: string = SyncClient.ROOM_ID,
  ) {
    const [queue, metadata] = await Promise.all([
      SyncQueue.create(repository),
      repository.loadMetadata(),
    ]);

    return new SyncClient(api, repository, queue, {
      roomId,
      lastAcknowledgedVersion: metadata?.lastAcknowledgedVersion ?? 0,
    });
  }

  // CFDO I: throttle does not work that well here (after some period it tries to reconnect too often)
  public connect = throttle(
    () => {
      if (this.server && this.server.readyState !== this.server.CLOSED) {
        return;
      }

      console.log("Connecting to the sync server...");
      this.server = new ReconnectingWebSocket(
        `${SyncClient.HOST_URL}/connect?roomId=${this.roomId}`,
        [],
        {
          WebSocket: undefined, // WebSocket constructor, if none provided, defaults to global WebSocket
          maxReconnectionDelay: 10000, // max delay in ms between reconnections
          minReconnectionDelay: 1000, // min delay in ms between reconnections
          reconnectionDelayGrowFactor: 1.3, // how fast the reconnection delay grows
          minUptime: 5000, // min time in ms to consider connection as stable
          connectionTimeout: 4000, // retry connect if not connected after this time, in ms
          maxRetries: Infinity, // maximum number of retries
          maxEnqueuedMessages: Infinity, // maximum number of messages to buffer until reconnection
          startClosed: false, // start websocket in CLOSED state, call `.reconnect()` to connect
          debug: false, // enables debug output,
        },
      );
      this.server.addEventListener("message", this.onMessage);
      this.server.addEventListener("open", this.onOpen);
      this.server.addEventListener("close", this.onClose);
      this.server.addEventListener("error", this.onError);
    },
    1000,
    { leading: true, trailing: false },
  );

  public disconnect = throttle(
    (code?: number, reason?: string) => {
      if (!this.server) {
        return;
      }

      if (
        this.server.readyState === this.server.CLOSED ||
        this.server.readyState === this.server.CLOSING
      ) {
        return;
      }

      console.log(
        `Disconnecting from the sync server with code "${code}" and reason "${reason}"...`,
      );
      this.server.removeEventListener("message", this.onMessage);
      this.server.removeEventListener("open", this.onOpen);
      this.server.removeEventListener("close", this.onClose);
      this.server.removeEventListener("error", this.onError);
      this.server.close(code, reason);
    },
    1000,
    { leading: true, trailing: false },
  );

  private onOpen = (event: Event) => {
    // CFDO: hack to pull everything for on init
    this.pull(0);
  };

  private onClose = (event: CloseEvent) => {
    this.disconnect(
      event.code || NO_STATUS_RECEIVED_ERROR_CODE,
      event.reason || "Connection closed without a reason",
    );
  };

  private onError = (event: Event) => {
    this.disconnect(
      event.type === "error"
        ? ABNORMAL_CLOSURE_ERROR_CODE
        : NO_STATUS_RECEIVED_ERROR_CODE,
      `Received "${event.type}" on the sync connection`,
    );
  };

  // CFDO: could be an array buffer
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

  private pull(sinceVersion?: number): void {
    this.send({
      type: "pull",
      payload: {
        lastAcknowledgedVersion: sinceVersion ?? this.lastAcknowledgedVersion,
      },
    });
  }

  public push(
    type: "durable" | "ephemeral" = "durable",
    ...increments: Array<CLIENT_INCREMENT>
  ): void {
    const payload: PUSH_PAYLOAD = { type, increments: [] };

    if (type === "durable") {
      this.queue.add(...increments);
      // batch all (already) queued increments
      payload.increments = this.queue.getAll();
    } else {
      payload.increments = increments;
    }

    if (payload.increments.length > 0) {
      this.send({
        type: "push",
        payload,
      });
    }
  }

  public relay(buffer: ArrayBuffer): void {
    this.send({
      type: "relay",
      payload: { buffer },
    });
  }

  // CFDO: should be flushed once regular push / pull goes through
  private schedulePush = (ms: number = 1000) =>
    debounce(this.push, ms, { leading: true, trailing: false });

  private schedulePull = (ms: number = 1000) =>
    debounce(this.pull, ms, { leading: true, trailing: false });

  // CFDO: refactor by applying all operations to store, not to the elements
  private handleAcknowledged(payload: { increments: Array<SERVER_INCREMENT> }) {
    let nextAcknowledgedVersion = this.lastAcknowledgedVersion;
    let elements = new Map(
      // CFDO: retrieve the map already
      this.api.getSceneElementsIncludingDeleted().map((el) => [el.id, el]),
    ) as SceneElementsMap;

    try {
      const { increments: remoteIncrements } = payload;

      // apply remote increments
      for (const { id, version, payload } of remoteIncrements.sort((a, b) =>
        a.version <= b.version ? -1 : 1,
      )) {
        // CFDO: temporary to load all increments on init
        this.acknowledgedIncrementsMap.set(id, StoreIncrement.load(payload));

        // local increment shall not have to be applied again
        if (this.queue.has(id)) {
          this.queue.remove(id);
          continue;
        }

        // we've already applied this increment
        if (version <= nextAcknowledgedVersion) {
          continue;
        }

        if (version === nextAcknowledgedVersion + 1) {
          nextAcknowledgedVersion = version;
        } else {
          // it's fine to apply increments our of order,
          // as they are idempontent, so that we can re-apply them again,
          // as long as we don't mark them as acknowledged
          console.debug(
            `Received out of order increment, expected "${
              nextAcknowledgedVersion + 1
            }", but received "${version}"`,
          );
        }

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

      this.lastAcknowledgedVersion = nextAcknowledgedVersion;
    } catch (e) {
      console.error("Failed to apply acknowledged increments:", e);
      this.schedulePull().call(this);
      return;
    }

    this.schedulePush().call(this);
  }

  private handleRejected(payload: { ids: Array<string>; message: string }) {
    // handle rejected increments
    console.error("Rejected message received:", payload);
  }

  private handleRelayed(payload: { increments: Array<CLIENT_INCREMENT> }) {
    // apply relayed increments / buffer
    console.log("Relayed message received:", payload);
  }

  private send(message: { type: string; payload: any }): void {
    if (!this.server) {
      throw new Error(
        "Can't send a message without an established connection!",
      );
    }

    this.server.send(JSON.stringify(message));
  }
}
