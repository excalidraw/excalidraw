import React, { useRef, useEffect, useState } from "react";
import { EVENT, KEYS } from "@excalidraw/common";
import {
  ArrowRightIcon,
  UndoIcon,
  RedoIcon,
  microphoneIcon,
  microphoneMutedIcon,
} from "../icons";
import { InlineIcon } from "../InlineIcon";
import { ToolButton } from "../ToolButton";
import { ChatMessage } from "./ChatMessage";
import { ChatInterfaceProps } from "./types";

// Speech Recognition API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any)
    | null;
  onerror:
    | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any)
    | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

// Extend Window interface for Speech Recognition API
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

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
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update input when currentPrompt changes externally
  useEffect(() => {
    setInputValue(currentPrompt);
  }, [currentPrompt]);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        const newValue = inputValue + (inputValue ? " " : "") + transcript;
        setInputValue(newValue);
        onPromptChange(newValue);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error);
        setSpeechError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
      setSpeechError("Speech recognition not supported in this browser");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [inputValue, onPromptChange]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setInputValue(value);
    onPromptChange(value);
  };

  const handleSubmit = () => {
    const trimmedPrompt = inputValue.trim();
    if (trimmedPrompt && !isGenerating) {
      // Build context from previous messages (latest first)
      const contextMessages = [...messages].reverse();
      let contextText = "";
      
      for (const message of contextMessages) {
        const messageText = `${message.type === "user" ? "User" : "Assistant"}: ${message.content}`;
        const newContextLength = contextText.length + messageText.length + 2; // +2 for newline
        
        if (newContextLength > 1000) {
          break;
        }
        
        contextText = messageText + (contextText ? "\n" : "") + contextText;
      }
      
      // Combine context with current prompt
      const fullPrompt = contextText 
        ? `${contextText}\n\nUser: ${trimmedPrompt}`
        : trimmedPrompt;
      
      onSendMessage(fullPrompt);
      setInputValue("");
    }
  };

  const handleVoiceDictation = () => {
    if (!speechSupported || !recognitionRef.current) {
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error("Failed to start speech recognition:", error);
        setSpeechError("Failed to start voice recognition. Please try again.");
      }
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
          {speechSupported && (
            <button
              className={`chat-interface__voice-button ${
                isListening ? "chat-interface__voice-button--listening" : ""
              }`}
              onClick={handleVoiceDictation}
              disabled={isGenerating}
              type="button"
              title={isListening ? "Stop voice input" : "Start voice input"}
              aria-label={
                isListening ? "Stop voice input" : "Start voice input"
              }
            >
              <InlineIcon
                size="1.5em"
                icon={isListening ? microphoneMutedIcon : microphoneIcon}
              />
            </button>
          )}
          <button
            className="chat-interface__send-button"
            onClick={handleSubmit}
            disabled={!canSend}
            type="button"
          >
            <InlineIcon size="1.5em" icon={ArrowRightIcon} />
          </button>
        </div>

        {speechError && (
          <div className="chat-interface__speech-error">{speechError}</div>
        )}

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
