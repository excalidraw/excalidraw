import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";

import { useI18n } from "../i18n";
import {
  CloseIcon,
  searchIcon,
  checkIcon,
  FreedrawIcon,
  TrashIcon,
} from "../components/icons";

import "./TTADialog.scss";

import {
  compareConversationsByUpdatedAt,
  getConversationMessages,
  getConversationPreviewMessage,
} from "./chatHelpers";
import { useAIAssistantPreview } from "./useAIAssistantPreview";

import type { AssistantChatMessage, ChatConversation } from "./types";

export interface TTAHistoryProps {
  history: ChatConversation[];
  onSelectChat: (chat: ChatConversation) => void;
  onDeleteChat: (chatId: string) => void;
  onRenameChat: (chatId: string, newTitle: string) => void;
  onClose: () => void;
}

const TTAHistoryThumbnailPlaceholder = () => (
  <div className="tta-history__thumb">
    <img src="/tta-chat-empty.svg" alt="" />
  </div>
);

const TTAHistoryThumbnail = ({
  chatId,
  isVisible,
  message,
}: {
  chatId: string;
  isVisible: boolean;
  message: AssistantChatMessage;
}) => {
  const { previewSvg } = useAIAssistantPreview(message, {
    enabled: isVisible,
  });

  return (
    <div className="tta-history__thumb" data-chat-id={chatId}>
      <img src={previewSvg || "/tta-chat-empty.svg"} alt="" />
    </div>
  );
};

