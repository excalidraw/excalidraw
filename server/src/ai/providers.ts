import { readSse } from "./sse";

export type ProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "local";
export const PROVIDER_IDS: readonly ProviderId[] = [
  "openai",
  "anthropic",
  "gemini",
  "openrouter",
  "local",
];

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamRequest {
  model: string;
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
}

export type StreamEvent =
  | { type: "content"; delta: string }
  | { type: "done"; finishReason: "stop" | "length" | "content_filter" | null };

export class ProviderError extends Error {
  constructor(
    /** HTTP status to report to our client */
    public status: number,
    message: string,
    public retryable = false,
  ) {
    super(message);
  }
}

export interface AIProvider {
  readonly id: ProviderId;
  stream(req: StreamRequest): AsyncGenerator<StreamEvent>;
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  defaultModel: string;
  defaultBaseUrl: string | null;
  needsKey: boolean;
  /** whether an admin may override the endpoint */
  customBaseUrl: boolean;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
    needsKey: true,
    customBaseUrl: false,
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-sonnet-4-5",
    defaultBaseUrl: "https://api.anthropic.com",
    needsKey: true,
    customBaseUrl: false,
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.0-flash",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    needsKey: true,
    customBaseUrl: false,
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "openai/gpt-4o-mini",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    needsKey: true,
    customBaseUrl: true,
  },
  local: {
    id: "local",
    label: "Local / OpenAI-compatible",
    defaultModel: "llama3.1",
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
    needsKey: false,
    customBaseUrl: true,
  },
};

export interface ProviderConfig {
  provider: ProviderId;
  apiKey: string | null;
  baseUrl: string | null;
  fetchImpl?: typeof fetch;
}

const timeoutSignal = (outer: AbortSignal | undefined, ms: number) => {
  const t = AbortSignal.timeout(ms);
  return outer ? AbortSignal.any([outer, t]) : t;
};

/** Upstream error bodies can echo prompts or keys: report only a short, sanitised summary. */
const failFromResponse = async (res: Response, who: string): Promise<never> => {
  let detail = "";
  try {
    const j: any = await res.json();
    detail = String(j?.error?.message ?? j?.message ?? j?.error ?? "").slice(
      0,
      200,
    );
  } catch {
    /* non-JSON body */
  }
  detail = detail.replace(
    /(sk-|key[-_=:\s"']*)[A-Za-z0-9_-]{8,}/gi,
    "$1[redacted]",
  );
  if (res.status === 401 || res.status === 403) {
    throw new ProviderError(502, `${who} rejected the configured credentials`);
  }
  if (res.status === 429) {
    throw new ProviderError(429, `${who} is rate limiting requests`, true);
  }
  if (res.status === 404) {
    throw new ProviderError(
      502,
      `${who}: model or endpoint not found${detail ? ` (${detail})` : ""}`,
    );
  }
  throw new ProviderError(
    502,
    `${who} returned an error (${res.status})${detail ? `: ${detail}` : ""}`,
    res.status >= 500,
  );
};

const finish = (
  r: string | null | undefined,
): "stop" | "length" | "content_filter" | null => {
  if (!r) {
    return null;
  }
  if (["length", "max_tokens", "MAX_TOKENS"].includes(r)) {
    return "length";
  }
  if (["content_filter", "SAFETY", "refusal", "RECITATION"].includes(r)) {
    return "content_filter";
  }
  return "stop";
};

// ------------------------------------------------------------------------ OpenAI-compatible

class OpenAICompatible implements AIProvider {
  constructor(
    readonly id: ProviderId,
    private who: string,
    private base: string,
    private key: string | null,
    private f: typeof fetch,
    private extraHeaders: Record<string, string> = {},
  ) {}

  async *stream(req: StreamRequest): AsyncGenerator<StreamEvent> {
    let res: Response;
    try {
      res = await this.f(`${this.base.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          ...(this.key ? { authorization: `Bearer ${this.key}` } : {}),
          ...this.extraHeaders,
        },
        body: JSON.stringify({
          model: req.model,
          stream: true,
          max_tokens: req.maxTokens,
          temperature: req.temperature,
          messages: [{ role: "system", content: req.system }, ...req.messages],
        }),
        signal: timeoutSignal(req.signal, 120_000),
      });
    } catch (e: any) {
      if (req.signal?.aborted) {
        throw e;
      }
      throw new ProviderError(502, `Could not reach ${this.who}`, true);
    }
    if (!res.ok) {
      await failFromResponse(res, this.who);
    }
    if (!res.body) {
      throw new ProviderError(502, `${this.who} sent an empty response`);
    }
    let reason: string | null = null;
    for await (const ev of readSse(res.body)) {
      if (ev.data === "[DONE]") {
        break;
      }
      let j: any;
      try {
        j = JSON.parse(ev.data);
      } catch {
        continue;
      }
      if (j.error) {
        throw new ProviderError(
          502,
          `${this.who}: ${String(j.error.message ?? "stream error").slice(
            0,
            200,
          )}`,
        );
      }
      const choice = j.choices?.[0];
      const delta = choice?.delta?.content;
      if (typeof delta === "string" && delta) {
        yield { type: "content", delta };
      }
      if (choice?.finish_reason) {
        reason = choice.finish_reason;
      }
    }
    yield { type: "done", finishReason: finish(reason) ?? "stop" };
  }
}

// ------------------------------------------------------------------------ Anthropic

class AnthropicProvider implements AIProvider {
  readonly id = "anthropic" as const;
  constructor(
    private base: string,
    private key: string,
    private f: typeof fetch,
  ) {}

  async *stream(req: StreamRequest): AsyncGenerator<StreamEvent> {
    let res: Response;
    try {
      res = await this.f(`${this.base.replace(/\/+$/, "")}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          "x-api-key": this.key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: req.model,
          system: req.system,
          max_tokens: req.maxTokens,
          temperature: Math.min(1, req.temperature),
          stream: true,
          messages: req.messages,
        }),
        signal: timeoutSignal(req.signal, 120_000),
      });
    } catch (e: any) {
      if (req.signal?.aborted) {
        throw e;
      }
      throw new ProviderError(502, "Could not reach Anthropic", true);
    }
    if (!res.ok) {
      await failFromResponse(res, "Anthropic");
    }
    if (!res.body) {
      throw new ProviderError(502, "Anthropic sent an empty response");
    }
    let reason: string | null = null;
    for await (const ev of readSse(res.body)) {
      let j: any;
      try {
        j = JSON.parse(ev.data);
      } catch {
        continue;
      }
      if (j.type === "error") {
        throw new ProviderError(
          502,
          `Anthropic: ${String(j.error?.message ?? "stream error").slice(
            0,
            200,
          )}`,
        );
      }
      if (
        j.type === "content_block_delta" &&
        j.delta?.type === "text_delta" &&
        j.delta.text
      ) {
        yield { type: "content", delta: j.delta.text };
      } else if (j.type === "message_delta" && j.delta?.stop_reason) {
        reason = j.delta.stop_reason;
      } else if (j.type === "message_stop") {
        break;
      }
    }
    yield { type: "done", finishReason: finish(reason) ?? "stop" };
  }
}

