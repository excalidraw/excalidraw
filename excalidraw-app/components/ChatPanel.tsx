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
import { getCollaborationLinkData } from '../data';
import { exportToCanvas } from '@excalidraw/excalidraw';
import type { ChatPanelProps, ChatMessage, ChatCitation, StreamingState } from '../lib/chat/types';
import { formatTimestamp, formatDuration, getExecutionInfoLines } from '../lib/chat/format';
import {
  getLLMBaseURL,
  getStreamingFeatureFlag,
  getThumbnailEnabled,
  getMaxThumbnailDim,
  getThumbnailQuality,
  getMaxThumbnailBytes,
  isDev,
  isStreamingSupported
} from '../lib/chat/config';
import { generateSimpleHash } from '../lib/chat/hash';
import { StreamingIndicator } from './ChatPanel/StreamingIndicator';
import { MessageContentWithRefs } from './ChatPanel/InlineRefs';
import { useCitationFocus } from '../hooks/useCitationFocus';



const ChatPanel: React.FC<ChatPanelProps> = ({
  excalidrawAPI,
  isVisible = true,
  onToggle
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [aiInvited, setAiInvited] = useState(false);
  const [isInvitingAI, setIsInvitingAI] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'planning' | 'executing'>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Citation focus hook
  const { focusCitation } = useCitationFocus({ excalidrawAPI });
  const invitedRoomRef = useRef<string | null>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const collabAPI = useAtomValue(collabAPIAtom);
  const streamClosedRef = useRef<boolean>(false);
  const lastActiveToolRef = useRef<string | undefined>(undefined);
  const uiIndicatorLogRef = useRef<string>('');
  const responseGenTimerRef = useRef<number | undefined>(undefined);
  const activeAssistantMessageIdRef = useRef<string | null>(null);
  const planningAbortControllerRef = useRef<AbortController | null>(null);

  // Simplified AI sync status
  const [aiSyncStatus, setAiSyncStatus] = useState<'unknown' | 'synced'>('unknown');

   // Streaming state
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isActive: false,
    phase: 'idle',
    currentMessage: undefined,
    currentToolName: undefined
  });
  const isStreamingMessageActive = messages.some((msg) => msg.isStreaming);

  // Check if streaming is enabled
  const streamingEnabled = getStreamingFeatureFlag();

  if (streamingEnabled && !isStreamingSupported()) {
    console.warn('Streaming is enabled but EventSource is not available in this environment. Falling back to non-streaming execution.');
  }

  // Resolve LLM service base URL from env or window at runtime
  const LLM_BASE_URL = getLLMBaseURL();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check service health on mount
  useEffect(() => {
    checkServiceHealth();
  }, []);

  // AI bot maintains state through collaboration

  // Manual AI invitation function
  const inviteAI = async () => {
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
      setError(`Failed to invite AI: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsInvitingAI(false);
    }
  };

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
  }, [isVisible, collabAPI, aiInvited]);

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => {
      cleanupStreaming();
    };
  }, []);

  // No cleanup needed - pure collaboration mode

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

  // Cleanup streaming resources
  const cleanupStreaming = (options: { skipClose?: boolean } = {}) => {
    const { skipClose = false } = options;

    streamClosedRef.current = true;

    setStreamingState(prev => {
      if (prev.eventSource && !skipClose) {
        if (isDev()) {
          console.log('🔄 Streaming cleanup initiated', {
            streamId: prev.streamId,
            phase: prev.phase,
            timestamp: new Date().toISOString()
          });
        }

        prev.eventSource.close();

        // The server will detect connection close and automatically abort execution
        // via the AbortController mechanism - no additional cancellation request needed
      }
      // Clear any pending response-generation debounce
      if (responseGenTimerRef.current) {
        clearTimeout(responseGenTimerRef.current);
        responseGenTimerRef.current = undefined;
      }
      lastActiveToolRef.current = undefined;

      // Abort planning request if in progress
      if (planningAbortControllerRef.current) {
        try {
          planningAbortControllerRef.current.abort();
          if (isDev()) console.log('🛑 Planning fetch aborted');
        } catch {}
        planningAbortControllerRef.current = null;
      }

      // Stop spinner on the active assistant message
      if (activeAssistantMessageIdRef.current) {
        const targetId = activeAssistantMessageIdRef.current;
        setMessages(prev => prev.map(msg =>
          msg.id === targetId ? { ...msg, isStreaming: false } : msg
        ));
        activeAssistantMessageIdRef.current = null;
      }

      return {
        isActive: false,
        phase: 'idle',
        currentMessage: undefined,
        currentToolName: undefined,
        eventSource: undefined,
        streamId: undefined
      } satisfies StreamingState;
    });

    setIsLoading(false);
    setLoadingPhase('idle');
  };

  // Handle streaming message execution
  const sendStreamingMessage = async (userMessage: ChatMessage) => {
    const startTs = performance.now ? performance.now() : Date.now();
    let assistantMessageId: string | null = null;
    let eventSourceRefLocal: EventSource | null = null;

    try {
      streamClosedRef.current = false;
      // Step 0: Plan the message before streaming
      setStreamingState({
        isActive: true,
        phase: 'planning',
        currentMessage: undefined,
        currentToolName: undefined
      });

      const planAbortController = new AbortController();
      planningAbortControllerRef.current = planAbortController;
      const planResponse = await fetch(`${LLM_BASE_URL}/api/chat/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: 'default'
        }),
        signal: planAbortController.signal
      });

      let planData: any = null;
      try {
        planData = await planResponse.json();
      } catch {
        planData = null;
      }

      if (!planResponse.ok || !planData?.success || !planData?.plan) {
        const planError = planData?.error || `Planning failed with status ${planResponse.status}`;
        setError(planError);
        cleanupStreaming({ skipClose: true });
        setIsLoading(false);
        setLoadingPhase('idle');
        return;
      }

      // Clear planning abort controller now that we have a response
      planningAbortControllerRef.current = null;

      const planPayload = planData.plan;
      setLoadingPhase('executing');

      // Phase 1: Initialize streaming context
      setStreamingState({
        isActive: true,
        phase: 'initializing',
        currentMessage: undefined,
        currentToolName: undefined
      });

      // Build request body (similar to non-streaming version)
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();

      const canvasContext = {
        elements: elements.length > 0 ? elements.slice(0, 50) : [],
        selection: {
          selectedElementIds: appState.selectedElementIds,
          count: Object.keys(appState.selectedElementIds).length
        }
      };

      let roomId, roomKey;
      try {
        const linkData = getCollaborationLinkData(window.location.href);
        if (linkData) {
          roomId = linkData.roomId;
          roomKey = linkData.roomKey;
        }
      } catch (err) {
        if (isDev()) console.warn('Could not extract room info for streaming:', err);
      }

      // Generate snapshots (simplified for streaming)
      let snapshots: { fullCanvas?: string; selection?: string; thumbnail?: string; thumbnailHash?: string } = {};
      try {
        const thumbnailEnabled = getThumbnailEnabled();

        if (thumbnailEnabled && elements.length > 0) {
          const { exportToCanvas } = await import('@excalidraw/excalidraw');
          const thumbnailCanvas = await exportToCanvas({
            elements: elements,
            appState: { ...appState, exportBackground: true },
            files: excalidrawAPI.getFiles(),
            maxWidthOrHeight: 512,
          });
          snapshots.thumbnail = thumbnailCanvas.toDataURL('image/jpeg', 0.5);
        }
      } catch (err) {
        if (isDev()) console.warn('Failed to generate streaming snapshots:', err);
      }

      const initRequestBody = {
        message: userMessage.content,
        sessionId: 'default',
        plan: planPayload,
        canvas: canvasContext,
        snapshots,
        roomId,
        roomKey
      };

      // Step 1: Initialize streaming execution
      const initResponse = await fetch(`${LLM_BASE_URL}/api/chat/exec/stream/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(initRequestBody),
      });

      if (!initResponse.ok) {
        throw new Error(`Failed to initialize stream: ${initResponse.status}`);
      }

      const initData = await initResponse.json();
      const streamId = initData.streamId;

      if (!streamId) {
        throw new Error('No stream ID received from initialization');
      }

      // Step 2: Open EventSource connection
      const eventSourceUrl = `${LLM_BASE_URL}/api/chat/exec/stream/${streamId}`;
      const eventSource = new EventSource(eventSourceUrl);
      eventSourceRefLocal = eventSource;

      setStreamingState(prev => ({ ...prev, eventSource, streamId }));

      // Create assistant message placeholder
      assistantMessageId = (Date.now() + 1).toString();
      activeAssistantMessageIdRef.current = assistantMessageId;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true,
        toolCalls: []
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Stream lifecycle telemetry
      const streamTelemetry = {
        streamId,
        startTime: Date.now(),
        events: []
      };

      const logEvent = (eventType: string, data?: any) => {
        const timestamp = Date.now();
        streamTelemetry.events.push({
          type: eventType,
          timestamp,
          duration: timestamp - streamTelemetry.startTime,
          data
        });

        if (isDev()) {
          console.log(`📡 [${eventType}]`, {
            streamId,
            elapsed: `${timestamp - streamTelemetry.startTime}ms`,
            data
          });
        }
      };

      // Handle streaming events
      eventSource.onmessage = (event) => {
        logEvent('message', { type: event.type });
      };

      eventSource.addEventListener('connected', (event) => {
        const data = JSON.parse(event.data);
        logEvent('connected', { heartbeatInterval: data.heartbeatInterval });
      });

      eventSource.addEventListener('planAccepted', (event) => {
        const data = JSON.parse(event.data);
        setStreamingState(prev => ({
          ...prev,
          phase: 'planning',
          currentToolName: undefined,
          currentMessage: undefined
        }));
        logEvent('planAccepted', { planTools: data.plan?.tools?.length || 0 });
      });

      eventSource.addEventListener('progress', (event) => {
        const data = JSON.parse(event.data);
        // Debounce responseGeneration so we don't flash it right before toolCallStart
        if (data.phase === 'responseGeneration') {
          if (responseGenTimerRef.current) {
            clearTimeout(responseGenTimerRef.current);
          }
          responseGenTimerRef.current = window.setTimeout(() => {
            setStreamingState(prevInner => ({
              ...prevInner,
              phase: 'responseGeneration',
              currentToolName: prevInner.currentToolName,
              currentMessage: prevInner.currentMessage
            }));
            if (isDev()) {
              console.log('⏳ responseGeneration shown after debounce');
            }
          }, 300);
          if (isDev()) {
            console.log('⏱️ responseGeneration progress received; waiting 300ms to show');
          }
          return;
        }

        setStreamingState(prev => {
          const toolName = prev.currentToolName ?? lastActiveToolRef.current;
          const next = {
            ...prev,
            phase: data.phase,
            currentMessage:
              data.phase === 'toolExecution'
                ? (toolName ? `${toolName} tool is executing...` : prev.currentMessage)
                : data.message ?? prev.currentMessage,
            currentToolName: data.phase === 'toolExecution' ? prev.currentToolName : undefined
          } as StreamingState;
          if (isDev()) {
            console.log('🎯 progress update', {
              incomingPhase: data.phase,
              message: data.message,
              prevTool: prev.currentToolName,
              lastTool: lastActiveToolRef.current,
              nextTool: next.currentToolName,
              nextMessage: next.currentMessage
            });
          }
          return next;
        });
        logEvent('progress', { phase: data.phase, message: data.message });
      });

      eventSource.addEventListener('toolCallStart', (event) => {
        const data = JSON.parse(event.data);
        lastActiveToolRef.current = data.toolName;
        if (responseGenTimerRef.current) {
          clearTimeout(responseGenTimerRef.current);
          responseGenTimerRef.current = undefined;
          if (isDev()) console.log('🛑 cancelled responseGeneration debounce due to toolCallStart');
        }
        setStreamingState(prev => {
          const next = {
            ...prev,
            phase: 'toolExecution',
            currentToolName: data.toolName,
            currentMessage: `${data.toolName} tool is executing...`
          } as StreamingState;
          if (isDev()) {
            console.log('🔧 toolCallStart state', {
              toolName: data.toolName,
              prevTool: prev.currentToolName,
              nextTool: next.currentToolName
            });
          }
          return next;
        });
        logEvent('toolCallStart', { toolName: data.toolName, callId: data.callId });

        // Update tool calls in message
        if (assistantMessageId) {
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId ? {
              ...msg,
              toolCalls: [...(msg.toolCalls || []), {
                id: data.callId,
                toolName: data.toolName,
                status: 'executing' as const,
                startTime: Date.now()
              }]
            } : msg
          ));
        }
      });

      eventSource.addEventListener('toolCallEnd', (event) => {
        const data = JSON.parse(event.data);
        logEvent('toolCallEnd', {
          toolName: data.toolName,
          callId: data.callId,
          success: data.success,
          duration: data.duration
        });

        setStreamingState(prev => {
          const next = {
            ...prev,
            phase: 'responseGeneration',
            currentToolName: prev.currentToolName === data.toolName ? undefined : prev.currentToolName,
            currentMessage:
              prev.currentToolName === data.toolName
                ? undefined
                : prev.currentMessage
          } as StreamingState;
          if (isDev()) {
            console.log('✅ toolCallEnd state', {
              toolName: data.toolName,
              prevTool: prev.currentToolName,
              nextTool: next.currentToolName
            });
          }
          return next;
        });
        if (lastActiveToolRef.current === data.toolName) {
          lastActiveToolRef.current = undefined;
        }

        // Update tool calls in message
        if (assistantMessageId) {
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId ? {
              ...msg,
              toolCalls: (msg.toolCalls || []).map(call =>
                call.id === data.callId ? {
                  ...call,
                  status: data.success ? 'completed' : 'failed',
                  duration: data.duration,
                  summary: data.summary
                } : call
              )
            } : msg
          ));
        }
      });

      eventSource.addEventListener('token', (event) => {
        const data = JSON.parse(event.data);
        if (responseGenTimerRef.current) {
          clearTimeout(responseGenTimerRef.current);
          responseGenTimerRef.current = undefined;
          if (isDev()) console.log('🛑 cancelled responseGeneration debounce due to token');
        }
        setStreamingState(prev => ({
          ...prev,
          phase: 'responseGeneration',
          currentToolName: undefined,
          currentMessage: undefined
        }));
        lastActiveToolRef.current = undefined;
        logEvent('token', { tokenLength: data.token?.length, fullTextLength: data.fullText?.length });

        // Update message content incrementally
        if (assistantMessageId) {
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId ? {
              ...msg,
              content: data.fullText
            } : msg
          ));
        }
      });

      eventSource.addEventListener('usage', (event) => {
        try {
          const data = JSON.parse(event.data);
          logEvent('usage', {
            totalTokens: data.usage?.total_tokens,
            promptTokens: data.usage?.prompt_tokens,
            completionTokens: data.usage?.completion_tokens
          });

          if (assistantMessageId) {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId ? {
                ...msg,
                usage: data.usage
              } : msg
            ));
          }
        } catch (err) {
          if (isDev()) console.warn('Failed to parse usage event', err);
        }
      });

      eventSource.addEventListener('final', (event) => {
        const data = JSON.parse(event.data);
        const endTs = performance.now ? performance.now() : Date.now();
        const totalDuration = endTs - startTs;

        // Final telemetry with comprehensive stream summary
        logEvent('final', {
          success: data.success,
          contentLength: data.content?.length,
          citationsCount: data.citations?.length || 0,
          totalDurationMs: Math.round(totalDuration),
          serverDuration: data.duration,
          totalEvents: streamTelemetry.events.length
        });

        // Log complete telemetry summary in development
        if (isDev()) {
          console.log('📊 Stream Telemetry Summary', {
            streamId,
            totalDuration: Math.round(totalDuration),
            events: streamTelemetry.events,
            performance: {
              eventCount: streamTelemetry.events.length,
              avgEventInterval: Math.round(totalDuration / Math.max(streamTelemetry.events.length - 1, 1))
            }
          });
        }

        // Update final message
        if (assistantMessageId) {
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId ? {
              ...msg,
              content: data.content,
              isStreaming: false,
              durationMs: totalDuration,
              citations: data.citations,
              executionInfo: {
                totalDurationMs: Math.round(totalDuration),
                tools: (msg.toolCalls || []).map(tc => tc.toolName)
              }
            } : msg
          ));
        }

        streamClosedRef.current = true;
        eventSource.close();
        if (responseGenTimerRef.current) {
          clearTimeout(responseGenTimerRef.current);
          responseGenTimerRef.current = undefined;
        }
        activeAssistantMessageIdRef.current = null;
        cleanupStreaming({ skipClose: true });
        setIsLoading(false);
        setLoadingPhase('idle');
      });

      eventSource.addEventListener('error', (event) => {
        if (streamClosedRef.current || eventSource.readyState === EventSource.CLOSED) {
          if (isDev()) {
            console.debug('EventSource error ignored (stream already closed)', { event });
          }
          return;
        }

        let parsed = null;
        try {
          parsed = JSON.parse((event as MessageEvent).data);
        } catch (e) {
          parsed = null;
        }

        if (parsed) {
          logEvent('error', { error: parsed.error, code: parsed.code, phase: parsed.phase });
          setError(`Streaming error: ${parsed.error}`);
        } else {
          logEvent('error', { error: 'connection', details: 'SSE transport error (non-200 response)' });
          setError('Streaming connection failed. Please try again.');
        }

        streamClosedRef.current = true;
        eventSource.close();
        if (responseGenTimerRef.current) {
          clearTimeout(responseGenTimerRef.current);
          responseGenTimerRef.current = undefined;
        }
        activeAssistantMessageIdRef.current = null;
        cleanupStreaming({ skipClose: true });
        setIsLoading(false);
        setLoadingPhase('idle');
      });

      eventSource.onerror = (event) => {
        if (streamClosedRef.current || eventSource.readyState === EventSource.CLOSED) {
          if (isDev()) {
            console.debug('EventSource closed cleanly', { readyState: eventSource.readyState, event });
          }
          return;
        }

        console.error('EventSource error:', event);
        logEvent('error', { error: 'connection', details: 'EventSource error' });
        setError('Connection lost during streaming');
        eventSource.close();
        if (responseGenTimerRef.current) {
          clearTimeout(responseGenTimerRef.current);
          responseGenTimerRef.current = undefined;
        }
        activeAssistantMessageIdRef.current = null;
        cleanupStreaming({ skipClose: true });
        setIsLoading(false);
        setLoadingPhase('idle');
      };

    } catch (err) {
      const isAbort = err instanceof Error && (err.name === 'AbortError' || /aborted/i.test(err.message || ''));
      if (isAbort && streamClosedRef.current) {
        if (isDev()) console.log('✔️ Planning/stream aborted by user');
        setIsLoading(false);
        setLoadingPhase('idle');
        planningAbortControllerRef.current = null;
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Streaming failed';
      setError(errorMessage);
      eventSourceRefLocal?.close();
      if (responseGenTimerRef.current) {
        clearTimeout(responseGenTimerRef.current);
        responseGenTimerRef.current = undefined;
      }
      activeAssistantMessageIdRef.current = null;
      cleanupStreaming({ skipClose: true });
      setIsLoading(false);
      setLoadingPhase('idle');
      if (isDev()) console.error('Streaming error:', err);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);
    setLoadingPhase('planning');

    // Use streaming if enabled
    if (streamingEnabled) {
      await sendStreamingMessage(userMessage);
      return;
    }

    let planPayload: any = null;
    let planUseRAGValue: boolean | undefined;
    let planNeedsSnapshotValue: boolean | undefined;
    let planDurationMs: number | undefined;
    let executionDurationMs: number | undefined;
    let executionStartTs: number | undefined;
    const hasPerformanceNow = typeof performance !== 'undefined' && typeof performance.now === 'function';
    const getNow = () => hasPerformanceNow ? performance.now() : Date.now();
    const startTs = getNow();
    let plannedToolsForExecution: string[] = [];

    try {
      const planAbortController = new AbortController();
      planningAbortControllerRef.current = planAbortController;
      const planResponse = await fetch(`${LLM_BASE_URL}/api/chat/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: 'default'
        }),
        signal: planAbortController.signal
      });

      let planData: any = null;
      try {
        planData = await planResponse.json();
      } catch {
        planData = null;
      }

      if (!planResponse.ok || !planData?.success || !planData?.plan) {
        const planErrorMessage = planData?.error || `Planning failed with status ${planResponse.status}`;
        throw new Error(planErrorMessage);
      }

      // Clear planning abort controller now that we have a response
      planningAbortControllerRef.current = null;

      const planPayload = planData.plan;
      const planEndTs = getNow();
      if (typeof planData.durationMs === 'number' && Number.isFinite(planData.durationMs)) {
        planDurationMs = Math.max(0, Math.round(planData.durationMs));
      } else {
        planDurationMs = Math.max(0, Math.round(planEndTs - startTs));
      }

      const resolvedUseRAG = typeof planData.useRAG === 'boolean' ? planData.useRAG : planPayload?.useRAG;
      const resolvedNeedsSnapshot = typeof planData.needsSnapshot === 'boolean' ? planData.needsSnapshot : planPayload?.needsSnapshot;
      planUseRAGValue = typeof resolvedUseRAG === 'boolean' ? resolvedUseRAG : undefined;
      planNeedsSnapshotValue = typeof resolvedNeedsSnapshot === 'boolean' ? resolvedNeedsSnapshot : undefined;

      const allowlistNames = Array.isArray(planData.allowlist)
        ? planData.allowlist.filter((name: unknown): name is string => typeof name === 'string')
        : [];
      const fallbackToolNames = Array.isArray(planData.toolNames)
        ? planData.toolNames.filter((name: unknown): name is string => typeof name === 'string')
        : Array.isArray(planPayload?.tools)
          ? planPayload.tools
              .map((tool: any) => (tool && typeof tool.name === 'string') ? tool.name : null)
              .filter((name: string | null): name is string => !!name)
          : [];
      const toolListForDisplay = allowlistNames.length > 0 ? allowlistNames : fallbackToolNames;
      plannedToolsForExecution = toolListForDisplay;
      setLoadingPhase('executing');

      if (isDev()) {
        console.log('Planning result', { plan: planPayload, allowlist: toolListForDisplay });
      }

      executionStartTs = getNow();

      // Get canvas context for AI (after planning completes)
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();

      const canvasContext = {
        elements: elements.length > 0 ? elements.slice(0, 50) : [], // Limit for payload size
        selection: {
          selectedElementIds: appState.selectedElementIds,
          count: Object.keys(appState.selectedElementIds).length
        }
      };

      // Get current collaboration room info for LLM service
      let roomId, roomKey;
      try {
        const linkData = getCollaborationLinkData(window.location.href);
        if (linkData) {
          roomId = linkData.roomId;
          roomKey = linkData.roomKey;
        }
      } catch (err) {
        if (isDev()) console.warn('Could not extract room info for LLM service:', err);
      }

      // Generate snapshots for visual analysis
      let snapshots: { fullCanvas?: string; selection?: string; thumbnail?: string; thumbnailHash?: string } = {};
      try {
        const refreshedAppState = excalidrawAPI.getAppState();

        // Generate thumbnail for preattach (if enabled and elements exist)
        const thumbnailEnabled = getThumbnailEnabled();
        const maxThumbnailDim = getMaxThumbnailDim();
        const thumbnailQuality = getThumbnailQuality();
        const maxThumbnailBytes = getMaxThumbnailBytes();

        if (thumbnailEnabled && isVisible && elements.length > 0) {
          try {
            const thumbnailCanvas = await exportToCanvas({
              elements: elements,
              appState: {
                ...refreshedAppState,
                exportBackground: true,
                viewBackgroundColor: refreshedAppState.viewBackgroundColor,
              },
              files: excalidrawAPI.getFiles(),
              maxWidthOrHeight: maxThumbnailDim,
            });

            const thumbnailDataURL = thumbnailCanvas.toDataURL('image/jpeg', thumbnailQuality);

            // Check size limit
            const thumbnailSizeBytes = Math.round((thumbnailDataURL.length - 'data:image/jpeg;base64,'.length) * 0.75);

            if (thumbnailSizeBytes <= maxThumbnailBytes) {
              snapshots.thumbnail = thumbnailDataURL;

              // Generate simple hash for deduplication
              const base64Data = thumbnailDataURL.split(',')[1];
              snapshots.thumbnailHash = await generateSimpleHash(base64Data);

              if (isDev()) {
                console.log(`Generated thumbnail: ${(thumbnailSizeBytes/1000).toFixed(1)}KB, hash: ${snapshots.thumbnailHash}`);
              }
            } else if (isDev()) {
              console.warn(`Thumbnail too large: ${(thumbnailSizeBytes/1000).toFixed(1)}KB > ${(maxThumbnailBytes/1000).toFixed(1)}KB limit`);
            }
          } catch (thumbnailError) {
            if (isDev()) console.warn('Failed to generate thumbnail:', thumbnailError);
          }
        }

        // Generate canvas snapshot
        const canvas = await exportToCanvas({
          elements: elements,
          appState: {
            ...refreshedAppState,
            exportBackground: true,
            viewBackgroundColor: refreshedAppState.viewBackgroundColor,
          },
          files: excalidrawAPI.getFiles(),
          maxWidthOrHeight: 1200,
        });

        const canvasDataURL = canvas.toDataURL('image/png', 0.8);
        snapshots.fullCanvas = canvasDataURL;

        // Generate selection snapshot if elements are selected
        if (Object.keys(refreshedAppState.selectedElementIds).length > 0) {
          const selectedElements = elements.filter(el => refreshedAppState.selectedElementIds[el.id]);
          if (selectedElements.length > 0) {
            const selectionCanvas = await exportToCanvas({
              elements: selectedElements,
              appState: {
                ...refreshedAppState,
                exportBackground: false,
                viewBackgroundColor: 'transparent',
              },
              files: excalidrawAPI.getFiles(),
              maxWidthOrHeight: 800,
            });

            const selectionDataURL = selectionCanvas.toDataURL('image/png', 0.8);
            snapshots.selection = selectionDataURL;
          }
        }
      } catch (snapshotError) {
        console.warn('Failed to generate snapshots:', snapshotError);
        // Continue without snapshots
      }

      const requestBody: Record<string, unknown> = {
        message: userMessage.content,
        sessionId: 'default',
        plan: planPayload,
        canvas: canvasContext,
        snapshots,
        roomId,
        roomKey
      };

      const response = await fetch(`${LLM_BASE_URL}/api/chat/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const endTs = getNow();
        if (typeof executionStartTs === 'number') {
          executionDurationMs = Math.max(0, Math.round(endTs - executionStartTs));
        }
        const durationMs = Math.max(0, Math.round(endTs - startTs));
        if (typeof executionDurationMs !== 'number' && typeof planDurationMs === 'number') {
          executionDurationMs = Math.max(0, durationMs - planDurationMs);
        }
        const executionInfo = {
          tools: plannedToolsForExecution.length > 0 ? plannedToolsForExecution : undefined,
          useRAG: planUseRAGValue,
          needsSnapshot: planNeedsSnapshotValue,
          planningDurationMs: planDurationMs,
          executionDurationMs,
          totalDurationMs: durationMs
        };
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.content,
          timestamp: new Date().toISOString(),
          durationMs,
          planningDurationMs: planDurationMs,
          executionDurationMs,
          executionInfo,
          citations: data.citations || undefined
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      if (isDev()) console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
      setLoadingPhase('idle');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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
        boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 999, // Lower than top UI elements
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
      <style>{`
        @keyframes chatPanelSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #ddd',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: '60px' // Ensure header has good height
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600 }}>AI Assistant</span>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isConnected ? '#28a745' : '#dc3545'
          }} title={isConnected ? 'Connected' : 'Disconnected'} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {streamingState.isActive && (
            <button
              onClick={cleanupStreaming}
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
              onClick={inviteAI}
              disabled={isInvitingAI || !collabAPI}
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
            <span style={{
              padding: '4px 8px',
              backgroundColor: aiSyncStatus === 'synced' ? '#28a745' : '#6c757d',
              color: 'white',
              borderRadius: '4px',
              fontSize: '12px'
            }}
            title={
              aiSyncStatus === 'synced' ? 'AI is collaborating on the canvas' : 'AI sync status unknown'
            }>
              {aiSyncStatus === 'synced' ? '✓ AI Active' : '? AI Status'}
            </span>
          )}
          <button
            onClick={clearHistory}
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
            onClick={onToggle}
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

      {/* Messages */}
      <div style={{
        flex: 1,
        padding: '20px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: '#6c757d',
            fontSize: '14px',
            padding: '20px'
          }}>
            {!aiInvited ? (
              <>
                Click "+ AI" above to invite the AI assistant to collaborate on your canvas.
                <br />
                <small>The AI will join as a real collaborator and can create/modify elements.</small>
              </>
            ) : (
              <>
                AI assistant is now collaborating on your canvas!
                <br />
                <small>Pure collaboration mode active</small>
                <br />
                Try: "Create a blue rectangle" or "Add a text box saying 'Hello'"
              </>
            )}
          </div>
        )}

        {messages.map((message) => {
          return (
            <div
              key={message.id}
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
                  onCitationClick={focusCitation}
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

              {/* References block removed: inline 〖R:n〗 markers are now clickable instead */}
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
                    {message.role === 'assistant' && (() => {
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
                    })()}
                  </div>
                  {message.role === 'assistant' && (
                    <button
                      onClick={() => handleCopy(message)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleCopy(message);
                        }
                      }}
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
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        })}

        {isLoading && !isStreamingMessageActive && (() => {
          const streamingLabels = streamingState.isActive
            ? getStreamingIndicatorLabels(streamingState)
            : null;
          const loaderLabel = streamingLabels
            ? streamingLabels.label
            : loadingPhase === 'planning'
              ? 'Planning...'
              : 'Executing...';
          const loaderSubLabel = streamingLabels?.subLabel;

          return (
          <div style={{
            alignSelf: 'flex-start',
            maxWidth: '80%'
          }}>
            <div
              role="status"
              aria-live="polite"
              aria-label={loaderLabel}
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
          );
        })()}

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

      {/* Input */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid #ddd',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? "Type your message..." : "Service disconnected"}
            disabled={!isConnected || isLoading}
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
            onClick={sendMessage}
            disabled={!inputMessage.trim() || !isConnected || isLoading}
            style={{
              padding: '8px 12px',
              backgroundColor: (!inputMessage.trim() || !isConnected || isLoading) ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (!inputMessage.trim() || !isConnected || isLoading) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              minWidth: '60px'
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
