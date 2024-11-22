export type RELAY_PAYLOAD = { buffer: ArrayBuffer };
export type PULL_PAYLOAD = { lastAcknowledgedVersion: number };
export type PUSH_PAYLOAD = {
  type: "durable" | "ephemeral";
  changes: Array<CLIENT_CHANGE>;
};

export type CLIENT_CHANGE = {
  id: string;
  appStateChange: any;
  elementsChange: any;
};

export type CLIENT_MESSAGE =
  | { type: "relay"; payload: RELAY_PAYLOAD }
  | { type: "pull"; payload: PULL_PAYLOAD }
  | { type: "push"; payload: PUSH_PAYLOAD };

export type SERVER_CHANGE = { id: string; version: number; payload: string };
export type SERVER_MESSAGE =
  | {
      type: "relayed";
      payload: { changes: Array<CLIENT_CHANGE> } | RELAY_PAYLOAD;
    }
  | { type: "acknowledged"; payload: { changes: Array<SERVER_CHANGE> } }
  | { type: "rejected"; payload: { ids: Array<string>; message: string } };

export interface ChangesRepository {
  saveAll(changes: Array<CLIENT_CHANGE>): Array<SERVER_CHANGE>;
  getSinceVersion(version: number): Array<SERVER_CHANGE>;
  getLastVersion(): number;
}

// TODO: should come from the shared types package
export type ExcalidrawElement = {
  id: string;
  type: any;
  version: number;
  [key: string]: any;
};
