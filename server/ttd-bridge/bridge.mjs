/**
 * TTD bridge — the translation layer between the Excalidraw AI panel and any
 * OpenAI-compatible model.
 *
 * The panel's client contract is unchanged: it POSTs the prompt and parses an
 * SSE stream of `{type:"content",delta}` … `{type:"done",finishReason}`.
 * This module converts an upstream OpenAI `chat.completions` stream into that
 * contract, so the model behind it can be local (llama.cpp), Claude, OpenCode
 * Zen, or anything else OpenAI-shaped.
 *
 * Deliberate: this file never logs or returns a prompt, and never returns an
 * upstream API key. See `tickets/open/feature-0005-uw-local-ai-text-to-diagram-backend.md`.
 */

/** The TTD event shapes the panel's `parseSSEStream` understands. */
export const ttdContent = (delta) => ({ type: "content", delta });

export const ttdDone = (finishReason = "stop") => ({
  type: "done",
  finishReason,
});

export const ttdError = (message, status) => ({
  type: "error",
  error: { message, ...(status === undefined ? {} : { status }) },
});

/** One SSE frame. The panel splits on blank lines and reads `data: ` lines. */
export const sse = (obj) => `data: ${JSON.stringify(obj)}\n\n`;

export const normalizeBaseURL = (url) => String(url ?? "").trim().replace(/\/+$/, "");

/**
 * The upstream request. `stream: true` is not optional — the panel renders
 * progressively and the bridge must not buffer the whole completion.
 */
export const buildUpstreamRequest = (
  { baseURL, model, apiKey },
  { messages, signal } = {},
) => {
  const url = `${normalizeBaseURL(baseURL)}/chat/completions`;
  const headers = { "content-type": "application/json" };
  // A local server needs no key; sending none keeps llama.cpp happy.
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return {
    url,
    init: {
      method: "POST",
      headers,
      body: JSON.stringify({ model, messages, stream: true }),
      ...(signal ? { signal } : {}),
    },
  };
};

/**
 * Parses one upstream `data:` payload. Returns `null` for the terminal
 * `[DONE]` and for anything unparseable, so a malformed frame is skipped
 * rather than killing the stream.
 */
export const parseUpstreamChunk = (raw) => {
  const payload = String(raw).trim();
  if (payload === "" || payload === "[DONE]") {
    return null;
  }
  let obj;
  try {
    obj = JSON.parse(payload);
  } catch {
    return null;
  }
  const choice = obj?.choices?.[0];
  const content = choice?.delta?.content;
  return {
    delta: typeof content === "string" ? content : "",
    finishReason: choice?.finish_reason ?? null,
    usage: obj?.usage ?? null,
  };
};

/** Maps an OpenAI finish_reason onto the panel's vocabulary. */
export const mapFinishReason = (reason) => {
  switch (reason) {
    case "length":
    case "content_filter":
    case "tool_calls":
    case "stop":
      return reason;
    default:
      return "stop";
  }
};

/**
 * Turns an upstream SSE byte stream into TTD SSE frames.
 *
 * Yields strings ready to write to the response. On upstream error it yields a
 * `ttdError` frame — the panel renders that instead of hanging.
 */
export async function* translateUpstream(response, { onUsage, transform } = {}) {
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    yield sse(
      ttdError(
        `Upstream returned ${response.status}${
          detail ? `: ${detail.slice(0, 300)}` : ""
        }`,
        response.status,
      ),
    );
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield sse(ttdError("Upstream returned no body."));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) {
          continue;
        }
        const chunk = parseUpstreamChunk(trimmed.slice(5));
        if (!chunk) {
          continue;
        }
        if (chunk.delta) {
          // `transform` is how the fence filter gets in: it holds back a leading
          // fence until it can tell one from content.
          const text = transform ? transform.push(chunk.delta) : chunk.delta;
          if (text) {
            yield sse(ttdContent(text));
          }
        }
        if (chunk.usage && typeof onUsage === "function") {
          onUsage(chunk.usage);
        }
        if (chunk.finishReason) {
          yield sse(ttdDone(mapFinishReason(chunk.finishReason)));
          sawDone = true;
        }
      }
    }
  } catch (error) {
    yield sse(ttdError(error?.message ?? String(error)));
    return;
  } finally {
    reader.releaseLock?.();
  }

  // Flush whatever the transform was holding back (a trailing fence, usually).
  if (transform) {
    const tail = transform.end();
    if (tail) {
      yield sse(ttdContent(tail));
    }
  }

  // Some servers close without a finish_reason; the panel needs a terminal
  // event or it stays in a generating state.
  if (!sawDone) {
    yield sse(ttdDone("stop"));
  }
}

/**
 * The instruction a VISION model is given, for the diagram-to-code route.
 *
 * The panel sends the frame's texts and a PNG data URL; the model answers with
 * code. Same reason as the Mermaid prompt: without it a general model wraps the
 * answer in prose and the panel cannot use it.
 */
export const DEFAULT_VISION_PROMPT = [
  "You are given a hand-drawn wireframe or diagram as an image, plus any text in it.",
  "Produce clean, semantic HTML with inline CSS that reproduces the layout.",
  "Reply with the code ONLY: no explanation, no markdown fences, no commentary.",
].join("\n");

/**
 * The upstream request for the vision route. The image travels as an OpenAI
 * `image_url` content part carrying the data URL the panel already produced — it
 * goes to the model the operator configured and nowhere else.
 */
