import { getImportedKey } from "./index";
import * as firebase from "firebase/app";
import "firebase/firestore";
import { ExcalidrawElement } from "../element/types";
import { getDrawingVersion } from "../element";

const firebaseConfig = JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG);

firebase.initializeApp(firebaseConfig);

interface FirebaseStoredDrawing {
  drawingVersion: number;
  ciphertext: firebase.firestore.Blob;
}

const EMPTY_IV = new Uint8Array(12);

async function encryptElements(
  key: string,
  elements: readonly ExcalidrawElement[],
): Promise<ArrayBuffer> {
  const importedKey = await getImportedKey(key, "encrypt");
  const iv = EMPTY_IV;
  const json = JSON.stringify(elements);
  const encoded = new TextEncoder().encode(json);
  return await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    importedKey,
    encoded,
  );
}

async function decryptElements(
  key: string,
  ciphertext: ArrayBuffer,
): Promise<readonly ExcalidrawElement[]> {
  const importedKey = await getImportedKey(key, "decrypt");
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: EMPTY_IV,
    },
    importedKey,
    ciphertext,
  );

  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted) as any,
  );
  return JSON.parse(decodedData);
}

export async function saveToFirebase(
  roomId: string,
  roomSecret: string,
  elements: readonly ExcalidrawElement[],
) {
  const drawingVersion = getDrawingVersion(elements);
  const ciphertext = await encryptElements(roomSecret, elements);

  const nextDocData = {
    drawingVersion,
    ciphertext: firebase.firestore.Blob.fromUint8Array(
      new Uint8Array(ciphertext),
    ),
  } as FirebaseStoredDrawing;

  const db = firebase.firestore();
  const docRef = db.collection("drawings").doc(roomId);
  const didUpdate = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    if (!doc.exists) {
      transaction.set(docRef, nextDocData);
      return true;
    }

    const prevDocData = doc.data() as FirebaseStoredDrawing;
    if (prevDocData.drawingVersion >= nextDocData.drawingVersion) {
      return false;
    }

    transaction.update(docRef, nextDocData);
    return true;
  });

  return didUpdate;
}

export async function loadFromFirebase(
  roomId: string,
  roomSecret: string,
): Promise<readonly ExcalidrawElement[] | null> {
  const db = firebase.firestore();

  const docRef = db.collection("drawings").doc(roomId);
  const doc = await docRef.get();
  if (!doc.exists) {
    return null;
  }
  const ciphertext = (doc.data() as FirebaseStoredDrawing).ciphertext.toUint8Array();
  const plaintext = await decryptElements(roomSecret, ciphertext);
  return plaintext;
}
