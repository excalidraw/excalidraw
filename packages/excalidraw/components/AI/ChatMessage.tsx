import React, { type ReactNode } from "react";
import clsx from "clsx";

import "./ChatMessage.scss";

// --- Action Button ---

export interface ChatMessageActionButtonProps {
  icon: ReactNode;
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  hidden?: boolean;
  className?: string;
  ariaLabel: string;
  title?: string;
}

export const ChatMessageActionButton: React.FC<
  ChatMessageActionButtonProps
> = ({
  icon,
  label,
  onClick,
  disabled,
  danger,
  hidden,
  className,
  ariaLabel,
  title,
}) => {
  if (hidden) {
    return null;
  }
  return (
    <button
      type="button"
      className={clsx(
        "ai-chat-message__action",
        { "ai-chat-message__action--danger": danger },
        className,
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
    >
      {icon}
      {label && <span className="ai-chat-message__action__label">{label}</span>}
    </button>
  );
};

// --- Main ChatMessage ---

export interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  roleLabel: string;
  timestamp?: Date | number;
  content?: ReactNode;

  images?: string[];
  onImageClick?: (url: string) => void;

  isGenerating?: boolean;
  previewSvg?: string | null;
  onPreviewClick?: () => void;
  onPreviewLoad?: () => void;
  previewLabel?: string;

  error?: ReactNode;
  statusLine?: ReactNode;
  actions?: ReactNode;

  className?: string;
  containerRef?: React.Ref<HTMLDivElement>;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  role,
  roleLabel,
  content,
  images,
  onImageClick,
  isGenerating,
  previewSvg,
  onPreviewClick,
  onPreviewLoad,
  previewLabel,
  error,
  statusLine,
  actions,
  className,
  containerRef,
}) => {
  const hasError = Boolean(error);
  const imageUrls = images ?? [];

  const containerClass = clsx(
    "ai-chat-message",
    {
      "ai-chat-message--user": role === "user",
      "ai-chat-message--assistant": role === "assistant",
      "ai-chat-message--system": role === "system",
      "ai-chat-message--error": hasError,
    },
    className,
  );

  return (
    <div className={containerClass} ref={containerRef}>
      <div className="ai-chat-message__bubble">
        <div className="ai-chat-message__header">
          <div className="ai-chat-message__header-label">{roleLabel}</div>
        </div>

        {imageUrls.map((image, index) => (
          <div
            key={`${index}-${image}`}
            className="ai-chat-message__image"
            role="button"
            tabIndex={0}
            onClick={() => onImageClick?.(image)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onImageClick?.(image);
              }
            }}
          >
            <img src={image} alt="User upload" />
          </div>
        ))}

        {content != null && (
          <div
            className={clsx("ai-chat-message__content", {
              "ai-chat-message__content--pending": isGenerating,
            })}
          >
            {content}
            {isGenerating && <span className="ai-chat-message__cursor">▋</span>}
          </div>
        )}

        {previewSvg && (
          <div
            className="ai-chat-message__preview"
            role="button"
            tabIndex={0}
            aria-label={previewLabel}
            onClick={onPreviewClick}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onPreviewClick?.();
              }
            }}
          >
            <img
              src={previewSvg}
              alt={previewLabel ?? ""}
              onLoad={onPreviewLoad}
            />
          </div>
        )}

        {error}

        {statusLine && (
          <div className="ai-chat-message__status-line">
            <br />
            {statusLine}
          </div>
        )}
      </div>

      {actions && <div className="ai-chat-message__actions">{actions}</div>}
    </div>
  );
};
