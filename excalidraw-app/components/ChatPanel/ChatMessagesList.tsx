import React, { useRef, useEffect } from 'react';
import type { ChatMessage, ChatCitation, StreamingState } from '../../lib/chat/types';
import { ChatMessageBubble } from './ChatMessageBubble';
import { StreamingIndicator } from './StreamingIndicator';

export interface ChatMessagesListProps {
  messages: ChatMessage[];
  onCitationClick: (citation: ChatCitation) => void;
  onCopy: (message: ChatMessage) => void;
  copiedMessageId: string | null;
  streamingState: StreamingState;
  isLoading: boolean;
  isStreamingMessageActive: boolean;
  loadingPhase: 'idle' | 'planning' | 'executing';
  aiInvited: boolean;
  error?: string | null;
}

export const ChatMessagesList: React.FC<ChatMessagesListProps> = ({
  messages,
  onCitationClick,
  onCopy,
  copiedMessageId,
  streamingState,
  isLoading,
  isStreamingMessageActive,
  loadingPhase,
  aiInvited,
  error
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{
      flex: 1,
      padding: '16px 20px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {/* Welcome message when no AI and no messages */}
      {messages.length === 0 && !aiInvited && (
        <div style={{
          textAlign: 'center',
          color: '#6c757d',
          fontSize: '14px',
          lineHeight: 1.5,
          margin: '20px 0'
        }}>
          {!aiInvited ? (
            <>
              Click "+ AI" above to invite the AI assistant to collaborate on your canvas.
              <br />
              <small>The AI will join as a real collaborator and can create/modify elements.</small>
            </>
          ) : (
            'Start a conversation with the AI assistant.'
          )}
        </div>
      )}

      {/* Render messages */}
      {messages.map((message) => (
        <ChatMessageBubble
          key={message.id}
          message={message}
          onCitationClick={onCitationClick}
          onCopy={onCopy}
          copiedMessageId={copiedMessageId}
          streamingState={streamingState}
        />
      ))}

      {/* Loading indicator when not streaming but still loading */}
      {isLoading && !isStreamingMessageActive && (
        <div style={{
          alignSelf: 'flex-start',
          maxWidth: '80%'
        }}>
          <div
            role="status"
            aria-live="polite"
            aria-label={loadingPhase === 'planning' ? 'Planning...' : 'Executing...'}
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              backgroundColor: '#f8f9fa',
              color: '#6c757d'
            }}
          >
            {streamingState.isActive ? (
              <StreamingIndicator
                phase={streamingState.phase}
                currentToolName={streamingState.currentToolName}
                currentMessage={streamingState.currentMessage}
                isCompact={false}
              />
            ) : (
              <StreamingIndicator
                phase={loadingPhase === 'planning' ? 'planning' : 'toolExecution'}
                currentToolName={undefined}
                currentMessage={undefined}
                isCompact={false}
              />
            )}
          </div>
        </div>
      )}

      {/* Error message */}
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
  );
};