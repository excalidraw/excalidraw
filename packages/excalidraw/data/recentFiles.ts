import { EDITOR_LS_KEYS } from "@excalidraw/common";
import { EditorLocalStorage } from "./EditorLocalStorage";
import type { FileSystemHandle, CapacitorFileHandle } from "./filesystem";

const RECENT_FILES_LIMIT = 10;
const DB_NAME = "ExcalidrawRecentFiles";
const STORE_NAME = "handles";

export interface RecentFileMetadata {
    id: string;
    name: string;
    timestamp: number;
}

/**
 * Open or create the IndexedDB database for recent file handles.
 */
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Track a file handle as recently used.
 */
export const trackRecentFile = async (handle: FileSystemHandle | CapacitorFileHandle) => {
    if (!handle || !handle.name) {
        return;
    }

    const id = handle.name + "_" + Date.now(); // Cheap unique ID
    const metadata: RecentFileMetadata = {
        id,
        name: handle.name,
        timestamp: Date.now(),
    };

    // 1. Update metadata in localStorage
    const currentRecent = getRecentFiles();

    // Check for duplicates by handle identity
    const isCapacitor = "uri" in handle;
    const filteredRecent = currentRecent.filter((f) => {
        // If it's the exact same ID, it's definitely a duplicate
        if (f.id === id) return false;

        // If we have a Capacitor handle, we can check by URI if we stored it
        // For now, names are still the best we have for Web handles without stable IDs
        return f.name !== handle.name;
    });

    const newRecent = [metadata, ...filteredRecent].slice(0, RECENT_FILES_LIMIT);
    EditorLocalStorage.set(EDITOR_LS_KEYS.RECENT_FILES as any, newRecent);

    // 2. Save handle in IndexedDB
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        // Cleanup old handles in IDB that are no longer in metadata
        const idsToKeep = new Set(newRecent.map(f => f.id));

        // Store current handle
        store.put(handle, id);

        // cleanup pass
        transaction.oncomplete = async () => {
            const cleanupTx = db.transaction(STORE_NAME, "readwrite");
            const cleanupStore = cleanupTx.objectStore(STORE_NAME);
            const keysReq = cleanupStore.getAllKeys();
            keysReq.onsuccess = () => {
                const keys = keysReq.result;
                keys.forEach(key => {
                    if (!idsToKeep.has(key as string)) {
                        cleanupStore.delete(key);
                    }
                });
            };
        };

    } catch (error) {
        console.warn("Failed to save file handle to IndexedDB:", error);
    }
};

/**
 * Retrieve the list of recent file metadata from localStorage.
 */
export const getRecentFiles = (): RecentFileMetadata[] => {
    return EditorLocalStorage.get<RecentFileMetadata[]>(EDITOR_LS_KEYS.RECENT_FILES as any) || [];
};

/**
 * Retrieve a FileSystemHandle or CapacitorFileHandle from IndexedDB by its ID.
 */
export const getRecentFileHandle = async (id: string): Promise<FileSystemHandle | CapacitorFileHandle | null> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error("Failed to retrieve file handle from IndexedDB:", error);
        return null;
    }
};

/**
 * Clear all recent files.
 */
export const clearRecentFiles = async () => {
    EditorLocalStorage.delete(EDITOR_LS_KEYS.RECENT_FILES as any);
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).clear();
    } catch (error) {
        console.error("Failed to clear recent files in IndexedDB:", error);
    }
};
