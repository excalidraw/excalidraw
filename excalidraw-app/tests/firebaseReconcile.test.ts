import { webcrypto } from "node:crypto";

import { newElementWith } from "@excalidraw/excalidraw";
import { generateEncryptionKey } from "@excalidraw/excalidraw/data/encryption";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { vi } from "vitest";

import type { FractionalIndex } from "@excalidraw/element/types";

import type { AppState } from "@excalidraw/excalidraw/types";

import { loadFromFirebase, saveToFirebase } from "../data/firebase";

import type { SyncableExcalidrawElement } from "../data";
import type Portal from "../collab/Portal";

import type { Socket } from "socket.io-client";

const firestoreDocs = vi.hoisted(() => new Map<string, unknown>());

vi.mock("../data/firebaseSDK", () => {
  return {
    initializeApp: () => ({}),
    getFirestore: () => ({}),
    doc: (_firestore: unknown, collection: string, id: string) => ({
      path: `${collection}/${id}`,
    }),
    getDoc: async (docRef: { path: string }) => {
      const data = firestoreDocs.get(docRef.path);
      return {
        exists: () => data !== undefined,
        data: () => data,
      };
    },
    runTransaction: async (
      _firestore: unknown,
      updateFn: (transaction: {
        get: (docRef: { path: string }) => Promise<{
          exists: () => boolean;
          data: () => unknown;
        }>;
        set: (docRef: { path: string }, data: unknown) => void;
        update: (docRef: { path: string }, data: unknown) => void;
      }) => Promise<unknown>,
    ) => {
      return updateFn({
        get: async (docRef) => {
          const data = firestoreDocs.get(docRef.path);
          return {
            exists: () => data !== undefined,
            data: () => data,
          };
        },
        set: (docRef, data) => {
          firestoreDocs.set(docRef.path, data);
        },
        update: (docRef, data) => {
          firestoreDocs.set(docRef.path, data);
        },
      });
    },
    Bytes: {
      fromUint8Array: (arr: Uint8Array) => ({
        toUint8Array: () => arr,
      }),
    },
  };
});

const createPortal = (roomId: string, roomKey: string): Portal =>
  ({
    roomId,
    roomKey,
    socket: {} as Socket,
  } as unknown as Portal);

describe("Firebase collaboration reconciliation", () => {
  const originalCrypto = window.crypto;

  beforeAll(() => {
    if (!window.crypto?.subtle?.importKey) {
      Object.defineProperty(window, "crypto", {
        value: webcrypto,
        configurable: true,
      });
    }
  });

  afterAll(() => {
    Object.defineProperty(window, "crypto", {
      value: originalCrypto,
      configurable: true,
    });
  });

  beforeEach(() => {
    firestoreDocs.clear();
  });

  it("preserves a newer remote deletion tombstone when saving concurrent edits during active text editing, resizing, or element creation", async () => {
    const roomKey = await generateEncryptionKey();
    expect(roomKey).toBeTruthy();

    for (const [index, activeAppState] of [
      (el: SyncableExcalidrawElement) =>
        ({ editingTextElement: el } as unknown as AppState),
      (el: SyncableExcalidrawElement) =>
        ({ resizingElement: el } as unknown as AppState),
      (el: SyncableExcalidrawElement) =>
        ({ newElement: el } as unknown as AppState),
    ].entries()) {
      const roomId = `room-${index}`;
      const portalA = createPortal(roomId, roomKey);
      const portalB = createPortal(roomId, roomKey);

      const initialText = API.createElement({
        type: "text",
        id: `text-${index}`,
        text: "Hello",
        index: "a0" as FractionalIndex,
      }) as SyncableExcalidrawElement;

      await saveToFirebase(portalA, [initialText], {} as AppState);

      const loadedByB = await loadFromFirebase(roomId, roomKey, portalB.socket);
      expect(loadedByB).toHaveLength(1);
      expect(loadedByB![0].isDeleted).toBe(false);

      const deletedByB = {
        ...newElementWith(loadedByB![0], {
          isDeleted: true,
        }),
        updated: Date.now(),
      } as SyncableExcalidrawElement;
      await saveToFirebase(portalB, [deletedByB], {} as AppState);

      const concurrentRect = API.createElement({
        type: "rectangle",
        id: `rect-${index}`,
        index: "a1" as FractionalIndex,
      }) as SyncableExcalidrawElement;

      // Collaborator A still holds stale text-v1 in an active state while saving another scene change
      const savedByA = await saveToFirebase(
        portalA,
        [initialText, concurrentRect],
        activeAppState(initialText),
      );

      expect(savedByA).not.toBeNull();
      const savedText = savedByA?.find((el) => el.id === initialText.id);
      expect(savedText?.isDeleted).toBe(true);
      expect(savedText?.version).toBe(deletedByB.version);

      const reloaded = await loadFromFirebase(roomId, roomKey, null);
      expect(reloaded?.find((el) => el.id === initialText.id)?.isDeleted).toBe(
        true,
      );
      expect(
        reloaded?.find((el) => el.id === concurrentRect.id)?.isDeleted,
      ).toBe(false);
    }
  });

  it("does not resurrect a deleted element on save when a client with an uncached socket holds editingTextElement", async () => {
    const roomId = "room-reconnect";
    const roomKey = await generateEncryptionKey();
    const portalA = createPortal(roomId, roomKey);
    const portalB = createPortal(roomId, roomKey);

    const initialText = API.createElement({
      type: "text",
      id: "text-reconnect",
      text: "Shared note",
      index: "a0" as FractionalIndex,
    }) as SyncableExcalidrawElement;

    await saveToFirebase(portalA, [initialText], {} as AppState);

    const loadedByB = await loadFromFirebase(roomId, roomKey, portalB.socket);
    const deletedByB = {
      ...newElementWith(loadedByB![0], {
        isDeleted: true,
      }),
      updated: Date.now(),
    } as SyncableExcalidrawElement;
    await saveToFirebase(portalB, [deletedByB], {} as AppState);

    // New socket instance simulates reconnect/new cache entry holding stale local element
    const reconnectedPortalA = createPortal(roomId, roomKey);
    const savedByA = await saveToFirebase(reconnectedPortalA, [initialText], {
      editingTextElement: initialText,
    } as unknown as AppState);

    expect(savedByA).toHaveLength(1);
    expect(savedByA![0].isDeleted).toBe(true);

    const finalLoaded = await loadFromFirebase(roomId, roomKey, null);
    expect(finalLoaded).toHaveLength(1);
    expect(finalLoaded![0].isDeleted).toBe(true);
  });
});
