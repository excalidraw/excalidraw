import React, { useState, useEffect, useRef, useCallback } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { atom, useAtom } from "../../app-jotai";

import { AgentCursorController } from "./agentCursorController";
import {
  PROVIDER_PRESETS,
  getAppWindow,
  loadAISettings,
  saveAISettings,
  testLLMConnection,
} from "./aiAgentSettings";
import { streamAIChat, getCanvasSummaryContext } from "./aiAgentService";
import {
  parseMermaidCode,
  insertDiagramWithAgentCursor,
} from "./diagramGenerator";

import "./AIAgentSidebarTab.scss";

import type {
  AIAgentProvider,
  AIAgentSettings,
  AIAgentStatus,
  ChatMessage,
} from "./types";

const aiAgentMessagesAtom = atom<ChatMessage[]>([]);

interface AIAgentSidebarTabProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
}

const QUICK_PROMPTS = [
  {
    title: "User Authentication Flow",
    prompt:
      "Create a user authentication flowchart with OAuth2 login, JWT token validation, and error fallback paths.",
  },
  {
    title: "Microservices Architecture",
    prompt:
      "Draw a microservices system architecture diagram with an API Gateway, Auth Service, Order Service, and PostgreSQL database.",
  },
  {
    title: "Git Feature Branch Workflow",
    prompt:
      "Generate a git workflow diagram comparing feature branches, pull requests, CI/CD pipeline, and main release branch.",
  },
  {
    title: "Product Roadmap Mindmap",
    prompt:
      "Design a comprehensive product roadmap mindmap covering Frontend, Backend, Infrastructure, and Security pillars.",
  },
];

