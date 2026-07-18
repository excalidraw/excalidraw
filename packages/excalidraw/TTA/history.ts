import { createStore, del, entries, set } from "idb-keyval";

import { compareConversationsByUpdatedAt } from "./chatHelpers";

import type { ChatConversation, TTAPersistenceAdapter } from "./types";

const ALL_CHATS_DB = "excalidraw-tta-all-chats";
const ALL_CHATS_STORE = "excalidraw-tta-all-chats-store";

const chatsStore = createStore(ALL_CHATS_DB, ALL_CHATS_STORE);

const isChatConversation = (value: unknown): value is ChatConversation =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as ChatConversation).id === "string" &&
  Array.isArray((value as ChatConversation).messages);

/**
 * Per-chat persistence: one IndexedDB entry per chat, keyed by the chat id, so
 * saving the active chat never rewrites (or clobbers) the others.
 */
export const TTAIndexedDBAdapter: TTAPersistenceAdapter = {
  async loadChats() {
    try {
      const storedChats = await entries<string, unknown>(chatsStore);
      return storedChats
        .map(([, chat]) => chat)
        .filter(isChatConversation)
        .sort(compareConversationsByUpdatedAt);
    } catch (error) {
      console.warn("Failed to load TTA chats from IndexedDB:", error);
      return [];
    }
  },
  async saveChat(chat) {
    try {
      await set(chat.id, chat, chatsStore);
    } catch (error) {
      console.warn("Failed to save TTA chat to IndexedDB:", error);
      throw error;
    }
  },
  async deleteChat(id) {
    try {
      await del(id, chatsStore);
    } catch (error) {
      console.warn("Failed to delete TTA chat from IndexedDB:", error);
      throw error;
    }
  },
};
