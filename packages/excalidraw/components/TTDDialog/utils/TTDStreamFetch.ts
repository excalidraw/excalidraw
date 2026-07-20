import {
  extractRateLimitHeaders,
  iterateSSEJSONChunks,
} from "../../../data/sse";
import { RequestError } from "../../../errors";

import type { LLMMessage, TTDTransportAdapter, TTTDDialog } from "../types";

export interface TTDStreamFetchRequest {
  method: "POST";
  headers: {
    Accept: "text/event-stream";
    "Content-Type": "application/json";
  };
  payload: {
    messages: readonly LLMMessage[];
  };
  signal?: AbortSignal;
}

export type TTDStreamResponseFetch = (
  request: TTDStreamFetchRequest,
) => Promise<Response>;

export interface TTDStreamFetchOptions {
  messages: readonly LLMMessage[];
  onChunk?: (chunk: string) => void;
  signal?: AbortSignal;
  onStreamCreated?: () => void;
  fetch: TTDStreamResponseFetch;
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

export interface TTDTransportAdapterConfig {
  stream: TTDStreamResponseFetch;
}

export class TTDDefaultTransportAdapter implements TTDTransportAdapter {
  constructor(private readonly config: TTDTransportAdapterConfig) {}

  stream: TTDTransportAdapter["stream"] = async (options) => {
    return TTDStreamFetch({
      ...options,
      fetch: this.config.stream,
    });
  };
}

export async function TTDStreamFetch(
  options: TTDStreamFetchOptions,
): Promise<TTTDDialog.OnTextSubmitRetValue> {
  const {
    messages,
    onChunk,
    onStreamCreated,
    signal,
    fetch: streamFetch,
  } = options;

  try {
    let fullResponse = "";
    const rateLimitInfo = extractRateLimitHeaders(new Headers());
    let error: RequestError | null = null;

    const response = await streamFetch({
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      payload: {
        messages,
      },
      signal,
    });

    Object.assign(rateLimitInfo, extractRateLimitHeaders(response.headers));

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

    const stream = response.body;

    if (!stream) {
      throw new RequestError({
        message: "Couldn't get reader from response body",
        status: 500,
      });
    }

    onStreamCreated?.();

    try {
      for await (const chunk of iterateSSEJSONChunks<StreamChunk | null>(
        stream,
        {
          onInvalidJSON: (payload, parseError) => {
            console.warn("Failed to parse SSE data:", payload, parseError);
          },
        },
      )) {
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
