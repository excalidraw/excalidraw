import { getCommonBounds } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type {
  AssistantChatMessage,
  AssistantChatTurnMessage,
  ChatConversation,
  ChatMessage,
  ChatTurn,
  UserChatMessage,
} from "./types";

/**
 * Deep clones messages to ensure no mutation reference issues.
 */
export const cloneMessages = (messages: ChatMessage[]): ChatMessage[] =>
  messages.map((message) => ({
    ...message,
    images:
      message.role === "user" && message.images
        ? [...message.images]
        : undefined,
    skeletons:
      message.role === "assistant" && message.skeletons
        ? [...message.skeletons]
        : undefined,
  }));

const toAssistantTurnMessage = (
  message: AssistantChatMessage,
): AssistantChatTurnMessage => ({
  messageId: message.messageId,
  lastCompletedMessageId: message.lastCompletedMessageId,
  lifecycleStatus: message.lifecycleStatus,
  statusText: message.statusText,
  progressPhase: message.progressPhase,
  generationStartedAt: message.generationStartedAt,
  generationElapsedMs: message.generationElapsedMs,
  createdAt: message.createdAt,
  skeletons: message.skeletons ? [...message.skeletons] : undefined,
  parseError: message.parseError,
  isComplete: message.isComplete,
  stopReason: message.stopReason,
  error: message.error ? { ...message.error } : undefined,
});

export const messagesToTurns = (messages: ChatMessage[]): ChatTurn[] => {
  const turns: ChatTurn[] = [];
  let currentUserMessage: UserChatMessage | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      currentUserMessage = message;
      continue;
    }

    if (!currentUserMessage) {
      continue;
    }

    const turnId = message.turnId ?? currentUserMessage.turnId;
    if (!turnId) {
      continue;
    }

    let turn = turns.find((candidate) => candidate.turnId === turnId);
    if (!turn) {
      turn = {
        turnId,
        prompt: currentUserMessage.content,
        images: currentUserMessage.images
          ? [...currentUserMessage.images]
          : undefined,
        createdAt: currentUserMessage.createdAt,
        updatedAt: message.createdAt ?? currentUserMessage.createdAt,
        assistantMessages: [],
      };
      turns.push(turn);
    }

    turn.assistantMessages.push(toAssistantTurnMessage(message));
    turn.updatedAt = message.createdAt ?? turn.updatedAt;
  }

  return turns;
};

export const turnsToMessages = (turns: ChatTurn[]): ChatMessage[] =>
  turns.flatMap((turn) => {
    const userMessage: UserChatMessage = {
      role: "user",
      id: `user-${turn.turnId}`,
      content: turn.prompt,
      images: turn.images ? [...turn.images] : undefined,
      createdAt: turn.createdAt,
      turnId: turn.turnId,
    };
    const assistant = turn.assistantMessages.at(-1);
    if (!assistant) {
      return [userMessage];
    }
    const assistantMessage: AssistantChatMessage = {
      id: `assistant-${assistant.messageId ?? turn.turnId}`,
      role: "assistant",
      lifecycleStatus: assistant.lifecycleStatus,
      statusText: assistant.statusText,
      progressPhase: assistant.progressPhase,
      generationStartedAt: assistant.generationStartedAt,
      generationElapsedMs: assistant.generationElapsedMs,
      createdAt: assistant.createdAt,
      turnId: turn.turnId,
      messageId: assistant.messageId,
      lastCompletedMessageId: assistant.lastCompletedMessageId,
      skeletons: assistant.skeletons ? [...assistant.skeletons] : undefined,
      parseError: assistant.parseError,
      isComplete: assistant.isComplete,
      stopReason: assistant.stopReason,
      error: assistant.error ? { ...assistant.error } : undefined,
    };
    return [userMessage, assistantMessage];
  });

export const getConversationMessages = (
  conversation: Pick<ChatConversation, "turns">,
): ChatMessage[] => turnsToMessages(conversation.turns);

export const compareConversationsByUpdatedAt = (
  a: Pick<ChatConversation, "updatedAt">,
  b: Pick<ChatConversation, "updatedAt">,
) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0);

export const stopIncompleteAssistantMessages = (
  messages: ChatMessage[],
): ChatMessage[] =>
  cloneMessages(messages).map((message) => {
    if (message.role === "assistant" && message.isComplete === false) {
      return {
        ...message,
        lifecycleStatus: "aborted",
        statusText: undefined,
        progressPhase: undefined,
        generationElapsedMs:
          message.generationElapsedMs ??
          Math.max(
            0,
            Date.now() -
              (message.generationStartedAt ?? message.createdAt ?? Date.now()),
          ),
        isComplete: true,
        stopReason: "interrupted",
      };
    }
    return message;
  });

export const getLatestAssistantMessageId = (
  messages: ChatMessage[],
): string | null => {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.role === "assistant" && message.messageId) {
      return message.messageId;
    }
  }
  return null;
};

export const getLatestRetryableAssistantMessage = (
  messages: ChatMessage[],
): Extract<ChatMessage, { role: "assistant" }> | null => {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (
      message.role === "assistant" &&
      message.isComplete &&
      !message.warningType
    ) {
      return message;
    }
  }
  return null;
};

export const getAssistantGenerationTags = (
  messages: ChatMessage[],
): string[] => {
  const generationTags = new Set<string>();
  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }
    let generationTag: string | null = null;
    if (message.messageId) {
      generationTag = message.messageId;
    } else if (message.skeletons?.length) {
      generationTag = `ai-delete-${message.id}`;
    }
    if (generationTag) {
      generationTags.add(generationTag);
    }
  }
  return [...generationTags];
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

export const getConversationTitleFromTurns = (
  turns: ChatTurn[],
  defaultTitle = "Untitled chat",
) => {
  const title = turns[0]?.prompt.trim() || defaultTitle;
  return title.slice(0, 80);
};

export const getConversationPreviewMessage = (
  messages: ChatMessage[],
): AssistantChatMessage | null => {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (
      message.role === "assistant" &&
      !message.error &&
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
