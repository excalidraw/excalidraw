import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import React from "react";

import { atom, useAtom } from "../editor-jotai";
import { useApp } from "../components/App";
import ConfirmDialog from "../components/ConfirmDialog";
import { useI18n } from "../i18n";
import { useAppStateValue } from "../hooks/useAppStateValue";

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

import { getTurnStartIndexForAssistantDelete } from "./chatHelpers";
import { useCanvasDraft } from "./useCanvasDraft";
import { useTTAChatActions } from "./useTTAChatActions";
import { useTTAChatHistory } from "./useTTAChatHistory";

import type {
  ChatMessage,
  TTAChatScrollOptions,
  TTADialogRenderWelcomeScreen,
  TTADialogRenderWarning,
  TTAPersistenceAdapter,
  TTARateLimits,
} from "./types";
import type { TTATransportAdapter } from "./client";

// --- Constants & Helpers ---

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

  // History Overlay State
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const history = useTTAChatHistory({
    chatMessages,
    persistenceAdapter,
  });
  const { chatHistory, latestHistoryChat, renameChat } = history;

  const openSidebar = useAppStateValue("openSidebar");

  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const previousIsOpenRef = useRef(isOpen);
  const previousChatMessageCountRef = useRef(chatMessages.length);

  const hasConversation = chatMessages.length > 0;
  const [previewModal, setPreviewModal] = useState<TTAPreviewModalState | null>(
    null,
  );
  const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState<
    string | null
  >(null);
  const [pendingDeleteChatId, setPendingDeleteChatId] = useState<string | null>(
    null,
  );
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

  // --- Chat Actions ---

  // The single canvas-draft owner (tta_rewrite_final.md §2.4): streaming
  // renders, the commit dance, and the generation-replacement queue, keyed by
  // the local generation id (`message.id`).
  const canvasDraft = useCanvasDraft({ app });

  const clearComposer = useCallback(() => {
    setComposerInputValue("");
    setComposerImages([]);
  }, []);

  const hideHistory = useCallback(() => {
    setIsHistoryVisible(false);
  }, []);

  const {
    isSendingChat,
    latestRetryableAssistantMessageId,
    sendChatPrompt,
    stopActiveGeneration,
    handleStartNewChat,
    handleSelectChat,
    handleDeleteChat,
    handleRetry,
    executeDelete,
    handleInsertResult,
  } = useTTAChatActions({
    app,
    t,
    chatMessages,
    setChatMessages,
    canvasDraft,
    transportAdapter,
    history,
    rateLimits,
    onRateLimitInfo: handleRateLimitInfo,
    isPanelOpen: isOpen,
    composerText: composerInputValue,
    clearComposer,
    hideHistory,
    scrollChatToBottom,
    focusComposerInput,
  });

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

  const hideHistoryAndFocusComposer = useCallback(() => {
    setIsHistoryVisible(false);
    requestAnimationFrame(() => {
      focusComposerInput();
    });
  }, [focusComposerInput]);

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

  // History chat delete goes through the same confirm pattern as message
  // delete (tta_rewrite_final.md §8.2) — the delete itself is handled by the
  // actions hook (incl. auto-stopping an in-flight generation, N2).
  const requestDeleteChat = useCallback((chatId: string) => {
    setPendingDeleteChatId(chatId);
  }, []);

  const cancelDeleteChat = useCallback(() => {
    setPendingDeleteChatId(null);
  }, []);

  const confirmDeleteChat = useCallback(() => {
    if (!pendingDeleteChatId) {
      return;
    }
    const chatId = pendingDeleteChatId;
    setPendingDeleteChatId(null);
    handleDeleteChat(chatId);
  }, [handleDeleteChat, pendingDeleteChatId]);

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
    onDeleteHistoryChat: requestDeleteChat,
    onRenameHistoryChat: renameChat,
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
      {pendingDeleteChatId && (
        <ConfirmDialog
          title={t("ai.chat.historyPanel.delete")}
          closeOnClickOutside
          onCancel={cancelDeleteChat}
          onConfirm={confirmDeleteChat}
          confirmText={t("ai.chat.historyPanel.delete")}
        >
          <p>{t("ai.chat.historyPanel.deletePrompt")}</p>
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
