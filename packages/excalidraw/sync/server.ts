import AsyncLock from "async-lock";
import { Utils } from "./utils";

import type {
  IncrementsRepository,
  CLIENT_INCREMENT,
  CLIENT_MESSAGE,
  PULL_PAYLOAD,
  PUSH_PAYLOAD,
  RELAY_PAYLOAD,
  SERVER_MESSAGE,
  SERVER_INCREMENT,
  CLIENT_MESSAGE_RAW,
} from "./protocol";

// CFDO: message could be binary (cbor, protobuf, etc.)

/**
 * Core excalidraw sync logic.
 */
export class ExcalidrawSyncServer {
  private readonly lock: AsyncLock = new AsyncLock();
  private readonly sessions: Set<WebSocket> = new Set();
  private readonly chunks = new Map<
    CLIENT_MESSAGE_RAW["chunkInfo"]["id"],
    Map<CLIENT_MESSAGE_RAW["chunkInfo"]["order"], CLIENT_MESSAGE_RAW["payload"]>
  >();

  constructor(private readonly incrementsRepository: IncrementsRepository) {}

  public onConnect(client: WebSocket) {
    this.sessions.add(client);
  }

  public onDisconnect(client: WebSocket) {
    this.sessions.delete(client);
  }

  public onMessage(client: WebSocket, message: string): Promise<void> | void {
    const [parsedMessage, parseMessageError] = Utils.try<CLIENT_MESSAGE_RAW>(
      () => {
        return JSON.parse(message);
      },
    );

    if (parseMessageError) {
      console.error(parseMessageError);
      return;
    }

    const { type, payload, chunkInfo } = parsedMessage;

    // if there are more than 1 chunks, process them first
    if (chunkInfo.count > 1) {
      return this.processChunks(client, parsedMessage);
    }

    const [parsedPayload, parsePayloadError] = Utils.try<
      CLIENT_MESSAGE["payload"]
    >(() => JSON.parse(payload));

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

  /**
   * Process chunks in case the client-side payload would overflow the 1MiB durable object WS message limit.
   */
  private processChunks(client: WebSocket, message: CLIENT_MESSAGE_RAW) {
    let shouldCleanupchunks = true;
    const {
      type,
      payload,
      chunkInfo: { id, order, count },
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
      chunks.set(order, payload);

      if (chunks.size !== count) {
        // we don't have all the chunks, don't cleanup just yet!
        shouldCleanupchunks = false;
        return;
      }

      // hopefully we can fit into the 128 MiB memory limit
      const restoredPayload = Array.from(chunks)
        .sort((a, b) => (a <= b ? -1 : 1))
        .reduce((acc, [_, payload]) => (acc += payload), "");

      const rawMessage = JSON.stringify({
        type,
        payload: restoredPayload,
        // id is irrelevant if we are sending just one chunk
        chunkInfo: { id: "", order: 0, count: 1 },
      } as CLIENT_MESSAGE_RAW);

      // process the message
      return this.onMessage(client, rawMessage);
    } catch (error) {
      console.error(`Error while processing chunk "${id}"`, error);
    } finally {
      // cleanup the chunks
      if (shouldCleanupchunks) {
        this.chunks.delete(id);
      }
    }
  }

  private relay(
    client: WebSocket,
    payload: { increments: Array<CLIENT_INCREMENT> } | RELAY_PAYLOAD,
  ) {
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
    const lastAcknowledgedServerVersion =
      this.incrementsRepository.getLastVersion();

    const versionΔ =
      lastAcknowledgedServerVersion - lastAcknowledgedClientVersion;

    if (versionΔ < 0) {
      // CFDO: restore the client from the snapshot / deltas?
      console.error(
        `Panic! Client claims to have higher acknowledged version than the latest one on the server!`,
      );
      return;
    }

    const increments: SERVER_INCREMENT[] = [];

    if (versionΔ > 0) {
      increments.push(
        ...this.incrementsRepository.getSinceVersion(
          lastAcknowledgedClientVersion,
        ),
      );
    }

    this.send(client, {
      type: "acknowledged",
      payload: {
        increments,
      },
    });
  }

  private push(client: WebSocket, payload: PUSH_PAYLOAD) {
    const { type, increments } = payload;

    switch (type) {
      case "ephemeral":
        return this.relay(client, { increments });
      case "durable":
        // CFDO: try to apply the increments to the snapshot
        const [acknowledged, error] = Utils.try(() =>
          this.incrementsRepository.saveAll(increments),
        );

        if (error) {
          // everything should be automatically rolled-back -> double-check
          return this.send(client, {
            type: "rejected",
            payload: {
              message: error.message,
              increments,
            },
          });
        }

        return this.broadcast({
          type: "acknowledged",
          payload: {
            increments: acknowledged,
          },
        });
      default:
        console.error(`Unknown push message type: ${type}`);
    }
  }

  private send(client: WebSocket, message: SERVER_MESSAGE) {
    const msg = JSON.stringify(message);
    client.send(msg);
  }

  private broadcast(message: SERVER_MESSAGE, exclude?: WebSocket) {
    const msg = JSON.stringify(message);

    for (const ws of this.sessions) {
      if (ws === exclude) {
        continue;
      }

      ws.send(msg);
    }
  }
}
