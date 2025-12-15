/// <reference types="vite/client" />
/**
 * Simple Chat Panel Component
 *
 * A clean, simple chat interface for communicating with the LLM service.
 * Avoids complex type dependencies and focuses on core functionality.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { useSpeechInput } from '../hooks/useSpeechInput';
import { useAppLangCode } from '../app-language/language-state';
import { ChatHeader } from './ChatPanel/ChatHeader';
import { ChatInputBar } from './ChatPanel/ChatInputBar';
import { ChatMessagesList } from './ChatPanel/ChatMessagesList';
import { isAuthShellEnabled } from '../app_constants';
import { useAuthShell } from '../auth-shell/AuthShellContext';

const concatWithSpace = (base: string, addition: string) => {
  const trimmedAddition = addition.trim();
  if (!trimmedAddition) return base;
  if (!base) return trimmedAddition;
  return base.endsWith(' ') ? `${base}${trimmedAddition}` : `${base} ${trimmedAddition}`;
};

const panelContainerStyle: React.CSSProperties = {
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
};

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
  const canAccessPremiumFeatures = isAuthShellEnabled;
  const premiumCollabAPI = canAccessPremiumFeatures ? collabAPI : null;
  const [appLangCode] = useAppLangCode();
  const speechBaseRef = useRef('');

  // Custom hooks
  const { focusCitation } = useCitationFocus({ excalidrawAPI });
  const { generateSnapshots } = useSnapshots({ excalidrawAPI, isVisible });
  const authShell = useAuthShell();
  const getToken = authShell?.getToken;
  const {
    aiInvited,
    isInvitingAI,
    aiSyncStatus,
    inviteAI,
    hasCollabAPI
  } = useInviteAI({
    excalidrawAPI,
    collabAPI: premiumCollabAPI,
    isVisible,
    onError: setError,
    getToken
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
    generateSnapshots,
    getToken,
    collabAPI: premiumCollabAPI
  });

  const {
    supported: speechSupported,
    status: speechStatus,
    error: speechError,
    start: startSpeech,
    stop: stopSpeech,
    reset: resetSpeech
  } = useSpeechInput({
    lang: appLangCode || 'en-US',
    onError: (event) => {
      if (isDev()) {
        console.warn('[SpeechInput] error', { error: event.error, message: event.message });
      }
    },
    onInterim: (text) => {
      setInputMessage(concatWithSpace(speechBaseRef.current, text));
    },
    onFinal: (text) => {
      if (!text) return;
      speechBaseRef.current = concatWithSpace(speechBaseRef.current, text);
      setInputMessage(speechBaseRef.current);
    }
  });

  const isStreamingMessageActive = messages.some((msg) => msg.isStreaming);

  // Resolve LLM service base URL from env or window at runtime
  const LLM_BASE_URL = getLLMBaseURL();

  const checkServiceHealth = useCallback(async () => {
    if (!canAccessPremiumFeatures) {
      setIsConnected(false);
      return;
    }
    try {
      const response = await fetch(`${LLM_BASE_URL}/health`);
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        setIsConnected(Boolean((data as any).ok || (data as any).status === 'healthy'));
      } else {
        const text = await response.text();
        setIsConnected(response.ok && (text.trim().length > 0));
      }
    } catch (err) {
      setIsConnected(false);
      if (isDev()) console.error('Failed to check service health:', err);
    }
  }, [LLM_BASE_URL, canAccessPremiumFeatures]);

  // Check service health on mount and when base URL/auth gating changes
  useEffect(() => {
    if (canAccessPremiumFeatures) {
      checkServiceHealth();
    }
  }, [canAccessPremiumFeatures, checkServiceHealth]);

  // Simple wrapper for sending messages via hook
  const sendMessage = useCallback(async () => {
    const trimmed = inputMessage.trim();
    if (!trimmed || !canAccessPremiumFeatures) return;
    setInputMessage('');
    speechBaseRef.current = '';
    resetSpeech();
    await sendChatMessage(trimmed);
  }, [inputMessage, canAccessPremiumFeatures, sendChatMessage, resetSpeech]);

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => {
      cleanupStreaming();
      stopSpeech();
    };
  }, [cleanupStreaming, stopSpeech]);

  // Stop speech when panel is hidden (component remains mounted but returns null).
  useEffect(() => {
    if (!isVisible) {
      speechBaseRef.current = '';
      resetSpeech();
    }
  }, [isVisible, resetSpeech]);

  // Stop speech when streaming starts to avoid conflicts
  useEffect(() => {
    if (isStreamingMessageActive) {
      speechBaseRef.current = '';
      resetSpeech();
    }
  }, [isStreamingMessageActive, resetSpeech]);
  

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
      const metaLines = getExecutionInfoLines(message.executionInfo, message.usage);
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
    if (!canAccessPremiumFeatures) {
      return;
    }
    try {
      const token = await (getToken ? getToken() : Promise.resolve(null));
      await fetch(`${LLM_BASE_URL}/v1/chat/history/default`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      setMessages([]);
      setError(null);
    } catch (err) {
      if (isDev()) console.error('Failed to clear history:', err);
    }
  };

  const handleInviteAI = useCallback(async () => {
    if (!canAccessPremiumFeatures) {
      return;
    }
    await inviteAI();
  }, [inviteAI, canAccessPremiumFeatures]);

  if (!isVisible) {
    return null; // Button is now handled in renderTopRightUI
  }

  return (
    <div ref={chatPanelRef} style={panelContainerStyle} data-testid="chat-panel">
      <ChatHeader
        isConnected={isConnected}
        streamingState={streamingState}
        aiInvited={aiInvited}
        isInvitingAI={isInvitingAI}
        aiSyncStatus={aiSyncStatus}
        onCancel={cleanupStreaming}
        onInviteAI={handleInviteAI}
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
        onChange={(value) => {
          if (speechStatus === 'listening') {
            speechBaseRef.current = '';
            resetSpeech();
          }
          setInputMessage(value);
        }}
        onSend={sendMessage}
        disabled={!canAccessPremiumFeatures || !isConnected || isLoading}
        placeholder={isConnected ? "Type your message..." : "Service disconnected"}
        speechSupported={speechSupported}
        speechStatus={speechStatus}
        speechError={speechError}
        onStartSpeech={async () => {
          speechBaseRef.current = inputMessage.trim();
          await startSpeech();
        }}
        onStopSpeech={stopSpeech}
      />
    </div>
  );
};

export default ChatPanel;
