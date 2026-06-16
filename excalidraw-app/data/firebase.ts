import { reconcileElements } from "@excalidraw/excalidraw";
import { MIME_TYPES, toBrandedType } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  Bytes,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes } from "firebase/storage";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "@excalidraw/excalidraw/types";

import { FILE_CACHE_MAX_AGE_SEC } from "../app_constants";

import {
  createSceneHistoryId,
  createSceneHistorySnapshot,
  getReferencedFileIds,
  MAX_SCENE_HISTORY_ENTRIES,
  SCENE_HISTORY_VERSION,
} from "./SceneHistory";

import { getSyncableElements } from ".";

import type { SyncableExcalidrawElement } from ".";
import type {
  SceneHistoryData,
  SceneHistoryEntry,
  SceneHistoryEntryKind,
  SceneHistorySnapshot,
} from "./SceneHistory";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";
import type { Unsubscribe } from "firebase/firestore";

// private
// -----------------------------------------------------------------------------

let FIREBASE_CONFIG: Record<string, any>;
try {
  FIREBASE_CONFIG = JSON.parse(import.meta.env.VITE_APP_FIREBASE_CONFIG);
} catch (error: any) {
  console.warn(
    `Error JSON parsing firebase config. Supplied value: ${
      import.meta.env.VITE_APP_FIREBASE_CONFIG
    }`,
  );
  FIREBASE_CONFIG = {};
}

let firebaseApp: ReturnType<typeof initializeApp> | null = null;
let firestore: ReturnType<typeof getFirestore> | null = null;
let firebaseStorage: ReturnType<typeof getStorage> | null = null;

const _initializeFirebase = () => {
  if (!firebaseApp) {
    firebaseApp = initializeApp(FIREBASE_CONFIG);
  }
  return firebaseApp;
};

const _getFirestore = () => {
  if (!firestore) {
    firestore = getFirestore(_initializeFirebase());
  }
  return firestore;
};

const _getStorage = () => {
  if (!firebaseStorage) {
    firebaseStorage = getStorage(_initializeFirebase());
  }
  return firebaseStorage;
};

// -----------------------------------------------------------------------------

export const loadFirebaseStorage = async () => {
  return _getStorage();
};

type FirebaseStoredScene = {
  sceneVersion: number;
  iv: Bytes;
  ciphertext: Bytes;
};

type FirebaseSceneHistoryPayload = SceneHistorySnapshot & {
  thumbnail: string | null;
};

type FirebaseStoredSceneHistoryEntry = {
  historyVersion: typeof SCENE_HISTORY_VERSION;
  sceneVersion: number;
  iv: Bytes;
  ciphertext: Bytes;
};

type FirebaseSceneHistoryEntryMeta = {
  id: string;
  kind: SceneHistoryEntryKind;
  sequence: number;
  createdAt: number;
  sessionId: string;
  author?: string;
  parentId: string | null;
  summary: string;
  fileIds: FileId[];
  sceneVersion: number;
  restoreSourceId?: string;
};

type FirebaseSceneHistoryMetadata = {
  historyVersion: typeof SCENE_HISTORY_VERSION;
  currentEntryId: string | null;
  currentSceneVersion: number | null;
  lastSequence: number;
  updatedAt: number;
  entries: FirebaseSceneHistoryEntryMeta[];
};

type FirebaseSceneHistoryAppend = {
  roomId: string;
  roomKey: string;
  sessionId: string;
  author?: string;
  elements: readonly OrderedExcalidrawElement[];
  appState: AppState;
  thumbnail?: string | null;
  kind?: Extract<SceneHistoryEntryKind, "change" | "restore">;
  restoreSourceId?: string;
};

