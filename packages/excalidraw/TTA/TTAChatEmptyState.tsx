import { formatTimeToHourMinute } from "@excalidraw/common";

import { useI18n } from "../i18n";

import { getConversationPreviewMessage } from "./chatHelpers";
import { useAIAssistantPreview } from "./useAIAssistantPreview";

import type {
  AssistantMessage,
  ChatConversation,
  TTADialogRenderWelcomeScreen,
  TTARateLimits,
} from "./types";

type TTAChatEmptyStateProps = {
  latestHistoryChat: ChatConversation | null;
  onSelectHistoryChat: (chat: ChatConversation) => void;
  rateLimits: TTARateLimits | null;
  renderWelcomeScreen?: TTADialogRenderWelcomeScreen;
};

export const TTAChatEmptyState = ({
  latestHistoryChat,
  onSelectHistoryChat,
  rateLimits,
  renderWelcomeScreen,
}: TTAChatEmptyStateProps) => {
  const { t } = useI18n();
  const previewMessage = latestHistoryChat
    ? getConversationPreviewMessage(latestHistoryChat.messages)
    : null;
  const renderedWelcomeScreen = renderWelcomeScreen?.({ rateLimits });

  return (
    <div className="tta-chat-empty-state">
      {latestHistoryChat && (
        <div className="tta-chat-empty-top">
          <button
            type="button"
            className="tta-chat-empty-resume-card"
            onClick={() => onSelectHistoryChat(latestHistoryChat)}
          >
            <div className="tta-chat-empty-resume-card__preview">
              {previewMessage ? (
                <TTAChatEmptyStatePreview
                  message={previewMessage}
                  alt={t("ai.chat.preview")}
                />
              ) : (
                <div className="tta-chat-empty-resume-card__placeholder" />
              )}
            </div>
            <div className="tta-chat-empty-resume-card__content">
              <div className="tta-chat-empty-resume-card__label">
                {t("ai.chat.emptyState.resume")}
              </div>
              <div className="tta-chat-empty-resume-card__title">
                {latestHistoryChat.title}
              </div>
              <div className="tta-chat-empty-resume-card__meta">
                {t("ai.chat.emptyState.lastUpdated", {
                  time: formatTimeToHourMinute(latestHistoryChat.updatedAt),
                })}
              </div>
            </div>
          </button>
        </div>
      )}
      <div className="tta-chat-empty-middle">
        <div className="tta-chat-empty-intro">
          {renderedWelcomeScreen !== undefined ? (
            renderedWelcomeScreen
          ) : (
            <div className="tta-chat-empty-tagline">
              {t("ai.chat.emptyState.guidance")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TTAChatEmptyStatePreview = ({
  message,
  alt,
}: {
  message: AssistantMessage;
  alt: string;
}) => {
  const { previewSvg } = useAIAssistantPreview(message);

  return previewSvg ? (
    <img src={previewSvg} alt={alt} />
  ) : (
    <div className="tta-chat-empty-resume-card__placeholder" />
  );
};
