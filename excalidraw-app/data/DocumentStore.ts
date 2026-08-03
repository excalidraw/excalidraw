/**
 * Per-document content store backed by IndexedDB.
 *
 * Each tab in the multitab feature is an independent drawing whose
 * `{ elements, appState }` payload lives here, keyed by tab id.
 * Files (BinaryFileData) intentionally stay in the global `files-db` store
 * since FileIds are globally unique and may be referenced from many drawings.
 */

import { createStore, del, get, set } from "idb-keyval";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";

export type DocumentContent = {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
};

const documentsStore = createStore(
  `${STORAGE_KEYS.IDB_DOCUMENTS}-db`,
  `${STORAGE_KEYS.IDB_DOCUMENTS}-store`,
);

export class DocumentStore {
  static async loadDocument(id: string): Promise<DocumentContent | null> {
    try {
      const data = await get<DocumentContent>(id, documentsStore);
      if (!data) {
        return null;
      }
      return {
        elements: Array.isArray(data.elements) ? data.elements : [],
        appState: data.appState ?? {},
      };
    } catch (error) {
      console.error("[DocumentStore] loadDocument failed", error);
      return null;
    }
  }

  static async saveDocument(
    id: string,
    content: DocumentContent,
  ): Promise<void> {
    await set(
      id,
      {
        elements: content.elements,
        appState: content.appState,
      },
      documentsStore,
    );
  }

  static async deleteDocument(id: string): Promise<void> {
    try {
      await del(id, documentsStore);
    } catch (error) {
      console.error("[DocumentStore] deleteDocument failed", error);
    }
  }
}
