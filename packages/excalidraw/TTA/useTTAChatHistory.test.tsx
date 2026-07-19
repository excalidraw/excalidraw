import React from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorJotaiProvider } from "../editor-jotai";

import { evictAssistantPreviews } from "./useAIAssistantPreview";
import { useTTAChatHistory } from "./useTTAChatHistory";

import type {
  ChatConversation,
  ChatMessage,
  TTAPersistenceAdapter,
} from "./types";

vi.mock("./useAIAssistantPreview", () => ({
  evictAssistantPreviews: vi.fn(),
}));

const userMessage = (id: string, content: string): ChatMessage => ({
  id,
  role: "user",
  content,
  createdAt: 1,
});

const chat = (
  id: string,
  updatedAt: number,
  title = `title-${id}`,
): ChatConversation => ({
  id,
  title,
  updatedAt,
  messages: [userMessage(`user-${id}`, title)],
});

type HookValue = ReturnType<typeof useTTAChatHistory>;

const Harness = ({
  adapter,
  chatMessages,
  onHook,
}: {
  adapter: TTAPersistenceAdapter;
  chatMessages: ChatMessage[];
  onHook: (hook: HookValue) => void;
}) => {
  const hook = useTTAChatHistory({
    chatMessages,
    persistenceAdapter: adapter,
  });
  onHook(hook);
  return null;
};

const renderHistoryHook = (
  adapter: TTAPersistenceAdapter,
  chatMessages: ChatMessage[] = [],
) => {
  const hookRef: { current: HookValue | null } = { current: null };
  const utils = render(
    <EditorJotaiProvider>
      <Harness
        adapter={adapter}
        chatMessages={chatMessages}
        onHook={(hook) => {
          hookRef.current = hook;
        }}
      />
    </EditorJotaiProvider>,
  );
  return { hookRef, ...utils };
};

