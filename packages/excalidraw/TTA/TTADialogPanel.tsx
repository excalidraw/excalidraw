import clsx from "clsx";

import { FilledButton } from "../components/FilledButton";
import { CloseIcon, PinIcon, historyIcon } from "../components/icons";
import { Modal } from "../components/Modal";
import { Tooltip } from "../components/Tooltip";
import { useI18n } from "../i18n";

import { TTAChatEmptyState } from "./TTAChatEmptyState";
import { TTAChatMessage } from "./TTAChatMessage";
import { TTAHistory } from "./TTAHistory";

import type { ReactNode, RefObject } from "react";
import type {
  ChatMessage,
  ChatConversation,
  TTAChatScrollOptions,
  TTADialogRenderWelcomeScreen,
  TTADialogRenderWarning,
  TTARateLimits,
} from "./types";

const AI_SUPPORT_GITHUB_ISSUES_URL =
  "https://github.com/excalidraw/excalidraw/issues";
const AI_SUPPORT_DISCORD_URL = "https://discord.gg/UexuTaE";

export type TTAPreviewModalState = {
  image: string;
  titleKey: "ai.chat.generatedResult" | "ai.chat.attachedImage";
};

export type TTADialogPanelView = {
  hasConversation: boolean;
  isSendingChat: boolean;
  isHistoryVisible: boolean;
  isPinned: boolean;
  shouldShowSupportBanner: boolean;
  composerInputValue: string;
  composerImages: readonly unknown[];
  previewModal: TTAPreviewModalState | null;
  chatMessages: ChatMessage[];
  chatHistory: ChatConversation[];
  latestHistoryChat: ChatConversation | null;
  latestRetryableAssistantMessageId: string | null;
  rateLimits: TTARateLimits | null;
  /** A ConfirmDialog is open on top of the panel (suspends overlay Escape). */
  isConfirmDialogOpen: boolean;
};

export type TTADialogPanelActions = {
  onStartNewChat: () => void;
  onToggleHistory: () => void;
  onTogglePinned: () => void;
  onClose: () => void;
  onClosePreviewModal: () => void;
  onOpenPreviewModal: (
    image: string,
    titleKey?: TTAPreviewModalState["titleKey"],
  ) => void;
  onInsertResult: (message: ChatMessage) => void;
  onRetry: (messageId: string) => void;
  /** Re-runs a trailing prompt-only user turn as a fresh send (§5.8). */
  onRerunMessage: (message: ChatMessage) => void;
  onRequestDelete: (messageId: string) => void;
  scrollChatToBottom: (options?: TTAChatScrollOptions) => void;
  onDismissSupportBanner: () => void;
  onSelectHistoryChat: (chat: ChatConversation) => void;
  onDeleteHistoryChat: (chatId: string) => void;
  onRenameHistoryChat: (chatId: string, newTitle: string) => void;
  onHideHistory: () => void;
};

export type TTADialogPanelProps = {
  view: TTADialogPanelView;
  actions: TTADialogPanelActions;
  chatHistoryRef: RefObject<HTMLDivElement | null>;
  composer: ReactNode;
  renderWelcomeScreen?: TTADialogRenderWelcomeScreen;
  renderWarning?: TTADialogRenderWarning;
};

type TTADialogPanelHeaderProps = {
  hasConversation: boolean;
  isSendingChat: boolean;
  isHistoryVisible: boolean;
  isPinned: boolean;
  onStartNewChat: () => void;
  onToggleHistory: () => void;
  onTogglePinned: () => void;
  onClose: () => void;
};

