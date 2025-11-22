/**
 * OpenAIAdapter
 * 
 * Adapter for OpenAI GPT-4 Vision API
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

const OPENAI_API_ENDPOINT = 'https://api.openai.com/v1';

const OPENAI_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4-vision-preview',
    name: 'GPT-4 Vision',
    description: 'Most capable vision model',
    capabilities: ['vision', 'code', 'reasoning'],
    contextWindow: 128000,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4 Omni',
    description: 'Fast and capable multimodal model',
    capabilities: ['vision', 'code', 'fast'],
    contextWindow: 128000,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4 Omni Mini',
    description: 'Affordable and fast vision model',
    capabilities: ['vision', 'code', 'fast', 'affordable'],
    contextWindow: 128000,
  },
];

export class OpenAIAdapter implements LLMProviderAdapter {
  async testConnection(
    credentials: ProviderCredentials['credentials'],
  ): Promise<ConnectionTestResult> {
    try {
      const response = await fetch(`${OPENAI_API_ENDPOINT}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
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
    // OpenAI models are predefined
    // We could fetch from API, but the vision models are known
    return OPENAI_MODELS;
  }

  async analyzeImage(
    credentials: ProviderCredentials['credentials'],
    imageDataUrl: string,
    options?: AnalysisOptions,
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      const prompt = options?.prompt || DEFAULT_MERMAID_PROMPT;
      const maxTokens = options?.maxTokens || 2000;
      const temperature = options?.temperature ?? 0.1;

      const response = await fetch(`${OPENAI_API_ENDPOINT}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o', // Default to gpt-4o for vision
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageDataUrl,
                  },
                },
              ],
            },
          ],
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new InvalidResponseError(
          'openai',
          'No response content in API response',
        );
      }

      const mermaidCode = data.choices[0].message.content.trim();
      const processingTime = Date.now() - startTime;

      return {
        mermaidCode,
        tokensUsed: data.usage?.total_tokens,
        processingTime,
      };
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }
      throw new LLMProviderError(
        'Failed to analyze image',
        'openai',
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const status = response.status;

    if (status === 401) {
      throw new AuthenticationError('openai');
    }

    if (status === 429) {
      const retryAfter = response.headers.get('retry-after');
      throw new RateLimitError(
        'openai',
        retryAfter ? parseInt(retryAfter, 10) : undefined,
      );
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

    throw new LLMProviderError(errorMessage, 'openai', status);
  }
}
