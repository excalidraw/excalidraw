import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  increment,
  writeBatch,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  getBytes,
  deleteObject,
  listAll,
} from "firebase/storage";

import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";

import { FILE_CACHE_MAX_AGE_SEC } from "../app_constants";

import type { Client, Drawing } from "./types";

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
let firebaseAnalytics: ReturnType<typeof getAnalytics> | null = null;
let firestoreDb: ReturnType<typeof getFirestore> | null = null;
let firebaseStorage: ReturnType<typeof getStorage> | null = null;

const _initializeFirebase = () => {
  if (!firebaseApp) {
    firebaseApp = initializeApp(FIREBASE_CONFIG);
    try {
      if (typeof window !== "undefined") {
        firebaseAnalytics = getAnalytics(firebaseApp);
      }
    } catch (error) {
      console.warn("Failed to initialize Firebase Analytics", error);
    }
  }
  return firebaseApp;
};

const _getFirestore = () => {
  if (!firestoreDb) {
    firestoreDb = getFirestore(_initializeFirebase());
  }
  return firestoreDb;
};

const _getStorage = () => {
  if (!firebaseStorage) {
    firebaseStorage = getStorage(_initializeFirebase());
  }
  return firebaseStorage;
};

// -----------------------------------------------------------------------------
// Clients CRUD
// -----------------------------------------------------------------------------

export const getClients = async (): Promise<Client[]> => {
  const db = _getFirestore();
  const q = query(collection(db, "clients"), orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name,
    createdAt: doc.data().createdAt?.toDate() ?? new Date(),
    updatedAt: doc.data().updatedAt?.toDate() ?? new Date(),
    drawingCount: doc.data().drawingCount ?? 0,
  }));
};

export const createClient = async (name: string): Promise<Client> => {
  const db = _getFirestore();
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, "clients"), {
    name,
    createdAt: now,
    updatedAt: now,
    drawingCount: 0,
  });
  return {
    id: docRef.id,
    name,
    createdAt: now.toDate(),
    updatedAt: now.toDate(),
    drawingCount: 0,
  };
};

export const updateClient = async (id: string, name: string): Promise<void> => {
  const db = _getFirestore();
  await updateDoc(doc(db, "clients", id), {
    name,
    updatedAt: Timestamp.now(),
  });
};

export const deleteClient = async (id: string): Promise<void> => {
  const db = _getFirestore();

  // Delete all drawings subcollection docs
  const drawingsSnapshot = await getDocs(
    collection(db, "clients", id, "drawings"),
  );
  const batch = writeBatch(db);
  drawingsSnapshot.docs.forEach((drawingDoc) => {
    batch.delete(drawingDoc.ref);
  });
  batch.delete(doc(db, "clients", id));
  await batch.commit();

  // Clean up storage (best effort)
  try {
    const storage = _getStorage();
    const storageRef = ref(storage, `drawings/${id}`);
    const listResult = await listAll(storageRef);
    await Promise.all(listResult.items.map((itemRef) => deleteObject(itemRef)));
    // Also clean up nested prefixes
    for (const prefix of listResult.prefixes) {
      const nestedItems = await listAll(prefix);
      await Promise.all(
        nestedItems.items.map((itemRef) => deleteObject(itemRef)),
      );
    }
  } catch (error) {
    console.warn("Error cleaning up storage for client:", error);
  }
};

// -----------------------------------------------------------------------------
// Drawings CRUD
// -----------------------------------------------------------------------------

export const getDrawings = async (clientId: string): Promise<Drawing[]> => {
  const db = _getFirestore();
  const q = query(
    collection(db, "clients", clientId, "drawings"),
    orderBy("updatedAt", "desc"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name,
    createdAt: doc.data().createdAt?.toDate() ?? new Date(),
    updatedAt: doc.data().updatedAt?.toDate() ?? new Date(),
  }));
};

export const createDrawing = async (
  clientId: string,
  name: string,
): Promise<Drawing> => {
  const db = _getFirestore();
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, "clients", clientId, "drawings"), {
    name,
    createdAt: now,
    updatedAt: now,
  });

  // Increment client's drawing count
  await updateDoc(doc(db, "clients", clientId), {
    drawingCount: increment(1),
    updatedAt: now,
  });

  return {
    id: docRef.id,
    name,
    createdAt: now.toDate(),
    updatedAt: now.toDate(),
  };
};

