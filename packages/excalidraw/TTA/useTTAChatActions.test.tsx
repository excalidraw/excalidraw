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

/** The switch target used by the backgrounding tests. */
const otherChat = (): ChatConversation => ({
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
  saveBackgroundChat: vi.fn(),
  deleteChat: vi.fn(),
  applyServerChatMetadata: vi.fn(),
  touchActiveChatUpdatedAt: vi.fn(),
  touchChatUpdatedAt: vi.fn(),
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

  // Live active-chat pointer: `setActiveChatId` updates it (and still records
  // the call on the provided mock) so switch/delete flows observe the same
  // pointer the real history hook would expose.
  const [activeChatId, setActiveChatIdState] = useState(
    historyHandles.activeChatId,
  );
  const history: TTAChatActionsHistoryHandles = {
    ...historyHandles,
    activeChatId,
    setActiveChatId: ((update: string) => {
      historyHandles.setActiveChatId(update);
      setActiveChatIdState(update);
    }) as TTAChatActionsHistoryHandles["setActiveChatId"],
  };

  const actions = useTTAChatActions({
    app,
    t: mockT,
    chatMessages,
    setChatMessages,
    canvasDraft,
    transportAdapter,
    history,
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

  it("continues an in-flight generation in the background on chat switch and rejoins it live on switch back", async () => {
    const { app, syncActionResult } = createMockApp();
    let capturedOptions: any = null;
    const streamFetch = vi.fn().mockImplementation((options) => {
      capturedOptions = options;
      // one renderable chunk while the chat is still displayed
      options.onChunk?.({ skeletons: [rectSkeleton], isComplete: false });
      return new Promise(() => {});
    });
    const actionsRef = { current: null as TTAChatActions | null };

    render(
      <TestHarness
        app={app}
        transportAdapter={{ stream: streamFetch, truncate: vi.fn() }}
        historyHandles={createHistoryHandles({ activeChatId: "chat-1" })}
        initialMessages={[]}
        actionsRef={actionsRef}
      />,
    );

    act(() => {
      actionsRef.current!.sendChatPrompt("draw a cat");
    });
    expect(streamFetch).toHaveBeenCalledTimes(1);

    act(() => {
      actionsRef.current!.handleSelectChat(otherChat());
    });

    // the stream survives the switch (no auto-stop, no abort) and nothing
    // was committed to the canvas Stop-style
    expect(capturedOptions.signal.aborted).toBe(false);
    expect(syncActionResult).not.toHaveBeenCalledWith(
      expect.objectContaining({
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      }),
    );
    // the displayed conversation is the selected chat
    expect(getMessages().map((message) => message.id)).toEqual([
      "user-b",
      "assistant-b",
    ]);

    // background chunks land in the buffer — the displayed list is untouched
    act(() => {
      capturedOptions.onChunk?.({
        skeletons: [rectSkeleton, rectSkeleton],
        isComplete: false,
      });
    });
    expect(getMessages().map((message) => message.id)).toEqual([
      "user-b",
      "assistant-b",
    ]);

    // switch back mid-stream: the buffered conversation (with the live
    // streaming bubble and the chunks received in the background) is
    // displayed again, without interrupted-normalization
    act(() => {
      actionsRef.current!.handleSelectChat({
        id: "chat-1",
        title: "origin chat",
        updatedAt: 1,
        messages: [],
      });
    });
    const rejoined = getMessages();
    expect(rejoined).toHaveLength(2);
    expect(rejoined[0]).toMatchObject({ role: "user", content: "draw a cat" });
    expect(rejoined[1]).toMatchObject({
      role: "assistant",
      status: { kind: "streaming" },
    });
    expect(
      (rejoined[1] as Extract<ChatMessage, { role: "assistant" }>).skeletons,
    ).toHaveLength(2);
    // still the same single stream — never aborted, never re-fetched
    expect(capturedOptions.signal.aborted).toBe(false);
    expect(streamFetch).toHaveBeenCalledTimes(1);
  });

  it("persists the origin chat's row via saveBackgroundChat when a backgrounded generation reaches terminal", async () => {
    const { app } = createMockApp();
    let capturedOptions: any = null;
    let resolveStream: (value: unknown) => void = () => {};
    const streamFetch = vi.fn().mockImplementation((options) => {
      capturedOptions = options;
      return new Promise((resolve) => {
        resolveStream = resolve;
      });
    });
    const historyHandles = createHistoryHandles({ activeChatId: "chat-1" });
    const actionsRef = { current: null as TTAChatActions | null };

    render(
      <TestHarness
        app={app}
        transportAdapter={{ stream: streamFetch, truncate: vi.fn() }}
        historyHandles={historyHandles}
        initialMessages={[]}
        actionsRef={actionsRef}
      />,
    );

    act(() => {
      actionsRef.current!.sendChatPrompt("draw a cat");
    });
    // `started` arrives while the chat is still displayed — adopted normally
    act(() => {
      capturedOptions.onStarted?.({
        chatId: "chat-1",
        turnId: "turn-1",
        messageId: "srv-msg-1",
      });
    });
    expect(historyHandles.applyServerChatMetadata).toHaveBeenCalledTimes(1);

    act(() => {
      actionsRef.current!.handleSelectChat(otherChat());
    });

    // terminal while backgrounded
    await act(async () => {
      resolveStream({
        finalPayload: {
          skeletons: [rectSkeleton],
          isComplete: true,
          chatId: "chat-1",
          turnId: "turn-1",
          messageId: "srv-msg-1",
          updatedAt: 777,
        },
        error: null,
      });
    });

    await waitFor(() =>
      expect(historyHandles.saveBackgroundChat).toHaveBeenCalledTimes(1),
    );
    const saved = (
      historyHandles.saveBackgroundChat as ReturnType<typeof vi.fn>
    ).mock.calls[0][0] as ChatConversation;
    expect(saved.id).toBe("chat-1");
    expect(saved.updatedAt).toBe(777);
    expect(saved.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
    expect(saved.messages[1]).toMatchObject({
      status: { kind: "done", outcome: "generated" },
      skeletons: [rectSkeleton],
    });
    // the displayed chat was never touched by the backgrounded terminal
    expect(getMessages().map((message) => message.id)).toEqual([
      "user-b",
      "assistant-b",
    ]);
    // the done metadata routed to the buffer, not the active-chat mirror
    expect(historyHandles.applyServerChatMetadata).toHaveBeenCalledTimes(1);
    expect(historyHandles.touchChatUpdatedAt).toHaveBeenCalledWith(
      "chat-1",
      777,
    );
  });

  it("routes a backgrounded `started` chatId to the buffer, not the displayed chat", async () => {
    const { app } = createMockApp();
    let capturedOptions: any = null;
    const streamFetch = vi.fn().mockImplementation((options) => {
      capturedOptions = options;
      return new Promise(() => {});
    });
    // brand-new chat: no chat id until `started`
    const historyHandles = createHistoryHandles({ activeChatId: "" });
    const actionsRef = { current: null as TTAChatActions | null };

    render(
      <TestHarness
        app={app}
        transportAdapter={{ stream: streamFetch, truncate: vi.fn() }}
        historyHandles={historyHandles}
        initialMessages={[]}
        actionsRef={actionsRef}
      />,
    );

    act(() => {
      actionsRef.current!.sendChatPrompt("draw a cat");
    });
    act(() => {
      actionsRef.current!.handleSelectChat(otherChat());
    });
    // `started` arrives after the chat was backgrounded
    act(() => {
      capturedOptions.onStarted?.({
        chatId: "chat-server-9",
        turnId: "turn-1",
        messageId: "srv-msg-1",
      });
    });

    // the server chat id must NOT be adopted onto the displayed chat
    expect(historyHandles.applyServerChatMetadata).not.toHaveBeenCalled();
    expect(historyHandles.setActiveChatId).not.toHaveBeenCalledWith(
      "chat-server-9",
    );

    // ...but the buffer adopted it: selecting the server chat id rejoins the
    // live generation
    act(() => {
      actionsRef.current!.handleSelectChat({
        id: "chat-server-9",
        title: "",
        updatedAt: 5,
        messages: [],
      });
    });
    const messages = getMessages();
    expect(messages[0]).toMatchObject({ role: "user", content: "draw a cat" });
    expect(messages[1]).toMatchObject({
      role: "assistant",
      status: { kind: "streaming" },
    });
  });

  it("stops the backgrounded generation and drops its buffer when the buffered chat is deleted", async () => {
    const { app } = createMockApp();
    let capturedOptions: any = null;
    const streamFetch = vi.fn().mockImplementation((options) => {
      capturedOptions = options;
      options.onChunk?.({ skeletons: [rectSkeleton], isComplete: false });
      return new Promise(() => {});
    });
    const historyHandles = createHistoryHandles({ activeChatId: "chat-1" });
    const actionsRef = { current: null as TTAChatActions | null };

    render(
      <TestHarness
        app={app}
        transportAdapter={{ stream: streamFetch, truncate: vi.fn() }}
        historyHandles={historyHandles}
        initialMessages={[]}
        actionsRef={actionsRef}
      />,
    );

    act(() => {
      actionsRef.current!.sendChatPrompt("draw a cat");
    });
    act(() => {
      actionsRef.current!.handleSelectChat(otherChat());
    });
    expect(capturedOptions.signal.aborted).toBe(false);

    act(() => {
      actionsRef.current!.handleDeleteChat("chat-1");
    });

    // the backgrounded generation was stopped and the chat deleted
    expect(capturedOptions.signal.aborted).toBe(true);
    expect(historyHandles.deleteChat).toHaveBeenCalledWith("chat-1");
    // nothing is persisted for a chat that is being deleted
    expect(historyHandles.saveBackgroundChat).not.toHaveBeenCalled();
    // the displayed chat is unaffected
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

  it("keeps the backgrounded generation streaming when the displayed chat is deleted", async () => {
    const { app } = createMockApp();
    let capturedOptions: any = null;
    let resolveStream: (value: unknown) => void = () => {};
    const streamFetch = vi.fn().mockImplementation((options) => {
      capturedOptions = options;
      return new Promise((resolve) => {
        resolveStream = resolve;
      });
    });
    const historyHandles = createHistoryHandles({ activeChatId: "chat-1" });
    const actionsRef = { current: null as TTAChatActions | null };

    render(
      <TestHarness
        app={app}
        transportAdapter={{ stream: streamFetch, truncate: vi.fn() }}
        historyHandles={historyHandles}
        initialMessages={[]}
        actionsRef={actionsRef}
      />,
    );

    act(() => {
      actionsRef.current!.sendChatPrompt("draw a cat");
    });
    act(() => {
      capturedOptions.onStarted?.({
        chatId: "chat-1",
        turnId: "turn-1",
        messageId: "srv-msg-1",
      });
    });
    act(() => {
      actionsRef.current!.handleSelectChat(otherChat());
    });

    // deleting the DISPLAYED chat must not stop the background generation
    act(() => {
      actionsRef.current!.handleDeleteChat("chat-2");
    });
    expect(capturedOptions.signal.aborted).toBe(false);
    expect(historyHandles.deleteChat).toHaveBeenCalledWith("chat-2");
    // the displayed conversation was cleared (new-chat flow)
    expect(getMessages()).toEqual([]);

    // ...and its terminal still persists the origin chat's row
    await act(async () => {
      resolveStream({
        finalPayload: {
          skeletons: [rectSkeleton],
          isComplete: true,
          chatId: "chat-1",
          turnId: "turn-1",
          messageId: "srv-msg-1",
          updatedAt: 888,
        },
        error: null,
      });
    });
    await waitFor(() =>
      expect(historyHandles.saveBackgroundChat).toHaveBeenCalledTimes(1),
    );
    expect(
      (historyHandles.saveBackgroundChat as ReturnType<typeof vi.fn>).mock
        .calls[0][0],
    ).toMatchObject({ id: "chat-1", updatedAt: 888 });
  });

  it("re-runs a trailing prompt-only turn as a fresh send with the same prompt and images (§5.8)", async () => {
    const { app } = createMockApp();
    const streamFetch = vi.fn().mockImplementation(() => new Promise(() => {}));
    const actionsRef = { current: null as TTAChatActions | null };

    render(
      <TestHarness
        app={app}
        transportAdapter={{ stream: streamFetch, truncate: vi.fn() }}
        historyHandles={createHistoryHandles({ activeChatId: "chat-1" })}
        initialMessages={[
          {
            id: "user-1",
            role: "user",
            content: "draw a cat",
            images: ["data:image/jpeg;base64,abc"],
            createdAt: 1,
          },
        ]}
        actionsRef={actionsRef}
      />,
    );

    // what the dialog's re-run affordance dispatches for the trailing turn
    act(() => {
      actionsRef.current!.sendChatPrompt("draw a cat", [
        "data:image/jpeg;base64,abc",
      ]);
    });

    expect(streamFetch).toHaveBeenCalledTimes(1);
    const { payload } = streamFetch.mock.calls[0][0];
    expect(payload.prompt).toBe("draw a cat");
    expect(payload.images).toEqual(["data:image/jpeg;base64,abc"]);
    // a fresh turn, never a retry payload (§2.5: re-run = fresh turn)
    expect(payload.retry).toBeUndefined();

    // the fresh turn appends a NEW user message + streaming assistant bubble
    const messages = getMessages();
    expect(messages).toHaveLength(3);
    expect(messages[1]).toMatchObject({
      role: "user",
      content: "draw a cat",
      images: ["data:image/jpeg;base64,abc"],
    });
    expect(messages[1].id).not.toBe("user-1");
    expect(messages[2]).toMatchObject({
      role: "assistant",
      status: { kind: "streaming" },
    });
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
