import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TTAStreamFetch } from "./client";
import { AI_CLIENT_ERRORS } from "./utils";

function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }

      controller.enqueue(encoder.encode(chunks[index]));
      index++;
    },
  });
}

const createChunk = (data: unknown) => `data: ${JSON.stringify(data)}\n\n`;

const createTransportFetch =
  () =>
  async ({
    method,
    headers,
    payload,
    signal,
  }: {
    method: "POST";
    headers: Record<string, string>;
    payload: unknown;
    signal?: AbortSignal;
  }) =>
    global.fetch("https://api.example.com/tta/stream", {
      method,
      headers,
      body: JSON.stringify(payload),
      signal,
    });

describe("TTAStreamFetch", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("streams partial payloads and returns the final payload", async () => {
    const onStarted = vi.fn();
    const onMessage = vi.fn();
    const onChunk = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: createMockStream([
        createChunk({
          type: "started",
          chatId: "chat-1",
          turnId: "turn-1",
          messageId: "message-1",
          lifecycleStatus: "pending",
        }),
        createChunk({
          type: "message",
          message: "Something went wrong. Retrying...",
        }),
        createChunk({
          type: "partial",
          skeletons: [],
        }),
        createChunk({
          type: "done",
          lifecycleStatus: "completed",
          finishReason: "stop",
          skeletons: [],
          chatId: "chat-1",
          turnId: "turn-1",
          messageId: "message-1",
          updatedAt: 1710000000000,
        }),
      ]),
    });

    const result = await TTAStreamFetch({
      payload: { prompt: "hello" },
      onStarted,
      onMessage,
      onChunk,
      fetch: createTransportFetch(),
    });

    expect(onStarted).toHaveBeenCalledWith({
      chatId: "chat-1",
      turnId: "turn-1",
      messageId: "message-1",
      lifecycleStatus: "pending",
    });
    expect(onMessage).toHaveBeenCalledWith({
      message: "Something went wrong. Retrying...",
    });
    expect(onChunk).toHaveBeenCalledWith({
      skeletons: [],
      isComplete: false,
    });
    expect(result.error).toBeNull();
    expect(result.finalPayload).toEqual({
      skeletons: [],
      isComplete: true,
      chatId: "chat-1",
      turnId: "turn-1",
      messageId: "message-1",
      finishReason: "stop",
      lifecycleStatus: "completed",
      updatedAt: 1710000000000,
    });
  });

  it("forwards the server's isComplete flag on partial chunks", async () => {
    const onChunk = vi.fn();
    const skeleton = { type: "rectangle", x: 0, y: 0, width: 10, height: 10 };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: createMockStream([
        createChunk({ type: "partial", skeletons: [skeleton] }),
        createChunk({
          type: "partial",
          skeletons: [skeleton],
          isComplete: true,
        }),
        createChunk({
          type: "done",
          lifecycleStatus: "completed",
          finishReason: "stop",
          skeletons: [skeleton],
        }),
      ]),
    });

    await TTAStreamFetch({
      payload: { prompt: "hello" },
      onChunk,
      fetch: createTransportFetch(),
    });

    expect(onChunk).toHaveBeenNthCalledWith(1, {
      skeletons: [skeleton],
      isComplete: false,
    });
    expect(onChunk).toHaveBeenNthCalledWith(2, {
      skeletons: [skeleton],
      isComplete: true,
    });
  });

  it("surfaces the started chat id before a later stream error", async () => {
    const onStarted = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: createMockStream([
        createChunk({
          type: "started",
          chatId: "chat-error",
          turnId: "turn-error",
          messageId: "message-error",
          lifecycleStatus: "pending",
        }),
        createChunk({
          type: "error",
          lifecycleStatus: "failed",
          error: {
            code: 422,
            message: "Generation failed",
          },
        }),
      ]),
    });

    const result = await TTAStreamFetch({
      payload: { prompt: "hello" },
      onStarted,
      fetch: createTransportFetch(),
    });

    expect(onStarted).toHaveBeenCalledWith({
      chatId: "chat-error",
      turnId: "turn-error",
      messageId: "message-error",
      lifecycleStatus: "pending",
    });
    expect(result.error).toEqual({
      code: 422,
      lifecycleStatus: "failed",
      message: "Generation failed",
    });
  });

  it("returns rate limit metadata on 429 responses", async () => {
    const headers = new Headers();
    headers.set("X-Ratelimit-Limit", "100");
    headers.set("X-Ratelimit-Remaining", "0");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers,
      clone() {
        return this;
      },
      json: async () => ({ error: "Rate limit exceeded" }),
      text: async () => "Rate limit exceeded",
    });

    const result = await TTAStreamFetch({
      payload: { prompt: "hello" },
      fetch: createTransportFetch(),
    });

    expect(result.error).toEqual({
      code: 429,
      message: "Rate limit exceeded",
    });
    expect(result.rateLimit).toBe(100);
    expect(result.rateLimitRemaining).toBe(0);
  });

  it("returns rate limit metadata on successful responses", async () => {
    const headers = new Headers();
    headers.set("X-Ratelimit-Limit", "100");
    headers.set("X-Ratelimit-Remaining", "0");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers,
      body: createMockStream([
        createChunk({
          type: "done",
          lifecycleStatus: "completed",
          finishReason: "stop",
          skeletons: [],
          chatId: "chat-1",
          turnId: "turn-1",
          messageId: "message-1",
        }),
      ]),
    });

    const result = await TTAStreamFetch({
      payload: { prompt: "hello" },
      fetch: createTransportFetch(),
    });

    expect(result.error).toBeNull();
    expect(result.rateLimit).toBe(100);
    expect(result.rateLimitRemaining).toBe(0);
  });

  it("reports an interrupted stream when EOF arrives without a terminal chunk", async () => {
    const onChunk = vi.fn();
    const skeleton = { type: "rectangle", x: 0, y: 0, width: 10, height: 10 };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: createMockStream([
        createChunk({
          type: "started",
          chatId: "chat-1",
          turnId: "turn-1",
          messageId: "message-1",
          lifecycleStatus: "pending",
        }),
        createChunk({ type: "partial", skeletons: [skeleton] }),
        // stream cut here: no `done`/`error` chunk, no `[DONE]` sentinel
      ]),
    });

    const result = await TTAStreamFetch({
      payload: { prompt: "hello" },
      onChunk,
      fetch: createTransportFetch(),
    });

    expect(onChunk).toHaveBeenCalledWith({
      skeletons: [skeleton],
      isComplete: false,
    });
    expect(result.finalPayload).toBeFalsy();
    expect(result.error).toMatchObject({
      code: AI_CLIENT_ERRORS.STREAM_INTERRUPTED,
      lifecycleStatus: "failed",
    });
    expect(result.error?.message).toMatch(/connection interrupted/i);
  });

  it("reports a server-ended stream when [DONE] arrives without a result", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: createMockStream([
        createChunk({
          type: "started",
          chatId: "chat-1",
          turnId: "turn-1",
          messageId: "message-1",
          lifecycleStatus: "pending",
        }),
        "data: [DONE]\n\n",
      ]),
    });

    const result = await TTAStreamFetch({
      payload: { prompt: "hello" },
      fetch: createTransportFetch(),
    });

    expect(result.finalPayload).toBeFalsy();
    expect(result.error).toMatchObject({
      code: AI_CLIENT_ERRORS.STREAM_INTERRUPTED,
      lifecycleStatus: "failed",
    });
    expect(result.error?.message).toMatch(/ended the stream/i);
  });

  it("drains the stream to EOF after the done chunk so the fetch completes cleanly", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      createChunk({
        type: "done",
        lifecycleStatus: "completed",
        finishReason: "stop",
        skeletons: [],
      }),
      "data: [DONE]\n\n",
    ];
    let index = 0;
    let fullyRead = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (index >= chunks.length) {
          fullyRead = true;
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body,
    });

    const result = await TTAStreamFetch({
      payload: { prompt: "hello" },
      fetch: createTransportFetch(),
    });

    // the result resolves at the `done` frame, before the trailing sentinel…
    expect(result.error).toBeNull();
    // …and the detached drain then reads the body to EOF (no ERR_ABORTED)
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(fullyRead).toBe(true);
  });

  it("returns an abort error when the request is cancelled", async () => {
    const abortController = new AbortController();

    global.fetch = vi.fn().mockImplementation(() => {
      abortController.abort();
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      return Promise.reject(error);
    });

    const result = await TTAStreamFetch({
      payload: { prompt: "hello" },
      signal: abortController.signal,
      fetch: createTransportFetch(),
    });

    expect(result.error).toEqual({
      code: 499,
      lifecycleStatus: "aborted",
      message: "Request aborted",
    });
  });

  it("passes chat ids through without trimming", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: createMockStream([
        createChunk({
          type: "done",
          finishReason: "stop",
          skeletons: [],
        }),
      ]),
    });

    await TTAStreamFetch({
      payload: {
        prompt: "hello",
        chatId: "  chat-with-spaces  ",
      },
      fetch: createTransportFetch(),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.example.com/tta/stream",
      expect.objectContaining({
        body: JSON.stringify({
          prompt: "hello",
          chatId: "  chat-with-spaces  ",
        }),
      }),
    );
  });
});
