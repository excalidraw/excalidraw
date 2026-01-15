import { useState } from "react";

import { useAtom, useSetAtom } from "../../../editor-jotai";

import { errorAtom, chatHistoryAtom } from "../TTDContext";

import { useTTDChatStorage } from "../useTTDChatStorage";

import { getLastAssistantMessage } from "../utils/chat";

import type { SavedChat } from "../types";

export const useChatManagement = () => {
  const setError = useSetAtom(errorAtom);
  const [chatHistory, setChatHistory] = useAtom(chatHistoryAtom);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { restoreChat, deleteChat, createNewChatId } = useTTDChatStorage();

  const resetChatState = () => {
    const newSessionId = createNewChatId();
    setChatHistory({
      id: newSessionId,
      messages: [],
      currentPrompt: "",
    });
    setError(null);
  };

  const applyChatToState = (chat: SavedChat) => {
    const restoredMessages = chat.messages.map((msg) => ({
      ...msg,
      timestamp:
        msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
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
  };

  const onRestoreChat = (chat: SavedChat) => {
    const restoredChat = restoreChat(chat);
    applyChatToState(restoredChat);

    setIsMenuOpen(false);
  };

  const handleDeleteChat = (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    const isDeletingActiveChat = chatId === chatHistory.id;
    const updatedChats = deleteChat(chatId);

    if (isDeletingActiveChat) {
      if (updatedChats.length > 0) {
        const nextChat = updatedChats[0];
        applyChatToState(nextChat);
      } else {
        resetChatState();
      }
    }
  };

  const handleNewChat = () => {
    resetChatState();
    setIsMenuOpen(false);
  };

  const handleMenuToggle = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const handleMenuClose = () => {
    setIsMenuOpen(false);
  };

  return {
    isMenuOpen,
    onRestoreChat,
    handleDeleteChat,
    handleNewChat,
    handleMenuToggle,
    handleMenuClose,
  };
};