// ------------------------------------------------------------------------ Gemini

class GeminiProvider implements AIProvider {
  readonly id = "gemini" as const;
  constructor(
    private base: string,
    private key: string,
    private f: typeof fetch,
  ) {}

  async *stream(req: StreamRequest): AsyncGenerator<StreamEvent> {
    let res: Response;
    try {
      res = await this.f(
        `${this.base.replace(/\/+$/, "")}/models/${encodeURIComponent(
          req.model,
        )}:streamGenerateContent?alt=sse`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": this.key,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: req.system }] },
            contents: req.messages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
            generationConfig: {
              maxOutputTokens: req.maxTokens,
              temperature: req.temperature,
            },
          }),
          signal: timeoutSignal(req.signal, 120_000),
        },
      );
    } catch (e: any) {
      if (req.signal?.aborted) {
        throw e;
      }
      throw new ProviderError(502, "Could not reach Gemini", true);
    }
    if (!res.ok) {
      await failFromResponse(res, "Gemini");
    }
    if (!res.body) {
      throw new ProviderError(502, "Gemini sent an empty response");
    }
    let reason: string | null = null;
    for await (const ev of readSse(res.body)) {
      let j: any;
      try {
        j = JSON.parse(ev.data);
      } catch {
        continue;
      }
      if (j.error) {
        throw new ProviderError(
          502,
          `Gemini: ${String(j.error.message ?? "stream error").slice(0, 200)}`,
        );
      }
      const cand = j.candidates?.[0];
      for (const part of cand?.content?.parts ?? []) {
        if (typeof part.text === "string" && part.text) {
          yield { type: "content", delta: part.text };
        }
      }
      if (cand?.finishReason) {
        reason = cand.finishReason;
      }
    }
    yield { type: "done", finishReason: finish(reason) ?? "stop" };
  }
}

/** Provider selection: the single place that maps a configured provider id to an implementation. */
export const createProvider = (cfg: ProviderConfig): AIProvider => {
  const info = PROVIDERS[cfg.provider];
  if (!info) {
    throw new ProviderError(400, `Unknown AI provider "${cfg.provider}"`);
  }
  if (info.needsKey && !cfg.apiKey) {
    throw new ProviderError(409, `${info.label} needs an API key`);
  }
  const f = cfg.fetchImpl ?? fetch;
  const base = cfg.baseUrl ?? info.defaultBaseUrl!;
  switch (cfg.provider) {
    case "openai":
      return new OpenAICompatible("openai", "OpenAI", base, cfg.apiKey, f);
    case "openrouter":
      return new OpenAICompatible(
        "openrouter",
        "OpenRouter",
        base,
        cfg.apiKey,
        f,
        { "x-title": "Excalidraw Workspace" },
      );
    case "local":
      return new OpenAICompatible(
        "local",
        "the local model server",
        base,
        cfg.apiKey,
        f,
      );
    case "anthropic":
      return new AnthropicProvider(base, cfg.apiKey!, f);
    case "gemini":
      return new GeminiProvider(base, cfg.apiKey!, f);
  }
};

/** Collects a whole completion (used by non-streaming API/MCP calls). */
export const complete = async (provider: AIProvider, req: StreamRequest) => {
  let text = "";
  let finishReason: "stop" | "length" | "content_filter" | null = null;
  for await (const ev of provider.stream(req)) {
    if (ev.type === "content") {
      text += ev.delta;
    } else {
      finishReason = ev.finishReason;
    }
  }
  return { text, finishReason };
};