export const AIAgentSidebarTab: React.FC<AIAgentSidebarTabProps> = ({
  excalidrawAPI,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const getOwnerWindow = useCallback((): Window => {
    return getAppWindow(containerRef.current);
  }, []);

  // Settings State
  const [settings, setSettings] = useState<AIAgentSettings>(() =>
    loadAISettings(getAppWindow()),
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  // Chat State persisted across sidebar tab switches
  const [messages, setMessages] = useAtom(aiAgentMessagesAtom);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  const [inputText, setInputText] = useState<string>("");
  const [includeCanvasContext, setIncludeCanvasContext] =
    useState<boolean>(false);
  const [agentStatus, setAgentStatus] = useState<AIAgentStatus>("idle");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const cursorControllerRef = useRef<AgentCursorController | null>(null);
  const timersRef = useRef<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Agent Whiteboard Cursor once per excalidrawAPI
  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    const controller = new AgentCursorController(excalidrawAPI, getOwnerWindow);
    cursorControllerRef.current = controller;
    controller.setVisible(settings.showCursor);

    return () => {
      controller.destroy();
      cursorControllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excalidrawAPI, getOwnerWindow]);

  // Synchronize cursor visibility without recreating controller
  useEffect(() => {
    cursorControllerRef.current?.setVisible(settings.showCursor);
  }, [settings.showCursor]);

  // Clean up in-flight requests and tracked timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      const win = getOwnerWindow();
      for (const id of timers) {
        win.clearTimeout(id);
      }
      timers.clear();
    };
  }, [getOwnerWindow]);

  // Scroll messages to bottom on new message or stream
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentStatus]);

  const scheduleTimer = useCallback(
    (callback: () => void, delayMs: number) => {
      const win = getOwnerWindow();
      const id = win.setTimeout(() => {
        timersRef.current.delete(id);
        callback();
      }, delayMs);
      timersRef.current.add(id);
    },
    [getOwnerWindow],
  );

  const handleProviderChange = (provider: AIAgentProvider) => {
    const preset = PROVIDER_PRESETS[provider];
    const updated = {
      ...settings,
      provider,
      baseURL: preset.baseURL,
      model: preset.defaultModel,
    };
    setSettings(updated);
    saveAISettings(updated, getOwnerWindow());
    setTestResult(null);
  };

  const handleSaveSettings = (updates: Partial<AIAgentSettings>) => {
    const updated = { ...settings, ...updates };
    setSettings(updated);
    saveAISettings(updated, getOwnerWindow());
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testLLMConnection(settings, getOwnerWindow());
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Connection failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setAgentStatus("idle");
  };

  const handleSendMessage = async (promptToSend?: string) => {
    const text = (promptToSend || inputText).trim();
    if (!text || agentStatus === "thinking" || agentStatus === "drawing") {
      return;
    }

    if (!settings.apiKey.trim() && settings.provider !== "ollama") {
      setIsSettingsOpen(true);
      return;
    }

    setInputText("");
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;

    const userMessage: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const initialAssistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      status: "streaming",
    };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    setAgentStatus("thinking");

    abortControllerRef.current = new AbortController();

    let canvasContext: string | null = null;
    if (includeCanvasContext && excalidrawAPI) {
      canvasContext = getCanvasSummaryContext(excalidrawAPI);
    }

    try {
      const result = await streamAIChat({
        settings,
        history: messagesRef.current,
        userPrompt: text,
        canvasContext,
        signal: abortControllerRef.current.signal,
        ownerWindow: getOwnerWindow(),
        onChunk: (streamedText) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: streamedText }
                : msg,
            ),
          );
        },
      });

      // If diagram found, animate agent cursor and draw onto canvas
      if (result.diagramCode && excalidrawAPI && cursorControllerRef.current) {
        setAgentStatus("drawing");
        try {
          const parsed = await parseMermaidCode(result.diagramCode);
          const insertionResult = await insertDiagramWithAgentCursor({
            api: excalidrawAPI,
            cursorController: cursorControllerRef.current,
            parsed,
          });

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: result.fullText,
                    status: "done",
                    diagramCode: result.diagramCode || undefined,
                    diagramType: "mermaid",
                    elementIds: insertionResult.elementIds,
                  }
                : msg,
            ),
          );
        } catch (diagramErr: any) {
          console.error("Failed to parse/insert diagram:", diagramErr);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: `${result.fullText}\n\n*(Note: Could not automatically render diagram: ${diagramErr.message})*`,
                    status: "done",
                    diagramCode: result.diagramCode || undefined,
                  }
                : msg,
            ),
          );
        }
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: result.fullText, status: "done" }
              : msg,
          ),
        );
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, status: "done", content: `${msg.content} [Stopped]` }
              : msg,
          ),
        );
      } else {
        console.error("AI Agent error:", err);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  status: "error",
                  errorMessage: err.message || "An unexpected error occurred",
                }
              : msg,
          ),
        );
      }
    } finally {
      setAgentStatus("idle");
      abortControllerRef.current = null;
    }
  };

  const handleLocateDiagram = (elementIds?: string[]) => {
    if (!excalidrawAPI || !elementIds || elementIds.length === 0) {
      return;
    }

    const sceneElements = excalidrawAPI.getSceneElements();
    const targetElements = sceneElements.filter((el) =>
      elementIds.includes(el.id),
    );

    if (targetElements.length > 0) {
      excalidrawAPI.setViewport({
        target: targetElements as unknown as readonly ExcalidrawElement[],
        fit: "scale-down",
        animation: true,
      });

      if (cursorControllerRef.current) {
        cursorControllerRef.current.selectElements(elementIds);
        scheduleTimer(() => {
          cursorControllerRef.current?.clearSelection();
        }, 1500);
      }
    }
  };

  const handleReinsertDiagram = async (diagramCode?: string) => {
    if (!excalidrawAPI || !cursorControllerRef.current || !diagramCode) {
      return;
    }

    setAgentStatus("drawing");
    try {
      const parsed = await parseMermaidCode(diagramCode);
      await insertDiagramWithAgentCursor({
        api: excalidrawAPI,
        cursorController: cursorControllerRef.current,
        parsed,
      });
    } catch (err: any) {
      console.error("Failed to reinsert diagram:", err);
    } finally {
      setAgentStatus("idle");
    }
  };

  const handleCopyCode = (id: string, code?: string) => {
    if (!code) {
      return;
    }
    const ownerWin = getOwnerWindow();
    ownerWin.navigator.clipboard?.writeText(code);
    setCopiedId(id);
    scheduleTimer(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const isKeyMissing =
    !settings.apiKey.trim() && settings.provider !== "ollama";

  return (
    <div className="ai-agent-tab" ref={containerRef}>
      {/* Header */}
      <div className="ai-agent-header">
        <div className="ai-agent-title-group">
          <div className="ai-agent-icon-badge" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 8V4H8" />
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M2 14h2" />
              <path d="M20 14h2" />
              <path d="M15 13v2" />
              <path d="M9 13v2" />
            </svg>
          </div>
          <span className="ai-agent-title">AI Agent</span>

          <span
            className={`ai-agent-status-badge ${
              isKeyMissing
                ? "status-key-needed"
                : agentStatus === "thinking"
                ? "status-thinking"
                : agentStatus === "drawing"
                ? "status-drawing"
                : "status-idle"
            }`}
          >
            <span className="status-dot" />
            {isKeyMissing
              ? "Key Needed"
              : agentStatus === "thinking"
              ? "Thinking..."
              : agentStatus === "drawing"
              ? "Drawing..."
              : "Ready"}
          </span>
        </div>

        <div className="ai-agent-header-actions">
          <button
            className={`icon-btn ${isSettingsOpen ? "active" : ""}`}
            title="BYOK Settings"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            aria-label="Settings"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Settings Drawer */}
      {isSettingsOpen && (
        <div className="ai-agent-settings-panel">
          <div className="settings-title">Bring Your Own Key (BYOK)</div>

          {/* Provider Chips */}
          <div className="provider-chips">
            {(Object.keys(PROVIDER_PRESETS) as AIAgentProvider[]).map(
              (providerKey) => (
                <button
                  key={providerKey}
                  type="button"
                  className={`provider-chip ${
                    settings.provider === providerKey ? "active" : ""
                  }`}
                  onClick={() => handleProviderChange(providerKey)}
                >
                  {PROVIDER_PRESETS[providerKey].name}
                </button>
              ),
            )}
          </div>

          {/* API Key */}
          <div className="setting-field">
            <label>
              <span>API Key</span>
              {PROVIDER_PRESETS[settings.provider].keyHelpUrl && (
                <a
                  href={PROVIDER_PRESETS[settings.provider].keyHelpUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Get key
                </a>
              )}
            </label>
            <div className="input-wrapper">
              <input
                type={showApiKey ? "text" : "password"}
                value={settings.apiKey}
                placeholder={PROVIDER_PRESETS[settings.provider].placeholderKey}
                onChange={(e) => handleSaveSettings({ apiKey: e.target.value })}
              />
              <button
                type="button"
                className="toggle-pwd-btn"
                onClick={() => setShowApiKey(!showApiKey)}
                title={showApiKey ? "Hide Key" : "Show Key"}
              >
                {showApiKey ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* Base URL */}
          <div className="setting-field">
            <label>API Base URL</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={settings.baseURL}
                onChange={(e) =>
                  handleSaveSettings({ baseURL: e.target.value })
                }
              />
            </div>
          </div>

          {/* Model */}
          <div className="setting-field">
            <label>Model</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={settings.model}
                onChange={(e) => handleSaveSettings({ model: e.target.value })}
              />
            </div>
            <div className="model-presets">
              {PROVIDER_PRESETS[settings.provider].popularModels.map(
                (modelName) => (
                  <span
                    key={modelName}
                    className="model-preset-tag"
                    onClick={() => handleSaveSettings({ model: modelName })}
                  >
                    {modelName}
                  </span>
                ),
              )}
            </div>
          </div>

          {/* Show Cursor Toggle */}
          <label className="setting-checkbox">
            <input
              type="checkbox"
              checked={settings.showCursor}
              onChange={(e) =>
                handleSaveSettings({ showCursor: e.target.checked })
              }
            />
            <span>Show live agent cursor on whiteboard</span>
          </label>

          {/* Test Connection Button */}
          <div className="settings-actions">
            <button
              type="button"
              className="btn-test"
              onClick={handleTestConnection}
              disabled={isTesting}
            >
              {isTesting ? "Testing..." : "Test Connection"}
            </button>
            {testResult && (
              <span
                className={`test-feedback ${
                  testResult.success ? "success" : "error"
                }`}
              >
                {testResult.message}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Messages Stream */}
      <div className="ai-agent-messages">
        {messages.length === 0 ? (
          <div className="welcome-container">
            <div className="welcome-avatar" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v4" />
                <path d="m19 7-3 3" />
                <path d="m5 7 3 3" />
                <rect width="18" height="12" x="3" y="10" rx="3" />
                <circle cx="9" cy="15" r="1" />
                <circle cx="15" cy="15" r="1" />
              </svg>
            </div>
            <div className="welcome-title">Your Whiteboard AI Agent</div>
            <div className="welcome-desc">
              Ask me to draw flowcharts, software architectures, user flows, or
              mindmaps. Watch my cursor draw in real-time!
            </div>

            <div className="quick-prompts-title">Try an example</div>
            <div className="quick-prompts-grid">
              {QUICK_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="quick-prompt-btn"
                  onClick={() => handleSendMessage(item.prompt)}
                >
                  <span className="prompt-icon">✨</span>
                  <span>{item.title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`message-row ${
                msg.role === "user" ? "user-row" : "assistant-row"
              }`}
            >
              <div className="message-bubble">
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <>
                    {/* Render textual content without the raw mermaid code if rendered */}
                    <div>
                      {msg.diagramCode
                        ? msg.content
                            .replace(/```(?:mermaid)?[\s\S]*?```/gi, "")
                            .trim() || "Here is your diagram:"
                        : msg.content}
                      {msg.status === "streaming" && (
                        <span className="streaming-cursor" />
                      )}
                    </div>

                    {/* Diagram Action Card */}
                    {msg.diagramCode && (
                      <div className="diagram-badge-card">
                        <div className="card-header">
                          <span className="badge-title">
                            <span>🎨</span>
                            <span>Whiteboard Diagram</span>
                          </span>
                          {msg.elementIds && (
                            <span className="badge-count">
                              {msg.elementIds.length} elements
                            </span>
                          )}
                        </div>

                        <div className="card-actions">
                          {msg.elementIds && (
                            <button
                              type="button"
                              onClick={() =>
                                handleLocateDiagram(msg.elementIds)
                              }
                            >
                              🔍 View on Canvas
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleReinsertDiagram(msg.diagramCode)
                            }
                          >
                            🔄 Redraw
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyCode(msg.id, msg.diagramCode)
                            }
                          >
                            {copiedId === msg.id
                              ? "✓ Copied"
                              : "📋 Copy Mermaid"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Error Banner */}
                    {msg.status === "error" && (
                      <div
                        style={{
                          color: "#ef4444",
                          fontSize: "0.8rem",
                          marginTop: "0.25rem",
                        }}
                      >
                        ⚠️ {msg.errorMessage}
                      </div>
                    )}
                  </>
                )}
              </div>
              <span className="message-timestamp">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input */}
      <div className="ai-agent-footer">
        <div className="canvas-context-bar">
          <label className="context-toggle">
            <input
              type="checkbox"
              checked={includeCanvasContext}
              onChange={(e) => setIncludeCanvasContext(e.target.checked)}
            />
            <span>Include canvas elements in prompt</span>
          </label>

          {messages.length > 0 && (
            <button
              type="button"
              className="clear-chat-btn"
              onClick={() => setMessages([])}
            >
              Clear chat
            </button>
          )}
        </div>

        <div className="input-box-wrapper">
          <textarea
            value={inputText}
            placeholder={
              isKeyMissing
                ? "Set your API key in Settings above to start..."
                : "Ask AI Agent to create or explain a diagram..."
            }
            rows={1}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          {agentStatus === "thinking" || agentStatus === "drawing" ? (
            <button
              type="button"
              className="stop-btn"
              title="Stop generation"
              onClick={handleStopGeneration}
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                width="16"
                height="16"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className="send-btn"
              title="Send prompt"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim()}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="16"
                height="16"
              >
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
