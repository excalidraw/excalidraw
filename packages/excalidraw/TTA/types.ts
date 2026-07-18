import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import type { ReactNode } from "react";

import type { AIRateLimitWarningDescriptor } from "../aiWarnings";

export type AIServerMessageRole = "user" | "assistant";
export type AIAssistantLifecycleStatus =
  | "pending"
  | "completed"
  | "failed"
  | "aborted";

export type AIStreamProgressPhase =
  | "starting"
  | "waiting"
  | "thinking"
  | "generating"
  | "finalizing";

export interface AIServerConversationMessage {
  role: AIServerMessageRole;
  content: string;
  images?: string[];
}

export interface AIGenerationRetryContext {
  reason: "user_not_happy" | "generation_error";
  avoidSimilarity?: boolean;
  retryAssistantMessageId?: string;
}

export interface AIGenerateRequestPayload extends Record<string, unknown> {
  prompt: string;
  images?: string[];
  chatId?: string | null;
  retry?: AIGenerationRetryContext;
}

export interface ExcalidrawServerPayloadBase {
  skeletons: ExcalidrawElementSkeleton[];
}

export interface AIStreamPartialPayload extends ExcalidrawServerPayloadBase {
  isComplete: boolean;
}

export interface AIStreamStartedPayload {
  chatId: string;
  turnId: string;
  messageId: string;
  lifecycleStatus?: Extract<AIAssistantLifecycleStatus, "pending">;
  updatedAt?: number | null;
}

export interface AIStreamMessagePayload {
  message: string;
}

export interface AIStreamFinalPayload extends AIStreamPartialPayload {
  chatId?: string | null;
  turnId?: string | null;
  messageId?: string | null;
  lifecycleStatus?: Extract<AIAssistantLifecycleStatus, "completed">;
  updatedAt?: number | null;
  /**
   * Provider finish reason, forwarded from the `done` frame. `"length"` /
   * `"content_filter"` mean the generation was truncated/blocked even though
   * it parsed — not a clean success.
   */
  finishReason?: "stop" | "length" | "content_filter" | "tool_calls" | null;
}

export const AI_ERRORS = {
  RATE_LIMIT: {
    code: 429,
    message: "Rate limit exceeded. Please wait before trying again.",
  },
  SERVER_ERROR: {
    code: 500,
    message: "An internal server error occurred. Please try again later.",
  },
  REQUEST_ERROR: {
    code: 400,
    message: "The request could not be processed due to invalid data.",
  },
  GENERATION_ERROR: {
    code: 422,
    message: "Failed to generate valid content.",
  },
} as const;

export type AI_ERROR_CODE = typeof AI_ERRORS[keyof typeof AI_ERRORS]["code"];

export type StreamChunk =
  | {
      type: "started";
      chatId: string;
      turnId: string;
      messageId: string;
      lifecycleStatus?: Extract<AIAssistantLifecycleStatus, "pending">;
      updatedAt?: number;
    }
  | {
      type: "message";
      message: string;
    }
  | {
      type: "partial";
      skeletons: ExcalidrawElementSkeleton[];
      isComplete?: boolean;
    }
  | {
      type: "done";
      lifecycleStatus?: Extract<AIAssistantLifecycleStatus, "completed">;
      finishReason: "stop" | "length" | "content_filter" | "tool_calls" | null;
      skeletons: ExcalidrawElementSkeleton[];
      chatId?: string;
      turnId?: string;
      messageId?: string;
      updatedAt?: number;
    }
  | {
      type: "error";
      lifecycleStatus?: Extract<AIAssistantLifecycleStatus, "failed">;
      error: {
        code?: number;
        message: string;
      };
    };

export type UserMessage = {
  role: "user";
  id: string; // stable, persisted (no re-minting on hydrate)
  content: string;
  images?: string[];
  createdAt: number;
};

/**
 * The assistant generation lifecycle as a discriminated union — exactly one
 * variant at a time, patched with single `status =` assignments. Everything
 * else (spinner, terminal labels, retry-eligibility, elapsed display) is
 * derived at render from `kind`.
 */
export type AssistantStatus =
  | {
      kind: "streaming";
      phase: AIStreamProgressPhase;
      startedAt: number;
      /** Free server text (`message` frames) overriding the phase label. */
      statusText?: string;
    }
  | {
      kind: "done";
      elapsedMs: number;
      outcome: "generated" | "empty";
      /** Provider finishReason surfaced: truncated/blocked, partials kept. */
      warning?: "length" | "content_filter";
    }
  | { kind: "stopped"; elapsedMs: number; reason: "user" | "interrupted" }
  | {
      kind: "error";
      elapsedMs?: number;
      error: { code?: number; message: string };
    };

export type AssistantMessage = {
  role: "assistant";
  /**
   * Local generation id — stable across error-retries and persistence.
   */
  id: string;
  createdAt: number;
  /** Reconciled once from `started`; metadata only (retry/truncate ids). */
  server?: { turnId: string; messageId: string };
  /**
   * Server id of the turn's last *successful* attempt — the only id the
   * server's retry lookup accepts (`current_message_id`). Survives failed
   * retries; absent when the turn never completed successfully.
   */
  lastCompletedMessageId?: string;
  skeletons?: ReadonlyArray<ExcalidrawElementSkeleton>;
  status: AssistantStatus;
};

/**
 * Session-scoped rate-limit warning bubble. Not persisted; the numbers live in
 * the rate-limits atom, not on the message.
 */
export type SystemWarningMessage = {
  role: "system";
  id: string;
  createdAt: number;
  variant: AIRateLimitWarningDescriptor["variant"];
};

export type ChatMessage = UserMessage | AssistantMessage | SystemWarningMessage;

export type ChatConversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};

export interface TTARateLimits {
  rateLimit: number;
  rateLimitRemaining: number;
}

export type TTAChatScrollOptions = {
  keepElementTopVisible?: HTMLElement | null;
  behavior?: ScrollBehavior;
};

export interface TTAPersistenceAdapter {
  loadChats(): Promise<ChatConversation[]>;
  saveChat(chat: ChatConversation): Promise<void>;
  deleteChat(id: string): Promise<void>;
}

/**
 * Renders the empty-state intro area. Return `undefined` to use the built-in
 * guidance text.
 */
export type TTADialogRenderWelcomeScreen = (props: {
  rateLimits: TTARateLimits | null;
}) => ReactNode | undefined;

/**
 * Return `undefined` to use the built-in warning/error rendering.
 * Receives a shared warning descriptor as the first argument.
 * Returning a node replaces the full message row.
 */
export type TTADialogRenderWarning = (
  warning: AIRateLimitWarningDescriptor,
  chatMessage: SystemWarningMessage,
) => ReactNode | undefined;
