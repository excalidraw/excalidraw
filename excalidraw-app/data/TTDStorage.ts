import { createStore, get, set } from "idb-keyval";

import type { SavedChats } from "@excalidraw/excalidraw/components/TTDDialog/types";

import { STORAGE_KEYS } from "../app_constants";

/**
 * IndexedDB adapter for TTD chat storage.
 * Implements TTDPersistenceAdapter interface.
 */
export class TTDIndexedDBAdapter {
  /** IndexedDB database name */
  private static idb_name = STORAGE_KEYS.IDB_TTD_CHATS;
  /** Store key for chat data */
  private static key = "ttdChats";

  private static store = createStore(
    `${TTDIndexedDBAdapter.idb_name}-db`,
    `${TTDIndexedDBAdapter.idb_name}-store`,
  );

  /**
   * Load saved chats from IndexedDB.
   * @returns Promise resolving to saved chats array (empty if none found)
   */
  static async loadChats(): Promise<SavedChats> {
    try {
      const data = await get<SavedChats>(
        TTDIndexedDBAdapter.key,
        TTDIndexedDBAdapter.store,
      );
      return data || [];
    } catch (error) {
      console.warn("Failed to load TTD chats from IndexedDB:", error);
      return [];
    }
  }

  /**
   * Save chats to IndexedDB.
   * @param chats - The chats array to persist
   */
  static async saveChats(chats: SavedChats): Promise<void> {
    try {
      await set(TTDIndexedDBAdapter.key, chats, TTDIndexedDBAdapter.store);
    } catch (error) {
      console.warn("Failed to save TTD chats to IndexedDB:", error);
      throw error;
    }
  }
}
