import type {
  LibraryMigrationAdapter,
  LibraryPersistenceAdapter,
} from "@excalidraw/excalidraw/data/library";

import { LibraryIndexedDBAdapter } from "../data/LocalData";

import { libraryApi } from "./notesApi";

/** Persists the shape library in SQLite, next to the notes. */
export const SQLiteLibraryAdapter: LibraryPersistenceAdapter = {
  load: () => libraryApi.load(),
  save: (data) => libraryApi.save(data),
};

/**
 * Moves the library previously stored in the browser (IndexedDB, used by the
 * original app) into SQLite on first load.
 */
export const IndexedDBLibraryMigrationAdapter: LibraryMigrationAdapter = {
  load: async () => {
    const data = await LibraryIndexedDBAdapter.load();
    return data?.libraryItems?.length ? data : null;
  },
  clear: () => LibraryIndexedDBAdapter.save({ libraryItems: [] }),
};