export const updateDrawingMeta = async (
  clientId: string,
  drawingId: string,
  name: string,
): Promise<void> => {
  const db = _getFirestore();
  await updateDoc(doc(db, "clients", clientId, "drawings", drawingId), {
    name,
    updatedAt: Timestamp.now(),
  });
};

export const deleteDrawing = async (
  clientId: string,
  drawingId: string,
): Promise<void> => {
  const db = _getFirestore();
  await deleteDoc(doc(db, "clients", clientId, "drawings", drawingId));

  // Decrement client's drawing count
  await updateDoc(doc(db, "clients", clientId), {
    drawingCount: increment(-1),
    updatedAt: Timestamp.now(),
  });

  // Clean up storage (best effort)
  try {
    const storage = _getStorage();
    const sceneRef = ref(
      storage,
      `drawings/${clientId}/${drawingId}/scene.json`,
    );
    await deleteObject(sceneRef);

    const filesRef = ref(storage, `drawings/${clientId}/${drawingId}/files`);
    const listResult = await listAll(filesRef);
    await Promise.all(listResult.items.map((itemRef) => deleteObject(itemRef)));
  } catch (error) {
    console.warn("Error cleaning up storage for drawing:", error);
  }
};

// -----------------------------------------------------------------------------
// Scene persistence
// -----------------------------------------------------------------------------

export const saveScene = async (
  clientId: string,
  drawingId: string,
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
): Promise<void> => {
  const storage = _getStorage();

  // Serialize scene data as JSON
  const sceneData = JSON.stringify({
    elements,
    appState: {
      viewBackgroundColor: appState.viewBackgroundColor,
      name: appState.name,
    },
  });

  const sceneRef = ref(storage, `drawings/${clientId}/${drawingId}/scene.json`);
  const blob = new TextEncoder().encode(sceneData);
  await uploadBytes(sceneRef, blob, {
    contentType: "application/json",
    cacheControl: `public, max-age=${FILE_CACHE_MAX_AGE_SEC}`,
  });

  // Save binary files
  const fileEntries = Object.entries(files);
  if (fileEntries.length) {
    await Promise.all(
      fileEntries.map(async ([fileId, fileData]) => {
        try {
          const fileRef = ref(
            storage,
            `drawings/${clientId}/${drawingId}/files/${fileId}`,
          );
          // Store the file data as JSON (includes dataURL and metadata)
          const fileBlob = new TextEncoder().encode(JSON.stringify(fileData));
          await uploadBytes(fileRef, fileBlob, {
            contentType: "application/json",
            cacheControl: `public, max-age=${FILE_CACHE_MAX_AGE_SEC}`,
          });
        } catch (error) {
          console.warn(`Error saving file ${fileId}:`, error);
        }
      }),
    );
  }

  // Update drawing metadata timestamp
  const db = _getFirestore();
  await updateDoc(doc(db, "clients", clientId, "drawings", drawingId), {
    updatedAt: Timestamp.now(),
  });
};

export const loadScene = async (
  clientId: string,
  drawingId: string,
): Promise<{
  elements: ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
} | null> => {
  const storage = _getStorage();

  try {
    const sceneRef = ref(
      storage,
      `drawings/${clientId}/${drawingId}/scene.json`,
    );
    const sceneBytes = await getBytes(sceneRef);
    const sceneData = JSON.parse(new TextDecoder().decode(sceneBytes));

    // Load binary files
    const files: BinaryFiles = {};
    try {
      const filesRef = ref(storage, `drawings/${clientId}/${drawingId}/files`);
      const listResult = await listAll(filesRef);
      await Promise.all(
        listResult.items.map(async (itemRef) => {
          try {
            const fileBytes = await getBytes(itemRef);
            const fileData = JSON.parse(
              new TextDecoder().decode(fileBytes),
            ) as BinaryFileData;
            files[fileData.id] = fileData;
          } catch (error) {
            console.warn(`Error loading file ${itemRef.name}:`, error);
          }
        }),
      );
    } catch (error) {
      // No files directory yet — that's fine
    }

    return {
      elements: sceneData.elements || [],
      appState: sceneData.appState || {},
      files,
    };
  } catch (error) {
    // Scene doesn't exist yet
    return null;
  }
};
