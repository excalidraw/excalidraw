export interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'google' | 'anthropic' | 'xai';
  displayName: string;
}

export const MODELS: ModelConfig[] = [
  // OpenAI models
  {
    id: 'gpt-5',
    name: 'gpt-5',
    provider: 'openai',
    displayName: 'GPT-5',
  },
  
  // Google models
  {
    id: 'gemini-2.5-pro',
    name: 'gemini-2.5-pro',
    provider: 'google',
    displayName: 'Gemini 2.5 Pro',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'gemini-2.5-flash',
    provider: 'google',
    displayName: 'Gemini 2.5 Flash',
  },
  
  // Anthropic models
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'claude-sonnet-4-5-20250929',
    provider: 'anthropic',
    displayName: 'Claude sonnet 4.5',
  },
  {
    id: 'claude-opus-4-1-20250805',
    name: 'claude-opus-4-1-20250805',
    provider: 'anthropic',
    displayName: 'Claude Opus 4',
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4',
  },
  {
    id: 'claude-3-7-sonnet-latest',
    name: 'claude-3-7-sonnet-latest',
    provider: 'anthropic',
    displayName: 'Claude 3.7 Sonnet',
  },
  
  // xAI models
  {
    id: 'grok-4-0709',
    name: 'grok-4-0709',
    provider: 'xai',
    displayName: 'Grok 4',
  },
  {
    id: 'grok-3',
    name: 'grok-3',
    provider: 'xai',
    displayName: 'Grok 3',
  }
];

export const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: MODELS.filter(m => m.provider === 'openai')
  },
  google: {
    name: 'Google',
    models: MODELS.filter(m => m.provider === 'google')
  },
  anthropic: {
    name: 'Anthropic',
    models: MODELS.filter(m => m.provider === 'anthropic')
  },
  xai: {
    name: 'xAI',
    models: MODELS.filter(m => m.provider === 'xai')
  }
};

export const DEFAULT_MODEL = MODELS[0]; // GPT-4o as default 