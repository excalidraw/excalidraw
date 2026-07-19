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
  AssistantMessage,
  AssistantStatus,
  ChatMessage as ChatMessageType,
  SystemWarningMessage,
  TTAChatScrollOptions,
  TTADialogRenderWarning,
  TTARateLimits,
  UserMessage,
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
  /**
   * Re-run affordance for a trailing prompt-only user turn
   * (tta_rewrite_final.md §5.8): a reload or chat switch mid-generation
   * leaves the chat ending on a user message with no assistant reply —
   * re-run sends the same prompt + images as a fresh turn.
   */
  onRerun?: () => void;
  showRerun?: boolean;
  scrollChatToBottom?: (options?: TTAChatScrollOptions) => void;
  renderWarning?: TTADialogRenderWarning;
  rateLimits?: TTARateLimits | null;
}

type TTAUserChatMessageProps = Pick<
  TTAChatMessageProps,
  "onPreview" | "onRerun" | "showRerun" | "rateLimits"
> & {
  message: UserMessage;
};

const TTAUserChatMessage = ({
  message,
  onPreview,
  onRerun,
  showRerun = false,
  rateLimits,
}: TTAUserChatMessageProps) => {
  const { t } = useI18n();
  const [isCopied, setIsCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  const handleCopy = useCallback((content: UserMessage["content"]) => {
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

  const showCopy = Boolean(message.content);
  const actionsNode =
    showCopy || showRerun ? (
      <>
        {showCopy && (
          <ChatMessageActionButton
            icon={isCopied ? checkIcon : copyIcon}
            onClick={() => handleCopy(message.content)}
            ariaLabel={t("labels.copy")}
            title={t("labels.copy")}
          />
        )}
        {showRerun && (
          <ChatMessageActionButton
            icon={RetryIcon}
            label={t("ai.chat.actions.rerun")}
            onClick={() => onRerun?.()}
            ariaLabel={t("ai.chat.actions.rerun")}
            title={t("ai.chat.actions.rerun")}
            disabled={rateLimits?.rateLimitRemaining === 0}
          />
        )}
      </>
    ) : undefined;

  return (
    <ChatMessage
      role="user"
      roleLabel={t("ai.chat.roles.you")}
      timestamp={message.createdAt}
      content={message.content}
      images={message.images}
      onImageClick={onPreview}
      actions={actionsNode}
    />
  );
};

type TTASystemWarningMessageProps = Pick<
  TTAChatMessageProps,
  "renderWarning" | "rateLimits"
> & {
  message: SystemWarningMessage;
};

const getRateLimitWarningDescriptor = (
  variant: AIRateLimitWarningDescriptor["variant"],
  rateLimits: TTARateLimits | null | undefined,
): AIRateLimitWarningDescriptor => ({
  kind: "rateLimit",
  variant,
  rateLimit: rateLimits?.rateLimit,
  rateLimitRemaining: rateLimits?.rateLimitRemaining,
});

const TTASystemWarningMessage = ({
  message,
  renderWarning,
  rateLimits,
}: TTASystemWarningMessageProps) => {
  const { t } = useI18n();

  const customWarning = renderWarning?.(
    getRateLimitWarningDescriptor(message.variant, rateLimits),
    message,
  );
  if (customWarning !== undefined) {
    return <>{customWarning}</>;
  }

  return (
    <ChatMessage
      role="system"
      roleLabel={t("chat.role.system")}
      timestamp={message.createdAt}
      content={
        message.variant === "messageLimitExceeded"
          ? t("chat.rateLimit.messageLimit")
          : t("chat.rateLimit.generalRateLimit")
      }
    />
  );
};

type TTAAssistantChatMessageProps = Omit<
  TTAChatMessageProps,
  "message" | "onPreview"
> & {
  message: AssistantMessage;
};

const formatElapsedTime = (elapsedMs?: number | null) => {
  if (elapsedMs == null || !Number.isFinite(elapsedMs)) {
    return null;
  }

  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      seconds,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const useLiveNow = (enabled: boolean) => {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [enabled]);

  return now;
};

const getStreamingProgressLabel = (
  status: Extract<AssistantStatus, { kind: "streaming" }>,
  t: ReturnType<typeof useI18n>["t"],
): string | null => {
  const statusText = status.statusText?.trim();
  if (statusText) {
    return statusText;
  }

  switch (status.phase) {
    case "thinking":
      return t("ai.chat.status.thinking");
    case "finalizing":
      return t("ai.chat.status.finalizing");
    default:
      return null;
  }
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
  rateLimits,
}: TTAAssistantChatMessageProps) => {
  const { t } = useI18n();
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const scrolledStreamingPreviewKeyRef = useRef<string | null>(null);
  const pendingStreamingPreviewScrollKeyRef = useRef<string | null>(null);
  const { previewSvg, status: previewStatus } = useAIAssistantPreview(message);

  const status = message.status;
  const isStreaming = status.kind === "streaming";
  const hasCurrentPreview = Boolean(previewSvg);
  const assistantError = status.kind === "error" ? status.error : null;
  const liveNow = useLiveNow(isStreaming);

  const handleGeneratedPreviewClick = useCallback(() => {
    if (!message.skeletons?.length) {
      return;
    }
    onInsert();
  }, [message.skeletons?.length, onInsert]);

  const previewKey = message.id;
  const shouldScrollStreamingPreviewOnLoad =
    isStreaming && previewStatus === "done" && Boolean(previewSvg);

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
  // Terminal without a preview: the outcome label ("Generated response." /
  // "(empty response)"). Streaming and errors render no content text.
  const visibleContent =
    status.kind === "done" && !hasCurrentPreview
      ? status.outcome === "generated"
        ? t("ai.chat.status.generatedResponse")
        : t("ai.chat.status.emptyResponse")
      : undefined;

  // A failed generation may still carry the partial skeletons streamed before
  // the failure (e.g. connection interruptions — C2 in tta.md). Surface them
  // so the user can preview/insert the partial result alongside the error.
  const hasSalvageablePartialResult = Boolean(
    assistantError && message.skeletons?.length,
  );
  const assistantOutputExists =
    (!assistantError || hasSalvageablePartialResult) &&
    !visibleContent &&
    hasCurrentPreview;

  // --- Error presentation ---
  const isRateLimitError = assistantError?.code === 429;
  const isQuotaExhausted = rateLimits?.rateLimitRemaining === 0;
  const errorPresentation = assistantError
    ? isRateLimitError
      ? isQuotaExhausted
        ? t("chat.rateLimit.messageLimit")
        : t("chat.rateLimit.generalRateLimit")
      : t(
          getAIErrorMessageKey(assistantError, {
            isOffline:
              typeof navigator !== "undefined" ? !navigator.onLine : false,
          }),
        )
    : null;
  // A generation rejected with 429 keeps the host warning treatment: the
  // whole row is replaced, exactly like a SystemWarningMessage row. The
  // rate-limit numbers come from the rate-limits atom, not the message.
  const rateLimitVariant: AIRateLimitWarningDescriptor["variant"] =
    isQuotaExhausted ? "messageLimitExceeded" : "rateLimitExceeded";
  const customWarning = isRateLimitError
    ? renderWarning?.(
        getRateLimitWarningDescriptor(rateLimitVariant, rateLimits),
        {
          role: "system",
          id: message.id,
          createdAt: message.createdAt,
          variant: rateLimitVariant,
        },
      )
    : undefined;

  const retryActionLabel = !assistantError
    ? t("ai.chat.actions.regenerate")
    : t("ai.chat.actions.retry");

  const runningElapsedMs =
    status.kind === "streaming" ? liveNow - status.startedAt : undefined;
  const elapsedLabel = formatElapsedTime(
    status.kind === "streaming" ? runningElapsedMs : status.elapsedMs,
  );
  const stopReasonText =
    status.kind === "stopped"
      ? t(`ai.chat.stopReason.${status.reason}`)
      : undefined;
  const truncationWarningText =
    status.kind === "done" && status.warning
      ? t("ai.chat.status.truncatedResponse")
      : undefined;
  const activeProgressLabel =
    status.kind === "streaming" ? getStreamingProgressLabel(status, t) : null;
  const headerProgress = isStreaming ? (
    <div
      className="tta-chat-message__header-progress"
      aria-label={
        activeProgressLabel
          ? `${activeProgressLabel} ${elapsedLabel ?? ""}`.trim()
          : elapsedLabel ?? undefined
      }
      title={activeProgressLabel ?? undefined}
    >
      <span className="tta-chat-message__progress-spinner" aria-hidden />
      {elapsedLabel && (
        <span className="tta-chat-message__progress-time">{elapsedLabel}</span>
      )}
    </div>
  ) : undefined;
  const statusLine = (() => {
    if (isStreaming) {
      if (!activeProgressLabel) {
        return undefined;
      }

      return (
        <div
          className="tta-chat-message__progress tta-chat-message__progress--message"
          aria-live="polite"
        >
          <span className="tta-chat-message__progress-label">
            {activeProgressLabel}
          </span>
        </div>
      );
    }

    const elapsedSummary = elapsedLabel
      ? status.kind === "error"
        ? t("ai.chat.status.failedAfter", { time: elapsedLabel })
        : status.kind === "stopped"
        ? t("ai.chat.status.stoppedAfter", { time: elapsedLabel })
        : t("ai.chat.status.completedIn", { time: elapsedLabel })
      : undefined;

    if (!stopReasonText && !elapsedSummary && !truncationWarningText) {
      return undefined;
    }

    return (
      <div className="tta-chat-message__progress tta-chat-message__progress--complete">
        {truncationWarningText && (
          <span className="tta-chat-message__progress-label">
            {truncationWarningText}
          </span>
        )}
        {stopReasonText && (
          <span className="tta-chat-message__progress-label">
            {stopReasonText}
          </span>
        )}
        {elapsedSummary && (
          <span className="tta-chat-message__progress-time">
            {elapsedSummary}
          </span>
        )}
      </div>
    );
  })();

  if (customWarning !== undefined) {
    return <>{customWarning}</>;
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
  const shouldShowActions = status.kind !== "streaming";

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
          disabled={isQuotaExhausted}
        />
      )}
      {showDelete && (
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
      timestamp={message.createdAt}
      content={visibleContent}
      isGenerating={isStreaming}
      previewSvg={assistantOutputExists ? previewSvg : undefined}
      onPreviewClick={handleGeneratedPreviewClick}
      onPreviewLoad={handleGeneratedPreviewLoad}
      previewLabel={t("ai.chat.preview")}
      error={errorNode}
      statusLine={statusLine}
      headerEnd={headerProgress}
      actions={actionsNode}
    />
  );
};

export const TTAChatMessage: React.FC<TTAChatMessageProps> = (props) => {
  if (props.message.role === "assistant") {
    return <TTAAssistantChatMessage {...props} message={props.message} />;
  }

  if (props.message.role === "system") {
    return (
      <TTASystemWarningMessage
        message={props.message}
        renderWarning={props.renderWarning}
        rateLimits={props.rateLimits}
      />
    );
  }

  return (
    <TTAUserChatMessage
      message={props.message}
      onPreview={props.onPreview}
      onRerun={props.onRerun}
      showRerun={props.showRerun}
      rateLimits={props.rateLimits}
    />
  );
};
