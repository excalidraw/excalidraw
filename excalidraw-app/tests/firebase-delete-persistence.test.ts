import { webcrypto } from "node:crypto";

import { vi } from "vitest";
import { syncInvalidIndices } from "@excalidraw/element";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { generateEncryptionKey } from "@excalidraw/excalidraw/data/encryption";
import { reconcileElements } from "@excalidraw/excalidraw/data/reconcile";

import type { AppState } from "@excalidraw/excalidraw/types";

import { getSyncableElements } from "../data";
import {
  isSavedToFirebase,
  loadFromFirebase,
  saveToFirebase,
} from "../data/firebase";

import type Portal from "../collab/Portal";

const firestore = vi.hoisted(() => ({
  scenes: new Map<string, unknown>(),
  writes: 0,
}));

// Exercise the real save transaction and encryption, replacing only SDK I/O.
vi.mock("../data/firebaseSDK", () => {
  const getSnapshot = (id: string) => ({
    exists: () => firestore.scenes.has(id),
    data: () => firestore.scenes.get(id),
  });
  const write = (id: string, data: unknown) => {
    firestore.scenes.set(id, data);
    firestore.writes++;
  };
  return {
    initializeApp: () => ({}),
    getFirestore: () => ({}),
    doc: (_db: unknown, _collection: string, id: string) => id,
    getDoc: async (id: string) => getSnapshot(id),
    runTransaction: async (
      _db: unknown,
      callback: (transaction: unknown) => Promise<unknown>,
    ) =>
      callback({
        get: async (id: string) => getSnapshot(id),
        set: write,
        update: write,
      }),
    Bytes: {
      fromUint8Array: (bytes: Uint8Array) => ({ toUint8Array: () => bytes }),
    },
  };
});

describe("collaboration deletion persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", webcrypto);
    firestore.scenes.clear();
    firestore.writes = 0;
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([true, false])(
    "preserves a winning deletion across save, commit and reload (editing: %s)",
    async (editing) => {
      const roomKey = await generateEncryptionKey();
      const portalA = { roomId: "room", roomKey, socket: {} } as Portal;
      const portalB = { roomId: "room", roomKey, socket: {} } as Portal;
      const idleState = {} as AppState;
      const [base] = syncInvalidIndices([
        API.createElement({ type: "text", id: "T", text: "original" }),
      ]);
      const active = {
        ...base,
        version: 10,
        versionNonce: 10,
        updated: Date.now(),
      };
      const deletion = { ...active, version: 12, isDeleted: true };
      const edited = {
        ...active,
        version: 11,
        text: "Edited by A",
        originalText: "Edited by A",
        x: 30,
      };
      const state = editing
        ? ({ editingTextElement: edited } as AppState)
        : idleState;

      await saveToFirebase(portalA, getSyncableElements([active]), idleState);
      await saveToFirebase(portalB, getSyncableElements([deletion]), idleState);
      expect(await loadFromFirebase("room", roomKey, null)).toEqual([
        expect.objectContaining({ id: "T", isDeleted: true, version: 12 }),
      ]);

      const stored = await saveToFirebase(
        portalA,
        getSyncableElements([edited]),
        state,
      );
      expect(stored).toEqual([
        expect.objectContaining({ id: "T", isDeleted: true, version: 12 }),
      ]);
      // Apply the save response exactly as collaboration does. Finishing the
      // cancelled edit must save this scene, rather than a stale active snapshot.
      const committed = reconcileElements([edited], stored!, state);
      expect(isSavedToFirebase(portalA, committed)).toBe(true);
      expect(
        await saveToFirebase(
          portalA,
          getSyncableElements(committed),
          idleState,
        ),
      ).toBeNull();
      // A subsequent save containing another change also retains the tombstone.
      const [other] = syncInvalidIndices([API.createElement({ id: "other" })]);
      await saveToFirebase(
        portalA,
        getSyncableElements([...committed, other]),
        idleState,
      );
      expect(firestore.writes).toBe(4);
      const loaded = await loadFromFirebase("room", roomKey, null);
      expect(loaded?.find((element) => element.id === "T")).toEqual(
        expect.objectContaining({ isDeleted: true, version: 12 }),
      );

      // Explicit restoration with a newer version remains possible.
      const restored = { ...edited, version: 20 };
      await saveToFirebase(portalB, getSyncableElements([restored]), idleState);
      expect(
        (await loadFromFirebase("room", roomKey, null))?.find(
          (element) => element.id === "T",
        ),
      ).toEqual(expect.objectContaining({ isDeleted: false, version: 20 }));
    },
  );
});
