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

export const getExecutionInfoLines = (
  info?: ChatMessage['executionInfo'],
  usage?: ChatMessage['usage']
): string[] => {
  if (!info && !usage) return [];
  const lines: string[] = [];
  if (info?.tools && info.tools.length > 0) {
    lines.push(`tools: [${info.tools.join(', ')}]`);
  }
  if (info && typeof info.useRAG === 'boolean') {
    lines.push(`useRAG: ${info.useRAG}`);
  }
  if (info && typeof info.needsSnapshot === 'boolean') {
    lines.push(`needsSnapshot: ${info.needsSnapshot}`);
  }
  if (info && typeof info.planningDurationMs === 'number') {
    lines.push(`planning: ${formatDuration(info.planningDurationMs)}`);
  }
  if (info && typeof info.executionDurationMs === 'number') {
    lines.push(`execution: ${formatDuration(info.executionDurationMs)}`);
  }
  if (info && typeof info.totalDurationMs === 'number') {
    lines.push(`total: ${formatDuration(info.totalDurationMs)}`);
  }
  if (usage?.total_tokens != null) {
    const inTok = usage.input_tokens ?? 0;
    const outTok = usage.output_tokens ?? 0;
    const reasoningTok = usage.reasoning_tokens ?? 0;
    const detailParts = [
      `in=${inTok}`,
      ...(usage.image_tokens != null ? [`images=${usage.image_tokens}`] : []),
      ...(usage.text_tokens != null ? [`text=${usage.text_tokens}`] : []),
      `out=${outTok}`,
      ...(reasoningTok ? [`reasoning=${reasoningTok}`] : []),
    ];
    lines.push(`tokens: total=${usage.total_tokens} (${detailParts.join(', ')})`);
  }
  return lines;
};
