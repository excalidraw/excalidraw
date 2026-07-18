import { extractRateLimitHeaders, iterateSSEJSONChunks } from "../data/sse";

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
  revision: number;
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

  return (await response.json()) as AIChatTruncateResponse;
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

    for await (const event of iterateSSEJSONChunks<StreamChunk>(stream, {
      signal,
      ignorePayload: (rawPayload) => /^\[ai-server\]/i.test(rawPayload.trim()),
      onInvalidJSON: (rawPayload) => {
        console.warn("AI Client: Failed to parse JSON payload", rawPayload);
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
            isComplete: false,
          });
          break;
        case "done":
          if (event.chatId && event.chatId !== startedPayload?.chatId) {
            const nextTurnId = event.turnId ?? startedPayload?.turnId;
            const nextMessageId = event.messageId ?? startedPayload?.messageId;
            if (nextTurnId && nextMessageId) {
              startedPayload = {
                chatId: event.chatId,
                turnId: nextTurnId,
                messageId: nextMessageId,
                lifecycleStatus: "pending",
                ...(typeof event.updatedAt === "number"
                  ? { updatedAt: event.updatedAt }
                  : {}),
              };
              onStarted?.(startedPayload);
            }
          }
          return {
            ...rateLimitInfo,
            finalPayload: {
              skeletons: event.skeletons ?? [],
              isComplete: true,
              chatId: event.chatId ?? startedPayload?.chatId,
              turnId: event.turnId ?? startedPayload?.turnId,
              messageId: event.messageId ?? startedPayload?.messageId,
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

    return {
      ...rateLimitInfo,
      finalPayload: {
        skeletons: [],
        isComplete: true,
        chatId: startedPayload?.chatId,
        turnId: startedPayload?.turnId,
        messageId: startedPayload?.messageId,
      },
      error: null,
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
