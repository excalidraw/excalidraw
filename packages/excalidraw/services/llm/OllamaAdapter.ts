/**
 * OllamaAdapter
 *
 * Adapter for Ollama local models
 * Supports vision models like llava, bakllava, llava-phi3
 */

import {
  DEFAULT_MERMAID_PROMPT,
  LLMProviderError,
  InvalidResponseError,
} from "./LLMProviderAdapter";

import type {
  ProviderCredentials,
  ConnectionTestResult,
  ModelInfo,
} from "../AIConfigurationService";
import type {
  AnalysisOptions,
  AnalysisResult,
  LLMProviderAdapter,
} from "./LLMProviderAdapter";

export class OllamaAdapter implements LLMProviderAdapter {
  async testConnection(
    credentials: ProviderCredentials["credentials"],
  ): Promise<ConnectionTestResult> {
    try {
      if (!credentials.ollamaEndpoint) {
        return {
          success: false,
          message: "Missing endpoint",
          error: "Ollama endpoint is required",
        };
      }

      // Validate URL format
      let endpoint: URL;
      try {
        endpoint = new URL(credentials.ollamaEndpoint);
      } catch {
        return {
          success: false,
          message: "Invalid endpoint",
          error: "Please provide a valid URL (e.g., http://localhost:11434)",
        };
      }

      // Test connection by fetching available models
      const response = await fetch(`${endpoint.origin}/api/tags`, {
        method: "GET",
      });

      if (!response.ok) {
        return {
          success: false,
          message: "Connection failed",
          error: `HTTP ${response.status}: ${response.statusText}. Make sure Ollama is running.`,
        };
      }

      const models = await this.fetchModels(credentials);

      if (models.length === 0) {
        return {
          success: true,
          message: "Connected but no vision models found",
          availableModels: [],
          error:
            "No vision models installed. Please install a vision model like llava: ollama pull llava",
        };
      }

      return {
        success: true,
        message: `Connected successfully. Found ${models.length} vision model(s)`,
        availableModels: models,
      };
    } catch (error) {
      return {
        success: false,
        message: "Connection failed",
        error:
          error instanceof Error
            ? error.message
            : "Cannot connect to Ollama. Make sure it is running.",
      };
    }
  }

  async fetchModels(
    credentials: ProviderCredentials["credentials"],
  ): Promise<ModelInfo[]> {
    try {
      if (!credentials.ollamaEndpoint) {
        return [];
      }

      const endpoint = new URL(credentials.ollamaEndpoint);
      const response = await fetch(`${endpoint.origin}/api/tags`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.models || !Array.isArray(data.models)) {
        return [];
      }

      // Filter for vision models (models that support images)
      // Common vision models: llava, bakllava, llava-phi3, llava-llama3
      const visionModels = data.models
        .filter((model: any) => {
          const name = model.name.toLowerCase();
          return (
            name.includes("llava") ||
            name.includes("bakllava") ||
            name.includes("vision")
          );
        })
        .map((model: any) => ({
          id: model.name,
          name: model.name,
          description: `Local Ollama model (${this.formatSize(model.size)})`,
          capabilities: ["vision", "local", "offline"],
          contextWindow: this.estimateContextWindow(model.name),
        }));

      return visionModels;
    } catch (error) {
      console.error("Failed to fetch Ollama models:", error);
      return [];
    }
  }

  async analyzeImage(
    credentials: ProviderCredentials["credentials"],
    imageDataUrl: string,
    options?: AnalysisOptions,
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      if (!credentials.ollamaEndpoint) {
        throw new LLMProviderError("Ollama endpoint not configured", "ollama");
      }

      const prompt = options?.prompt || DEFAULT_MERMAID_PROMPT;

      // Extract base64 data from data URL
      const base64Data = imageDataUrl.split(",")[1];

      const endpoint = new URL(credentials.ollamaEndpoint);

      // Use llava as default model if not specified
      // In production, this should come from user's selected model
      const model = "llava";

      const response = await fetch(`${endpoint.origin}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          images: [base64Data],
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.1,
            num_predict: options?.maxTokens || 2000,
          },
        }),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json();

      if (!data.response) {
        throw new InvalidResponseError(
          "ollama",
          "No response content in API response",
        );
      }

      const mermaidCode = data.response.trim();
      const processingTime = Date.now() - startTime;

      return {
        mermaidCode,
        processingTime,
      };
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }
      throw new LLMProviderError(
        "Failed to analyze image",
        "ollama",
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const status = response.status;

    let errorMessage = `HTTP ${status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Ignore JSON parse errors
    }

    throw new LLMProviderError(errorMessage, "ollama", status);
  }

  private formatSize(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(1)}GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)}MB`;
  }

  private estimateContextWindow(modelName: string): number {
    // Estimate context window based on model name
    // This is approximate - actual values depend on model configuration
    if (modelName.includes("34b") || modelName.includes("70b")) {
      return 8192;
    }
    if (modelName.includes("13b")) {
      return 4096;
    }
    return 2048; // Default for 7b and smaller models
  }
}
