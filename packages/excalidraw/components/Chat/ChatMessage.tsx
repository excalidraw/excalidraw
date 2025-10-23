import React from "react";
import { ChatMessage as ChatMessageType } from "./types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className={`chat-message chat-message--${message.type}`}>
      <div className="chat-message__content">
        <div className="chat-message__header">
          <span className="chat-message__role">
            {message.type === "user" ? "You" : "AI Assistant"}
          </span>
          <span className="chat-message__timestamp">
            {formatTime(message.timestamp)}
          </span>
        </div>
        <div className="chat-message__body">
          {message.isGenerating ? (
            <div className="chat-message__loading">
              <div className="chat-message__typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          ) : message.error ? (
            <div className="chat-message__error">{message.error}</div>
          ) : (
            <div className="chat-message__text">{message.content}</div>
          )}
        </div>
      </div>
    </div>
  );
};
