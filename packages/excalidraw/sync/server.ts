import AsyncLock from "async-lock";
import { Utils } from "./utils";

import type {
  ChangesRepository,
  CLIENT_CHANGE,
  CLIENT_MESSAGE,
  PULL_PAYLOAD,
  PUSH_PAYLOAD,
  RELAY_PAYLOAD,
  SERVER_MESSAGE,
} from "./protocol";

// TODO: message could be binary (cbor, protobuf, etc.)

/**
 * Core excalidraw sync logic.
 */
export class ExcalidrawSyncServer {
  private readonly lock: AsyncLock = new AsyncLock();
  private readonly sessions: Set<WebSocket> = new Set();

  constructor(private readonly changesRepository: ChangesRepository) {}

  public onConnect(client: WebSocket) {
    this.sessions.add(client);
  }

  public onDisconnect(client: WebSocket) {
    this.sessions.delete(client);
  }

  public onMessage(client: WebSocket, message: string) {
    const [result, error] = Utils.try<CLIENT_MESSAGE>(() =>
      JSON.parse(message),
    );

    if (error) {
      console.error(error);
      return;
    }

    const { type, payload } = result;
    switch (type) {
      case "relay":
        return this.relay(client, payload);
      case "pull":
        return this.pull(client, payload);
      case "push":
        // apply each one-by-one to avoid race conditions
        // TODO: in theory we do not need to block ephemeral appState changes
        return this.lock.acquire("push", () => this.push(client, payload));
      default:
        console.error(`Unknown message type: ${type}`);
    }
  }

  private pull(client: WebSocket, payload: PULL_PAYLOAD) {
    // TODO: test for invalid payload
    const lastAcknowledgedClientVersion = payload.lastAcknowledgedVersion;
    const lastAcknowledgedServerVersion =
      this.changesRepository.getLastVersion();

    const versionΔ =
      lastAcknowledgedServerVersion - lastAcknowledgedClientVersion;

    if (versionΔ === 0) {
      console.info(`Client is up to date!`);
      return;
    }

    if (versionΔ < 0) {
      // TODO: restore the client from the snapshot / deltas?
      console.error(
        `Panic! Client claims to have higher acknowledged version than the latest one on the server!`,
      );
      return;
    }

    if (versionΔ > 0) {
      // TODO: for versioning we need deletions, but not for the "snapshot" update
      const changes = this.changesRepository.getSinceVersion(
        lastAcknowledgedClientVersion,
      );
      this.send(client, {
        type: "acknowledged",
        payload: {
          changes,
        },
      });
    }
  }

  private push(client: WebSocket, payload: PUSH_PAYLOAD) {
    const { type, changes } = payload;

    switch (type) {
      case "ephemeral":
        return this.relay(client, { changes });
      case "durable":
        const [acknowledged, error] = Utils.try(() => {
          // TODO: try to apply the changes to the snapshot
          return this.changesRepository.saveAll(changes);
        });

        if (error) {
          return this.send(client, {
            type: "rejected",
            payload: {
              message: error.message,
              changes,
            },
          });
        }

        return this.broadcast({
          type: "acknowledged",
          payload: {
            changes: acknowledged,
          },
        });
      default:
        console.error(`Unknown message type: ${type}`);
    }
  }

  private relay(
    client: WebSocket,
    payload: { changes: Array<CLIENT_CHANGE> } | RELAY_PAYLOAD,
  ) {
    return this.broadcast(
      {
        type: "relayed",
        payload,
      },
      client,
    );
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