const encryptElements = async (
  key: string,
  elements: readonly ExcalidrawElement[],
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> => {
  const json = JSON.stringify(elements);
  const encoded = new TextEncoder().encode(json);
  const { encryptedBuffer, iv } = await encryptData(key, encoded);

  return { ciphertext: encryptedBuffer, iv };
};

const decryptElements = async (
  data: FirebaseStoredScene,
  roomKey: string,
): Promise<readonly ExcalidrawElement[]> => {
  const ciphertext = data.ciphertext.toUint8Array() as Uint8Array<ArrayBuffer>;
  const iv = data.iv.toUint8Array() as Uint8Array<ArrayBuffer>;

  const decrypted = await decryptData(iv, ciphertext, roomKey);
  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  return JSON.parse(decodedData);
};

const encryptSceneHistoryPayload = async (
  key: string,
  payload: FirebaseSceneHistoryPayload,
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> => {
  const json = JSON.stringify(payload);
  const encoded = new TextEncoder().encode(json);
  const { encryptedBuffer, iv } = await encryptData(key, encoded);

  return { ciphertext: encryptedBuffer, iv };
};

const decryptSceneHistoryPayload = async (
  data: FirebaseStoredSceneHistoryEntry,
  roomKey: string,
): Promise<FirebaseSceneHistoryPayload> => {
  const ciphertext = data.ciphertext.toUint8Array() as Uint8Array<ArrayBuffer>;
  const iv = data.iv.toUint8Array() as Uint8Array<ArrayBuffer>;

  const decrypted = await decryptData(iv, ciphertext, roomKey);
  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  return JSON.parse(decodedData);
};

// The hosted Firestore rules only grant access to top-level `scenes/{id}`
// documents (subcollections and other collections are denied for both reads
// and writes), so shared history is stored as sibling `scenes` documents keyed
// off the room id rather than a dedicated collection.
const SCENE_HISTORY_ID_SUFFIX = "~history";

// `~` namespaces history documents inside the `scenes` collection; a room id
// containing it would alias another room's history (or its meta) document.
const assertHistoryRoomId = (roomId: string) => {
  if (roomId.includes("~")) {
    throw new Error(`Unexpected "~" in collab room id: ${roomId}`);
  }
};

const getSceneHistoryMetaRef = (roomId: string) => {
  assertHistoryRoomId(roomId);
  return doc(_getFirestore(), "scenes", `${roomId}${SCENE_HISTORY_ID_SUFFIX}`);
};

const getSceneHistoryEntryRef = (roomId: string, entryId: string) => {
  assertHistoryRoomId(roomId);
  return doc(
    _getFirestore(),
    "scenes",
    `${roomId}${SCENE_HISTORY_ID_SUFFIX}~${entryId}`,
  );
};

const createEmptySceneHistoryData = (roomId: string): SceneHistoryData => ({
  version: SCENE_HISTORY_VERSION,
  documentId: `collab:${roomId}`,
  currentEntryId: null,
  entries: [],
  files: {},
});

const buildSceneHistoryDataFromMeta = (
  roomId: string,
  meta: FirebaseSceneHistoryMetadata | null,
): SceneHistoryData => {
  const entries: SceneHistoryEntry[] = (meta?.entries ?? []).map(
    (storedEntry) => ({
      id: storedEntry.id,
      kind: storedEntry.kind,
      sequence: storedEntry.sequence,
      createdAt: storedEntry.createdAt,
      sessionId: storedEntry.sessionId,
      author: storedEntry.author ?? null,
      parentId: storedEntry.parentId ?? null,
      summary: storedEntry.summary,
      thumbnail: null,
      fileIds: storedEntry.fileIds ?? [],
      restoreSourceId: storedEntry.restoreSourceId,
    }),
  );

  return {
    ...createEmptySceneHistoryData(roomId),
    currentEntryId:
      meta?.currentEntryId ?? entries[entries.length - 1]?.id ?? null,
    entries,
  };
};

class FirebaseSceneVersionCache {
  private static cache = new WeakMap<Socket, number>();
  static get = (socket: Socket) => {
    return FirebaseSceneVersionCache.cache.get(socket);
  };
  static set = (
    socket: Socket,
    elements: readonly SyncableExcalidrawElement[],
  ) => {
    FirebaseSceneVersionCache.cache.set(socket, getSceneVersion(elements));
  };
}

export const isSavedToFirebase = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);

    return FirebaseSceneVersionCache.get(portal.socket) === sceneVersion;
  }
  // if no room exists, consider the room saved so that we don't unnecessarily
  // prevent unload (there's nothing we could do at that point anyway)
  return true;
};

