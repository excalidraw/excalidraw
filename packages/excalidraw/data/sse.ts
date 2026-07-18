export interface ParseSSEDataOptions {
  signal?: AbortSignal;
}

export interface IterateSSEJSONChunksOptions<T> {
  signal?: AbortSignal;
  ignorePayload?: (payload: string) => boolean;
  onInvalidJSON?: (payload: string, error: unknown) => void;
  parse?: (payload: string) => T;
  /**
   * Called when the stream's `[DONE]` terminator payload is received (the
   * iterator stops either way). Lets callers distinguish "the server ended
   * the stream deliberately" from "the connection was cut at EOF".
   */
  onDoneSentinel?: () => void;
}

export const extractRateLimitHeaders = (
  headers: Headers,
): {
  rateLimit?: number;
  rateLimitRemaining?: number;
} => {
  const rateLimit = headers.get("X-Ratelimit-Limit");
  const rateLimitRemaining = headers.get("X-Ratelimit-Remaining");

  return {
    rateLimit: rateLimit ? parseInt(rateLimit, 10) : undefined,
    rateLimitRemaining: rateLimitRemaining
      ? parseInt(rateLimitRemaining, 10)
      : undefined,
  };
};

export async function* parseSSEData(
  stream: ReadableStream<Uint8Array>,
  options: ParseSSEDataOptions = {},
): AsyncGenerator<string, void, unknown> {
  const { signal } = options;
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let eventDataLines: string[] = [];

  const dispatchEvent = () => {
    if (!eventDataLines.length) {
      return null;
    }

    const payload = eventDataLines.join("\n");
    eventDataLines = [];
    return payload;
  };

  const pushLine = (line: string) => {
    const normalizedLine = line.endsWith("\r") ? line.slice(0, -1) : line;

    if (normalizedLine === "") {
      return dispatchEvent();
    }

    if (normalizedLine.startsWith(":")) {
      return null;
    }

    const separatorIndex = normalizedLine.indexOf(":");
    const field =
      separatorIndex === -1
        ? normalizedLine
        : normalizedLine.slice(0, separatorIndex);

    if (field !== "data") {
      return null;
    }

    let value =
      separatorIndex === -1 ? "" : normalizedLine.slice(separatorIndex + 1);

    if (value.startsWith(" ")) {
      value = value.slice(1);
    }

    eventDataLines.push(value);
    return null;
  };

  try {
    while (true) {
      if (signal?.aborted) {
        break;
      }

      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await reader.read();
      } catch (error) {
        if (signal?.aborted) {
          break;
        }
        throw error;
      }

      const { done, value } = readResult;
      if (done) {
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const payload = pushLine(line);
        if (payload !== null) {
          yield payload;
        }
      }
    }

    if (buffer) {
      const payload = pushLine(buffer);
      if (payload !== null) {
        yield payload;
      }
    }

    const trailingPayload = dispatchEvent();
    if (trailingPayload !== null) {
      yield trailingPayload;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function* iterateSSEJSONChunks<T>(
  stream: ReadableStream<Uint8Array>,
  options: IterateSSEJSONChunksOptions<T> = {},
): AsyncGenerator<T, void, unknown> {
  const { signal, ignorePayload, onInvalidJSON, onDoneSentinel } = options;
  const parsePayload =
    options.parse ?? ((payload: string) => JSON.parse(payload) as T);

  for await (const payload of parseSSEData(stream, { signal })) {
    if (!payload) {
      continue;
    }

    if (payload === "[DONE]") {
      onDoneSentinel?.();
      break;
    }

    if (ignorePayload?.(payload)) {
      continue;
    }

    try {
      yield parsePayload(payload);
    } catch (error) {
      onInvalidJSON?.(payload, error);
    }
  }
}
