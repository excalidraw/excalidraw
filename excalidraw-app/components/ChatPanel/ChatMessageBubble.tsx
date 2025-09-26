import React from 'react';
import type { ChatMessage, ChatCitation, StreamingState } from '../../lib/chat/types';
import { formatTimestamp, formatDuration } from '../../lib/chat/format';
import { MessageContentWithRefs } from './InlineRefs';
import { StreamingIndicator } from './StreamingIndicator';

export interface ChatMessageBubbleProps {
  message: ChatMessage;
  onCitationClick: (citation: ChatCitation) => void;
  onCopy: (message: ChatMessage) => void;
  copiedMessageId: string | null;
  streamingState: StreamingState;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  onCitationClick,
  onCopy,
  copiedMessageId,
  streamingState
}) => {
  const handleCopyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onCopy(message);
    }
  };

  const renderTimingInfo = () => {
    if (message.role !== 'assistant') return null;

    const timingParts: string[] = [];
    if (typeof message.planningDurationMs === 'number') {
      timingParts.push(`planning ${formatDuration(message.planningDurationMs)}`);
    }
    if (typeof message.executionDurationMs === 'number') {
      timingParts.push(`execution ${formatDuration(message.executionDurationMs)}`);
    }
    if (timingParts.length === 0 && typeof message.durationMs === 'number') {
      timingParts.push(`total ${formatDuration(message.durationMs)}`);
    }
    if (timingParts.length === 0) {
      return null;
    }
    return <span style={{ marginLeft: 6 }}>· {timingParts.join(' · ')}</span>;
  };

  return (
    <div
      style={{
        alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
        maxWidth: '80%'
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderRadius: '12px',
          backgroundColor: message.role === 'user' ? '#007bff' : '#f8f9fa',
          color: message.role === 'user' ? 'white' : '#333',
          fontSize: '14px',
          lineHeight: 1.4,
          wordWrap: 'break-word'
        }}
      >
        <MessageContentWithRefs
          message={message}
          onCitationClick={onCitationClick}
        />

        {/* Streaming indicator */}
        {message.isStreaming && (
          <div style={{
            marginTop: '8px',
            color: '#6c757d'
          }}>
            <StreamingIndicator
              phase={streamingState.phase}
              currentToolName={streamingState.currentToolName}
              currentMessage={streamingState.currentMessage}
              isCompact={true}
            />
          </div>
        )}
      </div>

      {/* Timestamp and copy button */}
      {!message.isStreaming && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '4px'
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: '#6c757d',
              textAlign: message.role === 'user' ? 'right' : 'left'
            }}
          >
            {formatTimestamp(message.timestamp)}
            {renderTimingInfo()}
          </div>

          {message.role === 'assistant' && (
            <button
              onClick={() => onCopy(message)}
              onKeyDown={handleCopyKeyDown}
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
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};