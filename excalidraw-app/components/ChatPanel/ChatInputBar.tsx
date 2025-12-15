import React, { useEffect, useRef } from 'react';

export interface ChatInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
  speechSupported?: boolean;
  speechStatus?: 'idle' | 'listening' | 'error';
  speechError?: string | null;
  onStartSpeech?: () => void | Promise<void>;
  onStopSpeech?: () => void;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  speechSupported,
  speechStatus = 'idle',
  speechError,
  onStartSpeech,
  onStopSpeech
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isListening = speechStatus === 'listening';

  useEffect(() => {
    if (isListening && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [value, isListening]);

  const canSend = value.trim().length > 0 && !disabled;
  const canUseMic = Boolean(speechSupported && onStartSpeech && onStopSpeech);
  const micDisabled = disabled || !canUseMic;
  const showMicButton = isListening || value.trim().length === 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (!canSend || isListening) return;
      e.preventDefault();
      onSend();
    }
  };

  const handleMicToggle = async () => {
    if (!canUseMic || micDisabled) return;
    if (speechStatus === 'error') {
      onStopSpeech?.();
      await Promise.resolve(onStartSpeech?.());
      return;
    }
    if (isListening) {
      onStopSpeech?.();
    } else {
      await Promise.resolve(onStartSpeech?.());
    }
  };

  const micTitle = !speechSupported
    ? 'Voice input unavailable'
    : isListening
      ? 'Stop voice input'
      : speechStatus === 'error'
        ? 'Retry voice input'
        : 'Start voice input';

  const primaryActionTitle = showMicButton ? micTitle : 'Send message';
  const primaryActionDisabled = showMicButton ? micDisabled : !canSend;

  return (
    <div style={{
      padding: '16px 20px',
      borderTop: '1px solid #ddd',
      backgroundColor: '#f8f9fa'
    }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            resize: 'none',
            fontSize: '14px',
            minHeight: '64px',
            maxHeight: '180px',
            fontFamily: 'inherit',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere'
          }}
          rows={1}
        />
        <button
          type="button"
          onClick={showMicButton ? handleMicToggle : onSend}
          disabled={primaryActionDisabled}
          title={primaryActionTitle}
          style={{
            padding: '8px 10px',
            backgroundColor: showMicButton
              ? (micDisabled ? '#e5e5e5' : isListening ? '#ff7043' : speechStatus === 'error' ? '#f8d7da' : '#f0f0f0')
              : (!canSend ? '#ccc' : '#007bff'),
            color: showMicButton ? (isListening ? 'white' : '#333') : 'white',
            border: showMicButton ? '1px solid #ddd' : 'none',
            borderRadius: '6px',
            cursor: primaryActionDisabled ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            minWidth: showMicButton ? '42px' : '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
          aria-pressed={showMicButton ? isListening : undefined}
          aria-label={primaryActionTitle}
        >
          {showMicButton ? (
            <>
              <span aria-hidden="true">🎤</span>
              {(isListening || speechStatus === 'error') && (
                <span style={{ fontSize: '12px' }}>{isListening ? 'Stop' : 'Retry'}</span>
              )}
            </>
          ) : (
            'Send'
          )}
        </button>
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ marginTop: '8px', minHeight: '18px' }}
      >
        {isListening && (
          <span style={{ color: '#ff7043', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span
              aria-hidden="true"
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#ff7043',
                animation: 'excalidrawChatPulse 1.2s ease-in-out infinite'
              }}
            />
            <span>Listening...</span>
          </span>
        )}
        {!isListening && speechError && (
          <span style={{ color: '#c1121f', fontSize: '12px' }}>
            {speechError}
          </span>
        )}
        {!speechSupported && (
          <span style={{ color: '#6c757d', fontSize: '12px' }}>
            Voice input unavailable in this browser.
          </span>
        )}
        {!isListening && showMicButton && canUseMic && !speechError && speechSupported && (
          <span style={{ color: '#6c757d', fontSize: '12px' }}>
            Tap the mic to start; tap again to stop.
          </span>
        )}
      </div>
    </div>
  );
};
