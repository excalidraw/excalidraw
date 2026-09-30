/** Minimal Server-Sent-Events reader for provider streams (fetch Response body). */
export interface SseEvent {
  event: string | null;
  data: string;
}

export async function* readSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event: string | null = null;
  let data: string[] = [];
  const flush = (): SseEvent | null => {
    if (data.length === 0) {
      event = null;
      return null;
    }
    const out = { event, data: data.join("\n") };
    event = null;
    data = [];
    return out;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.search(/\r?\n/)) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(buffer[nl] === "\r" ? nl + 2 : nl + 1);
        if (line === "") {
          const ev = flush();
          if (ev) {
            yield ev;
          }
        } else if (line.startsWith("data:")) {
          data.push(line.slice(5).replace(/^ /, ""));
        } else if (line.startsWith("event:")) {
          event = line.slice(6).trim();
        }
      }
    }
    if (buffer.startsWith("data:")) {
      data.push(buffer.slice(5).replace(/^ /, ""));
    }
    const last = flush();
    if (last) {
      yield last;
    }
  } finally {
    reader.releaseLock();
  }
}
