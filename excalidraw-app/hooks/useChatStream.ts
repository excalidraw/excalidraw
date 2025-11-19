import { useState, useRef, useCallback } from 'react';
import type { ChatMessage, StreamingState } from '../lib/chat/types';
import { getLLMBaseURL, isStreamingSupported, isDev } from '../lib/chat/config';
import { getCollaborationLinkData } from '../data';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

export interface UseChatStreamProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
  onMessagesUpdate: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  onError: (error: string | null) => void;
  generateSnapshots: (needsSnapshot?: boolean) => Promise<{ fullCanvas?: string; selection?: string; thumbnail?: string; thumbnailHash?: string }>;
  getToken?: () => Promise<string | null>;
  collabAPI?: any;
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
  generateSnapshots,
  getToken,
  collabAPI
}: UseChatStreamProps): UseChatStreamResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'planning' | 'executing'>('idle');
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isActive: false,
    phase: 'idle',
    currentMessage: undefined,
    currentToolName: undefined,
    toolRuns: []
  });

  // Refs for cleanup and state management
  const streamClosedRef = useRef<boolean>(false);
  const lastActiveToolRef = useRef<string | undefined>(undefined);
  const uiIndicatorLogRef = useRef<string>('');
  const responseGenTimerRef = useRef<number | undefined>(undefined);
  const activeAssistantMessageIdRef = useRef<string | null>(null);
  const planningAbortControllerRef = useRef<AbortController | null>(null);
  const toolRunsRef = useRef<Array<{ name: string; startTime: number; endTime?: number; durationMs?: number; summary?: string }>>([]);

  const LLM_BASE_URL = getLLMBaseURL();

  const getRoomInfo = useCallback((): { roomId?: string; roomKey?: string } => {
    try {
      const activeLink = collabAPI?.getActiveRoomLink?.() || window.location.href;
      const linkData = getCollaborationLinkData(activeLink);
      if (linkData) {
        return { roomId: linkData.roomId, roomKey: linkData.roomKey };
      }
    } catch (err) {
      if (isDev()) console.warn('Could not resolve room info:', err);
    }
    return {};
  }, [collabAPI]);

  const normalizeUsageForMessage = (usage: any | undefined) => {
    if (!usage || typeof usage !== 'object') {
      return undefined;
    }

    const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? usage.total_prompt_tokens ?? usage.request_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? usage.total_completion_tokens ?? usage.response_tokens ?? 0;
    const totalTokens = usage.total_tokens ?? (inputTokens + outputTokens);
    const reasoningTokens = usage.reasoning_tokens ?? usage.output_tokens_details?.reasoning_tokens ?? 0;

    return {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      reasoning_tokens: reasoningTokens
    };
  };

  type ToolCall = NonNullable<ChatMessage['toolCalls']>[number];
  const mapToolCallsForMessage = (toolCalls: any): ChatMessage['toolCalls'] | undefined => {
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
      return undefined;
    }

    return toolCalls.map((tc: any, index: number): ToolCall => {
      const id = tc.id || tc.call_id || tc.tool_call_id || `tool-${Date.now()}-${index}`;
      const toolName = tc.function?.name || tc.name || 'tool';
      return {
        id,
        toolName,
        status: 'completed',
        summary: typeof tc.summary === 'string' ? tc.summary : undefined
      } as ToolCall;
    });
  };

  const mapToolRunsToToolCalls = () =>
    toolRunsRef.current.map((run, index): ToolCall => ({
      id: `${run.name}-${run.startTime}-${index}`,
      toolName: run.name,
      status: run.endTime ? 'completed' : 'executing',
      duration: run.durationMs,
      summary: run.summary,
    }));

  const syncToolRunsToAssistantMessage = () => {
    const targetId = activeAssistantMessageIdRef.current;
    if (!targetId) return;
    const toolCalls = mapToolRunsToToolCalls();
    onMessagesUpdate((prev) =>
      prev.map((msg) => (msg.id === targetId ? { ...msg, toolCalls } : msg)),
    );
  };

  const updateAssistantMessage = (updater: (msg: ChatMessage) => ChatMessage) => {
    const targetId = activeAssistantMessageIdRef.current;
    if (!targetId) return;
    onMessagesUpdate((prev) =>
      prev.map((msg) => (msg.id === targetId ? updater(msg) : msg)),
    );
  };

  const requestPlanData = useCallback(async (message: string) => {
    const planAbortController = new AbortController();
    planningAbortControllerRef.current = planAbortController;

    try {
      const token = (await getToken?.()) || undefined;
      const response = await fetch(`${LLM_BASE_URL}/v1/chat/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message,
          sessionId: 'default'
        }),
        signal: planAbortController.signal
      });

      let planData: any = null;
      try {
        planData = await response.json();
      } catch {
        planData = null;
      }

      if (!response.ok || !planData?.success || !planData?.plan) {
        const errorMessage = planData?.error || `Planning failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      return planData;
    } finally {
      if (planningAbortControllerRef.current === planAbortController) {
        planningAbortControllerRef.current = null;
      }
    }
  }, [LLM_BASE_URL, getToken]);

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
        toolRuns: toolRunsRef.current,
        eventSource: undefined,
        streamId: undefined
      } satisfies StreamingState;
    });

    setIsLoading(false);
    setLoadingPhase('idle');
  }, [onMessagesUpdate]);

  const sendStreamingMessage = useCallback(async (userMessage: ChatMessage) => {
    const startTs = performance.now ? performance.now() : Date.now();
    let planningStartTs = startTs;
    let planningEndTs: number | undefined;
    let executionStartTs: number | undefined;
    let assistantMessageId: string | null = null;
    let eventSourceRefLocal: EventSource | null = null;
    const assignAssistantMessageId = (incomingId?: string | null) => {
      const resolvedId = incomingId ?? `assistant-${Date.now()}`;
      assistantMessageId = resolvedId;
      activeAssistantMessageIdRef.current = resolvedId;
      return resolvedId;
    };

    try {
      streamClosedRef.current = false;
      // Step 0: Plan the message before streaming
      setStreamingState({
        isActive: true,
        phase: 'planning',
        currentMessage: undefined,
        currentToolName: undefined,
        toolRuns: toolRunsRef.current
      });

      let planData: any;
      try {
        planData = await requestPlanData(userMessage.content);
        planningEndTs = performance.now ? performance.now() : Date.now();
      } catch (err: any) {
        const planError = err?.message || 'Planning failed';
        onError(planError);
        cleanupStreaming({ skipClose: true });
        setIsLoading(false);
        setLoadingPhase('idle');
        return;
      }

      const planPayload = planData.plan;
      executionStartTs = performance.now ? performance.now() : Date.now();
      setLoadingPhase('executing');

      // Phase 1: Initialize streaming context
      setStreamingState({
        isActive: true,
        phase: 'initializing',
        currentMessage: undefined,
        currentToolName: undefined,
        toolRuns: toolRunsRef.current
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

      const { roomId, roomKey } = getRoomInfo();

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

      // Step 2: Register streaming context with backend
      const token = (await getToken?.()) || undefined;
      const initResponse = await fetch(`${LLM_BASE_URL}/v1/chat/exec/stream/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(streamingRequestBody)
      });

      let initData: any = null;
      try {
        initData = await initResponse.json();
      } catch {}

      if (!initResponse.ok || !initData?.streamId) {
        const errorMessage = initData?.error || `Streaming init failed with status ${initResponse.status}`;
        throw new Error(errorMessage);
      }

      const streamId: string = initData.streamId;
      const accessToken: string | undefined = initData.accessToken;

      // Step 3: Open EventSource connection using server-provided streamId
      const eventSourceUrl = accessToken
        ? `${LLM_BASE_URL}/v1/chat/exec/stream/${encodeURIComponent(streamId)}?access_token=${encodeURIComponent(accessToken)}`
        : `${LLM_BASE_URL}/v1/chat/exec/stream/${encodeURIComponent(streamId)}`;
      const eventSource = new EventSource(eventSourceUrl);
      eventSourceRefLocal = eventSource;
      toolRunsRef.current = [];
      setStreamingState(prev => ({ ...prev, toolRuns: [] }));

      setStreamingState(prev => ({
        ...prev,
        eventSource,
        streamId
      }));

      // Set up event handlers
      const logEvent = (type: string, data?: any) => {
        if (isDev()) {
          const logEntry = `[${new Date().toISOString()}] ${type}: ${JSON.stringify(data || {})}`;
          uiIndicatorLogRef.current += logEntry + '\n';
        }
      };

      // Minimal Responses API events
      eventSource.addEventListener('token', (event) => {
        if (streamClosedRef.current) return;
        try {
          const data = JSON.parse((event as MessageEvent).data);
          if (!assistantMessageId) {
            const resolvedId = assignAssistantMessageId(null);
            const assistantMessage: ChatMessage = {
              id: resolvedId,
              role: 'assistant',
              content: data.content || '',
              timestamp: new Date().toISOString(),
              isStreaming: true,
              toolCalls: mapToolRunsToToolCalls(),
            };
            onMessagesUpdate(prev => [...prev, assistantMessage]);
          } else {
            onMessagesUpdate(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + (data.content || '') }
                : msg
            ));
            syncToolRunsToAssistantMessage();
          }
        } catch (err) {
          if (isDev()) console.warn('Failed to parse token event:', err);
        }
      });

      eventSource.addEventListener('toolCallStart', (event) => {
        if (streamClosedRef.current) return;
        try {
          const data = JSON.parse((event as MessageEvent).data);
          const now = Date.now();
          toolRunsRef.current = [...toolRunsRef.current, { name: data.toolName, startTime: now }];
          setStreamingState(prev => ({
            ...prev,
            phase: 'toolExecution',
            currentToolName: data.toolName,
            toolRuns: toolRunsRef.current,
          }));
          syncToolRunsToAssistantMessage();
        } catch (err) {
          if (isDev()) console.warn('Failed to parse toolCallStart:', err);
        }
      });

      eventSource.addEventListener('toolCallResult', (event) => {
        if (streamClosedRef.current) return;
        try {
          const data = JSON.parse((event as MessageEvent).data);
          const now = Date.now();
          // If we never saw a start event (backend only emits result), seed a run entry.
          const existingIdx = toolRunsRef.current.findIndex(
            (run) => !run.endTime && run.name === data.toolName
          );
          if (existingIdx === -1) {
            toolRunsRef.current = [
              ...toolRunsRef.current,
              { name: data.toolName, startTime: now },
            ];
          }
          toolRunsRef.current = toolRunsRef.current.map((run) => {
            if (run.endTime || run.name !== data.toolName) return run;
            const durationMs = Math.max(0, now - run.startTime);
            const summary =
              typeof data.result?.count === 'number'
                ? `count=${data.result.count}`
                : undefined;
            return { ...run, endTime: now, durationMs, summary };
          });
          setStreamingState(prev => ({
            ...prev,
            currentToolName: undefined,
            toolRuns: toolRunsRef.current,
            phase: prev.phase === 'toolExecution' ? 'responseGeneration' : prev.phase,
          }));
          syncToolRunsToAssistantMessage();
        } catch (err) {
          if (isDev()) console.warn('Failed to parse toolCallResult:', err);
        }
      });

      eventSource.addEventListener('usage', (event) => {
        if (streamClosedRef.current) return;
        try {
          const data = JSON.parse((event as MessageEvent).data);
          const usage = normalizeUsageForMessage(data?.usage || data);
          const responseId = data?.responseId;
          const ensureAssistantId = () => {
            if (!assistantMessageId) {
              const resolvedId = assignAssistantMessageId(null);
              const assistantMessage: ChatMessage = {
                id: resolvedId,
                role: 'assistant',
                content: '',
                timestamp: new Date().toISOString(),
                isStreaming: true,
                toolCalls: mapToolRunsToToolCalls(),
              };
              onMessagesUpdate((prev) => [...prev, assistantMessage]);
              return resolvedId;
            }
            return assistantMessageId;
          };
          if (usage) {
            const targetId = ensureAssistantId();
            onMessagesUpdate((prev) =>
              prev.map((msg) =>
                msg.id === targetId ? { ...msg, usage } : msg
              ),
            );
          }
          if (responseId) {
            // Track responseId on the assistant message if provided
            const targetId = assistantMessageId || activeAssistantMessageIdRef.current;
            if (targetId) {
              onMessagesUpdate((prev) =>
                prev.map((msg) =>
                  msg.id === targetId ? { ...msg, responseId } : msg
                ),
              );
            }
          }
        } catch (err) {
          if (isDev()) console.warn('Failed to parse usage event:', err);
        }
      });

      eventSource.addEventListener('done', () => {
        if (streamClosedRef.current) return;
        syncToolRunsToAssistantMessage();

        // Calculate timing information
        const endTs = performance.now ? performance.now() : Date.now();
        const totalDurationMs = Math.round(endTs - startTs);
        const planningDurationMs = planningEndTs ? Math.round(planningEndTs - planningStartTs) : undefined;
        const executionDurationMs = executionStartTs ? Math.round(endTs - executionStartTs) : undefined;

        if (assistantMessageId) {
          onMessagesUpdate(prev => prev.map(msg =>
            msg.id === assistantMessageId ? {
              ...msg,
              isStreaming: false,
              durationMs: totalDurationMs,
              planningDurationMs,
              executionDurationMs,
              toolCalls: mapToolRunsToToolCalls()
            } : msg
          ));
        }
        setStreamingState(prev => ({ ...prev, isActive: false, phase: 'idle' }));
        setIsLoading(false);
        if (eventSourceRefLocal) {
          eventSourceRefLocal.close();
          eventSourceRefLocal = null;
        }
        cleanupStreaming({ skipClose: true });
      });

      // Tool call events not used yet; can be added later

      eventSource.onerror = (event) => {
        if (streamClosedRef.current || eventSource.readyState === EventSource.CLOSED) {
          if (eventSourceRefLocal) {
            eventSourceRefLocal.close();
            eventSourceRefLocal = null;
          }
          return;
        }

        cleanupStreaming({ skipClose: false });

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

      // Clear planning abort controller after successful execution start
      planningAbortControllerRef.current = null;

    } catch (err: any) {
      cleanupStreaming({ skipClose: true });
      onError(err.message || 'Failed to send streaming message');
      setIsLoading(false);
      setLoadingPhase('idle');
      if (isDev()) console.error('Streaming error:', err);
    }
  }, [LLM_BASE_URL, excalidrawAPI, generateSnapshots, onError, onMessagesUpdate, cleanupStreaming]);

  const sendMessage = useCallback(async (inputMessage: string) => {
    if (!inputMessage.trim() || isLoading) return;

    // Check streaming support upfront
    if (!isStreamingSupported()) {
      onError('Streaming is not supported in your browser. Please upgrade to a modern browser.');
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    onMessagesUpdate(prev => [...prev, userMessage]);
    setIsLoading(true);
    setLoadingPhase('planning');

    await sendStreamingMessage(userMessage);
  }, [isLoading, onMessagesUpdate, sendStreamingMessage, onError]);

  return {
    streamingState,
    isLoading,
    loadingPhase,
    sendMessage,
    cleanupStreaming
  };
};
