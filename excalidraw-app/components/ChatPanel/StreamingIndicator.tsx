import React from 'react';
import type { StreamingState } from '../../lib/chat/types';

export interface StreamingIndicatorProps {
  phase: StreamingState['phase'];
  currentToolName?: string;
  currentMessage?: string;
  isCompact?: boolean;
}

export const StreamingIndicator: React.FC<StreamingIndicatorProps> = ({
  phase,
  currentToolName,
  currentMessage,
  isCompact = false
}) => {
  // Determine label based on phase and context
  const getLabel = (): string => {
    if (phase === 'toolExecution' && currentToolName) {
      return `${currentToolName} tool is executing...`;
    }

    if (phase === 'responseGeneration') {
      return 'Generating assistant response...';
    }

    switch (phase) {
      case 'planning':
        return 'Planning...';
      case 'initializing':
        return 'Initializing stream...';
      case 'ragRetrieval':
        return 'Retrieving context...';
      case 'toolExecution':
        return 'Executing tools...';
      default:
        return 'Streaming response...';
    }
  };

  // Normalize and determine sub-label
  const getSubLabel = (): string | undefined => {
    if (!currentMessage) return undefined;
    const trimmed = currentMessage.trim();
    if (!trimmed) return undefined;
    if (trimmed.toLowerCase() === 'executing tools...') return undefined;

    const mainLabel = getLabel();
    return trimmed.toLowerCase() !== mainLabel.toLowerCase() ? trimmed : undefined;
  };

  const label = getLabel();
  const subLabel = getSubLabel();
  const showSubLabel = Boolean(subLabel);

  const spinnerSize = isCompact ? 12 : 16;
  const fontSize = isCompact ? '12px' : '14px';
  const subLabelFontSize = isCompact ? '10px' : '12px';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: '#6c757d',
        fontSize,
        fontStyle: isCompact ? 'italic' : 'normal'
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: `${spinnerSize}px`,
          height: `${spinnerSize}px`,
          border: '2px solid #c3c7d0',
          borderTopColor: '#007bff',
          borderRadius: '50%',
          animation: 'chatPanelSpin 1s linear infinite'
        }}
      />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: showSubLabel ? '2px' : undefined
      }}>
        <span>{label}</span>
        {showSubLabel && (
          <span style={{
            fontSize: subLabelFontSize,
            color: '#6c757d',
            fontStyle: 'normal'
          }}>
            {subLabel}
          </span>
        )}
      </div>
    </div>
  );
};