import React, { useRef, useEffect, useState } from "react";
import { KEYS } from "@excalidraw/common";
import { ArrowRightIcon, UndoIcon, RedoIcon } from "../icons";
import { InlineIcon } from "../InlineIcon";
import { ToolButton } from "../ToolButton";
import { ChatMessage } from "./ChatMessage";
import { ChatInterfaceProps } from "./types";
import { SpeechRecognitionButton } from "../SpeechRecognition";

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  currentPrompt,
  onPromptChange,
  onSendMessage,
  isGenerating,
  rateLimits,
  onViewAsMermaid,
  generatedResponse,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}) => {
  const [inputValue, setInputValue] = useState(currentPrompt);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setInputValue(currentPrompt);
  }, [currentPrompt]);

  const handleSpeechTranscript = (transcript: string) => {
    const newValue = inputValue + (inputValue ? " " : "") + transcript;
    setInputValue(newValue);
    onPromptChange(newValue);
  };

  const handleSpeechError = (error: string) => {
    console.error("Speech recognition error:", error);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setInputValue(value);
    onPromptChange(value);
  };

  const handleSubmit = () => {
    const trimmedPrompt = inputValue.trim();
    if (trimmedPrompt && !isGenerating) {
      onSendMessage(trimmedPrompt);
      setInputValue("");
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === KEYS.ENTER && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }

    // Undo/Redo shortcuts
    if (event.ctrlKey || event.metaKey) {
      if (event.key === "z" && !event.shiftKey && onUndo && canUndo) {
        event.preventDefault();
        onUndo();
      } else if ((event.key === "z" && event.shiftKey) || event.key === "y") {
        if (onRedo && canRedo) {
          event.preventDefault();
          onRedo();
        }
      }
    }
  };

  const canSend =
    inputValue.trim().length > 0 &&
    !isGenerating &&
    (rateLimits?.rateLimitRemaining ?? 1) > 0;

  return (
    <div className="chat-interface">
      <div className="chat-interface__messages">
        {messages.length === 0 ? (
          <div className="chat-interface__empty-state">
            <div className="chat-interface__empty-state-content">
              <h3>Let’s design your diagram</h3>
              <p>
                Describe what diagram you'd like to create, and I'll help you
                generate it.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-interface__input-container">
        <div className="chat-interface__input-wrapper">
          <textarea
            autoFocus
            ref={inputRef}
            className="chat-interface__input"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Start typing your diagram idea here..."
            disabled={isGenerating}
            rows={1}
            cols={30}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
          <SpeechRecognitionButton
            onTranscript={handleSpeechTranscript}
            onError={handleSpeechError}
            disabled={isGenerating}
            className="chat-interface__speech-recognition"
            buttonClassName="chat-interface__voice-button"
          />
          <button
            className="chat-interface__send-button"
            onClick={handleSubmit}
            disabled={!canSend}
            type="button"
          >
            <InlineIcon size="1.5em" icon={ArrowRightIcon} />
          </button>
        </div>

        {(canUndo || canRedo || rateLimits) && (
          <div className="chat-interface__footer">
            <div className="chat-interface__footer-left">
              <div className="chat-interface__undo-controls">
                <ToolButton
                  type="button"
                  className="chat-interface__undo-button"
                  icon={UndoIcon}
                  onClick={onUndo}
                  disabled={!canUndo}
                  title="Undo (Ctrl+Z)"
                  aria-label="Undo"
                />
                <ToolButton
                  type="button"
                  className="chat-interface__redo-button"
                  icon={RedoIcon}
                  onClick={onRedo}
                  disabled={!canRedo}
                  title="Redo (Ctrl+Y)"
                  aria-label="Redo"
                />
              </div>
              {rateLimits && (
                <div className="chat-interface__rate-limit">
                  {rateLimits?.rateLimitRemaining} requests left today
                </div>
              )}
            </div>

            <div className="chat-interface__footer-right">
              {generatedResponse && onViewAsMermaid && (
                <button
                  className="chat-interface__mermaid-link"
                  onClick={onViewAsMermaid}
                  type="button"
                >
                  View as Mermaid
                  <InlineIcon icon={ArrowRightIcon} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
