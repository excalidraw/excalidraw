/* eslint-disable no-console */
import throttle from "lodash.throttle";
import debounce from "lodash.debounce";
import { Utils } from "./utils";
import { StoreIncrement } from "../store";
import type { ExcalidrawImperativeAPI } from "../types";
import type { SceneElementsMap } from "../element/types";
import type {
  CLIENT_INCREMENT,
  PUSH_PAYLOAD,
  SERVER_INCREMENT,
} from "./protocol";

interface IncrementsRepository {
  loadIncrements(): Promise<{ increments: Array<StoreIncrement> } | null>;
  saveIncrements(params: { increments: Array<StoreIncrement> }): Promise<void>;
}

interface MetadataRepository {
  loadMetadata(): Promise<{ lastAcknowledgedVersion: number } | null>;
  saveMetadata(metadata: { lastAcknowledgedVersion: number }): Promise<void>;
}

// CFDO: make sure the increments are always acknowledged (deleted from the repository)
export class SyncQueue {
  private readonly queue: Map<string, StoreIncrement>;
  private readonly repository: IncrementsRepository;

  private constructor(
    queue: Map<string, StoreIncrement> = new Map(),
    repository: IncrementsRepository,
  ) {
    this.queue = queue;
    this.repository = repository;
  }

  public static async create(repository: IncrementsRepository) {
    const data = await repository.loadIncrements();

    return new SyncQueue(
      new Map(data?.increments?.map((increment) => [increment.id, increment])),
      repository,
    );
  }

  public getAll() {
    return Array.from(this.queue.values());
  }

  public get(id: StoreIncrement["id"]) {
    return this.queue.get(id);
  }

  public has(id: StoreIncrement["id"]) {
    return this.queue.has(id);
  }

  public add(...increments: StoreIncrement[]) {
    for (const increment of increments) {
      this.queue.set(increment.id, increment);
    }

    this.persist();
  }

  public remove(...ids: StoreIncrement["id"][]) {
    for (const id of ids) {
      this.queue.delete(id);
    }

    this.persist();
  }

  public persist = throttle(
    async () => {
      try {
        await this.repository.saveIncrements({ increments: this.getAll() });
      } catch (e) {
        console.error("Failed to persist the sync queue:", e);
      }
    },
    1000,
    { leading: false, trailing: true },
  );
}

export class SyncClient {
  private static readonly HOST_URL = import.meta.env.DEV
    ? "ws://localhost:8787"
    : "https://excalidraw-sync.marcel-529.workers.dev";

  private static readonly ROOM_ID = import.meta.env.DEV
    ? "test_room_x"
    : "test_room_prod";

  private static readonly RECONNECT_INTERVAL = 10_000;

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

  private server: WebSocket | null = null;
  private get isConnected() {
    return this.server?.readyState === WebSocket.OPEN;
  }

  private isConnecting: { done: (error?: Error) => void } | null = null;

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

  // CFDO: throttle does not work that well here (after some period it tries to reconnect too often)
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

        console.info("Reconnecting to the sync server...");

        const isConnecting = {
          done: () => {},
        };

        // ensure there won't be multiple reconnection attempts
        this.isConnecting = isConnecting;

        return await new Promise<void>((resolve, reject) => {
          this.server = new WebSocket(
            `${SyncClient.HOST_URL}/connect?roomId=${this.roomId}`,
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
    SyncClient.RECONNECT_INTERVAL,
    { leading: true },
  );

  public disconnect = throttle(
    (error?: Error) => {
      try {
        this.server?.removeEventListener("message", this.onMessage);
        this.server?.removeEventListener("close", this.onClose);
        this.server?.removeEventListener("error", this.onError);
        this.server?.removeEventListener("open", this.onOpen);
        this.server?.close();

        if (error) {
          this.isConnecting?.done(error);
        }
      } finally {
        this.isConnecting = null;
        this.server = null;
        this.reconnect();
      }
    },
    SyncClient.RECONNECT_INTERVAL,
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

    // CFDO: hack to pull everything for on init
    this.pull(0);
  };

  private onClose = (event: CloseEvent) => {
    console.log("close", event);
    this.disconnect(
      new Error(`Received "${event.type}" event on the sync connection`),
    );
  };

  private onError = (event: Event) => {
    console.log("error", event);
    this.disconnect(
      new Error(`Received "${event.type}" on the sync connection`),
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
  private debouncedPush = (ms: number = 1000) =>
    debounce(this.push, ms, { leading: true, trailing: false });

  private debouncedPull = (ms: number = 1000) =>
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
      this.debouncedPull().call(this);
      return;
    }

    this.debouncedPush().call(this);
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
    if (!this.isConnected) {
      throw new Error("Can't send a message without an active connection!");
    }

    this.server?.send(JSON.stringify(message));
  }
}
