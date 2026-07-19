import { useCallback, useEffect, useMemo, useRef } from "react";

import {
  CaptureUpdateAction,
  newElementWith,
  type CaptureUpdateActionType,
} from "@excalidraw/element";
import { exportToBlob } from "@excalidraw/utils";

import { randomId } from "@excalidraw/common";

import { getDataURL } from "../data/blob";

import {
  convertAISkeletonsToSceneElements,
  getElementsWithDeletedGenerationTags,
  insertAISkeletons,
  isIntermediatePreviewElement,
} from "./insertAISkeletons";
import {
  getAssistantGenerationTags,
  getLatestAssistantGenerationId,
  getLatestRetryableAssistantMessage,
  getTurnStartIndexForAssistantDelete,
  stopIncompleteAssistantMessages,
} from "./chatHelpers";
import { isAIChatErrorHandled } from "./chatErrors";
import { useAIStreamingLifecycle } from "./useAIStreamingLifecycle";
import { useGenerationSlot } from "./useGenerationSlot";

import type { Dispatch, SetStateAction } from "react";

import type { t as translate } from "../i18n";
import type { AppClassProperties } from "../types";
import type {
  AIGenerateRequestPayload,
  ChatConversation,
  ChatMessage,
  TTARateLimits,
} from "./types";
import type { CanvasDraft } from "./useCanvasDraft";
import type { TTATransportAdapter } from "./client";
import type { useTTAChatHistory } from "./useTTAChatHistory";

const MIN_RETRYING_VISIBLE_MS = 500;

/**
 * The subset of `useTTAChatHistory` the actions hook drives: chat-id
 * adoption/updatedAt bookkeeping, active-chat pointers, and the save/delete
 * entry points. Narrow on purpose so tests can stub it without IndexedDB.
 */
export type TTAChatActionsHistoryHandles = Pick<
  ReturnType<typeof useTTAChatHistory>,
  | "activeChatId"
  | "setActiveChatId"
  | "setActiveChatUpdatedAt"
  | "saveConversationToHistory"
  | "deleteChat"
  | "applyServerChatMetadata"
  | "touchActiveChatUpdatedAt"
>;

export type UseTTAChatActionsOptions = {
  app: AppClassProperties;
  t: typeof translate;
  chatMessages: ChatMessage[];
  setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  /** The single canvas-draft owner (tta_rewrite_final.md §2.4) — created by
   * the dialog, driven exclusively from here. */
  canvasDraft: CanvasDraft;
  transportAdapter: TTATransportAdapter;
  history: TTAChatActionsHistoryHandles;
  rateLimits: TTARateLimits | null;
  onRateLimitInfo: (rateLimitInfo: {
    rateLimit?: number | null;
    rateLimitRemaining?: number | null;
  }) => void;
  /** Whether the TTA panel is open — re-runs the orphan preview sweep when
   * the persisted scene loads after mount. */
  isPanelOpen: boolean;
  /** Current composer draft text — the prompt when `sendChatPrompt` is
   * called without an explicit one. */
  composerText: string;
  /** Clears the composer text + attached images. */
  clearComposer: () => void;
  /** Hides the history overlay. */
  hideHistory: () => void;
  scrollChatToBottom: () => void;
  focusComposerInput: () => void;
};

/**
 * Owns everything that mutates chat messages, talks to the AI server, or
 * touches the canvas (draft + committed generations): send/retry/stop/delete
 * orchestration, chat switch/new/delete, and the single-flight generation
 * slot. The dialog keeps UI-only state (modal, history overlay visibility,
 * confirm-dialog pending state, composer state, scroll/focus/keyboard
 * effects, support banner) and passes it in as values/callbacks.
 */
