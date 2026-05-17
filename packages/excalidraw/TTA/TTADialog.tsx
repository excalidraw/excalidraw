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
  getConversationMessages,
  getLatestAssistantMessageId,
  getLatestRetryableAssistantMessage,
  getTurnStartIndexForAssistantDelete,
  stopIncompleteAssistantMessages,
} from "./chatHelpers";
import { isAIChatErrorHandled } from "./chatErrors";
import { useAIStreamingLifecycle } from "./useAIStreamingLifecycle";
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
export const ttaChatMessagesAtom = atom<ChatMessage[]>([]);
export const ttaRateLimitsAtom = atom<TTARateLimits | null>(null);

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
  const [isSendingChat, setIsSendingChat] = useState(false);

  // History Overlay State
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const {
    activeChatId,
    chatHistory,
    latestHistoryChat,
    saveConversationToHistory,
    setActiveChatId,
    setActiveChatUpdatedAt,
    setChatHistory,
  } = useTTAChatHistory({
    chatMessages,
    persistenceAdapter,
  });

  const openSidebar = useAppStateValue("openSidebar");

  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const chatIdRef = useRef<string | null>(null);
  const pendingGenerationReplacementTagsRef = useRef<string[]>([]);
  const previousIsOpenRef = useRef(isOpen);
  const previousChatMessageCountRef = useRef(chatMessages.length);

  useEffect(() => {
    chatIdRef.current = activeChatId || null;
  }, [activeChatId]);

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
      latestMessage.error &&
      !latestMessage.warningType
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

  const applyServerChatId = useCallback(
    (nextChatId?: string | null) => {
      if (!nextChatId) {
        return;
      }
      const previousChatId = chatIdRef.current;
      if (previousChatId === nextChatId) {
        setActiveChatId((prev) => (prev === nextChatId ? prev : nextChatId));
        return;
      }
      chatIdRef.current = nextChatId;
      setActiveChatId(nextChatId);
      if (!previousChatId) {
        return;
      }
      setChatHistory((prev) => {
        const existingIndex = prev.findIndex(
          (chat) => chat.id === previousChatId,
        );
        if (existingIndex === -1) {
          return prev;
        }
        if (prev.some((chat) => chat.id === nextChatId)) {
          return prev.filter((chat) => chat.id !== previousChatId);
        }
        const copy = [...prev];
        copy[existingIndex] = { ...copy[existingIndex], id: nextChatId };
        return copy;
      });
    },
    [setActiveChatId, setChatHistory],
  );

  const getServerChatId = useCallback(() => {
    return chatIdRef.current || activeChatId || null;
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
      const targetChatId = chatId || chatIdRef.current || activeChatId;
      if (targetChatId) {
        updateHistoryChatUpdatedAt(targetChatId, updatedAt);
      }
    },
    [activeChatId, setActiveChatUpdatedAt, updateHistoryChatUpdatedAt],
  );

  const applyServerChatMetadata = useCallback(
    (metadata: {
      chatId?: string | null;
      turnId?: string | null;
      messageId?: string | null;
      updatedAt?: number | null;
    }) => {
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

  useEffect(() => {
    const wasOpen = previousIsOpenRef.current;
    previousIsOpenRef.current = isOpen;

    if (!isOpen || wasOpen || !chatMessages.length) {
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

  useEffect(() => {
    const previousMessageCount = previousChatMessageCountRef.current;
    const didAppendMessage = chatMessages.length > previousMessageCount;
    previousChatMessageCountRef.current = chatMessages.length;

    if (!didAppendMessage) {
      return;
    }
    const frameId = requestAnimationFrame(() => {
      scrollChatToBottom();
    });
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [chatMessages.length, scrollChatToBottom]);

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
        return entry.role === "assistant" && entry.messageId === messageId;
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
    t,
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
        setChatMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            lifecycleStatus: "pending",
            progressPhase: "starting",
            statusText: retryContext
              ? retryContext.reason === "generation_error"
                ? t("ai.chat.status.retrying")
                : t("ai.chat.status.regenerating")
              : "",
            createdAt: generationStartedAt,
            generationStartedAt,
            generationElapsedMs: undefined,
            isComplete: false,
          },
        ]);
      }

      await generateResponse(assistantId, payload);
    },
    [generateResponse, getServerChatId, setChatMessages, t],
  );

  const sendChatPrompt = async (prompt?: string, images?: string[]) => {
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
    setStopRequested(false);
    touchActiveChatUpdatedAt();
    setChatMessages((prev) => [...prev, userMessage]);
    setComposerInputValue("");
    setComposerImages([]);
    setIsSendingChat(true);

    try {
      const conversation = [...chatMessages, userMessage];
      clearStreamingCanvasPreview();

      if (lastAssistantMessageId) {
        queueGenerationReplacement(lastAssistantMessageId);
      }

      await streamAssistantResponse(conversation);
      return;
    } catch (err) {
      console.error("[AI Chat] error:", err);
      clearStreamingCanvasPreview();
      if (!isAIChatErrorHandled(err)) {
        const message = err instanceof Error ? err.message : String(err);
        setChatMessages((prev) => [
          ...prev,
          {
            id: `assistant-${randomId()}`,
            role: "assistant",
            createdAt: Date.now(),
            error: { message },
            isComplete: true,
          },
        ]);
      }
    } finally {
      setIsSendingChat(false);
    }
  };

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
      chatIdRef.current = null;
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
      setChatHistory((prev) =>
        prev.map((chat) =>
          chat.id === chatId ? { ...chat, title: newTitle } : chat,
        ),
      );
    },
    [setChatHistory],
  );

  const handleDeleteChat = useCallback(
    (chatId: string) => {
      setChatHistory((prev) => prev.filter((chat) => chat.id !== chatId));
      if (activeChatId === chatId) {
        handleStartNewChat({ saveCurrentToHistory: false });
      }
    },
    [activeChatId, handleStartNewChat, setChatHistory],
  );

  const handleSelectChat = useCallback(
    (chat: ChatConversation) => {
      clearQueuedGenerationReplacements();
      setChatMessages(
        stopIncompleteAssistantMessages(getConversationMessages(chat)),
      );
      chatIdRef.current = chat.id;
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
    ],
  );

  const hideHistoryAndFocusComposer = useCallback(() => {
    setIsHistoryVisible(false);
    requestAnimationFrame(() => {
      focusComposerInput();
    });
  }, [focusComposerInput]);

  const handleRetry = useCallback(
    async (messageId: string) => {
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
        !message.isComplete ||
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

      cancelActiveStream();
      cancelPendingCanvasPreviewRenders();
      touchActiveChatUpdatedAt();

      const isErrorRetry = Boolean(message.error);
      clearStreamingCanvasPreview();
      if (!isErrorRetry) {
        queueGenerationReplacement(message.messageId ?? null);
      }

      const retryAssistantId = isErrorRetry
        ? messageId
        : `assistant-${randomId()}`;
      const retryingText = isErrorRetry
        ? t("ai.chat.status.retrying")
        : t("ai.chat.status.regenerating");
      const retryStartedAt = Date.now();
      if (isErrorRetry) {
        setChatMessages((prev) =>
          prev.map((entry) =>
            entry.id === messageId && entry.role === "assistant"
              ? {
                  ...entry,
                  lifecycleStatus: "pending",
                  progressPhase: "starting",
                  statusText: retryingText,
                  createdAt: retryStartedAt,
                  generationStartedAt: retryStartedAt,
                  generationElapsedMs: undefined,
                  error: undefined,
                  isComplete: false,
                  stopReason: undefined,
                  turnId: undefined,
                  messageId: undefined,
                  skeletons: undefined,
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
            lifecycleStatus: "pending",
            progressPhase: "starting",
            statusText: retryingText,
            createdAt: retryStartedAt,
            generationStartedAt: retryStartedAt,
            generationElapsedMs: undefined,
            isComplete: false,
          },
        ]);
      }

      await new Promise((resolve) =>
        setTimeout(resolve, MIN_RETRYING_VISIBLE_MS),
      );

      const conversationToRetry = chatMessages.slice(
        0,
        retryUserMessageIndex + 1,
      );
      setStopRequested(false);
      setIsSendingChat(true);

      try {
        const retryImage = await (!isErrorRetry
          ? exportImageFromMessageSkeletons(message.messageId)
          : undefined);

        await streamAssistantResponse(
          conversationToRetry,
          {
            reason: isErrorRetry ? "generation_error" : "user_not_happy",
            avoidSimilarity: !isErrorRetry,
            retryAssistantMessageId: message.messageId,
          },
          {
            assistantId: retryAssistantId,
            insertAssistantMessage: false,
            images: retryImage ? [retryImage] : undefined,
          },
        );
      } finally {
        setIsSendingChat(false);
      }
    },
    [
      chatMessages,
      cancelActiveStream,
      cancelPendingCanvasPreviewRenders,
      clearStreamingCanvasPreview,
      latestRetryableAssistantMessageId,
      queueGenerationReplacement,
      rateLimits?.rateLimitRemaining,
      setChatMessages,
      setStopRequested,
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

      // Cancel any in-flight generation and remove draft preview elements.
      setStopRequested(true);
      cancelActiveStream();
      setIsSendingChat(false);
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
        setChatHistory((prev) =>
          prev.filter((chat) => chat.id !== activeChatId),
        );
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
        chatIdRef.current = null;
        setActiveChatUpdatedAt(null);
        setActiveChatId("");
        return;
      }

      // Sync server chat context so future generations don't include deleted turns.
      try {
        const lastAssistant = [...truncated]
          .reverse()
          .find((entry) => entry.role === "assistant" && entry.turnId);
        const currentChatId = getServerChatId();
        if (currentChatId && lastAssistant?.turnId) {
          const response = await transportAdapter.truncate({
            chatId: currentChatId,
            keepThroughTurnId: lastAssistant.turnId,
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
          latestAssistant.messageId ?? `ai-delete-${latestAssistant.id}`;
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
      getServerChatId,
      applyActiveChatUpdatedAt,
      removeGeneratedElementsByGenerationTags,
      setActiveChatId,
      setActiveChatUpdatedAt,
      setChatHistory,
      setComposerImages,
      setComposerInputValue,
      setChatMessages,
      setIsHistoryVisible,
      setIsSendingChat,
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
    setStopRequested(true);
    cancelActiveStream();
    cancelPendingCanvasPreviewRenders();
    commitStreamingCanvasPreview();
    touchActiveChatUpdatedAt();

    // Mark the last assistant message as stopped/complete.
    setChatMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.role === "assistant" && !lastMsg.isComplete) {
        return [
          ...prev.slice(0, -1),
          {
            ...lastMsg,
            lifecycleStatus: "aborted",
            progressPhase: undefined,
            statusText: undefined,
            generationElapsedMs: Math.max(
              0,
              Date.now() -
                (lastMsg.generationStartedAt ??
                  lastMsg.createdAt ??
                  Date.now()),
            ),
            isComplete: true,
            stopReason: "user",
          },
        ];
      }
      return prev;
    });
  }, [
    cancelActiveStream,
    cancelPendingCanvasPreviewRenders,
    commitStreamingCanvasPreview,
    setChatMessages,
    setStopRequested,
    touchActiveChatUpdatedAt,
  ]);

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
