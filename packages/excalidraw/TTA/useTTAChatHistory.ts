import { useCallback, useEffect, useMemo, useRef } from "react";

import { atom, useAtom } from "../editor-jotai";
import { useI18n } from "../i18n";

import {
  compareConversationsByUpdatedAt,
  getConversationTitle,
} from "./chatHelpers";
import { evictAssistantPreviews } from "./useAIAssistantPreview";

import type {
  ChatConversation,
  ChatMessage,
  TTAPersistenceAdapter,
} from "./types";

const ttaChatHistoryAtom = atom<ChatConversation[]>([]);
const ttaActiveChatIdAtom = atom("");
const ttaActiveChatUpdatedAtAtom = atom<number | null>(null);

const AUTO_SAVE_DEBOUNCE_MS = 500;

/**
 * Persistence policy (tta_rewrite_final.md §2.5): user messages and *terminal*
 * assistant messages only. Streaming bubbles are never serialized (a reload
 * mid-generation yields a prompt-only turn) and session-scoped rate-limit
 * warnings are dropped.
 */
const isPersistableMessage = (message: ChatMessage) =>
  message.role === "user" ||
  (message.role === "assistant" && message.status.kind !== "streaming");

const areSameMessages = (
  a: readonly ChatMessage[],
  b: readonly ChatMessage[],
) => a.length === b.length && a.every((message, index) => message === b[index]);

type UseTTAChatHistoryOptions = {
  chatMessages: ChatMessage[];
  persistenceAdapter: TTAPersistenceAdapter;
};

type SaveConversationToHistoryOptions = {
  updatedAt?: number | null;
};

