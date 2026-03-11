import { RequestError } from "@excalidraw/excalidraw/errors";

import type {
  LLMMessage,
  TTTDDialog,
} from "@excalidraw/excalidraw/components/TTDDialog/types";

interface RateLimitInfo {
  rateLimit?: number;
  rateLimitRemaining?: number;
}

interface StreamingOptions {
  url: string;
  messages: readonly LLMMessage[];
  onChunk?: (chunk: string) => void;
  extractRateLimits?: boolean;
  signal?: AbortSignal;
  onStreamCreated?: () => void;
}

export type StreamChunk =
  | {
      type: "content";
      delta: string;
    }
  | {
      type: "done";
      finishReason: "stop" | "length" | "content_filter" | "tool_calls" | null;
    }
  | {
      type: "error";
      error: {
        message: string;
        status?: number;
      };
    };

function extractRateLimitHeaders(headers: Headers): RateLimitInfo {
  const rateLimit = headers.get("X-Ratelimit-Limit");
  const rateLimitRemaining = headers.get("X-Ratelimit-Remaining");

  return {
    rateLimit: rateLimit ? parseInt(rateLimit, 10) : undefined,
    rateLimitRemaining: rateLimitRemaining
      ? parseInt(rateLimitRemaining, 10)
      : undefined,
  };
}

async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<string, void, unknown> {
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          continue;
        }

        if (trimmedLine.startsWith("data: ")) {
          const data = trimmedLine.slice(6);
          yield data;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function TTDStreamFetch(
  options: StreamingOptions,
): Promise<TTTDDialog.OnTextSubmitRetValue> {
  const {
    url,
    messages,
    onChunk,
    onStreamCreated,
    extractRateLimits = true,
    signal,
  } = options;

  try {
    let fullResponse = "";
    let rateLimitInfo: RateLimitInfo = {};
    let error: RequestError | null = null;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
      signal,
    });

    if (extractRateLimits) {
      rateLimitInfo = extractRateLimitHeaders(response.headers);
    }

    if (!response.ok) {
      if (response.status === 429) {
        return {
          ...rateLimitInfo,
          error: new RequestError({
            message: "Rate limit exceeded",
            status: 429,
          }),
        };
      }

      const text = await response.text();
      throw new RequestError({
        message: text || "Generation failed...",
        status: response.status,
      });
    }

    const reader = response.body?.getReader();

    if (!reader) {
      throw new RequestError({
        message: "Couldn't get reader from response body",
        status: 500,
      });
    }

    onStreamCreated?.();

    try {
      for await (const data of parseSSEStream(reader)) {
        if (data === "[DONE]") {
          break;
        }

        try {
          const chunk: StreamChunk = JSON.parse(data);

          if (chunk === null) {
            break;
          }

          switch (chunk.type) {
            case "content": {
              const delta = chunk.delta;
              if (delta) {
                fullResponse += delta;
                onChunk?.(delta);
              }
              break;
            }
            case "error":
              error = new RequestError({
                message: chunk.error.message,
                status: 500,
              });
              break;
            case "done":
              break;
          }
        } catch (e) {
          console.warn("Failed to parse SSE data:", data, e);
        }
      }
    } catch (streamError: any) {
      if (streamError.name === "AbortError") {
        error = new RequestError({ message: "Request aborted", status: 499 });
      } else {
        error = new RequestError({
          message: streamError.message || "Streaming error",
          status: 500,
        });
      }
    }

    if (error) {
      return {
        ...rateLimitInfo,
        error,
      };
    }

    if (!fullResponse) {
      return {
        ...rateLimitInfo,
        error: new RequestError({
          message: "Generation failed...",
          status: response.status,
        }),
      };
    }

    return {
      generatedResponse: fullResponse,
      error: null,
      ...rateLimitInfo,
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return {
        error: new RequestError({ message: "Request aborted", status: 499 }),
      };
    }
    return {
      error: new RequestError({
        message: err.message || "Request failed",
        status: 500,
      }),
    };
  }
}
