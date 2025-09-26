import type { StreamingState } from './types';

export const getStreamingPhaseLabel = (phase: StreamingState['phase']): string => {
  switch (phase) {
    case 'planning':
      return 'Planning...';
    case 'initializing':
      return 'Initializing stream...';
    case 'ragRetrieval':
      return 'Retrieving context...';
    case 'toolExecution':
      return 'Executing tools...';
    case 'responseGeneration':
      return 'Generating response...';
    default:
      return 'Streaming response...';
  }
};

export const normalizeStatusText = (text?: string): string | undefined => {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.toLowerCase() === 'executing tools...') {
    return undefined;
  }
  return trimmed;
};

export interface StreamingIndicatorLabels {
  label: string;
  subLabel?: string;
}

export const getStreamingIndicatorLabels = (
  state: StreamingState,
  lastActiveToolName?: string
): StreamingIndicatorLabels => {
  const activeToolName = state.currentToolName ?? lastActiveToolName;

  if (state.phase === 'toolExecution' && activeToolName) {
    const label = `${activeToolName} tool is executing...`;
    const message = normalizeStatusText(state.currentMessage);
    return {
      label,
      subLabel:
        message && message.toLowerCase() !== label.toLowerCase() ? message : undefined
    };
  }

  if (state.phase === 'responseGeneration') {
    return {
      label: 'Generating assistant response...',
      subLabel: undefined
    };
  }

  const label = getStreamingPhaseLabel(state.phase);
  const message = normalizeStatusText(state.currentMessage);
  return {
    label,
    subLabel: message && message.toLowerCase() !== label.toLowerCase() ? message : undefined
  };
};

export interface DebounceManager {
  setTimeout: (callback: () => void, delay: number) => void;
  clearTimeout: () => void;
  cleanup: () => void;
}

export const createDebounceManager = (): DebounceManager => {
  let timeoutId: number | undefined;

  return {
    setTimeout: (callback: () => void, delay: number) => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(callback, delay);
    },
    clearTimeout: () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    },
    cleanup: () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    }
  };
};