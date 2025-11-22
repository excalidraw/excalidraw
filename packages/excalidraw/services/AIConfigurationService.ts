/**
 * AIConfigurationService
 * 
 * Manages LLM provider credentials and model selection.
 * Stores credentials securely in browser LocalStorage.
 * Supports OpenAI, GCP Gemini, AWS Claude, and Ollama providers.
 */

export type LLMProvider = 'openai' | 'gemini' | 'claude' | 'ollama';

export interface ProviderCredentials {
  provider: LLMProvider;
  credentials: {
    // OpenAI
    apiKey?: string;
    // GCP Gemini
    geminiApiKey?: string;
    // AWS Claude
    awsClientId?: string;
    awsClientSecret?: string;
    awsRegion?: string;
    // Ollama
    ollamaEndpoint?: string;
  };
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  availableModels?: ModelInfo[];
  error?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  capabilities: string[];
  contextWindow?: number;
}

export interface ConfigurationStatus {
  hasAnyProvider: boolean;
  configuredProviders: LLMProvider[];
  selectedProvider?: LLMProvider;
  selectedModel?: string;
  lastTested?: Date;
}

interface StoredCredentials {
  version: string;
  providers: {
    [key in LLMProvider]?: {
      encrypted: string;
      lastUpdated: string;
      lastTested?: string;
    };
  };
}

interface StoredModelCache {
  [key: string]: {
    models: ModelInfo[];
    cachedAt: string;
  };
}

const STORAGE_KEYS = {
  CREDENTIALS: 'excalidraw_ai_credentials',
  SELECTED_PROVIDER: 'excalidraw_ai_selected_provider',
  SELECTED_MODEL: 'excalidraw_ai_selected_model',
  MODEL_CACHE: 'excalidraw_ai_model_cache',
} as const;

const STORAGE_VERSION = '1.0.0';
const MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Simple encryption/decryption for credentials
 * Note: This is basic obfuscation. For production, consider using Web Crypto API
 */
class CredentialEncryption {
  private static readonly KEY = 'excalidraw-ai-key';

  static encrypt(data: string): string {
    // Base64 encode with simple XOR cipher
    const encoded = btoa(data);
    return btoa(
      encoded
        .split('')
        .map((char, i) =>
          String.fromCharCode(
            char.charCodeAt(0) ^ this.KEY.charCodeAt(i % this.KEY.length),
          ),
        )
        .join(''),
    );
  }

  static decrypt(encrypted: string): string {
    try {
      const decoded = atob(encrypted)
        .split('')
        .map((char, i) =>
          String.fromCharCode(
            char.charCodeAt(0) ^ this.KEY.charCodeAt(i % this.KEY.length),
          ),
        )
        .join('');
      return atob(decoded);
    } catch (error) {
      console.error('Failed to decrypt credentials:', error);
      return '';
    }
  }
}

