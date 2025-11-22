/**
 * LLMProviderAdapter
 * 
 * Base interface for LLM provider adapters.
 * Each provider (OpenAI, Gemini, Claude, Ollama) implements this interface.
 */

import type {
  ProviderCredentials,
  ConnectionTestResult,
  ModelInfo,
} from '../AIConfigurationService';

export interface AnalysisOptions {
  prompt?: string;
  maxTokens?: number;
  temperature?: number;
  retryAttempts?: number;
}

export interface AnalysisResult {
  mermaidCode: string;
  confidence?: number;
  tokensUsed?: number;
  processingTime: number;
}

export interface LLMProviderAdapter {
  /**
   * Test connection to the provider with given credentials
   */
  testConnection(
    credentials: ProviderCredentials['credentials'],
  ): Promise<ConnectionTestResult>;

  /**
   * Fetch available models from the provider
   */
  fetchModels(
    credentials: ProviderCredentials['credentials'],
  ): Promise<ModelInfo[]>;

  /**
   * Analyze image and generate mermaid diagram code
   */
  analyzeImage(
    credentials: ProviderCredentials['credentials'],
    imageDataUrl: string,
    options?: AnalysisOptions,
  ): Promise<AnalysisResult>;
}

/**
 * Default prompt for image-to-mermaid conversion
 */
export const DEFAULT_MERMAID_PROMPT = `Analyze this diagram image and convert it to Mermaid diagram syntax.

Instructions:
1. Identify all shapes, boxes, and nodes in the diagram
2. Identify all connections, arrows, and relationships
3. Identify any text labels on shapes or connections
4. Generate valid Mermaid syntax that represents this diagram
5. Use the most appropriate Mermaid diagram type (flowchart, sequence, class, state, etc.)
6. Ensure all syntax is correct and will render properly

Return ONLY the Mermaid code, no explanations or markdown code blocks.`;

/**
 * Base error class for LLM provider errors
 */
export class LLMProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public statusCode?: number,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends LLMProviderError {
  constructor(provider: string, retryAfter?: number) {
    super(
      `Rate limit exceeded for ${provider}${retryAfter ? `. Retry after ${retryAfter}s` : ''}`,
      provider,
      429,
    );
    this.name = 'RateLimitError';
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends LLMProviderError {
  constructor(provider: string) {
    super(`Authentication failed for ${provider}`, provider, 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Invalid response error
 */
export class InvalidResponseError extends LLMProviderError {
  constructor(provider: string, message: string) {
    super(`Invalid response from ${provider}: ${message}`, provider);
    this.name = 'InvalidResponseError';
  }
}
