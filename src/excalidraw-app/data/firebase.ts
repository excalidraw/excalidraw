import { ExcalidrawElement, FileId } from "../../element/types";
import { getSceneVersion } from "../../element";
import Portal from "../collab/Portal";
import { restoreElements } from "../../data/restore";
import { BinaryFileData, BinaryFileMetadata, DataURL } from "../../types";
import { FILE_CACHE_MAX_AGE_SEC } from "../app_constants";
import { decompressData } from "../../data/encode";
import { encryptData, decryptData } from "../../data/encryption";
import { MIME_TYPES } from "../../constants";

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
  const json = JSON.stringify(elements);
  const encoded = new TextEncoder().encode(json);
  const { encryptedBuffer, iv } = await encryptData(key, encoded);

  return { ciphertext: encryptedBuffer, iv };
};

const decryptElements = async (
  key: string,
  iv: Uint8Array,
  ciphertext: ArrayBuffer | Uint8Array,
): Promise<readonly ExcalidrawElement[]> => {
  const decrypted = await decryptData(iv, ciphertext, key);
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

export const saveToFirebase = async (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
) => {
  const { roomId, roomKey, socket } = portal;
  if (
    // if no room exists, consider the room saved because there's nothing we can
    // do at this point
    !roomId ||
    !roomKey ||
    !socket ||
    isSavedToFirebase(portal, elements)
  ) {
    return true;
  }

  const firebase = await loadFirestore();
  const sceneVersion = getSceneVersion(elements);
  const { ciphertext, iv } = await encryptElements(roomKey, elements);

  const nextDocData = {
    sceneVersion,
    ciphertext: firebase.firestore.Blob.fromUint8Array(
      new Uint8Array(ciphertext),
    ),
    iv: firebase.firestore.Blob.fromUint8Array(iv),
  } as FirebaseStoredScene;

  const db = firebase.firestore();
  const docRef = db.collection("scenes").doc(roomId);
  const didUpdate = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    if (!doc.exists) {
      transaction.set(docRef, nextDocData);
      return true;
    }

    const prevDocData = doc.data() as FirebaseStoredScene;
    if (prevDocData.sceneVersion >= nextDocData.sceneVersion) {
      return false;
    }

    transaction.update(docRef, nextDocData);
    return true;
  });

  if (didUpdate) {
    firebaseSceneVersionCache.set(socket, sceneVersion);
  }

  return didUpdate;
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
  const ciphertext = storedScene.ciphertext.toUint8Array();
  const iv = storedScene.iv.toUint8Array();

  const elements = await decryptElements(roomKey, iv, ciphertext);

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
