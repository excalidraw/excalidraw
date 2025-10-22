export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isGenerating?: boolean;
  error?: string;
}

export interface ChatHistory {
  messages: ChatMessage[];
  currentPrompt: string;
}

export interface ChatHistorySnapshot {
  messages: ChatMessage[];
  currentPrompt: string;
  generatedResponse: string | null;
  timestamp: Date;
}

export interface ChatInterfaceProps {
  messages: ChatMessage[];
  currentPrompt: string;
  onPromptChange: (prompt: string) => void;
  onSendMessage: (message: string) => void;
  isGenerating: boolean;
  rateLimits?: {
    rateLimit: number;
    rateLimitRemaining: number;
  } | null;
  onViewAsMermaid?: () => void;
  generatedResponse?: string | null;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}
