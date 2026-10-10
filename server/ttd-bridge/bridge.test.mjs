import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_VISION_PROMPT,
  buildUpstreamRequest,
  buildVisionRequest,
  createFenceFilter,
  withSystemPrompt,
  mapFinishReason,
  normalizeBaseURL,
  parseUpstreamChunk,
  readConfig,
  sse,
  translateUpstream,
  ttdContent,
  ttdDone,
  ttdError,
} from "./bridge.mjs";

/** Builds a `Response` whose body streams the given SSE text. */
const sseResponse = (frames, { ok = true, status = 200 } = {}) => {
  const body = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (const frame of frames) {
        controller.enqueue(encoder.encode(frame));
      }
      controller.close();
    },
  });
  return new Response(ok ? body : "bad", { status });
};

const collect = async (iterable) => {
  const out = [];
  for await (const item of iterable) {
    out.push(item);
  }
  return out;
};

const openAiFrame = (delta, finish = null) =>
  `data: ${JSON.stringify({
    choices: [{ delta: { content: delta }, finish_reason: finish }],
  })}\n\n`;

describe("sse frame builders", () => {
  it("emits the exact frames the panel parses", () => {
    assert.equal(sse(ttdContent("hi")), 'data: {"type":"content","delta":"hi"}\n\n');
    assert.equal(
      sse(ttdDone("stop")),
      'data: {"type":"done","finishReason":"stop"}\n\n',
    );
    const err = sse(ttdError("boom", 500));
    assert.match(err, /"type":"error"/);
    assert.match(err, /"status":500/);
  });

  it("omits status when none is given", () => {
    assert.equal(sse(ttdError("boom")), 'data: {"type":"error","error":{"message":"boom"}}\n\n');
  });
});

describe("normalizeBaseURL", () => {
  it("strips trailing slashes so the path is never doubled", () => {
    assert.equal(normalizeBaseURL("http://h/v1///"), "http://h/v1");
    assert.equal(normalizeBaseURL(undefined), "");
  });
});

describe("buildUpstreamRequest", () => {
  it("posts to /chat/completions with streaming on", () => {
    const { url, init } = buildUpstreamRequest(
      { baseURL: "http://localhost:8080/v1/", model: "m" },
      { messages: [{ role: "user", content: "hi" }] },
    );
    assert.equal(url, "http://localhost:8080/v1/chat/completions");
    const body = JSON.parse(init.body);
    assert.equal(body.stream, true);
    assert.equal(body.model, "m");
    assert.equal(body.messages.length, 1);
  });

  it("sends no Authorization header when there is no key", () => {
    const { init } = buildUpstreamRequest({ baseURL: "http://h/v1", model: "m" });
    assert.equal(init.headers.Authorization, undefined);
  });

  it("sends a bearer token when one is configured", () => {
    const { init } = buildUpstreamRequest({
      baseURL: "http://h/v1",
      model: "m",
      apiKey: "k",
    });
    assert.equal(init.headers.Authorization, "Bearer k");
  });
});

describe("parseUpstreamChunk", () => {
  it("returns the delta", () => {
    assert.deepEqual(parseUpstreamChunk('{"choices":[{"delta":{"content":"hi"}}]}'), {
      delta: "hi",
      finishReason: null,
      usage: null,
    });
  });

  it("treats [DONE] and garbage as nothing to emit", () => {
    assert.equal(parseUpstreamChunk("[DONE]"), null);
    assert.equal(parseUpstreamChunk("{not json"), null);
    assert.equal(parseUpstreamChunk(""), null);
  });

  it("carries the finish reason and usage when present", () => {
    const parsed = parseUpstreamChunk(
      '{"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":4}}',
    );
    assert.equal(parsed.finishReason, "stop");
    assert.equal(parsed.usage.prompt_tokens, 3);
  });
});

describe("mapFinishReason", () => {
  it("passes the known reasons through and defaults the rest to stop", () => {
    assert.equal(mapFinishReason("length"), "length");
    assert.equal(mapFinishReason("content_filter"), "content_filter");
    assert.equal(mapFinishReason(undefined), "stop");
    assert.equal(mapFinishReason("weird"), "stop");
  });
});

describe("translateUpstream", () => {
  it("converts an OpenAI stream into the panel's frames", async () => {
    const response = sseResponse([
      openAiFrame("Hel"),
      openAiFrame("lo"),
      openAiFrame("", "stop"),
    ]);
    const frames = await collect(translateUpstream(response));
    assert.deepEqual(frames, [
      sse(ttdContent("Hel")),
      sse(ttdContent("lo")),
      sse(ttdDone("stop")),
    ]);
  });

  it("emits a terminal done when the upstream never sends a finish_reason", async () => {
    const response = sseResponse([openAiFrame("only")]);
    const frames = await collect(translateUpstream(response));
    assert.equal(frames.at(-1), sse(ttdDone("stop")));
  });

  it("reports an upstream error as an error frame instead of hanging", async () => {
    const response = new Response("nope", { status: 503 });
    const frames = await collect(translateUpstream(response));
    assert.equal(frames.length, 1);
    assert.match(frames[0], /"type":"error"/);
    assert.match(frames[0], /503/);
  });

  it("surfaces usage through the callback, not into the stream", async () => {
    const seen = [];
    const response = sseResponse([
      openAiFrame("x"),
      `data: ${JSON.stringify({
        choices: [{ delta: {}, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 2 },
      })}\n\n`,
    ]);
    const frames = await collect(
      translateUpstream(response, { onUsage: (usage) => seen.push(usage) }),
    );
    assert.deepEqual(seen, [{ prompt_tokens: 1, completion_tokens: 2 }]);
    assert.ok(!frames.some((frame) => frame.includes("prompt_tokens")));
  });
});

