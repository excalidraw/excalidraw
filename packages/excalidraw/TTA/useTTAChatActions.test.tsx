import React, { useCallback, useState } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import { useCanvasDraft } from "./useCanvasDraft";
import {
  useTTAChatActions,
  type TTAChatActions,
  type TTAChatActionsHistoryHandles,
} from "./useTTAChatActions";

import type { Dispatch, SetStateAction } from "react";

import type { t as translate } from "../i18n";
import type { AppClassProperties } from "../types";
import type { TTATransportAdapter } from "./client";
import type { ChatConversation, ChatMessage } from "./types";

const mockT = ((key: string) => key) as unknown as typeof translate;

const rectSkeleton: ExcalidrawElementSkeleton = {
  type: "rectangle",
  x: 0,
  y: 0,
  width: 10,
  height: 10,
};

const userMessage = (id: string, content: string): ChatMessage => ({
  id,
  role: "user",
  content,
  createdAt: 1,
});

const createMockApp = () => {
  let elements: unknown[] = [];

  const updateScene = vi.fn(({ elements: nextElements }) => {
    elements = nextElements;
  });
  const syncActionResult = vi.fn(({ elements: nextElements }) => {
    elements = nextElements;
  });
  const setToast = vi.fn();

  const app = {
    api: {
      updateScene,
      setToast,
    },
    files: {},
    state: {
      width: 1000,
      height: 1000,
      scrollX: 0,
      scrollY: 0,
      offsetLeft: 0,
      offsetTop: 0,
      zoom: { value: 1 },
      selectedElementIds: {},
      theme: "light",
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

  return { app, setToast, syncActionResult, updateScene };
};

const createHistoryHandles = (
  overrides?: Partial<TTAChatActionsHistoryHandles>,
): TTAChatActionsHistoryHandles => ({
  activeChatId: "",
  setActiveChatId: vi.fn(),
  setActiveChatUpdatedAt: vi.fn(),
  saveConversationToHistory: vi.fn(),
  deleteChat: vi.fn(),
  applyServerChatMetadata: vi.fn(),
  touchActiveChatUpdatedAt: vi.fn(),
  ...overrides,
});

const TestHarness = ({
  app,
  transportAdapter,
  historyHandles,
  initialMessages,
  clearComposer,
  actionsRef,
  stateLog,
}: {
  app: AppClassProperties;
  transportAdapter: TTATransportAdapter;
  historyHandles: TTAChatActionsHistoryHandles;
  initialMessages: ChatMessage[];
  clearComposer?: () => void;
  actionsRef: { current: TTAChatActions | null };
  /**
   * Receives every applied chat-state transition, including intermediate
   * ones React batches away before a render (e.g. the stopped-bubble state a
   * chat switch produces right before replacing the conversation).
   */
  stateLog?: ChatMessage[][];
}) => {
  const [stableFns] = useState(() => ({
    onRateLimitInfo: vi.fn(),
    clearComposer: vi.fn(),
    hideHistory: vi.fn(),
    scrollChatToBottom: vi.fn(),
    focusComposerInput: vi.fn(),
  }));
  const [chatMessages, setChatMessagesRaw] =
    useState<ChatMessage[]>(initialMessages);
  const setChatMessages: Dispatch<SetStateAction<ChatMessage[]>> = useCallback(
    (action) => {
      setChatMessagesRaw((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        stateLog?.push(next);
        return next;
      });
    },
    [stateLog],
  );

  const canvasDraft = useCanvasDraft({ app });

  const actions = useTTAChatActions({
    app,
    t: mockT,
    chatMessages,
    setChatMessages,
    canvasDraft,
    transportAdapter,
    history: historyHandles,
    rateLimits: null,
    onRateLimitInfo: stableFns.onRateLimitInfo,
    isPanelOpen: true,
    composerText: "",
    clearComposer: clearComposer ?? stableFns.clearComposer,
    hideHistory: stableFns.hideHistory,
    scrollChatToBottom: stableFns.scrollChatToBottom,
    focusComposerInput: stableFns.focusComposerInput,
  });
  actionsRef.current = actions;

  return (
    <pre data-testid="messages">{JSON.stringify(chatMessages, null, 2)}</pre>
  );
};

const getMessages = (): ChatMessage[] =>
  JSON.parse(screen.getByTestId("messages").textContent!);

describe("useTTAChatActions", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("ignores a second send while a generation is in flight (C1)", async () => {
    const { app } = createMockApp();
    // a stream that never terminates — the generation stays in flight
    const streamFetch = vi.fn().mockImplementation(() => new Promise(() => {}));
    const clearComposer = vi.fn();
    const actionsRef = { current: null as TTAChatActions | null };

    render(
      <TestHarness
        app={app}
        transportAdapter={{ stream: streamFetch, truncate: vi.fn() }}
        historyHandles={createHistoryHandles()}
        initialMessages={[]}
        clearComposer={clearComposer}
        actionsRef={actionsRef}
      />,
    );

    act(() => {
      actionsRef.current!.sendChatPrompt("draw a cat");
    });
    expect(streamFetch).toHaveBeenCalledTimes(1);
    expect(clearComposer).toHaveBeenCalledTimes(1);

    act(() => {
      actionsRef.current!.sendChatPrompt("draw a dog");
    });

    // no second fetch, no chat mutation, and the composer draft is preserved
    // (`clearComposer` only fires when the slot was actually acquired)
    expect(streamFetch).toHaveBeenCalledTimes(1);
    expect(clearComposer).toHaveBeenCalledTimes(1);
    const messages = getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user", content: "draw a cat" });
    expect(messages[1]).toMatchObject({
      role: "assistant",
      status: { kind: "streaming" },
    });
  });

  it("auto-stops an in-flight generation on chat switch: abort + commit + stopped bubble + freed slot (N2)", async () => {
    const { app, syncActionResult } = createMockApp();
    let capturedSignal: AbortSignal | null = null;
    const streamFetch = vi.fn().mockImplementation((options) => {
      capturedSignal = options.signal;
      // one renderable chunk so the canvas draft has something to commit
      options.onChunk?.({ skeletons: [rectSkeleton], isComplete: false });
      return new Promise(() => {});
    });
    const stateLog: ChatMessage[][] = [];
    const actionsRef = { current: null as TTAChatActions | null };

    render(
      <TestHarness
        app={app}
        transportAdapter={{ stream: streamFetch, truncate: vi.fn() }}
        historyHandles={createHistoryHandles({ activeChatId: "chat-1" })}
        initialMessages={[]}
        actionsRef={actionsRef}
        stateLog={stateLog}
      />,
    );

    act(() => {
      actionsRef.current!.sendChatPrompt("draw a cat");
    });
    expect(streamFetch).toHaveBeenCalledTimes(1);
    // the streaming preview renders uncaptured — nothing committed yet
    expect(syncActionResult).not.toHaveBeenCalledWith(
      expect.objectContaining({
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      }),
    );

    const otherChat: ChatConversation = {
      id: "chat-2",
      title: "other chat",
      updatedAt: 123,
      messages: [
        userMessage("user-b", "hello"),
        {
          id: "assistant-b",
          role: "assistant",
          createdAt: 2,
          status: { kind: "done", elapsedMs: 10, outcome: "generated" },
          skeletons: [rectSkeleton],
        },
      ],
    };
    act(() => {
      actionsRef.current!.handleSelectChat(otherChat);
    });

    // the stream was aborted
    expect(capturedSignal!.aborted).toBe(true);
    // the streaming bubble was marked stopped/interrupted (this intermediate
    // state is what the old chat's auto-save persists) before the switch
    // replaced the conversation
    expect(
      stateLog.some((state) =>
        state.some(
          (message) =>
            message.role === "assistant" &&
            message.status.kind === "stopped" &&
            message.status.reason === "interrupted",
        ),
      ),
    ).toBe(true);
    // the rendered draft was committed to the canvas like pressing Stop
    // (IMMEDIATELY-captured re-insert of the preview elements)
    expect(syncActionResult).toHaveBeenCalledWith(
      expect.objectContaining({
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      }),
    );
    // the conversation now shows the selected chat
    expect(getMessages().map((message) => message.id)).toEqual([
      "user-b",
      "assistant-b",
    ]);

    // the slot was freed — a follow-up send streams again
    act(() => {
      actionsRef.current!.sendChatPrompt("draw a dog");
    });
    expect(streamFetch).toHaveBeenCalledTimes(2);
  });

  it("omits retryAssistantMessageId when the turn never succeeded (N1)", async () => {
    const { app } = createMockApp();
    const streamFetch = vi.fn().mockResolvedValue({
      finalPayload: {
        skeletons: [],
        isComplete: true,
        chatId: "chat-1",
        turnId: "turn-1",
        messageId: "msg-1",
      },
      error: null,
    });
    const actionsRef = { current: null as TTAChatActions | null };

    render(
      <TestHarness
        app={app}
        transportAdapter={{ stream: streamFetch, truncate: vi.fn() }}
        historyHandles={createHistoryHandles({ activeChatId: "chat-1" })}
        initialMessages={[
          userMessage("user-1", "draw a cat"),
          {
            id: "assistant-1",
            role: "assistant",
            createdAt: 2,
            // failed turn with NO prior success — no lastCompletedMessageId
            status: { kind: "error", error: { message: "boom" } },
          },
        ]}
        actionsRef={actionsRef}
      />,
    );

    act(() => {
      actionsRef.current!.handleRetry("assistant-1");
    });

    // error-retry reuses the failed bubble's id (no replacement bubble)
    const messages = getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({
      id: "assistant-1",
      status: {
        kind: "streaming",
        statusText: "ai.chat.status.retrying",
      },
    });
    // the stream only starts after MIN_RETRYING_VISIBLE_MS
    expect(streamFetch).not.toHaveBeenCalled();
    await waitFor(() => expect(streamFetch).toHaveBeenCalledTimes(1), {
      timeout: 3000,
    });

    const { payload } = streamFetch.mock.calls[0][0];
    expect(payload.retry.reason).toBe("generation_error");
    expect(payload.retry.avoidSimilarity).toBe(false);
    // the server would 400 on a failed attempt's id — omit so it starts a
    // fresh turn with the explicitly-sent prompt
    expect(payload.retry.retryAssistantMessageId).toBeUndefined();
    expect(payload.prompt).toBe("draw a cat");
  });

  it("targets the turn's last successful attempt on retry after success-then-fail (N1)", async () => {
    const { app } = createMockApp();
    const streamFetch = vi.fn().mockResolvedValue({
      finalPayload: {
        skeletons: [],
        isComplete: true,
        chatId: "chat-1",
        turnId: "turn-1",
        messageId: "msg-2",
      },
      error: null,
    });
    const actionsRef = { current: null as TTAChatActions | null };

    render(
      <TestHarness
        app={app}
        transportAdapter={{ stream: streamFetch, truncate: vi.fn() }}
        historyHandles={createHistoryHandles({ activeChatId: "chat-1" })}
        initialMessages={[
          userMessage("user-1", "draw a cat"),
          {
            id: "assistant-1",
            role: "assistant",
            createdAt: 2,
            // the turn succeeded once (stamped from that attempt's `done`),
            // then a later attempt failed
            lastCompletedMessageId: "srv-msg-1",
            status: { kind: "error", error: { message: "boom" } },
          },
        ]}
        actionsRef={actionsRef}
      />,
    );

    act(() => {
      actionsRef.current!.handleRetry("assistant-1");
    });
    await waitFor(() => expect(streamFetch).toHaveBeenCalledTimes(1), {
      timeout: 3000,
    });

    const { payload } = streamFetch.mock.calls[0][0];
    expect(payload.retry.reason).toBe("generation_error");
    // the last *successful* attempt's id — the only id the server's retry
    // lookup accepts
    expect(payload.retry.retryAssistantMessageId).toBe("srv-msg-1");
  });

  it("keeps the optimistic local truncate and surfaces a toast when the server truncate fails (M5)", async () => {
    const { app, setToast } = createMockApp();
    const truncate = vi.fn().mockRejectedValue(new Error("boom"));
    const actionsRef = { current: null as TTAChatActions | null };

    render(
      <TestHarness
        app={app}
        transportAdapter={{ stream: vi.fn(), truncate }}
        historyHandles={createHistoryHandles({ activeChatId: "chat-1" })}
        initialMessages={[
          userMessage("user-1", "draw a cat"),
          {
            id: "assistant-1",
            role: "assistant",
            createdAt: 2,
            server: { turnId: "turn-1", messageId: "srv-msg-1" },
            skeletons: [rectSkeleton],
            status: { kind: "done", elapsedMs: 10, outcome: "generated" },
          },
          userMessage("user-2", "add a dog"),
          {
            id: "assistant-2",
            role: "assistant",
            createdAt: 4,
            server: { turnId: "turn-2", messageId: "srv-msg-2" },
            status: { kind: "done", elapsedMs: 10, outcome: "generated" },
          },
        ]}
        actionsRef={actionsRef}
      />,
    );

    await act(async () => {
      await actionsRef.current!.executeDelete("assistant-2");
    });

    expect(truncate).toHaveBeenCalledWith({
      chatId: "chat-1",
      keepThroughTurnId: "turn-1",
    });
    // the local truncate proceeded despite the server failure
    expect(getMessages().map((message) => message.id)).toEqual([
      "user-1",
      "assistant-1",
    ]);
    // ...and the failure is user-visible (M5) instead of a silent warn
    expect(setToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "ai.chat.errors.deleteFailed" }),
    );
  });
});
