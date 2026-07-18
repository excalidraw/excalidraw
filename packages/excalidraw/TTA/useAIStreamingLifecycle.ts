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

const STREAM_IDLE_STATUS_DELAY = 5000;

const getElapsedMs = (startedAt: number) => Math.max(0, Date.now() - startedAt);

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
      let idleStatusTimeout: ReturnType<typeof setTimeout> | null = null;
      let hasReceivedRenderableChunk = false;
      const generationStartedAt = Date.now();

      const clearIdleStatusTimeout = () => {
        if (idleStatusTimeout !== null) {
          clearTimeout(idleStatusTimeout);
          idleStatusTimeout = null;
        }
      };

      const scheduleIdleStatus = () => {
        clearIdleStatusTimeout();
        idleStatusTimeout = setTimeout(() => {
          if (stopRequestedRef.current) {
            return;
          }
          patchAssistantMessage(assistantId, {
            progressPhase: hasReceivedRenderableChunk
              ? "finalizing"
              : "thinking",
            statusText: undefined,
          });
        }, STREAM_IDLE_STATUS_DELAY);
      };

      try {
        const abortController = new AbortController();
        activeStreamAbortControllerRef.current = abortController;

        if (stopRequestedRef.current) {
          abortController.abort();
        }

        patchAssistantMessage(assistantId, {
          lifecycleStatus: "pending",
          progressPhase: "starting",
          statusText: undefined,
          generationStartedAt,
          generationElapsedMs: undefined,
          isComplete: false,
          stopReason: undefined,
        });

        const { finalPayload, error, rateLimit, rateLimitRemaining } =
          await streamFetch({
            payload,
            signal: abortController.signal,
            onStreamCreated: () => {
              patchAssistantMessage(assistantId, {
                progressPhase: "waiting",
                statusText: undefined,
              });
              scheduleIdleStatus();
            },
            onStarted: (startedPayload) => {
              activeTurnId = startedPayload.turnId;
              activeMessageId = startedPayload.messageId;
              applyServerChatMetadata(startedPayload);
              patchAssistantMessage(assistantId, {
                lifecycleStatus: startedPayload.lifecycleStatus ?? "pending",
                progressPhase: "generating",
                statusText: undefined,
                turnId: startedPayload.turnId,
                messageId: startedPayload.messageId,
              });
              scheduleIdleStatus();
            },
            onMessage: (messagePayload) => {
              patchAssistantMessage(assistantId, {
                progressPhase: "finalizing",
                statusText: messagePayload.message,
              });
              scheduleIdleStatus();
            },
            onChunk: (partialPayload) => {
              if (stopRequestedRef.current) {
                return;
              }
              scheduleIdleStatus();
              if (!partialPayload.skeletons.length) {
                patchAssistantMessage(assistantId, {
                  progressPhase: "generating",
                  statusText: undefined,
                });
                return;
              }
              hasReceivedRenderableChunk = true;
              patchAssistantMessage(assistantId, {
                progressPhase: "generating",
                statusText: undefined,
                skeletons: partialPayload.skeletons,
                parseError: undefined,
              });
              if (!activeMessageId) {
                return;
              }
              // Always render partials as non-final: the server marks its last
              // partial `isComplete: true`, but the authoritative final render
              // (IMMEDIATELY capture + selection) happens once on `done` —
              // honoring it here would commit the draft twice.
              throttledApplyStreamingCanvasPreviewResult(
                { skeletons: partialPayload.skeletons, isComplete: false },
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
            progressPhase: undefined,
            generationElapsedMs: getElapsedMs(generationStartedAt),
            statusText: undefined,
            error: {
              code: error.code,
              message: error.message,
              rateLimit,
              rateLimitRemaining,
            },
            isComplete: true,
          });
          // On-error canvas policy (tta_rewrite_final.md §2.2): treat a failed
          // stream like user Stop — commit whatever draft rendered so the chat
          // bubble, thumbnail, and canvas agree. If nothing rendered this is a
          // no-op and the previous generation stays visible (its queued
          // replacement tag survives, so the next successful generation still
          // replaces it).
          commitStreamingCanvasPreview();
          return;
        }

        if (!finalPayload) {
          return;
        }

        throttledApplyStreamingCanvasPreviewResult.flush();
        cancelPendingCanvasPreviewRenders();
        const finalTurnId = finalPayload.turnId ?? activeTurnId;
        const finalMessageId = finalPayload.messageId ?? activeMessageId;
        activeTurnId = finalTurnId;
        activeMessageId = finalMessageId;

        applyServerChatMetadata({
          chatId: finalPayload.chatId,
          updatedAt: finalPayload.updatedAt,
        });

        // A `done` carrying finishReason "length"/"content_filter" parsed, but
        // the generation was truncated/blocked — not a clean success (M10).
        const isTruncated =
          finalPayload.finishReason === "length" ||
          finalPayload.finishReason === "content_filter";

        patchAssistantMessage(assistantId, {
          lifecycleStatus: finalPayload.lifecycleStatus ?? "completed",
          progressPhase: undefined,
          generationElapsedMs: getElapsedMs(generationStartedAt),
          statusText: isTruncated
            ? t("ai.chat.status.truncatedResponse")
            : finalPayload.skeletons.length
            ? t("ai.chat.status.generatedResponse")
            : t("ai.chat.status.emptyResponse"),
          skeletons: finalPayload.skeletons,
          parseError: undefined,
          isComplete: true,
          turnId: finalTurnId ?? undefined,
          messageId: finalMessageId ?? undefined,
        });
        // Without a message id the draft can't be tagged/keyed — unreachable
        // against today's server (`started` always precedes `done`), but never
        // leave the bubble spinning because of it (N5 in tta_rewrite_final.md).
        if (finalMessageId) {
          applyStreamingCanvasPreviewResult(finalPayload, finalMessageId);
        }

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

        // Same on-error canvas policy as the transport-error branch above:
        // commit the rendered draft instead of wiping it. Even when the final
        // render threw mid-insert (INVALID_RESULT) after tombstoning the
        // preview frame, the commit resurrects those elements as committed.
        commitStreamingCanvasPreview();

        patchAssistantMessage(assistantId, {
          lifecycleStatus: "failed",
          progressPhase: undefined,
          generationElapsedMs: getElapsedMs(generationStartedAt),
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
        clearIdleStatusTimeout();
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
      commitStreamingCanvasPreview,
      onRateLimitInfo,
      patchAssistantMessage,
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
