import type { StoreChange, StoreDelta } from "../store";
import type { DTO } from "../utility-types";

export type DELTA = DTO<StoreDelta>;
export type CHANGE = DTO<StoreChange>;

export type RELAY_PAYLOAD = CHANGE;
export type PUSH_PAYLOAD = DELTA;
export type PULL_PAYLOAD = { lastAcknowledgedVersion: number };

export type CHUNK_INFO = {
  id: string;
  position: number;
  count: number;
};

export type CLIENT_MESSAGE_RAW = {
  type: "relay" | "pull" | "push";
  payload: Uint8Array;
  chunkInfo?: CHUNK_INFO;
};

export type CLIENT_MESSAGE = { chunkInfo: CHUNK_INFO } & (
  | { type: "relay"; payload: RELAY_PAYLOAD }
  | { type: "pull"; payload: PULL_PAYLOAD }
  | { type: "push"; payload: PUSH_PAYLOAD }
);

export type SERVER_DELTA = {
  id: string;
  version: number;
  // CFDO: should be type-safe
  payload: Record<string, any>;
};
export type SERVER_MESSAGE =
  | {
      type: "relayed";
      payload: RELAY_PAYLOAD;
    }
  | { type: "acknowledged"; payload: { deltas: Array<SERVER_DELTA> } }
  | {
      type: "rejected";
      payload: { deltas: Array<DELTA>; message: string };
    };

export interface DeltasRepository {
  save(delta: DELTA): SERVER_DELTA | null;
  getAllSinceVersion(version: number): Array<SERVER_DELTA>;
  getLastVersion(): number;
}

// CFDO: should come from the shared types package
export type ExcalidrawElement = {
  id: string;
  type: any;
  version: number;
  [key: string]: any;
};
