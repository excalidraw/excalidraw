import type { StoreIncrement } from "../store";

export type RELAY_PAYLOAD = { buffer: ArrayBuffer };
export type PULL_PAYLOAD = { lastAcknowledgedVersion: number };
export type PUSH_PAYLOAD = {
  type: "durable" | "ephemeral";
  increments: Array<CLIENT_INCREMENT>;
};

export type CLIENT_INCREMENT = StoreIncrement;

export type CLIENT_MESSAGE =
  | { type: "relay"; payload: RELAY_PAYLOAD }
  | { type: "pull"; payload: PULL_PAYLOAD }
  | { type: "push"; payload: PUSH_PAYLOAD };

export type SERVER_INCREMENT = { id: string; version: number; payload: string };
export type SERVER_MESSAGE =
  | {
      type: "relayed";
      payload: { increments: Array<CLIENT_INCREMENT> } | RELAY_PAYLOAD;
    }
  | { type: "acknowledged"; payload: { increments: Array<SERVER_INCREMENT> } }
  | {
      type: "rejected";
      payload: { increments: Array<CLIENT_INCREMENT>; message: string };
    };

export interface IncrementsRepository {
  saveAll(increments: Array<CLIENT_INCREMENT>): Array<SERVER_INCREMENT>;
  getSinceVersion(version: number): Array<SERVER_INCREMENT>;
  getLastVersion(): number;
}

// CFDO: should come from the shared types package
export type ExcalidrawElement = {
  id: string;
  type: any;
  version: number;
  [key: string]: any;
};
