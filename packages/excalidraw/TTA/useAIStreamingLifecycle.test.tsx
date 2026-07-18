import React, { useEffect, useRef, useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAIStreamingLifecycle } from "./useAIStreamingLifecycle";

import type { TTAStreamFetchResult } from "./client";
import type { ChatMessage } from "./types";
import type { AppClassProperties } from "../types";

const createMockApp = () =>
  ({
    api: {
      updateScene: vi.fn(),
    },
    scene: {
      getNonDeletedElements: () => [],
      getElementsIncludingDeleted: () => [],
    },
    syncActionResult: vi.fn(),
  } as unknown as AppClassProperties);

const t = ((key: string) => key) as any;

const TestHarness = ({
  streamResult,
  streamFetch: streamFetchProp,
  onRateLimitInfo,
}: {
  streamResult?: TTAStreamFetchResult;
  streamFetch?: ReturnType<typeof vi.fn>;
  onRateLimitInfo: (rateLimitInfo: {
    rateLimit?: number | null;
    rateLimitRemaining?: number | null;
  }) => void;
}) => {
  const [app] = useState(createMockApp);
  const [streamFetch] = useState(
    () => streamFetchProp ?? vi.fn().mockResolvedValue(streamResult),
  );
  const [applyServerChatMetadata] = useState(() => vi.fn());
  const [removeGeneratedElementsByMessageId] = useState(() => vi.fn());
  const [commitQueuedGenerationReplacements] = useState(() => vi.fn());
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
      isComplete: false,
    },
  ]);

  const lifecycle = useAIStreamingLifecycle({
    app,
    chatMessages,
    t,
    setChatMessages,
    applyServerChatMetadata,
    removeGeneratedElementsByMessageId,
    commitQueuedGenerationReplacements,
    streamFetch,
    onRateLimitInfo,
  });
  const { generateResponse } = lifecycle;

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
      isComplete: true,
      turnId: "turn-1",
      messageId: "message-1",
      generationElapsedMs: expect.any(Number),
    });
    expect(messages[2]).toMatchObject({
      role: "assistant",
      isComplete: true,
      warningType: "messageLimitExceeded",
      error: {
        code: 429,
        rateLimit: 100,
        rateLimitRemaining: 0,
      },
    });
  });

  it("keeps streamed partial skeletons on the message when the stream is interrupted", async () => {
    const onRateLimitInfo = vi.fn();
    const skeleton = { type: "rectangle", x: 0, y: 0, width: 10, height: 10 };
    const streamFetch = vi.fn().mockImplementation(async (options) => {
      // Deliberately no onStarted: activeMessageId stays null, which skips the
      // canvas-preview path — this test pins message-state behavior only.
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
      expect(messages[1].isComplete).toBe(true);
    });

    const messages = JSON.parse(screen.getByTestId("messages").textContent!);
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({
      id: "assistant-1",
      role: "assistant",
      isComplete: true,
      lifecycleStatus: "failed",
      skeletons: [skeleton],
      error: { code: 1002 },
    });
  });
});
