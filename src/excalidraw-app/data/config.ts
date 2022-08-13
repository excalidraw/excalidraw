import {
  isSavedToFirebase,
  loadFilesFromFirebase,
  loadFromFirebase,
  saveFilesToFirebase,
  saveToFirebase,
} from "./firebase";
import {
  isSavedToHttpStorage,
  loadFilesFromHttpStorage,
  loadFromHttpStorage,
  saveFilesToHttpStorage,
  saveToHttpStorage,
} from "./httpStorage";
import { StorageBackend } from "./StorageBackend";

const firebaseStorage: StorageBackend = {
  isSaved: isSavedToFirebase,
  saveToStorageBackend: saveToFirebase,
  loadFromStorageBackend: loadFromFirebase,
  saveFilesToStorageBackend: saveFilesToFirebase,
  loadFilesFromStorageBackend: loadFilesFromFirebase,
};

const httpStorage: StorageBackend = {
  isSaved: isSavedToHttpStorage,
  saveToStorageBackend: saveToHttpStorage,
  loadFromStorageBackend: loadFromHttpStorage,
  saveFilesToStorageBackend: saveFilesToHttpStorage,
  loadFilesFromStorageBackend: loadFilesFromHttpStorage,
};

const storageBackends = new Map<string, StorageBackend>()
  .set("firebase", firebaseStorage)
  .set("http", httpStorage);

export let storageBackend: StorageBackend | null = null;

export async function getStorageBackend() {
  if (storageBackend) {
    return storageBackend;
  }

  const storageBackendName = process.env.REACT_APP_STORAGE_BACKEND || "";

  if (storageBackends.has(storageBackendName)) {
    storageBackend = storageBackends.get(storageBackendName) as StorageBackend;
  } else {
    console.warn("No storage backend found, default to firebase");
    storageBackend = firebaseStorage;
  }

  return storageBackend;
}
