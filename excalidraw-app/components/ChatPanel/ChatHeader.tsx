import React from 'react';
import type { StreamingState } from '../../lib/chat/types';

export interface ChatHeaderProps {
  isConnected: boolean;
  streamingState: StreamingState;
  aiInvited: boolean;
  isInvitingAI: boolean;
  aiSyncStatus: 'unknown' | 'synced';
  onCancel: () => void;
  onInviteAI: () => void;
  onClearHistory: () => void;
  onClose: () => void;
  hasCollabAPI: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  isConnected,
  streamingState,
  aiInvited,
  isInvitingAI,
  aiSyncStatus,
  onCancel,
  onInviteAI,
  onClearHistory,
  onClose,
  hasCollabAPI
}) => {
  return (
    <div style={{
      padding: '16px 20px',
      backgroundColor: '#f8f9fa',
      borderBottom: '1px solid #ddd',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: '60px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontWeight: 600 }}>AI Assistant</span>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isConnected ? '#28a745' : '#dc3545'
          }}
          title={isConnected ? 'Connected' : 'Disconnected'}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {streamingState.isActive && (
          <button
            onClick={onCancel}
            style={{
              padding: '4px 8px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="Cancel streaming"
          >
            Cancel
          </button>
        )}

        {!aiInvited && (
          <button
            onClick={onInviteAI}
            disabled={isInvitingAI || !hasCollabAPI}
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
          <span
            style={{
              padding: '4px 8px',
              backgroundColor: aiSyncStatus === 'synced' ? '#28a745' : '#6c757d',
              color: 'white',
              borderRadius: '4px',
              fontSize: '12px'
            }}
            title={
              aiSyncStatus === 'synced'
                ? 'AI is collaborating on the canvas'
                : 'AI sync status unknown'
            }
          >
            {aiSyncStatus === 'synced' ? '✓ AI Active' : '? AI Status'}
          </span>
        )}

        <button
          onClick={onClearHistory}
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
          onClick={onClose}
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
  );
};