import { useState, useRef, useCallback } from 'react';
import type { ChatMessage, StreamingState } from '../lib/chat/types';
import { getLLMBaseURL, getStreamingFeatureFlag, isStreamingSupported, isDev } from '../lib/chat/config';
import { getCollaborationLinkData } from '../data';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

export interface UseChatStreamProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
  onMessagesUpdate: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  onError: (error: string) => void;
  generateSnapshots: (needsSnapshot?: boolean) => Promise<{ fullCanvas?: string; selection?: string; thumbnail?: string; thumbnailHash?: string }>;
}

export interface UseChatStreamResult {
  streamingState: StreamingState;
  isLoading: boolean;
  loadingPhase: 'idle' | 'planning' | 'executing';
  sendMessage: (inputMessage: string) => Promise<void>;
  cleanupStreaming: (options?: { skipClose?: boolean }) => void;
}

export const useChatStream = ({
  excalidrawAPI,
  onMessagesUpdate,
  onError,
  generateSnapshots
}: UseChatStreamProps): UseChatStreamResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'planning' | 'executing'>('idle');
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isActive: false,
    phase: 'idle',
    currentMessage: undefined,
    currentToolName: undefined
  });

  // Refs for cleanup and state management
  const streamClosedRef = useRef<boolean>(false);
  const lastActiveToolRef = useRef<string | undefined>(undefined);
  const uiIndicatorLogRef = useRef<string>('');
  const responseGenTimerRef = useRef<number | undefined>(undefined);
  const activeAssistantMessageIdRef = useRef<string | null>(null);
  const planningAbortControllerRef = useRef<AbortController | null>(null);

  const LLM_BASE_URL = getLLMBaseURL();
  const streamingEnabled = getStreamingFeatureFlag();

  const cleanupStreaming = useCallback((options: { skipClose?: boolean } = {}) => {
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
        onMessagesUpdate(prev => prev.map(msg =>
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
  }, [onMessagesUpdate]);

  const sendStreamingMessage = useCallback(async (userMessage: ChatMessage) => {
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
        onError(planError);
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
      const snapshots = await generateSnapshots(planPayload?.needsSnapshot);

      // Create streaming request body
      const streamingRequestBody = {
        plan: planPayload,
        message: userMessage.content,
        sessionId: 'default',
        canvasContext,
        snapshots,
        ...(roomId && roomKey ? { roomId, roomKey } : {})
      };

      // Step 2: Open EventSource connection
      const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const eventSourceUrl = `${LLM_BASE_URL}/api/chat/stream-execute?streamId=${encodeURIComponent(streamId)}`;

      const eventSource = new EventSource(eventSourceUrl);
      eventSourceRefLocal = eventSource;

      setStreamingState(prev => ({
        ...prev,
        eventSource: eventSource,
        streamId: streamId
      }));

      // Set up event handlers
      const logEvent = (type: string, data?: any) => {
        if (isDev()) {
          const logEntry = `[${new Date().toISOString()}] ${type}: ${JSON.stringify(data || {})}`;
          uiIndicatorLogRef.current += logEntry + '\n';
        }
      };

      eventSource.addEventListener('phase', (event) => {
        if (streamClosedRef.current) return;

        try {
          const data = JSON.parse(event.data);
          setStreamingState(prev => ({
            ...prev,
            phase: data.phase,
            currentMessage: data.message,
            currentToolName: data.currentToolName
          }));
          logEvent('phase', data);
        } catch (err) {
          if (isDev()) console.warn('Failed to parse phase event:', err);
        }
      });

      eventSource.addEventListener('message', (event) => {
        if (streamClosedRef.current) return;

        try {
          const data = JSON.parse(event.data);

          if (data.type === 'assistant_message_start') {
            assistantMessageId = data.messageId;
            activeAssistantMessageIdRef.current = assistantMessageId;

            const assistantMessage: ChatMessage = {
              id: assistantMessageId || `assistant-${Date.now()}`,
              role: 'assistant',
              content: '',
              timestamp: new Date().toISOString(),
              isStreaming: true
            };

            onMessagesUpdate(prev => [...prev, assistantMessage]);
          } else if (data.type === 'content_delta' && assistantMessageId) {
            onMessagesUpdate(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + data.delta }
                : msg
            ));
          } else if (data.type === 'assistant_message_complete' && assistantMessageId) {
            const executionEndTs = performance.now ? performance.now() : Date.now();
            const executionDurationMs = Math.round(executionEndTs - startTs);

            onMessagesUpdate(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    isStreaming: false,
                    durationMs: executionDurationMs,
                    planningDurationMs: data.planningDurationMs,
                    executionDurationMs: data.executionDurationMs
                  }
                : msg
            ));

            activeAssistantMessageIdRef.current = null;
          }

          logEvent('message', data);
        } catch (err) {
          if (isDev()) console.warn('Failed to parse message event:', err);
        }
      });

      eventSource.onerror = (event) => {
        cleanupStreaming({ skipClose: true });

        if (streamClosedRef.current || eventSource.readyState === EventSource.CLOSED) {
          if (isDev()) {
            console.debug('EventSource error ignored (stream already closed)', { event });
          }
          return;
        }

        console.error('EventSource error:', event);
        logEvent('error', { error: 'connection', details: 'EventSource error' });
        onError('Connection error during streaming');
      };

      eventSource.onopen = () => {
        if (streamClosedRef.current) return;
        logEvent('open', { streamId, url: eventSourceUrl });
      };

      eventSource.addEventListener('close', (event) => {
        cleanupStreaming({ skipClose: true });

        if (streamClosedRef.current || eventSource.readyState === EventSource.CLOSED) {
          if (isDev()) {
            console.debug('EventSource closed cleanly', { readyState: eventSource.readyState, event });
          }
          return;
        }

        console.error('EventSource error:', event);
        logEvent('error', { error: 'connection', details: 'EventSource error' });
        onError('Connection closed unexpectedly');
      });

      // Step 3: Send the streaming request
      try {
        await fetch(`${LLM_BASE_URL}/api/chat/stream-execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Stream-ID': streamId
          },
          body: JSON.stringify(streamingRequestBody)
        });

        // Clear planning abort controller after successful execution start
        planningAbortControllerRef.current = null;
      } catch (err) {
        throw new Error(`Failed to start streaming execution: ${err}`);
      }

    } catch (err: any) {
      cleanupStreaming({ skipClose: true });
      onError(err.message || 'Failed to send streaming message');
      setIsLoading(false);
      setLoadingPhase('idle');
      if (isDev()) console.error('Streaming error:', err);
    }
  }, [LLM_BASE_URL, excalidrawAPI, generateSnapshots, onError, onMessagesUpdate, cleanupStreaming]);

  const sendNonStreamingMessage = useCallback(async (userMessage: ChatMessage) => {
    let planPayload: any = null;
    let planUseRAGValue: boolean | undefined;
    let planNeedsSnapshotValue: boolean | undefined;
    let planDurationMs: number | undefined;
    let executionDurationMs: number | undefined;
    let executionStartTs: number | undefined;
    const hasPerformanceNow = typeof performance !== 'undefined' && typeof performance.now === 'function';
    const getNow = () => hasPerformanceNow ? performance.now() : Date.now();
    const startTs = getNow();

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

      planPayload = planData.plan;
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

      setLoadingPhase('executing');
      if (isDev()) {
        console.log('Planning result', { plan: planPayload });
      }

      executionStartTs = getNow();

      // Get canvas context for AI (after planning completes)
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();

      const canvasContext = {
        elements: elements.length > 0 ? elements.slice(0, 50) : [],
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
        if (isDev()) console.warn('Could not extract room info:', err);
      }

      // Generate snapshots if needed
      const snapshots = await generateSnapshots(planNeedsSnapshotValue);

      // Send request to LLM service
      const requestBody = {
        plan: planPayload,
        message: userMessage.content,
        sessionId: 'default',
        canvasContext,
        snapshots,
        ...(roomId && roomKey ? { roomId, roomKey } : {})
      };

      const response = await fetch(`${LLM_BASE_URL}/api/chat/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      const executionEndTs = getNow();
      if (typeof data.durationMs === 'number' && Number.isFinite(data.durationMs)) {
        executionDurationMs = Math.max(0, Math.round(data.durationMs));
      } else {
        executionDurationMs = Math.max(0, Math.round(executionEndTs - executionStartTs!));
      }

      // Create assistant response
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || 'Response completed.',
        timestamp: new Date().toISOString(),
        durationMs: Math.round(getNow() - startTs),
        planningDurationMs: planDurationMs,
        executionDurationMs
      };

      onMessagesUpdate(prev => [...prev, assistantMessage]);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (isDev()) console.log('🛑 Non-streaming request aborted');
        return;
      }
      onError(err.message || 'Failed to send message');
      if (isDev()) console.error('Non-streaming error:', err);
    } finally {
      setIsLoading(false);
      setLoadingPhase('idle');
    }
  }, [LLM_BASE_URL, excalidrawAPI, generateSnapshots, onError, onMessagesUpdate]);

  const sendMessage = useCallback(async (inputMessage: string) => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    onMessagesUpdate(prev => [...prev, userMessage]);
    setIsLoading(true);
    setLoadingPhase('planning');

    // Use streaming if enabled and supported
    if (streamingEnabled && isStreamingSupported()) {
      await sendStreamingMessage(userMessage);
    } else {
      if (streamingEnabled && !isStreamingSupported()) {
        console.warn('Streaming is enabled but EventSource is not available. Falling back to non-streaming execution.');
      }
      await sendNonStreamingMessage(userMessage);
    }
  }, [isLoading, streamingEnabled, onMessagesUpdate, sendStreamingMessage, sendNonStreamingMessage]);

  return {
    streamingState,
    isLoading,
    loadingPhase,
    sendMessage,
    cleanupStreaming
  };
};