const TTADialogPanelHeader = ({
  hasConversation,
  isSendingChat,
  isHistoryVisible,
  isPinned,
  onStartNewChat,
  onToggleHistory,
  onTogglePinned,
  onClose,
}: TTADialogPanelHeaderProps) => {
  const { t } = useI18n();

  return (
    <div className="tta-panel__header">
      {hasConversation && (
        <FilledButton
          className=""
          onClick={onStartNewChat}
          disabled={isSendingChat}
          size="small"
        >
          {t("chat.newChat")}
        </FilledButton>
      )}
      <div className="tta-panel__header-actions">
        <Tooltip label={t("ai.chat.history")}>
          <button
            type="button"
            className="tta-panel__icon-button"
            onClick={onToggleHistory}
            aria-pressed={isHistoryVisible}
            aria-label={t("ai.chat.history")}
          >
            {historyIcon}
          </button>
        </Tooltip>
        <Tooltip label={t("ai.chat.keepOpen")}>
          <button
            type="button"
            className={clsx("tta-panel__icon-button ", {
              "tta-panel__icon-button--active": isPinned,
            })}
            onClick={onTogglePinned}
            aria-label={t("ai.chat.keepOpen")}
            aria-pressed={isPinned}
          >
            {PinIcon}
          </button>
        </Tooltip>
        <Tooltip label={t("ai.chat.close")}>
          <button
            type="button"
            className="tta-panel__icon-button"
            onClick={onClose}
            aria-label={t("ai.chat.close")}
          >
            {CloseIcon}
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

const TTADialogPreviewModal = ({
  previewModal,
  onClosePreviewModal,
}: {
  previewModal: TTAPreviewModalState | null;
  onClosePreviewModal: () => void;
}) => {
  const { t } = useI18n();

  if (!previewModal) {
    return null;
  }

  return (
    <Modal
      labelledBy="tta-preview-modal-title"
      maxWidth={720}
      onCloseRequest={onClosePreviewModal}
    >
      <div className="tta-preview-modal">
        <div className="tta-preview-modal__header">
          <h2 id="tta-preview-modal-title" className="tta-preview-modal__title">
            {t(previewModal.titleKey)}
          </h2>
          <button
            type="button"
            className="tta-preview-modal__close"
            onClick={onClosePreviewModal}
            aria-label={t("ai.chat.closePreview")}
          >
            {CloseIcon}
          </button>
        </div>
        <div className="tta-preview-modal__body">
          <img src={previewModal.image} alt={t("ai.chat.enlargedPreview")} />
        </div>
      </div>
    </Modal>
  );
};

const TTADialogPanelBody = ({
  view,
  actions,
  chatHistoryRef,
  renderWelcomeScreen,
  renderWarning,
}: {
  view: Pick<
    TTADialogPanelView,
    | "composerInputValue"
    | "composerImages"
    | "chatMessages"
    | "isSendingChat"
    | "latestHistoryChat"
    | "latestRetryableAssistantMessageId"
    | "rateLimits"
  >;
  actions: Pick<
    TTADialogPanelActions,
    | "onSelectHistoryChat"
    | "onInsertResult"
    | "onRetry"
    | "onRerunMessage"
    | "onRequestDelete"
    | "onOpenPreviewModal"
    | "scrollChatToBottom"
  >;
  chatHistoryRef: RefObject<HTMLDivElement | null>;
  renderWelcomeScreen?: TTADialogRenderWelcomeScreen;
  renderWarning?: TTADialogRenderWarning;
}) => (
  <div className="tta-panel__body">
    <div className="tta-chat-container">
      {!view.chatMessages.length &&
        !view.composerInputValue &&
        !view.composerImages.length && (
          <TTAChatEmptyState
            latestHistoryChat={view.latestHistoryChat}
            onSelectHistoryChat={actions.onSelectHistoryChat}
            rateLimits={view.rateLimits}
            renderWelcomeScreen={renderWelcomeScreen}
          />
        )}
      {!!view.chatMessages.length && (
        <div className="tta-chat-list" ref={chatHistoryRef}>
          {view.chatMessages.map((message, index) => (
            <TTAChatMessage
              key={message.id}
              message={message}
              onInsert={() => actions.onInsertResult(message)}
              onRetry={() => actions.onRetry(message.id)}
              showRetry={
                message.role === "assistant" &&
                message.id === view.latestRetryableAssistantMessageId
              }
              onRerun={() => actions.onRerunMessage(message)}
              showRerun={
                // §5.8 re-run affordance: a trailing user message with no
                // assistant/system reply (reload or switch-away
                // mid-generation) can be run again as a fresh turn — hidden
                // whenever a generation is in flight (single-flight, so also
                // while another chat's generation streams in the background).
                message.role === "user" &&
                index === view.chatMessages.length - 1 &&
                !view.isSendingChat
              }
              rateLimits={view.rateLimits}
              onDelete={() => actions.onRequestDelete(message.id)}
              showDelete={message.role === "assistant"}
              onPreview={(image) =>
                actions.onOpenPreviewModal(
                  image,
                  message.role === "user"
                    ? "ai.chat.attachedImage"
                    : "ai.chat.generatedResult",
                )
              }
              scrollChatToBottom={actions.scrollChatToBottom}
              renderWarning={renderWarning}
            />
          ))}
        </div>
      )}
    </div>
  </div>
);

const TTADialogSupportBanner = ({
  onDismissSupportBanner,
}: {
  onDismissSupportBanner: () => void;
}) => {
  const { t } = useI18n();

  return (
    <div className="tta-panel__support-banner">
      <span className="tta-panel__support-banner-text">
        {t("ai.chat.errors.supportBanner")}
      </span>
      <div className="tta-panel__support-banner-links">
        <a href={AI_SUPPORT_GITHUB_ISSUES_URL} target="_blank" rel="noreferrer">
          {t("ai.chat.errors.githubIssue")}
        </a>
        <span aria-hidden="true">·</span>
        <a href={AI_SUPPORT_DISCORD_URL} target="_blank" rel="noreferrer">
          {t("labels.discordChat")}
        </a>
      </div>
      <button
        type="button"
        className="tta-panel__support-banner-dismiss"
        onClick={onDismissSupportBanner}
        aria-label={t("ai.chat.close")}
      >
        {CloseIcon}
      </button>
    </div>
  );
};

export const TTADialogPanel = ({
  view,
  actions,
  chatHistoryRef,
  composer,
  renderWelcomeScreen,
  renderWarning,
}: TTADialogPanelProps) => (
  <div
    className="tta-panel__surface"
    id="tta-floating-panel"
    role="dialog"
    aria-modal="false"
  >
    <div className={clsx("tta-chat-panel", "tta-chat-panel--floating")}>
      <TTADialogPanelHeader
        hasConversation={view.hasConversation}
        isSendingChat={view.isSendingChat}
        isHistoryVisible={view.isHistoryVisible}
        isPinned={view.isPinned}
        onStartNewChat={actions.onStartNewChat}
        onToggleHistory={actions.onToggleHistory}
        onTogglePinned={actions.onTogglePinned}
        onClose={actions.onClose}
      />

      <TTADialogPreviewModal
        previewModal={view.previewModal}
        onClosePreviewModal={actions.onClosePreviewModal}
      />

      <TTADialogPanelBody
        view={view}
        actions={actions}
        chatHistoryRef={chatHistoryRef}
        renderWelcomeScreen={renderWelcomeScreen}
        renderWarning={renderWarning}
      />

      {view.shouldShowSupportBanner && (
        <TTADialogSupportBanner
          onDismissSupportBanner={actions.onDismissSupportBanner}
        />
      )}

      <div className="tta-panel__footer">{composer}</div>

      {view.isHistoryVisible && (
        <TTAHistory
          history={view.chatHistory}
          onSelectChat={actions.onSelectHistoryChat}
          onDeleteChat={actions.onDeleteHistoryChat}
          onRenameChat={actions.onRenameHistoryChat}
          onClose={actions.onHideHistory}
          suspendEscape={view.isConfirmDialogOpen}
        />
      )}
    </div>
  </div>
);
