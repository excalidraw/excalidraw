import { useCallback, useEffect, useRef } from "react";

import { randomId } from "@excalidraw/common";

import {
  AI_ERRORS,
  type AIGenerateRequestPayload,
  type AssistantChatMessage,
  type ChatMessage,
} from "./types";
import { getAIChatErrorCode, withAIChatErrorMeta } from "./chatErrors";
import { useAIStreamingCanvasPreview } from "./useAIStreamingCanvasPreview";

import type { Dispatch, SetStateAction } from "react";

import type { TTATransportAdapter } from "./client";
import type { useI18n } from "../i18n";
import type { AppClassProperties } from "../types";

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

const isHandledStreamErrorCode = (errorCode?: number) =>
  errorCode === AI_ERRORS.SERVER_ERROR.code ||
  errorCode === AI_ERRORS.RATE_LIMIT.code ||
  errorCode === AI_ERRORS.REQUEST_ERROR.code ||
  errorCode === AI_ERRORS.GENERATION_ERROR.code;

const assistantMessageHasError = (
  messages: ChatMessage[],
  assistantId: string,
) => {
  const message = messages.find((candidate) => candidate.id === assistantId);
  return message?.role === "assistant" && Boolean(message.error);
};

type UseAIStreamingLifecycleOptions = {
  app: AppClassProperties;
  chatMessages: ChatMessage[];
  t: ReturnType<typeof useI18n>["t"];
  setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  applyServerChatMetadata: (metadata: {
    chatId?: string | null;
    turnId?: string | null;
    messageId?: string | null;
    updatedAt?: number | null;
  }) => void;
  removeGeneratedElementsByMessageId: (messageId: string | null) => void;
  commitQueuedGenerationReplacements: (activeMessageId?: string | null) => void;
  streamFetch: TTATransportAdapter["stream"];
  onRateLimitInfo?: (rateLimitInfo: {
    rateLimit?: number | null;
    rateLimitRemaining?: number | null;
  }) => void;
};

const isExhaustedRateLimit = (rateLimitRemaining?: number | null) =>
  typeof rateLimitRemaining === "number" &&
  Number.isFinite(rateLimitRemaining) &&
  rateLimitRemaining === 0;

