import AsyncLock from "async-lock";
import { Network, Utils } from "./utils";

import type {
  DeltasRepository,
  PULL_PAYLOAD,
  PUSH_PAYLOAD,
  SERVER_MESSAGE,
  SERVER_DELTA,
  CHUNK_INFO,
  RELAY_PAYLOAD,
  CLIENT_MESSAGE_BINARY,
  CLIENT_MESSAGE,
  ExcalidrawElement,
} from "./protocol";
import { StoreDelta } from "../store";

/**
 * Core excalidraw sync logic.
 */
export class ExcalidrawSyncServer {
  private readonly lock: AsyncLock = new AsyncLock();
  private readonly sessions: Set<WebSocket> = new Set();
  private readonly chunks = new Map<
    CHUNK_INFO["id"],
    Map<CHUNK_INFO["position"], CLIENT_MESSAGE_BINARY["payload"]>
  >();

  // CFDO II: load from the db
  private elements = new Map<string, ExcalidrawElement>();

  constructor(private readonly repository: DeltasRepository) {
    // CFDO II: load from the db
    const deltas = this.repository.getAllSinceVersion(0);

    for (const delta of deltas) {
      const storeDelta = StoreDelta.load(delta.payload);

      // CFDO II: fix types (everywhere)
      const [nextElements] = storeDelta.elements.applyTo(this.elements as any);

      this.elements = nextElements;
    }
  }

  // CFDO: optimize, should send a message about collaborators (no collaborators => no need to send ephemerals)
  public onConnect(client: WebSocket) {
    this.sessions.add(client);
  }

  public onDisconnect(client: WebSocket) {
    this.sessions.delete(client);
  }

  public onMessage(
    client: WebSocket,
    message: ArrayBuffer,
  ): Promise<void> | void {
    const [rawMessage, parsingError] = Utils.try<CLIENT_MESSAGE_BINARY>(() =>
      Network.decodeClientMessage(message),
    );

    if (parsingError) {
      console.error(parsingError);
      return;
    }

    // if there is chunkInfo, there are more than 1 chunks => process them first
    if (rawMessage.chunkInfo) {
      return this.processChunks(client, {
        ...rawMessage,
        chunkInfo: rawMessage.chunkInfo,
      });
    }

    return this.processMessage(client, rawMessage);
  }

  /**
   * Process chunks in case the client-side payload would overflow the 1MiB durable object WS message limit.
   */
  private processChunks(
    client: WebSocket,
    message: CLIENT_MESSAGE_BINARY &
      Required<Pick<CLIENT_MESSAGE_BINARY, "chunkInfo">>,
  ) {
    let shouldCleanupchunks = true;
    const {
      type,
      payload,
      chunkInfo: { id, position, count },
    } = message;

    try {
      if (!this.chunks.has(id)) {
        this.chunks.set(id, new Map());
      }

      const chunks = this.chunks.get(id);

      if (!chunks) {
        // defensive, shouldn't really happen
        throw new Error(`Coudn't find a relevant chunk with id "${id}"!`);
      }

      // set the buffer by order
      chunks.set(position, payload);

      if (chunks.size !== count) {
        // we don't have all the chunks, don't cleanup just yet!
        shouldCleanupchunks = false;
        return;
      }

      // hopefully we can fit into the 128 MiB memory limit
      const restoredPayload = Array.from(chunks)
        .sort(([positionA], [positionB]) => (positionA <= positionB ? -1 : 1))
        .reduce(
          (acc, [_, payload]) => Uint8Array.from([...acc, ...payload]),
          new Uint8Array(),
        );

      const rawMessage = {
        type,
        payload: restoredPayload,
      } as Omit<CLIENT_MESSAGE_BINARY, "chunkInfo">;

      return this.processMessage(client, rawMessage);
    } catch (error) {
      console.error(`Error while processing chunk "${id}"`, error);
    } finally {
      // cleanup the chunks
      if (shouldCleanupchunks) {
        this.chunks.delete(id);
      }
    }
  }

