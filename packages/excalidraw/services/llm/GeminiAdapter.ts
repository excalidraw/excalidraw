/**
 * GeminiAdapter
 * 
 * Adapter for Google Gemini Vision API
 */

import type { ProviderCredentials, ConnectionTestResult, ModelInfo } from '../AIConfigurationService';
import type { AnalysisOptions, AnalysisResult, LLMProviderAdapter } from './LLMProviderAdapter';
import {
  DEFAULT_MERMAID_PROMPT,
  LLMProviderError,
  RateLimitError,
  AuthenticationError,
  InvalidResponseError,
} from './LLMProviderAdapter';

const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta';

const GEMINI_MODELS: ModelInfo[] = [
  {
    id: 'gemini-pro-vision',
    name: 'Gemini Pro Vision',
    description: 'Multimodal model for vision tasks',
    capabilities: ['vision', 'code'],
    contextWindow: 30720,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'Advanced multimodal model with large context',
    capabilities: ['vision', 'code', 'large-context'],
    contextWindow: 1000000,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Fast and efficient multimodal model',
    capabilities: ['vision', 'code', 'fast'],
    contextWindow: 1000000,
  },
];

export class GeminiAdapter implements LLMProviderAdapter {
  async testConnection(
    credentials: ProviderCredentials['credentials'],
  ): Promise<ConnectionTestResult> {
    try {
      // Test with a simple model list request
      const response = await fetch(
        `${GEMINI_API_ENDPOINT}/models?key=${credentials.geminiApiKey}`,
        {
          method: 'GET',
        },
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            message: 'Invalid API key',
            error: 'Authentication failed. Please check your API key.',
          };
        }
        return {
          success: false,
          message: 'Connection failed',
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const models = await this.fetchModels(credentials);

      return {
        success: true,
        message: 'Connected successfully',
        availableModels: models,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async fetchModels(
    credentials: ProviderCredentials['credentials'],
  ): Promise<ModelInfo[]> {
    // Return predefined Gemini models
    return GEMINI_MODELS;
  }

  async analyzeImage(
    credentials: ProviderCredentials['credentials'],
    imageDataUrl: string,
    options?: AnalysisOptions,
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      const prompt = options?.prompt || DEFAULT_MERMAID_PROMPT;
      const temperature = options?.temperature ?? 0.1;

      // Extract base64 data from data URL
      const base64Data = imageDataUrl.split(',')[1];
      const mimeType = imageDataUrl.split(';')[0].split(':')[1];

      const response = await fetch(
        `${GEMINI_API_ENDPOINT}/models/gemini-1.5-flash:generateContent?key=${credentials.geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature,
              maxOutputTokens: options?.maxTokens || 2000,
            },
          }),
        },
      );

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json();

      if (
        !data.candidates ||
        !data.candidates[0] ||
        !data.candidates[0].content
      ) {
        throw new InvalidResponseError(
          'gemini',
          'No response content in API response',
        );
      }

      const mermaidCode = data.candidates[0].content.parts[0].text.trim();
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
        'Failed to analyze image',
        'gemini',
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const status = response.status;

    if (status === 401 || status === 403) {
      throw new AuthenticationError('gemini');
    }

    if (status === 429) {
      throw new RateLimitError('gemini');
    }

    let errorMessage = `HTTP ${status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      }
    } catch {
      // Ignore JSON parse errors
    }

    throw new LLMProviderError(errorMessage, 'gemini', status);
  }
}