export const useAIStreamingLifecycle = ({
  app,
  chatMessages,
  t,
  setChatMessages,
  applyServerChatMetadata,
  removeGeneratedElementsByMessageId,
  commitQueuedGenerationReplacements,
  streamFetch,
  onRateLimitInfo,
}: UseAIStreamingLifecycleOptions) => {
  const activeStreamAbortControllerRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);
  const chatMessagesRef = useRef(chatMessages);

  chatMessagesRef.current = chatMessages;

  const patchAssistantMessage = useCallback(
    (assistantId: string, patch: Partial<AssistantChatMessage>) => {
      setChatMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId ? { ...message, ...patch } : message,
        ),
      );
    },
    [setChatMessages],
  );

  const appendRateLimitWarningMessage = useCallback(
    (rateLimit?: number | null, rateLimitRemaining?: number | null) => {
      setChatMessages((prev) => {
        const lastMessage = prev.at(-1);
        if (
          lastMessage?.role === "assistant" &&
          lastMessage.warningType === "messageLimitExceeded"
        ) {
          return prev.map((message, index) =>
            index === prev.length - 1 && message.role === "assistant"
              ? {
                  ...message,
                  error: {
                    code: AI_ERRORS.RATE_LIMIT.code,
                    message: AI_ERRORS.RATE_LIMIT.message,
                    rateLimit,
                    rateLimitRemaining,
                  },
                }
              : message,
          );
        }

        return [
          ...prev,
          {
            id: `assistant-rate-limit-${randomId()}`,
            role: "assistant",
            createdAt: Date.now(),
            isComplete: true,
            warningType: "messageLimitExceeded",
            error: {
              code: AI_ERRORS.RATE_LIMIT.code,
              message: AI_ERRORS.RATE_LIMIT.message,
              rateLimit,
              rateLimitRemaining,
            },
          },
        ];
      });
    },
    [setChatMessages],
  );

  const {
    applyStreamingCanvasPreviewResult,
    throttledApplyStreamingCanvasPreviewResult,
    clearStreamingCanvasPreview,
    clearActiveCanvasDraftFromCanvas,
    commitStreamingCanvasPreview,
    resetActiveCanvasDraft,
    resetStreamingCanvasPreviewState,
  } = useAIStreamingCanvasPreview({
    app,
    removeGeneratedElementsByMessageId,
    commitQueuedGenerationReplacements,
  });

  const cancelPendingCanvasPreviewRenders = useCallback(() => {
    throttledApplyStreamingCanvasPreviewResult.cancel();
  }, [throttledApplyStreamingCanvasPreviewResult]);

  const resetCanvasPreviewRenderState = useCallback(() => {
    resetStreamingCanvasPreviewState();
  }, [resetStreamingCanvasPreviewState]);

  const generateResponse = useCallback(
    async (assistantId: string, payload: AIGenerateRequestPayload) => {
      let activeTurnId: string | null = null;
      let activeMessageId: string | null = null;

      try {
        const abortController = new AbortController();
        activeStreamAbortControllerRef.current = abortController;

        if (stopRequestedRef.current) {
          abortController.abort();
        }

        const { finalPayload, error, rateLimit, rateLimitRemaining } =
          await streamFetch({
            payload,
            signal: abortController.signal,
            onStarted: (startedPayload) => {
              activeTurnId = startedPayload.turnId;
              activeMessageId = startedPayload.messageId;
              applyServerChatMetadata(startedPayload);
              patchAssistantMessage(assistantId, {
                lifecycleStatus: startedPayload.lifecycleStatus ?? "pending",
                turnId: startedPayload.turnId,
                messageId: startedPayload.messageId,
              });
            },
            onMessage: (messagePayload) => {
              patchAssistantMessage(assistantId, {
                statusText: messagePayload.message,
              });
            },
            onChunk: (partialPayload) => {
              if (stopRequestedRef.current) {
                return;
              }
              if (!partialPayload.skeletons.length) {
                return;
              }
              patchAssistantMessage(assistantId, {
                statusText: undefined,
                skeletons: partialPayload.skeletons,
                parseError: undefined,
              });
              if (!activeMessageId) {
                return;
              }
              throttledApplyStreamingCanvasPreviewResult(
                partialPayload,
                activeMessageId,
              );
            },
          });
        onRateLimitInfo?.({ rateLimit, rateLimitRemaining });

        if (stopRequestedRef.current || abortController.signal.aborted) {
          return;
        }

        if (error) {
          cancelPendingCanvasPreviewRenders();
          patchAssistantMessage(assistantId, {
            lifecycleStatus: error.lifecycleStatus ?? "failed",
            statusText: undefined,
            error: {
              code: error.code,
              message: error.message,
              rateLimit,
              rateLimitRemaining,
            },
            isComplete: true,
          });
          if (activeMessageId) {
            applyStreamingCanvasPreviewResult(
              {
                skeletons: [],
                isComplete: true,
              },
              activeMessageId,
            );
          }
          return;
        }

        if (!finalPayload) {
          return;
        }

        throttledApplyStreamingCanvasPreviewResult.flush();
        cancelPendingCanvasPreviewRenders();
        const finalTurnId = finalPayload.turnId ?? activeTurnId;
        const finalMessageId = finalPayload.messageId ?? activeMessageId;
        if (!finalTurnId || !finalMessageId) {
          return;
        }
        activeTurnId = finalTurnId;
        activeMessageId = finalMessageId;

        applyServerChatMetadata({
          chatId: finalPayload.chatId,
          turnId: finalTurnId,
          messageId: finalMessageId,
          updatedAt: finalPayload.updatedAt,
        });

        patchAssistantMessage(assistantId, {
          lifecycleStatus: finalPayload.lifecycleStatus ?? "completed",
          statusText: finalPayload.skeletons.length
            ? t("ai.chat.status.generatedResponse")
            : t("ai.chat.status.emptyResponse"),
          skeletons: finalPayload.skeletons,
          parseError: undefined,
          isComplete: true,
          turnId: finalTurnId,
          messageId: finalMessageId,
        });
        applyStreamingCanvasPreviewResult(finalPayload, finalMessageId);

        if (isExhaustedRateLimit(rateLimitRemaining)) {
          appendRateLimitWarningMessage(rateLimit, rateLimitRemaining);
        }
      } catch (error: unknown) {
        cancelPendingCanvasPreviewRenders();
        if (stopRequestedRef.current || isAbortError(error)) {
          return;
        }

        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorCode = getAIChatErrorCode(error);

        if (isHandledStreamErrorCode(errorCode)) {
          return;
        }

        if (assistantMessageHasError(chatMessagesRef.current, assistantId)) {
          return;
        }

        removeGeneratedElementsByMessageId(activeMessageId);
        clearStreamingCanvasPreview();

        patchAssistantMessage(assistantId, {
          lifecycleStatus: "failed",
          statusText: undefined,
          error: {
            code: errorCode,
            message: errorMessage,
          },
          isComplete: true,
        });
        throw withAIChatErrorMeta(new Error(errorMessage), {
          handled: true,
        });
      } finally {
        cancelPendingCanvasPreviewRenders();
        resetCanvasPreviewRenderState();
        activeStreamAbortControllerRef.current = null;
        stopRequestedRef.current = false;
      }
    },
    [
      applyServerChatMetadata,
      applyStreamingCanvasPreviewResult,
      appendRateLimitWarningMessage,
      cancelPendingCanvasPreviewRenders,
      clearStreamingCanvasPreview,
      onRateLimitInfo,
      patchAssistantMessage,
      removeGeneratedElementsByMessageId,
      resetCanvasPreviewRenderState,
      t,
      throttledApplyStreamingCanvasPreviewResult,
      streamFetch,
    ],
  );

  const cancelActiveStream = useCallback(() => {
    if (activeStreamAbortControllerRef.current) {
      activeStreamAbortControllerRef.current.abort();
      activeStreamAbortControllerRef.current = null;
    }
  }, []);

  const setStopRequested = useCallback((value: boolean) => {
    stopRequestedRef.current = value;
  }, []);

  useEffect(() => {
    return () => {
      cancelPendingCanvasPreviewRenders();
      clearStreamingCanvasPreview();
      cancelActiveStream();
    };
  }, [
    cancelPendingCanvasPreviewRenders,
    cancelActiveStream,
    clearStreamingCanvasPreview,
  ]);

  return {
    clearStreamingCanvasPreview,
    commitStreamingCanvasPreview,
    clearActiveCanvasDraftFromCanvas,
    resetActiveCanvasDraft,
    cancelActiveStream,
    cancelPendingCanvasPreviewRenders,
    setStopRequested,
    generateResponse,
  };
};