export const saveFilesToFirebase = async ({
  prefix,
  files,
}: {
  prefix: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  const storage = await loadFirebaseStorage();

  const erroredFiles: FileId[] = [];
  const savedFiles: FileId[] = [];

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        const storageRef = ref(storage, `${prefix}/${id}`);
        await uploadBytes(storageRef, buffer, {
          cacheControl: `public, max-age=${FILE_CACHE_MAX_AGE_SEC}`,
        });
        savedFiles.push(id);
      } catch (error: any) {
        erroredFiles.push(id);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

const createFirebaseSceneDocument = async (
  elements: readonly SyncableExcalidrawElement[],
  roomKey: string,
) => {
  const sceneVersion = getSceneVersion(elements);
  const { ciphertext, iv } = await encryptElements(roomKey, elements);
  return {
    sceneVersion,
    ciphertext: Bytes.fromUint8Array(new Uint8Array(ciphertext)),
    iv: Bytes.fromUint8Array(iv),
  } as FirebaseStoredScene;
};

export const saveToFirebase = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
) => {
  const { roomId, roomKey, socket } = portal;
  if (
    // bail if no room exists as there's nothing we can do at this point
    !roomId ||
    !roomKey ||
    !socket ||
    isSavedToFirebase(portal, elements)
  ) {
    return null;
  }

  const firestore = _getFirestore();
  const docRef = doc(firestore, "scenes", roomId);

  const storedScene = await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(docRef);

    if (!snapshot.exists()) {
      const storedScene = await createFirebaseSceneDocument(elements, roomKey);

      transaction.set(docRef, storedScene);

      return storedScene;
    }

    const prevStoredScene = snapshot.data() as FirebaseStoredScene;
    const prevStoredElements = getSyncableElements(
      restoreElements(await decryptElements(prevStoredScene, roomKey), null),
    );
    const reconciledElements = getSyncableElements(
      reconcileElements(
        elements,
        prevStoredElements as OrderedExcalidrawElement[] as RemoteExcalidrawElement[],
        appState,
      ),
    );

    const storedScene = await createFirebaseSceneDocument(
      reconciledElements,
      roomKey,
    );

    transaction.update(docRef, storedScene);

    // Return the stored elements as the in memory `reconciledElements` could have mutated in the meantime
    return storedScene;
  });

  const storedElements = getSyncableElements(
    restoreElements(await decryptElements(storedScene, roomKey), null),
  );

  FirebaseSceneVersionCache.set(socket, storedElements);

  return toBrandedType<RemoteExcalidrawElement[]>(storedElements);
};

export const loadFromFirebase = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const firestore = _getFirestore();
  const docRef = doc(firestore, "scenes", roomId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    return null;
  }
  const storedScene = docSnap.data() as FirebaseStoredScene;
  const elements = getSyncableElements(
    restoreElements(await decryptElements(storedScene, roomKey), null, {
      deleteInvisibleElements: true,
    }),
  );

  if (socket) {
    FirebaseSceneVersionCache.set(socket, elements);
  }

  return elements;
};

export const loadSceneHistoryFromFirebase = async ({
  roomId,
}: {
  roomId: string;
}): Promise<SceneHistoryData> => {
  const snapshot = await getDoc(getSceneHistoryMetaRef(roomId));
  const meta = snapshot.exists()
    ? (snapshot.data() as FirebaseSceneHistoryMetadata)
    : null;

  return buildSceneHistoryDataFromMeta(roomId, meta);
};

export const subscribeSceneHistoryFromFirebase = ({
  roomId,
  onChange,
  onError,
}: {
  roomId: string;
  onChange: (historyData: SceneHistoryData) => void;
  onError: (error: Error) => void;
}): Unsubscribe => {
  return onSnapshot(
    getSceneHistoryMetaRef(roomId),
    (snapshot) => {
      const meta = snapshot.exists()
        ? (snapshot.data() as FirebaseSceneHistoryMetadata)
        : null;

      onChange(buildSceneHistoryDataFromMeta(roomId, meta));
    },
    onError,
  );
};

export const loadSceneHistoryEntryFromFirebase = async ({
  roomId,
  roomKey,
  entryId,
}: {
  roomId: string;
  roomKey: string;
  entryId: string;
}): Promise<FirebaseSceneHistoryPayload | null> => {
  const snapshot = await getDoc(getSceneHistoryEntryRef(roomId, entryId));

  if (!snapshot.exists()) {
    return null;
  }

  const storedEntry =
    snapshot.data() as Partial<FirebaseStoredSceneHistoryEntry>;

  if (!storedEntry.iv || !storedEntry.ciphertext) {
    return null;
  }

  return decryptSceneHistoryPayload(
    storedEntry as FirebaseStoredSceneHistoryEntry,
    roomKey,
  );
};

