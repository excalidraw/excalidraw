import React, { useRef, useEffect, useLayoutEffect } from "react";
import { KEYS } from "@excalidraw/common";

import { ArrowRightIcon, stop as StopIcon } from "../../icons";
import { InlineIcon } from "../../InlineIcon";

import { t } from "../../../i18n";

import { TTDWelcomeMessage } from "../TTDWelcomeMessage";

import { ChatMessage } from "./ChatMessage";

import type { TChat, TTTDDialog } from "../types";

import type { FormEventHandler } from "react";

export const ChatInterface = ({
  chatId,
  messages,
  currentPrompt,
  onPromptChange,
  onGenerate,
  isGenerating,
  rateLimits,
  onAbort,
  onMermaidTabClick,
  onAiRepairClick,
  onDeleteMessage,
  onInsertMessage,
  onRetry,
  renderWelcomeScreen,
  renderWarning,
}: {
  chatId: string;
  messages: TChat.ChatMessage[];
  currentPrompt: string;
  onPromptChange: (prompt: string) => void;
  onGenerate: TTTDDialog.OnGenerate;
  isGenerating: boolean;
  rateLimits?: {
    rateLimit: number;
    rateLimitRemaining: number;
  } | null;
  onViewAsMermaid?: () => void;
  generatedResponse?: string | null;
  onAbort?: () => void;
  onMermaidTabClick?: (message: TChat.ChatMessage) => void;
  onAiRepairClick?: (message: TChat.ChatMessage) => void;
  onDeleteMessage?: (messageId: string) => void;
  onInsertMessage?: (message: TChat.ChatMessage) => void;
  onRetry?: (message: TChat.ChatMessage) => void;
  renderWelcomeScreen?: TTTDDialog.renderWelcomeScreen;
  renderWarning?: TTTDDialog.renderWarning;
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [chatId]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    onPromptChange(value);
  };

  const handleSubmit = () => {
    if (isGenerating && onAbort) {
      onAbort();
      return;
    }

    const trimmedPrompt = currentPrompt.trim();
    if (!trimmedPrompt) {
      return;
    }

    onGenerate({ prompt: trimmedPrompt });
    onPromptChange("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === KEYS.ENTER && !event.shiftKey) {
      event.preventDefault();
      if (!isGenerating) {
        handleSubmit();
      }
    }
  };

  const canSend =
    currentPrompt.trim().length > 3 &&
    !isGenerating &&
    (rateLimits?.rateLimitRemaining ?? 1) > 0;

  const canStop = isGenerating && !!onAbort;

  const onInput: FormEventHandler<HTMLTextAreaElement> = (ev) => {
    const target = ev.target as HTMLTextAreaElement;
    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
  };

  return (
    <div className="chat-interface">
      <div className="chat-interface__messages">
        {messages.length === 0 ? (
          <div className="chat-interface__welcome-screen">
            {renderWelcomeScreen ? (
              renderWelcomeScreen({ rateLimits: rateLimits ?? null })
            ) : (
              <TTDWelcomeMessage />
            )}
          </div>
        ) : (
          messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              onMermaidTabClick={onMermaidTabClick}
              onAiRepairClick={onAiRepairClick}
              onDeleteMessage={onDeleteMessage}
              onInsertMessage={onInsertMessage}
              onRetry={onRetry}
              rateLimitRemaining={rateLimits?.rateLimitRemaining}
              isLastMessage={index === messages.length - 1}
              renderWarning={renderWarning}
              // so we don't allow to repair parse errors which aren't the last message
              allowFixingParseError={
                message.errorType === "parse" && index === messages.length - 1
              }
            />
          ))
        )}
        <div ref={messagesEndRef} id="messages-end" />
      </div>

      <div className="chat-interface__input-container">
        <div className="chat-interface__input-outer">
          <div
            className="chat-interface__input-wrapper"
            style={{
              borderColor: isGenerating
                ? "var(--dialog-border-color)"
                : undefined,
            }}
          >
            <textarea
              ref={textareaRef}
              autoFocus
              className="chat-interface__input"
              value={currentPrompt}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                isGenerating
                  ? t("chat.generating")
                  : rateLimits?.rateLimitRemaining === 0
                  ? t("chat.rateLimit.messageLimitInputPlaceholder")
                  : messages.length > 0
                  ? t("chat.inputPlaceholderWithMessages")
                  : t("chat.inputPlaceholder", { shortcut: "Shift + Enter" })
              }
              disabled={rateLimits?.rateLimitRemaining === 0}
              rows={1}
              cols={30}
              onInput={onInput}
            />
            <button
              className="chat-interface__send-button"
              onClick={handleSubmit}
              disabled={!canSend && !canStop}
              type="button"
            >
              <InlineIcon
                size="1.5em"
                icon={isGenerating ? StopIcon : ArrowRightIcon}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
