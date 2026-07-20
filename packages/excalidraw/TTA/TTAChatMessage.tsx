import React, { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "../i18n";
import {
  RetryIcon,
  copyIcon,
  tablerCheckIcon as checkIcon,
  TrashIcon,
  stackPushIcon,
} from "../components/icons";

import { ChatMessage, ChatMessageActionButton } from "../components/AI";

import { getAIErrorMessageKey } from "./utils";
import { useAIAssistantPreview } from "./useAIAssistantPreview";

import type {
  AssistantChatMessage,
  ChatMessage as ChatMessageType,
  TTAChatScrollOptions,
  TTADialogRenderWarning,
  UserChatMessage,
} from "./types";
import type { AIRateLimitWarningDescriptor } from "../aiWarnings";

export interface TTAChatMessageProps {
  message: ChatMessageType;
  onInsert: () => void;
  onRetry: () => void;
  showRetry?: boolean;
  onDelete: () => void;
  showDelete?: boolean;
  onPreview: (url: string) => void;
  scrollChatToBottom?: (options?: TTAChatScrollOptions) => void;
  renderWarning?: TTADialogRenderWarning;
  rateLimitRemaining?: number | null;
}

type TTAUserChatMessageProps = Pick<TTAChatMessageProps, "onPreview"> & {
  message: UserChatMessage;
};

const TTAUserChatMessage = ({
  message,
  onPreview,
}: TTAUserChatMessageProps) => {
  const { t } = useI18n();
  const [isCopied, setIsCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);
  const fallbackTimestampRef = useRef<number>(Date.now());

  const handleCopy = useCallback((content: UserChatMessage["content"]) => {
    if (content) {
      navigator.clipboard.writeText(content);
      setIsCopied(true);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const actionsNode = message.content ? (
    <ChatMessageActionButton
      icon={isCopied ? checkIcon : copyIcon}
      onClick={() => handleCopy(message.content)}
      ariaLabel={t("labels.copy")}
      title={t("labels.copy")}
    />
  ) : undefined;

  return (
    <ChatMessage
      role="user"
      roleLabel={t("ai.chat.roles.you")}
      timestamp={message.createdAt ?? fallbackTimestampRef.current}
      content={message.content}
      images={message.images}
      onImageClick={onPreview}
      actions={actionsNode}
    />
  );
};

type TTAAssistantChatMessageProps = Omit<
  TTAChatMessageProps,
  "message" | "onPreview"
> & {
  message: AssistantChatMessage;
};

const TTAAssistantChatMessage = ({
  message,
  onInsert,
  onRetry,
  showRetry = false,
  onDelete,
  showDelete = false,
  scrollChatToBottom,
  renderWarning,
  rateLimitRemaining,
}: TTAAssistantChatMessageProps) => {
  const { t } = useI18n();
  const fallbackTimestampRef = useRef<number>(Date.now());
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const scrolledStreamingPreviewKeyRef = useRef<string | null>(null);
  const pendingStreamingPreviewScrollKeyRef = useRef<string | null>(null);
  const { previewSvg, status: previewStatus } = useAIAssistantPreview(message, {
    enabled: !message.error,
  });

  const isGeneratingPreview = message.isComplete === false;
  const hasCurrentPreview = Boolean(previewSvg);
  const assistantError = message.error;
  const isRateLimitWarning = Boolean(
    assistantError?.code === 429 && message.warningType,
  );

  const handleGeneratedPreviewClick = useCallback(() => {
    if (!message.skeletons?.length) {
      return;
    }
    onInsert();
  }, [message.skeletons?.length, onInsert]);

  const previewKey = message.messageId ?? message.turnId ?? message.id;
  const shouldScrollStreamingPreviewOnLoad =
    message.isComplete === false &&
    previewStatus === "done" &&
    Boolean(previewSvg);

  useEffect(() => {
    if (!shouldScrollStreamingPreviewOnLoad) {
      return;
    }

    if (scrolledStreamingPreviewKeyRef.current === previewKey) {
      return;
    }

    pendingStreamingPreviewScrollKeyRef.current = previewKey;
  }, [previewKey, shouldScrollStreamingPreviewOnLoad]);

  const handleGeneratedPreviewLoad = useCallback(() => {
    if (scrolledStreamingPreviewKeyRef.current === previewKey) {
      return;
    }

    if (
      pendingStreamingPreviewScrollKeyRef.current !== previewKey &&
      !shouldScrollStreamingPreviewOnLoad
    ) {
      return;
    }

    pendingStreamingPreviewScrollKeyRef.current = null;
    scrolledStreamingPreviewKeyRef.current = previewKey;
    requestAnimationFrame(() => {
      scrollChatToBottom?.({
        keepElementTopVisible: messageContainerRef.current,
        behavior: "auto",
      });
    });
  }, [previewKey, scrollChatToBottom, shouldScrollStreamingPreviewOnLoad]);

  // --- Content visibility ---
  let visibleContent: string | undefined;
  if (assistantError) {
    visibleContent = undefined;
  } else if (isGeneratingPreview) {
    const pendingText = message.statusText?.trim() || "";
    const hasStreamingOutput = Boolean(message.skeletons?.length);
    if (pendingText.length > 0 || !hasStreamingOutput) {
      visibleContent = pendingText;
    }
  } else if (message.isComplete && !hasCurrentPreview) {
    visibleContent = message.statusText;
  }

  const assistantOutputExists =
    !message.error && !visibleContent && hasCurrentPreview;

  // --- Error presentation ---
  const errorPresentation = assistantError
    ? assistantError.code === 429
      ? assistantError.rateLimitRemaining === 0
        ? t("chat.rateLimit.messageLimit")
        : t("chat.rateLimit.generalRateLimit")
      : t(
          getAIErrorMessageKey(assistantError, {
            isOffline:
              typeof navigator !== "undefined" ? !navigator.onLine : false,
          }),
        )
    : null;
  const customWarning =
    assistantError?.code === 429
      ? (() => {
          const warning: AIRateLimitWarningDescriptor = {
            kind: "rateLimit",
            variant:
              message.warningType ??
              (assistantError.rateLimitRemaining === 0
                ? "messageLimitExceeded"
                : "rateLimitExceeded"),
            rateLimit: assistantError.rateLimit,
            rateLimitRemaining: assistantError.rateLimitRemaining,
          };
          return renderWarning?.(warning, message);
        })()
      : undefined;

  const retryActionLabel = !assistantError
    ? t("ai.chat.actions.regenerate")
    : t("ai.chat.actions.retry");

  if (customWarning !== undefined) {
    return <>{customWarning}</>;
  }

  if (isRateLimitWarning) {
    return (
      <ChatMessage
        role="system"
        roleLabel={t("chat.role.system")}
        timestamp={message.createdAt ?? fallbackTimestampRef.current}
        content={errorPresentation}
      />
    );
  }

  // --- Error node ---
  const errorNode = errorPresentation ? (
    <div
      className="tta-chat-message__error-details"
      role="alert"
      aria-live="polite"
    >
      <div className="tta-chat-message__error-message">{errorPresentation}</div>
    </div>
  ) : undefined;

  // --- Actions ---
  const shouldShowActions =
    !isRateLimitWarning && Boolean(message.isComplete || message.error);

  const actionsNode = shouldShowActions ? (
    <>
      {assistantOutputExists && (
        <ChatMessageActionButton
          icon={stackPushIcon}
          label="To canvas"
          onClick={onInsert}
          ariaLabel={t("ai.chat.actions.addToCanvas")}
          title={t("ai.chat.actions.addToCanvas")}
          disabled={!message.skeletons?.length}
        />
      )}
      {(assistantError || showRetry) && (
        <ChatMessageActionButton
          icon={RetryIcon}
          label="Retry"
          onClick={onRetry}
          ariaLabel={retryActionLabel}
          title={retryActionLabel}
          disabled={
            rateLimitRemaining === 0 || assistantError?.rateLimitRemaining === 0
          }
        />
      )}
      {showDelete && message.isComplete && (
        <ChatMessageActionButton
          icon={TrashIcon}
          onClick={onDelete}
          ariaLabel={t("ai.chat.actions.delete")}
          title={t("ai.chat.actions.delete")}
          danger
        />
      )}
    </>
  ) : undefined;

  return (
    <ChatMessage
      role="assistant"
      containerRef={messageContainerRef}
      roleLabel={t("ai.chat.roles.assistant")}
      timestamp={message.createdAt ?? fallbackTimestampRef.current}
      content={visibleContent}
      isGenerating={isGeneratingPreview}
      previewSvg={assistantOutputExists ? previewSvg : undefined}
      onPreviewClick={handleGeneratedPreviewClick}
      onPreviewLoad={handleGeneratedPreviewLoad}
      previewLabel={t("ai.chat.preview")}
      error={errorNode}
      statusLine={
        message.stopReason === "user"
          ? t(`ai.chat.stopReason.user`)
          : message.stopReason === "interrupted"
          ? t(`ai.chat.stopReason.interrupted`)
          : undefined
      }
      actions={actionsNode}
    />
  );
};

export const TTAChatMessage: React.FC<TTAChatMessageProps> = (props) => {
  if (props.message.role === "assistant") {
    return <TTAAssistantChatMessage {...props} message={props.message} />;
  }

  return (
    <TTAUserChatMessage message={props.message} onPreview={props.onPreview} />
  );
};
