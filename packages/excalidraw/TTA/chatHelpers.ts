import { getCommonBounds } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { AssistantMessage, ChatConversation, ChatMessage } from "./types";

export const compareConversationsByUpdatedAt = (
  a: Pick<ChatConversation, "updatedAt">,
  b: Pick<ChatConversation, "updatedAt">,
) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0);

/**
 * Marks generations that were still streaming (e.g. when a chat is re-opened
 * after an interrupted session) as stopped/interrupted.
 */
export const stopIncompleteAssistantMessages = (
  messages: ChatMessage[],
): ChatMessage[] =>
  messages.map((message) =>
    message.role === "assistant" && message.status.kind === "streaming"
      ? {
          ...message,
          status: {
            kind: "stopped",
            elapsedMs: Math.max(0, Date.now() - message.status.startedAt),
            reason: "interrupted",
          },
        }
      : message,
  );

/**
 * Local generation id of the latest assistant generation with drawable
 * content — the canvas tag (`customData[AI_GENERATED_ELEMENTS_KEY]`) of the
 * conversation's current on-canvas result. Only assistants with skeletons
 * produce tags: a generation that never rendered has nothing on the canvas to
 * replace.
 */
export const getLatestAssistantGenerationId = (
  messages: ChatMessage[],
): string | null => {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.role === "assistant" && message.skeletons?.length) {
      return message.id;
    }
  }
  return null;
};

export const getLatestRetryableAssistantMessage = (
  messages: ChatMessage[],
): AssistantMessage | null => {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.role === "assistant" && message.status.kind !== "streaming") {
      return message;
    }
  }
  return null;
};

/**
 * Canvas tags (= local generation ids) of every assistant generation with
 * drawable content in the conversation.
 */
export const getAssistantGenerationTags = (
  messages: ChatMessage[],
): string[] => {
  const generationTags: string[] = [];
  for (const message of messages) {
    if (message.role === "assistant" && message.skeletons?.length) {
      generationTags.push(message.id);
    }
  }
  return generationTags;
};

export const getTurnStartIndexForAssistantDelete = (
  messages: ChatMessage[],
  messageIndex: number,
) => {
  let turnStartIndex = messageIndex;
  for (let index = messageIndex - 1; index >= 0; index--) {
    if (messages[index].role === "user") {
      turnStartIndex = index;
      break;
    }
  }
  return turnStartIndex;
};

export const getConversationTitle = (
  messages: ChatMessage[],
  defaultTitle = "Untitled chat",
) => {
  const firstUserMessage = messages.find(
    (message): message is Extract<ChatMessage, { role: "user" }> =>
      message.role === "user",
  );
  const title = firstUserMessage?.content.trim() || defaultTitle;
  return title.slice(0, 80);
};

export const getConversationPreviewMessage = (
  messages: ChatMessage[],
): AssistantMessage | null => {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (
      message.role === "assistant" &&
      message.status.kind !== "error" &&
      message.skeletons?.length
    ) {
      return message;
    }
  }
  return null;
};

export const getElementsCenter = (
  elements: readonly NonDeletedExcalidrawElement[],
): { x: number; y: number } | null => {
  if (!elements.length) {
    return null;
  }
  const bounds = getCommonBounds(elements);
  if (bounds.some((value) => Number.isNaN(value) || !Number.isFinite(value))) {
    return null;
  }
  const [minX, minY, maxX, maxY] = bounds;
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
};
