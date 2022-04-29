import { ExcalidrawElement, FileId } from "../../element/types";
import { getSceneVersion } from "../../element";
import Portal from "../collab/Portal";
import { restoreElements } from "../../data/restore";
import {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "../../types";
import {
  DELETED_ELEMENT_TIMEOUT,
  FILE_CACHE_MAX_AGE_SEC,
} from "../app_constants";
import { decompressData } from "../../data/encode";
import { encryptData, decryptData } from "../../data/encryption";
import { MIME_TYPES } from "../../constants";
import { reconcileElements } from "../collab/reconciliation";
import { getUpdatedTimestamp } from "../../utils";

// private
// -----------------------------------------------------------------------------

let FIREBASE_CONFIG: Record<string, any>;
try {
  FIREBASE_CONFIG = JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG);
} catch (error: any) {
  console.warn(
    `Error JSON parsing firebase config. Supplied value: ${process.env.REACT_APP_FIREBASE_CONFIG}`,
  );
  FIREBASE_CONFIG = {};
}

let firebasePromise: Promise<typeof import("firebase/app").default> | null =
  null;
let firestorePromise: Promise<any> | null | true = null;
let firebaseStoragePromise: Promise<any> | null | true = null;

let isFirebaseInitialized = false;

const _loadFirebase = async () => {
  const firebase = (
    await import(/* webpackChunkName: "firebase" */ "firebase/app")
  ).default;

  if (!isFirebaseInitialized) {
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
    } catch (error: any) {
      // trying initialize again throws. Usually this is harmless, and happens
      // mainly in dev (HMR)
      if (error.code === "app/duplicate-app") {
        console.warn(error.name, error.code);
      } else {
        throw error;
      }
    }
    isFirebaseInitialized = true;
  }

  return firebase;
};

const _getFirebase = async (): Promise<
  typeof import("firebase/app").default
> => {
  if (!firebasePromise) {
    firebasePromise = _loadFirebase();
  }
  return firebasePromise;
};

// -----------------------------------------------------------------------------

const loadFirestore = async () => {
  const firebase = await _getFirebase();
  if (!firestorePromise) {
    firestorePromise = import(
      /* webpackChunkName: "firestore" */ "firebase/firestore"
    );
  }
  if (firestorePromise !== true) {
    await firestorePromise;
    firestorePromise = true;
  }
  return firebase;
};

export const loadFirebaseStorage = async () => {
  const firebase = await _getFirebase();
  if (!firebaseStoragePromise) {
    firebaseStoragePromise = import(
      /* webpackChunkName: "storage" */ "firebase/storage"
    );
  }
  if (firebaseStoragePromise !== true) {
    await firebaseStoragePromise;
    firebaseStoragePromise = true;
  }
  return firebase;
};

interface FirebaseStoredScene {
  sceneVersion: number;
  iv: firebase.default.firestore.Blob;
  ciphertext: firebase.default.firestore.Blob;
}

const encryptElements = async (
  key: string,
  elements: readonly ExcalidrawElement[],
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> => {
  const json = JSON.stringify(
    elements.filter(
      (el) =>
        !el.isDeleted ||
        el.updated >= getUpdatedTimestamp() - DELETED_ELEMENT_TIMEOUT,
    ),
  );
  const encoded = new TextEncoder().encode(json);
  const { encryptedBuffer, iv } = await encryptData(key, encoded);

  return { ciphertext: encryptedBuffer, iv };
};

const decryptElements = async (
  data: FirebaseStoredScene,
  roomKey: string,
): Promise<readonly ExcalidrawElement[]> => {
  const ciphertext = data.ciphertext.toUint8Array();
  const iv = data.iv.toUint8Array();

  const decrypted = await decryptData(iv, ciphertext, roomKey);
  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  return JSON.parse(decodedData);
};

const firebaseSceneVersionCache = new WeakMap<SocketIOClient.Socket, number>();

export const isSavedToFirebase = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);

    return firebaseSceneVersionCache.get(portal.socket) === sceneVersion;
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
  const firebase = await loadFirebaseStorage();

  const erroredFiles = new Map<FileId, true>();
  const savedFiles = new Map<FileId, true>();

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        await firebase
          .storage()
          .ref(`${prefix}/${id}`)
          .put(
            new Blob([buffer], {
              type: MIME_TYPES.binary,
            }),
            {
              cacheControl: `public, max-age=${FILE_CACHE_MAX_AGE_SEC}`,
            },
          );
        savedFiles.set(id, true);
      } catch (error: any) {
        erroredFiles.set(id, true);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

const createFirebaseSceneDocument = async (
  firebase: ResolutionType<typeof loadFirestore>,
  elements: readonly ExcalidrawElement[],
  roomKey: string,
) => {
  const sceneVersion = getSceneVersion(elements);
  const { ciphertext, iv } = await encryptElements(roomKey, elements);
  return {
    sceneVersion,
    ciphertext: firebase.firestore.Blob.fromUint8Array(
      new Uint8Array(ciphertext),
    ),
    iv: firebase.firestore.Blob.fromUint8Array(iv),
  } as FirebaseStoredScene;
};

export const saveToFirebase = async (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
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
    return false;
  }

  const firebase = await loadFirestore();
  const firestore = firebase.firestore();

  const docRef = firestore.collection("scenes").doc(roomId);

  const savedData = await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);

    if (!snapshot.exists) {
      const sceneDocument = await createFirebaseSceneDocument(
        firebase,
        elements,
        roomKey,
      );

      transaction.set(docRef, sceneDocument);

      return {
        sceneVersion: sceneDocument.sceneVersion,
        reconciledElements: null,
      };
    }

    const prevDocData = snapshot.data() as FirebaseStoredScene;
    const prevElements = await decryptElements(prevDocData, roomKey);

    const reconciledElements = reconcileElements(
      elements,
      prevElements,
      appState,
    );

    const sceneDocument = await createFirebaseSceneDocument(
      firebase,
      reconciledElements,
      roomKey,
    );

    transaction.update(docRef, sceneDocument);
    return {
      reconciledElements,
      sceneVersion: sceneDocument.sceneVersion,
    };
  });

  firebaseSceneVersionCache.set(socket, savedData.sceneVersion);

  return savedData;
};

export const loadFromFirebase = async (
  roomId: string,
  roomKey: string,
  socket: SocketIOClient.Socket | null,
): Promise<readonly ExcalidrawElement[] | null> => {
  const firebase = await loadFirestore();
  const db = firebase.firestore();

  const docRef = db.collection("scenes").doc(roomId);
  const doc = await docRef.get();
  if (!doc.exists) {
    return null;
  }
  const storedScene = doc.data() as FirebaseStoredScene;
  const elements = await decryptElements(storedScene, roomKey);

  if (socket) {
    firebaseSceneVersionCache.set(socket, getSceneVersion(elements));
  }

  return restoreElements(elements, null);
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