export class AIConfigurationService {
  /**
   * Save provider credentials to LocalStorage
   */
  async saveCredentials(
    provider: LLMProvider,
    credentials: ProviderCredentials['credentials'],
  ): Promise<void> {
    try {
      // Validate credentials before saving
      this.validateCredentials(provider, credentials);

      // Get existing stored credentials
      const stored = this.getStoredCredentials();

      // Encrypt and store
      const encrypted = CredentialEncryption.encrypt(
        JSON.stringify(credentials),
      );

      stored.providers[provider] = {
        encrypted,
        lastUpdated: new Date().toISOString(),
      };

      localStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(stored));
    } catch (error) {
      console.error(`Failed to save credentials for ${provider}:`, error);
      throw new Error(`Failed to save credentials: ${error}`);
    }
  }

  /**
   * Get provider credentials from LocalStorage
   */
  async getCredentials(
    provider: LLMProvider,
  ): Promise<ProviderCredentials['credentials'] | null> {
    try {
      const stored = this.getStoredCredentials();
      const providerData = stored.providers[provider];

      if (!providerData) {
        return null;
      }

      const decrypted = CredentialEncryption.decrypt(providerData.encrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error(`Failed to get credentials for ${provider}:`, error);
      return null;
    }
  }

  /**
   * Delete provider credentials from LocalStorage
   */
  async deleteCredentials(provider: LLMProvider): Promise<void> {
    try {
      const stored = this.getStoredCredentials();
      delete stored.providers[provider];
      localStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(stored));

      // Also clear selected provider if it was this one
      const selectedProvider = localStorage.getItem(
        STORAGE_KEYS.SELECTED_PROVIDER,
      );
      if (selectedProvider === provider) {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_PROVIDER);
        localStorage.removeItem(STORAGE_KEYS.SELECTED_MODEL);
      }

      // Clear model cache for this provider
      this.clearModelCache(provider);
    } catch (error) {
      console.error(`Failed to delete credentials for ${provider}:`, error);
      throw new Error(`Failed to delete credentials: ${error}`);
    }
  }

  /**
   * List all configured providers
   */
  async listConfiguredProviders(): Promise<LLMProvider[]> {
    const stored = this.getStoredCredentials();
    return Object.keys(stored.providers) as LLMProvider[];
  }

  /**
   * Test connection to provider (implemented by adapters)
   * This is a placeholder - actual implementation will use LLM adapters
   */
  async testConnection(provider: LLMProvider): Promise<ConnectionTestResult> {
    const credentials = await this.getCredentials(provider);

    if (!credentials) {
      return {
        success: false,
        message: 'No credentials found',
        error: 'Please configure credentials first',
      };
    }

    // Update last tested timestamp
    const stored = this.getStoredCredentials();
    if (stored.providers[provider]) {
      stored.providers[provider]!.lastTested = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(stored));
    }

    // Actual connection test will be implemented by LLM adapters
    return {
      success: true,
      message: 'Connection test will be implemented by LLM adapters',
    };
  }

  /**
   * Fetch available models from provider (implemented by adapters)
   * This is a placeholder - actual implementation will use LLM adapters
   */
  async fetchAvailableModels(provider: LLMProvider): Promise<ModelInfo[]> {
    // Check cache first
    const cached = this.getModelCache(provider);
    if (cached) {
      return cached;
    }

    // Actual model fetching will be implemented by LLM adapters
    // For now, return empty array
    return [];
  }

  /**
   * Set selected model for a provider
   */
  async setSelectedModel(
    provider: LLMProvider,
    modelId: string,
  ): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.SELECTED_PROVIDER, provider);
    localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, modelId);
  }

  /**
   * Get selected model for a provider
   */
  async getSelectedModel(provider: LLMProvider): Promise<string | null> {
    const selectedProvider = localStorage.getItem(
      STORAGE_KEYS.SELECTED_PROVIDER,
    );
    if (selectedProvider !== provider) {
      return null;
    }
    return localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL);
  }

  /**
   * Check if any provider is configured
   */
  async isConfigured(): Promise<boolean> {
    const providers = await this.listConfiguredProviders();
    return providers.length > 0;
  }

  /**
   * Get overall configuration status
   */
  async getConfigurationStatus(): Promise<ConfigurationStatus> {
    const configuredProviders = await this.listConfiguredProviders();
    const selectedProvider = localStorage.getItem(
      STORAGE_KEYS.SELECTED_PROVIDER,
    ) as LLMProvider | null;
    const selectedModel = localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL);

    const stored = this.getStoredCredentials();
    let lastTested: Date | undefined;

    if (selectedProvider && stored.providers[selectedProvider]?.lastTested) {
      lastTested = new Date(stored.providers[selectedProvider]!.lastTested!);
    }

    return {
      hasAnyProvider: configuredProviders.length > 0,
      configuredProviders,
      selectedProvider: selectedProvider || undefined,
      selectedModel: selectedModel || undefined,
      lastTested,
    };
  }

  /**
   * Cache models for a provider
   */
  cacheModels(provider: LLMProvider, models: ModelInfo[]): void {
    try {
      const cache = this.getStoredModelCache();
      cache[provider] = {
        models,
        cachedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.MODEL_CACHE, JSON.stringify(cache));
    } catch (error) {
      console.error(`Failed to cache models for ${provider}:`, error);
    }
  }

  /**
   * Get cached models for a provider
   */
  private getModelCache(provider: LLMProvider): ModelInfo[] | null {
    try {
      const cache = this.getStoredModelCache();
      const providerCache = cache[provider];

      if (!providerCache) {
        return null;
      }

      // Check if cache is still valid
      const cachedAt = new Date(providerCache.cachedAt);
      const now = new Date();
      if (now.getTime() - cachedAt.getTime() > MODEL_CACHE_TTL_MS) {
        return null;
      }

      return providerCache.models;
    } catch (error) {
      console.error(`Failed to get model cache for ${provider}:`, error);
      return null;
    }
  }

  /**
   * Clear model cache for a provider
   */
  private clearModelCache(provider: LLMProvider): void {
    try {
      const cache = this.getStoredModelCache();
      delete cache[provider];
      localStorage.setItem(STORAGE_KEYS.MODEL_CACHE, JSON.stringify(cache));
    } catch (error) {
      console.error(`Failed to clear model cache for ${provider}:`, error);
    }
  }

  /**
   * Get stored credentials from LocalStorage
   */
  private getStoredCredentials(): StoredCredentials {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CREDENTIALS);
      if (!stored) {
        return {
          version: STORAGE_VERSION,
          providers: {},
        };
      }
      return JSON.parse(stored);
    } catch (error) {
      console.error('Failed to parse stored credentials:', error);
      return {
        version: STORAGE_VERSION,
        providers: {},
      };
    }
  }

  /**
   * Get stored model cache from LocalStorage
   */
  private getStoredModelCache(): StoredModelCache {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MODEL_CACHE);
      if (!stored) {
        return {};
      }
      return JSON.parse(stored);
    } catch (error) {
      console.error('Failed to parse model cache:', error);
      return {};
    }
  }

  /**
   * Validate credentials format
   */
  private validateCredentials(
    provider: LLMProvider,
    credentials: ProviderCredentials['credentials'],
  ): void {
    switch (provider) {
      case 'openai':
        if (!credentials.apiKey) {
          throw new Error('OpenAI API key is required');
        }
        break;
      case 'gemini':
        if (!credentials.geminiApiKey) {
          throw new Error('Gemini API key is required');
        }
        break;
      case 'claude':
        if (
          !credentials.awsClientId ||
          !credentials.awsClientSecret ||
          !credentials.awsRegion
        ) {
          throw new Error(
            'AWS Client ID, Secret, and Region are required for Claude',
          );
        }
        break;
      case 'ollama':
        if (!credentials.ollamaEndpoint) {
          throw new Error('Ollama endpoint is required');
        }
        // Validate URL format
        try {
          new URL(credentials.ollamaEndpoint);
        } catch {
          throw new Error('Invalid Ollama endpoint URL');
        }
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
}

// Export singleton instance
export const aiConfigService = new AIConfigurationService();
