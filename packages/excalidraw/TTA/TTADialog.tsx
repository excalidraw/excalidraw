import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CaptureUpdateAction,
  newElementWith,
  type CaptureUpdateActionType,
} from "@excalidraw/element";
import { exportToBlob } from "@excalidraw/utils";

import { randomId } from "@excalidraw/common";

import React from "react";

import { atom, useAtom } from "../editor-jotai";
import { useApp } from "../components/App";
import ConfirmDialog from "../components/ConfirmDialog";
import { useI18n } from "../i18n";
import { useAppStateValue } from "../hooks/useAppStateValue";
import { getDataURL } from "../data/blob";

import {
  AI_GENERATED_ELEMENTS_KEY,
  convertAISkeletonsToSceneElements,
  insertAISkeletons,
} from "./insertAISkeletons";
import "./TTADialog.scss";
import TTAComposer, { type TTAComposerImage } from "./TTAComposer";
import { TTADialogTrigger } from "./TTADialogTrigger";
import { TTAIndexedDBAdapter } from "./history";
import {
  TTADialogPanel,
  type TTADialogPanelActions,
  type TTADialogPanelView,
  type TTAPreviewModalState,
} from "./TTADialogPanel";

import {
  getAssistantGenerationTags,
  getLatestAssistantMessageId,
  getLatestRetryableAssistantMessage,
  getTurnStartIndexForAssistantDelete,
  stopIncompleteAssistantMessages,
} from "./chatHelpers";
import { isAIChatErrorHandled } from "./chatErrors";
import { useAIStreamingLifecycle } from "./useAIStreamingLifecycle";
import { useGenerationSlot } from "./useGenerationSlot";
import { useTTAChatHistory } from "./useTTAChatHistory";

import type {
  AIGenerateRequestPayload,
  ChatMessage,
  ChatConversation,
  TTAChatScrollOptions,
  TTADialogRenderWelcomeScreen,
  TTADialogRenderWarning,
  TTAPersistenceAdapter,
  TTARateLimits,
} from "./types";
import type { TTATransportAdapter } from "./client";

// --- Constants & Helpers ---

const MIN_RETRYING_VISIBLE_MS = 500;
const DEFAULT_MAX_IMAGES = 4;

// Atoms for state persistence across component mounts
const ttaChatMessagesAtom = atom<ChatMessage[]>([]);
const ttaRateLimitsAtom = atom<TTARateLimits | null>(null);

export interface TTADialogProps {
  maxImages?: number;
  onMaxImages?: (maxImages: number) => React.ReactNode;
  renderWelcomeScreen?: TTADialogRenderWelcomeScreen;
  renderWarning?: TTADialogRenderWarning;
  persistenceAdapter?: TTAPersistenceAdapter;
  transportAdapter: TTATransportAdapter;
}

