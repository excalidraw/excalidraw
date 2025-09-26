import type { ChatMessage } from './types';

export const formatTimestamp = (timestamp: string): string => {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
};

export const formatDuration = (ms?: number): string => {
  if (ms == null) return '';
  const s = (ms / 1000).toFixed(1);
  return `${s}s`;
};

export const getExecutionInfoLines = (info?: ChatMessage['executionInfo']): string[] => {
  if (!info) return [];
  const lines: string[] = [];
  if (info.tools && info.tools.length > 0) {
    lines.push(`tools: [${info.tools.join(', ')}]`);
  }
  if (typeof info.useRAG === 'boolean') {
    lines.push(`useRAG: ${info.useRAG}`);
  }
  if (typeof info.needsSnapshot === 'boolean') {
    lines.push(`needsSnapshot: ${info.needsSnapshot}`);
  }
  if (typeof info.planningDurationMs === 'number') {
    lines.push(`planning: ${formatDuration(info.planningDurationMs)}`);
  }
  if (typeof info.executionDurationMs === 'number') {
    lines.push(`execution: ${formatDuration(info.executionDurationMs)}`);
  }
  if (typeof info.totalDurationMs === 'number') {
    lines.push(`total: ${formatDuration(info.totalDurationMs)}`);
  }
  return lines;
};