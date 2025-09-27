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
import type { ChatPanelProps, ChatMessage } from '../lib/chat/types';
import { getExecutionInfoLines } from '../lib/chat/format';
import { getLLMBaseURL, isDev } from '../lib/chat/config';
import { useCitationFocus } from '../hooks/useCitationFocus';
import { useChatStream } from '../hooks/useChatStream';
import { useSnapshots } from '../hooks/useSnapshots';
import { useInviteAI } from '../hooks/useInviteAI';
import { ChatHeader } from './ChatPanel/ChatHeader';
import { ChatInputBar } from './ChatPanel/ChatInputBar';
import { ChatMessagesList } from './ChatPanel/ChatMessagesList';

const ChatPanel: React.FC<ChatPanelProps> = ({
  excalidrawAPI,
  isVisible = true,
  onToggle
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const chatPanelRef = useRef<HTMLDivElement>(null);
  const collabAPI = useAtomValue(collabAPIAtom);

  // Custom hooks
  const { focusCitation } = useCitationFocus({ excalidrawAPI });
  const { generateSnapshots } = useSnapshots({ excalidrawAPI, isVisible });
  const {
    aiInvited,
    isInvitingAI,
    aiSyncStatus,
    inviteAI,
    hasCollabAPI
  } = useInviteAI({
    excalidrawAPI,
    collabAPI,
    isVisible,
    onError: setError
  });
  const {
    streamingState,
    isLoading,
    loadingPhase,
    sendMessage: sendChatMessage,
    cleanupStreaming
  } = useChatStream({
    excalidrawAPI,
    onMessagesUpdate: setMessages,
    onError: setError,
    generateSnapshots
  });

  const isStreamingMessageActive = messages.some((msg) => msg.isStreaming);

  // Resolve LLM service base URL from env or window at runtime
  const LLM_BASE_URL = getLLMBaseURL();

  // Check service health on mount
  useEffect(() => {
    checkServiceHealth();
  }, []);

  // Simple wrapper for sending messages via hook
  const sendMessage = async () => {
    const trimmed = inputMessage.trim();
    if (!trimmed) return;
    setInputMessage('');
    await sendChatMessage(trimmed);
  };

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => {
      cleanupStreaming();
    };
  }, [cleanupStreaming]);

  const checkServiceHealth = async () => {
    try {
      const response = await fetch(`${LLM_BASE_URL}/api/health`);
      const data = await response.json();
      setIsConnected(data.status === 'healthy');
    } catch (err) {
      setIsConnected(false);
      if (isDev()) console.error('Failed to check service health:', err);
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
      if (isDev()) console.warn('Modern clipboard API failed, falling back to execCommand:', e);
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
      if (isDev()) console.warn('Copy failed:', e);
      return false;
    }
  };

  const buildCopyText = (message: ChatMessage): string => {
    let text = message.content;
    if (message.role === 'assistant') {
      const metaLines = getExecutionInfoLines(message.executionInfo);
      if (metaLines.length > 0) {
        text += `\n\n[Execution]\n${metaLines.join('\n')}`;
      }
    }
    return text;
  };

  // Handle copy button click
  const handleCopy = async (message: ChatMessage) => {
    const success = await copyToClipboard(buildCopyText(message));
    if (success) {
      setCopiedMessageId(message.id);
      setTimeout(() => setCopiedMessageId(null), 1500);
    }
  };

  const clearHistory = async () => {
    try {
      await fetch(`${LLM_BASE_URL}/api/chat/history/default`, {
        method: 'DELETE'
      });
      setMessages([]);
      setError(null);
    } catch (err) {
      if (isDev()) console.error('Failed to clear history:', err);
    }
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
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <ChatHeader
        isConnected={isConnected}
        streamingState={streamingState}
        aiInvited={aiInvited}
        isInvitingAI={isInvitingAI}
        aiSyncStatus={aiSyncStatus}
        onCancel={cleanupStreaming}
        onInviteAI={inviteAI}
        onClearHistory={clearHistory}
        onClose={onToggle}
        hasCollabAPI={hasCollabAPI}
      />

      <ChatMessagesList
        messages={messages}
        onCitationClick={focusCitation}
        onCopy={handleCopy}
        copiedMessageId={copiedMessageId}
        streamingState={streamingState}
        isLoading={isLoading}
        isStreamingMessageActive={isStreamingMessageActive}
        loadingPhase={loadingPhase}
        aiInvited={aiInvited}
        error={error}
      />

      <ChatInputBar
        value={inputMessage}
        onChange={setInputMessage}
        onSend={sendMessage}
        disabled={!isConnected || isLoading}
        placeholder={isConnected ? "Type your message..." : "Service disconnected"}
      />
    </div>
  );
};

export default ChatPanel;