export const appendSceneHistoryToFirebase = async ({
  roomId,
  roomKey,
  sessionId,
  author,
  elements,
  appState,
  thumbnail = null,
  kind = "change",
  restoreSourceId,
}: FirebaseSceneHistoryAppend) => {
  const sceneVersion = getSceneVersion(elements);
  const payload: FirebaseSceneHistoryPayload = {
    ...createSceneHistorySnapshot({ elements, appState }),
    thumbnail,
  };
  const { ciphertext, iv } = await encryptSceneHistoryPayload(roomKey, payload);
  const firestore = _getFirestore();
  const metaRef = getSceneHistoryMetaRef(roomId);
  const entryId = createSceneHistoryId();
  const createdAt = Date.now();
  const fileIds = getReferencedFileIds(elements);

  return runTransaction(firestore, async (transaction) => {
    const metaSnapshot = await transaction.get(metaRef);
    const meta = metaSnapshot.exists()
      ? (metaSnapshot.data() as FirebaseSceneHistoryMetadata)
      : null;

    if (
      meta?.historyVersion === SCENE_HISTORY_VERSION &&
      meta.currentSceneVersion === sceneVersion &&
      kind !== "restore"
    ) {
      return null;
    }

    const existingEntries = meta?.entries ?? [];
    const sequence = (meta?.lastSequence ?? -1) + 1;
    const entryKind = sequence === 0 ? "initial" : kind;

    const entryMeta: FirebaseSceneHistoryEntryMeta = {
      id: entryId,
      kind: entryKind,
      sequence,
      createdAt,
      sessionId,
      // Firestore rejects `undefined`, so only include when present.
      ...(author ? { author } : {}),
      parentId: meta?.currentEntryId ?? null,
      summary:
        entryKind === "initial"
          ? "Initial version"
          : entryKind === "restore"
          ? "Restored previous version"
          : "Shared scene updated",
      fileIds,
      sceneVersion,
      // Firestore rejects `undefined`, so only include when present.
      ...(restoreSourceId ? { restoreSourceId } : {}),
    };

    const storedEntry: FirebaseStoredSceneHistoryEntry = {
      historyVersion: SCENE_HISTORY_VERSION,
      sceneVersion,
      ciphertext: Bytes.fromUint8Array(new Uint8Array(ciphertext)),
      iv: Bytes.fromUint8Array(iv),
    };

    const allEntries = [...existingEntries, entryMeta];
    const overflow = Math.max(0, allEntries.length - MAX_SCENE_HISTORY_ENTRIES);
    const trimmedEntries = allEntries.slice(0, overflow);
    const nextEntries = allEntries.slice(overflow);

    const nextMetadata: FirebaseSceneHistoryMetadata = {
      historyVersion: SCENE_HISTORY_VERSION,
      currentEntryId: entryId,
      currentSceneVersion: sceneVersion,
      lastSequence: sequence,
      updatedAt: createdAt,
      entries: nextEntries,
    };

    transaction.set(getSceneHistoryEntryRef(roomId, entryId), storedEntry);
    transaction.set(metaRef, nextMetadata);

    for (const trimmed of trimmedEntries) {
      transaction.delete(getSceneHistoryEntryRef(roomId, trimmed.id));
    }

    return entryMeta;
  });
};

export const loadFilesFromFirebase = async (
  prefix: string,
  decryptionKey: string,
  filesIds: readonly FileId[],
) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const url = `https://firebasestorage.googleapis.com/v0/b/${
          FIREBASE_CONFIG.storageBucket
        }/o/${encodeURIComponent(prefix.replace(/^\//, ""))}%2F${id}`;
        const response = await fetch(`${url}?alt=media`);
        if (response.status < 400) {
          const arrayBuffer = await response.arrayBuffer();

          const { data, metadata } = await decompressData<BinaryFileMetadata>(
            new Uint8Array(arrayBuffer),
            {
              decryptionKey,
            },
          );

          const dataURL = new TextDecoder().decode(data) as DataURL;

          loadedFiles.push({
            mimeType: metadata.mimeType || MIME_TYPES.binary,
            id,
            dataURL,
            created: metadata?.created || Date.now(),
            lastRetrieved: metadata?.created || Date.now(),
          });
        } else {
          erroredFiles.set(id, true);
        }
      } catch (error: any) {
        erroredFiles.set(id, true);
        console.error(error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};
