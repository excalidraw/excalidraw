import React, { useEffect, useRef, useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAIStreamingLifecycle } from "./useAIStreamingLifecycle";
import { useCanvasDraft } from "./useCanvasDraft";

import type { TTAStreamFetchResult } from "./client";
import type { AssistantMessage, ChatMessage } from "./types";
import type { AppClassProperties } from "../types";

const streamingStatusOf = (message: AssistantMessage) => {
  if (message.status.kind !== "streaming") {
    throw new Error(
      `expected a streaming status, got "${message.status.kind}"`,
    );
  }
  return message.status;
};

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((_resolve) => {
    resolve = _resolve;
  });
  return { promise, resolve };
};

const createMockApp = () => {
  let elements: unknown[] = [];

  const updateScene = vi.fn(({ elements: nextElements }) => {
    elements = nextElements;
  });
  const syncActionResult = vi.fn(({ elements: nextElements }) => {
    elements = nextElements;
  });

  return {
    api: {
      updateScene,
    },
    state: {
      width: 1000,
      height: 1000,
      scrollX: 0,
      scrollY: 0,
      offsetLeft: 0,
      offsetTop: 0,
      zoom: { value: 1 },
      selectedElementIds: {},
    },
    scene: {
      getNonDeletedElements: () =>
        elements.filter(
          (element) => !(element as { isDeleted?: boolean }).isDeleted,
        ),
      getElementsIncludingDeleted: () => elements,
    },
    syncActionResult,
  } as unknown as AppClassProperties;
};

const TestHarness = ({
  streamResult,
  streamFetch: streamFetchProp,
  onRateLimitInfo,
  onMessagesChange,
}: {
  streamResult?: TTAStreamFetchResult;
  streamFetch?: ReturnType<typeof vi.fn>;
  onRateLimitInfo: (rateLimitInfo: {
    rateLimit?: number | null;
    rateLimitRemaining?: number | null;
  }) => void;
  /** Receives the raw (non-serialized) message array on every change. */
  onMessagesChange?: (messages: ChatMessage[]) => void;
}) => {
  const [app] = useState(createMockApp);
  const [streamFetch] = useState(
    () => streamFetchProp ?? vi.fn().mockResolvedValue(streamResult),
  );
  const [applyServerChatMetadata] = useState(() => vi.fn());
  const didGenerateRef = useRef(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "user-1",
      role: "user",
      content: "hello",
      createdAt: 1,
    },
    {
      id: "assistant-1",
      role: "assistant",
      createdAt: 2,
      status: { kind: "streaming", phase: "starting", startedAt: 2 },
    },
  ]);

  const canvasDraft = useCanvasDraft({ app });

  const lifecycle = useAIStreamingLifecycle({
    chatMessages,
    setChatMessages,
    applyServerChatMetadata,
    canvasDraft,
    streamFetch,
    onRateLimitInfo,
  });
  const { generateResponse } = lifecycle;

  useEffect(() => {
    onMessagesChange?.(chatMessages);
  }, [chatMessages, onMessagesChange]);

  useEffect(() => {
    if (didGenerateRef.current) {
      return;
    }
    didGenerateRef.current = true;
    void generateResponse("assistant-1", { prompt: "hello" });
  }, [generateResponse]);

  return (
    <pre data-testid="messages">{JSON.stringify(chatMessages, null, 2)}</pre>
  );
};