export const useTTAChatActions = ({
  app,
  t,
  chatMessages,
  setChatMessages,
  canvasDraft,
  transportAdapter,
  history,
  rateLimits,
  onRateLimitInfo,
  isPanelOpen,
  composerText,
  clearComposer,
  hideHistory,
  scrollChatToBottom,
  focusComposerInput,
}: UseTTAChatActionsOptions) => {
  const {
    activeChatId,
    setActiveChatId,
    setActiveChatUpdatedAt,
    saveConversationToHistory,
    deleteChat,
    applyServerChatMetadata,
    touchActiveChatUpdatedAt,
  } = history;

  // Single-flight: at most one generation at a time; `isSendingChat` is the
  // slot's render mirror (drives every disabled state and the Stop button).
  const {
    isGenerationActive: isSendingChat,
    hasActiveGeneration,
    acquireGenerationSlot,
    releaseGenerationSlot,
  } = useGenerationSlot();

  const latestRetryableAssistantMessageId = useMemo(
    () => getLatestRetryableAssistantMessage(chatMessages)?.id ?? null,
    [chatMessages],
  );

  const removeGeneratedElementsByGenerationTags = useCallback(
    (
      generationTags: readonly string[],
      captureUpdate: CaptureUpdateActionType = CaptureUpdateAction.NEVER,
    ) => {
      if (!generationTags.length) {
        return;
      }
      const { elements, didChange } = getElementsWithDeletedGenerationTags(
        app.scene.getElementsIncludingDeleted(),
        new Set(generationTags),
      );
      if (didChange) {
        // Element-only mutations use `updateScene`; anything captured/selected
        // goes through `syncActionResult`.
        if (captureUpdate === CaptureUpdateAction.IMMEDIATELY) {
          app.syncActionResult({ elements, captureUpdate });
        } else {
          app.api.updateScene({ elements, captureUpdate });
        }
      }
    },
    [app],
  );

  const getElementsForMessage = useCallback(
    (messageId: string | null | undefined) => {
      if (!messageId) {
        return [];
      }

      const message = chatMessages.find((entry) => entry.id === messageId);
      if (message?.role !== "assistant" || !message.skeletons?.length) {
        return [];
      }

      return convertAISkeletonsToSceneElements(message.skeletons, app, {
        generationId: messageId,
      });
    },
    [app, chatMessages],
  );

  const exportImageFromMessageSkeletons = useCallback(
    async (messageId: string | null | undefined) => {
      try {
        const elements = getElementsForMessage(messageId);
        if (!elements.length) {
          return undefined;
        }

        const blob = await exportToBlob({
          elements,
          files: app.files,
          maxWidthOrHeight: 1024,
          appState: {
            exportWithDarkMode: app.state.theme === "dark",
          },
        });
        return await getDataURL(blob);
      } catch (error) {
        console.warn("[AI Chat] Failed to export retry image:", error);
        return undefined;
      }
    },
    [app, getElementsForMessage],
  );

  const { cancelActiveStream, setStopRequested, generateResponse } =
    useAIStreamingLifecycle({
      chatMessages,
      setChatMessages,
      applyServerChatMetadata,
      canvasDraft,
      streamFetch: transportAdapter.stream,
      onRateLimitInfo,
    });

  // N3 defense (tta_rewrite_final.md §2.4): older builds leaked intermediate
  // preview elements into locally persisted scenes. They are invisible to TTA
  // (no draft record points at them), so tombstone any orphaned flagged
  // elements. Runs on mount and again when the panel opens (the persisted
  // scene may not have loaded yet at mount time), and never while a
  // generation is streaming (the live preview is flagged too).
  const didSweepOrphanedPreviewElementsRef = useRef(false);
  useEffect(() => {
    if (didSweepOrphanedPreviewElementsRef.current && !isPanelOpen) {
      return;
    }
    didSweepOrphanedPreviewElementsRef.current = true;
    if (hasActiveGeneration()) {
      return;
    }
    const existingElements = app.scene.getElementsIncludingDeleted();
    let didChange = false;
    const nextElements = existingElements.map((element) => {
      if (!element.isDeleted && isIntermediatePreviewElement(element)) {
        didChange = true;
        return newElementWith(element, { isDeleted: true });
      }
      return element;
    });
    if (didChange) {
      app.api.updateScene({
        elements: nextElements,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }
  }, [app, hasActiveGeneration, isPanelOpen]);

  const handleInsertResult = useCallback(
    (message: ChatMessage) => {
      if (message.role !== "assistant" || !message.skeletons?.length) {
        return;
      }
      try {
        insertAISkeletons(app, message.skeletons, {
          regenerateIds: true,
          selectInsertedElements: true,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      } catch (error) {
        console.error("[AI Chat] failed to insert result", error);
      }
    },
    [app],
  );

  const streamAssistantResponse = useCallback(
    async (
      conversation: ChatMessage[],
      retryContext?: {
        reason: "user_not_happy" | "generation_error";
        avoidSimilarity?: boolean;
        retryAssistantMessageId?: string;
      },
      options?: {
        assistantId?: string;
        insertAssistantMessage?: boolean;
        images?: string[];
      },
    ): Promise<void> => {
      const assistantId = options?.assistantId ?? `assistant-${randomId()}`;

      const latestMessage = conversation.at(-1);
      if (!latestMessage || latestMessage.role !== "user") {
        throw new Error("Conversation must end with the latest user prompt.");
      }

      const payload: AIGenerateRequestPayload = {
        prompt: latestMessage.content,
        images:
          options?.images ??
          (latestMessage.role === "user" ? latestMessage.images : undefined),
        chatId: activeChatId || null,
        ...(retryContext
          ? {
              retry: {
                reason: retryContext.reason,
                avoidSimilarity: Boolean(retryContext.avoidSimilarity),
                retryAssistantMessageId: retryContext.retryAssistantMessageId,
              },
            }
          : null),
      };

      if (options?.insertAssistantMessage !== false) {
        const generationStartedAt = Date.now();
        const retryingText = retryContext
          ? retryContext.reason === "generation_error"
            ? t("ai.chat.status.retrying")
            : t("ai.chat.status.regenerating")
          : undefined;
        setChatMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            createdAt: generationStartedAt,
            status: {
              kind: "streaming",
              phase: "starting",
              startedAt: generationStartedAt,
              ...(retryingText ? { statusText: retryingText } : {}),
            },
          },
        ]);
      }

      await generateResponse(assistantId, payload);
    },
    [activeChatId, generateResponse, setChatMessages, t],
  );

  /**
   * The single entry point for send and retry (tta_rewrite_final.md §2.3):
   * reserves the in-flight slot synchronously BEFORE any chat mutation (so a
   * concurrent Enter-send can never mutate the conversation — C1), then
   * mutates, then streams, with one shared catch (C3). A second call while a
   * generation is in flight is a no-op unless `replaceActive` (retry).
   */
  const runGeneration = useCallback(
    ({
      assistantId,
      mutate,
      stream,
      replaceActive = false,
    }: {
      assistantId: string;
      mutate: () => void;
      stream: () => Promise<void>;
      replaceActive?: boolean;
    }): boolean => {
      if (hasActiveGeneration()) {
        if (!replaceActive) {
          return false;
        }
        // cancel-and-replace (retry): abort the active stream and take over.
        // The canceled stream's ownership-checked cleanup can't clobber us.
        cancelActiveStream();
        canvasDraft.cancelPendingRenders();
        releaseGenerationSlot();
      }
      const release = acquireGenerationSlot();
      if (!release) {
        return false;
      }
      mutate();
      setStopRequested(false);
      void stream()
        .catch((err) => {
          console.error("[AI Chat] error:", err);
          canvasDraft.clearDraft();
          if (isAIChatErrorHandled(err)) {
            return;
          }
          const message = err instanceof Error ? err.message : String(err);
          setChatMessages((prev) => {
            // patch the generation's own bubble when it exists (retry
            // placeholders would otherwise spin forever), append otherwise
            if (
              prev.some((m) => m.id === assistantId && m.role === "assistant")
            ) {
              return prev.map((m) =>
                m.id === assistantId && m.role === "assistant"
                  ? {
                      ...m,
                      status: {
                        kind: "error" as const,
                        ...(m.status.kind === "streaming"
                          ? {
                              elapsedMs: Math.max(
                                0,
                                Date.now() - m.status.startedAt,
                              ),
                            }
                          : {}),
                        error: { message },
                      },
                    }
                  : m,
              );
            }
            return [
              ...prev,
              {
                id: assistantId,
                role: "assistant" as const,
                createdAt: Date.now(),
                status: { kind: "error" as const, error: { message } },
              },
            ];
          });
        })
        .finally(release);
      return true;
    },
    [
      acquireGenerationSlot,
      cancelActiveStream,
      canvasDraft,
      hasActiveGeneration,
      releaseGenerationSlot,
      setChatMessages,
      setStopRequested,
    ],
  );

  const sendChatPrompt = useCallback(
    (prompt?: string, images?: string[]) => {
      if (rateLimits?.rateLimitRemaining === 0) {
        return;
      }

      const source = prompt ?? composerText;
      const trimmed = source.trim();
      if (!trimmed && !images?.length) {
        return;
      }

      const userMessage: ChatMessage = {
        id: `user-${randomId()}`,
        role: "user",
        content: trimmed,
        images,
        createdAt: Date.now(),
      };

      const lastGenerationId = getLatestAssistantGenerationId(chatMessages);
      const conversation = [...chatMessages, userMessage];
      const assistantId = `assistant-${randomId()}`;

      // NOTE the composer is only cleared when the slot was actually acquired
      // — a send during an active generation is a no-op that keeps the draft
      // text.
      runGeneration({
        assistantId,
        mutate: () => {
          touchActiveChatUpdatedAt();
          setChatMessages((prev) => [...prev, userMessage]);
          clearComposer();
          canvasDraft.clearDraft();
          if (lastGenerationId) {
            canvasDraft.queueReplacement(lastGenerationId);
          }
        },
        stream: () =>
          streamAssistantResponse(conversation, undefined, { assistantId }),
      });
    },
    [
      canvasDraft,
      chatMessages,
      clearComposer,
      composerText,
      rateLimits?.rateLimitRemaining,
      runGeneration,
      setChatMessages,
      streamAssistantResponse,
      touchActiveChatUpdatedAt,
    ],
  );

  /**
   * Full user-Stop semantics: abort the stream, commit the rendered draft to
   * the canvas (NEVER→IMMEDIATELY dance), free the slot, mark the streaming
   * bubble stopped. Also used by chat switch/delete mid-stream (N2), which
   * behave exactly like pressing Stop first.
   */
  const stopActiveGeneration = useCallback(
    (stopReason: "user" | "interrupted") => {
      if (!hasActiveGeneration()) {
        return;
      }
      setStopRequested(true);
      cancelActiveStream();
      canvasDraft.commitDraft();
      releaseGenerationSlot();
      touchActiveChatUpdatedAt();

      // Mark the last assistant message as stopped.
      setChatMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (
          lastMsg &&
          lastMsg.role === "assistant" &&
          lastMsg.status.kind === "streaming"
        ) {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMsg,
              status: {
                kind: "stopped",
                elapsedMs: Math.max(0, Date.now() - lastMsg.status.startedAt),
                reason: stopReason,
              },
            },
          ];
        }
        return prev;
      });
    },
    [
      cancelActiveStream,
      canvasDraft,
      hasActiveGeneration,
      releaseGenerationSlot,
      setChatMessages,
      setStopRequested,
      touchActiveChatUpdatedAt,
    ],
  );

  const handleStartNewChat = useCallback(
    async (options?: { saveCurrentToHistory?: boolean }) => {
      const saveCurrentToHistory = options?.saveCurrentToHistory ?? true;
      if (saveCurrentToHistory && chatMessages.length && activeChatId) {
        saveConversationToHistory(activeChatId, chatMessages);
      }
      canvasDraft.reset();
      setActiveChatUpdatedAt(null);
      setChatMessages([]);
      clearComposer();
      hideHistory();
      setActiveChatId("");
      requestAnimationFrame(() => {
        focusComposerInput();
      });
    },
    [
      activeChatId,
      canvasDraft,
      chatMessages,
      clearComposer,
      focusComposerInput,
      hideHistory,
      saveConversationToHistory,
      setActiveChatId,
      setActiveChatUpdatedAt,
      setChatMessages,
    ],
  );

  const handleDeleteChat = useCallback(
    (chatId: string) => {
      if (activeChatId === chatId) {
        // deleting the chat that owns the in-flight generation — stop it
        // first (N2: an orphaned stream would keep painting the canvas and
        // re-point the active chat back to the deleted id)
        stopActiveGeneration("interrupted");
      }
      deleteChat(chatId);
      if (activeChatId === chatId) {
        handleStartNewChat({ saveCurrentToHistory: false });
      }
    },
    [activeChatId, deleteChat, handleStartNewChat, stopActiveGeneration],
  );

  const handleSelectChat = useCallback(
    (chat: ChatConversation) => {
      // Switching chats mid-stream behaves like pressing Stop first (N2):
      // the draft is committed to the canvas under the old chat and the
      // orphaned stream can no longer patch state or re-point the chat id.
      stopActiveGeneration("interrupted");
      canvasDraft.reset();
      setChatMessages(stopIncompleteAssistantMessages(chat.messages));
      setActiveChatId(chat.id);
      setActiveChatUpdatedAt(chat.updatedAt);
      hideHistory();
      requestAnimationFrame(() => {
        scrollChatToBottom();
        focusComposerInput();
      });
    },
    [
      canvasDraft,
      focusComposerInput,
      hideHistory,
      scrollChatToBottom,
      setActiveChatId,
      setActiveChatUpdatedAt,
      setChatMessages,
      stopActiveGeneration,
    ],
  );

  const handleRetry = useCallback(
    (messageId: string) => {
      if (rateLimits?.rateLimitRemaining === 0) {
        return;
      }

      const messageIndex = chatMessages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) {
        return;
      }

      const message = chatMessages[messageIndex];
      if (
        message.role !== "assistant" ||
        message.status.kind === "streaming" ||
        message.id !== latestRetryableAssistantMessageId
      ) {
        return;
      }

      let retryUserMessageIndex = -1;
      for (let index = messageIndex - 1; index >= 0; index--) {
        if (chatMessages[index].role === "user") {
          retryUserMessageIndex = index;
          break;
        }
      }

      if (retryUserMessageIndex === -1) {
        return;
      }

      const isErrorRetry = message.status.kind === "error";
      const retryAssistantId = isErrorRetry
        ? messageId
        : `assistant-${randomId()}`;
      const retryingText = isErrorRetry
        ? t("ai.chat.status.retrying")
        : t("ai.chat.status.regenerating");
      const retryStartedAt = Date.now();
      const conversationToRetry = chatMessages.slice(
        0,
        retryUserMessageIndex + 1,
      );
      // N1 (tta_rewrite_final.md §2.3): the server's retry lookup only accepts
      // the id of the turn's last *successful* attempt (current_message_id) —
      // a failed/stopped attempt's id would 400. Every `done` stamps
      // `lastCompletedMessageId`, so it is the single source of truth; when
      // the turn never succeeded, omit the target: the server starts a fresh
      // turn with the explicitly-sent prompt.
      const retryTargetMessageId = message.lastCompletedMessageId;

      runGeneration({
        replaceActive: true,
        assistantId: retryAssistantId,
        mutate: () => {
          touchActiveChatUpdatedAt();
          canvasDraft.clearDraft();
          // A failed generation commits its rendered partial to the canvas
          // (the on-error policy in useAIStreamingLifecycle), so an
          // error-retry must queue it for replacement just like regenerate
          // does — otherwise the retried generation would render on top of
          // the stale partial. The tag is the LOCAL id: for an error-retry it
          // equals the new attempt's id, which the queue handles (the failed
          // attempt's elements are removed right before the new attempt's
          // first render).
          canvasDraft.queueReplacement(message.id);
          if (isErrorRetry) {
            setChatMessages((prev) =>
              prev.map((entry) =>
                entry.id === messageId && entry.role === "assistant"
                  ? {
                      ...entry,
                      createdAt: retryStartedAt,
                      status: {
                        kind: "streaming" as const,
                        phase: "starting" as const,
                        startedAt: retryStartedAt,
                        statusText: retryingText,
                      },
                      server: undefined,
                      skeletons: undefined,
                      // `lastCompletedMessageId` deliberately NOT cleared: the
                      // turn's last successful attempt survives failed retries
                      // (N1 retry target)
                    }
                  : entry,
              ),
            );
          } else {
            setChatMessages((prev) => [
              ...prev.filter((m) => m.id !== messageId),
              {
                id: retryAssistantId,
                role: "assistant",
                createdAt: retryStartedAt,
                status: {
                  kind: "streaming",
                  phase: "starting",
                  startedAt: retryStartedAt,
                  statusText: retryingText,
                },
                // carry the regenerated turn's successful attempt forward so a
                // failed regenerate can still retry against the same turn
                lastCompletedMessageId: message.lastCompletedMessageId,
              },
            ]);
          }
        },
        stream: async () => {
          await new Promise((resolve) =>
            setTimeout(resolve, MIN_RETRYING_VISIBLE_MS),
          );

          const retryImage = await (!isErrorRetry
            ? exportImageFromMessageSkeletons(message.id)
            : undefined);

          await streamAssistantResponse(
            conversationToRetry,
            {
              reason: isErrorRetry ? "generation_error" : "user_not_happy",
              avoidSimilarity: !isErrorRetry,
              retryAssistantMessageId: retryTargetMessageId,
            },
            {
              assistantId: retryAssistantId,
              insertAssistantMessage: false,
              images: retryImage ? [retryImage] : undefined,
            },
          );
        },
      });
    },
    [
      canvasDraft,
      chatMessages,
      latestRetryableAssistantMessageId,
      rateLimits?.rateLimitRemaining,
      runGeneration,
      setChatMessages,
      exportImageFromMessageSkeletons,
      streamAssistantResponse,
      touchActiveChatUpdatedAt,
      t,
    ],
  );

  const executeDelete = useCallback(
    async (messageId: string) => {
      const messageIndex = chatMessages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) {
        return;
      }

      const message = chatMessages[messageIndex];
      if (message.role !== "assistant") {
        return;
      }

      // Cancel any in-flight generation and remove draft preview elements
      // (no draft commit: delete is destructive, the canvas is cleared below).
      setStopRequested(true);
      cancelActiveStream();
      releaseGenerationSlot();
      canvasDraft.reset();
      touchActiveChatUpdatedAt();

      const turnStartIndex = getTurnStartIndexForAssistantDelete(
        chatMessages,
        messageIndex,
      );

      const currentChatGenerationTags =
        getAssistantGenerationTags(chatMessages);
      const truncated = chatMessages.slice(0, turnStartIndex);
      if (!truncated.length) {
        removeGeneratedElementsByGenerationTags(
          currentChatGenerationTags,
          CaptureUpdateAction.IMMEDIATELY,
        );
        setChatMessages([]);
        clearComposer();
        hideHistory();
        deleteChat(activeChatId);
        const currentChatId = activeChatId || null;
        if (currentChatId) {
          try {
            await transportAdapter.truncate({
              chatId: currentChatId,
              keepThroughTurnId: null,
            });
          } catch (error) {
            console.warn("[AI Chat] Failed to clear chat on server:", error);
            // M5: the local truncate is optimistic — surface the failure (the
            // server copy will resurrect the deleted turns on next load).
            app.api.setToast({
              message: t("ai.chat.errors.deleteFailed"),
              closable: true,
              duration: 5000,
            });
          }
        }
        setActiveChatUpdatedAt(null);
        setActiveChatId("");
        return;
      }

      // Sync server chat context so future generations don't include deleted turns.
      try {
        const lastAssistant = [...truncated]
          .reverse()
          .find(
            (entry): entry is Extract<ChatMessage, { role: "assistant" }> =>
              entry.role === "assistant" && Boolean(entry.server?.turnId),
          );
        const currentChatId = activeChatId || null;
        if (currentChatId && lastAssistant?.server?.turnId) {
          const response = await transportAdapter.truncate({
            chatId: currentChatId,
            keepThroughTurnId: lastAssistant.server.turnId,
          });
          if (typeof response.updatedAt === "number") {
            applyServerChatMetadata({ updatedAt: response.updatedAt });
          }
        } else if (currentChatId) {
          console.warn(
            "[AI Chat] Missing turnId for truncation; skipping server update.",
          );
        }
      } catch (error) {
        console.warn("[AI Chat] Failed to truncate chat for delete:", error);
        // M5: the local truncate below still proceeds — surface the failure
        // (the server copy will resurrect the deleted turns on next load).
        app.api.setToast({
          message: t("ai.chat.errors.deleteFailed"),
          closable: true,
          duration: 5000,
        });
      }

      setChatMessages(truncated);

      // Replace the canvas preview with the latest remaining result.
      const latestAssistant = [...truncated]
        .reverse()
        .find(
          (entry): entry is Extract<ChatMessage, { role: "assistant" }> =>
            entry.role === "assistant" && Boolean(entry.skeletons?.length),
        );
      if (latestAssistant?.skeletons?.length) {
        try {
          insertAISkeletons(app, latestAssistant.skeletons, {
            // the local message id IS the canvas tag (tta_rewrite_final.md
            // §2.4)
            generationId: latestAssistant.id,
            regenerateIds: true,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            selectInsertedElements: true,
            deleteGenerationTags: currentChatGenerationTags,
          });
        } catch (error) {
          console.error("[AI Chat] failed to sync delete to canvas", error);
        }
      } else {
        removeGeneratedElementsByGenerationTags(
          currentChatGenerationTags,
          CaptureUpdateAction.IMMEDIATELY,
        );
      }
    },
    [
      activeChatId,
      app,
      applyServerChatMetadata,
      canvasDraft,
      cancelActiveStream,
      chatMessages,
      clearComposer,
      deleteChat,
      hideHistory,
      releaseGenerationSlot,
      removeGeneratedElementsByGenerationTags,
      setActiveChatId,
      setActiveChatUpdatedAt,
      setChatMessages,
      setStopRequested,
      t,
      touchActiveChatUpdatedAt,
      transportAdapter,
    ],
  );

  return {
    isSendingChat,
    hasActiveGeneration,
    latestRetryableAssistantMessageId,
    sendChatPrompt,
    stopActiveGeneration,
    handleStartNewChat,
    handleSelectChat,
    handleDeleteChat,
    handleRetry,
    executeDelete,
    handleInsertResult,
  };
};

export type TTAChatActions = ReturnType<typeof useTTAChatActions>;
