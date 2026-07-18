import { useCallback, useEffect, useRef } from "react";

import { randomId } from "@excalidraw/common";

import {
  AI_ERRORS,
  type AIGenerateRequestPayload,
  type AIStreamProgressPhase,
  type AssistantMessage,
  type ChatMessage,
} from "./types";
import { getAIChatErrorCode, withAIChatErrorMeta } from "./chatErrors";

import type { Dispatch, SetStateAction } from "react";

import type { CanvasDraft } from "./useCanvasDraft";
import type { TTATransportAdapter } from "./client";

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
  return message?.role === "assistant" && message.status.kind === "error";
};

type UseAIStreamingLifecycleOptions = {
  chatMessages: ChatMessage[];
  setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  applyServerChatMetadata: (metadata: {
    chatId?: string | null;
    updatedAt?: number | null;
  }) => void;
  canvasDraft: CanvasDraft;
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
  chatMessages,
  setChatMessages,
  applyServerChatMetadata,
  canvasDraft,
  streamFetch,
  onRateLimitInfo,
}: UseAIStreamingLifecycleOptions) => {
  const activeStreamAbortControllerRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);
  const chatMessagesRef = useRef(chatMessages);

  chatMessagesRef.current = chatMessages;

  const patchAssistantMessage = useCallback(
    (assistantId: string, patch: Partial<AssistantMessage>) => {
      setChatMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId && message.role === "assistant"
            ? { ...message, ...patch }
            : message,
        ),
      );
    },
    [setChatMessages],
  );

  const appendRateLimitWarningMessage = useCallback(() => {
    setChatMessages((prev) => {
      const lastMessage = prev.at(-1);
      // dedupe on repeat — the rate-limit numbers live in the atom, so a
      // second exhausted response has nothing new to say
      if (
        lastMessage?.role === "system" &&
        lastMessage.variant === "messageLimitExceeded"
      ) {
        return prev;
      }

      return [
        ...prev,
        {
          id: `system-rate-limit-${randomId()}`,
          role: "system",
          createdAt: Date.now(),
          variant: "messageLimitExceeded",
        },
      ];
    });
  }, [setChatMessages]);

  const generateResponse = useCallback(
    async (assistantId: string, payload: AIGenerateRequestPayload) => {
      let activeTurnId: string | null = null;
      let activeMessageId: string | null = null;
      let idleStatusTimeout: ReturnType<typeof setTimeout> | null = null;
      let hasReceivedRenderableChunk = false;
      const generationStartedAt = Date.now();

      const streamingStatus = (
        phase: AIStreamProgressPhase,
        statusText?: string,
      ) =>
        ({
          kind: "streaming",
          phase,
          startedAt: generationStartedAt,
          ...(statusText ? { statusText } : {}),
        } as const);

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
            status: streamingStatus(
              hasReceivedRenderableChunk ? "finalizing" : "thinking",
            ),
          });
        }, STREAM_IDLE_STATUS_DELAY);
      };

      const abortController = new AbortController();

      try {
        activeStreamAbortControllerRef.current = abortController;
        // A canceled predecessor skips its ownership-checked cleanup (see the
        // `finally` below), so start from a clean throttle state here.
        canvasDraft.cancelPendingRenders();

        if (stopRequestedRef.current) {
          abortController.abort();
        }

        patchAssistantMessage(assistantId, {
          status: streamingStatus("starting"),
        });

        const { finalPayload, error, rateLimit, rateLimitRemaining } =
          await streamFetch({
            payload,
            signal: abortController.signal,
            onStreamCreated: () => {
              patchAssistantMessage(assistantId, {
                status: streamingStatus("waiting"),
              });
              scheduleIdleStatus();
            },
            onStarted: (startedPayload) => {
              activeTurnId = startedPayload.turnId;
              activeMessageId = startedPayload.messageId;
              applyServerChatMetadata(startedPayload);
              patchAssistantMessage(assistantId, {
                status: streamingStatus("generating"),
                server: {
                  turnId: startedPayload.turnId,
                  messageId: startedPayload.messageId,
                },
              });
              scheduleIdleStatus();
            },
            onMessage: (messagePayload) => {
              patchAssistantMessage(assistantId, {
                status: streamingStatus("finalizing", messagePayload.message),
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
                  status: streamingStatus("generating"),
                });
                return;
              }
              hasReceivedRenderableChunk = true;
              patchAssistantMessage(assistantId, {
                status: streamingStatus("generating"),
                skeletons: partialPayload.skeletons,
              });
              // The draft is keyed by the local generation id (known
              // synchronously), so chunks render regardless of whether
              // `started` arrived yet. Always render partials as non-final:
              // the server marks its last partial `isComplete: true`, but the
              // authoritative final render (IMMEDIATELY capture + selection)
              // happens once on `done` — honoring it here would commit the
              // draft twice.
              canvasDraft.applyChunk(
                { skeletons: partialPayload.skeletons, isComplete: false },
                assistantId,
              );
            },
          });
        onRateLimitInfo?.({ rateLimit, rateLimitRemaining });

        if (stopRequestedRef.current || abortController.signal.aborted) {
          return;
        }

        if (error) {
          patchAssistantMessage(assistantId, {
            status: {
              kind: "error",
              elapsedMs: getElapsedMs(generationStartedAt),
              error: { code: error.code, message: error.message },
            },
          });
          // On-error canvas policy (tta_rewrite_final.md §2.2): treat a failed
          // stream like user Stop — commit whatever draft rendered so the chat
          // bubble, thumbnail, and canvas agree. If nothing rendered this is a
          // no-op and the previous generation stays visible (its queued
          // replacement tag survives, so the next successful generation still
          // replaces it).
          canvasDraft.commitDraft();
          return;
        }

        if (!finalPayload) {
          return;
        }

        const finalTurnId = finalPayload.turnId ?? activeTurnId;
        const finalMessageId = finalPayload.messageId ?? activeMessageId;
        activeTurnId = finalTurnId;
        activeMessageId = finalMessageId;

        applyServerChatMetadata({
          chatId: finalPayload.chatId,
          updatedAt: finalPayload.updatedAt,
        });

        // A `done` carrying finishReason "length"/"content_filter" parsed, but
        // the generation was truncated/blocked — surfaced as a warning on an
        // otherwise successful status (M10); partials are kept.
        const warning =
          finalPayload.finishReason === "length" ||
          finalPayload.finishReason === "content_filter"
            ? finalPayload.finishReason
            : undefined;

        patchAssistantMessage(assistantId, {
          status: {
            kind: "done",
            elapsedMs: getElapsedMs(generationStartedAt),
            outcome: finalPayload.skeletons.length ? "generated" : "empty",
            ...(warning ? { warning } : {}),
          },
          skeletons: finalPayload.skeletons,
          ...(finalTurnId && finalMessageId
            ? { server: { turnId: finalTurnId, messageId: finalMessageId } }
            : {}),
          // the successful attempt becomes the turn's retry target (N1)
          lastCompletedMessageId: finalMessageId ?? undefined,
        });
        canvasDraft.applyFinal(finalPayload, assistantId);

        if (isExhaustedRateLimit(rateLimitRemaining)) {
          appendRateLimitWarningMessage();
        }
      } catch (error: unknown) {
        canvasDraft.cancelPendingRenders();
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
        canvasDraft.commitDraft();

        patchAssistantMessage(assistantId, {
          status: {
            kind: "error",
            elapsedMs: getElapsedMs(generationStartedAt),
            error: { code: errorCode, message: errorMessage },
          },
        });
        throw withAIChatErrorMeta(new Error(errorMessage), {
          handled: true,
        });
      } finally {
        clearIdleStatusTimeout();
        // Ownership-checked cleanup: when this stream was canceled and a
        // successor already took over (retry's cancel-and-replace), the ref
        // holds the successor's controller (or null) — tearing down the
        // shared throttle/stop state here would clobber the live stream.
        if (activeStreamAbortControllerRef.current === abortController) {
          canvasDraft.cancelPendingRenders();
          activeStreamAbortControllerRef.current = null;
          stopRequestedRef.current = false;
        }
      }
    },
    [
      applyServerChatMetadata,
      appendRateLimitWarningMessage,
      canvasDraft,
      onRateLimitInfo,
      patchAssistantMessage,
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
      cancelActiveStream();
    };
  }, [cancelActiveStream]);

  return {
    cancelActiveStream,
    setStopRequested,
    generateResponse,
  };
};
