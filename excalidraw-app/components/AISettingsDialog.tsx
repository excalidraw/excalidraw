import { useState, useEffect, useCallback } from "react";

type AIProvider = "openai" | "anthropic" | "ollama";

interface AISettings {
  provider: AIProvider;
  model: string;
  apiKey: string;
  ollamaUrl: string;
}

const STORAGE_KEYS = {
  PROVIDER: "excalidraw-ai-provider",
  MODEL: "excalidraw-ai-model",
  OPENAI_KEY: "excalidraw-oai-api-key",
  ANTHROPIC_KEY: "excalidraw-anthropic-api-key",
  OLLAMA_URL: "excalidraw-ollama-url",
} as const;

const MODELS: Record<AIProvider, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-3-5-sonnet-20241022",
    "claude-3-haiku-20240307",
  ],
  ollama: [],
};

const DEFAULT_OLLAMA_URL = "http://localhost:11434";

export const getAISettings = (): AISettings => {
  return {
    provider:
      (localStorage.getItem(STORAGE_KEYS.PROVIDER) as AIProvider) || "ollama",
    model: localStorage.getItem(STORAGE_KEYS.MODEL) || "",
    apiKey: "",
    ollamaUrl:
      localStorage.getItem(STORAGE_KEYS.OLLAMA_URL) || DEFAULT_OLLAMA_URL,
  };
};

export const getAPIKey = (provider: AIProvider): string => {
  if (provider === "openai") {
    return localStorage.getItem(STORAGE_KEYS.OPENAI_KEY) || "";
  }
  if (provider === "anthropic") {
    return localStorage.getItem(STORAGE_KEYS.ANTHROPIC_KEY) || "";
  }
  return "";
};

export const AISettingsDialog = ({ onClose }: { onClose: () => void }) => {
  const [provider, setProvider] = useState<AIProvider>("ollama");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState(DEFAULT_OLLAMA_URL);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedProvider = localStorage.getItem(
      STORAGE_KEYS.PROVIDER,
    ) as AIProvider;
    const savedModel = localStorage.getItem(STORAGE_KEYS.MODEL);
    const savedOllamaUrl = localStorage.getItem(STORAGE_KEYS.OLLAMA_URL);

    if (savedProvider) {
      setProvider(savedProvider);
    }
    if (savedModel) {
      setModel(savedModel);
    }
    if (savedOllamaUrl) {
      setOllamaUrl(savedOllamaUrl);
    }

    if (savedProvider === "openai") {
      setApiKey(localStorage.getItem(STORAGE_KEYS.OPENAI_KEY) || "");
    } else if (savedProvider === "anthropic") {
      setApiKey(localStorage.getItem(STORAGE_KEYS.ANTHROPIC_KEY) || "");
    }
  }, []);

  const fetchOllamaModels = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${ollamaUrl}/v1/models`);
      if (response.ok) {
        const data = await response.json();
        const models = data.data?.map((m: { id: string }) => m.id) || [];
        setOllamaModels(models);
        if (models.length > 0 && !model) {
          setModel(models[0]);
        }
      }
    } catch {
      setOllamaModels([]);
    }
    setLoading(false);
  }, [ollamaUrl, model]);

  useEffect(() => {
    if (provider === "ollama") {
      fetchOllamaModels();
    }
  }, [provider, ollamaUrl, fetchOllamaModels]);

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    setApiKey("");

    if (newProvider === "openai") {
      setApiKey(localStorage.getItem(STORAGE_KEYS.OPENAI_KEY) || "");
      setModel(MODELS.openai[0]);
    } else if (newProvider === "anthropic") {
      setApiKey(localStorage.getItem(STORAGE_KEYS.ANTHROPIC_KEY) || "");
      setModel(MODELS.anthropic[0]);
    } else {
      setModel("");
    }
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEYS.PROVIDER, provider);
    localStorage.setItem(STORAGE_KEYS.MODEL, model);

    if (provider === "openai" && apiKey) {
      localStorage.setItem(STORAGE_KEYS.OPENAI_KEY, apiKey);
    } else if (provider === "anthropic" && apiKey) {
      localStorage.setItem(STORAGE_KEYS.ANTHROPIC_KEY, apiKey);
    }

    if (provider === "ollama") {
      localStorage.setItem(STORAGE_KEYS.OLLAMA_URL, ollamaUrl);
    }

    onClose();
  };

  const currentModels = provider === "ollama" ? ollamaModels : MODELS[provider];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          background: "var(--island-bg-color, #fff)",
          borderRadius: "8px",
          padding: "24px",
          minWidth: "360px",
          maxWidth: "90vw",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "18px" }}>AI Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              padding: "4px",
              color: "inherit",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div>
            <label
              style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}
            >
              Provider
            </label>
            <select
              value={provider}
              onChange={(e) =>
                handleProviderChange(e.target.value as AIProvider)
              }
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid var(--button-gray-2, #ddd)",
                background: "var(--island-bg-color, #fff)",
                color: "inherit",
                boxSizing: "border-box",
              }}
            >
              <option value="ollama">Ollama (Local)</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
            </select>
          </div>

          {provider !== "ollama" && (
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontWeight: 500,
                }}
              >
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === "openai" ? "sk-..." : "sk-ant-..."}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid var(--button-gray-2, #ddd)",
                  background: "var(--island-bg-color, #fff)",
                  color: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {provider === "ollama" && (
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontWeight: 500,
                }}
              >
                Ollama URL
              </label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid var(--button-gray-2, #ddd)",
                  background: "var(--island-bg-color, #fff)",
                  color: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          <div>
            <label
              style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}
            >
              Model {loading && "(loading...)"}
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid var(--button-gray-2, #ddd)",
                background: "var(--island-bg-color, #fff)",
                color: "inherit",
                boxSizing: "border-box",
              }}
            >
              {currentModels.length === 0 && (
                <option value="">No models available</option>
              )}
              {currentModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "flex-end",
              marginTop: "8px",
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "4px",
                border: "1px solid var(--button-gray-2, #ddd)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: "8px 16px",
                borderRadius: "4px",
                border: "none",
                background: "var(--color-primary, #6965db)",
                color: "white",
                cursor: "pointer",
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export { STORAGE_KEYS, type AIProvider };
