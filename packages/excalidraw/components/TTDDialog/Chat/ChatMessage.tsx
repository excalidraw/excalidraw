import clsx from "clsx";
import React, { useState, useEffect } from "react";

import { t } from "../../../i18n";
import { FilledButton } from "../../FilledButton";
import { TrashIcon, codeIcon, stackPushIcon, RetryIcon } from "../../icons";

import { tokenizeMermaid } from "../mermaid-highlighting";

import type { TChat, TTTDDialog } from "../types";

const isMermaidMessage = (message: TChat.ChatMessage) =>
  message.contentFormat === "mermaid";

const renderMessageContent = (
  message: TChat.ChatMessage,
  className: string,
) => {
  const content = message.content ?? "";

  console.log("@", message);

  if (!isMermaidMessage(message)) {
    return (
      <div className={className}>
        {content}
        {message.isGenerating && (
          <span className="chat-message__cursor">▋</span>
        )}
      </div>
    );
  }

  return (
    <div className={clsx(className, "chat-message__text--mermaid")}>
      {tokenizeMermaid(content).map((token, index) => (
        <span
          key={`${index}-${token.type ?? "text"}-${token.value}`}
          className={clsx("chat-message__token", {
            [`chat-message__token--${token.type}`]: token.type,
          })}
        >
          {token.value}
        </span>
      ))}
      {message.isGenerating && <span className="chat-message__cursor">▋</span>}
    </div>
  );
};

export const ChatMessage: React.FC<{
  message: TChat.ChatMessage;
  onMermaidTabClick?: (message: TChat.ChatMessage) => void;
  onAiRepairClick?: (message: TChat.ChatMessage) => void;
  onDeleteMessage?: (messageId: string) => void;
  onInsertMessage?: (message: TChat.ChatMessage) => void;
  onRetry?: (message: TChat.ChatMessage) => void;
  rateLimitRemaining?: number;
  isLastMessage?: boolean;
  renderWarning?: TTTDDialog.renderWarning;
  allowFixingParseError?: boolean;
}> = ({
  message,
  onMermaidTabClick,
  onAiRepairClick,
  onDeleteMessage,
  onInsertMessage,
  onRetry,
  rateLimitRemaining,
  isLastMessage,
  renderWarning,
  allowFixingParseError,
}) => {
  const [canRetry, setCanRetry] = useState(false);

  useEffect(() => {
    if (!message.error || !isLastMessage) {
      return;
    }

    if (message.error && !message.lastAttemptAt) {
      setCanRetry(true);
      return;
    }

    const timeSinceLastAttempt = Date.now() - message.lastAttemptAt!;
    const remainingTime = Math.max(0, 5000 - timeSinceLastAttempt);

    if (remainingTime === 0) {
      setCanRetry(true);
      return;
    }

    setCanRetry(false);
    const timer = setTimeout(() => {
      setCanRetry(true);
    }, remainingTime);

    return () => clearTimeout(timer);
  }, [message.error, message.lastAttemptAt, isLastMessage]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (message.type === "warning") {
    const customOverride = renderWarning?.(message);
    return (
      <div className="chat-message chat-message--system">
        <div className="chat-message__content">
          <div className="chat-message__header">
            <span className="chat-message__role">{t("chat.role.system")}</span>
            <span className="chat-message__timestamp">
              {formatTime(message.timestamp)}
            </span>
          </div>
          <div className="chat-message__body">
            <div className="chat-message__text">
              {customOverride ? (
                customOverride
              ) : message.warningType === "messageLimitExceeded" ? (
                <>
                  {t("chat.rateLimit.messageLimit")}
                  <div style={{ marginTop: "10px" }}>
                    <FilledButton
                      onClick={() => {
                        window.open(
                          `${
                            import.meta.env.VITE_APP_PLUS_LP
                          }/plus?utm_source=excalidraw&utm_medium=app&utm_content=ttdChatBanner#excalidraw-redirect`,
                          "_blank",
                          "noopener",
                        );
                      }}
                    >
                      {t("chat.upsellBtnLabel")}
                    </FilledButton>
                  </div>
                </>
              ) : (
                t("chat.rateLimit.generalRateLimit")
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-message chat-message--${message.type}`}>
      <div className="chat-message__content">
        <div className="chat-message__header">
          <span className="chat-message__role">
            {message.type === "user"
              ? t("chat.role.user")
              : t("chat.role.assistant")}
          </span>
          <span className="chat-message__timestamp">
            {formatTime(message.timestamp)}
          </span>
        </div>
        <div className="chat-message__body">
          {message.error ? (
            <>
              <div className="chat-message__error">
                {renderMessageContent(
                  message,
                  clsx("chat-message__text", {
                    "chat-message__text--error": !isMermaidMessage(message),
                  }),
                )}
              </div>
              {message.errorType !== "parse" && (
                <div className="chat-message__error_message">
                  Error: {message.error || t("chat.errors.generationFailed")}
                </div>
              )}
              {message.errorType === "parse" && allowFixingParseError && (
                <div className="chat-message__error_message">
                  <p>{t("chat.errors.invalidDiagram")}</p>
                  <div className="chat-message__error-actions">
                    {onMermaidTabClick && isMermaidMessage(message) && (
                      <button
                        className="chat-message__error-link"
                        onClick={() => onMermaidTabClick(message)}
                        type="button"
                      >
                        {t("chat.errors.fixInMermaid")}
                      </button>
                    )}
                    {onAiRepairClick && (
                      <button
                        className="chat-message__error-link"
                        onClick={() => onAiRepairClick(message)}
                        disabled={rateLimitRemaining === 0}
                        type="button"
                      >
                        {t("chat.errors.aiRepair")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            renderMessageContent(message, "chat-message__text")
          )}
        </div>
      </div>
      {message.type === "assistant" && !message.isGenerating && (
        <div className="chat-message__actions">
          {!message.error && onInsertMessage && isMermaidMessage(message) && (
            <button
              className="chat-message__action"
              onClick={() => onInsertMessage(message)}
              type="button"
              aria-label={t("chat.insert")}
              title={t("chat.insert")}
            >
              {stackPushIcon}
            </button>
          )}
          {onMermaidTabClick && isMermaidMessage(message) && message.content && (
            <button
              className="chat-message__action"
              onClick={() => onMermaidTabClick(message)}
              type="button"
              aria-label={t("chat.viewAsMermaid")}
              title={t("chat.viewAsMermaid")}
            >
              {codeIcon}
            </button>
          )}
          {onDeleteMessage && message.errorType !== "network" && (
            <button
              className="chat-message__action chat-message__action--danger"
              onClick={() => onDeleteMessage(message.id)}
              type="button"
              aria-label={t("chat.deleteMessage")}
              title={t("chat.deleteMessage")}
            >
              {TrashIcon}
            </button>
          )}
          {message.errorType === "network" && onRetry && isLastMessage && (
            <button
              className={clsx("chat-message__action", { invisible: !canRetry })}
              onClick={() => onRetry(message)}
              type="button"
              aria-label={t("chat.retry")}
              title={t("chat.retry")}
            >
              {RetryIcon}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
