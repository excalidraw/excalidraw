/**
 * AIConfigurationDialog
 * 
 * Dialog for configuring LLM provider credentials and selecting models.
 * Supports OpenAI, GCP Gemini, AWS Claude (Bedrock), and Ollama.
 */

import React, { useState, useEffect } from "react";
import { Dialog } from "./Dialog";
import { useAtom } from "../../../excalidraw-app/app-jotai";
import { aiConfigDialogOpenAtom, aiConfiguredProvidersAtom, aiSelectedProviderAtom, aiSelectedModelAtom, aiAvailableModelsAtom } from "../../../excalidraw-app/app-jotai";
import { aiConfigService } from "../services/AIConfigurationService";
import type { LLMProvider, ModelInfo, ProviderCredentials } from "../services/AIConfigurationService";
import { llmVisionService } from "../services/LLMVisionService";
import "./AIConfigurationDialog.scss";

interface ProviderFormData {
  // OpenAI
  apiKey?: string;
  // Gemini
  geminiApiKey?: string;
  // Claude (AWS Bedrock)
  awsClientId?: string;
  awsClientSecret?: string;
  awsRegion?: string;
  // Ollama
  ollamaEndpoint?: string;
}

interface TestResult {
  status: 'idle' | 'testing' | 'success' | 'error';
  message?: string;
  models?: ModelInfo[];
}

