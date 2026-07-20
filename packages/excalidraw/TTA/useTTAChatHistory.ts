import { useCallback, useEffect, useMemo, useState } from "react";

import { atom, useAtom } from "../editor-jotai";
import { useI18n } from "../i18n";

import {
  compareConversationsByUpdatedAt,
  getConversationTitleFromTurns,
  messagesToTurns,
} from "./chatHelpers";

import type {
  ChatConversation,
  ChatMessage,
  TTAPersistenceAdapter,
} from "./types";

const ttaChatHistoryAtom = atom<ChatConversation[]>([]);
const ttaActiveChatIdAtom = atom("");
const ttaActiveChatUpdatedAtAtom = atom<number | null>(null);

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
  const [isHistoryHydrated, setIsHistoryHydrated] = useState(false);

  const saveConversationToHistory = useCallback(
    (
      chatId: string,
      messages: ChatMessage[],
      options?: SaveConversationToHistoryOptions,
    ) => {
      if (!chatId || !messages.length) {
        return;
      }

      const turns = messagesToTurns(messages);
      if (!turns.length) {
        return;
      }

      setChatHistory((prev) => {
        const existingIndex = prev.findIndex(
          (conversation) => conversation.id === chatId,
        );
        const existingEntry = existingIndex > -1 ? prev[existingIndex] : null;
        const autoTitle = getConversationTitleFromTurns(
          turns,
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
        const entry: ChatConversation = {
          id: chatId,
          title: existingEntry?.title || autoTitle,
          turns,
          updatedAt,
        };

        if (existingIndex > -1) {
          const copy = [...prev];
          copy[existingIndex] = entry;
          return copy;
        }

        return [entry, ...prev];
      });
    },
    [activeChatId, activeChatUpdatedAt, setChatHistory, t],
  );

  useEffect(() => {
    let isCancelled = false;

    setIsHistoryHydrated(false);

    (async () => {
      try {
        const history = await persistenceAdapter.loadHistory();
        if (!isCancelled && history) {
          setChatHistory(history);
        }
      } catch (error) {
        console.warn("[AI Chat] Failed to load history:", error);
      } finally {
        if (!isCancelled) {
          setIsHistoryHydrated(true);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [persistenceAdapter, setChatHistory]);

  useEffect(() => {
    if (!chatMessages.length || !activeChatId) {
      return;
    }

    const timer = setTimeout(() => {
      saveConversationToHistory(activeChatId, chatMessages);
    }, 500);

    return () => clearTimeout(timer);
  }, [activeChatId, chatMessages, saveConversationToHistory]);

  useEffect(() => {
    if (!isHistoryHydrated) {
      return;
    }

    const saveHistory = async () => {
      try {
        await persistenceAdapter.saveHistory(chatHistory);
      } catch (error) {
        console.warn("[AI Chat] Failed to save history:", error);
      }
    };

    const timer = setTimeout(saveHistory, 500);
    return () => clearTimeout(timer);
  }, [chatHistory, isHistoryHydrated, persistenceAdapter]);

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
    setActiveChatId,
    setActiveChatUpdatedAt,
    setChatHistory,
  };
};
