import React from 'react';
import type { ChatMessage, ChatCitation } from '../../lib/chat/types';

export interface InlineRefsProps {
  text: string;
  citations: ChatCitation[];
  onCitationClick: (citation: ChatCitation) => void;
}

export const InlineRefs: React.FC<InlineRefsProps> = ({
  text,
  citations,
  onCitationClick
}) => {
  if (!text) return <>{text}</>;

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
    const numbers = (inside.match(/\b\d+\b/g) || [])
      .map(n => parseInt(n, 10))
      .filter(n => Number.isFinite(n));

    if (numbers.length === 0 || citations.length === 0) {
      // If no valid mapping, keep original marker text
      parts.push(<span key={`m-${keyCounter++}`}>{match[0]}</span>);
    } else {
      parts.push(
        <span
          key={`refs-${keyCounter++}`}
          style={{
            display: 'inline-flex',
            gap: '4px',
            verticalAlign: 'baseline'
          }}
        >
          {numbers.map((num, i) => {
            const citation = citations[num - 1];
            if (!citation) {
              return <span key={`r-${num}-${i}`}>〖R:{num}〗</span>;
            }
            return (
              <button
                key={`rbtn-${num}-${i}`}
                onClick={() => onCitationClick(citation)}
                title={`${citation.snippet || ''}${citation.page ? ` (Page ${citation.page})` : ''}`}
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

  return <>{parts}</>;
};

export interface MessageContentWithRefsProps {
  message: ChatMessage;
  onCitationClick: (citation: ChatCitation) => void;
}

export const MessageContentWithRefs: React.FC<MessageContentWithRefsProps> = ({
  message,
  onCitationClick
}) => {
  const text = message.content || '';
  const citations = message.citations || [];

  // Only enhance assistant messages
  if (message.role !== 'assistant' || !text) {
    return <>{text}</>;
  }

  return (
    <InlineRefs
      text={text}
      citations={citations}
      onCitationClick={onCitationClick}
    />
  );
};