export const useTTAChatHistory = ({
  chatMessages,
  persistenceAdapter,
}: UseTTAChatHistoryOptions) => {
  const { t } = useI18n();
  const [chatHistory, setChatHistory] = useAtom(ttaChatHistoryAtom);
  const [activeChatId, setActiveChatId] = useAtom(ttaActiveChatIdAtom);
  const [activeChatUpdatedAt, setActiveChatUpdatedAt] = useAtom(
    ttaActiveChatUpdatedAtAtom,
  );

  // Identity-stable persistable subset: streaming skeleton patches replace
  // only the streaming bubble (filtered out here), so the auto-save effect
  // below doesn't re-serialize the chat on every partial.
  const persistableMessagesRef = useRef<ChatMessage[]>([]);
  const persistableMessages = useMemo(() => {
    const next = chatMessages.filter(isPersistableMessage);
    if (areSameMessages(persistableMessagesRef.current, next)) {
      return persistableMessagesRef.current;
    }
    persistableMessagesRef.current = next;
    return next;
  }, [chatMessages]);

  const persistChat = useCallback(
    async (chat: ChatConversation) => {
      try {
        await persistenceAdapter.saveChat(chat);
      } catch (error) {
        console.warn("[AI Chat] Failed to save chat:", error);
      }
    },
    [persistenceAdapter],
  );

  /**
   * Upserts the chat's history row and persists it. Only ever writes the one
   * chat it was called with — per-chat keys mean other chats stay untouched.
   * No-ops when the row is already up to date (this is what terminates the
   * save → history-change → save feedback loop).
   */
  const saveConversationToHistory = useCallback(
    (
      chatId: string,
      messages: ChatMessage[],
      options?: SaveConversationToHistoryOptions,
    ) => {
      if (!chatId) {
        return;
      }
      const persistable = messages.filter(isPersistableMessage);
      if (!persistable.length) {
        return;
      }

      const existingEntry =
        chatHistory.find((conversation) => conversation.id === chatId) ?? null;
      const autoTitle = getConversationTitle(
        persistable,
        t("ai.chat.untitledChat"),
      );
      const incomingUpdatedAt =
        typeof options?.updatedAt === "number"
          ? options.updatedAt
          : chatId === activeChatId && typeof activeChatUpdatedAt === "number"
          ? activeChatUpdatedAt
          : null;
      const updatedAt =
        incomingUpdatedAt ?? existingEntry?.updatedAt ?? Date.now();
      const title = existingEntry?.title || autoTitle;

      if (
        existingEntry &&
        existingEntry.title === title &&
        existingEntry.updatedAt === updatedAt &&
        areSameMessages(existingEntry.messages, persistable)
      ) {
        return;
      }

      const entry: ChatConversation = {
        id: chatId,
        title,
        messages: persistable,
        updatedAt,
      };

      setChatHistory((prev) => {
        const existingIndex = prev.findIndex(
          (conversation) => conversation.id === chatId,
        );
        if (existingIndex > -1) {
          const copy = [...prev];
          copy[existingIndex] = entry;
          return copy;
        }
        return [entry, ...prev];
      });
      void persistChat(entry);
    },
    [
      activeChatId,
      activeChatUpdatedAt,
      chatHistory,
      persistChat,
      setChatHistory,
      t,
    ],
  );

  // Hydrate once per adapter; merge by id + updatedAt instead of replacing so
  // a chat being written concurrently (or already updated in this session)
  // isn't clobbered by a stale stored copy.
  useEffect(() => {
    let isCancelled = false;

    (async () => {
      try {
        const storedChats = await persistenceAdapter.loadChats();
        if (isCancelled || !storedChats) {
          return;
        }
        setChatHistory((prev) => {
          const prevById = new Map(prev.map((chat) => [chat.id, chat]));
          const storedIds = new Set(storedChats.map((chat) => chat.id));
          const merged = storedChats.map((stored) => {
            const existing = prevById.get(stored.id);
            return existing && existing.updatedAt >= stored.updatedAt
              ? existing
              : stored;
          });
          return [
            ...prev.filter((chat) => !storedIds.has(chat.id)),
            ...merged,
          ].sort(compareConversationsByUpdatedAt);
        });
      } catch (error) {
        console.warn("[AI Chat] Failed to load history:", error);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [persistenceAdapter, setChatHistory]);

  // Auto-save the active chat. Gated on `activeChatId`: a brand-new chat is
  // buffered in memory until `started` delivers the server chat id, so its
  // history row is only ever created under the real id.
  useEffect(() => {
    if (!persistableMessages.length || !activeChatId) {
      return;
    }

    const timer = setTimeout(() => {
      saveConversationToHistory(activeChatId, persistableMessages);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [activeChatId, persistableMessages, saveConversationToHistory]);

  const renameChat = useCallback(
    (chatId: string, newTitle: string) => {
      const existing = chatHistory.find((chat) => chat.id === chatId);
      if (!existing) {
        return;
      }
      const renamed: ChatConversation = { ...existing, title: newTitle };
      setChatHistory((prev) =>
        prev.map((chat) => (chat.id === chatId ? renamed : chat)),
      );
      void persistChat(renamed);
    },
    [chatHistory, persistChat, setChatHistory],
  );

  /**
   * Touches a chat's history-row `updatedAt` in memory (if the row exists).
   * Does not persist by itself — the row is written by the save paths.
   * Unlike `applyServerChatMetadata` this never touches the active-chat
   * mirror, so it is safe for chats that are not currently displayed (a
   * backgrounded generation's chat).
   */
  const touchChatUpdatedAt = useCallback(
    (chatId: string, updatedAt: number) => {
      setChatHistory((prev) => {
        const existingIndex = prev.findIndex((chat) => chat.id === chatId);
        if (
          existingIndex === -1 ||
          prev[existingIndex].updatedAt === updatedAt
        ) {
          return prev;
        }
        const copy = [...prev];
        copy[existingIndex] = { ...copy[existingIndex], updatedAt };
        return copy;
      });
    },
    [setChatHistory],
  );

  /**
   * Adopts server chat metadata delivered by stream frames (`started`/`done`)
   * and truncate responses (tta_rewrite_final.md §2.5): adopts the server
   * chat id — a brand-new chat is buffered in memory until then (the
   * auto-save below gates on a non-empty active id), so its history row is
   * only ever created under the real server id — and touches `updatedAt` in
   * both the active-chat mirror and the chat's history row.
   */
  const applyServerChatMetadata = useCallback(
    (metadata: { chatId?: string | null; updatedAt?: number | null }) => {
      const nextChatId = metadata.chatId;
      if (nextChatId) {
        setActiveChatId((prev) => (prev === nextChatId ? prev : nextChatId));
      }
      if (typeof metadata.updatedAt === "number") {
        const updatedAt = metadata.updatedAt;
        setActiveChatUpdatedAt(updatedAt);
        const targetChatId = nextChatId || activeChatId;
        if (targetChatId) {
          touchChatUpdatedAt(targetChatId, updatedAt);
        }
      }
    },
    [activeChatId, setActiveChatId, setActiveChatUpdatedAt, touchChatUpdatedAt],
  );

  /**
   * Persists a NON-active chat's row — the one exception to the "only the
   * active chat is written" policy (tta_rewrite_final.md §2.5): a generation
   * that reached a terminal status while its chat was backgrounded (chat
   * switch mid-stream) writes its origin chat's row through here. Delegates
   * to the normal save path, so terminal-only message filtering, title
   * derivation, and updatedAt semantics all match the active-chat auto-save.
   * `chat.title` is advisory only — an existing row keeps its title, a new
   * row derives one from the first user message.
   */
  const saveBackgroundChat = useCallback(
    (chat: ChatConversation) => {
      saveConversationToHistory(chat.id, chat.messages, {
        updatedAt: chat.updatedAt,
      });
    },
    [saveConversationToHistory],
  );

  /** Stamps "now" on the active chat (mirror + history row) — used by local
   * mutations (send, stop, retry, delete). */
  const touchActiveChatUpdatedAt = useCallback(() => {
    applyServerChatMetadata({ updatedAt: Date.now() });
  }, [applyServerChatMetadata]);

  const deleteChat = useCallback(
    (chatId: string) => {
      if (!chatId) {
        return;
      }
      // M7: drop the deleted chat's thumbnails from the preview LRU cache
      const chat = chatHistory.find((entry) => entry.id === chatId);
      if (chat) {
        evictAssistantPreviews(
          chat.messages
            .filter((chatMessage) => chatMessage.role === "assistant")
            .map((chatMessage) => chatMessage.id),
        );
      }
      setChatHistory((prev) => prev.filter((entry) => entry.id !== chatId));
      void persistenceAdapter.deleteChat(chatId).catch((error) => {
        console.warn("[AI Chat] Failed to delete chat:", error);
      });
    },
    [chatHistory, persistenceAdapter, setChatHistory],
  );

  const latestHistoryChat = useMemo(() => {
    if (!chatHistory.length) {
      return null;
    }
    return [...chatHistory].sort(compareConversationsByUpdatedAt)[0];
  }, [chatHistory]);

  return {
    activeChatId,
    chatHistory,
    latestHistoryChat,
    saveConversationToHistory,
    saveBackgroundChat,
    renameChat,
    deleteChat,
    applyServerChatMetadata,
    touchActiveChatUpdatedAt,
    touchChatUpdatedAt,
    setActiveChatId,
    setActiveChatUpdatedAt,
    setChatHistory,
  };
};
