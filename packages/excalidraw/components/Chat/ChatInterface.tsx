import React, { useRef, useEffect } from "react";
import { KEYS } from "@excalidraw/common";

import { ArrowRightIcon, stop as StopIcon } from "../icons";
import { InlineIcon } from "../InlineIcon";

import { t } from "../../i18n";

import { ChatMessage } from "./ChatMessage";

import type { ChatInterfaceProps } from "./types";

import type { FormEventHandler } from "react";

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  chatId,
  messages,
  currentPrompt,
  onPromptChange,
  onSendMessage,
  isGenerating,
  rateLimits,
  placeholder,
  onAbort,
  onMermaidTabClick,
  onAiRepairClick,
  onDeleteMessage,
  onInsertMessage,
  onRetry,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
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

    onSendMessage(trimmedPrompt);
    onPromptChange("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === KEYS.ENTER && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
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
          <div className="chat-interface__empty-state">
            <div className="chat-interface__empty-state-content">
              <h3>{placeholder.title}</h3>
              <p>{placeholder.description}</p>
              <p>{placeholder.hint}</p>
            </div>
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
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-interface__input-container">
        <div className="chat-interface__input-outer">
          <div className="chat-interface__input-wrapper">
            <textarea
              ref={textareaRef}
              autoFocus
              className="chat-interface__input"
              value={currentPrompt}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                messages.length > 0
                  ? t("chat.inputPlaceholderWithMessages")
                  : t("chat.inputPlaceholder")
              }
              disabled={isGenerating}
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