export const buildVisionRequest = (
  { baseURL, model, apiKey },
  { prompt = DEFAULT_VISION_PROMPT, texts = [], image, signal } = {},
) => {
  const url = `${normalizeBaseURL(baseURL)}/chat/completions`;
  const headers = { "content-type": "application/json" };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const parts = [{ type: "text", text: prompt }];
  if (Array.isArray(texts) && texts.length) {
    parts.push({ type: "text", text: `Text in the drawing: ${texts.join(" | ")}` });
  }
  if (typeof image === "string" && image.startsWith("data:")) {
    parts.push({ type: "image_url", image_url: { url: image } });
  }

  return {
    url,
    hasImage: parts.some((part) => part.type === "image_url"),
    init: {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        stream: true,
        messages: [{ role: "user", content: parts }],
      }),
      ...(signal ? { signal } : {}),
    },
  };
};

/**
 * The instruction the model is given, prepended to whatever the panel sent.
 *
 * The panel expects **bare Mermaid** — it parses the reply as Mermaid and shows
 * "Mermaid syntax error" for anything else. A general coding model will happily
 * wrap it in prose or a code fence, which is a transport problem, not a user
 * problem, so the bridge fixes it here.
 *
 * Override with `TTD_SYSTEM_PROMPT` when a model needs different words.
 */
export const DEFAULT_SYSTEM_PROMPT = [
  "You turn a description into a Mermaid diagram.",
  "",
  "Reply with the Mermaid source ONLY: no explanation, no commentary, no code",
  "fences, no markdown. The first character of your reply must begin the diagram",
  "(for example `flowchart TD`). Use valid Mermaid syntax and nothing else.",
].join("\n");

export const withSystemPrompt = (messages, systemPrompt = DEFAULT_SYSTEM_PROMPT) => {
  const list = Array.isArray(messages) ? messages : [];
  if (!systemPrompt) {
    return list;
  }
  // Do not double up if the caller already sent a system message.
  if (list.some((message) => message?.role === "system")) {
    return list;
  }
  return [{ role: "system", content: systemPrompt }, ...list];
};

/**
 * Strips a code fence from the model's reply.
 *
 * Streaming makes this a state machine, not a regex: a fence arrives in pieces.
 * This holds back a small prefix until it knows whether it is a fence, and drops
 * a trailing fence at the end — without buffering the whole completion.
 */
export const createFenceFilter = () => {
  let buffered = "";
  let leadingResolved = false;
  let sawContent = false;

  const FENCE_OPEN = /^\s*```[a-zA-Z]*\s*\n?/;
  const FENCE_CLOSE = /\n?\s*```\s*$/;
  // A closing fence can arrive as "``" then "`" in separate deltas, so the last
  // few characters are held back until the stream ends. Holding back a handful
  // of characters costs nothing: a diagram is inserted when the stream is done.
  const HOLDBACK = 8;

  const emit = () => {
    if (buffered.length <= HOLDBACK) {
      return "";
    }
    const out = buffered.slice(0, buffered.length - HOLDBACK);
    buffered = buffered.slice(buffered.length - HOLDBACK);
    if (out.trim() !== "") {
      sawContent = true;
    }
    return out;
  };

  return {
    push(delta) {
      if (!delta) {
        return "";
      }
      buffered += delta;

      if (!leadingResolved) {
        // Decide whether the opening characters are a fence. Wait for a newline
        // (a fence line ends) or for enough characters to know it is not one —
        // but never eat the head of a reply that just starts with a backtick.
        const looksLikeFence = /^\s*`/.test(buffered);
        const decided =
          buffered.includes("\n") || buffered.length >= 32 || !looksLikeFence;
        if (!decided) {
          return "";
        }
        leadingResolved = true;
        buffered = buffered.replace(FENCE_OPEN, "");
      }

      return emit();
    },
    /** Flush the tail, dropping a closing fence. */
    end() {
      let out = buffered;
      buffered = "";
      if (!leadingResolved) {
        leadingResolved = true;
        out = out.replace(FENCE_OPEN, "");
      }
      out = out.replace(FENCE_CLOSE, "");
      if (out.trim() !== "") {
        sawContent = true;
      }
      return out;
    },
    get sawContent() {
      return sawContent;
    },
  };
};

/**
 * Reads the bridge's configuration from the environment. Nothing is defaulted
 * to a hosted host: with no `TTD_MODEL_BASE_URL` the bridge refuses to start.
 */
export const readConfig = (env = process.env) => ({
  port: Number(env.TTD_BRIDGE_PORT ?? 7313),
  host: env.TTD_BRIDGE_HOST ?? "127.0.0.1",
  modelBaseURL: normalizeBaseURL(env.TTD_MODEL_BASE_URL),
  model: env.TTD_MODEL ?? "",
  modelApiKey: env.TTD_MODEL_API_KEY ?? "",
  /** the model that serves the VISION route; unset means the route is refused */
  visionModel: env.TTD_VISION_MODEL ?? "",
  /** the instruction prepended to the panel's messages */
  systemPrompt: env.TTD_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT,
  /** comma-separated origins allowed to call the bridge */
  allowedOrigins: (env.TTD_BRIDGE_ORIGINS ?? "http://localhost:7311,http://127.0.0.1:7311")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
});
