import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { streamFetch } from "./streamFetch";

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

function createSSEChunk(data: string): string {
  return `data: ${data}\n\n`;
}

describe("streamFetch", () => {
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
        createSSEChunk(JSON.stringify("Hello ")),
        createSSEChunk(JSON.stringify("world")),
        createSSEChunk("[DONE]"),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
        onChunk: (chunk) => chunks.push(chunk),
      });

      expect(result.generatedResponse).toBe("Hello world");
      expect(chunks).toEqual(["Hello ", "world"]);
      expect(result.error).toBeUndefined();
    });

    it("should handle multi-line chunks", async () => {
      const mockChunks = [
        createSSEChunk(JSON.stringify("Line 1\n")),
        createSSEChunk(JSON.stringify("Line 2")),
        createSSEChunk("[DONE]"),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
      });

      expect(result.generatedResponse).toBe("Line 1\nLine 2");
    });

    it("should call onStreamCreated callback", async () => {
      const onStreamCreated = vi.fn();
      const mockChunks = [
        createSSEChunk(JSON.stringify("test")),
        createSSEChunk("[DONE]"),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
        onStreamCreated,
      });

      expect(onStreamCreated).toHaveBeenCalledTimes(1);
    });

    it("should handle empty chunks gracefully", async () => {
      const mockChunks = [
        createSSEChunk(JSON.stringify("")),
        createSSEChunk(JSON.stringify("valid")),
        createSSEChunk("[DONE]"),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
      });

      expect(result.generatedResponse).toBe("valid");
    });

    it("should handle null chunk as stream termination", async () => {
      const mockChunks = [
        createSSEChunk(JSON.stringify("before null")),
        createSSEChunk("null"),
        createSSEChunk(JSON.stringify("after null")),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
      });

      expect(result.generatedResponse).toBe("before null");
    });
  });

  describe("rate limit handling", () => {
    it("should extract rate limit headers when enabled", async () => {
      const mockChunks = [
        createSSEChunk(JSON.stringify("test")),
        createSSEChunk("[DONE]"),
      ];

      const headers = new Headers();
      headers.set("X-Ratelimit-Limit", "100");
      headers.set("X-Ratelimit-Remaining", "95");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers,
        body: createMockStream(mockChunks),
      });

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
        extractRateLimits: true,
      });

      expect(result.rateLimit).toBe(100);
      expect(result.rateLimitRemaining).toBe(95);
    });

    it("should not extract rate limits when disabled", async () => {
      const mockChunks = [
        createSSEChunk(JSON.stringify("test")),
        createSSEChunk("[DONE]"),
      ];

      const headers = new Headers();
      headers.set("X-Ratelimit-Limit", "100");
      headers.set("X-Ratelimit-Remaining", "95");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers,
        body: createMockStream(mockChunks),
      });

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
        extractRateLimits: false,
      });

      expect(result.rateLimit).toBeUndefined();
      expect(result.rateLimitRemaining).toBeUndefined();
    });

    it("should handle missing rate limit headers", async () => {
      const mockChunks = [
        createSSEChunk(JSON.stringify("test")),
        createSSEChunk("[DONE]"),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
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

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe(
        "Too many requests today, please try again tomorrow!",
      );
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

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
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

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
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

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("No response body");
    });

    it("should handle empty response", async () => {
      const mockChunks = [createSSEChunk("[DONE]")];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Generation failed...");
    });

    it("should handle network errors", async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error("Network connection failed"));

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Network connection failed");
    });

    it("should handle invalid JSON in stream", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const mockChunks = [
        createSSEChunk("invalid json"),
        createSSEChunk(JSON.stringify("valid")),
        createSSEChunk("[DONE]"),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
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

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
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

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("Request aborted");
    });
  });

  describe("SSE parsing", () => {
    it("should handle lines without data prefix", async () => {
      const mockChunks = [
        ": comment line\n",
        createSSEChunk(JSON.stringify("valid")),
        createSSEChunk("[DONE]"),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
      });

      expect(result.generatedResponse).toBe("valid");
    });

    it("should handle empty lines in stream", async () => {
      const mockChunks = [
        createSSEChunk(JSON.stringify("first")),
        "\n\n",
        createSSEChunk(JSON.stringify("second")),
        createSSEChunk("[DONE]"),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
      });

      expect(result.generatedResponse).toBe("firstsecond");
    });

    it("should handle partial chunks across reads", async () => {
      // Split an SSE message across multiple chunks
      const mockChunks = [
        "data: ",
        JSON.stringify("partial"),
        "\n\n",
        createSSEChunk("[DONE]"),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
      });

      expect(result.generatedResponse).toBe("partial");
    });

    it("should handle [DONE] marker to terminate stream", async () => {
      const mockChunks = [
        createSSEChunk(JSON.stringify("content")),
        createSSEChunk("[DONE]"),
        createSSEChunk(JSON.stringify("should not appear")),
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream(mockChunks),
      });

      const result = await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
      });

      expect(result.generatedResponse).toBe("content");
    });
  });

  describe("request configuration", () => {
    it("should send POST request with correct headers and body", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream([
          createSSEChunk(JSON.stringify("test")),
          createSSEChunk("[DONE]"),
        ]),
      });

      global.fetch = mockFetch;

      const payload = { prompt: "test prompt", model: "gpt-4" };

      await streamFetch({
        url: "https://api.example.com/stream",
        payload,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/stream",
        expect.objectContaining({
          method: "POST",
          headers: {
            Accept: "text/event-stream",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }),
      );
    });

    it("should pass abort signal to fetch", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: createMockStream([
          createSSEChunk(JSON.stringify("test")),
          createSSEChunk("[DONE]"),
        ]),
      });

      global.fetch = mockFetch;

      const abortController = new AbortController();

      await streamFetch({
        url: "https://api.example.com/stream",
        payload: { prompt: "test" },
        signal: abortController.signal,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: abortController.signal,
        }),
      );
    });
  });
});
