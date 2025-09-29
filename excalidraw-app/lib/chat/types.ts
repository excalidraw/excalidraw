import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

export interface ChatPanelProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
  isVisible?: boolean;
  onToggle: () => void;
}

export interface ChatCitation {
  index: number;
  documentId: string;
  chunkId: string;
  page?: number;
  chunk_index?: number;
  source?: string;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  durationMs?: number;
  planningDurationMs?: number;
  executionDurationMs?: number;
  citations?: ChatCitation[];
  executionInfo?: {
    tools?: string[];
    useRAG?: boolean;
    needsSnapshot?: boolean;
    planningDurationMs?: number;
    executionDurationMs?: number;
    totalDurationMs?: number;
  };
  // Streaming state
  isStreaming?: boolean;
  toolCalls?: Array<{
    id: string;
    toolName: string;
    status: 'pending' | 'executing' | 'completed' | 'failed';
    startTime?: number;
    duration?: number;
    summary?: string;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    reasoning_tokens?: number;
  };
  responseId?: string;
  finishReason?: string;
}

export interface StreamingState {
  isActive: boolean;
  phase: 'idle' | 'planning' | 'initializing' | 'ragRetrieval' | 'responseGeneration' | 'toolExecution';
  currentMessage?: string;
  currentToolName?: string;
  eventSource?: EventSource;
  streamId?: string;
}