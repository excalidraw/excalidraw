import { useCallback, useEffect, useRef } from "react";

import { randomId } from "@excalidraw/common";

import {
  AI_ERRORS,
  type AIGenerateRequestPayload,
  type AIStreamProgressPhase,
  type AssistantMessage,
  type AssistantStatus,
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

/**
 * A streaming status the user can currently read: free server text
 * (`message` frames) or an idle-timer phase with a built-in label.
 * `starting`/`waiting`/`generating` render spinner-only.
 */
const isLabeledStreamingStatus = (
  status: Extract<AssistantStatus, { kind: "streaming" }>,
) =>
  Boolean(status.statusText) ||
  status.phase === "thinking" ||
  status.phase === "finalizing";

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

      /**
       * Streaming-status patch. The union model replaces the whole `status`
       * object per stream event, so this guards the replacement (the pre-union
       * field patches were just as blind, but the server's empty-partial
       * keep-alives made the visible label flash in and out — the regression
       * this closes):
       * - a no-op patch (same phase + statusText) keeps the previous status
       *   object instead of minting an identical one;
       * - `keepLabel` (keep-alive chunks with no new content) never downgrades
       *   a labeled state (server statusText / idle thinking-finalizing) to an
       *   unlabeled phase — the label persists until the status genuinely
       *   changes (next label, real content, or a terminal state);
       * - `startedAt` carries over from the current streaming status so the
       *   elapsed ticker never resets mid-stream.
       */
      const patchStreamingStatus = (
        phase: AIStreamProgressPhase,
        options?: {
          statusText?: string;
          keepLabel?: boolean;
          patch?: Partial<Omit<AssistantMessage, "status">>;
        },
      ) => {
        setChatMessages((prev) =>
          prev.map((message) => {
            if (message.id !== assistantId || message.role !== "assistant") {
              return message;
            }
            const current =
              message.status.kind === "streaming" ? message.status : null;
            const nextStatusText = options?.statusText || undefined;
            const isNoOpStatus =
              current !== null &&
              current.phase === phase &&
              (current.statusText || undefined) === nextStatusText;
            const keepCurrentStatus =
              isNoOpStatus ||
              (options?.keepLabel === true &&
                current !== null &&
                isLabeledStreamingStatus(current));
            if (keepCurrentStatus) {
              return options?.patch
                ? { ...message, ...options.patch }
                : message;
            }
            return {
              ...message,
              ...options?.patch,
              status: {
                kind: "streaming",
                phase,
                startedAt: current?.startedAt ?? generationStartedAt,
                ...(nextStatusText ? { statusText: nextStatusText } : {}),
              },
            };
          }),
        );
      };

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
          patchStreamingStatus(
            hasReceivedRenderableChunk ? "finalizing" : "thinking",
          );
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

        // Full replace on purpose: each attempt's stream starts the elapsed
        // ticker from its own `generationStartedAt` (the documented startedAt
        // reset on retry — types.ts), and wipes any seeded "Retrying..." /
        // "Regenerating..." statusText after its MIN_RETRYING_VISIBLE_MS
        // window. Every later patch preserves this baseline.
        patchAssistantMessage(assistantId, {
          status: {
            kind: "streaming",
            phase: "starting",
            startedAt: generationStartedAt,
          },
        });

        const { finalPayload, error, rateLimit, rateLimitRemaining } =
          await streamFetch({
            payload,
            signal: abortController.signal,
            onStreamCreated: () => {
              patchStreamingStatus("waiting");
              scheduleIdleStatus();
            },
            onStarted: (startedPayload) => {
              activeTurnId = startedPayload.turnId;
              activeMessageId = startedPayload.messageId;
              applyServerChatMetadata(startedPayload);
              patchStreamingStatus("generating", {
                patch: {
                  server: {
                    turnId: startedPayload.turnId,
                    messageId: startedPayload.messageId,
                  },
                },
              });
              scheduleIdleStatus();
            },
            onMessage: (messagePayload) => {
              patchStreamingStatus("finalizing", {
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
                // Keep-alive frame — no content progressed, so it must not
                // wipe a visible label (the server emits these continuously
                // while the model thinks or its internal retry backs off).
                patchStreamingStatus("generating", { keepLabel: true });
                return;
              }
              hasReceivedRenderableChunk = true;
              patchStreamingStatus("generating", {
                patch: { skeletons: partialPayload.skeletons },
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
      setChatMessages,
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
