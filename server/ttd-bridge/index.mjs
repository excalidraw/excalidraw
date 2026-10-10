#!/usr/bin/env node
/**
 * TTD bridge — a self-hosted backend for the Excalidraw AI panel.
 *
 *   TTD_MODEL_BASE_URL=http://127.0.0.1:8080/v1 \
 *   TTD_MODEL=qwen3.6-35b-a3b@q4_k_xl \
 *   node server/ttd-bridge/index.mjs
 *
 * Then set "AI text-to-diagram backend" to this bridge's URL in Settings
 * (http://127.0.0.1:7313).
 *
 * It binds localhost by default. It logs timing and token counts — never a
 * prompt, never a response body, never a credential.
 */

import { createServer } from "node:http";

import {
  buildUpstreamRequest,
  buildVisionRequest,
  createFenceFilter,
  readConfig,
  sse,
  translateUpstream,
  ttdError,
  withSystemPrompt,
} from "./bridge.mjs";

const config = readConfig();

if (!config.modelBaseURL) {
  console.error(
    "TTD_MODEL_BASE_URL is not set — the bridge refuses to pick a hosted " +
      "default. Point it at a model (e.g. http://127.0.0.1:8080/v1).",
  );
  process.exit(1);
}

const json = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
};

const applyCors = (req, res) => {
  const origin = req.headers.origin;
  if (origin && config.allowedOrigins.includes(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");
  }
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      // A prompt is text; 1 MiB is generous and stops an unbounded upload.
      if (size > 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

const handleTextToDiagram = async (req, res) => {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (error) {
    return json(res, 400, { error: error.message });
  }

  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  if (!messages.length) {
    return json(res, 400, { error: "messages is required" });
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  req.on("close", () => controller.abort());

  // The panel sends the user's words; the bridge adds the instruction that
  // makes the reply parseable as Mermaid.
  const instructed = withSystemPrompt(messages, config.systemPrompt);

  const { url, init } = buildUpstreamRequest(
    {
      baseURL: config.modelBaseURL,
      model: payload.model || config.model,
      apiKey: config.modelApiKey,
    },
    { messages: instructed, signal: controller.signal },
  );

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });

  let tokens = null;
  let firstDeltaAt = null;

  try {
    const upstream = await fetch(url, init);
    const fenceFilter = createFenceFilter();
    for await (const frame of translateUpstream(upstream, {
      transform: fenceFilter,
      onUsage: (usage) => {
        tokens = usage;
      },
    })) {
      if (firstDeltaAt === null && frame.includes('"type":"content"')) {
        firstDeltaAt = Date.now();
      }
      res.write(frame);
    }
  } catch (error) {
    res.write(sse(ttdError(error?.message ?? String(error))));
  } finally {
    res.end();
    // Timing and counts only — never the prompt, never the completion.
    console.log(
      JSON.stringify({
        event: "ttd",
        ok: true,
        ms: Date.now() - startedAt,
        firstDeltaMs: firstDeltaAt === null ? null : firstDeltaAt - startedAt,
        model: payload.model || config.model,
        tokens: tokens
          ? { prompt: tokens.prompt_tokens, completion: tokens.completion_tokens }
          : null,
        messages: messages.length,
      }),
    );
  }
};

/**
 * Diagram to code — the VISION route.
 *
 * A drawing goes in and code comes out. It needs a model that can SEE, which is a
 * different model from the text one, so it is configured separately: with no
 * `TTD_VISION_MODEL` the route refuses with exactly that reason rather than
 * pretending, and the panel shows it.
 */
const handleDiagramToCode = async (req, res) => {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (error) {
    return json(res, 400, { error: error.message });
  }

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });

  if (!config.visionModel) {
    res.write(
      sse(
        ttdError(
          "No vision model is configured for this bridge. Set TTD_VISION_MODEL to a " +
            "model that can see images (one launched with an mmproj projector).",
        ),
      ),
    );
    res.end();
    return;
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  req.on("close", () => controller.abort());

  const { url, init, hasImage } = buildVisionRequest(
    {
      baseURL: config.modelBaseURL,
      model: payload.model || config.visionModel,
      apiKey: config.modelApiKey,
    },
    {
      texts: payload.texts,
      image: payload.image,
      signal: controller.signal,
    },
  );

  if (!hasImage) {
    res.write(
      sse(ttdError("The request carried no image to read.")),
    );
    res.end();
    return;
  }

  let firstDeltaAt = null;
  try {
    const upstream = await fetch(url, init);
    const fenceFilter = createFenceFilter();
    for await (const frame of translateUpstream(upstream, { transform: fenceFilter })) {
      if (firstDeltaAt === null && frame.includes('"type":"content"')) {
        firstDeltaAt = Date.now();
      }
      res.write(frame);
    }
  } catch (error) {
    res.write(sse(ttdError(error?.message ?? String(error))));
  } finally {
    res.end();
    // Timing only. The prompt and the IMAGE are never logged.
    console.log(
      JSON.stringify({
        event: "ttd-vision",
        ok: true,
        ms: Date.now() - startedAt,
        firstDeltaMs: firstDeltaAt === null ? null : firstDeltaAt - startedAt,
        model: payload.model || config.visionModel,
      }),
    );
  }
};

const server = createServer(async (req, res) => {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/healthz") {
    return json(res, 200, {
      ok: true,
      model: config.model || null,
      vision: Boolean(config.visionModel),
      // The base URL is operator-supplied, so echoing it leaks nothing.
      upstream: config.modelBaseURL,
    });
  }

  if (req.method === "POST" && url.pathname === "/v1/ai/text-to-diagram/chat-streaming") {
    return handleTextToDiagram(req, res);
  }

  if (
    req.method === "POST" &&
    url.pathname === "/v1/ai/diagram-to-code/generate-streaming"
  ) {
    return handleDiagramToCode(req, res);
  }

  return json(res, 404, { error: `no route ${req.method} ${url.pathname}` });
});

server.listen(config.port, config.host, () => {
  console.log(
    `TTD bridge on http://${config.host}:${config.port} → ${config.modelBaseURL}${
      config.model ? ` (model ${config.model})` : ""
    }`,
  );
});
