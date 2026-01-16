import { useCallback, useEffect, useRef } from "react";
import { randomId } from "@excalidraw/common";

import { atom, useAtom } from "../../editor-jotai";

import { chatHistoryAtom } from "./TTDContext";

import type { SavedChat, SavedChats, TTDPersistenceAdapter } from "./types";

interface UseTTDChatStorageProps {
  persistenceAdapter: TTDPersistenceAdapter;
}

interface UseTTDChatStorageReturn {
  savedChats: SavedChats;
  saveCurrentChat: () => Promise<void>;
  deleteChat: (chatId: string) => Promise<SavedChats>;
  restoreChat: (chat: SavedChat) => SavedChat;
  createNewChatId: () => Promise<string>;
}

const generateChatTitle = (firstMessage: string): string => {
  const trimmed = firstMessage.trim();
  if (trimmed.length <= 50) {
    return trimmed;
  }
  return `${trimmed.substring(0, 47)}...`;
};

// Shared atom for saved chats - starts empty, populated via onLoadChats
export const savedChatsAtom = atom<SavedChats>([]);
export const isLoadingChatsAtom = atom<boolean>(false);
export const chatsLoadedAtom = atom<boolean>(false);

export const useTTDChatStorage = ({
  persistenceAdapter,
}: UseTTDChatStorageProps): UseTTDChatStorageReturn => {
  const [chatHistory] = useAtom(chatHistoryAtom);
  const [savedChats, setSavedChats] = useAtom(savedChatsAtom);
  const [isLoading, setIsLoading] = useAtom(isLoadingChatsAtom);
  const [chatsLoaded, setChatsLoaded] = useAtom(chatsLoadedAtom);

  // Ref to track latest savedChats for async operations
  const savedChatsRef = useRef(savedChats);
  savedChatsRef.current = savedChats;

  const lastMessageInHistory =
    chatHistory?.messages[chatHistory?.messages.length - 1];

  // Load chats on-demand
  const loadChats = useCallback(async () => {
    if (chatsLoaded || isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      const chats = await persistenceAdapter.loadChats();
      setSavedChats(chats);
      setChatsLoaded(true);
    } catch (error) {
      console.warn("Failed to load chats:", error);
      setSavedChats([]);
      setChatsLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, [
    chatsLoaded,
    isLoading,
    setSavedChats,
    setIsLoading,
    setChatsLoaded,
    persistenceAdapter,
  ]);

  // INITIAL LOAD
  useEffect(() => {
    loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveCurrentChat = useCallback(async () => {
    if (chatHistory.messages.length === 0) {
      return;
    }

    const firstUserMessage = chatHistory.messages.find(
      (msg) => msg.type === "user",
    );
    if (!firstUserMessage || typeof firstUserMessage.content !== "string") {
      return;
    }

    const title = generateChatTitle(firstUserMessage.content);

    const currentSavedChats = savedChatsRef.current;
    const existingChat = currentSavedChats.find(
      (chat) => chat.id === chatHistory.id,
    );

    const messagesChanged =
      !existingChat ||
      existingChat.messages.length !== chatHistory.messages.length ||
      existingChat.messages.some(
        (msg, i) =>
          msg.id !== chatHistory.messages[i]?.id ||
          msg.content !== chatHistory.messages[i]?.content,
      );

    const chatToSave: SavedChat = {
      id: chatHistory.id,
      title,
      messages: chatHistory.messages
        .filter((msg) => msg.type === "user" || msg.type === "assistant")
        .map((msg) => ({
          ...msg,
          timestamp:
            msg.timestamp instanceof Date
              ? msg.timestamp
              : new Date(msg.timestamp),
        })),
      currentPrompt: chatHistory.currentPrompt,
      timestamp: messagesChanged
        ? Date.now()
        : existingChat?.timestamp ?? Date.now(),
    };

    const updatedChats = [
      ...currentSavedChats.filter((chat) => chat.id !== chatHistory.id),
      chatToSave,
    ]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    setSavedChats(updatedChats);

    try {
      await persistenceAdapter.saveChats(updatedChats);
    } catch (error) {
      console.warn("Failed to save chats:", error);
    }
  }, [chatHistory, setSavedChats, persistenceAdapter]);

  // Auto-save when generation completes
  useEffect(() => {
    if (!lastMessageInHistory?.isGenerating) {
      saveCurrentChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chatHistory.messages?.length,
    lastMessageInHistory?.id,
    lastMessageInHistory?.isGenerating,
  ]);

  const deleteChat = useCallback(
    async (chatId: string): Promise<SavedChats> => {
      const updatedChats = savedChatsRef.current.filter(
        (chat) => chat.id !== chatId,
      );
      setSavedChats(updatedChats);

      try {
        await persistenceAdapter.saveChats(updatedChats);
      } catch (error) {
        console.warn("Failed to save after delete:", error);
      }

      return updatedChats;
    },
    [setSavedChats, persistenceAdapter],
  );

  const restoreChat = useCallback((chat: SavedChat): SavedChat => {
    // Save is handled by the caller after state update
    return chat;
  }, []);

  const createNewChatId = useCallback(async (): Promise<string> => {
    await saveCurrentChat();
    return randomId();
  }, [saveCurrentChat]);

  return {
    savedChats,
    saveCurrentChat,
    deleteChat,
    restoreChat,
    createNewChatId,
  };
};
