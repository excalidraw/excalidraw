import { findLastIndex, randomId } from "@excalidraw/common";

import type { LLMMessage, TChat } from "../types";

export const updateAssistantContent = (
  chatHistory: TChat.ChatHistory,
  payload: Partial<TChat.ChatMessage>,
) => {
  const { messages } = chatHistory;

  const lastAssistantIndex = findLastIndex(
    messages,
    (msg) => msg.type === "assistant",
  );

  if (lastAssistantIndex === -1) {
    return chatHistory;
  }

  const lastMessage = messages[lastAssistantIndex];

  const updatedMessages = messages.slice();

  updatedMessages[lastAssistantIndex] = {
    ...lastMessage,
    ...payload,
  };

  return {
    ...chatHistory,
    messages: updatedMessages,
  };
};

export const getLastAssistantMessage = (chatHistory: TChat.ChatHistory) => {
  const { messages } = chatHistory;

  const lastAssistantIndex = findLastIndex(
    messages,
    (msg) => msg.type === "assistant",
  );

  return messages[lastAssistantIndex];
};

export const addMessages = (
  chatHistory: TChat.ChatHistory,
  messages: Array<Omit<TChat.ChatMessage, "id" | "timestamp">>,
) => {
  const newMessages: Array<TChat.ChatMessage> = messages.map((message) => ({
    ...message,
    id: randomId(),
    timestamp: new Date(),
  }));

  return {
    ...chatHistory,
    messages: [...chatHistory.messages, ...newMessages],
  };
};

export const removeLastAssistantMessage = (chatHistory: TChat.ChatHistory) => {
  const lastMsgIdx = findLastIndex(
    chatHistory.messages ?? [],
    (msg) => msg.type === "assistant",
  );

  if (lastMsgIdx !== -1) {
    return {
      ...chatHistory,
      messages: chatHistory.messages.filter((_, idx) => idx !== lastMsgIdx),
    };
  }
  return chatHistory;
};

export const getMessagesForLLM = (
  chatHistory: TChat.ChatHistory,
): LLMMessage[] => {
  const messages: LLMMessage[] = [];

  for (const msg of chatHistory.messages) {
    if (msg.content && (msg.type === "user" || msg.type === "assistant")) {
      messages.push({
        role: msg.type,
        content: msg.content,
      });
    }
  }

  return messages;
};
