import React, { useRef, useEffect, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  chatMessagesAtom,
  isChatPanelOpenAtom,
  chatPanelWidthAtom,
  selectionContextAtom,
  isAgentLoadingAtom,
  agentErrorAtom,
  type ChatMessage,
} from "./atoms";
import "./ChatPanel.scss";

interface ChatPanelProps {
  onSendMessage?: (message: string, context?: any) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ onSendMessage }) => {
  const [messages, setMessages] = useAtom(chatMessagesAtom);
  const [isChatPanelOpen, setIsChatPanelOpen] = useAtom(isChatPanelOpenAtom);
  const [chatPanelWidth, setChatPanelWidth] = useAtom(chatPanelWidthAtom);
  const selectionContext = useAtomValue(selectionContextAtom);
  const isAgentLoading = useAtomValue(isAgentLoadingAtom);
  const agentError = useAtomValue(agentErrorAtom);

  const [inputValue, setInputValue] = useState("");
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle message sending
  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: inputValue,
      timestamp: Date.now(),
      contextElements: selectionContext.elementIds,
    };

    setMessages([...messages, userMessage]);
    setInputValue("");

    // Trigger the callback
    if (onSendMessage) {
      onSendMessage(inputValue, {
        selectedElements: selectionContext.elementIds,
        elementCount: selectionContext.count,
      });
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle panel resize
  const handleMouseDown = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = Math.max(250, window.innerWidth - e.clientX);
      setChatPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setChatPanelWidth]);

  if (!isChatPanelOpen) {
    return null;
  }

  return (
    <div
      className="chatcanvas-panel"
      style={{ width: `${chatPanelWidth}px` }}
      ref={panelRef}
    >
      <div className="chatcanvas-panel__header">
        <h2 className="chatcanvas-panel__title">Chat</h2>
        <button
          className="chatcanvas-panel__close"
          onClick={() => setIsChatPanelOpen(false)}
          title="Close chat panel"
        >
          ✕
        </button>
      </div>

      {/* Selection Context Indicator */}
      {selectionContext.count > 0 && (
        <div className="chatcanvas-panel__context">
          <span className="chatcanvas-panel__context-label">
            {selectionContext.count} item{selectionContext.count > 1 ? "s" : ""}{" "}
            selected
          </span>
        </div>
      )}

      {/* Messages Container */}
      <div className="chatcanvas-panel__messages">
        {messages.length === 0 && (
          <div className="chatcanvas-panel__empty">
            <p>No messages yet. Start a conversation!</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chatcanvas-panel__message chatcanvas-panel__message--${msg.role}`}
          >
            <div className="chatcanvas-panel__message-content">
              {msg.content}
            </div>
            {msg.contextElements && msg.contextElements.length > 0 && (
              <div className="chatcanvas-panel__message-context">
                Referenced {msg.contextElements.length} element
                {msg.contextElements.length > 1 ? "s" : ""}
              </div>
            )}
          </div>
        ))}
        {isAgentLoading && (
          <div className="chatcanvas-panel__message chatcanvas-panel__message--assistant">
            <div className="chatcanvas-panel__message-content">
              <span className="chatcanvas-panel__loading">Thinking...</span>
            </div>
          </div>
        )}
        {agentError && (
          <div className="chatcanvas-panel__message chatcanvas-panel__message--error">
            <div className="chatcanvas-panel__message-content">{agentError}</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="chatcanvas-panel__input-area">
        <textarea
          className="chatcanvas-panel__input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Shift+Enter for new line)"
          disabled={isAgentLoading}
        />
        <button
          className="chatcanvas-panel__send"
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || isAgentLoading}
          title="Send message (Enter)"
        >
          Send
        </button>
      </div>

      {/* Resize Handle */}
      <div
        className="chatcanvas-panel__resizer"
        ref={resizerRef}
        onMouseDown={handleMouseDown}
        title="Drag to resize"
      />
    </div>
  );
};
