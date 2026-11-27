import type { AIAgentProvider, AIAgentSettings } from "./types";

export const STORAGE_KEY_AI_SETTINGS = "excalidraw_byok_ai_settings";

export const DEFAULT_AI_SETTINGS: AIAgentSettings = {
  apiKey: "litellm-proxy",
  baseURL: "/api/llm",
  model: "gpt-6-luna",
  showCursor: true,
  provider: "custom",
};

export interface ProviderPreset {
  name: string;
  provider: AIAgentProvider;
  baseURL: string;
  defaultModel: string;
  popularModels: string[];
  placeholderKey: string;
  keyHelpUrl?: string;
  notes?: string;
}

export const PROVIDER_PRESETS: Record<AIAgentProvider, ProviderPreset> = {
  openai: {
    name: "OpenAI",
    provider: "openai",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    popularModels: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
    placeholderKey: "sk-...",
    keyHelpUrl: "https://platform.openai.com/api-keys",
  },
  openrouter: {
    name: "OpenRouter",
    provider: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-3.5-sonnet",
    popularModels: [
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o",
      "deepseek/deepseek-chat",
      "meta-llama/llama-3.3-70b-instruct",
    ],
    placeholderKey: "sk-or-v1-...",
    keyHelpUrl: "https://openrouter.ai/keys",
  },
  groq: {
    name: "Groq",
    provider: "groq",
    baseURL: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    popularModels: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768",
    ],
    placeholderKey: "gsk_...",
    keyHelpUrl: "https://console.groq.com/keys",
  },
  ollama: {
    name: "Ollama (Local)",
    provider: "ollama",
    baseURL: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
    popularModels: ["llama3.2", "mistral", "deepseek-r1:8b", "qwen2.5:7b"],
    placeholderKey: "ollama (not required)",
    notes: "Requires OLLAMA_ORIGINS='*' for browser CORS access",
  },
  custom: {
    name: "LiteLLM (Home Server)",
    provider: "custom",
    baseURL: "/api/llm",
    defaultModel: "gpt-6-luna",
    popularModels: ["gpt-6-luna", "claude-sonnet-5.5", "mimo-v2.6-flash", "deepseek-chat", "kimi-k3"],
    placeholderKey: "litellm-proxy (auto-authenticated)",
    notes: "Pre-configured for Home Server LiteLLM via /api/llm proxy",
  },
};

export const getAppWindow = (node?: Element | null): Window => {
  if (node?.ownerDocument?.defaultView) {
    return node.ownerDocument.defaultView;
  }
  return typeof window !== "undefined" ? window : ({} as Window);
};

export const loadAISettings = (
  ownerWindow?: Window | null,
): AIAgentSettings => {
  const win = ownerWindow || (typeof window !== "undefined" ? window : null);
  if (!win?.localStorage) {
    return { ...DEFAULT_AI_SETTINGS };
  }

  try {
    const raw = win.localStorage.getItem(STORAGE_KEY_AI_SETTINGS);
    if (!raw) {
      return { ...DEFAULT_AI_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_AI_SETTINGS,
      ...parsed,
    };
  } catch (error) {
    console.warn("Failed to load AI agent settings from localStorage", error);
    return { ...DEFAULT_AI_SETTINGS };
  }
};

export const saveAISettings = (
  settings: AIAgentSettings,
  ownerWindow?: Window | null,
): void => {
  const win = ownerWindow || (typeof window !== "undefined" ? window : null);
  if (!win?.localStorage) {
    return;
  }

  try {
    win.localStorage.setItem(STORAGE_KEY_AI_SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save AI agent settings to localStorage", error);
  }
};

export const testLLMConnection = async (
  settings: AIAgentSettings,
  ownerWindow?: Window | null,
): Promise<{ success: boolean; message: string }> => {
  const cleanBaseURL = settings.baseURL.replace(/\/+$/, "");
  const url = `${cleanBaseURL}/chat/completions`;
  const fetchFn = ownerWindow?.fetch?.bind(ownerWindow) ?? fetch;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (settings.apiKey && settings.apiKey.trim()) {
    headers.Authorization = `Bearer ${settings.apiKey.trim()}`;
  }

  try {
    const response = await fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: settings.model.trim(),
        messages: [
          { role: "user", content: "Respond with the single word: OK" },
        ],
        max_tokens: 64,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      let errText = "";
      try {
        const errorJson = await response.json();
        errText =
          errorJson.error?.message || errorJson.message || response.statusText;
      } catch {
        errText = await response.text();
      }
      return {
        success: false,
        message: `HTTP ${response.status}: ${errText || response.statusText}`,
      };
    }

    const data = await response.json();
    const reply =
      data.choices?.[0]?.message?.content?.trim() || "Connected successfully!";
    return {
      success: true,
      message: `Success! Model replied: "${reply}"`,
    };
  } catch (err: any) {
    if (err.name === "TypeError" && err.message?.includes("fetch")) {
      return {
        success: false,
        message:
          "Network or CORS error. If using a local endpoint like Ollama, ensure OLLAMA_ORIGINS='*' is set.",
      };
    }
    return {
      success: false,
      message: err.message || "Failed to connect to API endpoint.",
    };
  }
};
