import { extractRateLimitHeaders, iterateSSEJSONChunks } from "../data/sse";

import { AI_CLIENT_ERRORS } from "./utils";

import type {
  AIAssistantLifecycleStatus,
  AIGenerateRequestPayload,
  StreamChunk,
  AIStreamFinalPayload,
  AIStreamMessagePayload,
  AIStreamPartialPayload,
  AIStreamStartedPayload,
  AI_ERROR_CODE,
} from "./types";

type AIClientError = Error & {
  code?: AI_ERROR_CODE | number;
};

const getErrorCode = (error: unknown): AI_ERROR_CODE | number | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === "number" ? maybeCode : undefined;
};

const withErrorCode = (
  error: Error,
  code?: AI_ERROR_CODE | number,
): AIClientError => {
  const typedError = error as AIClientError;
  if (typeof code === "number") {
    typedError.code = code;
  }
  return typedError;
};

const parseErrorResponseMessage = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  const jsonPayload = await response
    .clone()
    .json()
    .catch(() => null as { error?: string } | null);
  if (jsonPayload?.error) {
    return jsonPayload.error;
  }

  const textPayload = await response.text().catch(() => "");
  return textPayload || fallback;
};

const createHttpStatusError = async (
  response: Response,
  fallback: string,
): Promise<AIClientError> => {
  const message = await parseErrorResponseMessage(response, fallback);
  return withErrorCode(new Error(message), response.status);
};

export type AIChatTruncateRequest = {
  chatId: string;
  keepThroughTurnId?: string | null;
};

export type AIChatTruncateResponse = {
  ok: boolean;
  chatId: string;
  updatedAt?: number;
};

export interface TTAStreamFetchRequest {
  method: "POST";
  headers: {
    "Content-Type": "application/json";
    Accept: "text/event-stream";
  };
  payload: AIGenerateRequestPayload;
  signal?: AbortSignal;
}

export type TTAStreamResponseFetch = (
  request: TTAStreamFetchRequest,
) => Promise<Response>;

export interface TTATruncateFetchRequest {
  method: "POST";
  headers: {
    "Content-Type": "application/json";
  };
  payload: AIChatTruncateRequest;
}

export type TTATruncateResponseFetch = (
  request: TTATruncateFetchRequest,
) => Promise<Response>;

export const truncateChat = async (
  payload: AIChatTruncateRequest,
  options: {
    fetch: TTATruncateResponseFetch;
  },
): Promise<AIChatTruncateResponse> => {
  const response = await options.fetch({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    payload,
  });

  if (!response.ok) {
    throw await createHttpStatusError(
      response,
      `AI server request failed with status ${response.status}`,
    );
  }

  const data = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!data || typeof data.chatId !== "string") {
    throw withErrorCode(
      new Error("AI server returned an invalid truncate response"),
      500,
    );
  }
  return {
    ok: Boolean(data.ok),
    chatId: data.chatId,
    ...(typeof data.updatedAt === "number"
      ? { updatedAt: data.updatedAt }
      : {}),
  };
};

export interface TTAStreamFetchOptions {
  payload: AIGenerateRequestPayload;
  onStarted?: (payload: AIStreamStartedPayload) => void;
  onMessage?: (payload: AIStreamMessagePayload) => void;
  onChunk?: (payload: AIStreamPartialPayload) => void;
  signal?: AbortSignal;
  onStreamCreated?: () => void;
  fetch: TTAStreamResponseFetch;
}

export type TTAStreamError = {
  code?: AI_ERROR_CODE | number;
  message: string;
  lifecycleStatus?: Extract<AIAssistantLifecycleStatus, "failed" | "aborted">;
};

export type TTAStreamFetchResult = {
  rateLimit?: number | null;
  rateLimitRemaining?: number | null;
} & (
  | {
      finalPayload: AIStreamFinalPayload;
      error: null;
    }
  | {
      error: TTAStreamError;
      finalPayload?: null;
    }
);

export interface TTATransportAdapter {
  stream(
    options: Omit<TTAStreamFetchOptions, "fetch">,
  ): Promise<TTAStreamFetchResult>;
  truncate(payload: AIChatTruncateRequest): Promise<AIChatTruncateResponse>;
}

export interface TTADefaultTransportAdapterConfig {
  stream: TTAStreamResponseFetch;
  truncate: TTATruncateResponseFetch;
}

/**
 * After a terminal `done`/`error` chunk the response body still holds a few
 * unread frames (the `[DONE]` sentinel, then EOF). Read them so the stream
 * completes instead of being abandoned mid-body — an abandoned body forces
 * the browser to tear down the connection, while a drained one can return to
 * the keep-alive pool. Detached and bounded: the result is resolved before
 * this runs, and a server that doesn't close promptly gets cancelled after
 * the deadline (the old behavior).
 *
 * NOTE this does NOT silence the `net::ERR_ABORTED` annotation DevTools
 * attaches to these requests — verified empirically that Chrome logs it for
 * cross-origin SSE fetches even when the body is read fully to EOF.
 */
