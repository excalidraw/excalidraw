import { useCallback, useState } from "react";

import { useAtom, useSetAtom } from "../../../editor-jotai";

import { errorAtom, chatHistoryAtom } from "../TTDContext";

import { useTTDChatStorage } from "../useTTDChatStorage";

import { getLastAssistantMessage } from "../utils/chat";

import type { SavedChat, TTDPersistenceAdapter } from "../types";

interface UseChatManagementProps {
  persistenceAdapter: TTDPersistenceAdapter;
}

export const useChatManagement = ({
  persistenceAdapter,
}: UseChatManagementProps) => {
  const setError = useSetAtom(errorAtom);
  const [chatHistory, setChatHistory] = useAtom(chatHistoryAtom);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { restoreChat, deleteChat, createNewChatId } = useTTDChatStorage({
    persistenceAdapter,
  });

  const applyChatToState = useCallback(
    (chat: SavedChat) => {
      const restoredMessages = chat.messages.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp
            : new Date(msg.timestamp),
      }));

      const history = {
        id: chat.id,
        messages: restoredMessages,
        currentPrompt: "",
      };

      const lastAssistantMsg = getLastAssistantMessage(history);

      setError(
        lastAssistantMsg?.error ? new Error(lastAssistantMsg?.error) : null,
      );
      setChatHistory(history);
    },
    [setError, setChatHistory],
  );

  const resetChatState = useCallback(async () => {
    const newSessionId = await createNewChatId();
    setChatHistory({
      id: newSessionId,
      messages: [],
      currentPrompt: "",
    });
    setError(null);
  }, [createNewChatId, setChatHistory, setError]);

  const onRestoreChat = useCallback(
    (chat: SavedChat) => {
      const restoredChat = restoreChat(chat);
      applyChatToState(restoredChat);

      setIsMenuOpen(false);
    },
    [restoreChat, applyChatToState],
  );

  const handleDeleteChat = useCallback(
    async (chatId: string, event: React.MouseEvent) => {
      event.stopPropagation();

      const isDeletingActiveChat = chatId === chatHistory.id;
      const updatedChats = await deleteChat(chatId);

      if (isDeletingActiveChat) {
        if (updatedChats.length > 0) {
          const nextChat = updatedChats[0];
          applyChatToState(nextChat);
        } else {
          await resetChatState();
        }
      }
    },
    [chatHistory.id, deleteChat, applyChatToState, resetChatState],
  );

  const handleNewChat = useCallback(async () => {
    await resetChatState();
    setIsMenuOpen(false);
  }, [resetChatState]);

  const handleMenuToggle = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  const handleMenuClose = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  return {
    isMenuOpen,
    onRestoreChat,
    handleDeleteChat,
    handleNewChat,
    handleMenuToggle,
    handleMenuClose,
  };
};
