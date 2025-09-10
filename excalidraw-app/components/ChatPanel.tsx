/// <reference types="vite/client" />
/**
 * Simple Chat Panel Component
 * 
 * A clean, simple chat interface for communicating with the LLM service.
 * Avoids complex type dependencies and focuses on core functionality.
 */

import React, { useState, useRef, useEffect } from 'react';
import type { RAGFocusDetail } from '../types/rag.types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useAtomValue } from '../app-jotai';
import { collabAPIAtom } from '../collab/Collab';
import { getCollaborationLinkData } from '../data';
import { exportToCanvas } from '@excalidraw/excalidraw';

interface ChatPanelProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
  isVisible?: boolean;
  onToggle: () => void;
}

interface ChatCitation {
  index: number;
  documentId: string;
  chunkId: string;
  page?: number;
  chunk_index?: number;
  source?: string;
  snippet?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  durationMs?: number;
  citations?: ChatCitation[];
}

// Simple hash function for content deduplication
const generateSimpleHash = async (data: string): Promise<string> => {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const buffer = await crypto.subtle.digest('SHA-1', encoder.encode(data));
      const hashArray = Array.from(new Uint8Array(buffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback to simple hash if crypto API fails
    }
  }
  
  // Simple rolling hash fallback
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
};

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
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const invitedRoomRef = useRef<string | null>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const collabAPI = useAtomValue(collabAPIAtom);
  
  // Simplified AI sync status
  const [aiSyncStatus, setAiSyncStatus] = useState<'unknown' | 'synced'>('unknown');

  // Resolve LLM service base URL from env or window at runtime (typed via vite/client)
  const LLM_BASE_URL: string = (
    import.meta.env?.VITE_LLM_SERVICE_URL ??
    (window as any)?.__EXCALIDRAW_LLM_SERVICE_URL ??
    (window as any)?.__LLM_SERVICE_URL ??
    'http://localhost:3001'
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check service health on mount
  useEffect(() => {
    checkServiceHealth();
  }, []);

  // AI bot maintains state through collaboration

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
          if (import.meta.env.DEV) console.log('Using existing collaboration room for AI:', { roomId });
        }
      }
      
      // If no existing collaboration, start a new collaboration session
      if (!roomId || !roomKey) {
        if (import.meta.env.DEV) console.log('Starting new collaboration session for AI chat');
        
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
          if (import.meta.env.DEV) console.log('Created new collaboration session for AI:', { roomId });
        } else {
          throw new Error('Failed to get collaboration link data after starting collaboration');
        }
      }

      // Register AI bot with the collaboration room
      const username = 'AI Assistant';
      const resp = await fetch('/api/ai/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, roomKey, username })
      });
      
      if (resp.ok) {
        invitedRoomRef.current = roomId;
        setAiInvited(true);
        if (import.meta.env.DEV) console.log('AI bot successfully registered for collaboration room:', roomId);
        
        // AI bot maintains its own scene state through collaboration
        if (import.meta.env.DEV) console.log('AI bot registered - no manual sync needed in pure collaboration mode');
        setAiSyncStatus('synced');

        // Force a one-time full-scene sync and viewport broadcast so the bot has
        // both the elements and the current viewport cached before first query
        try {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
          if (collabAPI) {
            await collabAPI.syncElements(elements as any);
            if (import.meta.env.DEV) console.log('Forced full-scene sync broadcast to AI bot');
            collabAPI.broadcastViewport(true);
            if (import.meta.env.DEV) console.log('Forced viewport broadcast to AI bot');
          } else {
            if (import.meta.env.DEV) console.warn('Collab API unavailable; skipped forced sync and viewport broadcast');
          }
        } catch (syncErr) {
          if (import.meta.env.DEV) console.warn('Failed to force initial sync/viewport broadcast to AI bot:', syncErr);
        }
        
      } else {
        throw new Error(`Failed to register AI bot: ${await resp.text()}`);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to invite AI to collaboration:', err);
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
      if (import.meta.env.DEV) console.log('Chat opened - auto-inviting AI with collaboration');
      await inviteAI();
    };
    
    if (isVisible && collabAPI) {
      setTimeout(autoInviteIfNeeded, 100);
    }
  }, [isVisible, collabAPI, aiInvited]);

  // No cleanup needed - pure collaboration mode

  const checkServiceHealth = async () => {
    try {
      const response = await fetch(`${LLM_BASE_URL}/api/health`);
      const data = await response.json();
      setIsConnected(data.status === 'healthy');
    } catch (err) {
      setIsConnected(false);
      if (import.meta.env.DEV) console.error('Failed to check service health:', err);
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
      const startTs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      // Get canvas context for AI
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      
      const canvasContext = {
        elements: elements.length > 0 ? elements.slice(0, 50) : [], // Limit for payload size
        selection: {
          selectedElementIds: appState.selectedElementIds,
          count: Object.keys(appState.selectedElementIds).length
        }
      };

      // Get current collaboration room info for LLM service
      let roomId, roomKey;
      try {
        const linkData = getCollaborationLinkData(window.location.href);
        if (linkData) {
          roomId = linkData.roomId;
          roomKey = linkData.roomKey;
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('Could not extract room info for LLM service:', err);
      }

      // Generate snapshots for visual analysis
      let snapshots: { fullCanvas?: string; selection?: string; thumbnail?: string; thumbnailHash?: string } = {};
      try {
        const appState = excalidrawAPI.getAppState();
        
        // Generate thumbnail for preattach (if enabled and elements exist)
        const thumbnailEnabled = String(
          import.meta.env.VITE_LLM_INCLUDE_THUMBNAIL_SNAPSHOT ?? (window as any)?.__LLM_INCLUDE_THUMBNAIL_SNAPSHOT ?? 'false'
        ).toLowerCase() === 'true';
        const maxThumbnailDim = Number(import.meta.env.VITE_LLM_THUMBNAIL_MAX_DIM ?? 512);
        const thumbnailQuality = Number(import.meta.env.VITE_LLM_THUMBNAIL_JPEG_QUALITY ?? 0.5);
        const maxThumbnailBytes = Number(import.meta.env.VITE_LLM_THUMBNAIL_MAX_BYTES ?? 300000);
        
        if (thumbnailEnabled && isVisible && elements.length > 0) {
          try {
            const thumbnailCanvas = await exportToCanvas({
              elements: elements,
              appState: {
                ...appState,
                exportBackground: true,
                viewBackgroundColor: appState.viewBackgroundColor,
              },
              files: excalidrawAPI.getFiles(),
              maxWidthOrHeight: maxThumbnailDim,
            });
            
            const thumbnailDataURL = thumbnailCanvas.toDataURL('image/jpeg', thumbnailQuality);
            
            // Check size limit
            const thumbnailSizeBytes = Math.round((thumbnailDataURL.length - 'data:image/jpeg;base64,'.length) * 0.75);
            
            if (thumbnailSizeBytes <= maxThumbnailBytes) {
              snapshots.thumbnail = thumbnailDataURL;
              
              // Generate simple hash for deduplication
              const base64Data = thumbnailDataURL.split(',')[1];
              snapshots.thumbnailHash = await generateSimpleHash(base64Data);
              
              if (import.meta.env.DEV) {
                console.log(`Generated thumbnail: ${(thumbnailSizeBytes/1000).toFixed(1)}KB, hash: ${snapshots.thumbnailHash}`);
              }
            } else if (import.meta.env.DEV) {
              console.warn(`Thumbnail too large: ${(thumbnailSizeBytes/1000).toFixed(1)}KB > ${(maxThumbnailBytes/1000).toFixed(1)}KB limit`);
            }
          } catch (thumbnailError) {
            if (import.meta.env.DEV) console.warn('Failed to generate thumbnail:', thumbnailError);
          }
        }
        
        // Generate canvas snapshot
        const canvas = await exportToCanvas({
          elements: elements,
          appState: {
            ...appState,
            exportBackground: true,
            viewBackgroundColor: appState.viewBackgroundColor,
          },
          files: excalidrawAPI.getFiles(),
          maxWidthOrHeight: 1200,
        });
        
        const canvasDataURL = canvas.toDataURL('image/png', 0.8);
        snapshots.fullCanvas = canvasDataURL;
        
        // Generate selection snapshot if elements are selected
        if (Object.keys(appState.selectedElementIds).length > 0) {
          const selectedElements = elements.filter(el => appState.selectedElementIds[el.id]);
          if (selectedElements.length > 0) {
            const selectionCanvas = await exportToCanvas({
              elements: selectedElements,
              appState: {
                ...appState,
                exportBackground: false,
                viewBackgroundColor: 'transparent',
              },
              files: excalidrawAPI.getFiles(),
              maxWidthOrHeight: 800,
            });
            
            const selectionDataURL = selectionCanvas.toDataURL('image/png', 0.8);
            snapshots.selection = selectionDataURL;
          }
        }
      } catch (snapshotError) {
        console.warn('Failed to generate snapshots:', snapshotError);
        // Continue without snapshots
      }

      const response = await fetch(`${LLM_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: 'default',
          canvas: canvasContext,
          snapshots,
          roomId,
          roomKey
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const endTs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const durationMs = Math.max(0, Math.round(endTs - startTs));
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.content,
          timestamp: new Date().toISOString(),
          durationMs,
          citations: data.citations || undefined
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      if (import.meta.env.DEV) console.error('Chat error:', err);
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

  // Clipboard functionality with fallback
  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn('Modern clipboard API failed, falling back to execCommand:', e);
    }
    
    // Fallback for older browsers or permission issues
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch (e) {
      if (import.meta.env.DEV) console.warn('Copy failed:', e);
      return false;
    }
  };

  // Handle copy button click
  const handleCopy = async (message: ChatMessage) => {
    const success = await copyToClipboard(message.content);
    if (success) {
      setCopiedMessageId(message.id);
      setTimeout(() => setCopiedMessageId(null), 1500);
    }
  };

  // Handle citation chip click: focus PDF on canvas and optionally switch page
  const handleCitationClick = async (citation: ChatCitation) => {
    const detail: RAGFocusDetail = {
      documentId: citation.documentId,
      chunkId: citation.chunkId,
      page: citation.page,
      chunk_index: citation.chunk_index
    };

    try {
      const { documentId, page } = detail;
      if (import.meta.env.DEV) console.log('RAG citation focus requested:', detail);

      // Get current scene elements
      const elements = excalidrawAPI.getSceneElements();

      // Find all PDF elements with matching documentId and prefer the topmost (last in array)
      const matches = elements.filter((el: any) => el.type === 'image' && el.customData?.pdf?.documentId === documentId);
      const pdfElement = matches.length > 0 ? matches[matches.length - 1] : null;

      if (!pdfElement) {
        excalidrawAPI.setToast({ message: 'Document not found on canvas', closable: true, duration: 3000 });
        if (import.meta.env.DEV) console.warn('PDF document not found on canvas:', documentId, 'matches=', matches.length);
        return;
      }

      // Center viewport on the element and select it
      const elementCenter = { x: pdfElement.x + pdfElement.width / 2, y: pdfElement.y + pdfElement.height / 2 };
      const appState = excalidrawAPI.getAppState();
      const containerWidth = (appState as any)?.width || window.innerWidth;
      const containerHeight = (appState as any)?.height || window.innerHeight;
      const newAppState = {
        ...appState,
        scrollX: -elementCenter.x + (containerWidth / 2) / (appState.zoom?.value || 1),
        scrollY: -elementCenter.y + (containerHeight / 2) / (appState.zoom?.value || 1),
        selectedElementIds: { [pdfElement.id]: true } as const
      };
      excalidrawAPI.updateScene({ appState: newAppState });

      // Switch to target page if specified and different
      if (page && pdfElement.customData?.pdf?.page !== page) {
        const { navigatePDFPage } = await import('../pdf/pdf-navigation-handler');
        await navigatePDFPage(excalidrawAPI, pdfElement, page);
      }

      if (import.meta.env.DEV) console.log('RAG citation focus completed successfully');
    } catch (error) {
      const message = error instanceof Error && /Thumbnail not found/i.test(error.message)
        ? 'Thumbnails missing for this PDF. Reopen/import the PDF to reindex.'
        : 'Failed to focus citation';
      excalidrawAPI.setToast({ message, closable: true, duration: 3000 });
      if (import.meta.env.DEV) console.error('Error focusing RAG citation:', error);
    }
  };

  // Render assistant content and make inline markers like 〖R:2〗 or 〖R:2, R:5〗 clickable.
  // Each number maps to message.citations[index-1]. If mapping is missing, show plain text.
  const renderContentWithInlineRefs = (message: ChatMessage): React.ReactNode => {
    const text = message.content || '';
    const citations = message.citations || [];

    // Only enhance assistant messages
    if (message.role !== 'assistant' || !text) return text;

    const parts: React.ReactNode[] = [];
    const regex = /〖([^〗]+)〗/g; // match full-width brackets content
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let keyCounter = 0;

    while ((match = regex.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index);
      if (before) parts.push(<span key={`t-${keyCounter++}`}>{before}</span>);

      const inside = match[1];
      // Extract all numbers inside, tolerate formats like "R:2, R:5" or "2,5"
      const numbers = (inside.match(/\b\d+\b/g) || []).map(n => parseInt(n, 10)).filter(n => Number.isFinite(n));

      if (numbers.length === 0 || citations.length === 0) {
        // If no valid mapping, keep original marker text
        parts.push(<span key={`m-${keyCounter++}`}>{match[0]}</span>);
      } else {
        parts.push(
          <span key={`refs-${keyCounter++}`} style={{ display: 'inline-flex', gap: '4px', verticalAlign: 'baseline' }}>
            {numbers.map((num, i) => {
              const c = citations[num - 1];
              if (!c) {
                return <span key={`r-${num}-${i}`}>〖R:{num}〗</span>;
              }
              return (
                <button
                  key={`rbtn-${num}-${i}`}
                  onClick={() => handleCitationClick(c)}
                  title={`${c.snippet || ''}${c.page ? ` (Page ${c.page})` : ''}`}
                  style={{
                    padding: '0 6px',
                    fontSize: '10px',
                    fontFamily: 'Monaco, "Lucida Console", monospace',
                    backgroundColor: '#fff',
                    border: '1px solid #dadce0',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    color: '#1a73e8',
                    lineHeight: 1.4
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e8f0fe';
                    e.currentTarget.style.borderColor = '#1a73e8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#fff';
                    e.currentTarget.style.borderColor = '#dadce0';
                  }}
                >
                  R:{num}
                </button>
              );
            })}
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    const tail = text.slice(lastIndex);
    if (tail) parts.push(<span key={`t-${keyCounter++}`}>{tail}</span>);

    return parts;
  };

  const clearHistory = async () => {
    try {
      await fetch(`${LLM_BASE_URL}/api/chat/history/default`, {
        method: 'DELETE'
      });
      setMessages([]);
      setError(null);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to clear history:', err);
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

  const formatDuration = (ms?: number): string => {
    if (ms == null) return '';
    const s = (ms / 1000).toFixed(1);
    return `${s}s`;
  };

  if (!isVisible) {
    return null; // Button is now handled in renderTopRightUI
  }

  return (
    <div 
      ref={chatPanelRef}
      style={{
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
              backgroundColor: aiSyncStatus === 'synced' ? '#28a745' : '#6c757d',
              color: 'white',
              borderRadius: '4px',
              fontSize: '12px'
            }}
            title={
              aiSyncStatus === 'synced' ? 'AI is collaborating on the canvas' : 'AI sync status unknown'
            }>
              {aiSyncStatus === 'synced' ? '✓ AI Active' : '? AI Status'}
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
                <small>Pure collaboration mode active</small>
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
              {renderContentWithInlineRefs(message)}
            </div>
            
            {/* References block removed: inline 〖R:n〗 markers are now clickable instead */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '4px'
            }}>
              <div style={{
                fontSize: '11px',
                color: '#6c757d',
                textAlign: message.role === 'user' ? 'right' : 'left'
              }}>
                {formatTimestamp(message.timestamp)}
                {message.role === 'assistant' && message.durationMs != null && (
                  <span style={{ marginLeft: 6 }}>· {formatDuration(message.durationMs)}</span>
                )}
              </div>
              {message.role === 'assistant' && (
                <button
                  onClick={() => handleCopy(message)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCopy(message);
                    }
                  }}
                  aria-label="Copy reply"
                  title="Copy reply"
                  style={{
                    padding: '4px 8px',
                    border: '1px solid #ddd',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: '11px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#6c757d',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                    e.currentTarget.style.borderColor = '#007bff';
                    e.currentTarget.style.color = '#007bff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#fff';
                    e.currentTarget.style.borderColor = '#ddd';
                    e.currentTarget.style.color = '#6c757d';
                  }}
                >
                  {copiedMessageId === message.id ? (
                    <>
                      <span>✓</span>
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
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