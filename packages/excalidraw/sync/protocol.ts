import type { StoreIncrement } from "../store";
import type { DTO } from "../utility-types";

export type CLIENT_INCREMENT = DTO<StoreIncrement>;

export type RELAY_PAYLOAD = { buffer: ArrayBuffer };
export type PULL_PAYLOAD = { lastAcknowledgedVersion: number };
export type PUSH_PAYLOAD = CLIENT_INCREMENT;

export type CHUNK_INFO = {
  id: string;
  position: number;
  count: number;
};

export type CLIENT_MESSAGE_RAW = {
  type: "relay" | "pull" | "push";
  payload: string;
  chunkInfo?: CHUNK_INFO;
};

export type CLIENT_MESSAGE = { chunkInfo: CHUNK_INFO } & (
  | { type: "relay"; payload: RELAY_PAYLOAD }
  | { type: "pull"; payload: PULL_PAYLOAD }
  | { type: "push"; payload: PUSH_PAYLOAD }
);

export type SERVER_INCREMENT = { id: string; version: number; payload: string };
export type SERVER_MESSAGE =
  | {
      type: "relayed";
      // CFDO: should likely be just elements
      // payload: { increments: Array<CLIENT_INCREMENT> } | RELAY_PAYLOAD;
    }
  | { type: "acknowledged"; payload: { increments: Array<SERVER_INCREMENT> } }
  | {
      type: "rejected";
      payload: { increments: Array<CLIENT_INCREMENT>; message: string };
    };

export interface IncrementsRepository {
  save(increment: CLIENT_INCREMENT): SERVER_INCREMENT | null;
  getAllSinceVersion(version: number): Array<SERVER_INCREMENT>;
  getLastVersion(): number;
}

// CFDO: should come from the shared types package
export type ExcalidrawElement = {
  id: string;
  type: any;
  version: number;
  [key: string]: any;
};