export const AIConfigurationDialog: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(aiConfigDialogOpenAtom);
  const [, setConfiguredProviders] = useAtom(aiConfiguredProvidersAtom);
  const [, setSelectedProvider] = useAtom(aiSelectedProviderAtom);
  const [, setSelectedModel] = useAtom(aiSelectedModelAtom);
  const [, setAvailableModels] = useAtom(aiAvailableModelsAtom);

  const [activeTab, setActiveTab] = useState<LLMProvider>('openai');
  const [formData, setFormData] = useState<Record<LLMProvider, ProviderFormData>>({
    openai: {},
    gemini: {},
    claude: { awsRegion: 'us-east-1' },
    ollama: { ollamaEndpoint: 'http://localhost:11434' },
  });
  const [testResults, setTestResults] = useState<Record<LLMProvider, TestResult>>({
    openai: { status: 'idle' },
    gemini: { status: 'idle' },
    claude: { status: 'idle' },
    ollama: { status: 'idle' },
  });
  const [selectedModels, setSelectedModels] = useState<Record<LLMProvider, string>>({
    openai: '',
    gemini: '',
    claude: '',
    ollama: '',
  });

  // Load existing credentials on mount
  useEffect(() => {
    loadExistingCredentials();
  }, []);

  const loadExistingCredentials = async () => {
    const providers = await aiConfigService.listConfiguredProviders();
    setConfiguredProviders(providers);

    // Load credentials for each provider
    for (const provider of providers) {
      const credentials = await aiConfigService.getCredentials(provider);
      if (credentials) {
        setFormData(prev => ({
          ...prev,
          [provider]: credentials,
        }));

        // Load selected model
        const selectedModel = await aiConfigService.getSelectedModel(provider);
        if (selectedModel) {
          setSelectedModels(prev => ({
            ...prev,
            [provider]: selectedModel,
          }));
        }

        // Try to load cached models
        const result = await llmVisionService.testAndFetchModels(provider);
        if (result.success && result.availableModels) {
          setTestResults(prev => ({
            ...prev,
            [provider]: {
              status: 'success',
              message: result.message,
              models: result.availableModels,
            },
          }));
        }
      }
    }
  };

  const handleInputChange = (provider: LLMProvider, field: keyof ProviderFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value,
      },
    }));
  };

  const handleTestConnection = async (provider: LLMProvider) => {
    setTestResults(prev => ({
      ...prev,
      [provider]: { status: 'testing', message: 'Testing connection...' },
    }));

    try {
      // Save credentials first
      await aiConfigService.saveCredentials(provider, formData[provider]);

      // Test connection
      const result = await llmVisionService.testAndFetchModels(provider);

      if (result.success) {
        setTestResults(prev => ({
          ...prev,
          [provider]: {
            status: 'success',
            message: result.message,
            models: result.availableModels || [],
          },
        }));

        // Auto-select first model if available
        if (result.availableModels && result.availableModels.length > 0) {
          setSelectedModels(prev => ({
            ...prev,
            [provider]: result.availableModels![0].id,
          }));
        }
      } else {
        setTestResults(prev => ({
          ...prev,
          [provider]: {
            status: 'error',
            message: result.error || 'Connection failed',
          },
        }));
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [provider]: {
          status: 'error',
          message: error instanceof Error ? error.message : 'Connection failed',
        },
      }));
    }
  };

  const handleSave = async () => {
    try {
      // Save selected model for active provider
      const provider = activeTab;
      const modelId = selectedModels[provider];

      if (modelId) {
        await aiConfigService.setSelectedModel(provider, modelId);
        setSelectedProvider(provider);
        
        const models = testResults[provider].models || [];
        const selectedModelInfo = models.find(m => m.id === modelId) || null;
        setSelectedModel(selectedModelInfo);
        setAvailableModels(models);
      }

      // Update configured providers
      const providers = await aiConfigService.listConfiguredProviders();
      setConfiguredProviders(providers);

      setIsOpen(false);
    } catch (error) {
      console.error('Failed to save configuration:', error);
      alert('Failed to save configuration: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDelete = async (provider: LLMProvider) => {
    if (confirm(`Delete credentials for ${provider}?`)) {
      try {
        await aiConfigService.deleteCredentials(provider);
        setFormData(prev => ({
          ...prev,
          [provider]: {},
        }));
        setTestResults(prev => ({
          ...prev,
          [provider]: { status: 'idle' },
        }));
        setSelectedModels(prev => ({
          ...prev,
          [provider]: '',
        }));

        const providers = await aiConfigService.listConfiguredProviders();
        setConfiguredProviders(providers);
      } catch (error) {
        console.error('Failed to delete credentials:', error);
      }
    }
  };

  const renderProviderForm = (provider: LLMProvider) => {
    const data = formData[provider];
    const testResult = testResults[provider];
    const selectedModel = selectedModels[provider];

    return (
      <div className="ai-config-form">
        {provider === 'openai' && (
          <>
            <div className="form-group">
              <label>OpenAI API Key</label>
              <input
                type="password"
                value={data.apiKey || ''}
                onChange={(e) => handleInputChange(provider, 'apiKey', e.target.value)}
                placeholder="sk-..."
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-gray-30)', borderRadius: '4px' }}
              />
              <small>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI Platform</a></small>
            </div>
          </>
        )}

        {provider === 'gemini' && (
          <>
            <div className="form-group">
              <label>Gemini API Key</label>
              <input
                type="password"
                value={data.geminiApiKey || ''}
                onChange={(e) => handleInputChange(provider, 'geminiApiKey', e.target.value)}
                placeholder="AIza..."
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-gray-30)', borderRadius: '4px' }}
              />
              <small>Get your API key from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a></small>
            </div>
          </>
        )}

        {provider === 'claude' && (
          <>
            <div className="form-group">
              <label>AWS Client ID (Access Key)</label>
              <input
                type="text"
                value={data.awsClientId || ''}
                onChange={(e) => handleInputChange(provider, 'awsClientId', e.target.value)}
                placeholder="AKIA..."
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-gray-30)', borderRadius: '4px' }}
              />
            </div>
            <div className="form-group">
              <label>AWS Client Secret (Secret Key)</label>
              <input
                type="password"
                value={data.awsClientSecret || ''}
                onChange={(e) => handleInputChange(provider, 'awsClientSecret', e.target.value)}
                placeholder="..."
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-gray-30)', borderRadius: '4px' }}
              />
            </div>
            <div className="form-group">
              <label>AWS Region</label>
              <select
                value={data.awsRegion || 'us-east-1'}
                onChange={(e) => handleInputChange(provider, 'awsRegion', e.target.value)}
                className="form-select"
              >
                <option value="us-east-1">US East (N. Virginia)</option>
                <option value="us-west-2">US West (Oregon)</option>
                <option value="eu-west-1">EU (Ireland)</option>
                <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
              </select>
            </div>
            <small>Claude is accessed through AWS Bedrock. Get credentials from <a href="https://console.aws.amazon.com/iam/" target="_blank" rel="noopener noreferrer">AWS IAM</a></small>
          </>
        )}

        {provider === 'ollama' && (
          <>
            <div className="form-group">
              <label>Ollama Endpoint</label>
              <input
                type="text"
                value={data.ollamaEndpoint || ''}
                onChange={(e) => handleInputChange(provider, 'ollamaEndpoint', e.target.value)}
                placeholder="http://localhost:11434"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-gray-30)', borderRadius: '4px' }}
              />
              <small>Make sure Ollama is running locally with a vision model installed (e.g., llava)</small>
            </div>
          </>
        )}

        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={() => handleTestConnection(provider)}
            disabled={testResult.status === 'testing'}
          >
            {testResult.status === 'testing' ? 'Testing...' : 'Test Connection'}
          </button>

          {testResult.status !== 'idle' && (
            <button
              className="btn btn-danger"
              onClick={() => handleDelete(provider)}
            >
              Delete
            </button>
          )}
        </div>

        {testResult.status === 'success' && (
          <div className="test-result success">
            <span className="icon">✓</span>
            <span>{testResult.message}</span>
          </div>
        )}

        {testResult.status === 'error' && (
          <div className="test-result error">
            <span className="icon">✗</span>
            <span>{testResult.message}</span>
          </div>
        )}

        {testResult.models && testResult.models.length > 0 && (
          <div className="model-selection">
            <label>Select Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModels(prev => ({ ...prev, [provider]: e.target.value }))}
              className="form-select"
            >
              <option value="">-- Select a model --</option>
              {testResult.models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name} {model.description && `- ${model.description}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <Dialog
      onCloseRequest={() => setIsOpen(false)}
      title="Configure AI Provider"
      className="ai-configuration-dialog"
    >
      <div className="ai-config-tabs">
        <button
          className={`tab ${activeTab === 'openai' ? 'active' : ''}`}
          onClick={() => setActiveTab('openai')}
        >
          OpenAI
        </button>
        <button
          className={`tab ${activeTab === 'gemini' ? 'active' : ''}`}
          onClick={() => setActiveTab('gemini')}
        >
          Gemini
        </button>
        <button
          className={`tab ${activeTab === 'claude' ? 'active' : ''}`}
          onClick={() => setActiveTab('claude')}
        >
          Claude (AWS)
        </button>
        <button
          className={`tab ${activeTab === 'ollama' ? 'active' : ''}`}
          onClick={() => setActiveTab('ollama')}
        >
          Ollama
        </button>
      </div>

      <div className="ai-config-content">
        {renderProviderForm(activeTab)}
      </div>

      <div className="dialog-actions">
        <button className="btn btn-secondary" onClick={() => setIsOpen(false)}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!selectedModels[activeTab]}
        >
          Save & Use This Model
        </button>
      </div>
    </Dialog>
  );
};
