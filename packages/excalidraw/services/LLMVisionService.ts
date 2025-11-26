/**
 * LLMVisionService
 *
 * Orchestrates LLM provider adapters for image analysis.
 * Routes requests to the appropriate provider based on configuration.
 */

import { aiConfigService } from "./AIConfigurationService";

import { LLMProviderError } from "./llm/LLMProviderAdapter";
import { OpenAIAdapter } from "./llm/OpenAIAdapter";
import { GeminiAdapter } from "./llm/GeminiAdapter";
import { ClaudeAdapter } from "./llm/ClaudeAdapter";
import { OllamaAdapter } from "./llm/OllamaAdapter";

import type {
  AnalysisOptions,
  AnalysisResult,
  LLMProviderAdapter,
} from "./llm/LLMProviderAdapter";
import type { LLMProvider } from "./AIConfigurationService";

export interface RateLimitInfo {
  remaining: number;
  reset: Date;
  limit: number;
}

export class LLMVisionService {
  private adapters: Map<LLMProvider, LLMProviderAdapter>;

  constructor() {
    this.adapters = new Map<LLMProvider, LLMProviderAdapter>();
    this.adapters.set("openai", new OpenAIAdapter());
    this.adapters.set("gemini", new GeminiAdapter());
    this.adapters.set("claude", new ClaudeAdapter());
    this.adapters.set("ollama", new OllamaAdapter());
  }

  /**
   * Analyze image using the configured LLM provider
   */
  async analyzeImage(
    imageDataUrl: string,
    options?: AnalysisOptions,
  ): Promise<AnalysisResult> {
    const provider = await this.getActiveProvider();

    if (!provider) {
      throw new LLMProviderError(
        "No AI provider configured. Please configure a provider first.",
        "none",
      );
    }

    const credentials = await aiConfigService.getCredentials(provider);

    if (!credentials) {
      throw new LLMProviderError(
        `No credentials found for ${provider}`,
        provider,
      );
    }

    const adapter = this.adapters.get(provider);

    if (!adapter) {
      throw new LLMProviderError(`Unsupported provider: ${provider}`, provider);
    }

    try {
      return await adapter.analyzeImage(credentials, imageDataUrl, options);
    } catch (error) {
      console.error(`Failed to analyze image with ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Validate connection to a specific provider
   */
  async validateConnection(provider: LLMProvider): Promise<boolean> {
    const credentials = await aiConfigService.getCredentials(provider);

    if (!credentials) {
      return false;
    }

    const adapter = this.adapters.get(provider);

    if (!adapter) {
      return false;
    }

    try {
      const result = await adapter.testConnection(credentials);
      return result.success;
    } catch (error) {
      console.error(`Failed to validate connection for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Get rate limit status for a provider
   * Note: This is a placeholder - actual implementation depends on provider APIs
   */
  async getRateLimitStatus(provider: LLMProvider): Promise<RateLimitInfo> {
    // This would need to be implemented based on provider-specific rate limit headers
    // For now, return a placeholder
    return {
      remaining: 100,
      reset: new Date(Date.now() + 3600000), // 1 hour from now
      limit: 100,
    };
  }

  /**
   * Get the currently active provider
   */
  async getActiveProvider(): Promise<LLMProvider | null> {
    const status = await aiConfigService.getConfigurationStatus();
    return status.selectedProvider || null;
  }

  /**
   * Test connection and fetch models for a provider
   */
  async testAndFetchModels(provider: LLMProvider) {
    const credentials = await aiConfigService.getCredentials(provider);

    if (!credentials) {
      return {
        success: false,
        message: "No credentials found",
        error: "Please configure credentials first",
      };
    }

    const adapter = this.adapters.get(provider);

    if (!adapter) {
      return {
        success: false,
        message: "Unsupported provider",
        error: `Provider ${provider} is not supported`,
      };
    }

    try {
      const result = await adapter.testConnection(credentials);

      if (result.success && result.availableModels) {
        // Cache the models
        aiConfigService.cacheModels(provider, result.availableModels);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        message: "Connection test failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Retry image analysis with exponential backoff
   */
  async analyzeImageWithRetry(
    imageDataUrl: string,
    options?: AnalysisOptions,
  ): Promise<AnalysisResult> {
    const maxRetries = options?.retryAttempts || 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.analyzeImage(imageDataUrl, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");

        // Don't retry on authentication errors
        if (error instanceof LLMProviderError && error.statusCode === 401) {
          throw error;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("Failed to analyze image after retries");
  }
}

// Export singleton instance
export const llmVisionService = new LLMVisionService();