describe("useAIStreamingLifecycle", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("adds a rate-limit warning when a successful response exhausts the quota", async () => {
    const onRateLimitInfo = vi.fn();

    render(
      <TestHarness
        onRateLimitInfo={onRateLimitInfo}
        streamResult={{
          rateLimit: 100,
          rateLimitRemaining: 0,
          finalPayload: {
            skeletons: [],
            isComplete: true,
            chatId: "chat-1",
            turnId: "turn-1",
            messageId: "message-1",
            lifecycleStatus: "completed",
          },
          error: null,
        }}
      />,
    );

    await waitFor(() => {
      expect(
        JSON.parse(screen.getByTestId("messages").textContent!),
      ).toHaveLength(3);
    });

    const messages = JSON.parse(screen.getByTestId("messages").textContent!);

    expect(onRateLimitInfo).toHaveBeenCalledWith({
      rateLimit: 100,
      rateLimitRemaining: 0,
    });
    expect(messages).toHaveLength(3);
    expect(messages[1]).toMatchObject({
      id: "assistant-1",
      role: "assistant",
      server: { turnId: "turn-1", messageId: "message-1" },
      lastCompletedMessageId: "message-1",
      status: {
        kind: "done",
        outcome: "empty",
        elapsedMs: expect.any(Number),
      },
    });
    // session-scoped system warning bubble — the rate-limit numbers live in
    // the rate-limits atom, not on the message
    expect(messages[2]).toMatchObject({
      role: "system",
      variant: "messageLimitExceeded",
    });
  });

  it("keeps the streaming label until the status genuinely changes (keep-alive chunks are no-ops)", async () => {
    const skeleton = { type: "rectangle", x: 0, y: 0, width: 10, height: 10 };
    const statusText = "Something went wrong. Retrying...";
    const keepAliveGate = deferred();
    const contentGate = deferred();
    const doneGate = deferred();
    const streamFetch = vi.fn().mockImplementation(async (options) => {
      options.onStarted?.({
        chatId: "chat-1",
        turnId: "turn-1",
        messageId: "message-1",
      });
      await keepAliveGate.promise;
      // empty keep-alive frames around a server `message` frame — the server
      // emits these continuously, and they must not replace the status
      // object (no-op) nor wipe the label
      options.onChunk?.({ skeletons: [], isComplete: false });
      options.onChunk?.({ skeletons: [], isComplete: false });
      options.onMessage?.({ message: statusText });
      options.onChunk?.({ skeletons: [], isComplete: false });
      await contentGate.promise;
      // real content — the label downgrade is legitimate progress
      options.onChunk?.({ skeletons: [skeleton], isComplete: false });
      await doneGate.promise;
      return {
        finalPayload: {
          skeletons: [skeleton],
          isComplete: true,
          chatId: "chat-1",
          turnId: "turn-1",
          messageId: "message-1",
        },
        error: null,
      };
    });

    const snapshots: ChatMessage[][] = [];
    render(
      <TestHarness
        onRateLimitInfo={vi.fn()}
        streamFetch={streamFetch}
        onMessagesChange={(messages) => snapshots.push(messages)}
      />,
    );

    await waitFor(() => {
      const messages = JSON.parse(screen.getByTestId("messages").textContent!);
      expect(messages[1].status).toMatchObject({
        kind: "streaming",
        phase: "generating",
      });
    });
    const startedAt = streamingStatusOf(
      snapshots.at(-1)![1] as AssistantMessage,
    ).startedAt;

    keepAliveGate.resolve();

    // the server statusText set between keep-alive chunks survives them
    await waitFor(() => {
      const messages = JSON.parse(screen.getByTestId("messages").textContent!);
      expect(messages[1].status).toMatchObject({
        kind: "streaming",
        phase: "finalizing",
        statusText,
      });
    });

    // the unlabeled keep-alives before the `message` frame were complete
    // no-ops: every "generating, no label" render shares one message object
    const unlabeledGenerating = snapshots
      .map((messages) => messages[1] as AssistantMessage)
      .filter(
        (message) =>
          message.status.kind === "streaming" &&
          message.status.phase === "generating" &&
          !message.status.statusText,
      );
    expect(unlabeledGenerating.length).toBeGreaterThan(0);
    expect(new Set(unlabeledGenerating).size).toBe(1);
    // startedAt never resets mid-stream — the elapsed ticker depends on it
    expect(
      streamingStatusOf(snapshots.at(-1)![1] as AssistantMessage).startedAt,
    ).toBe(startedAt);

    contentGate.resolve();

    // a renderable chunk is a real change: back to the unlabeled generating
    // phase, with the partial skeletons on the message
    await waitFor(() => {
      const messages = JSON.parse(screen.getByTestId("messages").textContent!);
      expect(messages[1].skeletons).toEqual([skeleton]);
      expect(messages[1].status).toMatchObject({
        kind: "streaming",
        phase: "generating",
      });
      expect(messages[1].status.statusText).toBeUndefined();
    });

    doneGate.resolve();

    await waitFor(() => {
      const messages = JSON.parse(screen.getByTestId("messages").textContent!);
      expect(messages[1].status).toMatchObject({
        kind: "done",
        outcome: "generated",
      });
    });
  });

  it("keeps streamed partial skeletons on the message when the stream is interrupted", async () => {
    const onRateLimitInfo = vi.fn();
    const skeleton = { type: "rectangle", x: 0, y: 0, width: 10, height: 10 };
    const streamFetch = vi.fn().mockImplementation(async (options) => {
      // Deliberately no onStarted: the canvas draft is keyed by the LOCAL
      // generation id, so the chunk renders even before `started` arrives.
      options.onChunk?.({ skeletons: [skeleton], isComplete: false });
      return {
        error: {
          code: 1002,
          message: "Connection interrupted before the response completed",
          lifecycleStatus: "failed",
        },
      };
    });

    render(
      <TestHarness
        onRateLimitInfo={onRateLimitInfo}
        streamFetch={streamFetch}
      />,
    );

    await waitFor(() => {
      const messages = JSON.parse(screen.getByTestId("messages").textContent!);
      expect(messages[1].status.kind).toBe("error");
    });

    const messages = JSON.parse(screen.getByTestId("messages").textContent!);
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({
      id: "assistant-1",
      role: "assistant",
      skeletons: [skeleton],
      status: {
        kind: "error",
        elapsedMs: expect.any(Number),
        error: { code: 1002 },
      },
    });
  });
});
