import AsyncLock from "async-lock";
import msgpack from "msgpack-lite";
import { Utils } from "./utils";

import type {
  DeltasRepository,
  CLIENT_MESSAGE,
  PULL_PAYLOAD,
  PUSH_PAYLOAD,
  SERVER_MESSAGE,
  SERVER_DELTA,
  CLIENT_MESSAGE_RAW,
  CHUNK_INFO,
  RELAY_PAYLOAD,
} from "./protocol";

// CFDO: message could be binary (cbor, protobuf, etc.)

/**
 * Core excalidraw sync logic.
 */
export class ExcalidrawSyncServer {
  private readonly lock: AsyncLock = new AsyncLock();
  private readonly sessions: Set<WebSocket> = new Set();
  private readonly chunks = new Map<
    CHUNK_INFO["id"],
    Map<CHUNK_INFO["position"], CLIENT_MESSAGE_RAW["payload"]>
  >();

  constructor(private readonly repository: DeltasRepository) {}

  // CFDO: should send a message about collaborators (no collaborators => no need to send ephemerals)
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
    const [parsedMessage, parseMessageError] = Utils.try<CLIENT_MESSAGE_RAW>(
      () => {
        const headerLength = 4;
        const header = new Uint8Array(message, 0, headerLength);
        const metadataLength = new DataView(
          header.buffer,
          header.byteOffset,
        ).getUint32(0);

        const metadata = new Uint8Array(
          message,
          headerLength,
          headerLength + metadataLength,
        );

        const payload = new Uint8Array(message, headerLength + metadataLength);
        const parsed = {
          ...msgpack.decode(metadata),
          payload,
        };

        // CFDO: add dev-level logging
        console.log({ parsed });

        return parsed;
      },
    );

    if (parseMessageError) {
      console.error(parseMessageError);
      return;
    }

    const { type, payload, chunkInfo } = parsedMessage;

    // if there is chunkInfo, there are more than 1 chunks => process them first
    if (chunkInfo) {
      return this.processChunks(client, { type, payload, chunkInfo });
    }

    return this.processMessage(client, parsedMessage);
  }

  /**
   * Process chunks in case the client-side payload would overflow the 1MiB durable object WS message limit.
   */
  private processChunks(
    client: WebSocket,
    message: CLIENT_MESSAGE_RAW & { chunkInfo: CHUNK_INFO },
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
      };

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
    { type, payload }: Omit<CLIENT_MESSAGE_RAW, "chunkInfo">,
  ) {
    const [parsedPayload, parsePayloadError] = Utils.try<
      CLIENT_MESSAGE["payload"]
    >(() => msgpack.decode(payload));

    if (parsePayloadError) {
      console.error(parsePayloadError);
      return;
    }

    switch (type) {
      case "relay":
        return this.relay(client, parsedPayload as RELAY_PAYLOAD);
      case "pull":
        return this.pull(client, parsedPayload as PULL_PAYLOAD);
      case "push":
        // apply each one-by-one to avoid race conditions
        // CFDO: in theory we do not need to block ephemeral appState changes
        return this.lock.acquire("push", () =>
          this.push(client, parsedPayload as PUSH_PAYLOAD),
        );
      default:
        console.error(`Unknown message type: ${type}`);
    }
  }

  private relay(client: WebSocket, payload: RELAY_PAYLOAD) {
    // CFDO: we should likely apply these to the snapshot
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
      // CFDO: restore the client from the snapshot / deltas?
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
    // CFDO: try to apply the deltas to the snapshot
    const [acknowledged, error] = Utils.try(() => this.repository.save(delta));

    if (error || !acknowledged) {
      // everything should be automatically rolled-back -> double-check
      return this.send(client, {
        type: "rejected",
        payload: {
          message: error ? error.message : "Coudn't persist the delta.",
          deltas: [delta],
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

  private send(client: WebSocket, message: SERVER_MESSAGE) {
    const [encodedMessage, encodeError] = Utils.try<Uint8Array>(() =>
      msgpack.encode(message),
    );

    if (encodeError) {
      console.error(encodeError);
      return;
    }

    client.send(encodedMessage);
  }

  private broadcast(message: SERVER_MESSAGE, exclude?: WebSocket) {
    const [encodedMessage, encodeError] = Utils.try<Uint8Array>(() =>
      msgpack.encode(message),
    );

    if (encodeError) {
      console.error(encodeError);
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
