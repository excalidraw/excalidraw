import { useCallback, useState } from "react";

import type { ChatSettingsValues, Conversation, Message, Role } from "@/types";

const DEFAULT_SETTINGS: ChatSettingsValues = {
  model: "claude-opus-5",
  temperature: 0.7,
  systemPrompt: "",
  apiKey: "",
  savedModels: ["Deepseek-r1", "Claude-Sonnet 5"],
  saveLocation: "browser",
  dataSources: [],
};

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

const createConversation = (): Conversation => ({
  id: createId(),
  title: "New chat",
  updatedAt: Date.now(),
  messages: [],
});

/**
 * Local chat state: conversations, the active thread, and settings.
 * Swap the message-append calls for real API calls in `services/api.ts`.
 */
export function useSomething() {
  const [conversations, setConversations] = useState<Conversation[]>(() => [
    createConversation(),
  ]);
  const [activeId, setActiveId] = useState<string | null>(
    () => conversations[0]?.id ?? null,
  );
  const [settings, setSettings] = useState<ChatSettingsValues>(DEFAULT_SETTINGS);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) ?? null;

  const appendMessage = useCallback(
    (role: Role, content: string, extra?: Pick<Message, "images" | "attachments">) => {
      const message: Message = {
        id: createId(),
        role,
        content,
        createdAt: Date.now(),
        ...extra,
      };

      setConversations((previous) =>
        previous.map((conversation) => {
          if (conversation.id !== activeId) {
            return conversation;
          }

          const isFirstUserMessage =
            role === "user" && conversation.messages.length === 0;

          return {
            ...conversation,
            title: isFirstUserMessage ? content.slice(0, 40) : conversation.title,
            updatedAt: message.createdAt,
            messages: [...conversation.messages, message],
          };
        }),
      );

      return message;
    },
    [activeId],
  );

  const updateMessage = useCallback((id: string, content: string) => {
    setConversations((previous) =>
      previous.map((conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === id ? { ...message, content } : message,
        ),
      })),
    );
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((previous) => {
      const remaining = previous.filter((conversation) => conversation.id !== id);
      const next = remaining.length > 0 ? remaining : [createConversation()];

      setActiveId((current) =>
        current === id ? (next[0]?.id ?? null) : current,
      );

      return next;
    });
  }, []);

  const newChat = useCallback(() => {
    const conversation = createConversation();
    setConversations((previous) => [conversation, ...previous]);
    setActiveId(conversation.id);
  }, []);

  return {
    conversations,
    activeConversation,
    activeId,
    settings,
    setSettings,
    setActiveId,
    appendMessage,
    updateMessage,
    newChat,
    deleteConversation,
  };
}
