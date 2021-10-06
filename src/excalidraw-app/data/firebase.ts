import { ExcalidrawElement, ImageId } from "../../element/types";
import { getSceneVersion } from "../../element";
import Portal from "../collab/Portal";
import { restoreElements } from "../../data/restore";
import { BinaryFileData, DataURL } from "../../types";
import { FILE_CACHE_MAX_AGE_SEC } from "../app_constants";
import { compressData, decompressData } from "../../data/encode";
import { getImportedKey, createIV } from "../../data/encryption";

// private
// -----------------------------------------------------------------------------

const FIREBASE_CONFIG = JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG);

let firebasePromise: Promise<
  typeof import("firebase/app").default
> | null = null;
let firestorePromise: Promise<any> | null | true = null;
let firebseStoragePromise: Promise<any> | null | true = null;

let isFirebaseInitialized = false;

const _loadFirebase = async () => {
  const firebase = (
    await import(/* webpackChunkName: "firebase" */ "firebase/app")
  ).default;

  if (!isFirebaseInitialized) {
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
    } catch (error) {
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
  if (!firebseStoragePromise) {
    firebseStoragePromise = import(
      /* webpackChunkName: "storage" */ "firebase/storage"
    );
  }
  if (firebseStoragePromise !== true) {
    await firebseStoragePromise;
    firebseStoragePromise = true;
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
  const importedKey = await getImportedKey(key, "encrypt");
  const iv = createIV();
  const json = JSON.stringify(elements);
  const encoded = new TextEncoder().encode(json);
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    importedKey,
    encoded,
  );

  return { ciphertext, iv };
};

const decryptElements = async (
  key: string,
  iv: Uint8Array,
  ciphertext: ArrayBuffer,
): Promise<readonly ExcalidrawElement[]> => {
  const importedKey = await getImportedKey(key, "decrypt");
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    importedKey,
    ciphertext,
  );

  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted) as any,
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

const getDataURLMimeType = (dataURL: DataURL): string => {
  return dataURL.split(",")[0].split(":")[1].split(";")[0];
};

const getFileTypeFromMimeType = (mimeType: string): BinaryFileData["type"] => {
  return mimeType.includes("image/") ? "image" : "other";
};

type BinaryFileMetadata = Omit<BinaryFileData, "dataURL">;

export const saveFilesToFirebase = async ({
  prefix,
  encryptionKey,
  files,
  allowedTypes,
  maxBytes,
}: {
  prefix: string;
  encryptionKey: string;
  files: Map<ImageId, DataURL>;
  allowedTypes: string[];
  maxBytes: number;
}) => {
  const firebase = await loadFirebaseStorage();
  const filesToUpload = [...files].map(([id, dataURL]) => {
    const mimeType = getDataURLMimeType(dataURL);

    if (!allowedTypes.includes(mimeType)) {
      throw new Error("Disallowed file type.");
    }

    const bufferView = new TextEncoder().encode(dataURL);

    if (bufferView.byteLength > maxBytes) {
      throw new Error(`File cannot be larger than ${maxBytes / 1024} kB.`);
    }

    return { bufferView, id, mimeType };
  });

  const erroredFiles = new Map<ImageId, true>();
  const savedFiles = new Map<ImageId, true>();

  await Promise.all(
    filesToUpload.map(async ({ id, bufferView, mimeType }) => {
      const encodedFile = await compressData<BinaryFileMetadata>(bufferView, {
        encryptionKey,
        metadata: {
          id,
          type: mimeType.includes("image/") ? "image" : "other",
          created: Date.now(),
        },
      });
      try {
        await firebase
          .storage()
          .ref(`${prefix}/${id}`)
          .put(
            new Blob([new Uint8Array(encodedFile)], {
              type: mimeType,
            }),
            {
              cacheControl: `public, max-age=${FILE_CACHE_MAX_AGE_SEC}`,
              // this is Firebase Storage file metadata, not encoded into the
              // file itself
              customMetadata: {
                data: JSON.stringify({
                  version: 1,
                  filename: id,
                  type: mimeType,
                }),
                created: Date.now().toString(),
              },
            },
          );
        savedFiles.set(id, true);
      } catch (error) {
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
  filesIds: readonly ImageId[],
): Promise<{
  loadedFiles: BinaryFileData[];
  erroredFiles: ImageId[];
}> => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles: ImageId[] = [];

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
            type:
              metadata?.type ||
              getFileTypeFromMimeType(
                response.headers.get("content-type") ||
                  getDataURLMimeType(dataURL),
              ),
            id,
            dataURL,
            created: metadata?.created || Date.now(),
          });
        }
      } catch (error) {
        erroredFiles.push(id);
        console.error(error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};
