export type AIAgentProvider =
  | "openai"
  | "openrouter"
  | "groq"
  | "ollama"
  | "custom";

export interface AIAgentSettings {
  apiKey: string;
  baseURL: string;
  model: string;
  showCursor: boolean;
  provider: AIAgentProvider;
}

export type AIAgentStatus = "idle" | "thinking" | "drawing" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  status?: "streaming" | "done" | "error";
  errorMessage?: string;
  diagramCode?: string;
  diagramType?: "mermaid" | "excalidraw";
  elementIds?: string[];
}

export interface DiagramInsertionResult {
  elementIds: string[];
  bounds: [number, number, number, number];
}
