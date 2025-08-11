/**
 * Simple Chat Panel Component
 * 
 * A clean, simple chat interface for communicating with the LLM service.
 * Avoids complex type dependencies and focuses on core functionality.
 */

import React, { useState, useRef, useEffect } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

interface ChatPanelProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
  isVisible?: boolean;
  onToggle: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ 
  excalidrawAPI, 
  isVisible = true, 
  onToggle 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check service health on mount
  useEffect(() => {
    checkServiceHealth();
  }, []);

  const checkServiceHealth = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/health');
      const data = await response.json();
      setIsConnected(data.status === 'healthy');
    } catch (err) {
      setIsConnected(false);
      console.error('Failed to check service health:', err);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // Get canvas context for AI
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      
      const canvasContext = {
        elements: elements.length > 0 ? elements.slice(0, 50) : [], // Limit for payload size
        selection: {
          selectedElementIds: appState.selectedElementIds,
          count: Object.keys(appState.selectedElementIds).length
        },
        viewport: {
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom.value
        }
      };

      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: 'default',
          canvas: canvasContext
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.content,
          timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = async () => {
    try {
      await fetch('http://localhost:3001/api/chat/history/default', {
        method: 'DELETE'
      });
      setMessages([]);
      setError(null);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      return new Date(timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return '';
    }
  };

  if (!isVisible) {
    return null; // Button is now handled in renderTopRightUI
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: '380px',
      backgroundColor: 'white',
      borderLeft: '1px solid #ddd',
      boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 999, // Lower than top UI elements
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #ddd',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: '60px' // Ensure header has good height
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600 }}>AI Assistant</span>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isConnected ? '#28a745' : '#dc3545'
          }} title={isConnected ? 'Connected' : 'Disconnected'} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={clearHistory}
            style={{
              padding: '4px 8px',
              backgroundColor: 'transparent',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="Clear History"
          >
            Clear
          </button>
          <button
            onClick={onToggle}
            style={{
              padding: '4px 8px',
              backgroundColor: 'transparent',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="Close Chat"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        padding: '20px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: '#6c757d',
            fontSize: '14px',
            padding: '20px'
          }}>
            Start a conversation with the AI assistant. 
            <br />Try: "Create a blue rectangle"
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} style={{
            alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '80%'
          }}>
            <div style={{
              padding: '8px 12px',
              borderRadius: '12px',
              backgroundColor: message.role === 'user' ? '#007bff' : '#f8f9fa',
              color: message.role === 'user' ? 'white' : '#333',
              fontSize: '14px',
              lineHeight: 1.4,
              wordWrap: 'break-word'
            }}>
              {message.content}
            </div>
            <div style={{
              fontSize: '11px',
              color: '#6c757d',
              marginTop: '4px',
              textAlign: message.role === 'user' ? 'right' : 'left'
            }}>
              {formatTimestamp(message.timestamp)}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{
            alignSelf: 'flex-start',
            maxWidth: '80%'
          }}>
            <div style={{
              padding: '8px 12px',
              borderRadius: '12px',
              backgroundColor: '#f8f9fa',
              color: '#6c757d',
              fontSize: '14px',
              fontStyle: 'italic'
            }}>
              AI is thinking...
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: '8px 12px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '6px',
            fontSize: '13px',
            border: '1px solid #f5c6cb'
          }}>
            Error: {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid #ddd',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? "Type your message..." : "Service disconnected"}
            disabled={!isConnected || isLoading}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              resize: 'none',
              fontSize: '14px',
              minHeight: '36px',
              maxHeight: '100px',
              fontFamily: 'inherit'
            }}
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || !isConnected || isLoading}
            style={{
              padding: '8px 12px',
              backgroundColor: (!inputMessage.trim() || !isConnected || isLoading) ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (!inputMessage.trim() || !isConnected || isLoading) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              minWidth: '60px'
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;