  private processMessage(
    client: WebSocket,
    { type, payload }: Omit<CLIENT_MESSAGE_BINARY, "chunkInfo">,
  ) {
    const [parsedPayload, parsingError] = Utils.try<CLIENT_MESSAGE["payload"]>(
      () => Network.fromBinary(payload),
    );

    if (parsingError) {
      console.error(parsingError);
      return;
    }

    switch (type) {
      case "restore":
        return this.restore(client);
      case "relay":
        return this.relay(client, parsedPayload as RELAY_PAYLOAD);
      case "pull":
        return this.pull(client, parsedPayload as PULL_PAYLOAD);
      case "push":
        // apply each one-by-one to avoid race conditions
        // CFDO: in theory we do not need to block ephemeral appState (for now we are not even using them)
        return this.lock.acquire("push", () =>
          this.push(client, parsedPayload as PUSH_PAYLOAD),
        );
      default:
        console.error(`Unknown message type: ${type}`);
    }
  }

  private restore(client: WebSocket) {
    return this.send(client, {
      type: "restored",
      payload: {
        elements: Array.from(this.elements.values()),
      },
    });
  }

  private relay(client: WebSocket, payload: RELAY_PAYLOAD) {
    // CFDO I: we should likely apply these to the snapshot
    return this.broadcast(
      {
        type: "relayed",
        payload,
      },
      client,
    );
  }

  private pull(client: WebSocket, payload: PULL_PAYLOAD) {
    // CFDO: test for invalid payload
    const lastAcknowledgedClientVersion = payload.lastAcknowledgedVersion;
    const lastAcknowledgedServerVersion = this.repository.getLastVersion();

    const versionΔ =
      lastAcknowledgedServerVersion - lastAcknowledgedClientVersion;

    if (versionΔ < 0) {
      // CFDO II: restore the client from the snapshot / deltas?
      console.error(
        `Panic! Client claims to have higher acknowledged version than the latest one on the server!`,
      );
      return;
    }

    const deltas: SERVER_DELTA[] = [];

    if (versionΔ > 0) {
      deltas.push(
        ...this.repository.getAllSinceVersion(lastAcknowledgedClientVersion),
      );
    }

    this.send(client, {
      type: "acknowledged",
      payload: {
        deltas,
      },
    });
  }

  private push(client: WebSocket, delta: PUSH_PAYLOAD) {
    const [storeDelta, applyingError] = Utils.try(() => {
      // update the "deleted" delta according to the latest changes (in case of concurrent changes)
      const storeDelta = StoreDelta.applyLatestChanges(
        StoreDelta.load(delta),
        this.elements as any,
        "deleted",
      );

      // apply the delta to the elements snapshot
      const [nextElements] = storeDelta.elements.applyTo(this.elements as any);

      this.elements = nextElements;

      return storeDelta;
    });

    if (applyingError) {
      // CFDO: everything should be automatically rolled-back in the db -> double-check
      return this.send(client, {
        type: "rejected",
        payload: {
          message: applyingError
            ? applyingError.message
            : "Couldn't apply the delta.",
          deltas: [delta],
        },
      });
    }

    const [acknowledged, savingError] = Utils.try(() => {
      return this.repository.save(storeDelta);
    });

    if (savingError || !acknowledged) {
      // CFDO: everything should be automatically rolled-back in the db -> double-check
      return this.send(client, {
        type: "rejected",
        payload: {
          message: savingError
            ? savingError.message
            : "Coudn't persist the delta.",
          deltas: [storeDelta],
        },
      });
    }

    return this.broadcast({
      type: "acknowledged",
      payload: {
        deltas: [acknowledged],
      },
    });
  }

  private send(ws: WebSocket, message: SERVER_MESSAGE) {
    const [encodedMessage, encodingError] = Utils.try(() =>
      Network.toBinary(message),
    );

    if (encodingError) {
      console.error(encodingError);
      return;
    }

    ws.send(encodedMessage);
  }

  private broadcast(message: SERVER_MESSAGE, exclude?: WebSocket) {
    const [encodedMessage, encodingError] = Utils.try(() =>
      Network.toBinary(message),
    );

    if (encodingError) {
      console.error(encodingError);
      return;
    }

    for (const ws of this.sessions) {
      if (ws === exclude) {
        continue;
      }

      ws.send(encodedMessage);
    }
  }
}
