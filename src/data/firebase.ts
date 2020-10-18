import { createIV, getImportedKey } from "./index";
import { ExcalidrawElement } from "../element/types";
import { getSceneVersion } from "../element";
import Portal from "../components/Portal";

let firebasePromise: Promise<typeof import("firebase/app")> | null = null;

async function loadFirebase() {
  const firebase = await import(
    /* webpackChunkName: "firebase" */ "firebase/app"
  );
  await import(/* webpackChunkName: "firestore" */ "firebase/firestore");

  const firebaseConfig = JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG);
  firebase.initializeApp(firebaseConfig);

  return firebase;
}

async function getFirebase(): Promise<typeof import("firebase/app")> {
  if (!firebasePromise) {
    firebasePromise = loadFirebase();
  }
  const firebase = await firebasePromise!;
  return firebase;
}

interface FirebaseStoredScene {
  sceneVersion: number;
  iv: firebase.firestore.Blob;
  ciphertext: firebase.firestore.Blob;
}

async function encryptElements(
  key: string,
  elements: readonly ExcalidrawElement[],
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
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
}

async function decryptElements(
  key: string,
  iv: Uint8Array,
  ciphertext: ArrayBuffer,
): Promise<readonly ExcalidrawElement[]> {
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
}

const firebaseSceneVersionCache = new WeakMap<SocketIOClient.Socket, number>();

export const isSavedToFirebase = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomID && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);
    return firebaseSceneVersionCache.get(portal.socket) === sceneVersion;
  }
  // if no room exists, consider the room saved so that we don't unnecessarily
  //  prevent unload (there's nothing we could do at that point anyway)
  return true;
};

export async function saveToFirebase(
  portal: Portal,
  elements: readonly ExcalidrawElement[],
) {
  const { roomID, roomKey, socket } = portal;
  if (
    // if no room exists, consider the room saved because there's nothing we can
    //  do at this point
    !roomID ||
    !roomKey ||
    !socket ||
    isSavedToFirebase(portal, elements)
  ) {
    return true;
  }

  const firebase = await getFirebase();
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
  const docRef = db.collection("scenes").doc(roomID);
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
}

export async function loadFromFirebase(
  roomID: string,
  roomKey: string,
): Promise<readonly ExcalidrawElement[] | null> {
  const firebase = await getFirebase();
  const db = firebase.firestore();

  const docRef = db.collection("scenes").doc(roomID);
  const doc = await docRef.get();
  if (!doc.exists) {
    return null;
  }
  const storedScene = doc.data() as FirebaseStoredScene;
  const ciphertext = storedScene.ciphertext.toUint8Array();
  const iv = storedScene.iv.toUint8Array();
  const plaintext = await decryptElements(roomKey, iv, ciphertext);
  return plaintext;
}
