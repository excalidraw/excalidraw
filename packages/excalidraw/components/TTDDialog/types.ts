import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { MermaidConfig } from "@excalidraw/mermaid-to-excalidraw";

import type { MermaidToExcalidrawResult } from "@excalidraw/mermaid-to-excalidraw/dist/interfaces";

import type { BinaryFiles } from "../../types";

// API Types
export type OnTestSubmitRetValue = {
  rateLimit?: number | null;
  rateLimitRemaining?: number | null;
} & (
  | { generatedResponse: string | undefined; error?: null | undefined }
  | {
      error: Error;
      generatedResponse?: null | undefined;
    }
);

export type LLMMessage = {
  role: "user" | "assistant";
  content: string;
};

export type OnTextSubmitProps = {
  messages: LLMMessage[];
  onChunk?: (chunk: string) => void;
  onStreamCreated?: () => void;
  signal?: AbortSignal;
};

export type MermaidData = {
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles | null;
};

export interface RateLimits {
  rateLimit: number;
  rateLimitRemaining: number;
}

export namespace TChat {
  export type ChatMessage = {
    id: string;
    timestamp: Date;
    isGenerating?: boolean;
    error?: string;
    errorDetails?: string;
    errorType?: "parse" | "network" | "other";
    lastAttemptAt?: number;
    type: "user" | "assistant" | "warning";
    warningType?: "rateLimitExceeded";
    content?: string;
  };

  export type ChatHistory = {
    id: string;
    messages: ChatMessage[];
    currentPrompt: string;
  };
}

export interface SavedChat {
  id: string;
  title: string;
  messages: TChat.ChatMessage[];
  currentPrompt: string;
  timestamp: number;
}

export interface MermaidToExcalidrawLibProps {
  loaded: boolean;
  api: Promise<{
    parseMermaidToExcalidraw: (
      definition: string,
      config?: MermaidConfig,
    ) => Promise<MermaidToExcalidrawResult>;
  }>;
}