describe("useTTAChatHistory", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("merges hydrated chats by id + updatedAt instead of replacing", async () => {
    let resolveLoad: (chats: ChatConversation[]) => void = () => {};
    const adapter: TTAPersistenceAdapter = {
      loadChats: vi.fn(
        () =>
          new Promise<ChatConversation[]>((resolve) => {
            resolveLoad = resolve;
          }),
      ),
      saveChat: vi.fn().mockResolvedValue(undefined),
      deleteChat: vi.fn().mockResolvedValue(undefined),
    };

    const { hookRef } = renderHistoryHook(adapter);

    // In-memory state that exists before hydration resolves: chat-1 is newer
    // than its stored copy, chat-2 is unknown to storage.
    act(() => {
      hookRef.current!.setChatHistory([
        chat("chat-1", 200, "in-memory-newer"),
        chat("chat-2", 150),
      ]);
    });

    act(() => {
      resolveLoad([chat("chat-1", 100, "stored-stale"), chat("chat-3", 50)]);
    });

    await waitFor(() => {
      expect(hookRef.current!.chatHistory).toHaveLength(3);
    });

    const byId = new Map(
      hookRef.current!.chatHistory.map((entry) => [entry.id, entry]),
    );
    // newer in-memory copy wins over the stale stored one
    expect(byId.get("chat-1")?.title).toBe("in-memory-newer");
    expect(byId.get("chat-1")?.updatedAt).toBe(200);
    // in-memory-only and stored-only chats both survive
    expect(byId.get("chat-2")).toBeDefined();
    expect(byId.get("chat-3")).toBeDefined();
  });

  it("persists only terminal messages of the active chat, buffering brand-new chats until a chat id exists", async () => {
    const adapter: TTAPersistenceAdapter = {
      loadChats: vi.fn().mockResolvedValue([]),
      saveChat: vi.fn().mockResolvedValue(undefined),
      deleteChat: vi.fn().mockResolvedValue(undefined),
    };

    const messages: ChatMessage[] = [
      userMessage("user-1", "draw a cat"),
      {
        id: "assistant-1",
        role: "assistant",
        createdAt: 2,
        status: { kind: "streaming", phase: "generating", startedAt: 2 },
      },
      {
        id: "system-1",
        role: "system",
        createdAt: 3,
        variant: "messageLimitExceeded",
      },
    ];

    const { hookRef } = renderHistoryHook(adapter, messages);

    // no chat id yet (brand-new chat: `started` hasn't delivered one) — the
    // conversation stays buffered in memory
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(adapter.saveChat).not.toHaveBeenCalled();

    act(() => {
      hookRef.current!.setActiveChatId("chat-server-1");
    });

    await waitFor(() => {
      expect(adapter.saveChat).toHaveBeenCalled();
    });

    const savedChat = (adapter.saveChat as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as ChatConversation;
    expect(savedChat.id).toBe("chat-server-1");
    expect(savedChat.title).toBe("draw a cat");
    // streaming bubble and session-scoped system warning are not persisted
    expect(savedChat.messages).toHaveLength(1);
    expect(savedChat.messages[0]).toMatchObject({
      role: "user",
      content: "draw a cat",
    });
  });

  it("saveBackgroundChat writes a non-active chat's row with the normal filtering, title, and updatedAt semantics", async () => {
    const adapter: TTAPersistenceAdapter = {
      loadChats: vi.fn().mockResolvedValue([]),
      saveChat: vi.fn().mockResolvedValue(undefined),
      deleteChat: vi.fn().mockResolvedValue(undefined),
    };

    const { hookRef } = renderHistoryHook(adapter);
    await waitFor(() => expect(adapter.loadChats).toHaveBeenCalled());

    // a backgrounded generation's chat that reached terminal (§2.5: the one
    // write that isn't the active chat)
    act(() => {
      hookRef.current!.saveBackgroundChat({
        id: "chat-bg",
        title: "",
        updatedAt: 555,
        messages: [
          userMessage("user-1", "background prompt"),
          {
            id: "assistant-1",
            role: "assistant",
            createdAt: 2,
            skeletons: [],
            status: { kind: "done", elapsedMs: 5, outcome: "generated" },
          },
          {
            id: "assistant-2",
            role: "assistant",
            createdAt: 3,
            status: { kind: "streaming", phase: "generating", startedAt: 3 },
          },
        ],
      });
    });

    // the active-chat pointer is untouched
    expect(hookRef.current!.activeChatId).toBe("");
    // the row was upserted in memory with the derived title and the given
    // updatedAt, filtered to persistable (terminal-only) messages
    const row = hookRef.current!.chatHistory.find(
      (entry) => entry.id === "chat-bg",
    );
    expect(row).toMatchObject({ title: "background prompt", updatedAt: 555 });
    expect(row!.messages.map((message) => message.id)).toEqual([
      "user-1",
      "assistant-1",
    ]);
    // ...and persisted through the adapter
    await waitFor(() => expect(adapter.saveChat).toHaveBeenCalledTimes(1));
    expect(
      (adapter.saveChat as ReturnType<typeof vi.fn>).mock.calls[0][0],
    ).toMatchObject({ id: "chat-bg", title: "background prompt" });
  });

  it("deletes a chat from state and storage and evicts its cached previews", async () => {
    const storedChat: ChatConversation = {
      ...chat("chat-1", 100),
      messages: [
        userMessage("user-1", "draw a cat"),
        {
          id: "assistant-1",
          role: "assistant",
          createdAt: 2,
          skeletons: [],
          status: { kind: "done", elapsedMs: 5, outcome: "generated" },
        },
      ],
    };
    const adapter: TTAPersistenceAdapter = {
      loadChats: vi.fn().mockResolvedValue([storedChat]),
      saveChat: vi.fn().mockResolvedValue(undefined),
      deleteChat: vi.fn().mockResolvedValue(undefined),
    };

    const { hookRef } = renderHistoryHook(adapter);

    await waitFor(() => {
      expect(hookRef.current!.chatHistory).toHaveLength(1);
    });

    act(() => {
      hookRef.current!.deleteChat("chat-1");
    });

    await waitFor(() => {
      expect(hookRef.current!.chatHistory).toHaveLength(0);
    });
    expect(adapter.deleteChat).toHaveBeenCalledWith("chat-1");
    // M7: the deleted chat's assistant thumbnails leave the preview cache
    expect(evictAssistantPreviews).toHaveBeenCalledWith(["assistant-1"]);
  });
});
