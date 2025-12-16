import { findLastIndex, randomId } from "@excalidraw/common";

import type { ChatHistory, ChatMessageType } from "../../Chat";
import type { ChatMessage } from "../../Chat/types";

export const updateAssistantContent = (
  chatHistory: ChatHistory,
  payload: Partial<ChatMessage>,
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

export const getLastAssistantMessage = (chatHistory: ChatHistory) => {
  const { messages } = chatHistory;

  const lastAssistantIndex = findLastIndex(
    messages,
    (msg) => msg.type === "assistant",
  );

  return messages[lastAssistantIndex];
};

export const addMessages = (
  chatHistory: ChatHistory,
  messages: Array<Omit<ChatMessageType, "id" | "timestamp">>,
) => {
  const newMessages: Array<ChatMessageType> = messages.map((message) => ({
    ...message,
    id: randomId(),
    timestamp: new Date(),
  }));

  return {
    ...chatHistory,
    messages: [...chatHistory.messages, ...newMessages],
  };
};

export const removeLastAssistantMessage = (chatHistory: ChatHistory) => {
  const lastMsgIdx = (chatHistory.messages ?? []).findIndex(
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

export const getMessagesForApi = (
  chatHistory: ChatHistory,
): Array<{
  role: "user" | "assistant" | "system";
  content: string;
}> => {
  const filteredMessages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }> = [];

  const lastUserMessage = chatHistory.messages
    .filter((msg) => !!msg.content)
    .slice()
    .reverse()
    .find((msg) => msg.type === "user");

  const lastAssistantMessages = chatHistory.messages
    .filter((msg) => msg.type === "assistant" && !!msg.content)
    .slice(-2);

  if (lastUserMessage) {
    filteredMessages.push({
      role: lastUserMessage.type,
      content: lastUserMessage.content,
    });
  }

  filteredMessages.push(
    ...lastAssistantMessages.map((msg) => ({
      role: msg.type as "user" | "assistant" | "system",
      content: msg.content,
    })),
  );

  return filteredMessages;
};