describe("readConfig", () => {
  it("defaults to localhost and refuses to invent a model host", () => {
    const config = readConfig({});
    assert.equal(config.host, "127.0.0.1");
    assert.equal(config.port, 7313);
    assert.equal(config.modelBaseURL, "");
  });

  it("does not default the origin allow-list to a public host", () => {
    const config = readConfig({});
    assert.ok(config.allowedOrigins.every((origin) => origin.includes("localhost") || origin.includes("127.0.0.1")));
  });
});

describe("the instruction the model is given", () => {
  it("prepends a system message demanding bare Mermaid", () => {
    const messages = withSystemPrompt([{ role: "user", content: "a flowchart" }]);
    assert.equal(messages.length, 2);
    assert.equal(messages[0].role, "system");
    assert.match(messages[0].content, /no code\s+fences/i);
    assert.match(messages[0].content, /Mermaid/);
    // the panel's own message survives untouched
    assert.deepEqual(messages[1], { role: "user", content: "a flowchart" });
  });

  it("does not double up when the caller already sent a system message", () => {
    const messages = withSystemPrompt([
      { role: "system", content: "mine" },
      { role: "user", content: "hi" },
    ]);
    assert.equal(messages.length, 2);
    assert.equal(messages[0].content, "mine");
  });

  it("adds nothing when the prompt is switched off", () => {
    assert.deepEqual(withSystemPrompt([{ role: "user", content: "hi" }], ""), [
      { role: "user", content: "hi" },
    ]);
  });

  it("has a default prompt that names the failure it prevents", () => {
    assert.match(DEFAULT_SYSTEM_PROMPT, /Mermaid/);
  });
});

describe("the fence filter", () => {
  const feed = (chunks) => {
    const filter = createFenceFilter();
    const out = chunks.map((chunk) => filter.push(chunk)).join("") + filter.end();
    return out;
  };

  it("passes a bare diagram through untouched", () => {
    assert.equal(feed(["flowchart TD\n", "  A --> B"]), "flowchart TD\n  A --> B");
  });

  it("strips a leading fence when it arrives in pieces", () => {
    assert.equal(feed(["``", "`mermaid\n", "flowchart TD\n", "A --> B"]), "flowchart TD\nA --> B");
  });

  it("strips a trailing fence, including one split across deltas", () => {
    // The closing fence arrives in two pieces and the trailing newline goes with
    // it — the reply handed to the panel is bare Mermaid, nothing more.
    assert.equal(feed(["flowchart TD\nA --> B\n", "``", "`"]), "flowchart TD\nA --> B");
  });

  it("strips both fences at once", () => {
    assert.equal(
      feed(["```mermaid\n", "flowchart TD\nA --> B\n", "```"]),
      "flowchart TD\nA --> B",
    );
  });

  it("does not hold back a reply that merely starts with a backtick-ish word", () => {
    // No fence: the first characters are content, and must not be eaten.
    assert.equal(feed(["flow", "chart TD"]), "flowchart TD");
  });

  it("reports whether it ever saw content", () => {
    const filter = createFenceFilter();
    filter.push("```mermaid\n");
    assert.equal(filter.sawContent, false);
    filter.push("flowchart TD");
    assert.equal(filter.sawContent, true);
  });
});

describe("the vision route (feature-0015)", () => {
  it("builds an OpenAI vision request carrying the panel's data URL", () => {
    const { url, init, hasImage } = buildVisionRequest(
      { baseURL: "http://127.0.0.1:8080/v1", model: "vision-model" },
      { texts: ["Start", "Done"], image: "data:image/png;base64,AAAA" },
    );
    assert.equal(url, "http://127.0.0.1:8080/v1/chat/completions");
    assert.equal(hasImage, true);

    const body = JSON.parse(init.body);
    assert.equal(body.stream, true);
    assert.equal(body.model, "vision-model");
    const parts = body.messages[0].content;
    assert.equal(parts.some((p) => p.type === "image_url"), true);
    assert.equal(parts.find((p) => p.type === "image_url").image_url.url, "data:image/png;base64,AAAA");
    // The drawing's own text rides along as a text part.
    assert.match(JSON.stringify(parts), /Start \| Done/);
  });

  it("says so when there is no image to read", () => {
    const { hasImage } = buildVisionRequest(
      { baseURL: "http://h/v1", model: "m" },
      { texts: ["x"], image: undefined },
    );
    assert.equal(hasImage, false);
  });

  it("sends no Authorization when no key is configured", () => {
    const { init } = buildVisionRequest({ baseURL: "http://h/v1", model: "m" }, {});
    assert.equal(init.headers.Authorization, undefined);
  });

  it("has a default prompt that names what it prevents", () => {
    assert.match(DEFAULT_VISION_PROMPT, /code ONLY/i);
    assert.match(DEFAULT_VISION_PROMPT, /fences/i);
  });

  it("reports vision as UNSET by default, so the route is refused rather than faked", () => {
    assert.equal(readConfig({}).visionModel, "");
    assert.equal(readConfig({ TTD_VISION_MODEL: "v" }).visionModel, "v");
  });
});