export const TTAHistory: React.FC<TTAHistoryProps> = ({
  history,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onClose,
}) => {
  const { t } = useI18n();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const historyListRef = useRef<HTMLDivElement>(null);
  const [visiblePreviewChatIds, setVisiblePreviewChatIds] = useState<
    Set<string>
  >(() => new Set());
  const visiblePreviewChatIdsRef = useRef<Set<string>>(new Set());
  const [historySearch, setHistorySearch] = useState("");
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Handle Escape key to close history or cancel editing
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (editingChatId) {
        setEditingChatId(null);
        event.stopPropagation();
        return;
      }

      if (historySearch) {
        setHistorySearch("");
        event.preventDefault();
        return;
      }

      onClose();
      event.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [editingChatId, historySearch, onClose]);

  const handleStartRename = (chat: ChatConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditingTitle(chat.title);
  };

  const handleConfirmRename = (chatId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editingTitle.trim()) {
      onRenameChat(chatId, editingTitle.trim());
    }
    setEditingChatId(null);
    setEditingTitle("");
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(null);
    setEditingTitle("");
  };

  const normalizedSearch = historySearch.trim().toLowerCase();
  const filteredHistory = useMemo(
    () =>
      history
        .filter((item) => {
          if (!normalizedSearch) {
            return true;
          }
          return (
            item.title.toLowerCase().includes(normalizedSearch) ||
            item.turns.some((turn) => {
              return turn.prompt.toLowerCase().includes(normalizedSearch);
            })
          );
        })
        .sort(compareConversationsByUpdatedAt),
    [history, normalizedSearch],
  );

  const markPreviewChatIdsVisible = useCallback((chatIds: string[]) => {
    if (!chatIds.length) {
      return;
    }

    setVisiblePreviewChatIds((prev) => {
      const next = new Set(prev);
      let didChange = false;
      for (const chatId of chatIds) {
        if (next.has(chatId)) {
          continue;
        }
        next.add(chatId);
        didChange = true;
      }

      if (!didChange) {
        return prev;
      }

      visiblePreviewChatIdsRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    const historyList = historyListRef.current;
    if (!historyList) {
      return;
    }

    const thumbnailElements = Array.from(
      historyList.querySelectorAll<HTMLElement>(
        ".tta-history__thumb[data-chat-id]",
      ),
    );
    if (!thumbnailElements.length) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      markPreviewChatIdsVisible(
        thumbnailElements
          .map((element) => element.dataset.chatId)
          .filter((chatId): chatId is string => Boolean(chatId)),
      );
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const intersectingChatIds: string[] = [];
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          const target = entry.target as HTMLElement;
          const chatId = target.dataset.chatId;
          if (!chatId) {
            continue;
          }

          intersectingChatIds.push(chatId);
          observer.unobserve(target);
        }

        markPreviewChatIdsVisible(intersectingChatIds);
      },
      {
        root: historyList,
        rootMargin: "160px 0px",
      },
    );

    for (const element of thumbnailElements) {
      const chatId = element.dataset.chatId;
      if (!chatId || visiblePreviewChatIdsRef.current.has(chatId)) {
        continue;
      }
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [filteredHistory, markPreviewChatIdsVisible]);

  return (
    <div className="tta-history">
      <div className="tta-history__header">
        <div className="tta-history__title">
          {t("ai.chat.historyPanel.title")}
        </div>
        <button
          type="button"
          className="tta-history__back-button"
          onClick={onClose}
          aria-label={t("ai.chat.historyPanel.back")}
        >
          {t("ai.chat.historyPanel.back")}
        </button>
      </div>

      <div className="tta-history__controls">
        <div className="tta-history__search">
          <span className="tta-history__search-icon" aria-hidden="true">
            {searchIcon}
          </span>
          <input
            ref={searchInputRef}
            placeholder={t("ai.chat.historyPanel.searchPlaceholder")}
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
          />
        </div>
      </div>

      {filteredHistory.length === 0 ? (
        <div className="tta-history__empty">
          {t("ai.chat.historyPanel.noChats")}
        </div>
      ) : (
        <div className="tta-history__list" ref={historyListRef}>
          {filteredHistory.map((item) => {
            const isEditing = editingChatId === item.id;
            const previewMessage = getConversationPreviewMessage(
              getConversationMessages(item),
            );
            return (
              <div
                key={item.id}
                className="tta-history__item"
                onClick={() => !isEditing && onSelectChat(item)}
              >
                {previewMessage ? (
                  <TTAHistoryThumbnail
                    chatId={item.id}
                    isVisible={visiblePreviewChatIds.has(item.id)}
                    message={previewMessage}
                  />
                ) : (
                  <TTAHistoryThumbnailPlaceholder />
                )}
                <div className="tta-history__details">
                  <div className="tta-history__header-row">
                    {isEditing ? (
                      <div className="tta-history__item-title-edit">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.stopPropagation();
                              handleConfirmRename(item.id);
                            } else if (e.key === "Escape") {
                              e.stopPropagation();
                              setEditingChatId(null);
                            }
                          }}
                          autoFocus
                          className="tta-history__rename-input"
                        />
                        <div className="tta-history__edit-actions">
                          <button
                            type="button"
                            className="tta-panel__icon-button tta-panel__icon-button--confirm"
                            onClick={(e) => handleConfirmRename(item.id, e)}
                            title={t("ai.chat.historyPanel.confirm")}
                          >
                            {checkIcon}
                          </button>
                          <button
                            type="button"
                            className="tta-panel__icon-button tta-panel__icon-button--cancel"
                            onClick={handleCancelRename}
                            title={t("ai.chat.historyPanel.cancel")}
                          >
                            {CloseIcon}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="tta-history__item-title">
                          {item.title}
                        </div>
                        <div className="tta-history__actions">
                          <button
                            type="button"
                            className="tta-panel__icon-button"
                            onClick={(e) => handleStartRename(item, e)}
                            title={t("ai.chat.historyPanel.rename")}
                          >
                            {FreedrawIcon}
                          </button>
                          <button
                            type="button"
                            className="tta-panel__icon-button tta-history__action-button--delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteChat(item.id);
                            }}
                            title={t("ai.chat.historyPanel.delete")}
                          >
                            {TrashIcon}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
