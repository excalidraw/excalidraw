import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { TTDStreamFetch } from "./TTDStreamFetch";

import type { StreamChunk } from "./TTDStreamFetch";

function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    async pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

const createContentChunkData = (delta: string): string => {
  const data: StreamChunk & { type: "content" } = { type: "content", delta };
  return JSON.stringify(data);
};

const createContentChunk = (delta: string): string => {
  return `data: ${createContentChunkData(delta)}\n\n`;
};

const createDataChunk = (data: string): string => {
  return `data: ${data}\n\n`;
};

const DONE_CHUNK = "data: [DONE]\n\n";

describe("TTDStreamFetch", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("successful streaming", () => {
    it("should stream data chunks and return full response", async () => {
      const chunks: string[] = [];
      const mockChunks = [
        createContentChunk("Hello "),
        createContentChunk("world"),
        DONE_CHUNK,
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
        onChunk: (chunk) => chunks.push(chunk),
      });

      expect(result.generatedResponse).toBe("Hello world");
      expect(chunks).toEqual(["Hello ", "world"]);
      expect(result.error).toBeNull();
    });

    it("should handle multi-line chunks", async () => {
      const mockChunks = [
        createContentChunk("Line 1\n"),
        createContentChunk("Line 2"),
        DONE_CHUNK,
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
      });

      expect(result.generatedResponse).toBe("Line 1\nLine 2");
    });

    it("should call onStreamCreated callback", async () => {
      const onStreamCreated = vi.fn();
      const mockChunks = [createContentChunk("test"), DONE_CHUNK];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
        onStreamCreated,
      });

      expect(onStreamCreated).toHaveBeenCalledTimes(1);
    });

    it("should handle empty chunks gracefully", async () => {
      const mockChunks = [
        createContentChunk(""),
        createContentChunk("valid"),
        DONE_CHUNK,
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
      });

      expect(result.generatedResponse).toBe("valid");
    });

    it("should handle null chunk as stream termination", async () => {
      const mockChunks = [
        createContentChunk("before null"),
        createDataChunk("null"),
        createContentChunk("after null"),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
      });

      expect(result.generatedResponse).toBe("before null");
    });
  });

  describe("rate limit handling", () => {
    it("should extract rate limit headers when enabled", async () => {
      const mockChunks = [createContentChunk("test"), DONE_CHUNK];

      const headers = new Headers();
      headers.set("X-Ratelimit-Limit", "100");
      headers.set("X-Ratelimit-Remaining", "95");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers,
        body: createMockStream(mockChunks),
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
        extractRateLimits: true,
      });

      expect(result.rateLimit).toBe(100);
      expect(result.rateLimitRemaining).toBe(95);
    });

    it("should not extract rate limits when disabled", async () => {
      const mockChunks = [createContentChunk("test"), DONE_CHUNK];

      const headers = new Headers();
      headers.set("X-Ratelimit-Limit", "100");
      headers.set("X-Ratelimit-Remaining", "95");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers,
        body: createMockStream(mockChunks),
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
        extractRateLimits: false,
      });

      expect(result.rateLimit).toBeUndefined();
      expect(result.rateLimitRemaining).toBeUndefined();
    });

    it("should handle missing rate limit headers", async () => {
      const mockChunks = [createContentChunk("test"), DONE_CHUNK];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
        extractRateLimits: true,
      });

      expect(result.rateLimit).toBeUndefined();
      expect(result.rateLimitRemaining).toBeUndefined();
    });

    it("should return specific error for 429 rate limit", async () => {
      const headers = new Headers();
      headers.set("X-Ratelimit-Limit", "100");
      headers.set("X-Ratelimit-Remaining", "0");

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers,
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Rate limit exceeded");
      expect(result.rateLimit).toBe(100);
      expect(result.rateLimitRemaining).toBe(0);
    });
  });

  describe("error handling", () => {
    it("should handle non-ok response with text", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        text: async () => "Server error occurred",
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Server error occurred");
    });

    it("should handle non-ok response without text", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        text: async () => "",
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Generation failed...");
    });

    it("should handle missing response body", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: null,
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe(
        "Couldn't get reader from response body",
      );
    });

    it("should handle empty response", async () => {
      const mockChunks = [DONE_CHUNK];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Generation failed...");
    });

    it("should handle network errors", async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error("Network connection failed"));

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Network connection failed");
    });

    it("should handle invalid JSON in stream", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const mockChunks = [
        createDataChunk("invalid"),
        createContentChunk("valid"),
        DONE_CHUNK,
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
      });

      expect(result.generatedResponse).toBe("valid");
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe("abort handling", () => {
    it("should handle abort signal during fetch", async () => {
      const abortController = new AbortController();

      global.fetch = vi.fn().mockImplementation(() => {
        abortController.abort();
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        return Promise.reject(error);
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
        signal: abortController.signal,
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Request aborted");
    });

    it("should handle abort error thrown during streaming", async () => {
      // Create a stream that throws an AbortError
      const stream = new ReadableStream({
        async pull() {
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          throw error;
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: stream,
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Request aborted");
    });
  });

  describe("SSE parsing", () => {
    it("should handle lines without data prefix", async () => {
      const mockChunks = [
        ": comment line\n",
        createContentChunk("valid"),
        DONE_CHUNK,
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
      });

      expect(result.generatedResponse).toBe("valid");
    });

    it("should handle empty lines in stream", async () => {
      const mockChunks = [
        createContentChunk("first"),
        "\n\n",
        createContentChunk("second"),
        DONE_CHUNK,
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
      });

      expect(result.generatedResponse).toBe("firstsecond");
    });

    it("should handle partial chunks across reads", async () => {
      // Split an SSE message across multiple chunks
      const mockChunks = [
        "data: ",
        createContentChunkData("partial"),
        "\n\n",
        DONE_CHUNK,
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
      });

      expect(result.generatedResponse).toBe("partial");
    });

    it("should handle [DONE] marker to terminate stream", async () => {
      const mockChunks = [
        createContentChunk("content"),
        DONE_CHUNK,
        createContentChunk("should not appear"),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await TTDStreamFetch({
        url: "https://api.example.com/stream",
        messages: [],
      });

      expect(result.generatedResponse).toBe("content");
    });
  });
});
