import React from 'react';

export interface ChatInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  value,
  onChange,
  onSend,
  disabled,
  placeholder
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const canSend = value.trim() && !disabled;

  return (
    <div style={{
      padding: '16px 20px',
      borderTop: '1px solid #ddd',
      backgroundColor: '#f8f9fa'
    }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <textarea
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
            minHeight: '36px',
            maxHeight: '100px',
            fontFamily: 'inherit'
          }}
          rows={1}
        />
        <button
          onClick={onSend}
          disabled={!canSend}
          style={{
            padding: '8px 12px',
            backgroundColor: !canSend ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: !canSend ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            minWidth: '60px'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};