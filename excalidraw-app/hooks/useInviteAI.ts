import { useState, useRef, useEffect, useCallback } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { getCollaborationLinkData } from '../data';
import { isDev } from '../lib/chat/config';

export interface UseInviteAIProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
  collabAPI: any;
  isVisible: boolean;
  onError: (error: string) => void;
}

export interface UseInviteAIResult {
  aiInvited: boolean;
  isInvitingAI: boolean;
  aiSyncStatus: 'unknown' | 'synced';
  inviteAI: () => Promise<void>;
  hasCollabAPI: boolean;
}

export const useInviteAI = ({
  excalidrawAPI,
  collabAPI,
  isVisible,
  onError
}: UseInviteAIProps): UseInviteAIResult => {
  const [aiInvited, setAiInvited] = useState(false);
  const [isInvitingAI, setIsInvitingAI] = useState(false);
  const [aiSyncStatus, setAiSyncStatus] = useState<'unknown' | 'synced'>('unknown');
  const invitedRoomRef = useRef<string | null>(null);

  const hasCollabAPI = Boolean(collabAPI);

  const inviteAI = useCallback(async () => {
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
          if (isDev()) console.log('Using existing collaboration room for AI:', { roomId });
        }
      }

      // If no existing collaboration, start a new collaboration session
      if (!roomId || !roomKey) {
        if (isDev()) console.log('Starting new collaboration session for AI chat');

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
          if (isDev()) console.log('Created new collaboration session for AI:', { roomId });
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
        if (isDev()) console.log('AI bot successfully registered for collaboration room:', roomId);

        // AI bot maintains its own scene state through collaboration
        if (isDev()) console.log('AI bot registered - no manual sync needed in pure collaboration mode');
        setAiSyncStatus('synced');

        // Force a one-time full-scene sync and viewport broadcast so the bot has
        // both the elements and the current viewport cached before first query
        try {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
          if (collabAPI) {
            await collabAPI.syncElements(elements as any);
            if (isDev()) console.log('Forced full-scene sync broadcast to AI bot');
            collabAPI.broadcastViewport(true);
            if (isDev()) console.log('Forced viewport broadcast to AI bot');
          } else {
            if (isDev()) console.warn('Collab API unavailable; skipped forced sync and viewport broadcast');
          }
        } catch (syncErr) {
          if (isDev()) console.warn('Failed to force initial sync/viewport broadcast to AI bot:', syncErr);
        }

      } else {
        throw new Error(`Failed to register AI bot: ${await resp.text()}`);
      }
    } catch (err) {
      if (isDev()) console.error('Failed to invite AI to collaboration:', err);
      onError(`Failed to invite AI: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsInvitingAI(false);
    }
  }, [collabAPI, isInvitingAI, excalidrawAPI, onError]);

  // Auto-invite AI when chat opens (enhanced behavior)
  useEffect(() => {
    const autoInviteIfNeeded = async () => {
      if (!isVisible || !collabAPI || aiInvited) return;

      // Auto-invite: start collaboration + invite AI when chat opens
      if (isDev()) console.log('Chat opened - auto-inviting AI with collaboration');
      await inviteAI();
    };

    if (isVisible && collabAPI) {
      setTimeout(autoInviteIfNeeded, 100);
    }
  }, [isVisible, collabAPI, aiInvited, inviteAI]);

  return {
    aiInvited,
    isInvitingAI,
    aiSyncStatus,
    inviteAI,
    hasCollabAPI
  };
};