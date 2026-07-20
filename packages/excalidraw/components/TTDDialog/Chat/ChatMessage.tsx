import clsx from "clsx";
import React, { useState, useEffect } from "react";

import { t } from "../../../i18n";
import { TrashIcon, codeIcon, stackPushIcon, RetryIcon } from "../../icons";

import {
  ChatMessage as ChatMessageBase,
  ChatMessageActionButton,
} from "../../AI";

import type { TChat, TTTDDialog } from "../types";
import type { AIRateLimitWarningDescriptor } from "../../../aiWarnings";

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

  // --- Warning message (rate limit) ---
  if (message.type === "warning") {
    const warning: AIRateLimitWarningDescriptor = {
      kind: "rateLimit",
      variant: message.warningType ?? "rateLimitExceeded",
    };
    const customOverride = renderWarning?.(warning, message);

    const warningContent =
      customOverride !== undefined
        ? customOverride
        : message.warningType === "messageLimitExceeded"
        ? t("chat.rateLimit.messageLimit")
        : t("chat.rateLimit.generalRateLimit");
    return (
      <ChatMessageBase
        className="ai-chat-message--ttd"
        role="system"
        roleLabel={t("chat.role.system")}
        timestamp={message.timestamp}
        content={warningContent}
      />
    );
  }

  // --- Error node ---
  const errorNode = message.error ? (
    <>
      <div className="ai-chat-message__error-text">{message.content}</div>
      {message.errorType !== "parse" && (
        <div className="ai-chat-message__error-message">
          Error: {message.error || t("chat.errors.generationFailed")}
        </div>
      )}
      {message.errorType === "parse" && allowFixingParseError && (
        <div className="ai-chat-message__error-message">
          <p>{t("chat.errors.invalidDiagram")}</p>
          <div className="ai-chat-message__error-actions">
            {onMermaidTabClick && (
              <button
                className="ai-chat-message__error-link"
                onClick={() => onMermaidTabClick(message)}
                type="button"
              >
                {t("chat.errors.fixInMermaid")}
              </button>
            )}
            {onAiRepairClick && (
              <button
                className="ai-chat-message__error-link"
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
  ) : undefined;

  // --- Actions for assistant messages ---
  const actionsNode =
    message.type === "assistant" && !message.isGenerating ? (
      <>
        {!message.error && onInsertMessage && (
          <ChatMessageActionButton
            icon={stackPushIcon}
            label="To canvas"
            onClick={() => onInsertMessage(message)}
            ariaLabel={t("chat.insert")}
          />
        )}
        {onMermaidTabClick && message.content && (
          <ChatMessageActionButton
            icon={codeIcon}
            label="Edit"
            onClick={() => onMermaidTabClick(message)}
            ariaLabel={t("chat.viewAsMermaid")}
          />
        )}
        {onDeleteMessage && message.errorType !== "network" && (
          <ChatMessageActionButton
            icon={TrashIcon}
            label="Delete"
            onClick={() => onDeleteMessage(message.id)}
            ariaLabel={t("chat.deleteMessage")}
            danger
          />
        )}
        {message.errorType === "network" && onRetry && isLastMessage && (
          <ChatMessageActionButton
            icon={RetryIcon}
            onClick={() => onRetry(message)}
            ariaLabel={t("chat.retry")}
            className={clsx({
              "ai-chat-message__action--invisible": !canRetry,
            })}
          />
        )}
      </>
    ) : undefined;

  const roleLabel =
    message.type === "user" ? t("chat.role.user") : t("chat.role.assistant");

  const visibleContent = message.error ? undefined : message.content;

  return (
    <ChatMessageBase
      className="ai-chat-message--ttd"
      role={message.type === "user" ? "user" : "assistant"}
      roleLabel={roleLabel}
      timestamp={message.timestamp}
      content={visibleContent}
      isGenerating={message.isGenerating}
      error={errorNode}
      actions={actionsNode}
    />
  );
};
