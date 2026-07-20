import { createStore, del, get, set } from "idb-keyval";

import { compareConversationsByUpdatedAt } from "./chatHelpers";

import type { ChatConversation, TTAPersistenceAdapter } from "./types";

const ALL_CHATS_DB = "excalidraw-tta-all-chats";
const ALL_CHATS_STORE = "excalidraw-tta-all-chats-store";
const HISTORY_KEY = "all";

const historyStore = createStore(ALL_CHATS_DB, ALL_CHATS_STORE);

export const TTAIndexedDBAdapter: TTAPersistenceAdapter = {
  async loadHistory() {
    try {
      const history = await get<ChatConversation[]>(HISTORY_KEY, historyStore);
      return (history ?? []).sort(compareConversationsByUpdatedAt);
    } catch (error) {
      console.warn("Failed to load TTA chat history from IndexedDB:", error);
      return [];
    }
  },
  async saveHistory(history) {
    try {
      if (!history.length) {
        await del(HISTORY_KEY, historyStore);
        return;
      }
      await set(HISTORY_KEY, history, historyStore);
    } catch (error) {
      console.warn("Failed to save TTA chat history to IndexedDB:", error);
      throw error;
    }
  },
};
