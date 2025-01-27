import type { StoreChange, StoreDelta } from "../store";
import type { DTO } from "../utility-types";

export type CLIENT_DELTA = DTO<StoreDelta>;
export type CLIENT_CHANGE = DTO<StoreChange>;

export type RELAY_PAYLOAD = CLIENT_CHANGE;
export type PUSH_PAYLOAD = CLIENT_DELTA;
export type PULL_PAYLOAD = { lastAcknowledgedVersion: number };

export type CHUNK_INFO = {
  id: string;
  position: number;
  count: number;
};

export type CLIENT_MESSAGE = (
  | { type: "relay"; payload: RELAY_PAYLOAD }
  | { type: "pull"; payload: PULL_PAYLOAD }
  | { type: "push"; payload: PUSH_PAYLOAD }
) & { chunkInfo?: CHUNK_INFO };

export type CLIENT_MESSAGE_BINARY = {
  type: CLIENT_MESSAGE["type"];
  payload: Uint8Array;
  chunkInfo?: CHUNK_INFO;
};

export type SERVER_DELTA = {
  id: CLIENT_DELTA["id"];
  version: number;
  payload: CLIENT_DELTA;
};

export type SERVER_DELTA_STORAGE = {
  id: SERVER_DELTA["id"];
  version: SERVER_DELTA["version"];
  position: number;
  payload: ArrayBuffer;
};

export type SERVER_MESSAGE =
  | {
      type: "relayed";
      payload: RELAY_PAYLOAD;
    }
  | { type: "acknowledged"; payload: { deltas: Array<SERVER_DELTA> } }
  | {
      type: "rejected";
      payload: { deltas: Array<CLIENT_DELTA>; message: string };
    };

export interface DeltasRepository {
  save(delta: CLIENT_DELTA): SERVER_DELTA | null;
  getAllSinceVersion(version: number): Array<SERVER_DELTA>;
  getLastVersion(): number;
}

// CFDO: should come from the shared types package (might need a bigger refactor)
export type ExcalidrawElement = {
  id: string;
  type: any;
  version: number;
  [key: string]: any;
};