const drainStreamToEof = (body: ReadableStream<Uint8Array>) => {
  void (async () => {
    try {
      // the for-await teardown releases the SSE parser's reader lock
      // asynchronously — wait briefly for it
      for (let i = 0; i < 10 && body.locked; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      if (body.locked) {
        return;
      }
      const reader = body.getReader();
      const deadline = setTimeout(() => {
        reader.cancel().catch(() => {});
      }, 2_000);
      while (!(await reader.read()).done) {
        // discard trailing frames
      }
      clearTimeout(deadline);
    } catch {
      // teardown races are fine — nothing user-visible depends on the drain
    }
  })();
};

const toStreamError = (
  message: string,
  code?: AI_ERROR_CODE | number,
  lifecycleStatus?: Extract<AIAssistantLifecycleStatus, "failed" | "aborted">,
): TTAStreamError => ({
  message,
  code,
  ...(lifecycleStatus ? { lifecycleStatus } : {}),
});

export const TTAStreamFetch = async (
  options: TTAStreamFetchOptions,
): Promise<TTAStreamFetchResult> => {
  const {
    payload,
    onStarted,
    onMessage,
    onChunk,
    onStreamCreated,
    signal,
    fetch: streamFetch,
  } = options;

  try {
    const response = await streamFetch({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      payload,
      signal,
    });

    const rateLimitInfo = extractRateLimitHeaders(response.headers);

    if (!response.ok) {
      return {
        ...rateLimitInfo,
        error: toStreamError(
          await parseErrorResponseMessage(
            response,
            `AI server streaming request failed with status ${response.status}`,
          ),
          response.status,
        ),
      };
    }

    const stream = response.body;

    if (!stream) {
      return {
        ...rateLimitInfo,
        error: toStreamError("Couldn't get reader from response body", 500),
      };
    }

    onStreamCreated?.();
    let startedPayload: AIStreamStartedPayload | null = null;
    let receivedDoneSentinel = false;

    for await (const event of iterateSSEJSONChunks<StreamChunk>(stream, {
      signal,
      onInvalidJSON: (rawPayload) => {
        console.warn("AI Client: Failed to parse JSON payload", rawPayload);
      },
      onDoneSentinel: () => {
        receivedDoneSentinel = true;
      },
    })) {
      switch (event.type) {
        case "started":
          startedPayload = {
            chatId: event.chatId,
            turnId: event.turnId,
            messageId: event.messageId,
            ...(event.lifecycleStatus
              ? { lifecycleStatus: event.lifecycleStatus }
              : {}),
            ...(typeof event.updatedAt === "number"
              ? { updatedAt: event.updatedAt }
              : {}),
          };
          onStarted?.(startedPayload);
          break;
        case "message":
          onMessage?.({ message: event.message });
          break;
        case "partial":
          onChunk?.({
            skeletons: event.skeletons ?? [],
            isComplete: event.isComplete ?? false,
          });
          break;
        case "done":
          drainStreamToEof(stream);
          return {
            ...rateLimitInfo,
            finalPayload: {
              skeletons: event.skeletons ?? [],
              isComplete: true,
              chatId: event.chatId ?? startedPayload?.chatId,
              turnId: event.turnId ?? startedPayload?.turnId,
              messageId: event.messageId ?? startedPayload?.messageId,
              finishReason: event.finishReason,
              ...(event.lifecycleStatus
                ? { lifecycleStatus: event.lifecycleStatus }
                : {}),
              ...(typeof event.updatedAt === "number"
                ? { updatedAt: event.updatedAt }
                : {}),
            },
            error: null,
          };
        case "error":
          drainStreamToEof(stream);
          return {
            ...rateLimitInfo,
            error: toStreamError(
              event.error.message ?? "AI streaming error",
              event.error.code,
              event.lifecycleStatus ?? "failed",
            ),
          };
      }
    }

    if (signal?.aborted) {
      return {
        ...rateLimitInfo,
        error: toStreamError("Request aborted", 499, "aborted"),
      };
    }

    // Every deliberately-ended generation terminates with a `done` or `error`
    // chunk (the success path additionally appends a `[DONE]` sentinel — see
    // StreamingResponse.end() server-side). Reaching EOF without one means
    // the stream was cut (proxy idle timeout, server restart, network blip).
    // Never fabricate an empty success here: it would overwrite the streamed
    // partial skeletons and wipe the canvas preview (C2 in tta.md).
    return {
      ...rateLimitInfo,
      error: toStreamError(
        receivedDoneSentinel
          ? "The AI server ended the stream without a result"
          : "Connection interrupted before the response completed",
        AI_CLIENT_ERRORS.STREAM_INTERRUPTED,
        "failed",
      ),
    };
  } catch (error) {
    if ((error as { name?: string }).name === "AbortError" || signal?.aborted) {
      return {
        error: toStreamError("Request aborted", 499, "aborted"),
      };
    }

    return {
      error: toStreamError(
        error instanceof Error ? error.message : "AI streaming failed",
        getErrorCode(error),
      ),
    };
  }
};

export class TTADefaultTransportAdapter implements TTATransportAdapter {
  constructor(private readonly config: TTADefaultTransportAdapterConfig) {}

  stream: TTATransportAdapter["stream"] = async (options) => {
    return TTAStreamFetch({
      ...options,
      fetch: this.config.stream,
    });
  };

  truncate: TTATransportAdapter["truncate"] = async (payload) => {
    return truncateChat(payload, {
      fetch: this.config.truncate,
    });
  };
}
