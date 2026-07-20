import { describe, expect, it, vi } from "vitest";

import { iterateSSEJSONChunks, parseSSEData } from "./sse";

function createMockStream(
  chunks: Array<string | Uint8Array>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }

      const chunk = chunks[index];
      controller.enqueue(
        typeof chunk === "string" ? encoder.encode(chunk) : chunk,
      );
      index++;
    },
  });
}

async function readAllPayloads(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
) {
  const payloads: string[] = [];

  for await (const payload of parseSSEData(stream, { signal })) {
    payloads.push(payload);
  }

  return payloads;
}

describe("parseSSEData", () => {
  it("joins multiple data lines into one SSE event payload", async () => {
    const payloads = await readAllPayloads(
      createMockStream(["data: first\ndata: second\n\n"]),
    );

    expect(payloads).toEqual(["first\nsecond"]);
  });

  it("accepts data lines without a space after the colon", async () => {
    const payloads = await readAllPayloads(
      createMockStream(['data:{"type":"content","delta":"ok"}\n\n']),
    );

    expect(payloads).toEqual(['{"type":"content","delta":"ok"}']);
  });

  it("flushes a final unterminated event when the stream ends", async () => {
    const payloads = await readAllPayloads(
      createMockStream(['data: {"type":"content","delta":"tail"}']),
    );

    expect(payloads).toEqual(['{"type":"content","delta":"tail"}']);
  });

  it("preserves UTF-8 characters split across stream reads", async () => {
    const bytes = new TextEncoder().encode('data: {"value":"ž"}\n\n');
    const splitIndex = bytes.length - 4;
    const payloads = await readAllPayloads(
      createMockStream([bytes.slice(0, splitIndex), bytes.slice(splitIndex)]),
    );

    expect(payloads).toEqual(['{"value":"ž"}']);
  });

  it("ignores comments and unsupported SSE fields", async () => {
    const payloads = await readAllPayloads(
      createMockStream([
        ": keep-alive\n",
        "event: update\n",
        "id: 1\n",
        "data: useful\n\n",
      ]),
    );

    expect(payloads).toEqual(["useful"]);
  });
});

describe("iterateSSEJSONChunks", () => {
  it("parses JSON payloads and stops on the DONE marker", async () => {
    const chunks: Array<{ value: string }> = [];

    for await (const chunk of iterateSSEJSONChunks<{ value: string }>(
      createMockStream([
        'data: {"value":"first"}\n\n',
        "data: [DONE]\n\n",
        'data: {"value":"second"}\n\n',
      ]),
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([{ value: "first" }]);
  });

  it("supports custom ignored payloads without warning", async () => {
    const invalidJSONSpy = vi.fn();
    const chunks: Array<{ value: string }> = [];

    for await (const chunk of iterateSSEJSONChunks<{ value: string }>(
      createMockStream([
        "data: [ai-server] debug line\n\n",
        'data: {"value":"kept"}\n\n',
      ]),
      {
        ignorePayload: (payload) => /^\[ai-server\]/i.test(payload.trim()),
        onInvalidJSON: invalidJSONSpy,
      },
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([{ value: "kept" }]);
    expect(invalidJSONSpy).not.toHaveBeenCalled();
  });
});
