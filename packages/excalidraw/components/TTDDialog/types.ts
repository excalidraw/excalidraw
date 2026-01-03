import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { MermaidConfig } from "@excalidraw/mermaid-to-excalidraw";

import type { MermaidToExcalidrawResult } from "@excalidraw/mermaid-to-excalidraw/dist/interfaces";

import type { ChatMessageType } from "../Chat";

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

export type TTDPayload = {
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
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

export interface SavedChat {
  id: string;
  title: string;
  messages: ChatMessageType[];
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
