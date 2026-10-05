import type { RequestError } from "@excalidraw/excalidraw/errors";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { MermaidConfig } from "@excalidraw/mermaid-to-excalidraw";

import type { MermaidToExcalidrawResult } from "@excalidraw/mermaid-to-excalidraw/dist/interfaces";

import type { BinaryFiles } from "../../types";

export type LLMMessage = {
  role: "user" | "assistant";
  content: string;
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
    warningType?: /* daily rate limit */
    "messageLimitExceeded" | /* general 429 */ "rateLimitExceeded";
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

export type SavedChats = SavedChat[];

/**
 * Interface for TTD chat persistence. Preferably should be stable
 * (e.g. static class/singleton)
 */
export interface TTDPersistenceAdapter {
  /**
   * Load saved chats from storage.
   */
  loadChats(): Promise<SavedChats>;

  /**
   * Save chats to storage.
   */
  saveChats(chats: SavedChats): Promise<void>;
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

export namespace TTTDDialog {
  export type OnGenerate = (opts: {
    prompt: string;
    isRepairFlow?: boolean;
  }) => Promise<void>;

  export type OnTextSubmitProps = {
    messages: LLMMessage[];
    onChunk?: (chunk: string) => void;
    onStreamCreated?: () => void;
    signal?: AbortSignal;
  };

  export type OnTextSubmitRetValue = {
    rateLimit?: number | null;
    rateLimitRemaining?: number | null;
  } & (
    | { generatedResponse: string; error: null }
    | {
        error: RequestError;
        generatedResponse?: null;
      }
  );

  // TTDDialog props
  export type onTextSubmit = (
    props: OnTextSubmitProps,
  ) => Promise<OnTextSubmitRetValue>;

  /**
   * return undefined to use default rendering
   */
  export type renderWarning = (
    chatMessage: TChat.ChatMessage,
  ) => React.ReactNode | undefined;

  export type renderWelcomeScreen = (props: {
    /** null if not rate limit data currently available */
    rateLimits: RateLimits | null;
  }) => React.ReactNode | undefined;
}