const TTADialogContent = ({
  maxImages = DEFAULT_MAX_IMAGES,
  onMaxImages,
  renderWelcomeScreen,
  renderWarning,
  persistenceAdapter = TTAIndexedDBAdapter,
  transportAdapter,
}: TTADialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(true);
  const app = useApp();

  const { t } = useI18n();
  const [chatMessages, setChatMessages] = useAtom(ttaChatMessagesAtom);
  const [rateLimits, setRateLimits] = useAtom(ttaRateLimitsAtom);
  const [composerInputValue, setComposerInputValue] = useState("");
  const [composerImages, setComposerImages] = useState<TTAComposerImage[]>([]);
  // Single-flight: at most one generation at a time; `isSendingChat` is the
  // slot's render mirror (drives every disabled state and the Stop button).
  const {
    isGenerationActive: isSendingChat,
    hasActiveGeneration,
    acquireGenerationSlot,
    releaseGenerationSlot,
  } = useGenerationSlot();

  // History Overlay State
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const {
    activeChatId,
    chatHistory,
    latestHistoryChat,
    saveConversationToHistory,
    renameChat,
    deleteChat,
    setActiveChatId,
    setActiveChatUpdatedAt,
    setChatHistory,
  } = useTTAChatHistory({
    chatMessages,
    persistenceAdapter,
  });

  const openSidebar = useAppStateValue("openSidebar");

  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const pendingGenerationReplacementTagsRef = useRef<string[]>([]);
  const previousIsOpenRef = useRef(isOpen);
  const previousChatMessageCountRef = useRef(chatMessages.length);

  const hasConversation = chatMessages.length > 0;
  const latestRetryableAssistantMessageId = useMemo(
    () => getLatestRetryableAssistantMessage(chatMessages)?.id ?? null,
    [chatMessages],
  );
  const [previewModal, setPreviewModal] = useState<TTAPreviewModalState | null>(
    null,
  );
  const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState<
    string | null
  >(null);
  const pendingDeleteClearsConversation = useMemo(() => {
    if (!pendingDeleteMessageId) {
      return false;
    }
    const messageIndex = chatMessages.findIndex(
      (message) => message.id === pendingDeleteMessageId,
    );
    if (messageIndex === -1) {
      return false;
    }
    if (chatMessages[messageIndex].role !== "assistant") {
      return false;
    }
    return (
      getTurnStartIndexForAssistantDelete(chatMessages, messageIndex) === 0
    );
  }, [chatMessages, pendingDeleteMessageId]);
  const [dismissedSupportMessageId, setDismissedSupportMessageId] = useState<
    string | null
  >(null);
  const latestAssistantErrorMessageId = useMemo(() => {
    const latestMessage = chatMessages.at(-1);
    if (
      latestMessage &&
      latestMessage.role === "assistant" &&
      latestMessage.status.kind === "error"
    ) {
      return latestMessage.id;
    }
    return null;
  }, [chatMessages]);
  const shouldShowSupportBanner = Boolean(
    latestAssistantErrorMessageId &&
      latestAssistantErrorMessageId !== dismissedSupportMessageId,
  );
  const dismissSupportBanner = useCallback(() => {
    if (latestAssistantErrorMessageId) {
      setDismissedSupportMessageId(latestAssistantErrorMessageId);
    }
  }, [latestAssistantErrorMessageId]);

  // Adopt the server chat id delivered by `started`. A brand-new chat is
  // buffered in memory until then (useTTAChatHistory gates persistence on a
  // non-empty active id), so its history row is only ever created under the
  // real server id — there is no local-id row to swap/delete anymore.
  const applyServerChatId = useCallback(
    (nextChatId?: string | null) => {
      if (!nextChatId) {
        return;
      }
      setActiveChatId((prev) => (prev === nextChatId ? prev : nextChatId));
    },
    [setActiveChatId],
  );

  const getServerChatId = useCallback(() => {
    return activeChatId || null;
  }, [activeChatId]);

  const updateHistoryChatUpdatedAt = useCallback(
    (chatId: string, updatedAt: number) => {
      setChatHistory((prev) => {
        const existingIndex = prev.findIndex((chat) => chat.id === chatId);
        if (existingIndex === -1) {
          return prev;
        }
        if (prev[existingIndex].updatedAt === updatedAt) {
          return prev;
        }
        const copy = [...prev];
        copy[existingIndex] = {
          ...copy[existingIndex],
          updatedAt,
        };
        return copy;
      });
    },
    [setChatHistory],
  );

  const applyActiveChatUpdatedAt = useCallback(
    (updatedAt: number, chatId?: string | null) => {
      setActiveChatUpdatedAt(updatedAt);
      const targetChatId = chatId || activeChatId;
      if (targetChatId) {
        updateHistoryChatUpdatedAt(targetChatId, updatedAt);
      }
    },
    [activeChatId, setActiveChatUpdatedAt, updateHistoryChatUpdatedAt],
  );

  const applyServerChatMetadata = useCallback(
    (metadata: { chatId?: string | null; updatedAt?: number | null }) => {
      if (metadata.chatId) {
        applyServerChatId(metadata.chatId);
      }
      if (typeof metadata.updatedAt === "number") {
        applyActiveChatUpdatedAt(metadata.updatedAt, metadata.chatId);
      }
    },
    [applyActiveChatUpdatedAt, applyServerChatId],
  );

  const touchActiveChatUpdatedAt = useCallback(() => {
    applyActiveChatUpdatedAt(Date.now());
  }, [applyActiveChatUpdatedAt]);

  const scrollChatToBottom = useCallback((options?: TTAChatScrollOptions) => {
    const element = chatHistoryRef.current;
    if (!element) {
      return;
    }

    const maxScrollTop = Math.max(
      0,
      element.scrollHeight - element.clientHeight,
    );
    const keepElementTopVisible = options?.keepElementTopVisible;
    let nextScrollTop = maxScrollTop;

    if (keepElementTopVisible) {
      const containerRect = element.getBoundingClientRect();
      const keepElementRect = keepElementTopVisible.getBoundingClientRect();
      const keepElementTopScroll =
        element.scrollTop + keepElementRect.top - containerRect.top;
      nextScrollTop = Math.min(maxScrollTop, Math.max(0, keepElementTopScroll));
    }

    if (typeof element.scrollTo === "function") {
      element.scrollTo({
        top: nextScrollTop,
        ...(options?.behavior &&
        typeof document !== "undefined" &&
        "scrollBehavior" in document.documentElement.style
          ? { behavior: options.behavior }
          : null),
      });
      return;
    }

    element.scrollTop = nextScrollTop;
  }, []);

  const handleRateLimitInfo = useCallback(
    ({
      rateLimit,
      rateLimitRemaining,
    }: {
      rateLimit?: number | null;
      rateLimitRemaining?: number | null;
    }) => {
      if (
        typeof rateLimit !== "number" ||
        !Number.isFinite(rateLimit) ||
        typeof rateLimitRemaining !== "number" ||
        !Number.isFinite(rateLimitRemaining)
      ) {
        return;
      }

      setRateLimits({ rateLimit, rateLimitRemaining });
    },
    [setRateLimits],
  );

  // --- Layout & Visibility Effects ---

  const prevOpenSidebarNameRef = useRef<string | null>(null);
  useEffect(() => {
    const nextOpenSidebarName = openSidebar?.name ?? null;
    const prevOpenSidebarName = prevOpenSidebarNameRef.current;

    // If the sidebar has just been opened and the AI chat isn't pinned,
    // close the floating panel to avoid overlapping UI.
    if (!prevOpenSidebarName && nextOpenSidebarName && !isPinned) {
      setIsOpen(false);
    }

    prevOpenSidebarNameRef.current = nextOpenSidebarName;
  }, [openSidebar?.name, isPinned]);

  const interactiveCanvas = app?.interactiveCanvas ?? null;
  const staticCanvas = app?.canvas ?? null;

  // Close panel on canvas click (unless pinned)
  useEffect(() => {
    if (!isOpen || isPinned) {
      return;
    }

    const canvas = interactiveCanvas ?? staticCanvas;
    if (!canvas) {
      return;
    }

    const handlePointerDown = () => {
      setIsOpen(false);
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [interactiveCanvas, staticCanvas, isOpen, isPinned]);

  const handleClose = () => setIsOpen(false);
  const focusComposerInput = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }
    const input = document.querySelector<HTMLTextAreaElement>(
      "#tta-floating-panel .tta-composer__textarea",
    );
    input?.focus();
  }, []);
  const closePreviewModal = useCallback(() => {
    setPreviewModal(null);
    requestAnimationFrame(() => {
      focusComposerInput();
    });
  }, [focusComposerInput]);
  const openPreviewModal = useCallback(
    (
      image: string,
      titleKey: TTAPreviewModalState["titleKey"] = "ai.chat.generatedResult",
    ) => {
      setPreviewModal({
        image,
        titleKey,
      });
    },
    [],
  );

  useEffect(() => {
    if (!previewModal) {
      return;
    }
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" &&
        event.key !== "Esc" &&
        event.code !== "Escape"
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      closePreviewModal();
    };
    document.addEventListener("keydown", handleEscapeKey, true);
    return () => {
      document.removeEventListener("keydown", handleEscapeKey, true);
    };
  }, [previewModal, closePreviewModal]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleTabToComposer = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }
      if (
        document.activeElement instanceof HTMLElement &&
        document.activeElement.closest(
          "#tta-floating-panel .tta-composer__textarea",
        )
      ) {
        return;
      }
      event.preventDefault();
      focusComposerInput();
    };
    document.addEventListener("keydown", handleTabToComposer, true);
    return () => {
      document.removeEventListener("keydown", handleTabToComposer, true);
    };
  }, [isOpen, focusComposerInput]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        focusComposerInput();
      });
    }
  }, [isOpen, focusComposerInput]);

  // Scroll to the latest message when the panel (re)opens onto an existing
  // conversation and whenever a message is appended.
  useEffect(() => {
    const wasOpen = previousIsOpenRef.current;
    previousIsOpenRef.current = isOpen;
    const previousMessageCount = previousChatMessageCountRef.current;
    previousChatMessageCountRef.current = chatMessages.length;

    const didJustOpen = isOpen && !wasOpen && chatMessages.length > 0;
    const didAppendMessage = chatMessages.length > previousMessageCount;
    if (!didJustOpen && !didAppendMessage) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      scrollChatToBottom();
    });
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [chatMessages.length, isOpen, scrollChatToBottom]);

  // --- Generation & Preview Logic ---

  const removeGeneratedElementsByGenerationTags = useCallback(
    (
      generationTags: readonly string[],
      captureUpdate: CaptureUpdateActionType = CaptureUpdateAction.NEVER,
    ) => {
      if (!generationTags.length) {
        return;
      }
      const generationTagSet = new Set(generationTags);
      const existingElements = app.scene.getElementsIncludingDeleted();
      let didChange = false;
      const nextElements = existingElements.map((element) => {
        if (element.isDeleted) {
          return element;
        }

        const elementGenerationTag =
          element.customData?.[AI_GENERATED_ELEMENTS_KEY];
        if (
          typeof elementGenerationTag === "string" &&
          generationTagSet.has(elementGenerationTag)
        ) {
          didChange = true;
          return newElementWith(element, { isDeleted: true });
        }
        return element;
      });
      if (didChange) {
        if (captureUpdate === CaptureUpdateAction.IMMEDIATELY) {
          app.api.updateScene({
            elements: nextElements,
            captureUpdate,
          });
        } else {
          app.syncActionResult({
            elements: nextElements,
            captureUpdate,
          });
        }
      }
    },
    [app],
  );

  const removeGeneratedElementsByMessageId = useCallback(
    (messageId: string | null) => {
      if (!messageId) {
        return;
      }
      removeGeneratedElementsByGenerationTags([messageId]);
    },
    [removeGeneratedElementsByGenerationTags],
  );

  const getElementsForMessage = useCallback(
    (messageId: string | null | undefined) => {
      if (!messageId) {
        return [];
      }

      const message = chatMessages.find((entry) => {
        return (
          entry.role === "assistant" && entry.server?.messageId === messageId
        );
      });
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

  const queueGenerationReplacement = useCallback(
    (generationTag: string | null | undefined) => {
      if (!generationTag) {
        return;
      }
      const pending = pendingGenerationReplacementTagsRef.current;
      if (pending.includes(generationTag)) {
        return;
      }
      // Keep the previous generation visible until the next one yields
      // renderable skeletons.
      pendingGenerationReplacementTagsRef.current = [...pending, generationTag];
    },
    [],
  );

  const clearQueuedGenerationReplacements = useCallback(() => {
    pendingGenerationReplacementTagsRef.current = [];
  }, []);

  const commitQueuedGenerationReplacements = useCallback(
    (activeMessageId?: string | null) => {
      const pending = pendingGenerationReplacementTagsRef.current;
      if (!pending.length) {
        return;
      }
      const removable = activeMessageId
        ? pending.filter((tag) => tag !== activeMessageId)
        : pending;
      pendingGenerationReplacementTagsRef.current = [];
      if (!removable.length) {
        return;
      }
      // Remove stale generations once the active one has started rendering.
      removeGeneratedElementsByGenerationTags(
        removable,
        CaptureUpdateAction.IMMEDIATELY,
      );
    },
    [removeGeneratedElementsByGenerationTags],
  );

  const {
    clearStreamingCanvasPreview,
    clearActiveCanvasDraftFromCanvas,
    commitStreamingCanvasPreview,
    resetActiveCanvasDraft,
    cancelActiveStream,
    cancelPendingCanvasPreviewRenders,
    setStopRequested,
    generateResponse,
  } = useAIStreamingLifecycle({
    app,
    chatMessages,
    setChatMessages,
    applyServerChatMetadata,
    removeGeneratedElementsByMessageId,
    commitQueuedGenerationReplacements,
    streamFetch: transportAdapter.stream,
    onRateLimitInfo: handleRateLimitInfo,
  });

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
        chatId: getServerChatId(),
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
    [generateResponse, getServerChatId, setChatMessages, t],
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
        cancelPendingCanvasPreviewRenders();
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
          clearStreamingCanvasPreview();
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
      cancelPendingCanvasPreviewRenders,
      clearStreamingCanvasPreview,
      hasActiveGeneration,
      releaseGenerationSlot,
      setChatMessages,
      setStopRequested,
    ],
  );

  const sendChatPrompt = (prompt?: string, images?: string[]) => {
    if (rateLimits?.rateLimitRemaining === 0) {
      return;
    }

    const source = prompt ?? composerInputValue;
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

    const lastAssistantMessageId = getLatestAssistantMessageId(chatMessages);
    const conversation = [...chatMessages, userMessage];
    const assistantId = `assistant-${randomId()}`;

    // NOTE the composer is only cleared when the slot was actually acquired —
    // a send during an active generation is a no-op that keeps the draft text.
    runGeneration({
      assistantId,
      mutate: () => {
        touchActiveChatUpdatedAt();
        setChatMessages((prev) => [...prev, userMessage]);
        setComposerInputValue("");
        setComposerImages([]);
        clearStreamingCanvasPreview();
        if (lastAssistantMessageId) {
          queueGenerationReplacement(lastAssistantMessageId);
        }
      },
      stream: () =>
        streamAssistantResponse(conversation, undefined, { assistantId }),
    });
  };

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
      cancelPendingCanvasPreviewRenders();
      commitStreamingCanvasPreview();
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
      cancelPendingCanvasPreviewRenders,
      commitStreamingCanvasPreview,
      hasActiveGeneration,
      releaseGenerationSlot,
      setChatMessages,
      setStopRequested,
      touchActiveChatUpdatedAt,
    ],
  );

  // --- Chat Actions ---

  const handleStartNewChat = useCallback(
    async (options?: { saveCurrentToHistory?: boolean }) => {
      const saveCurrentToHistory = options?.saveCurrentToHistory ?? true;
      resetActiveCanvasDraft();
      clearQueuedGenerationReplacements();
      if (saveCurrentToHistory && chatMessages.length && activeChatId) {
        saveConversationToHistory(activeChatId, chatMessages);
      }
      clearStreamingCanvasPreview();
      setActiveChatUpdatedAt(null);
      setChatMessages([]);
      setComposerInputValue("");
      setComposerImages([]);
      setIsHistoryVisible(false);
      setActiveChatId("");
      requestAnimationFrame(() => {
        focusComposerInput();
      });
    },
    [
      activeChatId,
      chatMessages,
      clearQueuedGenerationReplacements,
      clearStreamingCanvasPreview,
      resetActiveCanvasDraft,
      saveConversationToHistory,
      setActiveChatId,
      setActiveChatUpdatedAt,
      setComposerImages,
      setComposerInputValue,
      setChatMessages,
      setIsHistoryVisible,
      focusComposerInput,
    ],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleNewChatShortcut = (event: KeyboardEvent) => {
      const isShortcutPressed =
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        !event.altKey &&
        !event.repeat &&
        event.key.toLowerCase() === "o";

      if (
        !isShortcutPressed ||
        !hasConversation ||
        isSendingChat ||
        previewModal
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      handleStartNewChat();
    };
    document.addEventListener("keydown", handleNewChatShortcut, true);
    return () => {
      document.removeEventListener("keydown", handleNewChatShortcut, true);
    };
  }, [
    hasConversation,
    handleStartNewChat,
    isOpen,
    isSendingChat,
    previewModal,
  ]);

  const handleRenameChat = useCallback(
    (chatId: string, newTitle: string) => {
      renameChat(chatId, newTitle);
    },
    [renameChat],
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
      clearQueuedGenerationReplacements();
      setChatMessages(stopIncompleteAssistantMessages(chat.messages));
      setActiveChatId(chat.id);
      setActiveChatUpdatedAt(chat.updatedAt);
      setIsHistoryVisible(false);
      requestAnimationFrame(() => {
        scrollChatToBottom();
        focusComposerInput();
      });
    },
    [
      clearQueuedGenerationReplacements,
      focusComposerInput,
      scrollChatToBottom,
      setActiveChatId,
      setActiveChatUpdatedAt,
      setChatMessages,
      stopActiveGeneration,
    ],
  );

  const hideHistoryAndFocusComposer = useCallback(() => {
    setIsHistoryVisible(false);
    requestAnimationFrame(() => {
      focusComposerInput();
    });
  }, [focusComposerInput]);

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
          clearStreamingCanvasPreview();
          // A failed generation commits its rendered partial to the canvas
          // (the on-error policy in useAIStreamingLifecycle), so an
          // error-retry must queue it for replacement just like regenerate
          // does — otherwise the retried generation would render on top of
          // the stale partial.
          queueGenerationReplacement(message.server?.messageId ?? null);
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
            ? exportImageFromMessageSkeletons(message.server?.messageId)
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
      chatMessages,
      clearStreamingCanvasPreview,
      latestRetryableAssistantMessageId,
      queueGenerationReplacement,
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
      cancelPendingCanvasPreviewRenders();
      releaseGenerationSlot();
      clearQueuedGenerationReplacements();
      clearStreamingCanvasPreview();
      clearActiveCanvasDraftFromCanvas();
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
        setComposerInputValue("");
        setComposerImages([]);
        setIsHistoryVisible(false);
        deleteChat(activeChatId);
        const currentChatId = getServerChatId();
        if (currentChatId) {
          try {
            await transportAdapter.truncate({
              chatId: currentChatId,
              keepThroughTurnId: null,
            });
          } catch (error) {
            console.warn("[AI Chat] Failed to clear chat on server:", error);
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
        const currentChatId = getServerChatId();
        if (currentChatId && lastAssistant?.server?.turnId) {
          const response = await transportAdapter.truncate({
            chatId: currentChatId,
            keepThroughTurnId: lastAssistant.server.turnId,
          });
          if (typeof response.updatedAt === "number") {
            applyActiveChatUpdatedAt(response.updatedAt);
          }
        } else if (currentChatId) {
          console.warn(
            "[AI Chat] Missing turnId for truncation; skipping server update.",
          );
        }
      } catch (error) {
        console.warn("[AI Chat] Failed to truncate chat for delete:", error);
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
        const generationId =
          latestAssistant.server?.messageId ??
          `ai-delete-${latestAssistant.id}`;
        try {
          insertAISkeletons(app, latestAssistant.skeletons, {
            generationId,
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
      chatMessages,
      cancelActiveStream,
      clearActiveCanvasDraftFromCanvas,
      clearStreamingCanvasPreview,
      clearQueuedGenerationReplacements,
      deleteChat,
      getServerChatId,
      applyActiveChatUpdatedAt,
      removeGeneratedElementsByGenerationTags,
      setActiveChatId,
      setActiveChatUpdatedAt,
      setComposerImages,
      setComposerInputValue,
      setChatMessages,
      setIsHistoryVisible,
      cancelPendingCanvasPreviewRenders,
      releaseGenerationSlot,
      setStopRequested,
      touchActiveChatUpdatedAt,
      transportAdapter,
    ],
  );

  const requestDelete = useCallback((messageId: string) => {
    setPendingDeleteMessageId(messageId);
  }, []);

  const cancelDelete = useCallback(() => {
    setPendingDeleteMessageId(null);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!pendingDeleteMessageId) {
      return;
    }
    const messageId = pendingDeleteMessageId;
    setPendingDeleteMessageId(null);
    executeDelete(messageId);
  }, [executeDelete, pendingDeleteMessageId]);

  const handleStopGeneration = useCallback(() => {
    stopActiveGeneration("user");
  }, [stopActiveGeneration]);

  // --- Render Sub-components ---

  const composerJSX = (
    <TTAComposer
      onSend={(message, images) => sendChatPrompt(message, images)}
      onStop={handleStopGeneration}
      isSending={isSendingChat}
      value={composerInputValue}
      onChange={setComposerInputValue}
      images={composerImages}
      onImagesChange={setComposerImages}
      maxImages={maxImages}
      onMaxImages={onMaxImages}
      onPreviewImage={(image) =>
        openPreviewModal(image, "ai.chat.attachedImage")
      }
      placeholder={
        rateLimits?.rateLimitRemaining === 0
          ? t("chat.rateLimit.messageLimitInputPlaceholder")
          : hasConversation
          ? t("ai.input.placeholderRefine")
          : undefined
      }
      disabled={rateLimits?.rateLimitRemaining === 0}
    />
  );

  const panelView: TTADialogPanelView = {
    hasConversation,
    isSendingChat,
    isHistoryVisible,
    isPinned,
    shouldShowSupportBanner,
    composerInputValue,
    previewModal,
    chatMessages,
    chatHistory,
    latestHistoryChat,
    latestRetryableAssistantMessageId,
    composerImages,
    rateLimits,
  };

  const panelActions: TTADialogPanelActions = {
    onStartNewChat: () => {
      handleStartNewChat();
    },
    onToggleHistory: () => {
      if (isHistoryVisible) {
        hideHistoryAndFocusComposer();
        return;
      }
      setIsHistoryVisible(true);
    },
    onTogglePinned: () => {
      setIsPinned((prev) => !prev);
    },
    onClose: handleClose,
    onClosePreviewModal: closePreviewModal,
    onOpenPreviewModal: openPreviewModal,
    onInsertResult: handleInsertResult,
    onRetry: (messageId) => {
      handleRetry(messageId);
    },
    onRequestDelete: requestDelete,
    scrollChatToBottom,
    onDismissSupportBanner: dismissSupportBanner,
    onSelectHistoryChat: handleSelectChat,
    onDeleteHistoryChat: handleDeleteChat,
    onRenameHistoryChat: handleRenameChat,
    onHideHistory: hideHistoryAndFocusComposer,
  };

  return (
    <>
      <TTADialogTrigger
        isOpen={isOpen}
        isPinned={isPinned}
        hasOpenSidebar={Boolean(openSidebar)}
        onToggle={() => {
          setIsOpen((prev) => !prev);
        }}
      >
        <TTADialogPanel
          view={panelView}
          actions={panelActions}
          chatHistoryRef={chatHistoryRef}
          composer={composerJSX}
          renderWelcomeScreen={renderWelcomeScreen}
          renderWarning={renderWarning}
        />
      </TTADialogTrigger>
      {pendingDeleteMessageId && (
        <ConfirmDialog
          title={t("ai.chat.actions.delete")}
          closeOnClickOutside
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
          confirmText={t("ai.chat.actions.delete")}
        >
          <p>
            {pendingDeleteClearsConversation
              ? t("ai.chat.actions.deletePromptFirstTurn")
              : t("ai.chat.actions.deletePrompt")}
          </p>
        </ConfirmDialog>
      )}
    </>
  );
};

export const TTADialog = React.memo((props: TTADialogProps) => {
  const app = useApp();

  if (app.props.aiEnabled === false) {
    return null;
  }

  return <TTADialogContent {...props} />;
});
TTADialog.displayName = "TTADialog";

export default TTADialog;
