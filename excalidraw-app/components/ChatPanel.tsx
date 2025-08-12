/**
 * Simple Chat Panel Component
 * 
 * A clean, simple chat interface for communicating with the LLM service.
 * Avoids complex type dependencies and focuses on core functionality.
 */

import React, { useState, useRef, useEffect } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useAtomValue } from '../app-jotai';
import { collabAPIAtom } from '../collab/Collab';
import { getCollaborationLinkData } from '../data';

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
  const [aiInvited, setAiInvited] = useState(false);
  const [isInvitingAI, setIsInvitingAI] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const invitedRoomRef = useRef<string | null>(null);
  const collabAPI = useAtomValue(collabAPIAtom);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check service health on mount
  useEffect(() => {
    checkServiceHealth();
  }, []);

  // Manual AI invitation function
  const inviteAI = async () => {
    if (!collabAPI || isInvitingAI) return;
    
    setIsInvitingAI(true);
    try {
      let roomId, roomKey;
      
      // Check if already in a collaboration session
      if (collabAPI.isCollaborating()) {
        const activeLink = collabAPI.getActiveRoomLink?.() || window.location.href;
        const linkData = getCollaborationLinkData(activeLink);
        if (linkData) {
          roomId = linkData.roomId;
          roomKey = linkData.roomKey;
          console.log('Using existing collaboration room for AI:', { roomId });
        }
      }
      
      // If no existing collaboration, start a new collaboration session
      if (!roomId || !roomKey) {
        console.log('Starting new collaboration session for AI chat');
        
        // Start collaboration - this will create roomId and roomKey automatically
        const scene = await collabAPI.startCollaboration(null);
        
        // Wait a moment for collaboration to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Now get the collaboration link data
        const activeLink = collabAPI.getActiveRoomLink?.() || window.location.href;
        const linkData = getCollaborationLinkData(activeLink);
        
        if (linkData) {
          roomId = linkData.roomId;
          roomKey = linkData.roomKey;
          console.log('Created new collaboration session for AI:', { roomId });
        } else {
          throw new Error('Failed to get collaboration link data after starting collaboration');
        }
      }

      // Register AI bot with the collaboration room
      const username = 'AI Assistant';
      const resp = await fetch('http://localhost:3000/api/ai/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, roomKey, username })
      });
      
      if (resp.ok) {
        invitedRoomRef.current = roomId;
        setAiInvited(true);
        console.log('AI bot successfully registered for collaboration room:', roomId);
      } else {
        throw new Error(`Failed to register AI bot: ${await resp.text()}`);
      }
    } catch (err) {
      console.error('Failed to invite AI to collaboration:', err);
      setError(`Failed to invite AI: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsInvitingAI(false);
    }
  };

  // Auto-invite AI when chat opens (enhanced behavior)
  useEffect(() => {
    const autoInviteIfNeeded = async () => {
      if (!isVisible || !collabAPI || aiInvited) return;
      
      // Auto-invite: start collaboration + invite AI when chat opens
      console.log('Chat opened - auto-inviting AI with collaboration');
      await inviteAI();
    };
    
    if (isVisible && collabAPI) {
      setTimeout(autoInviteIfNeeded, 100);
    }
  }, [isVisible, collabAPI, aiInvited]);

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
          {!aiInvited && (
            <button
              onClick={inviteAI}
              disabled={isInvitingAI || !collabAPI}
              style={{
                padding: '4px 8px',
                backgroundColor: isInvitingAI ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isInvitingAI ? 'not-allowed' : 'pointer',
                fontSize: '12px'
              }}
              title="Invite AI to collaborate on canvas"
            >
              {isInvitingAI ? 'Inviting...' : '+ AI'}
            </button>
          )}
          {aiInvited && (
            <span style={{
              padding: '4px 8px',
              backgroundColor: '#28a745',
              color: 'white',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              ✓ AI Active
            </span>
          )}
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
            {!aiInvited ? (
              <>
                Click "+ AI" above to invite the AI assistant to collaborate on your canvas.
                <br />
                <small>The AI will join as a real collaborator and can create/modify elements.</small>
              </>
            ) : (
              <>
                AI assistant is now collaborating on your canvas!
                <br />
                Try: "Create a blue rectangle" or "Add a text box saying 'Hello'"
              </>
            )}
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